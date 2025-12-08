import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  appointment_id: string;
  type: "confirmed" | "cancelled" | "reminder";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { appointment_id, type }: NotificationRequest = await req.json();

    console.log(`Processing notification for appointment: ${appointment_id}, type: ${type}`);

    // Fetch appointment with user and service details
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        appointment_time,
        status,
        notes,
        user_id,
        service_id
      `)
      .eq("id", appointment_id)
      .single();

    if (appointmentError || !appointment) {
      console.error("Appointment not found:", appointmentError);
      return new Response(
        JSON.stringify({ error: "Agendamento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get service name
    const { data: service } = await supabase
      .from("services")
      .select("name, price")
      .eq("id", appointment.service_id)
      .single();

    // Get user email from auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
      appointment.user_id
    );

    if (userError || !userData?.user?.email) {
      console.error("User email not found:", userError);
      return new Response(
        JSON.stringify({ error: "Email do usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", appointment.user_id)
      .single();

    const userEmail = userData.user.email;
    const userName = profile?.full_name || "Cliente";
    const serviceName = service?.name || "Serviço";
    const servicePrice = service?.price ? `R$ ${service.price.toFixed(2)}` : "";

    // Format date
    const [year, month, day] = appointment.appointment_date.split("-");
    const formattedDate = `${day}/${month}/${year}`;
    const formattedTime = appointment.appointment_time.substring(0, 5);

    let subject = "";
    let htmlContent = "";

    if (type === "confirmed") {
      subject = "✅ Seu agendamento foi confirmado!";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #1a1a2e; color: #ffffff; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #d4af37, #f4e4bc); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: #1a1a2e; margin: 0; font-size: 24px; }
            .content { background-color: #16213e; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background-color: #0f3460; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d4af37; }
            .info-row { display: flex; margin: 10px 0; }
            .label { color: #d4af37; font-weight: bold; min-width: 100px; }
            .value { color: #ffffff; }
            .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
            .highlight { color: #d4af37; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💈 Barbearia</h1>
            </div>
            <div class="content">
              <h2>Olá, ${userName}! 👋</h2>
              <p>Seu agendamento foi <span class="highlight">confirmado</span> com sucesso!</p>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="label">📅 Data:</span>
                  <span class="value">${formattedDate}</span>
                </div>
                <div class="info-row">
                  <span class="label">🕐 Horário:</span>
                  <span class="value">${formattedTime}</span>
                </div>
                <div class="info-row">
                  <span class="label">✂️ Serviço:</span>
                  <span class="value">${serviceName}</span>
                </div>
                ${servicePrice ? `
                <div class="info-row">
                  <span class="label">💰 Valor:</span>
                  <span class="value">${servicePrice}</span>
                </div>
                ` : ""}
              </div>
              
              <p>Te esperamos! Não se atrase 😉</p>
            </div>
            <div class="footer">
              <p>Este é um email automático. Por favor, não responda.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (type === "cancelled") {
      subject = "❌ Seu agendamento foi cancelado";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #1a1a2e; color: #ffffff; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #dc2626, #f87171); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
            .content { background-color: #16213e; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background-color: #0f3460; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
            .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💈 Barbearia</h1>
            </div>
            <div class="content">
              <h2>Olá, ${userName}</h2>
              <p>Infelizmente seu agendamento foi cancelado.</p>
              
              <div class="info-box">
                <p><strong>📅 Data:</strong> ${formattedDate}</p>
                <p><strong>🕐 Horário:</strong> ${formattedTime}</p>
                <p><strong>✂️ Serviço:</strong> ${serviceName}</p>
              </div>
              
              <p>Se tiver dúvidas, entre em contato conosco.</p>
            </div>
            <div class="footer">
              <p>Este é um email automático. Por favor, não responda.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // Send email
    const { error: emailError } = await resend.emails.send({
      from: "Barbearia <onboarding@resend.dev>",
      to: [userEmail],
      subject: subject,
      html: htmlContent,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar email", details: emailError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Email sent successfully to ${userEmail}`);

    return new Response(
      JSON.stringify({ success: true, message: "Notificação enviada com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in notify-appointment:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
