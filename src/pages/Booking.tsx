import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, Clock, Scissors, CreditCard, Calendar as CalendarIcon, Check, ChevronLeft, User, Phone, Copy, Navigation, Instagram, Package, Crown } from "lucide-react";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { ProfileMenu } from "@/components/ProfileMenu";
import CancellationPolicy from "@/components/CancellationPolicy";
import PackageBenefits from "@/components/PackageBenefits";
import SubscriptionProgress from "@/components/SubscriptionProgress";
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
import { generatePixPayload } from "@/lib/pix";
import { QRCodeSVG } from "qrcode.react";
import logoImage from "@/assets/logo-barbershop.png";
import pixIcon from "@/assets/pix-icon.png";

// Step progress indicator component
const StepIndicator = ({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) => {
  const steps = ["Serviços", "Data/Hora", "Dados", "Confirmar", "Concluído"];
  
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-6 sm:mb-8">
      {steps.slice(0, totalSteps).map((label, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;
        
        return (
          <div key={index} className="flex items-center">
            <div className="flex flex-col items-center">
              <div 
                className={`
                  w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold
                  transition-all duration-500 ease-out
                  ${isCompleted 
                    ? "bg-primary text-background scale-90" 
                    : isActive 
                      ? "bg-gold-gradient text-background shadow-gold-glow scale-110" 
                      : "bg-card/60 text-muted-foreground border border-primary/20"
                  }
                `}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : stepNumber}
              </div>
              <span className={`
                text-[10px] sm:text-xs mt-1 transition-colors duration-300 hidden sm:block
                ${isActive ? "text-primary font-medium" : "text-muted-foreground"}
              `}>
                {label}
              </span>
            </div>
            {index < totalSteps - 1 && (
              <div 
                className={`
                  w-6 sm:w-12 h-0.5 mx-1 sm:mx-2 transition-all duration-500
                  ${isCompleted ? "bg-primary" : "bg-border"}
                `} 
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
}

interface Package {
  id: string;
  name: string;
  description: string;
  price: number;
  items: PackageItem[];
}

interface PackageItem {
  id: string;
  service_name: string;
  quantity: number;
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

const PIX_KEY = "48992107035";
const PHONE = "(48) 99210-7035";
const INSTAGRAM = "@_natan_barber_";
const GOOGLE_MAPS_URL = "https://www.google.com/maps/search/?api=1&query=Rua+Visconde+de+Barbacena+99999+Barro+Branco+Lauro+Muller+SC";

const Booking = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Subscription state
  const [activeSubscription, setActiveSubscription] = useState<{
    id: string;
    package_name: string;
    monthly_cuts_limit: number;
    cuts_used_this_month: number;
  } | null>(null);
  const [usingSubscription, setUsingSubscription] = useState(false);
  
  const [customerName, setCustomerName] = useState("");
  const [customerWhatsApp, setCustomerWhatsApp] = useState("");
  const [formErrors, setFormErrors] = useState<{ name?: string; whatsapp?: string }>({});
  const stepContentRef = useRef<HTMLDivElement>(null);
  const prevStepRef = useRef(1);

  // Animated step transition
  const animateStepTransition = useCallback((direction: "forward" | "backward") => {
    if (stepContentRef.current) {
      const isForward = direction === "forward";
      
      // Exit animation
      gsap.to(stepContentRef.current, {
        opacity: 0,
        x: isForward ? -30 : 30,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => {
          // Entry animation
          gsap.fromTo(
            stepContentRef.current,
            { opacity: 0, x: isForward ? 40 : -40 },
            { 
              opacity: 1, 
              x: 0, 
              duration: 0.4, 
              ease: "power3.out",
              onComplete: () => {
                // Animate children with stagger
                const children = stepContentRef.current?.querySelectorAll(".animate-in");
                if (children && children.length > 0) {
                  gsap.fromTo(
                    children,
                    { opacity: 0, y: 15 },
                    { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: "power2.out" }
                  );
                }
              }
            }
          );
        }
      });
    }
  }, []);


  useEffect(() => {
    gsap.fromTo(".booking-container", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" });
    fetchServices();
    fetchPackages();
    loadUserProfile();
    checkActiveSubscription();
  }, []);

  useEffect(() => {
    if (user) {
      checkActiveSubscription();
    }
  }, [user]);

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

  const checkActiveSubscription = async () => {
    if (!user) {
      setActiveSubscription(null);
      return;
    }

    const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

    const { data: subscription } = await supabase
      .from("subscription_progress")
      .select("id, package_name, monthly_cuts_limit, cuts_used_this_month, current_month_start")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (subscription) {
      // Check if we need to reset monthly cuts (new month)
      const subMonthStart = subscription.current_month_start ? new Date(subscription.current_month_start) : null;
      let cutsUsed = subscription.cuts_used_this_month;
      
      if (!subMonthStart || 
          subMonthStart.getMonth() !== currentMonth.getMonth() || 
          subMonthStart.getFullYear() !== currentMonth.getFullYear()) {
        cutsUsed = 0;
      }

      setActiveSubscription({
        id: subscription.id,
        package_name: subscription.package_name || "Assinatura",
        monthly_cuts_limit: subscription.monthly_cuts_limit,
        cuts_used_this_month: cutsUsed,
      });
    } else {
      setActiveSubscription(null);
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

  const fetchPackages = async () => {
    const { data: packagesData, error: packagesError } = await supabase
      .from("packages")
      .select("*")
      .eq("active", true)
      .order("price");

    if (packagesError || !packagesData) return;

    const packagesWithItems: Package[] = await Promise.all(
      packagesData.map(async (pkg) => {
        const { data: items } = await supabase
          .from("package_items")
          .select("*")
          .eq("package_id", pkg.id);
        
        return {
          ...pkg,
          items: items || []
        };
      })
    );

    setPackages(packagesWithItems);
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
    // Deselecionar pacote se selecionar serviço avulso
    setSelectedPackage(null);
    setSelectedServices(prev => {
      const isSelected = prev.some(s => s.id === service.id);
      if (isSelected) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  const handlePackageSelect = (pkg: Package) => {
    // Limpar serviços avulsos e selecionar pacote
    setSelectedServices([]);
    setSelectedPackage(prev => prev?.id === pkg.id ? null : pkg);
  };

  const handleContinueToDate = () => {
    if (selectedServices.length === 0 && !selectedPackage) {
      toast.error("Selecione pelo menos um serviço ou pacote");
      return;
    }
    animateStepTransition("forward");
    setTimeout(() => setStep(2), 200);
  };

  // Cálculos de totais
  const totalPrice = selectedPackage ? selectedPackage.price : selectedServices.reduce((sum, s) => sum + s.price, 0);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    animateStepTransition("forward");
    setTimeout(() => setStep(3), 200);
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
    
    animateStepTransition("forward");
    setTimeout(() => setStep(4), 200);
  };

  const handleConfirmBooking = async () => {
    if (selectedServices.length === 0 || !selectedDate || !selectedTime) {
      toast.error("Dados incompletos", { description: "Selecione serviços, data e horário." });
      return;
    }
    
    if (!user) {
      toast.error("Login necessário", { description: "Faça login para confirmar seu agendamento." });
      navigate("/login");
      return;
    }

    // Validate customer info
    if (!customerName.trim() || !customerWhatsApp.replace(/\D/g, "")) {
      toast.error("Dados incompletos", { description: "Preencha seu nome e WhatsApp corretamente." });
      return;
    }

    setLoading(true);

    // Always update profile with customer info before creating appointment
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ 
        full_name: customerName.trim(), 
        phone: customerWhatsApp.replace(/\D/g, "") 
      })
      .eq("user_id", user.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Continue anyway, but log the error
    }

    // If using subscription, use a cut
    if (usingSubscription && activeSubscription) {
      const { data: cutUsed, error: cutError } = await supabase.rpc('use_subscription_cut', {
        p_user_id: user.id
      });

      if (cutError || !cutUsed) {
        toast.error("Erro ao usar crédito da assinatura", { description: "Tente novamente." });
        setLoading(false);
        return;
      }
    }

    // Criar o agendamento com o primeiro serviço (para compatibilidade)
    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        user_id: user.id,
        service_id: selectedServices[0].id,
        appointment_date: format(selectedDate, "yyyy-MM-dd"),
        appointment_time: selectedTime,
        status: "pending",
        payment_status: usingSubscription ? "paid" : "pending",
        payment_method: usingSubscription ? "subscription" : "pix",
        notes: usingSubscription ? "Agendamento via assinatura" : null,
      })
      .select()
      .single();

    if (error || !appointment) {
      setLoading(false);
      toast.error("Erro ao agendar", { description: "Tente novamente mais tarde." });
      return;
    }

    // Inserir todos os serviços na tabela de junção
    const appointmentServices = selectedServices.map(service => ({
      appointment_id: appointment.id,
      service_id: service.id,
    }));

    const { error: servicesError } = await supabase
      .from("appointment_services")
      .insert(appointmentServices);

    if (servicesError) {
      console.error("Error inserting appointment services:", servicesError);
    }

    setLoading(false);
    toast.success("Agendamento realizado!", { description: "Aguardando confirmação do barbeiro." });
    setStep(5);
    // Special success animation
    setTimeout(() => {
      if (stepContentRef.current) {
        gsap.fromTo(
          stepContentRef.current,
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.7)" }
        );
        const successIcon = stepContentRef.current.querySelector(".success-icon");
        if (successIcon) {
          gsap.fromTo(
            successIcon,
            { scale: 0, rotation: -180 },
            { scale: 1, rotation: 0, duration: 0.5, delay: 0.2, ease: "back.out(2)" }
          );
        }
      }
    }, 50);
  };

  const copyPixKey = () => {
    navigator.clipboard.writeText(PIX_KEY.replace(/\s/g, ""));
    toast.success("Chave PIX copiada!");
  };


  const goBack = () => {
    if (step > 1) {
      animateStepTransition("backward");
      setTimeout(() => setStep(step - 1), 200);
    }
  };

  const disabledDays = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = getDay(date);
    return date < today || dayOfWeek === 0 || dayOfWeek === 1;
  };

  return (
    <div className="min-h-screen relative overflow-hidden safe-bottom">
      <AnimatedBackground />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 max-w-7xl mx-auto safe-top">
        <div className="flex items-center gap-2 sm:gap-3">
          <img 
            src={logoImage} 
            alt="Natan Barbershop" 
            className="w-9 h-9 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-primary/30 shadow-gold-glow" 
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
              className="text-foreground hover:text-primary text-xs sm:text-sm touch-target"
            >
              Admin
            </Button>
          )}
          <ProfileMenu />
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 text-center py-6 sm:py-8 px-4">
        <h1 className="text-2xl xs:text-3xl sm:text-5xl md:text-6xl font-bold mb-1 sm:mb-2 leading-tight">
          <span className="text-foreground">Natan </span>
          <span className="text-transparent bg-clip-text bg-gold-gradient">BarberShop</span>
        </h1>
        <p className="text-muted-foreground text-xs sm:text-base mb-3 sm:mb-4">
          Experiência premium em cortes masculinos
        </p>
        
        {/* Contact Info */}
        <div className="flex items-center justify-center gap-3 sm:gap-6 text-muted-foreground text-xs sm:text-sm">
          <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="flex items-center gap-1 sm:gap-1.5 hover:text-primary transition-colors touch-target">
            <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">{PHONE}</span>
            <span className="xs:hidden">Ligar</span>
          </a>
          <a 
            href="https://www.instagram.com/_natan_barber_/" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 sm:gap-1.5 hover:text-primary transition-colors touch-target"
          >
            <Instagram className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{INSTAGRAM}</span>
          </a>
        </div>
      </section>

      {/* Main Content */}
      <main className="booking-container relative z-10 px-3 sm:px-4 pb-8 sm:pb-12 max-w-5xl mx-auto">
        {/* Step Progress Indicator - Only show for steps 2-4 */}
        {step > 1 && step < 5 && (
          <StepIndicator currentStep={step} totalSteps={5} />
        )}
        
        <div ref={stepContentRef}>
        {/* Step 1: Services and Location */}
        {step === 1 && (
          <div className="step-content space-y-6 sm:space-y-8">
            {/* CTA Button */}
            <div className="flex justify-center">
              <Button 
                onClick={() => document.getElementById('services-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-gold-gradient hover:opacity-90 text-background font-semibold px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg rounded-xl shadow-gold-glow touch-target"
              >
                <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Agendar Horário
              </Button>
            </div>

            {/* Location Card - Mobile Optimized */}
            <div className="bg-card/60 backdrop-blur-xl rounded-xl border-l-4 border-l-primary border-y border-r border-primary/10 overflow-hidden">
              <div className="p-4">
                <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Nossa Localização
                </h3>
                <div className="text-muted-foreground text-sm space-y-0.5 mb-4">
                  <p>{LOCATION.address}</p>
                  <p className="text-xs">{LOCATION.neighborhood}</p>
                  <p className="text-xs opacity-70">{LOCATION.cep}</p>
                </div>
                <a 
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button 
                    className="w-full bg-primary/90 hover:bg-primary text-background font-medium h-11 rounded-lg active:scale-[0.98] transition-transform"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Ver Rota no Google Maps
                  </Button>
                </a>
              </div>
            </div>

            {/* Services Section - Mobile Optimized */}
            <div id="services-section" className="space-y-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Scissors className="w-4 h-4 text-primary" />
                Nossos Serviços
              </h3>
              
              {/* Mobile: 2 columns, Desktop: 3 columns */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
                {services
                  .filter(s => !s.name.toLowerCase().includes('assinatura') && !s.name.toLowerCase().includes('premium') && !s.name.toLowerCase().includes('pezinho'))
                  .sort((a, b) => {
                    const order = ['Corte Tradicional', 'Corte Degradê', 'Sobrancelha', 'Barba'];
                    const indexA = order.indexOf(a.name);
                    const indexB = order.indexOf(b.name);
                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                    return a.price - b.price;
                  })
                  .map((service) => {
                    const isSelected = selectedServices.some(s => s.id === service.id);
                    return (
                      <div
                        key={service.id}
                        className={`relative rounded-xl p-3 cursor-pointer transition-all active:scale-[0.97] ${
                          isSelected 
                            ? "bg-primary/15 border-2 border-primary ring-2 ring-primary/20" 
                            : "bg-card/60 backdrop-blur-xl border border-primary/10"
                        }`}
                        onClick={() => handleServiceSelect(service)}
                      >
                        {/* Selection indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-3 h-3 text-background" />
                          </div>
                        )}
                        
                        {/* Icon */}
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                          <Scissors className="w-4 h-4 text-primary" />
                        </div>
                        
                        {/* Service Info */}
                        <h4 className={`font-semibold text-sm mb-0.5 pr-5 leading-tight ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {service.name}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mb-2 line-clamp-2 leading-relaxed">
                          {service.description || "Serviço profissional"}
                        </p>
                        
                        {/* Price */}
                        <p className="text-base font-bold text-primary">
                          R$ {service.price.toFixed(2)}
                        </p>
                      </div>
                    );
                  })}
              </div>

              {/* Summary - Floating bottom bar style on mobile */}
              {selectedServices.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-background/95 backdrop-blur-lg border-t border-border shadow-2xl sm:relative sm:mt-4 sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:shadow-none safe-bottom">
                  <div className="max-w-5xl mx-auto">
                    <div className="bg-primary/10 rounded-xl border border-primary/30 p-3 sm:p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <Check className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{selectedServices.length} serviço(s)</p>
                            <p className="text-lg font-bold text-primary">R$ {totalPrice.toFixed(2)}</p>
                          </div>
                        </div>
                        <Button 
                          onClick={handleContinueToDate}
                          className="bg-gold-gradient hover:opacity-90 text-background font-semibold h-11 px-5 text-sm rounded-xl active:scale-[0.97] transition-transform"
                        >
                          Continuar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Active Subscription Card */}
            {activeSubscription && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Crown className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Sua Assinatura Ativa</h3>
                    <p className="text-xs text-muted-foreground">Use seus créditos para agendar</p>
                  </div>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-green-500/15 to-card/80 border-2 border-green-500/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-bold text-foreground">{activeSubscription.package_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {activeSubscription.cuts_used_this_month} de {activeSubscription.monthly_cuts_limit} cortes usados este mês
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-500">
                        {activeSubscription.monthly_cuts_limit - activeSubscription.cuts_used_this_month}
                      </p>
                      <p className="text-[10px] text-muted-foreground">disponíveis</p>
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                    <div 
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ 
                        width: `${(activeSubscription.cuts_used_this_month / activeSubscription.monthly_cuts_limit) * 100}%` 
                      }}
                    />
                  </div>

                  {activeSubscription.cuts_used_this_month < activeSubscription.monthly_cuts_limit ? (
                    <Button
                      onClick={() => {
                        setUsingSubscription(true);
                        // Pre-select a service (first non-subscription service for booking)
                        const regularServices = services.filter(s => 
                          !s.name.toLowerCase().includes('assinatura') && 
                          !s.name.toLowerCase().includes('premium')
                        );
                        if (regularServices.length > 0) {
                          setSelectedServices([regularServices[0]]);
                        }
                        animateStepTransition("forward");
                        setTimeout(() => setStep(2), 200);
                      }}
                      className="w-full bg-green-500 hover:bg-green-600 text-background font-semibold h-12 rounded-xl"
                    >
                      <CalendarIcon className="w-5 h-5 mr-2" />
                      Agendar com Assinatura (Grátis)
                    </Button>
                  ) : (
                    <p className="text-center text-amber-500 text-sm font-medium bg-amber-500/10 p-3 rounded-lg">
                      Você atingiu o limite de cortes deste mês. Renova no próximo mês!
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Subscribe CTA - Only show if no active subscription */}
            {!activeSubscription && packages.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Crown className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Pacotes Mensais</h3>
                    <p className="text-xs text-muted-foreground">Economize com nossas assinaturas</p>
                  </div>
                </div>

                <div 
                  className="rounded-xl bg-gradient-to-br from-primary/15 via-card/90 to-primary/5 border-2 border-primary/30 p-4 cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => navigate("/buy-subscription")}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gold-gradient flex items-center justify-center shadow-gold-glow flex-shrink-0">
                      <Crown className="w-7 h-7 text-background" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-foreground mb-1">Assine um Pacote</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        Pague mensalmente e agende seus cortes sem custo adicional
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-[10px] bg-amber-600/20 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                          Bronze a partir de R$ 65
                        </span>
                        <span className="text-[10px] bg-slate-400/20 text-slate-400 px-2 py-0.5 rounded-full font-medium">
                          Prata
                        </span>
                        <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full font-medium">
                          Ouro
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4 bg-gold-gradient hover:opacity-90 text-background font-semibold h-12 rounded-xl"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/buy-subscription");
                    }}
                  >
                    Ver Pacotes e Assinar
                  </Button>
                </div>
              </div>
            )}

            {/* Package Benefits - Subscriber Rewards - Always visible */}
            <div className="mt-6 space-y-4 mb-20 sm:mb-0">
              <PackageBenefits />
              <SubscriptionProgress />
            </div>
          </div>
        )}

        {/* Step 2: Select Date & Time */}
        {step === 2 && (
          <div className="step-content space-y-6">
            <div className="flex items-center gap-4 mb-4 sm:mb-6 animate-in">
              <Button variant="ghost" size="icon" onClick={goBack} className="hover:bg-primary/10">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Escolha Data e Horário</h2>
            </div>

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
              {/* Calendar */}
              <Card className="bg-card/60 backdrop-blur-xl border-primary/20 animate-in">
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-foreground text-sm sm:text-base">
                    <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    Selecione a Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2 sm:px-6 pb-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={disabledDays}
                    locale={ptBR}
                    className="rounded-md border-0 pointer-events-auto w-full"
                  />
                </CardContent>
              </Card>

              {/* Time Slots */}
              <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-foreground text-sm sm:text-base">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    Horários Disponíveis
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  {!selectedDate ? (
                    <p className="text-muted-foreground text-center py-6 sm:py-8 text-sm">Selecione uma data primeiro</p>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-muted-foreground text-center py-6 sm:py-8 text-sm">Nenhum horário disponível nesta data</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2 max-h-[250px] sm:max-h-[300px] overflow-y-auto pr-1 sm:pr-2">
                      {availableSlots.map((slot) => (
                        <Button
                          key={slot.id}
                          variant={selectedTime === slot.slot_time ? "default" : "outline"}
                          size="sm"
                          className={`h-9 sm:h-10 text-xs sm:text-sm ${
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

            {/* Selected Services Summary */}
            {selectedServices.length > 0 && (
              <Card className="bg-primary/5 border-primary/30">
                <CardContent className="p-3 sm:p-4 space-y-1.5 sm:space-y-2">
                  {selectedServices.map((service) => (
                    <div key={service.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Scissors className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
                        <span className="text-foreground truncate">{service.name}</span>
                      </div>
                      <span className="text-muted-foreground flex-shrink-0">R$ {service.price.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
                    <span className="font-semibold text-foreground text-sm sm:text-base">Total</span>
                    <span className="text-primary font-bold">R$ {totalPrice.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 3: Customer Info */}
        {step === 3 && (
          <div className="step-content space-y-6">
            <div className="flex items-center gap-4 mb-4 sm:mb-6 animate-in">
              <Button variant="ghost" size="icon" onClick={goBack} className="hover:bg-primary/10">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Seus Dados</h2>
            </div>

            <Card className="bg-card/60 backdrop-blur-xl border-primary/20 animate-in">
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
                {selectedServices.map((service) => (
                  <div key={service.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-primary" />
                      <span className="text-foreground">{service.name}</span>
                    </div>
                    <span className="text-muted-foreground">R$ {service.price.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t border-border">
                  <CalendarIcon className="w-4 h-4" />
                  <span>{selectedDate && format(selectedDate, "dd/MM/yyyy")}</span>
                  <Clock className="w-4 h-4 ml-2" />
                  <span>{selectedTime?.slice(0, 5)}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="text-primary font-bold">R$ {totalPrice.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleCustomerInfoSubmit}
              className="w-full bg-gold-gradient hover:opacity-90 text-background font-semibold py-6 rounded-xl shadow-gold-glow animate-in"
            >
              Continuar
            </Button>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="step-content space-y-6">
            <div className="flex items-center gap-4 mb-4 sm:mb-6 animate-in">
              <Button variant="ghost" size="icon" onClick={goBack} className="hover:bg-primary/10">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Confirmar Agendamento</h2>
            </div>

            <Card className="bg-card/60 backdrop-blur-xl border-primary/20 animate-in">
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="text-foreground text-sm sm:text-base">Resumo do Agendamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-border">
                  <span className="text-muted-foreground text-sm">Cliente</span>
                  <span className="font-semibold text-foreground text-sm sm:text-base truncate ml-2">{customerName}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-border">
                  <span className="text-muted-foreground text-sm">WhatsApp</span>
                  <span className="font-semibold text-foreground text-sm sm:text-base">{customerWhatsApp}</span>
                </div>
                <div className="py-1.5 sm:py-2 border-b border-border">
                  <span className="text-muted-foreground block mb-1.5 sm:mb-2 text-sm">Serviços</span>
                  {selectedServices.map((service) => (
                    <div key={service.id} className="flex items-center justify-between py-0.5 sm:py-1">
                      <span className="text-foreground text-sm truncate">{service.name}</span>
                      <span className="text-muted-foreground text-sm flex-shrink-0">R$ {service.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-border">
                  <span className="text-muted-foreground text-sm">Data</span>
                  <span className="font-semibold text-foreground text-sm sm:text-base">
                    {selectedDate && format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-border">
                  <span className="text-muted-foreground text-sm">Horário</span>
                  <span className="font-semibold text-foreground text-sm sm:text-base">{selectedTime?.slice(0, 5)}</span>
                </div>
                <div className="flex items-center justify-between py-3 sm:py-4">
                  <span className="text-base sm:text-lg font-semibold text-foreground">Total</span>
                  <span className="text-xl sm:text-2xl font-bold text-primary">R$ {totalPrice.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-foreground text-sm sm:text-base">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Pagamento via PIX
                </CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Garanta seu horário! Realize o pagamento e confirme sua reserva.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {/* QR Code PIX */}
                <div className="flex flex-col items-center gap-3 sm:gap-4 p-4 sm:p-6 rounded-xl border border-primary/30 bg-card/50">
                  <div className="p-2 sm:p-3 bg-white rounded-xl">
                    <QRCodeSVG
                      value={generatePixPayload({
                        pixKey: PIX_KEY,
                        merchantName: "NATAN BARBER",
                        merchantCity: "LAURO MULLER",
                        amount: totalPrice,
                        description: selectedServices.map(s => s.name).join(", ").substring(0, 25),
                      })}
                      size={140}
                      level="M"
                      includeMargin={false}
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground text-center">
                    Escaneie o QR Code com seu app de banco
                  </p>
                  <div className="bg-gradient-to-r from-primary/20 via-primary/30 to-primary/20 border-2 border-primary rounded-xl px-4 py-3 text-center">
                    <p className="text-primary font-bold text-base">
                      💰 Pague o valor total para garantir seu horário!
                    </p>
                    <p className="text-primary/80 text-sm mt-1 font-semibold">
                      Total: R$ {totalPrice.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>

                {/* Chave PIX manual */}
                <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-border bg-card/50">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0 p-1.5 sm:p-2 shadow-sm">
                    <img src={pixIcon} alt="PIX" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs sm:text-sm font-medium text-muted-foreground">Ou copie a chave</h4>
                    <p className="text-sm sm:text-base font-mono text-foreground truncate">{PIX_KEY}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyPixKey}
                    className="border-primary/30 hover:bg-primary/10 flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10"
                  >
                    <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                  </Button>
                </div>
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
          <div className="step-content text-center space-y-6 py-8 sm:py-12">
            <div className="success-icon w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
            </div>
            <div className="animate-success-child">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Pedido Enviado!</h2>
              <p className="text-muted-foreground max-w-md mx-auto mt-2">
                Seu agendamento foi enviado e está aguardando aprovação do barbeiro. Você receberá uma confirmação em breve.
              </p>
            </div>

            <Card className="bg-card/60 backdrop-blur-xl border-primary/20 max-w-md mx-auto">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-semibold text-foreground">{customerName}</span>
                </div>
                <div className="py-2">
                  <span className="text-muted-foreground block mb-1">Serviços</span>
                  {selectedServices.map((service) => (
                    <div key={service.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{service.name}</span>
                      <span className="text-muted-foreground">R$ {service.price.toFixed(2)}</span>
                    </div>
                  ))}
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
                  <span className="text-xl font-bold text-primary">R$ {totalPrice.toFixed(2)}</span>
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
                  setSelectedServices([]); 
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
        </div>
      </main>
      {/* Fixed Package Continue Bar - Always visible at bottom when package selected */}
      {step === 1 && selectedPackage && (
        <div className="fixed bottom-0 left-0 right-0 z-[100] p-3 bg-background/98 backdrop-blur-xl border-t-2 border-primary/30 shadow-2xl safe-bottom">
          <div className="max-w-5xl mx-auto">
            <div className={`rounded-xl border-2 p-3 ${
              selectedPackage.name.toLowerCase().includes('ouro') 
                ? "bg-yellow-500/15 border-yellow-500/50"
                : selectedPackage.name.toLowerCase().includes('prata') 
                  ? "bg-slate-400/15 border-slate-400/50" 
                  : "bg-amber-600/15 border-amber-600/50"
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    selectedPackage.name.toLowerCase().includes('ouro') 
                      ? "bg-yellow-500/30"
                      : selectedPackage.name.toLowerCase().includes('prata') 
                        ? "bg-slate-400/30" 
                        : "bg-amber-600/30"
                  }`}>
                    <Package className={`w-5 h-5 ${
                      selectedPackage.name.toLowerCase().includes('ouro') 
                        ? "text-yellow-500"
                        : selectedPackage.name.toLowerCase().includes('prata') 
                          ? "text-slate-400" 
                          : "text-amber-600"
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{selectedPackage.name}</p>
                    <p className={`text-lg font-bold ${
                      selectedPackage.name.toLowerCase().includes('ouro') 
                        ? "text-yellow-500"
                        : selectedPackage.name.toLowerCase().includes('prata') 
                          ? "text-slate-400" 
                          : "text-amber-600"
                    }`}>
                      R$ {selectedPackage.price.toFixed(2)}
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={handleContinueToDate}
                  size="lg"
                  className={`h-12 px-6 text-base rounded-xl font-bold active:scale-[0.97] transition-transform shadow-lg flex-shrink-0 ${
                    selectedPackage.name.toLowerCase().includes('ouro')
                      ? "bg-yellow-500 hover:bg-yellow-600 text-background"
                      : selectedPackage.name.toLowerCase().includes('prata')
                        ? "bg-slate-400 hover:bg-slate-500 text-background"
                        : "bg-amber-600 hover:bg-amber-700 text-background"
                  }`}
                >
                  Continuar →
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Booking;
