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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const importData = await req.json();

    if (!importData.tables || !importData.version) {
      return new Response(JSON.stringify({ error: "Formato de arquivo inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Import auth.users first (if present)
    let authUsersImported = 0;
    const authErrors: string[] = [];
    if (importData.auth_users && Array.isArray(importData.auth_users)) {
      for (const authUser of importData.auth_users) {
        try {
          // Try to create user with original ID and metadata
          const { error: createError } = await supabase.auth.admin.createUser({
            email: authUser.email,
            phone: authUser.phone || undefined,
            password: undefined, // User will need to reset password
            email_confirm: true,
            user_metadata: authUser.user_metadata || {},
            app_metadata: authUser.app_metadata || {},
          });
          if (createError) {
            // User might already exist
            if (!createError.message?.includes("already been registered")) {
              authErrors.push(`${authUser.email}: ${createError.message}`);
            }
          } else {
            authUsersImported++;
          }
        } catch (e) {
          authErrors.push(`${authUser.email}: ${e.message}`);
        }
      }
    }

    // Import order matters due to foreign key constraints
    const importOrder = [
      "admin_settings",
      "barbershop_status",
      "services",
      "time_slots",
      "profiles",
      "user_roles",
      "packages",
      "package_items",
      "package_benefits",
      "loyalty_programs",
      "subscriber_rewards",
      "appointments",
      "appointment_services",
      "blocked_dates",
      "subscription_progress",
      "package_payments",
      "client_packages",
      "client_package_usage",
      "loyalty_progress",
      "loyalty_rewards_history",
      "reward_claims",
      "reviews",
      "notifications",
      "revenue_adjustments",
      "service_gallery",
      "push_subscriptions",
    ];

    const results: Record<string, { inserted: number; errors: string[] }> = {};

    for (const table of importOrder) {
      const rows = importData.tables[table];
      if (!rows || rows.length === 0) {
        results[table] = { inserted: 0, errors: [] };
        continue;
      }

      const tableErrors: string[] = [];
      let inserted = 0;

      // Insert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await supabase
          .from(table)
          .upsert(batch, { onConflict: "id", ignoreDuplicates: false });

        if (error) {
          tableErrors.push(`Batch ${Math.floor(i / 100) + 1}: ${error.message}`);
        } else {
          inserted += batch.length;
        }
      }

      results[table] = { inserted, errors: tableErrors };
    }

    const totalInserted = Object.values(results).reduce((sum, r) => sum + r.inserted, 0);
    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_inserted: totalInserted + authUsersImported,
          total_errors: totalErrors + authErrors.length,
          auth_users_imported: authUsersImported,
          auth_users_errors: authErrors,
          tables: results,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
