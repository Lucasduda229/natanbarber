import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ResetEmailRequest {
  email: string;
  redirectTo: string;
}

// Simple in-memory rate limiting (per IP, resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 5; // Max 5 requests
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // Per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return true;
  }
  
  record.count++;
  return false;
}

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: unknown): email is string {
  return typeof email === 'string' && 
         email.length > 0 && 
         email.length <= 255 && 
         emailRegex.test(email.trim());
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     "unknown";
    
    // Check rate limit
    if (isRateLimited(clientIP)) {
      console.log("Rate limit exceeded for IP:", clientIP);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const body = await req.json();
    const { email, redirectTo } = body as ResetEmailRequest;
    
    // Validate email format
    if (!validateEmail(email)) {
      console.log("Invalid email format received");
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate redirectTo URL
    if (!redirectTo || typeof redirectTo !== 'string' || redirectTo.length > 500) {
      console.log("Invalid redirectTo URL");
      return new Response(
        JSON.stringify({ error: "Invalid redirect URL" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const sanitizedEmail = email.trim().toLowerCase();
    console.log("Received reset password request for:", sanitizedEmail);

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate password reset link
    const { data, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: sanitizedEmail,
      options: {
        redirectTo: redirectTo,
      },
    });

    // If user not found, return success anyway (security: don't reveal if email exists)
    if (resetError) {
      console.log("User not found or error generating link:", resetError.message);
      // Return success to prevent email enumeration
      return new Response(JSON.stringify({ success: true, message: "Se o email estiver cadastrado, você receberá um link de recuperação" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    const resetLink = data.properties?.action_link;
    
    if (!resetLink) {
      console.log("Failed to generate reset link");
      return new Response(JSON.stringify({ success: true, message: "Se o email estiver cadastrado, você receberá um link de recuperação" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    console.log("Reset link generated successfully");

    // Send email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Barbearia <onboarding@resend.dev>",
        to: [sanitizedEmail],
        subject: "Redefinir sua senha",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; margin: 0; padding: 40px 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(0,0,0,0.8)); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 12px; padding: 40px;">
              <h1 style="color: #d4af37; font-size: 24px; margin: 0 0 24px 0; text-align: center;">
                🔐 Redefinir Senha
              </h1>
              <p style="color: #e5e5e5; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Você solicitou a redefinição da sua senha. Clique no botão abaixo para criar uma nova senha:
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #d4af37, #b8960c); color: #0a0a0a; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Redefinir Senha
                </a>
              </div>
              <p style="color: #a3a3a3; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                Se você não solicitou esta redefinição, ignore este email. O link expira em 24 horas.
              </p>
              <hr style="border: none; border-top: 1px solid rgba(212, 175, 55, 0.2); margin: 32px 0;">
              <p style="color: #737373; font-size: 12px; text-align: center; margin: 0;">
                Este email foi enviado automaticamente. Por favor, não responda.
              </p>
            </div>
          </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend API error:", errorData);
      throw new Error(errorData.message || "Failed to send email");
    }

    const emailResult = await emailResponse.json();

    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, message: "Email enviado com sucesso" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-reset-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
