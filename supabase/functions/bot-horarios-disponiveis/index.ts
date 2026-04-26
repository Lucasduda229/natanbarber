import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkBotAuth, corsHeaders, jsonResponse, addMinutesToTime, shortTime } from "../_shared/bot-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = checkBotAuth(req);
  if (authError) return authError;

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { servico_id, data: dateStr } = body as { servico_id?: string; data?: string };

    if (!servico_id || !dateStr) {
      return jsonResponse(
        { success: false, error: "Campos obrigatórios: servico_id, data (YYYY-MM-DD)" },
        400
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return jsonResponse({ success: false, error: "Formato de data inválido. Use YYYY-MM-DD" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1) Buscar serviço para saber duração
    const { data: service, error: svcError } = await supabase
      .from("services")
      .select("id, duration_minutes, active")
      .eq("id", servico_id)
      .maybeSingle();

    if (svcError || !service) {
      return jsonResponse({ success: false, error: "Serviço não encontrado" }, 404);
    }
    if (!service.active) {
      return jsonResponse({ success: false, error: "Serviço inativo" }, 400);
    }

    const duration = service.duration_minutes || 30;
    const requiredSlots = Math.ceil(duration / 30);

    // 2) Dia da semana (0=domingo .. 6=sabado)
    const dayDate = new Date(`${dateStr}T12:00:00Z`);
    const dayOfWeek = dayDate.getUTCDay();

    // 3) Slots configurados para o dia
    const { data: slots, error: slotsError } = await supabase
      .from("time_slots")
      .select("slot_time, is_blocked")
      .eq("day_of_week", dayOfWeek)
      .order("slot_time");

    if (slotsError) {
      return jsonResponse({ success: false, error: slotsError.message }, 500);
    }

    if (!slots || slots.length === 0) {
      return jsonResponse({ success: true, horarios_disponiveis: [], message: "Sem expediente neste dia" });
    }

    const allSlotTimes = slots.map((s) => shortTime(s.slot_time) + ":00"); // HH:mm:ss
    const openSlotsSet = new Set(
      slots.filter((s) => !s.is_blocked).map((s) => shortTime(s.slot_time) + ":00")
    );

    // 4) Datas bloqueadas (admin)
    const { data: blocked } = await supabase
      .from("blocked_dates")
      .select("blocked_time")
      .eq("blocked_date", dateStr);

    const blockedTimes = new Set(
      (blocked || [])
        .filter((b) => b.blocked_time)
        .map((b) => (b.blocked_time as string).slice(0, 8))
    );
    // Bloqueio do dia inteiro (blocked_time NULL)
    const fullDayBlocked = (blocked || []).some((b) => !b.blocked_time);
    if (fullDayBlocked) {
      return jsonResponse({ success: true, horarios_disponiveis: [], message: "Dia bloqueado" });
    }

    // 5) Agendamentos existentes
    const { data: appointments } = await supabase
      .from("appointments")
      .select("appointment_time, service_id, payment_method, services:service_id(duration_minutes)")
      .eq("appointment_date", dateStr)
      .neq("status", "cancelled");

    const occupied = new Set<string>();
    for (const ap of appointments || []) {
      const startTime = (ap.appointment_time as string).slice(0, 8);
      const isSubscription = ap.payment_method === "subscription";
      const apDuration = isSubscription
        ? 30
        : (ap.services as { duration_minutes?: number } | null)?.duration_minutes || 30;
      const slotsCount = Math.ceil(apDuration / 30);
      for (let i = 0; i < slotsCount; i++) {
        occupied.add(addMinutesToTime(startTime, i * 30));
      }
    }

    // 6) Hora atual (não permitir slots no passado)
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const isToday = todayStr === dateStr;
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() - 180; // UTC-3 (Brasil)

    // 7) Filtrar slots que cabem o serviço
    const available: { horario: string }[] = [];
    for (const slotTime of allSlotTimes) {
      if (!openSlotsSet.has(slotTime)) continue;
      if (blockedTimes.has(slotTime)) continue;
      if (occupied.has(slotTime)) continue;

      // Verificar se cabem todos os slots consecutivos
      let fits = true;
      for (let i = 1; i < requiredSlots; i++) {
        const next = addMinutesToTime(slotTime, i * 30);
        if (!allSlotTimes.includes(next) || !openSlotsSet.has(next) || blockedTimes.has(next) || occupied.has(next)) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;

      // Filtrar passado se for hoje
      if (isToday) {
        const [h, m] = slotTime.split(":").map(Number);
        if (h * 60 + m <= nowMinutes) continue;
      }

      available.push({ horario: slotTime.slice(0, 5) });
    }

    return jsonResponse({ success: true, horarios_disponiveis: available });
  } catch (e) {
    console.error("bot-horarios-disponiveis unexpected:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ success: false, error: msg }, 500);
  }
});
