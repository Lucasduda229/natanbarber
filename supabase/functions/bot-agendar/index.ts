import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkBotAuth, corsHeaders, jsonResponse, cleanPhone, addMinutesToTime } from "../_shared/bot-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = checkBotAuth(req);
  if (authError) return authError;

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      whatsapp,
      nome,
      servico_id,
      data: dateStr,
      horario,
      variacao,
      forma_pagamento,
    } = body as {
      whatsapp?: string;
      nome?: string;
      servico_id?: string;
      data?: string;
      horario?: string;
      variacao?: string;
      forma_pagamento?: string;
    };

    if (!whatsapp || !nome || !servico_id || !dateStr || !horario) {
      return jsonResponse(
        { success: false, error: "Campos obrigatórios: whatsapp, nome, servico_id, data, horario" },
        400
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return jsonResponse({ success: false, error: "Formato de data inválido. Use YYYY-MM-DD" }, 400);
    }

    // Normalizar horário "HH:mm" -> "HH:mm:ss"
    const timeNormalized = /^\d{2}:\d{2}$/.test(horario) ? `${horario}:00` : horario;
    if (!/^\d{2}:\d{2}:\d{2}$/.test(timeNormalized)) {
      return jsonResponse({ success: false, error: "Formato de horário inválido. Use HH:mm" }, 400);
    }

    const phone = cleanPhone(whatsapp);
    if (!phone) {
      return jsonResponse({ success: false, error: "Whatsapp inválido" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1) Buscar serviço (validar e pegar duração)
    const { data: service, error: svcError } = await supabase
      .from("services")
      .select("id, name, duration_minutes, active")
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

    // 2) Achar/criar cliente
    let userId: string;
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("phone", phone)
      .maybeSingle();

    if (existingProfile) {
      userId = existingProfile.user_id;
      // Atualiza nome se mudou
      await supabase.from("profiles").update({ full_name: nome }).eq("user_id", userId);
    } else {
      const generatedEmail = `bot_${phone}@natanbarbershop.local`;
      const generatedPassword = `bot_${phone}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: generatedEmail,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: { full_name: nome, phone, source: "whatsapp_bot" },
      });

      if (createError || !newUser?.user) {
        console.error("createUser error:", createError);
        return jsonResponse(
          { success: false, error: "Erro ao criar cliente: " + (createError?.message || "desconhecido") },
          500
        );
      }

      userId = newUser.user.id;

      // Trigger handle_new_user já cria profile + role; mas garantimos os campos:
      await supabase
        .from("profiles")
        .upsert({ user_id: userId, full_name: nome, phone }, { onConflict: "user_id" });
    }

    // 3) Verificar disponibilidade de todos os slots necessários
    const timesToCheck: string[] = [timeNormalized];
    for (let i = 1; i < requiredSlots; i++) {
      timesToCheck.push(addMinutesToTime(timeNormalized, i * 30));
    }

    const { data: blockedSlots } = await supabase
      .from("blocked_dates")
      .select("blocked_time")
      .eq("blocked_date", dateStr)
      .in("blocked_time", timesToCheck);

    if (blockedSlots && blockedSlots.length > 0) {
      return jsonResponse({ success: false, error: "Horário bloqueado" }, 409);
    }

    const { data: existingAppts } = await supabase
      .from("appointments")
      .select("id, appointment_time")
      .eq("appointment_date", dateStr)
      .in("appointment_time", timesToCheck)
      .neq("status", "cancelled");

    if (existingAppts && existingAppts.length > 0) {
      return jsonResponse({ success: false, error: "Horário já ocupado" }, 409);
    }

    // 4) Criar agendamento
    const notes = variacao ? `Variação: ${variacao}` : null;

    const { data: newAppt, error: apptError } = await supabase
      .from("appointments")
      .insert({
        user_id: userId,
        service_id: servico_id,
        appointment_date: dateStr,
        appointment_time: timeNormalized,
        status: "pending",
        payment_status: "pending",
        payment_method: forma_pagamento || "pix",
        notes,
      })
      .select()
      .single();

    if (apptError) {
      console.error("appointment insert error:", apptError);
      return jsonResponse({ success: false, error: "Erro ao criar agendamento: " + apptError.message }, 500);
    }

    return jsonResponse({
      success: true,
      agendamento: {
        id: newAppt.id,
        user_id: newAppt.user_id,
        servico_id: newAppt.service_id,
        servico: service.name,
        data: newAppt.appointment_date,
        date: newAppt.appointment_date,
        horario: (newAppt.appointment_time as string).slice(0, 5),
        time: (newAppt.appointment_time as string).slice(0, 5),
        start_time: `${newAppt.appointment_date}T${newAppt.appointment_time}`,
        status: newAppt.status,
        payment_status: newAppt.payment_status,
        payment_method: newAppt.payment_method,
        client_name: nome,
        client_phone: phone,
      },
    });
  } catch (e) {
    console.error("bot-agendar unexpected:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ success: false, error: msg }, 500);
  }
});
