import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays, isSameDay, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, Clock, Scissors, CreditCard, Calendar as CalendarIcon, Check, ChevronLeft, ChevronRight, User, LogOut } from "lucide-react";
import { gsap } from "gsap";
import AnimatedBackground from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import logoImage from "@/assets/logo-barbershop.png";

interface Service {
  id: string;
  name: string;
  description: string;
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
  cep: "CEP: 88882-000, Brasil",
};

const Booking = () => {
  const navigate = useNavigate();
  const { user, signOut, isAdmin } = useAuth();
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    gsap.fromTo(".booking-container", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" });
    fetchServices();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots(selectedDate);
    }
  }, [selectedDate]);

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("active", true)
      .order("price");

    if (!error && data) {
      setServices(data);
    }
  };

  const fetchAvailableSlots = async (date: Date) => {
    const dayOfWeek = getDay(date);
    const dateStr = format(date, "yyyy-MM-dd");

    // Get time slots for this day of week
    const { data: slots, error: slotsError } = await supabase
      .from("time_slots")
      .select("*")
      .eq("day_of_week", dayOfWeek)
      .eq("is_blocked", false)
      .order("slot_time");

    if (slotsError) {
      console.error("Error fetching slots:", slotsError);
      return;
    }

    // Get blocked dates for this specific date
    const { data: blockedDates } = await supabase
      .from("blocked_dates")
      .select("blocked_time")
      .eq("blocked_date", dateStr);

    const blockedTimes = blockedDates?.map((b) => b.blocked_time) || [];

    // Get existing appointments for this date
    const { data: appointments } = await supabase
      .from("appointments")
      .select("appointment_time")
      .eq("appointment_date", dateStr)
      .neq("status", "cancelled");

    const bookedTimesArray = appointments?.map((a) => a.appointment_time) || [];
    setBookedTimes(bookedTimesArray);

    // Filter out blocked and booked times
    const availableSlots = slots?.filter(
      (slot) => !blockedTimes.includes(slot.slot_time) && !bookedTimesArray.includes(slot.slot_time)
    ) || [];

    setAvailableSlots(availableSlots);
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setStep(2);
    gsap.fromTo(".step-content", { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.4 });
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep(3);
    gsap.fromTo(".step-content", { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.4 });
  };

  const handleConfirmBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !user) return;

    setLoading(true);

    const { error } = await supabase.from("appointments").insert({
      user_id: user.id,
      service_id: selectedService.id,
      appointment_date: format(selectedDate, "yyyy-MM-dd"),
      appointment_time: selectedTime,
      status: "pending",
      payment_status: "pending",
      payment_method: "pix",
    });

    setLoading(false);

    if (error) {
      toast.error("Erro ao agendar", { description: "Tente novamente mais tarde." });
      return;
    }

    toast.success("Agendamento realizado!", { description: "Aguardando pagamento via PIX." });
    setStep(4);
    gsap.fromTo(".step-content", { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" });
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
      gsap.fromTo(".step-content", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4 });
    }
  };

  // Disable past dates, Sundays (0) and Mondays (1)
  const disabledDays = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = getDay(date);
    return date < today || dayOfWeek === 0 || dayOfWeek === 1;
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="Natan Barbershop" className="w-12 h-12 rounded-full object-cover border-2 border-primary/30 shadow-gold-glow" />
          <span className="text-xl font-bold text-foreground hidden sm:block">Natan Barbershop</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/my-appointments")} className="text-foreground hover:text-primary">
            <CalendarIcon className="w-4 h-4 mr-2" />
            Meus Agendamentos
          </Button>
          {isAdmin && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="text-primary hover:text-primary/80">
              Admin
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="booking-container relative z-10 px-4 py-6 max-w-4xl mx-auto">
        {/* Location Card */}
        <Card className="bg-card/40 backdrop-blur-xl border-primary/20 mb-6">
          <CardContent className="flex items-start gap-4 p-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{LOCATION.address}</h3>
              <p className="text-muted-foreground text-sm">{LOCATION.neighborhood}</p>
              <p className="text-muted-foreground text-sm">{LOCATION.cep}</p>
            </div>
          </CardContent>
        </Card>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`flex items-center ${s < 4 ? "flex-1" : ""}`}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                  step >= s ? "bg-primary text-background" : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="w-5 h-5" /> : s}
              </div>
              {s < 4 && <div className={`flex-1 h-1 mx-2 rounded ${step > s ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="step-content">
          {/* Step 1: Select Service */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground text-center mb-6">Escolha o Serviço</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {services.map((service) => (
                  <Card
                    key={service.id}
                    onClick={() => handleServiceSelect(service)}
                    className="bg-card/40 backdrop-blur-xl border-primary/20 cursor-pointer transition-all hover:border-primary hover:shadow-gold-glow group"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <Scissors className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{service.name}</h3>
                            <p className="text-sm text-muted-foreground">{service.description}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {service.duration_minutes} min
                            </div>
                          </div>
                        </div>
                        <span className="text-xl font-bold text-primary">R$ {service.price.toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Select Date & Time */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={goBack}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-2xl font-bold text-foreground">Escolha Data e Horário</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Calendar */}
                <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <CalendarIcon className="w-5 h-5 text-primary" />
                      Selecione a Data
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      disabled={disabledDays}
                      locale={ptBR}
                      className="rounded-md border-0 pointer-events-auto"
                    />
                  </CardContent>
                </Card>

                {/* Time Slots */}
                <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <Clock className="w-5 h-5 text-primary" />
                      Horários Disponíveis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!selectedDate ? (
                      <p className="text-muted-foreground text-center py-8">Selecione uma data primeiro</p>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">Nenhum horário disponível nesta data</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-2">
                        {availableSlots.map((slot) => (
                          <Button
                            key={slot.id}
                            variant={selectedTime === slot.slot_time ? "default" : "outline"}
                            className={`${
                              selectedTime === slot.slot_time
                                ? "bg-primary text-background"
                                : "border-primary/30 hover:border-primary hover:bg-primary/10"
                            }`}
                            onClick={() => handleTimeSelect(slot.slot_time)}
                          >
                            {slot.slot_time.slice(0, 5)}
                          </Button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Selected Service Summary */}
              {selectedService && (
                <Card className="bg-primary/5 border-primary/30">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Scissors className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-foreground">{selectedService.name}</span>
                    </div>
                    <span className="text-primary font-bold">R$ {selectedService.price.toFixed(2)}</span>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 3: Payment */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={goBack}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-2xl font-bold text-foreground">Confirmar Agendamento</h2>
              </div>

              <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
                <CardHeader>
                  <CardTitle className="text-foreground">Resumo do Agendamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Serviço</span>
                    <span className="font-semibold text-foreground">{selectedService?.name}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Data</span>
                    <span className="font-semibold text-foreground">
                      {selectedDate && format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Horário</span>
                    <span className="font-semibold text-foreground">{selectedTime?.slice(0, 5)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Duração</span>
                    <span className="font-semibold text-foreground">{selectedService?.duration_minutes} minutos</span>
                  </div>
                  <div className="flex items-center justify-between py-4">
                    <span className="text-lg font-semibold text-foreground">Total</span>
                    <span className="text-2xl font-bold text-primary">R$ {selectedService?.price.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Forma de Pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 p-4 rounded-lg border-2 border-primary bg-primary/5">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xl font-bold text-primary">PIX</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Pagamento via PIX</h4>
                      <p className="text-sm text-muted-foreground">Pague na hora do atendimento</p>
                    </div>
                    <Check className="w-6 h-6 text-primary ml-auto" />
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={handleConfirmBooking}
                disabled={loading}
                className="w-full bg-gold-gradient hover:opacity-90 text-background font-semibold py-6 rounded-xl shadow-gold-glow"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                    Confirmando...
                  </span>
                ) : (
                  "Confirmar Agendamento"
                )}
              </Button>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="text-center space-y-6 py-12">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                <Check className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-3xl font-bold text-foreground">Agendamento Confirmado!</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Seu horário foi reservado com sucesso. Lembre-se de chegar 5 minutos antes do seu horário.
              </p>

              <Card className="bg-card/40 backdrop-blur-xl border-primary/20 max-w-md mx-auto">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Serviço</span>
                    <span className="font-semibold text-foreground">{selectedService?.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Data</span>
                    <span className="font-semibold text-foreground">
                      {selectedDate && format(selectedDate, "dd/MM/yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Horário</span>
                    <span className="font-semibold text-foreground">{selectedTime?.slice(0, 5)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="font-semibold text-foreground">Total (PIX)</span>
                    <span className="text-xl font-bold text-primary">R$ {selectedService?.price.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button onClick={() => navigate("/my-appointments")} className="bg-gold-gradient text-background">
                  Ver Meus Agendamentos
                </Button>
                <Button variant="outline" onClick={() => { setStep(1); setSelectedService(null); setSelectedDate(undefined); setSelectedTime(null); }}>
                  Novo Agendamento
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Booking;
