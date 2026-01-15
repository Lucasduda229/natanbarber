import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, Loader2, CheckCircle, AlertCircle, Calendar, Clock, User, Scissors, MessageSquare, Wand2 } from 'lucide-react';
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
      const cleanPhone = parsedData.client_phone?.replace(/\D/g, "") || "";
      const serviceNames = parsedData.services?.map(s => s.service_name).join(", ") || parsedData.service_name;
      const notesText = `Via Assistente IA - ${parsedData.client_name}${cleanPhone ? ` - Tel: ${cleanPhone}` : ''}\nServiços: ${serviceNames}${parsedData.notes ? `\n${parsedData.notes}` : ''}`;
      
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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-card/80 border border-primary/20 shadow-xl">
      {/* Animated background glow */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-32 h-32 bg-primary/40 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-primary/30 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      
      <div className="relative z-10 p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-card animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              Assistente Inteligente
              <Wand2 className="h-4 w-4 text-primary" />
            </h3>
            <p className="text-sm text-muted-foreground">
              Cole a mensagem do WhatsApp e eu crio o agendamento ✨
            </p>
          </div>
        </div>

        {/* Chat-like input area */}
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute left-3 top-3 text-primary/60">
              <MessageSquare className="h-5 w-5" />
            </div>
            <Textarea
              placeholder={`💬 Cole aqui a mensagem do cliente...\n\nExemplos:\n• "Corte e barba para João amanhã às 14h"\n• "Pedro corte + sobrancelha dia 15/01 às 10:30"`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px] pl-10 bg-background/60 backdrop-blur-sm border-primary/20 focus:border-primary/50 rounded-xl resize-none transition-all duration-300 placeholder:text-muted-foreground/60"
              disabled={isProcessing}
            />
          </div>
          
          <Button 
            onClick={processMessage} 
            disabled={isProcessing || !message.trim()}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-primary/30 group"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <span className="animate-pulse">Analisando mensagem...</span>
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                Interpretar com IA
                <Send className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
        </div>

        {/* Error state */}
        {error && (
          <div className="animate-fade-in flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-medium text-destructive">Ops! Algo deu errado</p>
              <p className="text-sm text-destructive/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Success state - Parsed data */}
        {parsedData && (
          <div className="animate-fade-in space-y-4">
            {/* Success header */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/30">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-green-500">Mensagem interpretada!</p>
                <p className="text-sm text-green-500/80">Confira os dados abaixo</p>
              </div>
            </div>
            
            {/* Extracted data card */}
            <div className="p-4 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50 space-y-4">
              {/* Client info */}
              <div className="flex items-center gap-3 pb-3 border-b border-border/50">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Cliente</p>
                  <p className="font-semibold text-foreground">{parsedData.client_name}</p>
                </div>
                {parsedData.client_phone && (
                  <Badge variant="outline" className="text-muted-foreground">
                    📱 {parsedData.client_phone}
                  </Badge>
                )}
              </div>
              
              {/* Services */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                  <Scissors className="h-4 w-4" />
                  Serviços
                </div>
                <div className="flex flex-wrap gap-2">
                  {parsedData.services && parsedData.services.length > 0 ? (
                    parsedData.services.map((svc, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                        <span className="font-medium text-foreground">{svc.service_name}</span>
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/30">
                          R$ {Number(svc.price).toFixed(2)}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                      <span className="font-medium text-foreground">{parsedData.service_name}</span>
                      {parsedData.service_price !== undefined && (
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/30">
                          R$ {Number(parsedData.service_price).toFixed(2)}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Total */}
              {parsedData.total_price !== undefined && parsedData.services && parsedData.services.length > 1 && (
                <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="text-xl font-bold text-green-500">
                    R$ {Number(parsedData.total_price).toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Data</p>
                    <p className="font-semibold text-foreground">{formatDate(parsedData.appointment_date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Horário</p>
                    <p className="font-semibold text-foreground">{parsedData.appointment_time}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {parsedData.notes && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">📝 Observações</p>
                  <p className="text-sm text-foreground">{parsedData.notes}</p>
                </div>
              )}
            </div>

            {/* Confirm button */}
            <Button 
              onClick={confirmAppointment} 
              disabled={isProcessing}
              className="w-full h-14 rounded-xl bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 transition-all duration-300 shadow-lg hover:shadow-green-500/30 text-lg font-semibold group"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  <span className="animate-pulse">Criando agendamento...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                  Confirmar Agendamento
                </>
              )}
            </Button>
          </div>
        )}

        {/* Helper tip */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/30 border border-border/30">
          <span className="text-lg">💡</span>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Dica:</span> Mencione múltiplos serviços como "corte + barba" ou "corte e sobrancelha". 
            A IA calcula o valor total automaticamente!
          </p>
        </div>
      </div>
    </div>
  );
};
