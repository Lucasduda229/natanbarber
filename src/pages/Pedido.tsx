import { useState, useEffect } from "react";
import { format, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Scissors, Calendar as CalendarIcon, Clock, User, Phone, CheckCircle, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AnimatedBackground from "@/components/AnimatedBackground";
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
  const [formErrors, setFormErrors] = useState<{ name?: string; whatsapp?: string }>({});

  useEffect(() => {
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
      .eq("subscribers_only", false)
      .order("price", { ascending: false });

    if (!error && data) {
      setServices(data);
    }
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

    const available = slots?.filter((slot) => {
      if (blockedTimes.includes(slot.slot_time) || bookedTimesArray.includes(slot.slot_time)) {
        return false;
      }
      if (isToday && slot.slot_time <= currentTime) {
        return false;
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

    // Check if slot is still available
    const { data: existingAppointment } = await supabase
      .from("appointments")
      .select("id")
      .eq("appointment_date", appointmentDate)
      .eq("appointment_time", selectedTime)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existingAppointment) {
      setLoading(false);
      toast.error("Horário indisponível", {
        description: "Este horário já foi reservado. Por favor, escolha outro."
      });
      fetchAvailableSlots(selectedDate);
      return;
    }

    // First, create or find the user profile for this WhatsApp number
    // For public orders, we'll use a special "guest" approach
    const cleanPhone = customerWhatsApp.replace(/\D/g, "");
    
    // Check if there's already a profile with this phone
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("phone", cleanPhone)
      .maybeSingle();

    let userId: string;

    if (existingProfile) {
      userId = existingProfile.user_id;
    } else {
      // Create a guest user ID based on phone (deterministic)
      userId = `guest_${cleanPhone}`;
      
      // Create profile for this guest
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          user_id: userId,
          full_name: customerName.trim(),
          phone: cleanPhone,
        }, { onConflict: 'user_id' });

      if (profileError) {
        console.error("Error creating guest profile:", profileError);
      }
    }

    // Create the appointment
    const serviceNames = selectedServices.map(s => s.name).join(", ");
    const notesText = customerNotes.trim() 
      ? `Pedido via WhatsApp - ${customerName.trim()} - Tel: ${cleanPhone}\nServiços: ${serviceNames}\n${customerNotes.trim()}`
      : `Pedido via WhatsApp - ${customerName.trim()} - Tel: ${cleanPhone}\nServiços: ${serviceNames}`;

    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        user_id: userId,
        service_id: selectedServices[0].id,
        appointment_date: appointmentDate,
        appointment_time: selectedTime,
        status: "pending",
        payment_status: "pending",
        payment_method: null,
        notes: notesText,
      })
      .select()
      .single();

    if (error || !appointment) {
      setLoading(false);
      if (error?.code === '23505') {
        toast.error("Horário indisponível", {
          description: "Este horário acabou de ser reservado. Por favor, escolha outro."
        });
      } else {
        console.error("Error creating appointment:", error);
        toast.error("Erro ao agendar", { description: "Tente novamente mais tarde." });
      }
      return;
    }

    // Insert additional services
    if (selectedServices.length > 1) {
      const additionalServices = selectedServices.slice(1).map(service => ({
        appointment_id: appointment.id,
        service_id: service.id,
      }));

      await supabase.from("appointment_services").insert(additionalServices);
    }

    if (error) {
      setLoading(false);
      if (error.code === '23505') {
        toast.error("Horário indisponível", {
          description: "Este horário acabou de ser reservado. Por favor, escolha outro."
        });
      } else {
        console.error("Error creating appointment:", error);
        toast.error("Erro ao agendar", { description: "Tente novamente mais tarde." });
      }
      return;
    }

    setLoading(false);
    setSuccess(true);
    toast.success("Pedido enviado!", { description: "Entraremos em contato para confirmar." });
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

  return (
    <div className="min-h-screen relative overflow-hidden safe-bottom">
      <AnimatedBackground />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-center px-4 py-6">
        <div className="flex flex-col items-center gap-2">
          <img 
            src={logoImage} 
            alt="Natan Barbershop" 
            className="w-16 h-16 rounded-full object-cover border-2 border-primary/30 shadow-gold-glow" 
          />
          <div className="text-center">
            <h1 className="text-xl font-bold">
              <span className="text-foreground">Natan </span>
              <span className="text-transparent bg-clip-text bg-gold-gradient">BarberShop</span>
            </h1>
            <p className="text-muted-foreground text-xs flex items-center justify-center gap-1 mt-1">
              <MapPin className="w-3 h-3" />
              {LOCATION.neighborhood}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-4 pb-8 max-w-lg mx-auto">
        <Card className="bg-card/80 backdrop-blur border-primary/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-center">
              {step === 1 && "Escolha os Serviços"}
              {step === 2 && "Escolha Data e Horário"}
              {step === 3 && "Seus Dados"}
            </CardTitle>
            {/* Step indicator */}
            <div className="flex justify-center gap-2 mt-3">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    s === step 
                      ? "bg-primary w-8" 
                      : s < step 
                        ? "bg-primary" 
                        : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Step 1: Select Service */}
            {step === 1 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-2">Selecione um ou mais serviços</p>
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
                      className={`w-full p-4 rounded-lg border transition-all text-left ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50 bg-card/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isSelected ? "bg-primary" : "bg-primary/20"
                        }`}>
                          {isSelected ? (
                            <Check className="w-5 h-5 text-background" />
                          ) : (
                            <Scissors className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{service.name}</h3>
                          {service.description && (
                            <p className="text-sm text-muted-foreground mt-0.5">{service.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-sm">
                            <span className="text-primary font-bold">
                              R$ {service.price.toFixed(2).replace(".", ",")}
                            </span>
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {service.duration_minutes} min
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {selectedServices.length > 0 && (
                  <div className="bg-primary/10 rounded-lg p-3 border border-primary/30">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">{selectedServices.length} serviço(s) selecionado(s)</span>
                      <span className="font-bold text-primary">
                        R$ {selectedServices.reduce((sum, s) => sum + s.price, 0).toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => setStep(2)}
                  disabled={selectedServices.length === 0}
                  className="w-full bg-gold-gradient text-background mt-4"
                >
                  Continuar
                </Button>
              </div>
            )}

            {/* Step 2: Select Date and Time */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 mb-3">
                    <CalendarIcon className="w-4 h-4 text-primary" />
                    Data
                  </Label>
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={disabledDays}
                      locale={ptBR}
                      className="rounded-md border border-primary/20 bg-card/50"
                    />
                  </div>
                </div>

                {selectedDate && (
                  <div>
                    <Label className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-primary" />
                      Horário
                    </Label>
                    {availableSlots.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        Nenhum horário disponível nesta data
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {availableSlots.map((slot) => (
                          <Button
                            key={slot.id}
                            variant={selectedTime === slot.slot_time ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedTime(slot.slot_time)}
                            className={selectedTime === slot.slot_time 
                              ? "bg-gold-gradient text-background" 
                              : "border-primary/30 hover:border-primary"
                            }
                          >
                            {slot.slot_time.slice(0, 5)}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Voltar
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!selectedDate || !selectedTime}
                    className="flex-1 bg-gold-gradient text-background"
                  >
                    Continuar
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Customer Info */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-primary" />
                    Seu Nome
                  </Label>
                  <Input
                    id="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Digite seu nome"
                    className={formErrors.name ? "border-destructive" : ""}
                    maxLength={100}
                  />
                  {formErrors.name && (
                    <p className="text-destructive text-sm mt-1">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="whatsapp" className="flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4 text-primary" />
                    WhatsApp
                  </Label>
                  <Input
                    id="whatsapp"
                    value={customerWhatsApp}
                    onChange={(e) => setCustomerWhatsApp(e.target.value)}
                    placeholder="(48) 99999-9999"
                    className={formErrors.whatsapp ? "border-destructive" : ""}
                    maxLength={15}
                  />
                  {formErrors.whatsapp && (
                    <p className="text-destructive text-sm mt-1">{formErrors.whatsapp}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="notes" className="mb-2 block">
                    Observação (opcional)
                  </Label>
                  <Textarea
                    id="notes"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="Alguma observação especial?"
                    rows={3}
                    maxLength={500}
                  />
                </div>

                {/* Summary */}
                <div className="bg-card/50 rounded-lg p-4 space-y-2 border border-primary/20">
                  <h4 className="font-semibold text-sm text-muted-foreground">Resumo do Pedido</h4>
                  <div>
                    <span className="text-sm text-muted-foreground">Serviços:</span>
                    <ul className="mt-1 space-y-1">
                      {selectedServices.map(s => (
                        <li key={s.id} className="flex justify-between text-sm">
                          <span>{s.name}</span>
                          <span>R$ {s.price.toFixed(2).replace(".", ",")}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex justify-between">
                    <span>Data:</span>
                    <span className="font-medium">
                      {selectedDate && format(selectedDate, "dd/MM/yyyy")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Horário:</span>
                    <span className="font-medium">{selectedTime?.slice(0, 5)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-primary/20">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold text-primary">
                      R$ {selectedServices.reduce((sum, s) => sum + s.price, 0).toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="flex-1"
                    disabled={loading}
                  >
                    Voltar
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 bg-gold-gradient text-background"
                  >
                    {loading ? "Enviando..." : "Confirmar Pedido"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Após confirmar, entraremos em contato pelo WhatsApp
        </p>
      </main>
    </div>
  );
};

export default Pedido;
