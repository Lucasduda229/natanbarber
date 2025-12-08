import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, Clock, Scissors, CreditCard, Calendar as CalendarIcon, Check, ChevronLeft, User, Phone, Copy, Navigation, Instagram } from "lucide-react";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { ProfileMenu } from "@/components/ProfileMenu";
import CancellationPolicy from "@/components/CancellationPolicy";
import { gsap } from "gsap";
import AnimatedBackground from "@/components/AnimatedBackground";
import OpenClosedBadge from "@/components/OpenClosedBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import logoImage from "@/assets/logo-barbershop.png";
import pixIcon from "@/assets/pix-icon.png";

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

const PIX_KEY = "48 9210-7035";
const PHONE = "(48) 99210-7035";
const INSTAGRAM = "@_natan_barber_";
const GOOGLE_MAPS_URL = "https://www.google.com/maps/search/?api=1&query=Rua+Visconde+de+Barbacena+99999+Barro+Branco+Lauro+Muller+SC";

const Booking = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [customerName, setCustomerName] = useState("");
  const [customerWhatsApp, setCustomerWhatsApp] = useState("");
  const [formErrors, setFormErrors] = useState<{ name?: string; whatsapp?: string }>({});

  useEffect(() => {
    gsap.fromTo(".booking-container", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" });
    fetchServices();
    loadUserProfile();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots(selectedDate);
    }
  }, [selectedDate]);

  const loadUserProfile = async () => {
    if (!user) return;
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (profile) {
      if (profile.full_name) setCustomerName(profile.full_name);
      if (profile.phone) setCustomerWhatsApp(profile.phone);
    }
  };

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

  const validateCustomerInfo = (): boolean => {
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

  const handleCustomerInfoSubmit = async () => {
    if (!validateCustomerInfo()) return;
    
    if (user) {
      await supabase
        .from("profiles")
        .update({ 
          full_name: customerName.trim(), 
          phone: customerWhatsApp.replace(/\D/g, "") 
        })
        .eq("user_id", user.id);
    }
    
    setStep(4);
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

    toast.success("Agendamento realizado!", { description: "Aguardando confirmação do barbeiro." });
    setStep(5);
    gsap.fromTo(".step-content", { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" });
  };

  const copyPixKey = () => {
    navigator.clipboard.writeText(PIX_KEY.replace(/\s/g, ""));
    toast.success("Chave PIX copiada!");
  };


  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
      gsap.fromTo(".step-content", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4 });
    }
  };

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
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <img 
            src={logoImage} 
            alt="Natan Barbershop" 
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-primary/30 shadow-gold-glow" 
          />
          <OpenClosedBadge />
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          <NotificationsDropdown />
          {isAdmin && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/admin")} 
              className="text-foreground hover:text-primary text-xs sm:text-sm"
            >
              Admin
            </Button>
          )}
          <ProfileMenu />
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 text-center py-8 px-4">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-2">
          <span className="text-foreground">Natan </span>
          <span className="text-transparent bg-clip-text bg-gold-gradient">BarberShop</span>
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base mb-4">
          Experiência premium em cortes masculinos
        </p>
        
        {/* Contact Info */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 text-muted-foreground text-sm">
          <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
            <Phone className="w-4 h-4" />
            <span>{PHONE}</span>
          </a>
          <a 
            href="https://www.instagram.com/_natan_barber_/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            <Instagram className="w-4 h-4" />
            <span>{INSTAGRAM}</span>
          </a>
        </div>
      </section>

      {/* Main Content */}
      <main className="booking-container relative z-10 px-4 pb-12 max-w-5xl mx-auto">
        
        {/* Step 1: Services and Location */}
        {step === 1 && (
          <div className="step-content space-y-8">
            {/* CTA Button */}
            <div className="flex justify-center">
              <Button 
                onClick={() => document.getElementById('services-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-gold-gradient hover:opacity-90 text-background font-semibold px-8 py-6 text-lg rounded-xl shadow-gold-glow"
              >
                <CalendarIcon className="w-5 h-5 mr-2" />
                Agendar Horário
              </Button>
            </div>

            {/* Location Card */}
            <Card className="bg-card/60 backdrop-blur-xl border-l-4 border-l-primary border-t-0 border-r-0 border-b-0 rounded-lg overflow-hidden">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <div className="w-1 h-5 bg-primary rounded-full" />
                  Nossa Localização
                </h3>
                <div className="flex items-start gap-3 mb-4">
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="text-muted-foreground text-sm">
                    <p>{LOCATION.address}</p>
                    <p>{LOCATION.neighborhood}</p>
                    <p>{LOCATION.cep}</p>
                  </div>
                </div>
                <a 
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button 
                    className="w-full bg-primary/90 hover:bg-primary text-background font-medium py-5 rounded-lg"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Ver Rota no Google Maps
                  </Button>
                </a>
              </CardContent>
            </Card>

            {/* Services Section */}
            <div id="services-section" className="space-y-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <div className="w-1 h-5 bg-primary rounded-full" />
                Nossos Serviços
              </h3>
              
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                  <Card
                    key={service.id}
                    className="bg-card/60 backdrop-blur-xl border-primary/10 hover:border-primary/40 cursor-pointer transition-all group"
                    onClick={() => handleServiceSelect(service)}
                  >
                    <CardContent className="p-5">
                      {/* Icons */}
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-full bg-card border border-primary/20 flex items-center justify-center overflow-hidden">
                          <img src={logoImage} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Scissors className="w-5 h-5 text-primary" />
                        </div>
                      </div>
                      
                      {/* Service Info */}
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                        {service.name}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {service.description || "Serviço profissional de qualidade"}
                      </p>
                      
                      {/* Price and Action */}
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-xl font-bold text-primary">
                            R$ {service.price.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {service.duration_minutes} minutos
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          className="bg-card hover:bg-card/80 text-foreground border border-primary/30 hover:border-primary"
                        >
                          Selecionar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Select Date & Time */}
        {step === 2 && (
          <div className="step-content space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" size="icon" onClick={goBack} className="hover:bg-primary/10">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Escolha Data e Horário</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Calendar */}
              <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground text-base">
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
              <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground text-base">
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

        {/* Step 3: Customer Info */}
        {step === 3 && (
          <div className="step-content space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" size="icon" onClick={goBack} className="hover:bg-primary/10">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Seus Dados</h2>
            </div>

            <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <User className="w-5 h-5 text-primary" />
                  Informações de Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName" className="text-foreground">
                    Nome Completo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="customerName"
                    placeholder="Digite seu nome completo"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (formErrors.name) setFormErrors(prev => ({ ...prev, name: undefined }));
                    }}
                    className={`bg-card/60 border-primary/20 ${formErrors.name ? 'border-destructive' : ''}`}
                  />
                  {formErrors.name && (
                    <p className="text-sm text-destructive">{formErrors.name}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="customerWhatsApp" className="text-foreground">
                    WhatsApp <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="customerWhatsApp"
                      placeholder="(00) 00000-0000"
                      value={customerWhatsApp}
                      onChange={(e) => {
                        setCustomerWhatsApp(e.target.value);
                        if (formErrors.whatsapp) setFormErrors(prev => ({ ...prev, whatsapp: undefined }));
                      }}
                      className={`pl-10 bg-card/60 border-primary/20 ${formErrors.whatsapp ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {formErrors.whatsapp && (
                    <p className="text-sm text-destructive">{formErrors.whatsapp}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Usaremos este número para entrar em contato sobre seu agendamento
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="bg-primary/5 border-primary/30">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-primary" />
                    <span className="text-foreground">{selectedService?.name}</span>
                  </div>
                  <span className="text-primary font-bold">R$ {selectedService?.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarIcon className="w-4 h-4" />
                  <span>{selectedDate && format(selectedDate, "dd/MM/yyyy")}</span>
                  <Clock className="w-4 h-4 ml-2" />
                  <span>{selectedTime?.slice(0, 5)}</span>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleCustomerInfoSubmit}
              className="w-full bg-gold-gradient hover:opacity-90 text-background font-semibold py-6 rounded-xl shadow-gold-glow"
            >
              Continuar
            </Button>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="step-content space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" size="icon" onClick={goBack} className="hover:bg-primary/10">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Confirmar Agendamento</h2>
            </div>

            <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
              <CardHeader>
                <CardTitle className="text-foreground text-base">Resumo do Agendamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-semibold text-foreground">{customerName}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">WhatsApp</span>
                  <span className="font-semibold text-foreground">{customerWhatsApp}</span>
                </div>
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

            <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Pagamento via PIX
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-lg border-2 border-primary bg-primary/5">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0 p-1.5">
                    <img src={pixIcon} alt="PIX" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground">Chave PIX (Telefone)</h4>
                    <p className="text-lg font-mono text-primary truncate">{PIX_KEY}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyPixKey}
                    className="border-primary/30 hover:bg-primary/10 flex-shrink-0"
                  >
                    <Copy className="w-4 h-4 text-primary" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Realize o pagamento via PIX na hora do atendimento ou antes
                </p>
              </CardContent>
            </Card>

            <CancellationPolicy variant="full" />

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

        {/* Step 5: Success */}
        {step === 5 && (
          <div className="step-content text-center space-y-6 py-12">
            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
              <Check className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Pedido Enviado!</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Seu agendamento foi enviado e está aguardando aprovação do barbeiro. Você receberá uma confirmação em breve.
            </p>

            <Card className="bg-card/60 backdrop-blur-xl border-primary/20 max-w-md mx-auto">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-semibold text-foreground">{customerName}</span>
                </div>
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

            <Card className="bg-primary/5 border-primary/30 max-w-md mx-auto">
              <CardContent className="p-4">
                <p className="text-sm text-foreground mb-2 font-semibold">Chave PIX para pagamento:</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-primary text-lg">{PIX_KEY}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyPixKey}
                    className="border-primary/30 hover:bg-primary/10"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copiar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={() => navigate("/my-appointments")} className="bg-gold-gradient text-background">
                Ver Meus Agendamentos
              </Button>
              <Button 
                variant="outline" 
                onClick={() => { 
                  setStep(1); 
                  setSelectedService(null); 
                  setSelectedDate(undefined); 
                  setSelectedTime(null); 
                  setCustomerName(""); 
                  setCustomerWhatsApp(""); 
                }}
                className="border-primary/30 hover:bg-primary/10"
              >
                Novo Agendamento
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Booking;
