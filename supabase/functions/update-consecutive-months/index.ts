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

    // Get all active subscriptions
    const { data: subscriptions, error: fetchError } = await supabase
      .from("subscription_progress")
      .select("*")
      .eq("is_active", true);

    if (fetchError) throw fetchError;

    const today = new Date();
    let updatedCount = 0;

    for (const sub of subscriptions || []) {
      const startDate = new Date(sub.subscription_start_date);
      
      // Calculate months since subscription started
      const monthsDiff = (today.getFullYear() - startDate.getFullYear()) * 12 + 
                         (today.getMonth() - startDate.getMonth());
      
      // Add 1 because the first month counts as month 1
      const consecutiveMonths = Math.max(1, monthsDiff + 1);
      
      // Only update if changed
      if (consecutiveMonths !== sub.consecutive_months) {
        const { error: updateError } = await supabase
          .from("subscription_progress")
          .update({ 
            consecutive_months: consecutiveMonths,
            updated_at: new Date().toISOString()
          })
          .eq("id", sub.id);

        if (updateError) {
          console.error(`Error updating subscription ${sub.id}:`, updateError);
        } else {
          updatedCount++;
          console.log(`Updated ${sub.id}: ${sub.consecutive_months} -> ${consecutiveMonths} months`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${updatedCount} subscriptions`,
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
