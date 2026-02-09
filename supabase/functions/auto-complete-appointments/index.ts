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

    const toComplete: string[] = [];

    for (const apt of appointments) {
      // Past dates: always complete
      if (apt.appointment_date < todayStr) {
        toComplete.push(apt.id);
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
        toComplete.push(apt.id);
      }
    }

    if (toComplete.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum agendamento para concluir agora", completed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as completed
    const { error: updateError } = await supabase
      .from("appointments")
      .update({ status: "completed" })
      .in("id", toComplete);

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
