import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, CheckCircle, AlertCircle, Calendar, Clock, User, Scissors, MessageSquare, Wand2, Zap, CreditCard } from 'lucide-react';
import pixIcon from '@/assets/pix-icon-new.png';
import cardIcon from '@/assets/card-icon.png';
import cashIcon from '@/assets/cash-icon.png';
import whatsappIcon from '@/assets/whatsapp-icon.svg';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useExtraFee, buildExtraFeeNote } from '@/hooks/useExtraFee';
import { Checkbox } from '@/components/ui/checkbox';

interface ServiceItem {
  service_id: string;
  service_name: string;
  price: number;
  duration_minutes?: number;
}

interface ParsedAppointment {
  client_name: string;
  client_phone: string | null;
  service_id: string;
  service_name: string;
  service_price?: number;
  services?: ServiceItem[];
  total_price?: number;
  total_duration_minutes?: number;
  appointment_date: string;
  appointment_time: string;
  notes: string | null;
}

export const AIAssistantPanel = () => {
  const { config: extraFee } = useExtraFee();
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedAppointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('pending');
  const [chargeExtraFee, setChargeExtraFee] = useState(false);

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

      if (funcError) throw new Error(funcError.message);
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

  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      
      notes.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        const startTime = audioContext.currentTime + index * 0.1;
        gainNode.gain.setValueAtTime(0.3, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.3);
      });
    } catch (e) {
      console.log('Audio not supported');
    }
  };

  // Map frontend payment method names to database values
  const getPaymentMethodValue = (method: string): string | null => {
    const mapping: Record<string, string | null> = {
      'pix': 'pix',
      'card': 'cartao',
      'cash': 'dinheiro',
      'pending': null
    };
    return mapping[method] ?? null;
  };

  const confirmAppointment = async () => {
    if (!parsedData) return;
    setIsProcessing(true);

    try {
      const cleanPhone = parsedData.client_phone?.replace(/\D/g, "") || "";
      const serviceNames = parsedData.services?.map(s => s.service_name).join(", ") || parsedData.service_name;
      const feeNote = chargeExtraFee && extraFee.enabled && extraFee.amount > 0 ? `\n${buildExtraFeeNote(extraFee)}` : '';
      const notesText = `Via Assistente IA - ${parsedData.client_name}${cleanPhone ? ` - Tel: ${cleanPhone}` : ''}\nServiços: ${serviceNames}${parsedData.notes ? `\n${parsedData.notes}` : ''}${feeNote}`;
      
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
            payment_method: getPaymentMethodValue(selectedPaymentMethod),
            check_availability: true,
            total_duration_minutes: parsedData.total_duration_minutes || 30,
          }
        }
      });

      if (funcError) throw new Error(funcError.message);
      if (!data.success) throw new Error(data.error || 'Erro ao criar agendamento');

      playSuccessSound();
      toast.success('Agendamento criado com sucesso!');
      setMessage('');
      setParsedData(null);
      setSelectedPaymentMethod('pending');
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
    <div className="relative overflow-hidden rounded-3xl border border-[#25D366]/30 shadow-2xl">
      {/* WhatsApp gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d1f12] via-card to-[#0a0d0a]" />
      
      {/* Animated green particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-10 w-2 h-2 bg-[#25D366]/60 rounded-full animate-pulse" />
        <div className="absolute top-20 right-20 w-1.5 h-1.5 bg-[#25D366]/40 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-20 left-1/3 w-1 h-1 bg-[#25D366]/50 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/3 right-10 w-1.5 h-1.5 bg-[#25D366]/30 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>
      
      {/* Glow effects */}
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-[#25D366]/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-[#25D366]/15 rounded-full blur-3xl" />
      
      <div className="relative z-10 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="relative group">
            <div className="absolute inset-0 bg-[#25D366]/50 rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-[#25D366] via-[#128C7E] to-[#075E54] flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
              <img src={whatsappIcon} alt="WhatsApp" className="h-8 w-8" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-full border-2 border-card flex items-center justify-center">
              <Zap className="h-3 w-3 text-white" />
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold bg-gradient-to-r from-[#25D366] via-[#20c65a] to-[#25D366] bg-clip-text text-transparent">
              Assistente WhatsApp
            </h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Cole a mensagem do WhatsApp e crio o agendamento automaticamente ✨
            </p>
          </div>
        </div>

        {/* Chat input area */}
        <div className="space-y-4">
          <div className="relative group">
            {/* Glow border effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#25D366]/50 via-[#128C7E]/20 to-[#25D366]/50 rounded-2xl blur opacity-30 group-focus-within:opacity-60 transition-opacity" />
            
            <div className="relative bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-xl rounded-2xl border border-[#25D366]/20 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#25D366]/10 bg-[#25D366]/5">
                <MessageSquare className="h-4 w-4 text-[#25D366]" />
                <span className="text-xs font-medium text-[#25D366]">Mensagem do Cliente</span>
              </div>
              <Textarea
                placeholder={`Cole aqui a mensagem...\n\n"Corte e barba para João amanhã às 14h"\n"Pedro corte + sobrancelha dia 15/01 às 10:30"`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[100px] bg-transparent border-0 focus-visible:ring-0 rounded-none resize-none placeholder:text-muted-foreground/40 px-4 py-3"
                disabled={isProcessing}
              />
            </div>
          </div>
          
          <Button 
            onClick={processMessage} 
            disabled={isProcessing || !message.trim()}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#25D366] via-[#128C7E] to-[#25D366] hover:opacity-90 transition-all duration-300 shadow-xl shadow-[#25D366]/20 hover:shadow-[#25D366]/40 group text-base font-semibold text-white"
          >
            {isProcessing ? (
              <>
                <div className="relative mr-3">
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                </div>
                <span className="animate-pulse">Processando com IA...</span>
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform duration-300" />
                Interpretar Mensagem
                <Send className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
              </>
            )}
          </Button>
        </div>

        {/* Error state */}
        {error && (
          <div className="animate-fade-in relative overflow-hidden rounded-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-red-900/20" />
            <div className="relative flex items-start gap-4 p-4 border border-red-500/30">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-500/30">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-red-400">Não consegui entender</p>
                <p className="text-sm text-red-300/80 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success state */}
        {parsedData && (
          <div className="animate-fade-in space-y-4">
            {/* Success banner */}
            <div className="relative overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20" />
              <div className="relative flex items-center gap-4 p-4 border border-green-500/30">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-green-400">Dados extraídos com sucesso!</p>
                  <p className="text-sm text-green-300/80">Confira as informações abaixo</p>
                </div>
              </div>
            </div>
            
            {/* Data card */}
            <div className="relative overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-card/50 to-background/90 backdrop-blur-xl" />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              
              <div className="relative p-5 space-y-5 border border-primary/20">
                {/* Client */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/20">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Cliente</p>
                    <p className="text-lg font-bold text-foreground">{parsedData.client_name}</p>
                  </div>
                  {parsedData.client_phone && (
                    <Badge variant="outline" className="px-3 py-1.5 bg-muted/30 border-primary/20 text-muted-foreground">
                      📱 {parsedData.client_phone}
                    </Badge>
                  )}
                </div>
                
                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                
                {/* Services */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Serviços</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {parsedData.services && parsedData.services.length > 0 ? (
                      parsedData.services.map((svc, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/20 hover:border-primary/40 transition-colors">
                          <span className="font-semibold text-foreground">{svc.service_name}</span>
                          <span className="text-sm font-bold text-green-400">
                            R$ {Number(svc.price).toFixed(2)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/20">
                        <span className="font-semibold text-foreground">{parsedData.service_name}</span>
                        {parsedData.service_price !== undefined && (
                          <span className="text-sm font-bold text-green-400">
                            R$ {Number(parsedData.service_price).toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Total */}
                {parsedData.total_price !== undefined && parsedData.services && parsedData.services.length > 1 && (
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10 border border-green-500/20">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="text-2xl font-black bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                      R$ {Number(parsedData.total_price).toFixed(2)}
                    </span>
                  </div>
                )}
                
                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                
                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 border border-primary/10">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Data</p>
                      <p className="font-bold text-foreground">{formatDate(parsedData.appointment_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 border border-primary/10">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Horário</p>
                      <p className="font-bold text-foreground">{parsedData.appointment_time}</p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {parsedData.notes && (
                  <div className="p-4 rounded-xl bg-muted/20 border border-primary/10">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <span>📝</span> Observações
                    </p>
                    <p className="text-sm text-foreground">{parsedData.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Forma de Pagamento
              </p>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('pix')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${
                    selectedPaymentMethod === 'pix'
                      ? 'border-[#32BCAD] bg-[#32BCAD]/20 ring-2 ring-[#32BCAD]/50'
                      : 'border-primary/20 bg-muted/20 hover:border-primary/40'
                  }`}
                >
                  <img src={pixIcon} alt="PIX" className="w-6 h-6 object-contain" />
                  <span className={`text-xs font-medium ${selectedPaymentMethod === 'pix' ? 'text-[#32BCAD]' : 'text-muted-foreground'}`}>PIX</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('card')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${
                    selectedPaymentMethod === 'card'
                      ? 'border-blue-500 bg-blue-500/20 ring-2 ring-blue-500/50'
                      : 'border-primary/20 bg-muted/20 hover:border-primary/40'
                  }`}
                >
                  <img src={cardIcon} alt="Cartão" className="w-6 h-6 object-contain" />
                  <span className={`text-xs font-medium ${selectedPaymentMethod === 'card' ? 'text-blue-400' : 'text-muted-foreground'}`}>Cartão</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('cash')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${
                    selectedPaymentMethod === 'cash'
                      ? 'border-green-500 bg-green-500/20 ring-2 ring-green-500/50'
                      : 'border-primary/20 bg-muted/20 hover:border-primary/40'
                  }`}
                >
                  <img src={cashIcon} alt="Dinheiro" className="w-6 h-6 object-contain" />
                  <span className={`text-xs font-medium ${selectedPaymentMethod === 'cash' ? 'text-green-400' : 'text-muted-foreground'}`}>Dinheiro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('pending')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${
                    selectedPaymentMethod === 'pending'
                      ? 'border-yellow-500 bg-yellow-500/20 ring-2 ring-yellow-500/50'
                      : 'border-primary/20 bg-muted/20 hover:border-primary/40'
                  }`}
                >
                  <Clock className="w-6 h-6 text-yellow-500" />
                  <span className={`text-xs font-medium ${selectedPaymentMethod === 'pending' ? 'text-yellow-400' : 'text-muted-foreground'}`}>Pendente</span>
                </button>
              </div>
            </div>

            {/* Confirm button */}
            <Button 
              onClick={confirmAppointment} 
              disabled={isProcessing}
              className="w-full h-16 rounded-2xl bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 hover:from-green-500 hover:via-emerald-400 hover:to-green-500 transition-all duration-300 shadow-xl shadow-green-500/30 hover:shadow-green-500/50 text-lg font-bold group"
            >
              {isProcessing ? (
                <>
                  <div className="relative mr-3">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                  <span className="animate-pulse">Criando agendamento...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-6 w-6 group-hover:scale-110 transition-transform" />
                  Confirmar Agendamento
                </>
              )}
            </Button>
          </div>
        )}

        {/* Tip */}
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-r from-[#25D366]/5 via-transparent to-[#25D366]/5 border border-[#25D366]/10">
          <span className="text-xl">💡</span>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-[#25D366]">Dica:</span> Use "+" ou "e" para múltiplos serviços.
            <br />
            <span className="text-xs opacity-70">Ex: "corte + barba" ou "corte e sobrancelha"</span>
          </p>
        </div>
      </div>
    </div>
  );
};
