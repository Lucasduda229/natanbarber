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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // This function now only logs subscription status
    // It does NOT recalculate consecutive_months
    // consecutive_months is managed exclusively by:
    // 1. The auto_add_subscription_on_payment trigger (+1 on each confirmed payment)
    // 2. Manual admin adjustments
    
    const { data: subscriptions, error: fetchError } = await supabase
      .from("subscription_progress")
      .select("*")
      .eq("is_active", true);

    if (fetchError) throw fetchError;

    console.log(`Active subscriptions: ${subscriptions?.length || 0}`);
    
    for (const sub of subscriptions || []) {
      console.log(`Subscription ${sub.id}: ${sub.consecutive_months} months (start: ${sub.subscription_start_date})`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Checked ${subscriptions?.length || 0} active subscriptions (no changes made - months managed by payment trigger)`,
        total: subscriptions?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
