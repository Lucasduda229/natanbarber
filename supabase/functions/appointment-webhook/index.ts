import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown>;
  schema: string;
  old_record: Record<string, unknown> | null;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: WebhookPayload = await req.json();
    console.log('Webhook received:', payload);

    // Only process new appointments
    if (payload.type !== 'INSERT' || payload.table !== 'appointments') {
      return new Response(
        JSON.stringify({ message: 'Ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appointment = payload.record;
    console.log('New appointment:', appointment);

    // Get client profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', appointment.user_id)
      .single();

    // Get service name
    const { data: service } = await supabase
      .from('services')
      .select('name')
      .eq('id', appointment.service_id)
      .single();

    const clientName = profile?.full_name || 'Novo cliente';
    const serviceName = service?.name || 'Serviço';
    const appointmentTime = (appointment.appointment_time as string)?.slice(0, 5) || '';
    const appointmentDate = appointment.appointment_date as string || '';

    // Get all admin user IDs
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    const adminUserIds = adminRoles?.map(r => r.user_id) || [];
    console.log('Admin IDs:', adminUserIds);

    // Get push subscriptions for admins
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', adminUserIds);

    console.log(`Found ${subscriptions?.length || 0} push subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No subscriptions', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For each subscription, send a push notification
    // Note: Full Web Push requires crypto operations. 
    // For now, we'll log the notification intent.
    // In production, you'd use a library like web-push-libs
    
    console.log('Would send push notification:', {
      title: '🔔 Novo Agendamento!',
      body: `${clientName} agendou ${serviceName} para ${appointmentDate} às ${appointmentTime}`,
      subscriptions: subscriptions.length
    });

    // Create in-app notification for admins
    for (const adminId of adminUserIds) {
      await supabase
        .from('notifications')
        .insert({
          user_id: adminId,
          title: '🔔 Novo Agendamento!',
          message: `${clientName} agendou ${serviceName} para ${appointmentDate} às ${appointmentTime}`,
          type: 'appointment',
          appointment_id: appointment.id as string
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notifications created',
        adminCount: adminUserIds.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
