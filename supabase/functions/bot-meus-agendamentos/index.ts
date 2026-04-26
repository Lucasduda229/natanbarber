import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkBotAuth, corsHeaders, jsonResponse, cleanPhone } from "../_shared/bot-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = checkBotAuth(req);
  if (authError) return authError;

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { whatsapp, status } = body as { whatsapp?: string; status?: string };

    if (!whatsapp) {
      return jsonResponse({ success: false, error: "Campo obrigatório: whatsapp" }, 400);
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

    // 1) Buscar usuário pelo telefone
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone")
      .eq("phone", phone)
      .maybeSingle();

    if (!profile) {
      return jsonResponse({ success: true, data: [], message: "Cliente não encontrado" });
    }

    // 2) Buscar agendamentos
    let query = supabase
      .from("appointments")
      .select("id, appointment_date, appointment_time, status, payment_status, payment_method, notes, services:service_id(id, name, price, duration_minutes)")
      .eq("user_id", profile.user_id)
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: appointments, error } = await query;

    if (error) {
      console.error("bot-meus-agendamentos error:", error);
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    const formatted = (appointments || []).map((a) => {
      const svc = a.services as { id: string; name: string; price: number; duration_minutes: number } | null;
      const timeStr = (a.appointment_time as string).slice(0, 5);
      return {
        id: a.id,
        data: a.appointment_date,
        date: a.appointment_date,
        horario: timeStr,
        time: timeStr,
        start_time: `${a.appointment_date}T${a.appointment_time}`,
        servico: svc?.name || null,
        service_id: svc?.id || null,
        service_name: svc?.name || null,
        preco: svc?.price ? Number(svc.price) : null,
        duracao: svc?.duration_minutes || null,
        status: a.status,
        payment_status: a.payment_status,
        payment_method: a.payment_method,
        notes: a.notes,
        client_name: profile.full_name,
        client_phone: profile.phone,
      };
    });

    return jsonResponse({ success: true, data: formatted });
  } catch (e) {
    console.error("bot-meus-agendamentos unexpected:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ success: false, error: msg }, 500);
  }
});
