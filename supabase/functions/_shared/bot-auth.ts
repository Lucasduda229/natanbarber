// Shared helpers for bot Edge Functions
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function checkBotAuth(req: Request): Response | null {
  const expected = Deno.env.get("BOT_API_SECRET");
  if (!expected) {
    return new Response(
      JSON.stringify({ success: false, error: "BOT_API_SECRET not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const provided = req.headers.get("x-bot-secret");
  if (!provided || provided !== expected) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized: invalid x-bot-secret" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  return null;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function cleanPhone(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

// "HH:mm:ss" or "HH:mm" -> "HH:mm"
export function shortTime(t: string | null | undefined): string {
  if (!t) return "";
  return t.slice(0, 5);
}

// Add minutes to "HH:mm:ss"
export function addMinutesToTime(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}:00`;
}
