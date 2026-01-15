import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Loader2, CheckCircle, AlertCircle, Calendar, Clock, User, Scissors } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ServiceItem {
  service_id: string;
  service_name: string;
  price: number;
}

interface ParsedAppointment {
  client_name: string;
  client_phone: string | null;
  service_id: string;
  service_name: string;
  service_price?: number;
  services?: ServiceItem[];
  total_price?: number;
  appointment_date: string;
  appointment_time: string;
  notes: string | null;
}

interface AIResponse {
  success: boolean;
  data?: ParsedAppointment;
  error?: string;
}

export const AIAssistantPanel = () => {
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedAppointment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processMessage = async () => {
    if (!message.trim()) {
      toast.error('Digite uma mensagem para processar');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setParsedData(null);

    try {
      const { data, error: funcError } = await supabase.functions.invoke('ai-appointment-parser', {
        body: { message: message.trim() }
      });

      if (funcError) {
        throw new Error(funcError.message);
      }

      if (!data.success) {
        setError(data.error || 'Não foi possível interpretar a mensagem');
        return;
      }

      setParsedData(data.data);
      toast.success('Mensagem interpretada com sucesso!');
    } catch (err: any) {
      console.error('Error processing message:', err);
      setError(err.message || 'Erro ao processar mensagem');
      toast.error('Erro ao processar mensagem');
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmAppointment = async () => {
    if (!parsedData) return;

    setIsProcessing(true);

    try {
      // Use edge function to create guest customer and appointment (bypasses RLS)
      const cleanPhone = parsedData.client_phone?.replace(/\D/g, "") || "";
      const serviceNames = parsedData.services?.map(s => s.service_name).join(", ") || parsedData.service_name;
      const notesText = `Via Assistente IA - ${parsedData.client_name}${cleanPhone ? ` - Tel: ${cleanPhone}` : ''}\nServiços: ${serviceNames}${parsedData.notes ? `\n${parsedData.notes}` : ''}`;
      
      // Get all service IDs for additional services
      const additionalServiceIds = parsedData.services && parsedData.services.length > 1 
        ? parsedData.services.slice(1).map(s => s.service_id) 
        : [];

      const { data, error: funcError } = await supabase.functions.invoke('create-guest-customer', {
        body: {
          name: parsedData.client_name.trim(),
          phone: cleanPhone || `temp_${Date.now()}`,
          appointment: {
            service_id: parsedData.service_id,
            additional_service_ids: additionalServiceIds,
            appointment_date: parsedData.appointment_date,
            appointment_time: parsedData.appointment_time,
            notes: notesText,
            payment_method: 'pending',
            check_availability: true,
          }
        }
      });

      if (funcError) {
        throw new Error(funcError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao criar agendamento');
      }

      toast.success('Agendamento criado com sucesso!');
      setMessage('');
      setParsedData(null);
    } catch (err: any) {
      console.error('Error creating appointment:', err);
      toast.error(err.message || 'Erro ao criar agendamento');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Bot className="h-5 w-5 text-primary" />
          Assistente IA
        </CardTitle>
        <CardDescription>
          Digite ou cole uma mensagem do WhatsApp para criar um agendamento automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder="Ex: Corte e barba para João amanhã às 14h&#10;Ex: Pedro corte + sobrancelha dia 15/12 às 10:30&#10;Ex: Carlos corte degradê + barba sexta 16h"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[100px] bg-background/50 border-border/50 focus:border-primary"
            disabled={isProcessing}
          />
          <Button 
            onClick={processMessage} 
            disabled={isProcessing || !message.trim()}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Interpretar Mensagem
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {parsedData && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-foreground">Dados extraídos:</span>
            </div>
            
            <div className="grid gap-3 p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cliente:</span>
                <Badge variant="secondary">{parsedData.client_name}</Badge>
                {parsedData.client_phone && (
                  <Badge variant="outline">{parsedData.client_phone}</Badge>
                )}
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Serviços:</span>
                </div>
                <div className="ml-6 space-y-1">
                  {parsedData.services && parsedData.services.length > 0 ? (
                    parsedData.services.map((svc, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
                          {svc.service_name}
                        </Badge>
                        <Badge variant="outline" className="text-green-500 border-green-500">
                          R$ {Number(svc.price).toFixed(2)}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
                        {parsedData.service_name}
                      </Badge>
                      {parsedData.service_price !== undefined && (
                        <Badge variant="outline" className="text-green-500 border-green-500">
                          R$ {Number(parsedData.service_price).toFixed(2)}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {parsedData.total_price !== undefined && parsedData.services && parsedData.services.length > 1 && (
                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <span className="text-sm font-medium text-foreground">Total:</span>
                  <Badge className="bg-green-600 text-white hover:bg-green-700">
                    R$ {Number(parsedData.total_price).toFixed(2)}
                  </Badge>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Data:</span>
                <Badge variant="outline">{formatDate(parsedData.appointment_date)}</Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Horário:</span>
                <Badge variant="outline">{parsedData.appointment_time}</Badge>
              </div>

              {parsedData.notes && (
                <div className="pt-2 border-t border-border/50">
                  <span className="text-sm text-muted-foreground">Observações: </span>
                  <span className="text-sm text-foreground">{parsedData.notes}</span>
                </div>
              )}
            </div>

            <Button 
              onClick={confirmAppointment} 
              disabled={isProcessing}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar Agendamento
                </>
              )}
            </Button>
          </div>
        )}

        <div className="pt-2 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            💡 Dica: Mencione múltiplos serviços como "corte + barba" ou "corte e sobrancelha". 
            A IA vai calcular o valor total automaticamente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};