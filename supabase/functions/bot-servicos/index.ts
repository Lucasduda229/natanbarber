import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkBotAuth, corsHeaders, jsonResponse } from "../_shared/bot-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = checkBotAuth(req);
  if (authError) return authError;

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabase
      .from("services")
      .select("id, name, price, duration_minutes, description, subscribers_only")
      .eq("active", true)
      .order("name");

    if (error) {
      console.error("bot-servicos error:", error);
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    const formatted = (data || []).map((s) => ({
      id: s.id,
      nome: s.name,
      name: s.name,
      preco: Number(s.price),
      price: Number(s.price),
      duracao: s.duration_minutes,
      duration_minutes: s.duration_minutes,
      descricao: s.description,
      subscribers_only: s.subscribers_only,
    }));

    return jsonResponse({ success: true, data: formatted });
  } catch (e) {
    console.error("bot-servicos unexpected:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ success: false, error: msg }, 500);
  }
});
