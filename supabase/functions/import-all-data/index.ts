import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
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

    const sql = postgres(dbUrl);

    // ========== STEP 1: Disable all triggers to prevent side effects ==========
    const triggersToDisable = [
      { table: "public.appointments", trigger: "block_time_on_appointment_trigger" },
      { table: "public.appointments", trigger: "on_appointment_confirm" },
      { table: "public.appointments", trigger: "notify_on_new_appointment" },
      { table: "public.subscription_progress", trigger: "check_reset_monthly_cuts" },
      { table: "public.package_payments", trigger: "auto_subscription_on_payment" },
      { table: "public.subscription_progress", trigger: "notify_on_new_subscription" },
      { table: "public.appointment_services", trigger: "recalculate_blocked_slots_trigger" },
    ];

    for (const t of triggersToDisable) {
      try {
        await sql.unsafe(`ALTER TABLE ${t.table} DISABLE TRIGGER ALL`);
      } catch (_e) {
        // Trigger might not exist, that's ok
      }
    }

    // ========== STEP 2: Import auth.users with encrypted passwords ==========
    let authUsersImported = 0;
    const authErrors: string[] = [];

    if (importData.auth_users && Array.isArray(importData.auth_users) && importData.auth_users.length > 0) {
      // Get the instance_id from the current project
      let instanceId = "00000000-0000-0000-0000-000000000000";
      try {
        const rows = await sql`SELECT id FROM auth.schema_migrations LIMIT 1`;
        // Get instance_id from existing users if any
        const existingUsers = await sql`SELECT instance_id FROM auth.users LIMIT 1`;
        if (existingUsers.length > 0 && existingUsers[0].instance_id) {
          instanceId = existingUsers[0].instance_id;
        }
      } catch (_e) { /* use default */ }

      for (const authUser of importData.auth_users) {
        try {
          const existing = await sql`SELECT id FROM auth.users WHERE id = ${authUser.id}::uuid`;
          
          if (existing.length > 0) {
            // Update existing user - preserve encrypted password
            await sql`
              UPDATE auth.users 
              SET 
                encrypted_password = ${authUser.encrypted_password},
                raw_user_meta_data = ${JSON.stringify(authUser.raw_user_meta_data || {})}::jsonb,
                raw_app_meta_data = ${JSON.stringify(authUser.raw_app_meta_data || { provider: "email", providers: ["email"] })}::jsonb,
                phone = ${authUser.phone || null},
                updated_at = now()
              WHERE id = ${authUser.id}::uuid
            `;
            authUsersImported++;
          } else {
            // Check if email already exists with different ID
            const existingByEmail = await sql`SELECT id FROM auth.users WHERE email = ${authUser.email}`;
            if (existingByEmail.length > 0) {
              // Update existing user by email
              await sql`
                UPDATE auth.users 
                SET 
                  encrypted_password = ${authUser.encrypted_password},
                  raw_user_meta_data = ${JSON.stringify(authUser.raw_user_meta_data || {})}::jsonb,
                  updated_at = now()
                WHERE email = ${authUser.email}
              `;
              authUsersImported++;
              continue;
            }

            // Insert new user with original ID and encrypted password
            await sql`
              INSERT INTO auth.users (
                id, instance_id, email, encrypted_password, 
                email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
                phone, created_at, updated_at, aud, role,
                confirmation_token, recovery_token, email_change_token_new,
                email_change, is_sso_user
              ) VALUES (
                ${authUser.id}::uuid,
                ${instanceId}::uuid,
                ${authUser.email},
                ${authUser.encrypted_password},
                ${authUser.email_confirmed_at || new Date().toISOString()},
                ${JSON.stringify(authUser.raw_user_meta_data || {})}::jsonb,
                ${JSON.stringify(authUser.raw_app_meta_data || { provider: "email", providers: ["email"] })}::jsonb,
                ${authUser.phone || null},
                ${authUser.created_at || new Date().toISOString()},
                ${authUser.updated_at || new Date().toISOString()},
                ${authUser.aud || 'authenticated'},
                ${authUser.role || 'authenticated'},
                '', '', '', '', false
              )
            `;

            // Create identity record for email login to work
            await sql`
              INSERT INTO auth.identities (
                id, user_id, identity_data, provider, provider_id,
                last_sign_in_at, created_at, updated_at
              ) VALUES (
                gen_random_uuid(),
                ${authUser.id}::uuid,
                ${JSON.stringify({ sub: authUser.id, email: authUser.email, email_verified: true })}::jsonb,
                'email',
                ${authUser.id},
                now(), now(), now()
              )
              ON CONFLICT (provider, provider_id) DO NOTHING
            `;

            authUsersImported++;
          }
        } catch (e) {
          authErrors.push(`${authUser.email}: ${e.message}`);
        }
      }
    }

    // ========== STEP 3: Import application tables via direct SQL for reliability ==========
    // Order respects foreign key constraints
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

      // Use supabase client with service role (bypasses RLS)
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        
        // Clean batch: remove any undefined values
        const cleanBatch = batch.map((row: any) => {
          const clean: any = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== undefined) {
              clean[key] = value;
            }
          }
          return clean;
        });

        const { error } = await supabase
          .from(table)
          .upsert(cleanBatch, { onConflict: "id", ignoreDuplicates: false });

        if (error) {
          // If upsert fails, try inserting one by one to identify problematic rows
          for (const row of cleanBatch) {
            const { error: singleError } = await supabase
              .from(table)
              .upsert(row, { onConflict: "id", ignoreDuplicates: false });
            
            if (singleError) {
              tableErrors.push(`${table} row ${row.id}: ${singleError.message}`);
            } else {
              inserted++;
            }
          }
        } else {
          inserted += cleanBatch.length;
        }
      }

      results[table] = { inserted, errors: tableErrors };
    }

    // ========== STEP 4: Re-enable all triggers ==========
    for (const t of triggersToDisable) {
      try {
        await sql.unsafe(`ALTER TABLE ${t.table} ENABLE TRIGGER ALL`);
      } catch (_e) {
        // ignore
      }
    }

    await sql.end();

    // ========== STEP 5: Return summary ==========
    const totalInserted = Object.values(results).reduce((sum, r) => sum + r.inserted, 0);
    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0);
    const allTableErrors = Object.entries(results)
      .filter(([_, r]) => r.errors.length > 0)
      .flatMap(([table, r]) => r.errors.map(e => `[${table}] ${e}`));

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_inserted: totalInserted + authUsersImported,
          total_errors: totalErrors + authErrors.length,
          auth_users_imported: authUsersImported,
          auth_users_errors: authErrors,
          tables: results,
          error_details: [...authErrors, ...allTableErrors].slice(0, 50),
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
