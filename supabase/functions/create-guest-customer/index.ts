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
    const { name, phone } = await req.json();

    if (!name || !phone) {
      return new Response(
        JSON.stringify({ error: "Nome e telefone são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number - keep only digits
    const cleanPhone = phone.replace(/\D/g, "");
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if a profile with this phone already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existingProfile) {
      console.log("Found existing customer with phone:", cleanPhone);
      return new Response(
        JSON.stringify({ 
          user_id: existingProfile.user_id, 
          is_new: false,
          message: "Cliente existente encontrado" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a new user with generated email
    const generatedEmail = `guest_${cleanPhone}@natanbarbershop.local`;
    const generatedPassword = `guest_${cleanPhone}_${Date.now()}`;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: generatedEmail,
      password: generatedPassword,
      email_confirm: true, // Auto-confirm since it's a guest account
      user_metadata: {
        full_name: name,
        phone: cleanPhone,
        is_guest: true
      }
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar conta: " + createError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create profile for the new user
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: newUser.user.id,
        full_name: name,
        phone: cleanPhone
      });

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Don't fail the whole operation, profile can be created later
    }

    // Assign user role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: "user"
      });

    if (roleError) {
      console.error("Error assigning role:", roleError);
    }

    console.log("Created new guest customer:", newUser.user.id);
    
    return new Response(
      JSON.stringify({ 
        user_id: newUser.user.id, 
        is_new: true,
        message: "Nova conta criada com sucesso" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: "Erro inesperado: " + errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
