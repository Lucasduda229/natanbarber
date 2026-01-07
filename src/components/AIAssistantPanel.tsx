import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Loader2, CheckCircle, AlertCircle, Calendar, Clock, User, Scissors } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ParsedAppointment {
  client_name: string;
  client_phone: string | null;
  service_id: string;
  service_name: string;
  service_price?: number;
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
      // First, check if there's an existing profile or create a temporary user
      // For now, we'll create the appointment with the admin's user_id
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Check if the time slot is available
      const { data: existingAppointments } = await supabase
        .from('appointments')
        .select('id')
        .eq('appointment_date', parsedData.appointment_date)
        .eq('appointment_time', parsedData.appointment_time)
        .neq('status', 'cancelled');

      if (existingAppointments && existingAppointments.length > 0) {
        toast.error('Este horário já está ocupado!');
        setIsProcessing(false);
        return;
      }

      // Create the appointment
      const { error: insertError } = await supabase
        .from('appointments')
        .insert({
          user_id: user.id,
          service_id: parsedData.service_id,
          appointment_date: parsedData.appointment_date,
          appointment_time: parsedData.appointment_time,
          status: 'confirmed', // Auto-confirm since it's from the owner
          notes: `Cliente: ${parsedData.client_name}${parsedData.client_phone ? ` | Tel: ${parsedData.client_phone}` : ''}${parsedData.notes ? ` | ${parsedData.notes}` : ''}`
        });

      if (insertError) {
        throw insertError;
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
            placeholder="Ex: Corte de cabelo para João Silva amanhã às 14h&#10;Ex: Barba do Carlos dia 15/12 às 10:30&#10;Ex: Agendamento Pedro tel 11999887766 corte sexta 16h"
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
              
              <div className="flex items-center gap-2">
                <Scissors className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Serviço:</span>
                <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
                  {parsedData.service_name}
                </Badge>
                {parsedData.service_price !== undefined && (
                  <Badge variant="outline" className="text-green-500 border-green-500">
                    R$ {Number(parsedData.service_price).toFixed(2)}
                  </Badge>
                )}
              </div>
              
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
            💡 Dica: Você pode copiar mensagens diretamente do WhatsApp e colar aqui. 
            A IA vai extrair automaticamente: cliente, serviço, data e horário.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
