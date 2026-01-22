import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { format, parseISO, subDays, subMonths, subYears, startOfWeek, startOfMonth, startOfYear, isAfter, addMonths, setDate, isBefore, isEqual, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Scissors, ChevronLeft, Check, X, Lock, Unlock, Users, Settings, BarChart3, RotateCcw, RefreshCw, MessageCircle, Image, History, UserCheck, Trophy, Download, CreditCard, Banknote, Filter, Crown, Trash2, Pencil, Save, XCircle, Bell, BellOff } from "lucide-react";
import { gsap } from "gsap";
import AnimatedBackground from "@/components/AnimatedBackground";
import AdminStatusToggle from "@/components/AdminStatusToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import logoImage from "@/assets/logo-barbershop.png";
import pixIcon from "@/assets/pix-icon.png";
import whatsappIcon from "@/assets/whatsapp-icon.svg";
import { AIAssistantPanel } from "@/components/AIAssistantPanel";
import { GalleryManager } from "@/components/GalleryManager";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { CustomerHistory } from "@/components/CustomerHistory";
import { ClientsList } from "@/components/ClientsList";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { getConfirmationMessage, getCancellationMessage, openWhatsApp } from "@/lib/whatsapp";
import LoyaltyProgramManager from "@/components/LoyaltyProgramManager";
import VIPPackagesManager from "@/components/VIPPackagesManager";
import { Input } from "@/components/ui/input";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useWebPush } from "@/hooks/useWebPush";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";


interface AppointmentService {
  name: string;
  price: number;
}

interface Appointment {
  id: string;
  user_id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  notes: string | null;
  profiles: {
    full_name: string | null;
    phone: string | null;
  } | null;
  services: AppointmentService[];
}

interface ActiveSubscription {
  user_id: string;
  package_name: string | null;
  monthly_cuts_limit: number;
  cuts_used_this_month: number;
  is_active: boolean;
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  blocked_time: string | null;
  reason: string | null;
}

interface RevenueAdjustment {
  id: string;
  appointment_id: string;
  original_value: number;
  adjusted_value: number;
  adjustment_reason: string | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  confirmed: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  completed: "bg-green-500/20 text-green-500 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-500 border-red-500/30",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

// Helper function to extract client name and phone from AI-generated notes
const extractClientInfoFromNotes = (notes: string | null): { name: string | null; phone: string | null } => {
  if (!notes) return { name: null, phone: null };
  
  // Pattern: "Cliente: Nome do Cliente | Tel: 123456789 | observações"
  const clientMatch = notes.match(/^Cliente:\s*([^|]+)/i);
  const phoneMatch = notes.match(/Tel:\s*([^|]+)/i);
  
  return {
    name: clientMatch ? clientMatch[1].trim() : null,
    phone: phoneMatch ? phoneMatch[1].trim() : null
  };
};

// Helper function to get client display info - prioritizes AI notes over profile
const getClientDisplayInfo = (appointment: Appointment): { name: string; phone: string } => {
  const notesInfo = extractClientInfoFromNotes(appointment.notes);
  
  return {
    name: notesInfo.name || appointment.profiles?.full_name || "Cliente",
    phone: notesInfo.phone || appointment.profiles?.phone || "Sem telefone"
  };
};

// Helper functions for services array
const getServicesNames = (services: AppointmentService[]): string => {
  if (!services || services.length === 0) return "Serviço";
  return services.map(s => s.name).join(", ");
};

const getServicesTotal = (services: AppointmentService[]): number => {
  if (!services || services.length === 0) return 0;
  return services.reduce((sum, s) => sum + (s.price || 0), 0);
};

// Helper function to get services total considering subscription (R$ 0 for subscriptions)
const getServicesTotalForRevenue = (services: AppointmentService[], paymentMethod: string | null): number => {
  if (paymentMethod === 'subscription') return 0;
  if (!services || services.length === 0) return 0;
  return services.reduce((sum, s) => sum + (s.price || 0), 0);
};

// Helper function to get payment method display info
const getPaymentMethodInfo = (method: string | null): { label: string; icon: "pix" | "cash" | "card"; color: string } => {
  switch (method) {
    case "pix":
      return { label: "PIX", icon: "pix", color: "text-[#00D4AA] bg-[#00D4AA]/10 border-[#00D4AA]/30" };
    case "dinheiro":
      return { label: "Dinheiro", icon: "cash", color: "text-green-500 bg-green-500/10 border-green-500/30" };
    case "cartao":
      return { label: "Cartão", icon: "card", color: "text-blue-500 bg-blue-500/10 border-blue-500/30" };
    case "subscription":
      return { label: "Assinatura", icon: "card", color: "text-amber-500 bg-amber-500/10 border-amber-500/30" };
    default:
      return { label: "PIX", icon: "pix", color: "text-[#00D4AA] bg-[#00D4AA]/10 border-[#00D4AA]/30" };
  }
};

const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => undefined);
    }

    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.9, audioContext.currentTime);
    masterGain.connect(audioContext.destination);

    // Melodia estilo "toque de telefone" - mais musical e chamativo
    const playNote = (freq: number, startTime: number, duration: number, volume = 0.8) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.type = "sine"; // Som mais suave e musical
      osc.frequency.setValueAtTime(freq, startTime);
      
      // Envelope suave
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
      gain.gain.setValueAtTime(volume, startTime + duration - 0.03);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);
      
      osc.connect(gain);
      gain.connect(masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const t = audioContext.currentTime;
    
    // Melodia: Dó-Mi-Sol-Dó (acorde maior ascendente) - som alegre e chamativo
    // Primeira sequência
    playNote(523.25, t + 0.0, 0.15, 0.9);   // C5
    playNote(659.25, t + 0.15, 0.15, 0.9);  // E5
    playNote(783.99, t + 0.30, 0.15, 0.9);  // G5
    playNote(1046.50, t + 0.45, 0.25, 1.0); // C6 (mais longo)
    
    // Pausa e repetição
    playNote(523.25, t + 0.85, 0.12, 0.8);  // C5
    playNote(659.25, t + 0.97, 0.12, 0.8);  // E5
    playNote(783.99, t + 1.09, 0.12, 0.8);  // G5
    playNote(1046.50, t + 1.21, 0.30, 1.0); // C6 (mais longo)

    setTimeout(() => {
      audioContext.close().catch(() => undefined);
    }, 2000);
  } catch (error) {
    console.log("Could not play notification sound:", error);
  }
};

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const { isEnabled: pushEnabled, isSupported: pushSupported, requestPermission, notifyNewAppointment } = usePushNotifications();
  const { isSupported: webPushSupported, isSubscribed: webPushSubscribed, isLoading: webPushLoading, toggleSubscription: toggleWebPush } = useWebPush();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState<ActiveSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterDate, setFilterDate] = useState<string>("");
  const [stats, setStats] = useState({ today: 0, pending: 0, confirmed: 0, revenue: 0 });
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isConnected, setIsConnected] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [blockDateInput, setBlockDateInput] = useState<string>("");
  const [blockTimeInput, setBlockTimeInput] = useState<string>("");
  const [statsPeriod, setStatsPeriod] = useState<string>("today");
  const [reportStartDate, setReportStartDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [reportEndDate, setReportEndDate] = useState<Date | undefined>(new Date());
  const [revenueAdjustments, setRevenueAdjustments] = useState<RevenueAdjustment[]>([]);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [cashClosingDay, setCashClosingDay] = useState<number>(15);
  const [editingClosingDay, setEditingClosingDay] = useState<boolean>(false);
  const [closingDayInput, setClosingDayInput] = useState<string>("15");

  // Helper function to check if user has active subscription
  const getUserSubscription = (userId: string): ActiveSubscription | null => {
    return activeSubscriptions.find(s => s.user_id === userId && s.is_active) || null;
  };

  // Check if subscription has remaining cuts
  const hasRemainingCuts = (subscription: ActiveSubscription | null): boolean => {
    if (!subscription) return false;
    return subscription.cuts_used_this_month < subscription.monthly_cuts_limit;
  };

  // Filter appointments by date range for reports
  const getFilteredAppointmentsForReports = useCallback(() => {
    if (!reportStartDate || !reportEndDate) return appointments;
    
    return appointments.filter(a => {
      const appointmentDate = parseISO(a.appointment_date);
      const afterStart = isAfter(appointmentDate, reportStartDate) || isEqual(appointmentDate, reportStartDate);
      const beforeEnd = isBefore(appointmentDate, reportEndDate) || isEqual(appointmentDate, reportEndDate);
      return afterStart && beforeEnd;
    });
  }, [appointments, reportStartDate, reportEndDate]);

  // Filter appointments by period for stats cards
  const getFilteredAppointmentsForStats = useCallback(() => {
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    
    switch (statsPeriod) {
      case "today":
        return appointments.filter(a => a.appointment_date === todayStr);
      case "7days":
        const start7 = subDays(now, 7);
        return appointments.filter(a => {
          const appointmentDate = parseISO(a.appointment_date);
          return isAfter(appointmentDate, start7) || isEqual(appointmentDate, start7);
        });
      case "30days":
        const start30 = subDays(now, 30);
        return appointments.filter(a => {
          const appointmentDate = parseISO(a.appointment_date);
          return isAfter(appointmentDate, start30) || isEqual(appointmentDate, start30);
        });
      default:
        return appointments.filter(a => a.appointment_date === todayStr);
    }
  }, [appointments, statsPeriod]);

  const filteredStatsAppointments = getFilteredAppointmentsForStats();

  const filteredReportAppointments = getFilteredAppointmentsForReports();

  // Manual refresh function
  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success("Dashboard atualizado!", { duration: 2000 });
  }, []);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error("Acesso negado", { description: "Você não tem permissão para acessar esta página." });
      navigate("/booking");
      return;
    }

    gsap.fromTo(".admin-container", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" });
    fetchData();

    // Set up realtime subscription for appointments
    const appointmentsChannel = supabase
      .channel('admin-appointments-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments'
        },
        (payload) => {
          setLastUpdate(new Date());
          // Refresh all data when any appointment changes
          fetchData(true);
          
          // Show notification and play sound for new appointments
          if (payload.eventType === 'INSERT') {
            playNotificationSound();
            toast.info("🔔 Novo agendamento!", { 
              description: "Um novo pedido foi recebido.",
              duration: 5000
            });
            // Send push notification (works even with tab minimized)
            const newRecord = payload.new as any;
            notifyNewAppointment(
              'Novo cliente',
              'Agendamento recebido',
              newRecord?.appointment_time?.slice(0, 5) || 'horário pendente'
            );
          } else if (payload.eventType === 'UPDATE') {
            toast.info("📝 Agendamento atualizado", { duration: 2000 });
          } else if (payload.eventType === 'DELETE') {
            toast.info("🗑️ Agendamento removido", { duration: 2000 });
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR') {
          console.error('Appointments channel error');
          toast.error("Erro na conexão real-time. Clique em Atualizar.");
        }
      });

    // Set up realtime subscription for blocked_dates
    const blockedDatesChannel = supabase
      .channel('admin-blocked-dates-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocked_dates'
        },
        (payload) => {
          setLastUpdate(new Date());
          fetchBlockedDates();
          
          if (payload.eventType === 'INSERT') {
            toast.info("🚫 Horário bloqueado", { duration: 2000 });
          } else if (payload.eventType === 'DELETE') {
            toast.info("✅ Horário desbloqueado", { duration: 2000 });
          }
        }
      )
      .subscribe();

    // Set up realtime subscription for barbershop_status
    const statusChannel = supabase
      .channel('admin-status-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'barbershop_status'
        },
        (payload) => {
          setLastUpdate(new Date());
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(blockedDatesChannel);
      supabase.removeChannel(statusChannel);
    };
  }, [isAdmin, authLoading, notifyNewAppointment]);

  const fetchData = async (showSyncing = false) => {
    if (showSyncing) setSyncing(true);
    try {
      await Promise.all([fetchAppointments(), fetchBlockedDates(), fetchStats(), fetchActiveSubscriptions(), fetchRevenueAdjustments(), fetchCashClosingDay()]);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      if (showSyncing) setSyncing(false);
    }
  };

  const fetchActiveSubscriptions = async () => {
    const { data, error } = await supabase
      .from("subscription_progress")
      .select("user_id, package_name, monthly_cuts_limit, cuts_used_this_month, is_active")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching subscriptions:", error);
      return;
    }

    setActiveSubscriptions(data || []);
  };

  const fetchAppointments = async () => {
    // Fetch appointments with primary service
    const { data: appointmentsData, error: appointmentsError } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        appointment_time,
        status,
        payment_status,
        payment_method,
        user_id,
        notes,
        service_id,
        services:service_id (
          name,
          price
        )
      `)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (appointmentsError) {
      console.error("Error fetching appointments:", appointmentsError);
      return;
    }

    if (!appointmentsData || appointmentsData.length === 0) {
      setAppointments([]);
      return;
    }

    // Get unique user_ids and appointment_ids
    const userIds = [...new Set(appointmentsData.map(a => a.user_id))];
    const appointmentIds = appointmentsData.map(a => a.id);

    // Fetch profiles for these users
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone")
      .in("user_id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
    }

    // Fetch additional services for these appointments via appointment_services
    const { data: appointmentServicesData, error: appointmentServicesError } = await supabase
      .from("appointment_services")
      .select(`
        appointment_id,
        services (
          name,
          price
        )
      `)
      .in("appointment_id", appointmentIds);

    if (appointmentServicesError) {
      console.error("Error fetching appointment services:", appointmentServicesError);
    }

    // Create a map of appointment_id to additional services array
    const additionalServicesMap = new Map<string, AppointmentService[]>();
    (appointmentServicesData || []).forEach(as => {
      const existing = additionalServicesMap.get(as.appointment_id) || [];
      if (as.services) {
        existing.push({
          name: (as.services as any).name,
          price: (as.services as any).price
        });
      }
      additionalServicesMap.set(as.appointment_id, existing);
    });

    // Create a map of user_id to profile
    const profilesMap = new Map(
      (profilesData || []).map(p => [p.user_id, { full_name: p.full_name, phone: p.phone }])
    );

    // Combine appointments with profiles and all services (primary + additional)
    const appointmentsWithData = appointmentsData.map(appointment => {
      const primaryService = appointment.services as any;
      const additionalServices = additionalServicesMap.get(appointment.id) || [];
      
      // Build full services array: primary service first, then additional
      const allServices: AppointmentService[] = [];
      if (primaryService && primaryService.name) {
        allServices.push({
          name: primaryService.name,
          price: primaryService.price || 0
        });
      }
      allServices.push(...additionalServices);

      return {
        ...appointment,
        profiles: profilesMap.get(appointment.user_id) || null,
        services: allServices,
      };
    });

    // Sort: active appointments first (by date/time ascending), then completed/cancelled at the end
    const sortedAppointments = (appointmentsWithData as Appointment[]).sort((a, b) => {
      const completedStatuses = ['completed', 'cancelled'];
      const aIsCompleted = completedStatuses.includes(a.status);
      const bIsCompleted = completedStatuses.includes(b.status);
      
      // If one is completed and the other isn't, put completed at the end
      if (aIsCompleted && !bIsCompleted) return 1;
      if (!aIsCompleted && bIsCompleted) return -1;
      
      // Both same category: sort by date then time ascending
      const dateCompare = a.appointment_date.localeCompare(b.appointment_date);
      if (dateCompare !== 0) return dateCompare;
      return a.appointment_time.localeCompare(b.appointment_time);
    });

    setAppointments(sortedAppointments);
  };

  const fetchBlockedDates = async () => {
    const { data, error } = await supabase
      .from("blocked_dates")
      .select("*")
      .order("blocked_date", { ascending: true });

    if (!error && data) {
      setBlockedDates(data);
    }
  };

  const fetchStats = async () => {
    const today = format(new Date(), "yyyy-MM-dd");

    const { data: todayData } = await supabase
      .from("appointments")
      .select("id")
      .eq("appointment_date", today)
      .neq("status", "cancelled")
      .neq("status", "archived");

    const { data: pendingData } = await supabase
      .from("appointments")
      .select("id")
      .eq("status", "pending");

    // Count all confirmed appointments (excluding subscriptions for revenue)
    const { data: confirmedData } = await supabase
      .from("appointments")
      .select("services(price), payment_method")
      .eq("status", "confirmed");

    // Count completed appointments for revenue (excluding subscriptions)
    const { data: completedData } = await supabase
      .from("appointments")
      .select("services(price), payment_method")
      .eq("status", "completed");

    // Exclude subscription appointments from revenue calculation
    const confirmedRevenue = confirmedData?.reduce((sum, a) => sum + (a.payment_method === 'subscription' ? 0 : (a.services?.price || 0)), 0) || 0;
    const completedRevenue = completedData?.reduce((sum, a) => sum + (a.payment_method === 'subscription' ? 0 : (a.services?.price || 0)), 0) || 0;
    const totalRevenue = confirmedRevenue + completedRevenue;

    setStats({
      today: todayData?.length || 0,
      pending: pendingData?.length || 0,
      confirmed: confirmedData?.length || 0,
      revenue: totalRevenue,
    });
  };

  const fetchRevenueAdjustments = async () => {
    const { data, error } = await supabase
      .from("revenue_adjustments")
      .select("*");

    if (!error && data) {
      setRevenueAdjustments(data as RevenueAdjustment[]);
    }
  };

  const fetchCashClosingDay = async () => {
    const { data, error } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "cash_closing_day")
      .single();

    if (!error && data) {
      const day = parseInt(data.setting_value, 10);
      if (!isNaN(day) && day >= 1 && day <= 28) {
        setCashClosingDay(day);
        setClosingDayInput(day.toString());
      }
    }
  };

  const saveCashClosingDay = async (day: number) => {
    if (day < 1 || day > 28) {
      toast.error("O dia deve ser entre 1 e 28");
      return;
    }

    const { error } = await supabase
      .from("admin_settings")
      .upsert({
        setting_key: "cash_closing_day",
        setting_value: day.toString(),
        description: "Dia do mês para fechamento de caixa"
      }, { onConflict: 'setting_key' });

    if (error) {
      console.error("Error saving closing day:", error);
      toast.error("Erro ao salvar dia de fechamento");
      return;
    }

    setCashClosingDay(day);
    setEditingClosingDay(false);
    toast.success(`Dia de fechamento atualizado para dia ${day}`);
  };

  // Calculate the current billing period based on cash closing day
  const getCurrentBillingPeriod = useCallback(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // If we're past the closing day, period starts on closing_day + 1 of current month
    // If we're before or on closing day, period started on closing_day + 1 of previous month
    let startDate: Date;
    let endDate: Date;

    if (currentDay > cashClosingDay) {
      // Period: (closing_day + 1) of current month to closing_day of next month
      startDate = new Date(currentYear, currentMonth, cashClosingDay + 1);
      endDate = new Date(currentYear, currentMonth + 1, cashClosingDay);
    } else {
      // Period: (closing_day + 1) of previous month to closing_day of current month
      startDate = new Date(currentYear, currentMonth - 1, cashClosingDay + 1);
      endDate = new Date(currentYear, currentMonth, cashClosingDay);
    }

    return { startDate, endDate };
  }, [cashClosingDay]);

  // Get adjusted value for an appointment
  const getAdjustedValue = (appointmentId: string, originalValue: number): number => {
    const adjustment = revenueAdjustments.find(a => a.appointment_id === appointmentId);
    return adjustment ? adjustment.adjusted_value : originalValue;
  };

  // Save revenue adjustment
  const saveRevenueAdjustment = async (appointmentId: string, originalValue: number, adjustedValue: number) => {
    const { error } = await supabase
      .from("revenue_adjustments")
      .upsert({
        appointment_id: appointmentId,
        original_value: originalValue,
        adjusted_value: adjustedValue,
        updated_at: new Date().toISOString()
      }, { onConflict: 'appointment_id' });

    if (error) {
      console.error("Error saving adjustment:", error);
      toast.error("Erro ao salvar ajuste");
      return;
    }

    toast.success("Valor atualizado com sucesso!");
    setEditingAppointmentId(null);
    setEditValue("");
    fetchRevenueAdjustments();
  };

  const updateAppointmentStatus = async (id: string, status: string) => {
    // Get appointment details for notification
    const appointment = appointments.find(a => a.id === id);
    
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    // Criar notificação push interna e WhatsApp quando confirmar ou cancelar
    if ((status === "confirmed" || status === "cancelled") && appointment) {
      const { data: appointmentData } = await supabase
        .from("appointments")
        .select("user_id, appointment_date, appointment_time, services(name, price)")
        .eq("id", id)
        .single();

      if (appointmentData) {
        const dateFormatted = format(parseISO(appointmentData.appointment_date), "dd/MM/yyyy", { locale: ptBR });
        const timeFormatted = appointmentData.appointment_time.slice(0, 5);
        const serviceName = appointmentData.services?.name || "Serviço";
        const servicePrice = appointmentData.services?.price || 0;
        const clientInfo = getClientDisplayInfo(appointment);

        const title = status === "confirmed" 
          ? "Agendamento Confirmado! ✓" 
          : "Agendamento Cancelado";
        
        const message = status === "confirmed"
          ? `Seu agendamento de ${serviceName} para ${dateFormatted} às ${timeFormatted} foi confirmado! Valor: R$ ${servicePrice.toFixed(2)}`
          : `Seu agendamento de ${serviceName} para ${dateFormatted} às ${timeFormatted} foi cancelado.`;

        // Criar notificação interna
        await supabase.from("notifications").insert({
          user_id: appointmentData.user_id,
          title,
          message,
          type: status,
          appointment_id: id
        });

        // WhatsApp manual - usar botão ao lado do agendamento
      }
    }

    toast.success(`Status atualizado para ${statusLabels[status]}`);
    fetchData();
  };

  const updatePaymentStatus = async (id: string, payment_status: string) => {
    // Sync payment_method with payment_status
    let payment_method: string | undefined;
    if (payment_status === 'paid_pix') {
      payment_method = 'pix';
    } else if (payment_status === 'paid_cash') {
      payment_method = 'dinheiro';
    } else if (payment_status === 'paid_card') {
      payment_method = 'cartao';
    }

    const updateData: { payment_status: string; payment_method?: string } = { payment_status };
    if (payment_method) {
      updateData.payment_method = payment_method;
    }

    const { error } = await supabase
      .from("appointments")
      .update(updateData)
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar pagamento");
      return;
    }

    toast.success("Pagamento atualizado");
    fetchData();
  };

  const deleteAppointment = async (id: string) => {
    // First delete related appointment_services
    const { error: servicesError } = await supabase
      .from("appointment_services")
      .delete()
      .eq("appointment_id", id);

    if (servicesError) {
      console.error("Error deleting appointment services:", servicesError);
    }

    // Then delete the appointment itself
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir agendamento");
      return;
    }

    toast.success("Agendamento excluído com sucesso");
    fetchData();
  };

  const blockDate = async (date: string, time?: string) => {
    if (!date) {
      toast.error("Selecione uma data para bloquear");
      return;
    }

    // Verificar se já existe bloqueio para esta data/horário
    const existingBlock = blockedDates.find(
      b => b.blocked_date === date && b.blocked_time === (time ? `${time}:00` : null)
    );

    if (existingBlock) {
      toast.error("Este horário já está bloqueado");
      return;
    }

    const { error } = await supabase
      .from("blocked_dates")
      .insert({ blocked_date: date, blocked_time: time || null });

    if (error) {
      console.error("Erro ao bloquear:", error);
      toast.error("Erro ao bloquear data/horário");
      return;
    }

    toast.success(time ? "Horário bloqueado" : "Data bloqueada");
    setBlockDateInput("");
    setBlockTimeInput("");
    fetchBlockedDates();
  };

  const unblockDate = async (id: string) => {
    const { error } = await supabase
      .from("blocked_dates")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao desbloquear");
      return;
    }

    toast.success("Desbloqueado com sucesso");
    fetchBlockedDates();
  };

  const unblockAllDates = async () => {
    const { error } = await supabase
      .from("blocked_dates")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all rows

    if (error) {
      toast.error("Erro ao desbloquear horários");
      console.error("Error unblocking all:", error);
      return;
    }

    toast.success("Todos os horários foram desbloqueados!");
    fetchBlockedDates();
  };

  const resetStats = async () => {
    setLoading(true);
    
    try {
      // Get current admin user id to exclude from deletion
      const { data: { user } } = await supabase.auth.getUser();
      const adminUserId = user?.id;

      // DELETE ALL appointments permanently
      const { error: appointmentsError } = await supabase
        .from("appointments")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (appointmentsError) {
        console.error("Error deleting appointments:", appointmentsError);
        toast.error("Erro ao deletar agendamentos");
        setLoading(false);
        return;
      }

      // DELETE ALL blocked dates
      const { error: blockedError } = await supabase
        .from("blocked_dates")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (blockedError) {
        console.error("Error deleting blocked dates:", blockedError);
      }

      // DELETE ALL notifications
      const { error: notificationsError } = await supabase
        .from("notifications")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (notificationsError) {
        console.error("Error deleting notifications:", notificationsError);
      }

      // DELETE ALL reviews
      const { error: reviewsError } = await supabase
        .from("reviews")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (reviewsError) {
        console.error("Error deleting reviews:", reviewsError);
      }

      // DELETE ALL profiles EXCEPT admin
      if (adminUserId) {
        const { error: profilesError } = await supabase
          .from("profiles")
          .delete()
          .neq("user_id", adminUserId);

        if (profilesError) {
          console.error("Error deleting profiles:", profilesError);
        }

        // DELETE ALL user roles EXCEPT admin
        const { error: rolesError } = await supabase
          .from("user_roles")
          .delete()
          .neq("user_id", adminUserId);

        if (rolesError) {
          console.error("Error deleting user roles:", rolesError);
        }
      }

      toast.success("Painel resetado!", { 
        description: "Todos os dados foram excluídos permanentemente." 
      });
      fetchData();
    } catch (error) {
      console.error("Reset error:", error);
      toast.error("Erro ao resetar painel");
    } finally {
      setLoading(false);
    }
  };

  const filteredAppointments = appointments.filter((a) => {
    if (!filterDate) return true;
    return a.appointment_date === filterDate;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden safe-bottom">
      <AnimatedBackground />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 max-w-7xl mx-auto safe-top">
        <Button variant="ghost" onClick={() => navigate("/booking")} className="text-foreground hover:text-primary px-2 sm:px-4 touch-target">
          <ChevronLeft className="w-5 h-5 sm:mr-2" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>
        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationsDropdown />
          <img src={logoImage} alt="Natan Barbershop" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-primary/30" />
          <Badge className="bg-primary/20 text-primary border-primary/30 text-xs sm:text-sm">Admin</Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="admin-container relative z-10 px-3 sm:px-4 py-4 sm:py-6 max-w-7xl mx-auto pb-8">
        <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 sm:gap-3">
            <h1 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Painel Admin</h1>
            <div className="flex items-center gap-2 self-start xs:self-auto">
              {syncing ? (
                <>
                  <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-primary font-medium">Sincronizando...</span>
                </>
              ) : (
                <>
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-xs text-muted-foreground">
                    {isConnected ? 'Sincronizado' : 'Desconectado'}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="w-full">
            <AdminStatusToggle />
          </div>
        </div>
        
        {/* Last update indicator */}
        <div className="text-xs text-muted-foreground mb-3 sm:mb-4 flex items-center gap-2">
          <Clock className="w-3 h-3" />
          Atualizado: {format(lastUpdate, "HH:mm:ss", { locale: ptBR })}
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="border-primary/30 hover:bg-primary/10 h-9 text-xs sm:text-sm touch-target flex-1 xs:flex-none"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            {/* Web Push Notifications Button (works when PWA is closed) */}
            {webPushSupported && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleWebPush}
                disabled={webPushLoading}
                className={cn(
                  "h-9 text-xs sm:text-sm touch-target",
                  webPushSubscribed 
                    ? "border-green-500/50 text-green-500 hover:bg-green-500/10" 
                    : "border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                )}
                title={webPushSubscribed ? "Push ativo (funciona com app fechado)" : "Ativar notificações push"}
              >
                {webPushLoading ? (
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : webPushSubscribed ? (
                  <>
                    <Bell className="w-4 h-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Push Ativo</span>
                  </>
                ) : (
                  <>
                    <BellOff className="w-4 h-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Ativar Push</span>
                  </>
                )}
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-destructive/50 text-destructive hover:bg-destructive/10 h-9 text-xs sm:text-sm touch-target"
                  disabled={appointments.filter(a => a.status !== "archived").length === 0}
                >
                  <RotateCcw className="w-4 h-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Reset</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-destructive/20 mx-3 max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive text-base sm:text-lg">⚠️ Resetar Sistema</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm max-h-[50vh] overflow-y-auto">
                    Isso vai <strong>EXCLUIR PERMANENTEMENTE</strong> todos os dados:
                    <br /><br />
                    • {stats.pending} pendentes, {appointments.filter(a => a.status === "confirmed").length} confirmados
                    <br />
                    • Receita perdida: R$ {stats.revenue.toFixed(2)}
                    <br />
                    • Clientes, notificações, avaliações
                    <br /><br />
                    <strong className="text-destructive">Esta ação NÃO pode ser desfeita!</strong>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={resetStats}
                    className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto"
                  >
                    Confirmar Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h2 className="text-sm sm:text-base font-semibold text-foreground">Resumo Financeiro</h2>
          <Select value={statsPeriod} onValueChange={setStatsPeriod}>
            <SelectTrigger className="w-[160px] h-8 text-xs border-primary/30 bg-card/60">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
            <CardContent className="p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  {filteredStatsAppointments.filter(a => a.status !== 'cancelled').length}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {statsPeriod === 'today' ? 'Hoje' : statsPeriod === '7days' ? '7 dias' : '30 dias'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-yellow-500/20">
            <CardContent className="p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  {filteredStatsAppointments.filter(a => a.status === 'pending').length}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Pendentes</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-blue-500/20">
            <CardContent className="p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  {filteredStatsAppointments.filter(a => a.status === 'confirmed' || a.status === 'completed').length}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Confirmados</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
            <CardContent className="p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-base sm:text-xl font-bold text-primary">
                  R$ {filteredStatsAppointments
                    .filter(a => (a.status === 'confirmed' || a.status === 'completed') && a.payment_method !== 'subscription')
                    .reduce((sum, a) => sum + getServicesTotal(a.services), 0)
                    .toFixed(0)}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Receita</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="appointments" className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto pb-3 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
            <TabsList className="bg-card/60 backdrop-blur-xl border border-primary/20 inline-flex w-max sm:w-auto gap-1 p-1.5 rounded-xl">
              <TabsTrigger value="appointments" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm rounded-lg whitespace-nowrap transition-all touch-target" title="Agendamentos">
                <Scissors className="w-4 h-4" />
                <span>Agenda</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm rounded-lg whitespace-nowrap transition-all touch-target" title="Relatórios">
                <BarChart3 className="w-4 h-4" />
                <span>Relatórios</span>
              </TabsTrigger>
              <TabsTrigger value="ai-assistant" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm rounded-lg whitespace-nowrap transition-all touch-target" title="Assistente IA">
                <img src={whatsappIcon} alt="WhatsApp" className="w-4 h-4" />
                <span>IA</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm rounded-lg whitespace-nowrap transition-all touch-target" title="Horários">
                <Lock className="w-4 h-4" />
                <span>Horários</span>
              </TabsTrigger>
              <TabsTrigger value="gallery" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm rounded-lg whitespace-nowrap transition-all touch-target" title="Galeria">
                <Image className="w-4 h-4" />
                <span>Galeria</span>
              </TabsTrigger>
              <TabsTrigger value="clients" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm rounded-lg whitespace-nowrap transition-all touch-target" title="Clientes">
                <UserCheck className="w-4 h-4" />
                <span>Clientes</span>
              </TabsTrigger>
              <TabsTrigger value="loyalty" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm rounded-lg whitespace-nowrap transition-all touch-target" title="Fidelidade">
                <Trophy className="w-4 h-4" />
                <span>Fidelidade</span>
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm rounded-lg whitespace-nowrap transition-all touch-target" title="Assinaturas">
                <Crown className="w-4 h-4" />
                <span>Assinat.</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
              <CardHeader className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Resumo Financeiro
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        import('jspdf').then(({ jsPDF }) => {
                          const doc = new jsPDF();
                          const paidAppointments = filteredReportAppointments.filter(a => 
                            a.payment_status === 'paid_pix' || a.payment_status === 'paid_cash' || a.payment_status === 'paid_card' || a.payment_status === 'paid'
                          );
                          const pixTotal = filteredReportAppointments
                            .filter(a => a.payment_status === 'paid_pix' && a.payment_method !== 'subscription')
                            .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0);
                          const cashTotal = filteredReportAppointments
                            .filter(a => a.payment_status === 'paid_cash' && a.payment_method !== 'subscription')
                            .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0);
                          const cardTotal = filteredReportAppointments
                            .filter(a => a.payment_status === 'paid_card' && a.payment_method !== 'subscription')
                            .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0);
                          const totalReceived = pixTotal + cashTotal + cardTotal;
                          
                          const periodLabel = reportStartDate && reportEndDate 
                            ? `${format(reportStartDate, "dd/MM/yyyy")} a ${format(reportEndDate, "dd/MM/yyyy")}`
                            : 'Período selecionado';
                          
                          // Header
                          doc.setFontSize(20);
                          doc.setTextColor(218, 165, 32);
                          doc.text('Relatório Financeiro', 105, 20, { align: 'center' });
                          
                          doc.setFontSize(12);
                          doc.setTextColor(100);
                          doc.text('Natan Barber', 105, 28, { align: 'center' });
                          
                          doc.setFontSize(10);
                          doc.text(`Período: ${periodLabel}`, 105, 36, { align: 'center' });
                          doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 105, 42, { align: 'center' });
                          
                          // Summary section
                          doc.setFontSize(14);
                          doc.setTextColor(0);
                          doc.text('Resumo por Método de Pagamento', 20, 55);
                          
                          doc.setFontSize(11);
                          let yPos = 65;
                          doc.text(`PIX: R$ ${pixTotal.toFixed(2)}`, 25, yPos);
                          yPos += 8;
                          doc.text(`Dinheiro: R$ ${cashTotal.toFixed(2)}`, 25, yPos);
                          yPos += 8;
                          doc.text(`Cartão: R$ ${cardTotal.toFixed(2)}`, 25, yPos);
                          yPos += 10;
                          doc.setFontSize(12);
                          doc.setTextColor(218, 165, 32);
                          doc.text(`Total Recebido: R$ ${totalReceived.toFixed(2)}`, 25, yPos);
                          
                          // Transactions table
                          yPos += 20;
                          doc.setFontSize(14);
                          doc.setTextColor(0);
                          doc.text('Detalhamento', 20, yPos);
                          
                          yPos += 10;
                          doc.setFontSize(9);
                          doc.setTextColor(100);
                          doc.text('Data', 20, yPos);
                          doc.text('Cliente', 45, yPos);
                          doc.text('Serviço', 95, yPos);
                          doc.text('Valor', 145, yPos);
                          doc.text('Pagamento', 170, yPos);
                          
                          yPos += 5;
                          doc.setDrawColor(200);
                          doc.line(20, yPos, 190, yPos);
                          
                          doc.setTextColor(0);
                          paidAppointments.slice(0, 30).forEach(a => {
                            yPos += 7;
                            if (yPos > 270) {
                              doc.addPage();
                              yPos = 20;
                            }
                            const isSubscription = a.payment_method === 'subscription';
                            const value = isSubscription ? 0 : getAdjustedValue(a.id, getServicesTotal(a.services));
                            const paymentLabel = a.payment_status === 'paid_pix' ? 'PIX' : a.payment_status === 'paid_cash' ? 'Dinheiro' : a.payment_status === 'paid_card' ? 'Cartão' : 'Pago';
                            
                            doc.text(format(parseISO(a.appointment_date), "dd/MM/yy"), 20, yPos);
                            doc.text((a.profiles?.full_name || 'N/A').substring(0, 20), 45, yPos);
                            doc.text(getServicesNames(a.services).substring(0, 25), 95, yPos);
                            doc.text(`R$ ${value.toFixed(2)}`, 145, yPos);
                            doc.text(paymentLabel, 170, yPos);
                          });
                          
                          if (paidAppointments.length > 30) {
                            yPos += 10;
                            doc.setTextColor(100);
                            doc.text(`... e mais ${paidAppointments.length - 30} transações`, 20, yPos);
                          }
                          
                          doc.save(`relatorio-financeiro-${format(reportStartDate || new Date(), "yyyy-MM-dd")}.pdf`);
                          toast.success("PDF exportado com sucesso!");
                        });
                      }}
                      className="border-red-500/30 hover:bg-red-500/10 text-red-400"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      PDF
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        import('xlsx').then((XLSX) => {
                          const paidAppointments = filteredReportAppointments.filter(a => 
                            a.payment_status === 'paid_pix' || a.payment_status === 'paid_cash' || a.payment_status === 'paid_card' || a.payment_status === 'paid'
                          );
                          const pixTotal = filteredReportAppointments
                            .filter(a => a.payment_status === 'paid_pix' && a.payment_method !== 'subscription')
                            .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0);
                          const cashTotal = filteredReportAppointments
                            .filter(a => a.payment_status === 'paid_cash' && a.payment_method !== 'subscription')
                            .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0);
                          const cardTotal = filteredReportAppointments
                            .filter(a => a.payment_status === 'paid_card' && a.payment_method !== 'subscription')
                            .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0);
                          const pendingTotal = filteredReportAppointments
                            .filter(a => a.payment_status === 'pending' && a.payment_method !== 'subscription')
                            .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0);
                          
                          const periodLabel = reportStartDate && reportEndDate 
                            ? `${format(reportStartDate, "dd/MM/yyyy")} a ${format(reportEndDate, "dd/MM/yyyy")}`
                            : 'Período selecionado';
                          
                          // Summary sheet data
                          const summaryData = [
                            ['Relatório Financeiro - Natan Barber'],
                            [`Período: ${periodLabel}`],
                            [`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`],
                            [],
                            ['RESUMO POR MÉTODO'],
                            ['PIX', `R$ ${pixTotal.toFixed(2)}`],
                            ['Dinheiro', `R$ ${cashTotal.toFixed(2)}`],
                            ['Cartão', `R$ ${cardTotal.toFixed(2)}`],
                            ['Total Recebido', `R$ ${(pixTotal + cashTotal + cardTotal).toFixed(2)}`],
                            [],
                            ['Aguardando Pagamento', `R$ ${pendingTotal.toFixed(2)}`],
                          ];
                          
                          // Transactions sheet data
                          const transactionsData = [
                            ['Data', 'Horário', 'Cliente', 'Serviço', 'Valor Original', 'Valor Ajustado', 'Pagamento', 'Tipo'],
                            ...paidAppointments.map(a => {
                              const isSubscription = a.payment_method === 'subscription';
                              const originalValue = isSubscription ? 0 : getServicesTotal(a.services);
                              const adjustedValue = isSubscription ? 0 : getAdjustedValue(a.id, originalValue);
                              const paymentLabel = a.payment_status === 'paid_pix' ? 'PIX' : a.payment_status === 'paid_cash' ? 'Dinheiro' : a.payment_status === 'paid_card' ? 'Cartão' : 'Pago';
                              return [
                                format(parseISO(a.appointment_date), "dd/MM/yyyy"),
                                a.appointment_time.slice(0, 5),
                                a.profiles?.full_name || 'N/A',
                                getServicesNames(a.services),
                                `R$ ${originalValue.toFixed(2)}`,
                                `R$ ${adjustedValue.toFixed(2)}`,
                                paymentLabel,
                                isSubscription ? 'Assinatura' : 'Avulso'
                              ];
                            })
                          ];
                          
                          const wb = XLSX.utils.book_new();
                          const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
                          const wsTransactions = XLSX.utils.aoa_to_sheet(transactionsData);
                          
                          // Set column widths
                          wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }];
                          wsTransactions['!cols'] = [
                            { wch: 12 }, { wch: 8 }, { wch: 25 }, { wch: 30 }, 
                            { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }
                          ];
                          
                          XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');
                          XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transações');
                          
                          XLSX.writeFile(wb, `relatorio-financeiro-${format(reportStartDate || new Date(), "yyyy-MM-dd")}.xlsx`);
                          toast.success("Excel exportado com sucesso!");
                        });
                      }}
                      className="border-green-500/30 hover:bg-green-500/10 text-green-400"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Excel
                    </Button>
                  </div>
                </div>
                
                {/* Date Range Picker */}
                <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border border-primary/10">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Período:</span>
                  </div>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 border-primary/30 bg-card/60 gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {reportStartDate ? format(reportStartDate, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[100] bg-card border border-primary/20" align="start">
                      <Calendar
                        mode="single"
                        selected={reportStartDate}
                        onSelect={setReportStartDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <span className="text-sm text-muted-foreground">até</span>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 border-primary/30 bg-card/60 gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {reportEndDate ? format(reportEndDate, "dd/MM/yyyy", { locale: ptBR }) : "Data final"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[100] bg-card border border-primary/20" align="start">
                      <Calendar
                        mode="single"
                        selected={reportEndDate}
                        onSelect={setReportEndDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  {/* Quick Filters */}
                  <div className="flex flex-wrap gap-1 ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => {
                        // Find earliest appointment date or default to 1 year ago
                        const earliestDate = appointments.length > 0 
                          ? appointments.reduce((earliest, a) => {
                              const date = parseISO(a.appointment_date);
                              return date < earliest ? date : earliest;
                            }, parseISO(appointments[0].appointment_date))
                          : subYears(new Date(), 1);
                        setReportStartDate(earliestDate);
                        setReportEndDate(new Date());
                      }}
                    >
                      Todo Período
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => {
                        setReportStartDate(new Date());
                        setReportEndDate(new Date());
                      }}
                    >
                      Hoje
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => {
                        setReportStartDate(subDays(new Date(), 7));
                        setReportEndDate(new Date());
                      }}
                    >
                      7 dias
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => {
                        setReportStartDate(subDays(new Date(), 30));
                        setReportEndDate(new Date());
                      }}
                    >
                      30 dias
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => {
                        // Billing period based on cash closing day
                        const now = new Date();
                        const currentDay = now.getDate();
                        const currentMonth = now.getMonth();
                        const currentYear = now.getFullYear();

                        if (currentDay > cashClosingDay) {
                          setReportStartDate(new Date(currentYear, currentMonth, cashClosingDay + 1));
                          setReportEndDate(new Date(currentYear, currentMonth + 1, cashClosingDay));
                        } else {
                          setReportStartDate(new Date(currentYear, currentMonth - 1, cashClosingDay + 1));
                          setReportEndDate(new Date(currentYear, currentMonth, cashClosingDay));
                        }
                      }}
                    >
                      Fechamento
                    </Button>
                  </div>
                </div>
                
                {/* Period info */}
                {reportStartDate && reportEndDate && (
                  <p className="text-xs text-muted-foreground">
                    Mostrando {filteredReportAppointments.length} agendamento(s) de {format(reportStartDate, "dd/MM/yyyy")} a {format(reportEndDate, "dd/MM/yyyy")}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {/* PIX Total */}
                  <Card className="bg-[#00D4AA]/10 border-[#00D4AA]/30">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#00D4AA]/20 flex items-center justify-center">
                        <img src={pixIcon} alt="PIX" className="w-7 h-7 object-contain" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-[#00D4AA]">
                          R$ {filteredReportAppointments
                            .filter(a => a.payment_status === 'paid_pix' && a.payment_method !== 'subscription')
                            .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0)
                            .toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Recebido via PIX</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Dinheiro Total */}
                  <Card className="bg-green-500/10 border-green-500/30">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Banknote className="w-6 h-6 text-green-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-500">
                          R$ {filteredReportAppointments
                            .filter(a => a.payment_status === 'paid_cash' && a.payment_method !== 'subscription')
                            .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0)
                            .toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Recebido Dinheiro</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Cartão Total */}
                  <Card className="bg-blue-500/10 border-blue-500/30">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-500">
                          R$ {filteredReportAppointments
                            .filter(a => a.payment_status === 'paid_card' && a.payment_method !== 'subscription')
                            .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0)
                            .toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Recebido Cartão</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Aguardando */}
                  <Card className="bg-yellow-500/10 border-yellow-500/30">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-yellow-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-yellow-500">
                          R$ {filteredReportAppointments
                            .filter(a => a.payment_status === 'pending' && a.payment_method !== 'subscription')
                            .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0)
                            .toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Aguardando</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Total Geral */}
                  <Card className="bg-primary/10 border-primary/30">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <BarChart3 className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-primary">
                          R$ {filteredReportAppointments
                            .filter(a => (a.payment_status === 'paid_pix' || a.payment_status === 'paid_cash' || a.payment_status === 'paid_card' || a.payment_status === 'paid') && a.payment_method !== 'subscription')
                            .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0)
                            .toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Recebido</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Charts Section */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Pie Chart */}
                  <Card className="bg-card/60 border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Distribuição por Método</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const pixTotal = filteredReportAppointments
                          .filter(a => a.payment_status === 'paid_pix' && a.payment_method !== 'subscription')
                          .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0);
                        const cashTotal = filteredReportAppointments
                          .filter(a => a.payment_status === 'paid_cash' && a.payment_method !== 'subscription')
                          .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0);
                        const cardTotal = filteredReportAppointments
                          .filter(a => a.payment_status === 'paid_card' && a.payment_method !== 'subscription')
                          .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0);
                        const total = pixTotal + cashTotal + cardTotal;
                        
                        if (total === 0) {
                          return (
                            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                              Nenhum pagamento registrado
                            </div>
                          );
                        }
                        
                        const pixPercent = Math.round((pixTotal / total) * 100);
                        const cashPercent = Math.round((cashTotal / total) * 100);
                        const cardPercent = 100 - pixPercent - cashPercent;
                        
                        return (
                          <div className="flex items-center gap-6">
                            {/* Donut Chart */}
                            <div className="relative w-32 h-32 flex-shrink-0">
                              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                <circle
                                  cx="18"
                                  cy="18"
                                  r="15.915"
                                  fill="transparent"
                                  stroke="hsl(142, 76%, 36%)"
                                  strokeWidth="3"
                                  strokeDasharray={`${cashPercent} ${100 - cashPercent}`}
                                  strokeDashoffset="0"
                                />
                                <circle
                                  cx="18"
                                  cy="18"
                                  r="15.915"
                                  fill="transparent"
                                  stroke="hsl(217, 91%, 60%)"
                                  strokeWidth="3"
                                  strokeDasharray={`${cardPercent} ${100 - cardPercent}`}
                                  strokeDashoffset={`-${cashPercent}`}
                                />
                                <circle
                                  cx="18"
                                  cy="18"
                                  r="15.915"
                                  fill="transparent"
                                  stroke="hsl(166, 100%, 42%)"
                                  strokeWidth="3"
                                  strokeDasharray={`${pixPercent} ${100 - pixPercent}`}
                                  strokeDashoffset={`-${cashPercent + cardPercent}`}
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <p className="text-lg font-bold text-foreground">R$ {total.toFixed(0)}</p>
                                <p className="text-[10px] text-muted-foreground">Total</p>
                              </div>
                            </div>
                            
                            {/* Legend */}
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#00D4AA]" />
                                <div>
                                  <p className="text-sm font-medium">PIX</p>
                                  <p className="text-xs text-muted-foreground">R$ {pixTotal.toFixed(2)} ({pixPercent}%)</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                <div>
                                  <p className="text-sm font-medium">Dinheiro</p>
                                  <p className="text-xs text-muted-foreground">R$ {cashTotal.toFixed(2)} ({cashPercent}%)</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500" />
                                <div>
                                  <p className="text-sm font-medium">Cartão</p>
                                  <p className="text-xs text-muted-foreground">R$ {cardTotal.toFixed(2)} ({cardPercent}%)</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                  
                  {/* Bar Chart */}
                  <Card className="bg-card/60 border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Comparativo de Valores</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const pixTotal = filteredReportAppointments
                          .filter(a => a.payment_status === 'paid_pix' && a.payment_method !== 'subscription')
                          .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0);
                        const cashTotal = filteredReportAppointments
                          .filter(a => a.payment_status === 'paid_cash' && a.payment_method !== 'subscription')
                          .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0);
                        const cardTotal = filteredReportAppointments
                          .filter(a => a.payment_status === 'paid_card' && a.payment_method !== 'subscription')
                          .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0);
                        const pendingTotal = filteredReportAppointments
                          .filter(a => a.payment_status === 'pending' && a.payment_method !== 'subscription')
                          .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method)), 0);
                        const maxValue = Math.max(pixTotal, cashTotal, cardTotal, pendingTotal, 1);
                        
                        return (
                          <div className="space-y-3">
                            {/* PIX Bar */}
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="flex items-center gap-2">
                                  <img src={pixIcon} alt="PIX" className="w-4 h-4 object-contain" />
                                  PIX
                                </span>
                                <span className="font-medium">R$ {pixTotal.toFixed(2)}</span>
                              </div>
                              <div className="h-4 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-[#00D4AA] rounded-full transition-all duration-500"
                                  style={{ width: `${(pixTotal / maxValue) * 100}%` }}
                                />
                              </div>
                            </div>
                            
                            {/* Dinheiro Bar */}
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="flex items-center gap-2">
                                  <Banknote className="w-4 h-4 text-green-500" />
                                  Dinheiro
                                </span>
                                <span className="font-medium">R$ {cashTotal.toFixed(2)}</span>
                              </div>
                              <div className="h-4 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                                  style={{ width: `${(cashTotal / maxValue) * 100}%` }}
                                />
                              </div>
                            </div>
                            
                            {/* Cartão Bar */}
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="flex items-center gap-2">
                                  <CreditCard className="w-4 h-4 text-blue-500" />
                                  Cartão
                                </span>
                                <span className="font-medium">R$ {cardTotal.toFixed(2)}</span>
                              </div>
                              <div className="h-4 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                  style={{ width: `${(cardTotal / maxValue) * 100}%` }}
                                />
                              </div>
                            </div>
                            
                            {/* Pending Bar */}
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-yellow-500" />
                                  Aguardando
                                </span>
                                <span className="font-medium">R$ {pendingTotal.toFixed(2)}</span>
                              </div>
                              <div className="h-4 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                                  style={{ width: `${(pendingTotal / maxValue) * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
                
                {/* Transactions List */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Últimos Pagamentos Recebidos (clique no valor para editar)</h4>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {filteredReportAppointments
                      .filter(a => a.payment_status === 'paid_pix' || a.payment_status === 'paid_cash' || a.payment_status === 'paid_card' || a.payment_status === 'paid')
                      .sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime())
                      .slice(0, 20)
                      .map((appointment) => {
                        const isSubscription = appointment.payment_method === 'subscription';
                        const originalValue = isSubscription ? 0 : getServicesTotal(appointment.services);
                        const adjustedValue = isSubscription ? 0 : getAdjustedValue(appointment.id, originalValue);
                        const hasAdjustment = revenueAdjustments.some(adj => adj.appointment_id === appointment.id);
                        const isEditing = editingAppointmentId === appointment.id;
                        
                        return (
                          <div key={appointment.id} className="flex items-center justify-between p-3 rounded-lg bg-card/60 border border-border/50">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center",
                                appointment.payment_status === 'paid_pix' ? "bg-[#00D4AA]/20" : 
                                appointment.payment_status === 'paid_card' ? "bg-blue-500/20" : "bg-green-500/20"
                              )}>
                                {appointment.payment_status === 'paid_pix' ? (
                                  <img src={pixIcon} alt="PIX" className="w-5 h-5 object-contain" />
                                ) : appointment.payment_status === 'paid_card' ? (
                                  <CreditCard className="w-4 h-4 text-blue-500" />
                                ) : (
                                  <Banknote className="w-4 h-4 text-green-500" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{appointment.profiles?.full_name || 'Cliente'}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(parseISO(appointment.appointment_date), "dd/MM", { locale: ptBR })} - {getServicesNames(appointment.services)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">R$</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="w-20 h-7 text-sm text-right"
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                                    onClick={() => {
                                      const newValue = parseFloat(editValue);
                                      if (!isNaN(newValue) && newValue >= 0) {
                                        saveRevenueAdjustment(appointment.id, originalValue, newValue);
                                      } else {
                                        toast.error("Valor inválido");
                                      }
                                    }}
                                  >
                                    <Save className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      setEditingAppointmentId(null);
                                      setEditValue("");
                                    }}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="text-right">
                                  <button
                                    onClick={() => {
                                      setEditingAppointmentId(appointment.id);
                                      setEditValue(adjustedValue.toFixed(2));
                                    }}
                                    className="flex items-center gap-1 text-sm font-bold text-primary hover:underline group"
                                    title="Clique para editar"
                                  >
                                    R$ {adjustedValue.toFixed(2)}
                                    <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </button>
                                  {hasAdjustment && originalValue !== adjustedValue && (
                                    <p className="text-[10px] text-muted-foreground line-through">
                                      Original: R$ {originalValue.toFixed(2)}
                                    </p>
                                  )}
                                  <Badge variant="outline" className={cn(
                                    "text-[10px]",
                                    appointment.payment_status === 'paid_pix' ? "border-[#00D4AA]/30 text-[#00D4AA]" : 
                                    appointment.payment_status === 'paid_card' ? "border-blue-500/30 text-blue-500" : "border-green-500/30 text-green-500"
                                  )}>
                                    {appointment.payment_status === 'paid_pix' ? 'PIX' : appointment.payment_status === 'paid_card' ? 'Cartão' : 'Dinheiro'}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    {filteredReportAppointments.filter(a => a.payment_status === 'paid_pix' || a.payment_status === 'paid_cash' || a.payment_status === 'paid_card' || a.payment_status === 'paid').length === 0 && (
                      <p className="text-center text-muted-foreground py-8">Nenhum pagamento registrado no período</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Assistant Tab */}
          <TabsContent value="ai-assistant">
            <AIAssistantPanel />
          </TabsContent>

          {/* Appointments Tab */}
          <TabsContent value="appointments" className="space-y-6">
            {/* Pending Appointments Section - Always visible at top */}
            {appointments.filter(a => a.status === "pending").length > 0 && (
              <Card className="bg-yellow-500/5 backdrop-blur-xl border-yellow-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-yellow-500">
                    <Clock className="w-5 h-5" />
                    Pedidos Aguardando Aprovação ({appointments.filter(a => a.status === "pending").length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {appointments
                    .filter(a => a.status === "pending")
                    .sort((a, b) => {
                      const dateA = new Date(`${a.appointment_date}T${a.appointment_time}`);
                      const dateB = new Date(`${b.appointment_date}T${b.appointment_time}`);
                      return dateA.getTime() - dateB.getTime();
                    })
                    .map((appointment) => (
                    <div 
                      key={appointment.id} 
                      className="flex flex-col gap-3 p-3 sm:p-4 rounded-lg bg-card/40 border border-yellow-500/20"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-yellow-500/10 flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-base sm:text-lg font-bold text-yellow-500">
                            {format(parseISO(appointment.appointment_date), "dd")}
                          </span>
                          <span className="text-[10px] sm:text-xs text-yellow-500 uppercase">
                            {format(parseISO(appointment.appointment_date), "MMM", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm sm:text-base flex-wrap">
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500 flex-shrink-0" />
                            <span className="truncate">{getClientDisplayInfo(appointment).name}</span>
                            {(() => {
                              const subscription = getUserSubscription(appointment.user_id);
                              if (subscription) {
                                const hasCredits = hasRemainingCuts(subscription);
                                return (
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-[10px] px-1.5 py-0.5 flex items-center gap-1",
                                      hasCredits 
                                        ? "border-amber-500/50 bg-amber-500/10 text-amber-400" 
                                        : "border-red-500/50 bg-red-500/10 text-red-400"
                                    )}
                                  >
                                    <Crown className="w-3 h-3" />
                                    {hasCredits 
                                      ? `Assinante (${subscription.cuts_used_this_month}/${subscription.monthly_cuts_limit})` 
                                      : "Limite atingido"}
                                  </Badge>
                                );
                              }
                              return null;
                            })()}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">{getClientDisplayInfo(appointment).phone}</p>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs sm:text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              {appointment.appointment_time.slice(0, 5)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Scissors className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span className="truncate max-w-[150px] sm:max-w-none">{getServicesNames(appointment.services)}</span>
                            </span>
                            {/* Payment Method Badge */}
                            {(() => {
                              const paymentInfo = getPaymentMethodInfo(appointment.payment_method);
                              return (
                                <Badge 
                                  variant="outline" 
                                  className={`text-[10px] px-1.5 py-0.5 flex items-center gap-1 ${paymentInfo.color}`}
                                >
                                  {paymentInfo.icon === "pix" && <img src={pixIcon} alt="PIX" className="w-3 h-3" />}
                                  {paymentInfo.icon === "cash" && <Banknote className="w-3 h-3" />}
                                  {paymentInfo.icon === "card" && <CreditCard className="w-3 h-3" />}
                                  {paymentInfo.label}
                                </Badge>
                              );
                            })()}
                            {(() => {
                              const subscription = getUserSubscription(appointment.user_id);
                              const hasCredits = hasRemainingCuts(subscription);
                              if (subscription && hasCredits) {
                                return (
                                  <span className="font-bold text-green-500 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Incluso
                                  </span>
                                );
                              }
                              return (
                                <span className="font-bold text-primary">R$ {getServicesTotal(appointment.services).toFixed(2)}</span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700 text-white h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm flex-1 sm:flex-none"
                            >
                              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Aceitar</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-primary/20 mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-base sm:text-lg">Confirmar Agendamento</AlertDialogTitle>
                              <AlertDialogDescription className="text-sm">
                                Deseja confirmar o agendamento de {getClientDisplayInfo(appointment).name} para {format(parseISO(appointment.appointment_date), "dd/MM/yyyy")} às {appointment.appointment_time.slice(0, 5)}?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                              <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => updateAppointmentStatus(appointment.id, "confirmed")}
                                className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                              >
                                Confirmar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="border-red-500/50 text-red-500 hover:bg-red-500/10 h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm flex-1 sm:flex-none"
                            >
                              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Recusar</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-primary/20 mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-base sm:text-lg">Recusar Agendamento</AlertDialogTitle>
                              <AlertDialogDescription className="text-sm">
                                Tem certeza que deseja recusar o agendamento de {getClientDisplayInfo(appointment).name}? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                              <AlertDialogCancel className="w-full sm:w-auto">Voltar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => updateAppointmentStatus(appointment.id, "cancelled")}
                                className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                              >
                                Recusar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="border-destructive/50 text-destructive hover:bg-destructive/10 h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm"
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-destructive/20 mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-destructive text-base sm:text-lg">Excluir Agendamento</AlertDialogTitle>
                              <AlertDialogDescription className="text-sm">
                                Tem certeza que deseja excluir permanentemente o agendamento de {getClientDisplayInfo(appointment).name}? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                              <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteAppointment(appointment.id)}
                                className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <WhatsAppButton
                          phone={getClientDisplayInfo(appointment).phone !== "Sem telefone" ? getClientDisplayInfo(appointment).phone : ""}
                          message={getConfirmationMessage(
                            getClientDisplayInfo(appointment).name,
                            getServicesNames(appointment.services),
                            format(parseISO(appointment.appointment_date), "dd/MM/yyyy"),
                            appointment.appointment_time.slice(0, 5)
                          )}
                          disabled={getClientDisplayInfo(appointment).phone === "Sem telefone"}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* All Appointments Section */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 mb-4">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-card/40 border border-primary/20 rounded-lg px-3 sm:px-4 py-2 text-foreground text-sm w-full sm:w-auto"
              />
              <Button variant="outline" onClick={() => setFilterDate("")} className="w-full sm:w-auto">
                Ver Todos
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/admin/history")} 
                className="w-full sm:w-auto gap-2"
              >
                <History className="w-4 h-4" />
                Histórico Completo
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredAppointments.length === 0 ? (
              <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Nenhum agendamento encontrado</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredAppointments.map((appointment) => (
                  <Card key={appointment.id} className="bg-card/40 backdrop-blur-xl border-primary/20">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-base sm:text-lg font-bold text-primary">
                              {format(parseISO(appointment.appointment_date), "dd")}
                            </span>
                            <span className="text-[10px] sm:text-xs text-primary uppercase">
                              {format(parseISO(appointment.appointment_date), "MMM", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base flex-wrap">
                              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
                              <span className="truncate">{getClientDisplayInfo(appointment).name}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-muted-foreground hover:text-primary flex-shrink-0"
                                onClick={() => setSelectedCustomerId(appointment.user_id)}
                                title="Ver histórico do cliente"
                              >
                                <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                              {(() => {
                                const subscription = getUserSubscription(appointment.user_id);
                                if (subscription) {
                                  const hasCredits = hasRemainingCuts(subscription);
                                  return (
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        "text-[10px] px-1.5 py-0.5 flex items-center gap-1",
                                        hasCredits 
                                          ? "border-amber-500/50 bg-amber-500/10 text-amber-400" 
                                          : "border-red-500/50 bg-red-500/10 text-red-400"
                                      )}
                                    >
                                      <Crown className="w-3 h-3" />
                                      {hasCredits 
                                        ? `${subscription.cuts_used_this_month}/${subscription.monthly_cuts_limit}` 
                                        : "Limite"}
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">{getClientDisplayInfo(appointment).phone}</p>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs sm:text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                {appointment.appointment_time.slice(0, 5)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Scissors className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span className="truncate max-w-[150px] sm:max-w-none">{getServicesNames(appointment.services)}</span>
                              </span>
                              {/* Payment Method Badge */}
                              {(() => {
                                const paymentInfo = getPaymentMethodInfo(appointment.payment_method);
                                return (
                                  <Badge 
                                    variant="outline" 
                                    className={`text-[10px] px-1.5 py-0.5 flex items-center gap-1 ${paymentInfo.color}`}
                                  >
                                    {paymentInfo.icon === "pix" && <img src={pixIcon} alt="PIX" className="w-3 h-3" />}
                                    {paymentInfo.icon === "cash" && <Banknote className="w-3 h-3" />}
                                    {paymentInfo.icon === "card" && <CreditCard className="w-3 h-3" />}
                                    {paymentInfo.label}
                                  </Badge>
                                );
                              })()}
                              {(() => {
                                // If paid via subscription, show R$ 0
                                if (appointment.payment_method === 'subscription') {
                                  return (
                                    <span className="font-bold text-green-500 flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Assinatura (R$ 0)
                                    </span>
                                  );
                                }
                                const subscription = getUserSubscription(appointment.user_id);
                                const hasCredits = hasRemainingCuts(subscription);
                                if (subscription && hasCredits) {
                                  return (
                                    <span className="font-bold text-green-500 flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Incluso
                                    </span>
                                  );
                                }
                                return (
                                  <span className="font-bold text-primary">R$ {getServicesTotal(appointment.services).toFixed(2)}</span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-border">
                          <Badge variant="outline" className={`${statusColors[appointment.status]} text-xs`}>
                            {statusLabels[appointment.status]}
                          </Badge>

                          <span className="font-bold text-primary text-sm sm:text-base">
                            {appointment.payment_method === 'subscription' ? 'R$ 0,00' : `R$ ${getServicesTotal(appointment.services).toFixed(2)}`}
                          </span>

                          <Select
                            value={appointment.status}
                            onValueChange={(value) => updateAppointmentStatus(appointment.id, value)}
                          >
                            <SelectTrigger className="w-[110px] sm:w-32 h-7 sm:h-8 bg-card/60 text-xs sm:text-sm">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="confirmed">Confirmado</SelectItem>
                              <SelectItem value="completed">Concluído</SelectItem>
                              <SelectItem value="cancelled">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select
                            value={appointment.payment_status}
                            onValueChange={(value) => updatePaymentStatus(appointment.id, value)}
                          >
                            <SelectTrigger className={cn(
                              "w-[120px] sm:w-32 h-7 sm:h-8 text-xs sm:text-sm font-medium",
                              appointment.payment_status === 'pending' && "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
                              (appointment.payment_status === 'paid_pix' || appointment.payment_status === 'paid_cash' || appointment.payment_status === 'paid_card' || appointment.payment_status === 'paid') && "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
                              appointment.payment_status === 'refunded' && "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30"
                            )}>
                              <SelectValue placeholder="Pagamento" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending" className="text-yellow-700 dark:text-yellow-400">Aguardando</SelectItem>
                              <SelectItem value="paid_pix" className="text-green-700 dark:text-green-400">Pago PIX</SelectItem>
                              <SelectItem value="paid_cash" className="text-green-700 dark:text-green-400">Pago Dinheiro</SelectItem>
                              <SelectItem value="paid_card" className="text-blue-700 dark:text-blue-400">Pago Cartão</SelectItem>
                              <SelectItem value="refunded" className="text-red-700 dark:text-red-400">Reembolsado</SelectItem>
                            </SelectContent>
                          </Select>

                          <WhatsAppButton
                            phone={getClientDisplayInfo(appointment).phone !== "Sem telefone" ? getClientDisplayInfo(appointment).phone : ""}
                            message={getConfirmationMessage(
                              getClientDisplayInfo(appointment).name,
                              getServicesNames(appointment.services),
                              format(parseISO(appointment.appointment_date), "dd/MM/yyyy"),
                              appointment.appointment_time.slice(0, 5)
                            )}
                            disabled={getClientDisplayInfo(appointment).phone === "Sem telefone"}
                          />

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="border-destructive/50 text-destructive hover:bg-destructive/10 h-7 sm:h-8 px-2"
                              >
                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border-destructive/20 mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-destructive text-base sm:text-lg">Excluir Agendamento</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm">
                                  Tem certeza que deseja excluir permanentemente o agendamento de {getClientDisplayInfo(appointment).name}? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => deleteAppointment(appointment.id)}
                                  className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-4 sm:space-y-6">
            <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-foreground text-base sm:text-lg">
                  <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Bloquear Data/Horário
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="date"
                    value={blockDateInput}
                    onChange={(e) => setBlockDateInput(e.target.value)}
                    className="bg-card/40 border border-primary/20 rounded-lg px-3 sm:px-4 py-2.5 text-foreground text-sm w-full"
                  />
                  <input
                    type="time"
                    value={blockTimeInput}
                    onChange={(e) => setBlockTimeInput(e.target.value)}
                    className="bg-card/40 border border-primary/20 rounded-lg px-3 sm:px-4 py-2.5 text-foreground text-sm w-full"
                    placeholder="Opcional"
                  />
                  <Button
                    onClick={() => blockDate(blockDateInput, blockTimeInput || undefined)}
                    disabled={!blockDateInput}
                    className="bg-gold-gradient text-background w-full h-10 sm:h-auto disabled:opacity-50"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Bloquear
                  </Button>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Deixe o horário em branco para bloquear o dia inteiro
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-foreground text-base sm:text-lg">
                  <Unlock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Bloqueados ({blockedDates.length})
                </CardTitle>
                {blockedDates.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/50 text-destructive hover:bg-destructive/10 w-full sm:w-auto h-9"
                      >
                        <Unlock className="w-4 h-4 mr-2" />
                        Desbloquear Todos
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-destructive/20 mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive text-base sm:text-lg">Desbloquear Todos</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm">
                          Isso vai desbloquear <strong>{blockedDates.length} horário(s)</strong>, incluindo:
                          <br /><br />
                          • Horários bloqueados manualmente
                          <br />
                          • Horários bloqueados automaticamente
                          <br /><br />
                          <strong>Atenção:</strong> Os horários ficarão disponíveis novamente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={unblockAllDates}
                          className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto"
                        >
                          Desbloquear Todos
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardHeader>
              <CardContent>
                {blockedDates.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6 text-sm">Nenhum bloqueio ativo</p>
                ) : (
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {blockedDates.map((blocked) => (
                      <div
                        key={blocked.id}
                        className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-destructive/10 border border-destructive/20 gap-2"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="text-foreground text-sm block truncate">
                              {format(parseISO(blocked.blocked_date), "dd/MM/yyyy")}
                              {blocked.blocked_time && ` às ${blocked.blocked_time.slice(0, 5)}`}
                            </span>
                            {blocked.reason && (
                              <span className="text-muted-foreground text-xs truncate block">{blocked.reason}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unblockDate(blocked.id)}
                          className="text-destructive hover:bg-destructive/20 h-8 w-8 p-0 flex-shrink-0"
                        >
                          <Unlock className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gallery Tab */}
          <TabsContent value="gallery">
            <GalleryManager />
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients">
            <ClientsList />
          </TabsContent>

          {/* Loyalty Tab */}
          <TabsContent value="loyalty">
            <LoyaltyProgramManager />
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions">
            <VIPPackagesManager />
          </TabsContent>
        </Tabs>
      </main>

      {/* Customer History Modal */}
      <CustomerHistory
        userId={selectedCustomerId || ""}
        isOpen={!!selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
      />
    </div>
  );
};

export default Admin;
