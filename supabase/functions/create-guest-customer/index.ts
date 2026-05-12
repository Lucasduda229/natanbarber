import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AppointmentData {
  service_id: string;
  additional_service_ids?: string[];
  appointment_date: string;
  appointment_time: string;
  notes?: string;
  payment_method?: string;
  check_availability?: boolean;
  total_duration_minutes?: number;
}

// Helper function to add minutes to a time string (HH:mm:ss)
const addMinutesToTime = (timeStr: string, minutes: number): string => {
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}:00`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, phone, appointment } = await req.json() as {
      name: string;
      phone: string;
      appointment?: AppointmentData;
    };

    if (!name || !phone) {
      return new Response(
        JSON.stringify({ error: "Nome e telefone são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number - keep only digits
    const cleanPhone = phone.replace(/\D/g, "");
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let userId: string;
    let isNewCustomer = false;

    // Check if a profile with this phone already exists (handle duplicates)
    const { data: existingProfiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, created_at")
      .eq("phone", cleanPhone)
      .order("created_at", { ascending: true })
      .limit(1);
    const existingProfile = existingProfiles && existingProfiles.length > 0 ? existingProfiles[0] : null;

    if (existingProfile) {
      userId = existingProfile.user_id;
      console.log("Found existing customer with phone:", cleanPhone);
      
      // Update the name if it changed
      await supabaseAdmin
        .from("profiles")
        .update({ full_name: name })
        .eq("user_id", userId);
    } else {
      // Create a new user with generated email
      const generatedEmail = `guest_${cleanPhone}@natanbarbershop.local`;
      const generatedPassword = `guest_${cleanPhone}_${Date.now()}`;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: generatedEmail,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          phone: cleanPhone,
          is_guest: true
        }
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: "Erro ao criar conta: " + createError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;
      isNewCustomer = true;

      // Create profile for the new user
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          user_id: userId,
          full_name: name,
          phone: cleanPhone
        });

      if (profileError) {
        console.error("Error creating profile:", profileError);
      }

      // Assign user role
      await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "user"
        });

      console.log("Created new guest customer:", userId);
    }

    // If appointment data is provided, create the appointment
    let appointmentResult = null;
    if (appointment) {
      // Check availability if requested - now checking all required slots based on duration
      if (appointment.check_availability) {
        // Calculate required slots based on total duration (default 30 min if not provided)
        const totalDuration = appointment.total_duration_minutes || 30;
        const requiredSlots = Math.ceil(totalDuration / 30);
        
        // Generate all time slots that will be occupied
        const timesToCheck = [appointment.appointment_time];
        for (let i = 1; i < requiredSlots; i++) {
          timesToCheck.push(addMinutesToTime(appointment.appointment_time, i * 30));
        }
        
        // Check if any of the required time slots are BLOCKED (manual blocks by admin)
        const { data: blockedSlots } = await supabaseAdmin
          .from("blocked_dates")
          .select("blocked_time")
          .eq("blocked_date", appointment.appointment_date)
          .in("blocked_time", timesToCheck);

        if (blockedSlots && blockedSlots.length > 0) {
          console.log("Blocked slots found:", blockedSlots);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Este horário está bloqueado e não pode ser agendado!" 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Check if any of the required time slots are already booked by appointments
        const { data: existingAppointments } = await supabaseAdmin
          .from("appointments")
          .select("id, appointment_time")
          .eq("appointment_date", appointment.appointment_date)
          .in("appointment_time", timesToCheck)
          .neq("status", "cancelled");

        if (existingAppointments && existingAppointments.length > 0) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: requiredSlots > 1 
                ? "Um ou mais horários necessários já estão ocupados!" 
                : "Este horário já está ocupado!" 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const { data: newAppointment, error: appointmentError } = await supabaseAdmin
        .from("appointments")
        .insert({
          user_id: userId,
          service_id: appointment.service_id,
          appointment_date: appointment.appointment_date,
          appointment_time: appointment.appointment_time,
          status: "pending",
          payment_status: "pending",
          payment_method: appointment.payment_method || null,
          notes: appointment.notes || null,
        })
        .select()
        .single();

      if (appointmentError) {
        console.error("Error creating appointment:", appointmentError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao criar agendamento: " + appointmentError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      appointmentResult = newAppointment;

      // Insert additional services if provided
      if (appointment.additional_service_ids && appointment.additional_service_ids.length > 0) {
        const additionalServices = appointment.additional_service_ids.map(serviceId => ({
          appointment_id: newAppointment.id,
          service_id: serviceId,
        }));

        const { error: additionalError } = await supabaseAdmin
          .from("appointment_services")
          .insert(additionalServices);

        if (additionalError) {
          console.error("Error inserting additional services:", additionalError);
        }
      }

      console.log("Created appointment:", newAppointment.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        user_id: userId, 
        is_new: isNewCustomer,
        appointment: appointmentResult,
        message: isNewCustomer ? "Nova conta criada com sucesso" : "Cliente existente encontrado"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: "Erro inesperado: " + errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
