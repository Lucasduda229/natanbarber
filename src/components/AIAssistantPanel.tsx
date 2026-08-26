import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Calendar,
  Clock,
  User,
  Scissors,
  Search,
  X,
  CheckCircle2,
  Loader2,
  Crown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useExtraFee, buildExtraFeeNote, isExtraFeeApplicable } from '@/hooks/useExtraFee';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  subscribers_only?: boolean | null;
}

interface ClientProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

const formatDateLabel = (dateStr: string) => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return format(date, "d 'de' MMMM, yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
};

const minutesToLabel = (mins: number) =>
  mins >= 60
    ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}min` : ''}`
    : `${mins} min`;

const addMinutesToTime = (time: string, mins: number): string => {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export const AIAssistantPanel = () => {
  const { config: extraFee } = useExtraFee();

  /* ---------- form state ---------- */
  const [appointmentDate, setAppointmentDate] = useState(todayStr());
  const [appointmentTime, setAppointmentTime] = useState('09:00');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('PIX');
  const [chargeExtraFee, setChargeExtraFee] = useState(false);

  /* ---------- client ---------- */
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<ClientProfile[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [searchingClients, setSearchingClients] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  /* guest fallback */
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  /* ---------- services ---------- */
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  /* ---------- submit ---------- */
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---------------------------------------------------------------- */
  /* Load services once                                               */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    (async () => {
      setLoadingServices(true);
      const { data, error } = await supabase
        .from('services')
        .select('id, name, price, duration_minutes, subscribers_only')
        .order('name');
      if (!error && data) setServices(data as Service[]);
      else if (error) console.error('Error loading services:', error);
      setLoadingServices(false);
    })();
  }, []);

  /* ---------------------------------------------------------------- */
  /* Client search                                                    */
  /* ---------------------------------------------------------------- */
  const searchClients = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setClientResults([]);
      setShowDropdown(false);
      return;
    }
    setSearchingClients(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(8);
    setClientResults((data as ClientProfile[]) || []);
    setShowDropdown(true);
    setSearchingClients(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!selectedClient) searchClients(clientQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [clientQuery, selectedClient, searchClients]);

  const selectClient = (c: ClientProfile) => {
    setSelectedClient(c);
    setClientQuery(c.full_name || '');
    setGuestName(c.full_name || '');
    setGuestPhone(c.phone || '');
    setClientResults([]);
    setShowDropdown(false);
  };

  const clearClient = () => {
    setSelectedClient(null);
    setClientQuery('');
    setGuestName('');
    setGuestPhone('');
  };

  /* ---------------------------------------------------------------- */
  /* Service toggle                                                   */
  /* ---------------------------------------------------------------- */
  const toggleService = (id: string) => {
    setSelectedServices(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id],
    );
  };

  /* ---------------------------------------------------------------- */
  /* Computed totals                                                  */
  /* ---------------------------------------------------------------- */
  const pickedServices = services.filter(s => selectedServices.includes(s.id));
  const totalDuration = pickedServices.reduce((a, s) => a + (s.duration_minutes || 0), 0);
  const baseTotal = pickedServices.reduce((a, s) => a + s.price, 0);
  const feeApplies = isExtraFeeApplicable(extraFee, appointmentDate);
  const feeAmount = chargeExtraFee && feeApplies ? (extraFee.amount || 0) : 0;
  const totalPrice = baseTotal + feeAmount;
  const endTime = totalDuration > 0 ? addMinutesToTime(appointmentTime, totalDuration) : null;

  /* ---------------------------------------------------------------- */
  /* Payment method map                                               */
  /* ---------------------------------------------------------------- */
  const pmMap: Record<string, string | null> = {
    PIX: 'pix',
    Cartão: 'cartao',
    Dinheiro: 'dinheiro',
    Pendente: null,
  };

  /* ---------------------------------------------------------------- */
  /* Submit                                                           */
  /* ---------------------------------------------------------------- */
  const handleClear = () => {
    setAppointmentDate(todayStr());
    setAppointmentTime('09:00');
    setSelectedServices([]);
    setPaymentMethod('PIX');
    setChargeExtraFee(false);
    clearClient();
  };

  const playSuccessSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    } catch {
      /* noop */
    }
  };

  const handleSubmit = async () => {
    if (!appointmentDate) return toast.error('Selecione a data');
    if (!appointmentTime) return toast.error('Selecione o horário');
    if (selectedServices.length === 0) return toast.error('Selecione pelo menos 1 serviço');

    const name = selectedClient?.full_name || guestName.trim();
    const phone = selectedClient?.phone || guestPhone.trim();
    if (!name) return toast.error('Informe o nome do cliente');

    setIsSubmitting(true);
    try {
      const [primaryId, ...additionalIds] = selectedServices;
      const serviceNames = pickedServices.map(s => s.name).join(', ');
      const feeNote = chargeExtraFee && feeApplies ? `\n${buildExtraFeeNote(extraFee)}` : '';
      const notesText = `Agendamento Manual - ${name}${phone ? ` - Tel: ${phone}` : ''}\nServiços: ${serviceNames}${feeNote}`;

      const { data, error } = await supabase.functions.invoke('create-guest-customer', {
        body: {
          name,
          phone: phone || `temp_${Date.now()}`,
          appointment: {
            service_id: primaryId,
            additional_service_ids: additionalIds,
            appointment_date: appointmentDate,
            appointment_time: appointmentTime,
            notes: notesText,
            payment_method: pmMap[paymentMethod] ?? null,
            check_availability: true,
            total_duration_minutes: totalDuration || 30,
          },
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar agendamento');

      playSuccessSound();
      toast.success('Agendamento criado com sucesso!');
      handleClear();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar agendamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="w-full space-y-0">
      {/* ── Card container ── */}
      <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden">

        {/* ── Grid: Left | Right ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border/40">

          {/* ════════════════════════════════
              LEFT COLUMN
          ════════════════════════════════ */}
          <div className="p-5 space-y-5">

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              {/* Date */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                  <Calendar className="h-3.5 w-3.5" />
                  Data do Agendamento *
                </label>
                <input
                  type="date"
                  value={appointmentDate}
                  onChange={e => setAppointmentDate(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border/60 bg-background/60 px-3 text-sm text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                />
                {appointmentDate && (
                  <p className="text-[11px] text-muted-foreground pl-0.5">
                    {formatDateLabel(appointmentDate)}
                  </p>
                )}
              </div>

              {/* Time */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                  <Clock className="h-3.5 w-3.5" />
                  Horário de Início *
                </label>
                <input
                  type="time"
                  value={appointmentTime}
                  onChange={e => setAppointmentTime(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border/60 bg-background/60 px-3 text-sm text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>
            </div>

            {/* Client search */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                <User className="h-3.5 w-3.5" />
                Cliente já cadastrado
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou telefone..."
                  value={clientQuery}
                  onChange={e => {
                    setClientQuery(e.target.value);
                    if (selectedClient) setSelectedClient(null);
                  }}
                  onFocus={() => clientResults.length > 0 && setShowDropdown(true)}
                  className="w-full h-11 rounded-xl border border-border/60 bg-background/60 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                />
                {(clientQuery || selectedClient) && (
                  <button
                    onClick={clearClient}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                {/* Dropdown */}
                {showDropdown && (
                  <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-border/60 bg-popover shadow-xl overflow-hidden">
                    {searchingClients ? (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Buscando...
                      </div>
                    ) : clientResults.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado</p>
                    ) : (
                      clientResults.map(c => (
                        <button
                          key={c.id}
                          onClick={() => selectClient(c)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-sm shrink-0">
                            {(c.full_name || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{c.full_name || 'Sem nome'}</p>
                            {c.phone && (
                              <p className="text-xs text-muted-foreground">{c.phone}</p>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Guest fallback */}
            <div className="space-y-3 pt-1">
              <p className="text-xs text-muted-foreground">Ou preencha (Cliente sem cadastro)</p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nome do Cliente</label>
                <Input
                  placeholder="Nome completo"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  className="h-11 rounded-xl border-border/60 bg-background/60 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Telefone (WhatsApp)
                </label>
                <Input
                  placeholder="Ex: 48996915303"
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  className="h-11 rounded-xl border-border/60 bg-background/60 text-sm"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>

          {/* ════════════════════════════════
              RIGHT COLUMN
          ════════════════════════════════ */}
          <div className="p-5 space-y-5">

            {/* Services */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                <Scissors className="h-3.5 w-3.5" />
                Serviços *
              </label>

              {loadingServices ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando serviços...
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {services.map(svc => {
                    const isSelected = selectedServices.includes(svc.id);
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => toggleService(svc.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 ${
                          isSelected
                            ? 'border-primary bg-primary/15 ring-1 ring-primary/40'
                            : 'border-border/50 bg-background/40 hover:border-border/80 hover:bg-muted/30'
                        }`}
                      >
                        {/* Checkbox circle */}
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                            isSelected
                              ? 'border-primary bg-primary'
                              : 'border-border/60 bg-transparent'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>
                            {svc.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {minutesToLabel(svc.duration_minutes)}
                          </p>
                        </div>

                        {/* Price or VIP */}
                        {svc.subscribers_only ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-primary">
                            <Crown className="h-3.5 w-3.5" />
                            VIP
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-foreground">
                            R$ {Number(svc.price).toFixed(2).replace('.', ',')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-border/50 bg-background/30 p-4 space-y-1">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Duração total</p>
                  <p className="text-2xl font-black text-foreground leading-none mt-0.5">
                    {totalDuration > 0 ? minutesToLabel(totalDuration) : '—'}
                  </p>
                  {endTime && (
                    <p className="text-xs text-primary mt-1">
                      Término previsto: {endTime}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Valor total</p>
                  <p className="text-2xl font-black text-primary leading-none mt-0.5">
                    {totalPrice > 0
                      ? `R$ ${totalPrice.toFixed(2).replace('.', ',')}`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment method */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Situação do Pagamento
              </label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/60 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(pmMap).map(pm => (
                    <SelectItem key={pm} value={pm}>
                      {pm}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Extra fee */}
            {extraFee.enabled && extraFee.amount > 0 && feeApplies && (
              <label
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  chargeExtraFee
                    ? 'border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30'
                    : 'border-border/40 bg-muted/20 hover:border-border/60'
                }`}
              >
                <Checkbox
                  checked={chargeExtraFee}
                  onCheckedChange={v => setChargeExtraFee(v === true)}
                />
                <div>
                  <p className="text-sm font-semibold">💰 Cobrar {extraFee.name}</p>
                  <p className="text-xs text-muted-foreground">
                    + R$ {extraFee.amount.toFixed(2).replace('.', ',')} nas observações
                  </p>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border/40 bg-background/20">
          <Button
            variant="outline"
            onClick={handleClear}
            disabled={isSubmitting}
            className="px-6 h-11 rounded-xl border-border/60 hover:bg-muted/40"
          >
            Limpar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-7 h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar Agendamento'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
