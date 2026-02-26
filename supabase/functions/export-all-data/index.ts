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

    // Export auth.users via admin API
    let authUsers: unknown[] = [];
    try {
      let page = 1;
      const perPage = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({
          page,
          perPage,
        });
        if (usersError) throw usersError;
        authUsers = authUsers.concat(users);
        hasMore = users.length === perPage;
        page++;
      }
    } catch (e) {
      console.error("Error fetching auth users:", e);
    }

    // List of all tables to export
    const tables = [
      "profiles",
      "user_roles",
      "services",
      "appointments",
      "appointment_services",
      "blocked_dates",
      "time_slots",
      "packages",
      "package_items",
      "package_benefits",
      "package_payments",
      "client_packages",
      "client_package_usage",
      "subscription_progress",
      "loyalty_programs",
      "loyalty_progress",
      "loyalty_rewards_history",
      "subscriber_rewards",
      "reward_claims",
      "reviews",
      "notifications",
      "revenue_adjustments",
      "admin_settings",
      "barbershop_status",
      "service_gallery",
      "push_subscriptions",
    ];

    const exportData: Record<string, unknown[]> = {};
    const errors: string[] = [];

    // Fetch all tables in parallel
    const results = await Promise.all(
      tables.map(async (table) => {
        // Fetch all rows (handle pagination for large tables)
        let allRows: unknown[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .range(from, from + pageSize - 1);

          if (error) {
            errors.push(`${table}: ${error.message}`);
            hasMore = false;
          } else {
            allRows = allRows.concat(data || []);
            hasMore = (data?.length || 0) === pageSize;
            from += pageSize;
          }
        }

        return { table, rows: allRows };
      })
    );

    for (const result of results) {
      exportData[result.table] = result.rows;
    }

    const exportPayload = {
      exported_at: new Date().toISOString(),
      version: "2.0",
      auth_users: authUsers,
      auth_users_count: authUsers.length,
      tables: exportData,
      row_counts: Object.fromEntries(
        Object.entries(exportData).map(([k, v]) => [k, v.length])
      ),
      errors: errors.length > 0 ? errors : undefined,
    };

    return new Response(JSON.stringify(exportPayload, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
