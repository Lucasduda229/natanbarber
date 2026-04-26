// ⚠️ EDGE FUNCTION TEMPORÁRIA - DELETAR APÓS USO
// Retorna a SUPABASE_SERVICE_ROLE_KEY para configuração do bot externo.
// Protegida pelo header x-bot-secret (mesmo BOT_API_SECRET das outras funções do bot).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bot-secret",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const providedSecret = req.headers.get("x-bot-secret");
  const expectedSecret = Deno.env.get("BOT_API_SECRET");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({
      SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
      warning: "DELETE ESTA EDGE FUNCTION APÓS COPIAR A CHAVE!",
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
