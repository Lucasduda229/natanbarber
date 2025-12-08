import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message } = await req.json();
    
    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Mensagem não fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get services list from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: services } = await supabase
      .from('services')
      .select('id, name, price, duration_minutes')
      .eq('active', true);

    const servicesList = services?.map(s => `- "${s.name}" (ID: ${s.id}, R$${s.price})`).join('\n') || 'Nenhum serviço cadastrado';

    const today = new Date().toISOString().split('T')[0];

    const systemPrompt = `Você é um assistente de barbearia que interpreta mensagens para criar agendamentos.

SERVIÇOS DISPONÍVEIS:
${servicesList}

DATA DE HOJE: ${today}

INSTRUÇÕES:
1. Extraia da mensagem: nome do cliente, telefone (se houver), serviço, data e horário
2. A data deve estar no formato YYYY-MM-DD
3. O horário deve estar no formato HH:MM (24h)
4. O service_id deve corresponder a um dos serviços listados acima
5. Se não conseguir identificar algum campo obrigatório, retorne um erro explicativo

RESPONDA SEMPRE em JSON válido com esta estrutura:
{
  "success": true/false,
  "data": {
    "client_name": "Nome do Cliente",
    "client_phone": "Telefone ou null",
    "service_id": "uuid do serviço",
    "service_name": "nome do serviço",
    "appointment_date": "YYYY-MM-DD",
    "appointment_time": "HH:MM",
    "notes": "observações extraídas da mensagem"
  },
  "error": "mensagem de erro se success=false"
}

EXEMPLOS:
- "Corte de cabelo para João amanhã às 14h" -> extrair cliente João, serviço corte, data de amanhã, horário 14:00
- "Barba do Carlos dia 15/12 às 10:30" -> extrair cliente Carlos, serviço barba, data 2024-12-15, horário 10:30
- "Agendamento Pedro Silva tel 11999887766 corte e barba sexta 16h" -> extrair todos os dados`;

    console.log('Sending message to Lovable AI:', message);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos no workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao processar com IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    
    console.log('AI Response:', content);

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response from AI
    let parsedData;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      return new Response(
        JSON.stringify({ 
          error: 'Não consegui interpretar a mensagem. Tente ser mais específico com: cliente, serviço, data e horário.',
          raw_response: content 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(parsedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in ai-appointment-parser:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
