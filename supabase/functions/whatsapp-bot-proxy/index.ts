// Proxy para o chatbot WhatsApp externo
// Apenas administradores autenticados podem chamar esta função
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action = "qrcode" | "pairing" | "status" | "disconnect";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) Validar usuário autenticado
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ success: false, error: "Não autenticado" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ success: false, error: "Sessão inválida" }, 401);
    }

    // 2) Verificar role admin
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return json({ success: false, error: "Acesso negado" }, 403);
    }

    // 3) Body
    const body = await req.json().catch(() => ({}));
    const action: Action = body.action;
    const phone: string | undefined = body.phone;

    if (!action) {
      return json({ success: false, error: "Ação obrigatória" }, 400);
    }

    // 4) Carregar config do bot
    const { data: cfg } = await adminClient
      .from("whatsapp_bot_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!cfg) {
      return json(
        { success: false, error: "Configuração do bot não encontrada" },
        404
      );
    }

    let endpoint: string | null = null;
    let method = "GET";
    let payload: Record<string, unknown> | undefined;

    switch (action) {
      case "qrcode":
        endpoint = cfg.qrcode_endpoint;
        break;
      case "pairing":
        endpoint = cfg.pairing_endpoint;
        method = "POST";
        payload = { number: phone };
        break;
      case "status":
        endpoint = cfg.status_endpoint;
        break;
      case "disconnect":
        endpoint = cfg.disconnect_endpoint;
        method = "POST";
        break;
    }

    if (!endpoint) {
      return json(
        {
          success: false,
          error: `Endpoint "${action}" não configurado. Configure as URLs do seu chatbot primeiro.`,
        },
        400
      );
    }

    // Montar URL final
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${(cfg.bot_base_url || "").replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

    // 5) Chamar o bot externo
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      // ngrok free tier exige este header para pular a página de aviso
      "ngrok-skip-browser-warning": "true",
    };
    const headerName = cfg.auth_header_name || "apikey";
    // Prioriza secret BOT_API_SECRET do servidor; fallback para valor salvo no banco
    const headerValue = Deno.env.get("BOT_API_SECRET") || cfg.auth_header_value;
    if (headerName && headerValue) {
      headers[headerName] = headerValue;
    }

    const upstream = await fetch(url, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(payload || {}) : undefined,
    });

    const contentType = upstream.headers.get("content-type") || "";
    let upstreamData: unknown;
    if (contentType.includes("application/json")) {
      upstreamData = await upstream.json();
    } else {
      upstreamData = await upstream.text();
    }

    if (!upstream.ok) {
      return json(
        {
          success: false,
          error: `Bot retornou ${upstream.status}`,
          data: upstreamData,
        },
        502
      );
    }

    // Atualiza status caso seja status/disconnect
    if (action === "status" || action === "disconnect") {
      const newStatus =
        action === "disconnect" ? "disconnected" : extractStatus(upstreamData);
      await adminClient
        .from("whatsapp_bot_config")
        .update({
          last_status: newStatus,
          last_connected_at: newStatus === "connected" ? new Date().toISOString() : cfg.last_connected_at,
        })
        .eq("id", cfg.id);
    }

    return json({ success: true, data: upstreamData });
  } catch (e) {
    console.error("whatsapp-bot-proxy error:", e);
    return json({ success: false, error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractStatus(data: unknown): string {
  if (typeof data !== "object" || data === null) return "unknown";
  const d = data as Record<string, unknown>;
  const s = (d.status || d.state || d.connection || "").toString().toLowerCase();
  if (s.includes("open") || s.includes("connect")) return "connected";
  if (s.includes("close") || s.includes("disconnect")) return "disconnected";
  if (s.includes("connecting") || s.includes("qr")) return "connecting";
  return s || "unknown";
}
