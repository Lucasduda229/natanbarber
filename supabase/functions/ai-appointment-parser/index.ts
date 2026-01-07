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
    
    // Input validation: check type and length to prevent abuse
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Mensagem não fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (message.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Mensagem muito longa. Máximo de 1000 caracteres.' }),
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
1. Extraia da mensagem: nome do cliente, telefone (se houver), TODOS os serviços mencionados, data e horário
2. A data deve estar no formato YYYY-MM-DD
3. O horário deve estar no formato HH:MM (24h)
4. IMPORTANTE: Extraia TODOS os serviços mencionados (ex: "corte e barba" = 2 serviços, "corte + sobrancelha" = 2 serviços)
5. O primeiro serviço é o principal, os demais são adicionais
6. Se não conseguir identificar algum campo obrigatório, retorne um erro explicativo

RESPONDA SEMPRE em JSON válido com esta estrutura:
{
  "success": true/false,
  "data": {
    "client_name": "Nome do Cliente",
    "client_phone": "Telefone ou null",
    "services": [
      {"service_id": "uuid", "service_name": "nome", "price": valor},
      {"service_id": "uuid", "service_name": "nome", "price": valor}
    ],
    "appointment_date": "YYYY-MM-DD",
    "appointment_time": "HH:MM",
    "notes": "observações extraídas da mensagem"
  },
  "error": "mensagem de erro se success=false"
}

EXEMPLOS:
- "Corte e barba para João amanhã às 14h" -> 2 serviços: corte + barba
- "Pedro dia 15 às 10h corte + sobrancelha + pezinho" -> 3 serviços
- "Agendamento Carlos corte degradê e barba sexta 16h" -> 2 serviços: corte degradê + barba`;

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

    // Validate services - make sure they exist and get correct prices
    if (parsedData.success && parsedData.data) {
      // Handle new format with services array
      if (parsedData.data.services && Array.isArray(parsedData.data.services)) {
        const validatedServices = [];
        
        for (const svc of parsedData.data.services) {
          let matchedService = services?.find(s => s.id === svc.service_id);
          
          if (!matchedService) {
            // Try fuzzy match by name
            const svcName = (svc.service_name || '').toLowerCase();
            matchedService = services?.find(s => 
              s.name.toLowerCase().includes(svcName) || 
              svcName.includes(s.name.toLowerCase()) ||
              s.name.toLowerCase().replace(/\s+/g, '').includes(svcName.replace(/\s+/g, '')) ||
              svcName.replace(/\s+/g, '').includes(s.name.toLowerCase().replace(/\s+/g, ''))
            );
          }
          
          if (matchedService) {
            validatedServices.push({
              service_id: matchedService.id,
              service_name: matchedService.name,
              price: matchedService.price
            });
          }
        }
        
        if (validatedServices.length === 0) {
          // Fallback to default service
          const defaultService = services?.[0];
          if (defaultService) {
            validatedServices.push({
              service_id: defaultService.id,
              service_name: defaultService.name,
              price: defaultService.price
            });
          }
        }
        
        parsedData.data.services = validatedServices;
        parsedData.data.total_price = validatedServices.reduce((sum, s) => sum + Number(s.price), 0);
        
        // Keep backward compatibility - set primary service
        if (validatedServices.length > 0) {
          parsedData.data.service_id = validatedServices[0].service_id;
          parsedData.data.service_name = validatedServices[0].service_name;
          parsedData.data.service_price = validatedServices[0].price;
        }
      } 
      // Handle old format with single service_id
      else if (parsedData.data.service_id) {
        let matchedService = services?.find(s => s.id === parsedData.data.service_id);
        
        if (!matchedService) {
          const serviceName = (parsedData.data.service_name || '').toLowerCase();
          matchedService = services?.find(s => 
            s.name.toLowerCase().includes(serviceName) || 
            serviceName.includes(s.name.toLowerCase())
          );
        }
        
        if (!matchedService) {
          matchedService = services?.[0];
        }
        
        if (matchedService) {
          parsedData.data.service_id = matchedService.id;
          parsedData.data.service_name = matchedService.name;
          parsedData.data.service_price = matchedService.price;
          parsedData.data.services = [{
            service_id: matchedService.id,
            service_name: matchedService.name,
            price: matchedService.price
          }];
          parsedData.data.total_price = matchedService.price;
        }
      }
    }

    console.log('Final parsed data:', JSON.stringify(parsedData));

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
