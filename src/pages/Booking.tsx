import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, getDay, startOfWeek, endOfWeek, parseISO, isSameWeek, isSameMonth, startOfMonth, endOfMonth, addDays, isAfter, isBefore, isEqual } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, Clock, Scissors, CreditCard, Calendar as CalendarIcon, Check, ChevronLeft, ChevronDown, User, Phone, Copy, Navigation, Instagram, Package, Crown, Banknote } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import natanHeroImage from "@/assets/natan-barber-hero.png";
import pixIcon from "@/assets/pix-icon-new.png";
import cardIcon from "@/assets/card-icon.png";
import cashIcon from "@/assets/cash-icon.png";
import whatsappIcon from "@/assets/whatsapp-icon.svg";

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
  subscribers_only: boolean | null;
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
  service_id: string | null;
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
    package_id: string | null;
    package_name: string;
    monthly_cuts_limit: number;
    cuts_used_this_month: number;
    weekly_credits_available: number;
    subscription_start_date: Date;
    subscription_end_date: Date;
  } | null>(null);
  const [hasExpiredSubscription, setHasExpiredSubscription] = useState(false);
  const [subscriptionPackageItems, setSubscriptionPackageItems] = useState<PackageItem[]>([]);
  const [usingSubscription, setUsingSubscription] = useState(false);
  const [subscriptionBookedWeeks, setSubscriptionBookedWeeks] = useState<Date[]>([]); // Dates that have subscription bookings
  
  // Track usage per service for the current month
  const [serviceUsageThisMonth, setServiceUsageThisMonth] = useState<Record<string, number>>({});
  
  const [customerName, setCustomerName] = useState("");
  const [customerWhatsApp, setCustomerWhatsApp] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"pix" | "dinheiro" | "cartao">("pix");
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
      fetchSubscriptionBookings();
    }
  }, [user]);

  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots(selectedDate);
    }
  }, [selectedDate, selectedServices]);

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
      setSubscriptionPackageItems([]);
      return;
    }

    const currentMonth = new Date();

    const { data: subscription } = await supabase
      .from("subscription_progress")
      .select("id, package_id, package_name, monthly_cuts_limit, cuts_used_this_month, current_month_start, weekly_credits_available, subscription_start_date")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (subscription) {
      // Calculate subscription period based on start date
      const startDate = subscription.subscription_start_date 
        ? parseISO(subscription.subscription_start_date) 
        : new Date();
      
      // Subscription is valid for 30 days from start date (can be adjusted per package)
      const endDate = addDays(startDate, 30);
      
      // Check if we need to reset monthly cuts (based on subscription period)
      const subMonthStart = subscription.current_month_start ? new Date(subscription.current_month_start) : null;
      let cutsUsed = subscription.cuts_used_this_month;
      
      if (!subMonthStart || 
          subMonthStart.getMonth() !== currentMonth.getMonth() || 
          subMonthStart.getFullYear() !== currentMonth.getFullYear()) {
        cutsUsed = 0;
      }

      setActiveSubscription({
        id: subscription.id,
        package_id: subscription.package_id,
        package_name: subscription.package_name || "Assinatura",
        monthly_cuts_limit: subscription.monthly_cuts_limit,
        cuts_used_this_month: cutsUsed,
        // IMPORTANT: 0 é um valor válido (sem créditos). Use ?? para não mascarar 0.
        weekly_credits_available: subscription.weekly_credits_available ?? Math.ceil(subscription.monthly_cuts_limit / 4),
        subscription_start_date: startDate,
        subscription_end_date: endDate,
      });

      // Fetch package items AND benefits for this subscription's package
      if (subscription.package_id) {
        // Fetch package_items
        const { data: packageItems } = await supabase
          .from("package_items")
          .select("id, service_name, service_id, quantity")
          .eq("package_id", subscription.package_id);

        // Fetch package_benefits (extras like Sobrancelha)
        const { data: packageBenefits } = await supabase
          .from("package_benefits")
          .select(`
            id,
            service_id,
            quantity,
            services (name)
          `)
          .eq("package_id", subscription.package_id);

        // Combine package_items and package_benefits
        const allItems: PackageItem[] = [];
        
        // Add package items
        if (packageItems) {
          packageItems.forEach(item => {
            // Avoid duplicates
            if (!allItems.some(i => i.service_id === item.service_id)) {
              allItems.push(item);
            }
          });
        }
        
        // Add package benefits (extras) that aren't already in items
        if (packageBenefits) {
          packageBenefits.forEach(benefit => {
            const serviceName = (benefit.services as any)?.name || 'Serviço';
            // Check if already exists
            if (!allItems.some(i => i.service_id === benefit.service_id)) {
              allItems.push({
                id: benefit.id,
                service_name: serviceName,
                service_id: benefit.service_id,
                quantity: benefit.quantity || 1
              });
            }
          });
        }

        setSubscriptionPackageItems(allItems);
      }
    } else {
      setActiveSubscription(null);
      setSubscriptionPackageItems([]);
      
      // Check if user has an inactive/expired subscription
      const { data: inactiveSub } = await supabase
        .from("subscription_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", false)
        .limit(1)
        .maybeSingle();
      
      setHasExpiredSubscription(!!inactiveSub);
    }
  };

  // Fetch user's subscription bookings
  // Track usage per service for the CURRENT subscription period (based on subscription_start_date)
  // Also track weekly bookings for ONE-BOOKING-PER-WEEK rule
  const fetchSubscriptionBookings = async () => {
    if (!user) {
      setSubscriptionBookedWeeks([]);
      setServiceUsageThisMonth({});
      return;
    }

    // First get the subscription to know the period and reset date
    const { data: subscription } = await supabase
      .from("subscription_progress")
      .select("subscription_start_date, usage_reset_date")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const subscriptionStart = subscription?.subscription_start_date 
      ? parseISO(subscription.subscription_start_date) 
      : startOfMonth(new Date());
    const subscriptionEnd = addDays(subscriptionStart, 30);
    
    // Usage reset date is used to filter out appointments from previous periods
    // This is updated when admin renews the subscription
    const usageResetDate = subscription?.usage_reset_date 
      ? new Date(subscription.usage_reset_date) 
      : subscriptionStart;

    // Fetch appointments with their services - from subscription start date
    // Also fetch created_at to compare with usage_reset_date
    const { data: appointments } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        service_id,
        created_at,
        appointment_services (service_id)
      `)
      .eq("user_id", user.id)
      .eq("payment_method", "subscription")
      .neq("status", "cancelled")
      .gte("appointment_date", format(subscriptionStart, "yyyy-MM-dd"));

    if (appointments && appointments.length > 0) {
      // Filter appointments created after the usage reset date
      // This ensures that when subscription is renewed, old appointments don't count
      const validAppointments = appointments.filter(apt => {
        const createdAt = new Date(apt.created_at);
        return createdAt >= usageResetDate;
      });

      // All booked dates for weekly tracking (prevents double-booking same week)
      // IMPORTANT: Deduplicate by week so multiple services in the same booking
      // don't count as multiple weeks used
      const allBookedDates = validAppointments.map(apt => parseISO(apt.appointment_date));
      const uniqueWeekDates: Date[] = [];
      for (const date of allBookedDates) {
        const alreadyHasWeek = uniqueWeekDates.some(d => isSameWeek(d, date, { weekStartsOn: 0 }));
        if (!alreadyHasWeek) {
          uniqueWeekDates.push(date);
        }
      }
      setSubscriptionBookedWeeks(uniqueWeekDates);
      
      // Calculate usage per service for the subscription period (not calendar month)
      const usageMap: Record<string, number> = {};
      
      for (const apt of validAppointments) {
        const aptDate = parseISO(apt.appointment_date);
        // Only count appointments within the subscription period
        const isWithinPeriod = 
          (isAfter(aptDate, subscriptionStart) || isEqual(aptDate, subscriptionStart)) &&
          (isBefore(aptDate, subscriptionEnd) || isEqual(aptDate, subscriptionEnd));
        
        if (isWithinPeriod) {
          // Count main service
          if (apt.service_id) {
            usageMap[apt.service_id] = (usageMap[apt.service_id] || 0) + 1;
          }
          
          // Count additional services
          const additionalServices = apt.appointment_services as { service_id: string }[] | null;
          if (additionalServices && Array.isArray(additionalServices)) {
            for (const svc of additionalServices) {
              if (svc.service_id) {
                usageMap[svc.service_id] = (usageMap[svc.service_id] || 0) + 1;
              }
            }
          }
        }
      }
      
      setServiceUsageThisMonth(usageMap);
    } else {
      setSubscriptionBookedWeeks([]);
      setServiceUsageThisMonth({});
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

  // Subscriber duration override:
  // 1-2 serviços = 30 min (1 slot)
  // 3+ serviços = 60 min (2 slots consecutivos)
  const getEffectiveDuration = (services: Service[], isSubscriber: boolean): number => {
    if (!isSubscriber || services.length === 0) {
      return services.reduce((sum, s) => sum + s.duration_minutes, 0);
    }
    return services.length >= 3 ? 60 : 30;
  };

  // Calculate total duration and required slots
  const totalDuration = getEffectiveDuration(selectedServices, usingSubscription);
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

    // Calculate required slots inside function to ensure fresh value
    const currentTotalDuration = getEffectiveDuration(selectedServices, usingSubscription);
    const currentRequiredSlots = Math.ceil(currentTotalDuration / 30) || 1;

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

    // Fetch ALL blocked times (manual + auto-generated from appointments)
    // This is the primary source of truth for clients because RLS prevents
    // them from seeing other users' appointments
    const { data: allBlocks } = await supabase
      .from("blocked_dates")
      .select("blocked_time")
      .eq("blocked_date", dateStr);

    const occupiedTimes = new Set<string>(
      allBlocks?.map((b) => b.blocked_time).filter(Boolean) as string[] || []
    );

    setBookedTimes(Array.from(occupiedTimes));

    // Filtrar horários que já passaram (para o dia atual)
    const now = new Date();
    const isToday = format(date, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
    const currentTime = format(now, "HH:mm:ss");

    // Get all slot times for checking consecutive availability
    const allSlotTimes = slots?.map(s => s.slot_time) || [];

    // Debug logging removed for performance

    const availableSlots = slots?.filter((slot) => {
      // Excluir horários ocupados
      if (occupiedTimes.has(slot.slot_time)) {
        return false;
      }
      // Se for hoje, excluir horários que já passaram
      if (isToday && slot.slot_time <= currentTime) {
        return false;
      }
      
      // Check if we have enough consecutive slots for the total service duration
      if (currentRequiredSlots > 1) {
        for (let i = 1; i < currentRequiredSlots; i++) {
          const nextSlotTime = addMinutesToTime(slot.slot_time, i * 30);
          // Only check if the next time is occupied (blocked).
          // Don't require it to exist in time_slots - the schedule may have gaps
          // but the barber still needs that time free.
          if (occupiedTimes.has(nextSlotTime)) {
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

    // CRITICAL: Check if all required slots are still available before proceeding
    const appointmentDate = format(selectedDate, "yyyy-MM-dd");
    
    // Generate all time slots that will be occupied based on total duration
    const timesToCheck = [selectedTime];
    for (let i = 1; i < requiredSlots; i++) {
      timesToCheck.push(addMinutesToTime(selectedTime, i * 30));
    }
    
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
      // Refresh available times
      fetchAvailableSlots(selectedDate);
      return;
    }

    // If using subscription, verify rules
    if (usingSubscription && activeSubscription) {
      const today = new Date();
      
      // Rule 1: Subscription only valid within the subscription period (30 days from start date)
      const isWithinSubscriptionPeriod = 
        (isAfter(selectedDate, activeSubscription.subscription_start_date) || 
         isEqual(selectedDate, activeSubscription.subscription_start_date)) &&
        (isBefore(selectedDate, activeSubscription.subscription_end_date) || 
         isEqual(selectedDate, activeSubscription.subscription_end_date));
      
      if (!isWithinSubscriptionPeriod) {
        setLoading(false);
        const startFormatted = format(activeSubscription.subscription_start_date, "dd/MM", { locale: ptBR });
        const endFormatted = format(activeSubscription.subscription_end_date, "dd/MM", { locale: ptBR });
        toast.error("Data fora do período da assinatura", { 
          description: `Sua assinatura é válida de ${startFormatted} até ${endFormatted}.` 
        });
        return;
      }
      
      // Rule 2: Check if user reached monthly booking limit
      if (subscriptionBookedWeeks.length >= activeSubscription.monthly_cuts_limit) {
        setLoading(false);
        toast.error("Limite de agendamentos atingido", { 
          description: `Você já agendou ${activeSubscription.monthly_cuts_limit} vezes este mês.` 
        });
        return;
      }
      
      // Rule 3: Check if user already has an appointment in this week
      // Always check database for existing bookings in the selected week to prevent duplicates
      const isWeekAlreadyBooked = subscriptionBookedWeeks.some(bookedDate => 
        isSameWeek(selectedDate, bookedDate, { weekStartsOn: 0 })
      );
      
      if (isWeekAlreadyBooked) {
        setLoading(false);
        toast.error("Limite semanal atingido", { 
          description: "Você já tem um agendamento nesta semana. Escolha uma data em outra semana." 
        });
        return;
      }
      
      // Rule 4: Verify each selected service has available credits
      for (const service of selectedServices) {
        const packageItem = subscriptionPackageItems.find(item => 
          item.service_id === service.id || 
          item.service_name.toLowerCase() === service.name.toLowerCase()
        );
        
        if (packageItem) {
          const used = serviceUsageThisMonth[service.id] || 0;
          const limit = packageItem.quantity;
          
          if (used >= limit) {
            setLoading(false);
            toast.error(`Limite de ${service.name} atingido`, { 
              description: `Você já usou ${used}/${limit} este mês.` 
            });
            return;
          }
        }
      }
    }

    // Criar o agendamento com o primeiro serviço (para compatibilidade)
    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        user_id: user.id,
        service_id: selectedServices[0].id,
        appointment_date: appointmentDate,
        appointment_time: selectedTime,
        status: "pending",
        payment_status: usingSubscription ? "paid" : "pending",
        payment_method: usingSubscription ? "subscription" : selectedPaymentMethod,
        notes: usingSubscription ? "Agendamento via assinatura" : null,
      })
      .select()
      .single();

    if (error || !appointment) {
      setLoading(false);
      // Check if it's a unique constraint violation
      if (error?.code === '23505') {
        toast.error("Horário indisponível", { 
          description: "Este horário acabou de ser reservado. Por favor, escolha outro." 
        });
      } else {
        toast.error("Erro ao agendar", { description: "Tente novamente mais tarde." });
      }
      return;
    }

    // Inserir apenas serviços adicionais na tabela de junção (o primeiro já está em service_id)
    if (selectedServices.length > 1) {
      const additionalServices = selectedServices.slice(1).map(service => ({
        appointment_id: appointment.id,
        service_id: service.id,
      }));

      const { error: servicesError } = await supabase
        .from("appointment_services")
        .insert(additionalServices);

      if (servicesError) {
        console.error("Error inserting appointment services:", servicesError);
      }
    }

    // Refresh subscription bookings to update remaining count
    if (usingSubscription) {
      fetchSubscriptionBookings();
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

  const copyPixCode = (amount: number, description: string = "") => {
    const pixPayload = generatePixPayload({
      pixKey: PIX_KEY,
      merchantName: "NATAN BARBER",
      merchantCity: "LAURO MULLER",
      amount: amount,
      description: description.substring(0, 25),
    });
    navigator.clipboard.writeText(pixPayload);
    toast.success("Código PIX copiado!", { description: `Valor: R$ ${amount.toFixed(2).replace('.', ',')}` });
  };


  const goBack = () => {
    if (step > 1) {
      animateStepTransition("backward");
      setTimeout(() => setStep(step - 1), 200);
    }
  };

  // Disable days: past, Sundays, Saturdays for subscribers
  // Subscribers CAN book in future months (no longer restricted to current month only)
  const disabledDays = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = getDay(date);
    
    // If using subscription, block Saturdays only
    if (usingSubscription) {
      // Block Saturdays for subscribers (dayOfWeek 6 = Saturday)
      if (dayOfWeek === 6) {
        return true;
      }
    }
    
    // Apenas domingo (0) está fechado e dias passados
    return date < today || dayOfWeek === 0;
  };

  // Check if a date is in a week that already has a subscription booking
  const isWeekBooked = (date: Date): boolean => {
    return subscriptionBookedWeeks.some(bookedDate => 
      isSameWeek(date, bookedDate, { weekStartsOn: 0 })
    );
  };

  // Modifiers for calendar to highlight booked weeks
  const calendarModifiers = usingSubscription ? {
    bookedWeek: (date: Date) => isWeekBooked(date) && !disabledDays(date),
  } : {};

  const calendarModifiersClassNames = {
    bookedWeek: "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border border-amber-500/50",
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
      <section className="relative z-10 text-center py-4 sm:py-8 px-4">
        <img 
          src={natanHeroImage} 
          alt="Natan Barber" 
          className="w-40 xs:w-48 sm:w-56 h-auto mx-auto object-contain drop-shadow-2xl mb-3" 
        />
        
        {/* Contact Info */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 text-muted-foreground text-xs sm:text-sm">
          <a 
            href="https://wa.me/554891824897" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 sm:gap-2 hover:text-[#25D366] transition-colors touch-target"
          >
            <img src={whatsappIcon} alt="WhatsApp" className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>(48) 9182-4897</span>
          </a>
          <a 
            href="https://www.instagram.com/_natan_barber_/" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 sm:gap-2 hover:text-primary transition-colors touch-target"
          >
            <Instagram className="w-4 h-4 sm:w-5 sm:h-5" />
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
                {usingSubscription ? `Serviços do ${activeSubscription?.package_name}` : "Nossos Serviços"}
              </h3>
              
              {usingSubscription && subscriptionPackageItems.length > 0 && (
                <p className="text-xs text-muted-foreground bg-green-500/10 p-2 rounded-lg border border-green-500/30">
                  💡 Selecione os serviços incluídos no seu pacote. Cada serviço tem uma quantidade mensal.
                </p>
              )}
              
              {/* Mobile: 2 columns, Desktop: 3 columns */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
                {(() => {
                  // Get the services to display based on subscription mode
                  const getServicesToDisplay = () => {
                    if (usingSubscription && subscriptionPackageItems.length > 0) {
                      // Filter services that are in the package
                      return services.filter(service => {
                        return subscriptionPackageItems.some(item => 
                          item.service_id === service.id || 
                          item.service_name.toLowerCase() === service.name.toLowerCase()
                        );
                      });
                    }
                    // Normal mode - filter out subscription/premium/pezinho AND subscribers_only
                    return services.filter(s => 
                      !s.subscribers_only &&
                      !s.name.toLowerCase().includes('assinatura') && 
                      !s.name.toLowerCase().includes('premium') && 
                      !s.name.toLowerCase().includes('pezinho')
                    );
                  };

                  const servicesToDisplay = getServicesToDisplay()
                    .sort((a, b) => {
                      const order = ['Corte Tradicional', 'Corte Degradê', 'Sobrancelha', 'Barba', 'Pezinho'];
                      const indexA = order.indexOf(a.name);
                      const indexB = order.indexOf(b.name);
                      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                      if (indexA !== -1) return -1;
                      if (indexB !== -1) return 1;
                      return a.price - b.price;
                    });

                  return servicesToDisplay.map((service) => {
                    const isSelected = selectedServices.some(s => s.id === service.id);
                    
                    // Get package item info for this service (if using subscription)
                    const packageItem = usingSubscription 
                      ? subscriptionPackageItems.find(item => 
                          item.service_id === service.id || 
                          item.service_name.toLowerCase() === service.name.toLowerCase()
                        )
                      : null;

                    // Calculate usage for this specific service
                    const serviceUsed = serviceUsageThisMonth[service.id] || 0;
                    const serviceLimit = packageItem?.quantity || 0;
                    const serviceRemaining = Math.max(0, serviceLimit - serviceUsed);
                    const isServiceLimitReached = usingSubscription && packageItem && serviceRemaining === 0;

                    return (
                      <div
                        key={service.id}
                        className={`relative rounded-xl p-3 transition-all ${
                          isServiceLimitReached
                            ? "bg-muted/30 border border-muted cursor-not-allowed opacity-60"
                            : isSelected 
                              ? usingSubscription 
                                ? "bg-green-500/15 border-2 border-green-500 ring-2 ring-green-500/20 cursor-pointer active:scale-[0.97]"
                                : "bg-primary/15 border-2 border-primary ring-2 ring-primary/20 cursor-pointer active:scale-[0.97]" 
                              : "bg-card/60 backdrop-blur-xl border border-primary/10 cursor-pointer active:scale-[0.97]"
                        }`}
                        onClick={() => {
                          if (!isServiceLimitReached) {
                            handleServiceSelect(service);
                          } else {
                            toast.error(`Limite de ${service.name} atingido`, {
                              description: `Você já usou ${serviceUsed}/${serviceLimit} este mês.`
                            });
                          }
                        }}
                      >
                        {/* Selection indicator */}
                        {isSelected && !isServiceLimitReached && (
                          <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${
                            usingSubscription ? "bg-green-500" : "bg-primary"
                          }`}>
                            <Check className="w-3 h-3 text-background" />
                          </div>
                        )}

                        {/* Package quantity badge - shows remaining/total */}
                        {usingSubscription && packageItem && (
                          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full border ${
                            isServiceLimitReached 
                              ? "bg-destructive/20 border-destructive/50"
                              : "bg-green-500/20 border-green-500/50"
                          }`}>
                            <span className={`text-[10px] font-bold ${
                              isServiceLimitReached ? "text-destructive" : "text-green-500"
                            }`}>
                              {isServiceLimitReached ? "Esgotado" : `${serviceRemaining}/${serviceLimit}`}
                            </span>
                          </div>
                        )}
                        
                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${
                          isServiceLimitReached
                            ? "bg-muted/30 mt-4"
                            : usingSubscription && packageItem 
                              ? "bg-green-500/10 mt-4" 
                              : "bg-primary/10"
                        }`}>
                          <Scissors className={`w-4 h-4 ${
                            isServiceLimitReached 
                              ? "text-muted-foreground" 
                              : usingSubscription 
                                ? "text-green-500" 
                                : "text-primary"
                          }`} />
                        </div>
                        
                        {/* Service Info */}
                        <h4 className={`font-semibold text-sm mb-0.5 pr-5 leading-tight ${
                          isServiceLimitReached
                            ? "text-muted-foreground"
                            : isSelected 
                              ? usingSubscription ? "text-green-500" : "text-primary" 
                              : "text-foreground"
                        }`}>
                          {service.name}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mb-2 line-clamp-2 leading-relaxed">
                          {service.description || "Serviço profissional"}
                        </p>
                        
                        {/* Price and Duration */}
                        {isServiceLimitReached ? (
                          <p className="text-xs text-destructive font-medium">
                            🚫 Limite atingido ({serviceUsed}/{serviceLimit})
                          </p>
                        ) : usingSubscription ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-muted-foreground line-through">R$ {service.price.toFixed(2)}</p>
                            <p className="text-base font-bold text-green-500">Grátis</p>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {service.duration_minutes}min
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-base font-bold text-primary">
                              R$ {service.price.toFixed(2)}
                            </p>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {service.duration_minutes}min
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Spacer to prevent content from being hidden behind fixed bottom bar on mobile */}
              <div className="h-28 sm:h-0" />
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
                    <p className="text-xs text-muted-foreground">Use seus benefícios para agendar</p>
                  </div>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-green-500/15 to-card/80 border-2 border-green-500/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-foreground">{activeSubscription.package_name}</p>
                    <div className="flex items-center gap-1 text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded-full">
                      <CalendarIcon className="w-3 h-3" />
                      <span>
                        {format(activeSubscription.subscription_start_date, "dd/MM", { locale: ptBR })} - {format(activeSubscription.subscription_end_date, "dd/MM", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  
                  {/* Service-by-service usage display */}
                  {subscriptionPackageItems.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <p className="text-xs text-muted-foreground font-medium">Uso por serviço este mês:</p>
                      {subscriptionPackageItems.map((item) => {
                        const used = serviceUsageThisMonth[item.service_id || ''] || 0;
                        const total = item.quantity;
                        const remaining = Math.max(0, total - used);
                        const percentage = total > 0 ? (used / total) * 100 : 0;
                        const isExhausted = remaining === 0;
                        
                        return (
                          <div key={item.id} className="bg-muted/30 rounded-lg p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-foreground">{item.service_name}</span>
                              <span className={`text-xs font-bold ${isExhausted ? 'text-destructive' : 'text-green-500'}`}>
                                {remaining}/{total}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${isExhausted ? 'bg-destructive' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(100, percentage)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Show booked weeks */}
                  {subscriptionBookedWeeks.length > 0 && (
                    <div className="mb-3 p-2 bg-muted/30 rounded-lg">
                      <p className="text-[10px] text-muted-foreground mb-1">Semanas agendadas ({subscriptionBookedWeeks.length}/{activeSubscription.monthly_cuts_limit}):</p>
                      <div className="flex flex-wrap gap-1">
                        {subscriptionBookedWeeks.map((date, i) => (
                          <span key={i} className="text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full">
                            {format(date, "dd/MM")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Check if ANY service still has credits available */}
                  {(() => {
                    const hasAnyCreditsLeft = subscriptionPackageItems.some(item => {
                      const used = serviceUsageThisMonth[item.service_id || ''] || 0;
                      return used < item.quantity;
                    });
                    
                    // Also check weekly booking limit
                    const hasWeeklySlots = subscriptionBookedWeeks.length < activeSubscription.monthly_cuts_limit;

                    if (hasAnyCreditsLeft && hasWeeklySlots) {
                      return !usingSubscription ? (
                        <Button
                          onClick={() => {
                            setUsingSubscription(true);
                            toast.success("Modo assinatura ativado!", { 
                              description: "Selecione os serviços que deseja usar."
                            });
                          }}
                          className="w-full bg-green-500 hover:bg-green-600 text-background font-semibold h-12 rounded-xl"
                        >
                          <CalendarIcon className="w-5 h-5 mr-2" />
                          Usar Benefícios da Assinatura
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 p-3 bg-green-500/20 rounded-lg border border-green-500/50">
                            <Check className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-medium text-green-500">
                              Modo assinatura ativo! Selecione os serviços acima.
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setUsingSubscription(false);
                              setSelectedServices([]);
                            }}
                            className="w-full border-muted-foreground/30 text-muted-foreground h-10"
                          >
                            Cancelar uso da assinatura
                          </Button>
                        </div>
                      );
                    } else {
                      return (
                        <div className="space-y-3">
                          <div className="text-center bg-destructive/10 p-3 rounded-lg border border-destructive/30">
                            <p className="text-destructive text-sm font-medium mb-1">
                              {!hasWeeklySlots 
                                ? "🚫 Limite de agendamentos semanais atingido!"
                                : "🚫 Todos os benefícios foram utilizados!"}
                            </p>
                            <p className="text-destructive/80 text-xs">
                              {!hasWeeklySlots 
                                ? `Você já agendou ${subscriptionBookedWeeks.length}x este mês (máx: ${activeSubscription.monthly_cuts_limit}).`
                                : "Você já usou todos os seus benefícios deste mês."}
                            </p>
                          </div>
                          <Button
                            className="w-full bg-gold-gradient hover:opacity-90 text-background font-semibold h-12 rounded-xl"
                            onClick={() => navigate("/buy-subscription")}
                          >
                            <Crown className="w-5 h-5 mr-2" />
                            Renovar Assinatura
                          </Button>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            )}

            {/* Subscribe/Renew CTA - Show if no active subscription */}
            {!activeSubscription && packages.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Crown className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      {hasExpiredSubscription ? "Renovar Assinatura" : "Pacotes Mensais"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {hasExpiredSubscription 
                        ? "Sua assinatura expirou. Renove para continuar aproveitando!" 
                        : "Economize com nossas assinaturas"}
                    </p>
                  </div>
                </div>

                {hasExpiredSubscription && (
                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                    <Crown className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <p className="text-xs text-amber-400">
                      Renove agora e seus créditos semanais serão restaurados imediatamente!
                    </p>
                  </div>
                )}

                <div 
                  className="rounded-xl bg-gradient-to-br from-primary/15 via-card/90 to-primary/5 border-2 border-primary/30 p-4 cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => navigate("/buy-subscription")}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gold-gradient flex items-center justify-center shadow-gold-glow flex-shrink-0">
                      <Crown className="w-7 h-7 text-background" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-foreground mb-1">
                        {hasExpiredSubscription ? "Renovar Pacote" : "Assine um Pacote"}
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        {hasExpiredSubscription
                          ? "Renove sua assinatura e volte a agendar com benefícios exclusivos"
                          : "Pague mensalmente e agende seus cortes sem custo adicional"}
                      </p>
                      {!hasExpiredSubscription && (
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
                      )}
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4 bg-gold-gradient hover:opacity-90 text-background font-semibold h-12 rounded-xl"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/buy-subscription");
                    }}
                  >
                    {hasExpiredSubscription ? "Renovar Assinatura" : "Ver Pacotes e Assinar"}
                  </Button>
                </div>
              </div>
            )}

            {/* Package Benefits - Subscriber Rewards - Always visible */}
            <div className="mt-6 space-y-4 mb-28 sm:mb-0">
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
                  {usingSubscription && subscriptionBookedWeeks.length > 0 && (
                    <p className="text-xs text-amber-500 flex items-center gap-1 mt-1">
                      <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/50"></span>
                      Semanas com agendamento marcado
                    </p>
                  )}
                </CardHeader>
                <CardContent className="px-2 sm:px-6 pb-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={disabledDays}
                    modifiers={calendarModifiers}
                    modifiersClassNames={calendarModifiersClassNames}
                    locale={ptBR}
                    className="rounded-md border-0 pointer-events-auto w-full"
                  />
                  {usingSubscription && selectedDate && isWeekBooked(selectedDate) && (
                    <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-xs text-amber-500 font-medium">
                        ⚠️ Você já tem um agendamento nesta semana!
                      </p>
                      <p className="text-[10px] text-amber-400/80">
                        Escolha uma data em outra semana ou cancele o agendamento existente.
                      </p>
                    </div>
                  )}
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
                  Formas de Pagamento
                </CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Escolha como deseja pagar seu serviço
                </p>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {/* PIX Option */}
                <Collapsible open={selectedPaymentMethod === "pix"} onOpenChange={(open) => open && setSelectedPaymentMethod("pix")}>
                  <CollapsibleTrigger asChild>
                    <div 
                      onClick={() => setSelectedPaymentMethod("pix")}
                      className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedPaymentMethod === "pix" 
                          ? "border-[#00D4AA] bg-[#00D4AA]/10 ring-2 ring-[#00D4AA]/30" 
                          : "border-[#00D4AA]/30 bg-[#00D4AA]/5 hover:bg-[#00D4AA]/10"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedPaymentMethod === "pix" ? "border-[#00D4AA] bg-[#00D4AA]" : "border-muted-foreground"
                      }`}>
                        {selectedPaymentMethod === "pix" && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0 p-1.5 sm:p-2 shadow-sm">
                        <img src={pixIcon} alt="PIX" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm sm:text-base font-semibold text-foreground">PIX</h4>
                        <p className="text-xs text-[#00D4AA]">Clique para ver QR Code</p>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-[#00D4AA] transition-transform ${selectedPaymentMethod === "pix" ? "rotate-180" : ""}`} />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="flex flex-col items-center gap-3 sm:gap-4 p-4 sm:p-6 rounded-xl border border-[#00D4AA]/30 bg-[#00D4AA]/5">
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
                      <div className="bg-gradient-to-r from-[#00D4AA]/20 via-[#00D4AA]/30 to-[#00D4AA]/20 border-2 border-[#00D4AA] rounded-xl px-4 py-3 text-center w-full">
                        <p className="text-[#00D4AA] font-bold text-base">
                          💰 Pague agora para garantir seu horário!
                        </p>
                        <p className="text-[#00D4AA]/80 text-sm mt-1 font-semibold">
                          Total: R$ {totalPrice.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                      
                      {/* PIX Copia e Cola */}
                      <div className="flex items-center gap-3 sm:gap-4 p-3 rounded-xl border border-[#00D4AA]/30 bg-[#00D4AA]/5 w-full">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-medium text-[#00D4AA]">PIX Copia e Cola</h4>
                          <p className="text-sm text-muted-foreground">Clique para copiar o código com valor</p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => copyPixCode(totalPrice, selectedServices.map(s => s.name).join(", "))}
                          className="border-[#00D4AA]/30 hover:bg-[#00D4AA]/10 flex-shrink-0 text-[#00D4AA]"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copiar
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Dinheiro Option */}
                <div 
                  onClick={() => setSelectedPaymentMethod("dinheiro")}
                  className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedPaymentMethod === "dinheiro" 
                      ? "border-green-500 bg-green-500/10 ring-2 ring-green-500/30" 
                      : "border-green-500/30 bg-green-500/5 hover:bg-green-500/10"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedPaymentMethod === "dinheiro" ? "border-green-500 bg-green-500" : "border-muted-foreground"
                  }`}>
                    {selectedPaymentMethod === "dinheiro" && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0 p-1.5 sm:p-2 shadow-sm">
                    <img src={cashIcon} alt="Dinheiro" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-semibold text-foreground">Dinheiro</h4>
                    <p className="text-xs text-green-500">💵 Pague após o corte na barbearia</p>
                  </div>
                </div>

                {/* Cartão Option */}
                <div 
                  onClick={() => setSelectedPaymentMethod("cartao")}
                  className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedPaymentMethod === "cartao" 
                      ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30" 
                      : "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedPaymentMethod === "cartao" ? "border-blue-500 bg-blue-500" : "border-muted-foreground"
                  }`}>
                    {selectedPaymentMethod === "cartao" && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0 p-1.5 sm:p-2 shadow-sm">
                    <img src={cardIcon} alt="Cartão" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-semibold text-foreground">Cartão</h4>
                    <p className="text-xs text-blue-500">💳 Pague após o corte na barbearia</p>
                  </div>
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
                <p className="text-sm text-foreground mb-2 font-semibold">PIX Copia e Cola:</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-sm">Valor: R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyPixCode(totalPrice, selectedServices.map(s => s.name).join(", "))}
                    className="border-primary/30 hover:bg-primary/10"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copiar Código
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

      {/* Fixed Bottom Bar - Step 1 only - Only shows when services are selected */}
      {step === 1 && selectedServices.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] p-3 bg-background/95 backdrop-blur-lg border-t border-border shadow-2xl safe-bottom animate-in slide-in-from-bottom-4 duration-300">
          <div className="max-w-5xl mx-auto">
            <div className={`rounded-xl border p-3 ${
              usingSubscription 
                ? "bg-green-500/10 border-green-500/30" 
                : "bg-primary/10 border-primary/30"
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${
                    usingSubscription ? "bg-green-500/20" : "bg-primary/20"
                  }`}>
                    <Check className={`w-5 h-5 ${usingSubscription ? "text-green-500" : "text-primary"}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedServices.length} serviço(s) {usingSubscription && "- Assinatura"}
                    </p>
                    {usingSubscription ? (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground line-through">R$ {totalPrice.toFixed(2)}</p>
                        <p className="text-lg font-bold text-green-500">Grátis</p>
                      </div>
                    ) : (
                      <p className="text-lg font-bold text-primary">R$ {totalPrice.toFixed(2)}</p>
                    )}
                  </div>
                </div>
                <Button 
                  onClick={handleContinueToDate}
                  className={`font-semibold h-11 px-5 text-sm rounded-xl active:scale-[0.97] transition-transform flex-shrink-0 ${
                    usingSubscription 
                      ? "bg-green-500 hover:bg-green-600 text-background" 
                      : "bg-gold-gradient hover:opacity-90 text-background"
                  }`}
                >
                  Continuar
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
