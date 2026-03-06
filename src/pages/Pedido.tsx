import { useState, useEffect } from "react";
import { format, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Scissors, Calendar as CalendarIcon, Clock, User, Phone, CheckCircle, MapPin, Check, Wallet } from "lucide-react";
import pixIcon from "@/assets/pix-icon-new.png";
import cardIcon from "@/assets/card-icon.png";
import cashIcon from "@/assets/cash-icon.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AnimatedBackground from "@/components/AnimatedBackground";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import OpenClosedBadge from "@/components/OpenClosedBadge";
import logoImage from "@/assets/logo-barbershop.png";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
}

interface TimeSlot {
  id: string;
  slot_time: string;
  is_blocked: boolean;
}

const LOCATION = {
  address: "Rua Visconde de Barbacena, 99999",
  neighborhood: "Barro Branco, Lauro Müller - SC",
};

const Pedido = () => {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [customerName, setCustomerName] = useState("");
  const [customerWhatsApp, setCustomerWhatsApp] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("pix");
  const [formErrors, setFormErrors] = useState<{ name?: string; whatsapp?: string }>({});

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots(selectedDate);
    }
  }, [selectedDate, selectedServices]);

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("active", true)
      .eq("subscribers_only", false)
      .order("price", { ascending: false });

    if (!error && data) {
      setServices(data);
    }
  };

  // Calculate total duration and required slots
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);
  const requiredSlots = Math.ceil(totalDuration / 30);

  // Helper function to add minutes to a time string (HH:mm:ss)
  const addMinutesToTime = (timeStr: string, minutes: number): string => {
    const [hours, mins] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}:00`;
  };

  const fetchAvailableSlots = async (date: Date) => {
    const dayOfWeek = getDay(date);
    const dateStr = format(date, "yyyy-MM-dd");

    const { data: slots } = await supabase
      .from("time_slots")
      .select("*")
      .eq("day_of_week", dayOfWeek)
      .eq("is_blocked", false)
      .order("slot_time");

    const { data: blockedDates } = await supabase
      .from("blocked_dates")
      .select("blocked_time")
      .eq("blocked_date", dateStr);

    const blockedTimes = blockedDates?.map((b) => b.blocked_time) || [];

    const { data: appointments } = await supabase
      .from("appointments")
      .select("appointment_time")
      .eq("appointment_date", dateStr)
      .neq("status", "cancelled");

    const bookedTimesArray = appointments?.map((a) => a.appointment_time) || [];
    setBookedTimes(bookedTimesArray);

    // Filter past times for today
    const now = new Date();
    const isToday = format(date, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
    const currentTime = format(now, "HH:mm:ss");

    // Get all slot times for checking consecutive availability
    const allSlotTimes = slots?.map(s => s.slot_time) || [];
    const unavailableTimes = new Set([...blockedTimes, ...bookedTimesArray]);

    const available = slots?.filter((slot) => {
      // Basic availability check
      if (unavailableTimes.has(slot.slot_time)) {
        return false;
      }
      if (isToday && slot.slot_time <= currentTime) {
        return false;
      }
      
      // Check if we have enough consecutive slots for the total service duration
      if (requiredSlots > 1) {
        for (let i = 1; i < requiredSlots; i++) {
          const nextSlotTime = addMinutesToTime(slot.slot_time, i * 30);
          // Check if next slot exists and is available
          if (!allSlotTimes.includes(nextSlotTime) || unavailableTimes.has(nextSlotTime)) {
            return false;
          }
          // Check if next slot is not in the past for today
          if (isToday && nextSlotTime <= currentTime) {
            return false;
          }
        }
      }
      
      return true;
    }) || [];

    setAvailableSlots(available);
  };

  const validateForm = (): boolean => {
    const errors: { name?: string; whatsapp?: string } = {};

    const trimmedName = customerName.trim();
    if (!trimmedName) {
      errors.name = "Nome é obrigatório";
    } else if (trimmedName.length < 2) {
      errors.name = "Nome deve ter pelo menos 2 caracteres";
    } else if (trimmedName.length > 100) {
      errors.name = "Nome deve ter no máximo 100 caracteres";
    }

    const cleanWhatsApp = customerWhatsApp.replace(/\D/g, "");
    if (!cleanWhatsApp) {
      errors.whatsapp = "WhatsApp é obrigatório";
    } else if (cleanWhatsApp.length < 10 || cleanWhatsApp.length > 11) {
      errors.whatsapp = "WhatsApp deve ter 10 ou 11 dígitos";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (selectedServices.length === 0 || !selectedDate || !selectedTime) {
      toast.error("Dados incompletos", { description: "Selecione serviço, data e horário." });
      return;
    }

    if (!validateForm()) return;

    setLoading(true);

    const appointmentDate = format(selectedDate, "yyyy-MM-dd");

    // Generate all time slots that will be occupied based on total duration
    const timesToCheck = [selectedTime];
    for (let i = 1; i < requiredSlots; i++) {
      timesToCheck.push(addMinutesToTime(selectedTime, i * 30));
    }

    // Check if any of the required slots are already booked
    const { data: existingAppointments } = await supabase
      .from("appointments")
      .select("id")
      .eq("appointment_date", appointmentDate)
      .in("appointment_time", timesToCheck)
      .neq("status", "cancelled");

    if (existingAppointments && existingAppointments.length > 0) {
      setLoading(false);
      toast.error("Horário indisponível", {
        description: requiredSlots > 1 
          ? "Um ou mais horários necessários já foram reservados. Por favor, escolha outro."
          : "Este horário já foi reservado. Por favor, escolha outro."
      });
      fetchAvailableSlots(selectedDate);
      return;
    }

    // Create or find the customer and appointment using the edge function
    const cleanPhone = customerWhatsApp.replace(/\D/g, "");
    const serviceNames = selectedServices.map(s => s.name).join(", ");
    const paymentLabel = paymentMethod === "pix" ? "PIX" : paymentMethod === "cartao" ? "Cartão" : "Dinheiro";
    const surchargeNote = isThursdayEvening ? "\n⚠️ Adicional noturno quinta-feira: +R$5,00" : "";
    const notesText = customerNotes.trim() 
      ? `Pedido via Site - ${customerName.trim()} - Tel: ${cleanPhone}\nServiços: ${serviceNames}\nPagamento: ${paymentLabel}\n${customerNotes.trim()}${surchargeNote}`
      : `Pedido via Site - ${customerName.trim()} - Tel: ${cleanPhone}\nServiços: ${serviceNames}\nPagamento: ${paymentLabel}${surchargeNote}`;
    
    try {
      const response = await supabase.functions.invoke("create-guest-customer", {
        body: {
          name: customerName.trim(),
          phone: cleanPhone,
          appointment: {
            service_id: selectedServices[0].id,
            additional_service_ids: selectedServices.slice(1).map(s => s.id),
            appointment_date: appointmentDate,
            appointment_time: selectedTime,
            notes: notesText,
            payment_method: paymentMethod,
            check_availability: true,
            total_duration_minutes: totalDuration,
          }
        }
      });

      if (response.error) {
        console.error("Error creating appointment:", response.error);
        setLoading(false);
        toast.error("Erro ao processar pedido", { 
          description: "Por favor, tente novamente." 
        });
        return;
      }

      if (!response.data?.appointment) {
        console.error("No appointment in response:", response.data);
        setLoading(false);
        toast.error("Erro ao criar agendamento", { 
          description: response.data?.error || "Por favor, tente novamente." 
        });
        return;
      }

      const isNewCustomer = response.data.is_new;
      console.log(isNewCustomer ? "New customer created" : "Existing customer found", "- Appointment:", response.data.appointment.id);

      setLoading(false);
      setSuccess(true);
      toast.success("Pedido enviado!", { description: "Entraremos em contato para confirmar." });

    } catch (err) {
      console.error("Error in handleSubmit:", err);
      setLoading(false);
      toast.error("Erro ao processar pedido", { description: "Por favor, tente novamente." });
    }
  };

  const disabledDays = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = getDay(date);
    return date < today || dayOfWeek === 0; // Closed on Sundays
  };

  if (success) {
    return (
      <div className="min-h-screen relative overflow-hidden safe-bottom">
        <AnimatedBackground />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
          <Card className="w-full max-w-md bg-card/80 backdrop-blur border-primary/20 text-center">
            <CardContent className="pt-8 pb-6">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Pedido Enviado!</h2>
              <p className="text-muted-foreground mb-6">
                Recebemos seu pedido e entraremos em contato pelo WhatsApp para confirmar.
              </p>
              <div className="bg-card/50 rounded-lg p-4 text-left space-y-2">
                <p><strong>Serviços:</strong> {selectedServices.map(s => s.name).join(", ")}</p>
                <p><strong>Data:</strong> {selectedDate && format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</p>
                <p><strong>Horário:</strong> {selectedTime?.slice(0, 5)}</p>
                <p><strong>Cliente:</strong> {customerName}</p>
              </div>
              <Button 
                onClick={() => {
                  setSuccess(false);
                  setStep(1);
                  setSelectedServices([]);
                  setSelectedDate(undefined);
                  setSelectedTime(null);
                  setCustomerName("");
                  setCustomerWhatsApp("");
                  setCustomerNotes("");
                  setPaymentMethod("pix");
                }}
                className="mt-6 bg-gold-gradient text-background w-full"
              >
                Fazer Novo Pedido
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Verificar adicional de quinta-feira noturno (19h+)
  const isThursdayEvening = (() => {
    if (!selectedDate || !selectedTime) return false;
    const dayOfWeek = getDay(selectedDate); // 4 = quinta-feira
    const hour = parseInt(selectedTime.split(':')[0], 10);
    return dayOfWeek === 4 && hour >= 19;
  })();
  const thursdaySurcharge = isThursdayEvening ? 5 : 0;

  // Calculate total price
  const basePrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalPrice = basePrice + thursdaySurcharge;

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <AnimatedBackground />

      {/* Header - Compacto para mobile */}
      <header className="relative z-10 flex items-center justify-center px-4 pt-12 pb-4 safe-top">
        <div className="flex items-center gap-3">
          <img 
            src={logoImage} 
            alt="Natan Barbershop" 
            className="w-12 h-12 rounded-full object-cover border-2 border-primary/30 shadow-gold-glow" 
          />
          <div>
            <h1 className="text-lg font-bold leading-tight">
              <span className="text-foreground">Natan </span>
              <span className="text-transparent bg-clip-text bg-gold-gradient">BarberShop</span>
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-[10px] flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" />
                {LOCATION.neighborhood}
              </p>
              <OpenClosedBadge />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-3 pb-28 max-w-lg mx-auto">
        <Card className="bg-card/90 backdrop-blur border-primary/20">
          <CardHeader className="pb-3 px-4 pt-4">
            <CardTitle className="text-lg text-center">
              {step === 1 && "Escolha os Serviços"}
              {step === 2 && "Data e Horário"}
              {step === 3 && "Seus Dados"}
            </CardTitle>
            {/* Step indicator */}
            <div className="flex justify-center gap-2 mt-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    s === step 
                      ? "bg-primary w-8" 
                      : s < step 
                        ? "bg-primary w-4" 
                        : "bg-muted w-4"
                  }`}
                />
              ))}
            </div>
          </CardHeader>

          <CardContent className="space-y-3 px-3 pb-4">
            {/* Step 1: Select Service */}
            {step === 1 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">Toque para selecionar</p>
                {services.map((service) => {
                  const isSelected = selectedServices.some(s => s.id === service.id);
                  return (
                    <button
                      key={service.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedServices(prev => prev.filter(s => s.id !== service.id));
                        } else {
                          setSelectedServices(prev => [...prev, service]);
                        }
                      }}
                      className={`w-full p-3 rounded-xl border-2 transition-all text-left active:scale-[0.98] ${
                        isSelected
                          ? "border-primary bg-primary/15"
                          : "border-border/50 bg-card/50 active:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected ? "bg-primary" : "bg-primary/20"
                        }`}>
                          {isSelected ? (
                            <Check className="w-4 h-4 text-background" />
                          ) : (
                            <Scissors className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{service.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`font-bold text-sm ${service.price === 0 ? "text-green-500" : "text-primary"}`}>
                              {service.price === 0 ? "Cortesia" : `R$ ${service.price.toFixed(2).replace(".", ",")}`}
                            </span>
                            <span className="text-muted-foreground text-xs flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              {service.duration_minutes}min
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Step 2: Select Date and Time */}
            {step === 2 && (
              <div className="space-y-3">
                <div>
                  <Label className="flex items-center gap-2 mb-2 text-sm">
                    <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                    Escolha a data
                  </Label>
                  <div className="flex justify-center -mx-2">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={disabledDays}
                      locale={ptBR}
                      className="rounded-lg border border-primary/20 bg-card/50 text-sm"
                    />
                  </div>
                </div>

                {selectedDate && (
                  <div>
                    <Label className="flex items-center gap-2 mb-2 text-sm">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      Escolha o horário
                    </Label>
                    {availableSlots.length === 0 ? (
                      <p className="text-center text-muted-foreground py-3 text-sm">
                        Nenhum horário disponível
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-1.5">
                        {availableSlots.map((slot) => (
                          <Button
                            key={slot.id}
                            variant={selectedTime === slot.slot_time ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedTime(slot.slot_time)}
                            className={`text-xs h-9 ${selectedTime === slot.slot_time 
                              ? "bg-gold-gradient text-background" 
                              : "border-primary/30"
                            }`}
                          >
                            {slot.slot_time.slice(0, 5)}
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Thursday evening surcharge warning */}
                    {isThursdayEvening && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 flex items-start gap-2 mt-3">
                        <span className="text-base">⚠️</span>
                        <div>
                          <p className="text-xs font-semibold text-amber-500">Adicional Noturno - Quinta-feira</p>
                          <p className="text-xs text-muted-foreground">Horários a partir das 19h possuem adicional de R$ 5,00.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Customer Info */}
            {step === 3 && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name" className="flex items-center gap-2 mb-1.5 text-sm">
                    <User className="w-3.5 h-3.5 text-primary" />
                    Seu Nome
                  </Label>
                  <Input
                    id="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Digite seu nome"
                    className={`h-11 text-base ${formErrors.name ? "border-destructive" : ""}`}
                    maxLength={100}
                  />
                  {formErrors.name && (
                    <p className="text-destructive text-xs mt-1">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="whatsapp" className="flex items-center gap-2 mb-1.5 text-sm">
                    <Phone className="w-3.5 h-3.5 text-primary" />
                    WhatsApp
                  </Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    inputMode="tel"
                    value={customerWhatsApp}
                    onChange={(e) => setCustomerWhatsApp(e.target.value)}
                    placeholder="(48) 99999-9999"
                    className={`h-11 text-base ${formErrors.whatsapp ? "border-destructive" : ""}`}
                    maxLength={15}
                  />
                  {formErrors.whatsapp && (
                    <p className="text-destructive text-xs mt-1">{formErrors.whatsapp}</p>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <Label className="flex items-center gap-2 mb-2 text-sm">
                    <Wallet className="w-3.5 h-3.5 text-primary" />
                    Forma de Pagamento
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "pix", label: "PIX", icon: pixIcon, bgSelected: "bg-[#32BCAD]/15", borderSelected: "border-[#32BCAD]" },
                      { id: "cartao", label: "Cartão", icon: cardIcon, bgSelected: "bg-blue-500/15", borderSelected: "border-blue-500" },
                      { id: "dinheiro", label: "Dinheiro", icon: cashIcon, bgSelected: "bg-green-500/15", borderSelected: "border-green-500" },
                    ].map((method) => {
                      const isSelected = paymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                            isSelected
                              ? `${method.borderSelected} ${method.bgSelected}`
                              : "border-border/50 bg-card/50 active:border-primary/50"
                          }`}
                        >
                          <img 
                            src={method.icon} 
                            alt={method.label} 
                            className={`w-7 h-7 ${isSelected ? "opacity-100" : "opacity-50 grayscale"} transition-all`}
                          />
                          <span className={`text-xs font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                            {method.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes" className="mb-1.5 block text-sm">
                    Observação (opcional)
                  </Label>
                  <Textarea
                    id="notes"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="Alguma observação especial?"
                    rows={2}
                    maxLength={500}
                    className="text-base"
                  />
                </div>

                {/* Summary */}
                <div className="bg-card/50 rounded-lg p-3 space-y-1.5 border border-primary/20 text-sm">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Resumo</h4>
                  <div>
                    <ul className="space-y-0.5">
                      {selectedServices.map(s => (
                        <li key={s.id} className="flex justify-between">
                          <span className="truncate mr-2">{s.name}</span>
                          <span className="text-muted-foreground">R$ {s.price.toFixed(2).replace(".", ",")}</span>
                        </li>
                      ))}
                    </ul>
                    {isThursdayEvening && (
                      <div className="flex justify-between text-amber-500 font-medium">
                        <span>⚠️ Adicional noturno (quinta)</span>
                        <span>+ R$ 5,00</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>📅 {selectedDate && format(selectedDate, "dd/MM")}</span>
                    <span>🕐 {selectedTime?.slice(0, 5)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-primary/20">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold text-primary">
                      R$ {totalPrice.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Fixed Bottom Bar */}
      {step === 1 && selectedServices.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur border-t border-primary/20 p-3 safe-bottom">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{selectedServices.length} serviço(s)</p>
              <p className="font-bold text-primary">
                R$ {totalPrice.toFixed(2).replace(".", ",")}
              </p>
            </div>
            <Button
              onClick={() => setStep(2)}
              className="bg-gold-gradient text-background px-6 h-11"
            >
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur border-t border-primary/20 p-3 safe-bottom">
          <div className="max-w-lg mx-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="flex-1 h-11"
            >
              Voltar
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!selectedDate || !selectedTime}
              className="flex-1 bg-gold-gradient text-background h-11"
            >
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur border-t border-primary/20 p-3 safe-bottom">
          <div className="max-w-lg mx-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              className="flex-1 h-11"
              disabled={loading}
            >
              Voltar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-gold-gradient text-background h-11"
            >
              {loading ? "Enviando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      )}

      {/* Floating WhatsApp Button */}
      <div className="fixed bottom-6 right-4 z-50">
        <a 
          href="https://wa.me/5548991824897?text=Olá! Vim pelo site e gostaria de mais informações."
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-14 h-14 bg-[#25D366] hover:bg-[#128C7E] rounded-full shadow-lg transition-all hover:scale-110 active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      </div>
    </div>
  );
};

export default Pedido;
