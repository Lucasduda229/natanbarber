import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current date/time in Brasilia timezone (UTC-3)
    const now = new Date();
    const brasiliaOffset = -3 * 60;
    const localTime = new Date(now.getTime() + (now.getTimezoneOffset() + brasiliaOffset) * 60000);
    
    const todayStr = localTime.toISOString().split("T")[0];
    const currentTimeStr = localTime.toTimeString().slice(0, 8); // HH:MM:SS

    // Find confirmed appointments where the time has passed
    // We check: appointment_date < today OR (appointment_date = today AND appointment_time + duration <= now)
    
    // Step 1: Get all confirmed appointments for today or earlier
    const { data: appointments, error: fetchError } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        appointment_time,
        service_id,
        payment_method,
        user_id,
        services (duration_minutes)
      `)
      .eq("status", "confirmed")
      .lte("appointment_date", todayStr);

    if (fetchError) {
      throw fetchError;
    }

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum agendamento para concluir", completed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toComplete: { id: string; payment_method: string | null; user_id: string }[] = [];

    for (const apt of appointments) {
      // Past dates: always complete
      if (apt.appointment_date < todayStr) {
        toComplete.push({ id: apt.id, payment_method: apt.payment_method, user_id: apt.user_id });
        continue;
      }

      // Today: check if appointment end time has passed
      const [hours, minutes] = apt.appointment_time.split(":").map(Number);
      const durationMinutes = (apt.services as any)?.duration_minutes || 30;
      
      // Calculate end time
      const endMinutes = hours * 60 + minutes + durationMinutes;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      const endTimeStr = `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}:00`;

      if (currentTimeStr >= endTimeStr) {
        toComplete.push({ id: apt.id, payment_method: apt.payment_method, user_id: apt.user_id });
      }
    }

    if (toComplete.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum agendamento para concluir agora", completed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map payment_method to payment_status
    const getPaymentStatus = (method: string | null): string => {
      switch (method) {
        case "pix": return "paid_pix";
        case "dinheiro": return "paid_cash";
        case "cartao": return "paid_card";
        case "subscription": return "paid_subscription";
        default: return "paid";
      }
    };

    // Update each appointment with correct payment status
    for (const apt of toComplete) {
      const paymentStatus = getPaymentStatus(apt.payment_method);
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ 
          status: "completed",
          payment_status: paymentStatus,
        })
        .eq("id", apt.id);

      if (updateError) {
        console.error(`Error completing appointment ${apt.id}:`, updateError);
      }
    }

    if (updateError) {
      throw updateError;
    }

    console.log(`Auto-completed ${toComplete.length} appointments`);

    return new Response(
      JSON.stringify({ message: `${toComplete.length} agendamento(s) concluído(s)`, completed: toComplete.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error auto-completing appointments:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
