import { useState, useEffect } from "react";
import { Plus, Search, Scissors, X, Trash2, Crown, Calendar, RefreshCw, Pencil, RotateCcw, Check, ArrowRight, CreditCard, Clock, CheckCircle, DollarSign, Filter, ShoppingCart, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import PackageEditor from "./PackageEditor";

interface Package {
  id: string;
  name: string;
  price: number;
  description: string | null;
  duration_days: number | null;
  active: boolean;
}

interface PackageItem {
  id: string;
  package_id: string;
  service_id: string | null;
  service_name: string;
  quantity: number;
}

interface PackageBenefit {
  id: string;
  package_id: string;
  service_id: string;
  quantity: number | null;
  service_name?: string;
}

interface SubscriberWithUsage {
  id: string;
  user_id: string;
  subscription_start_date: string;
  usage_reset_date: string | null;
  is_active: boolean;
  package_id: string | null;
  package_name: string | null;
  monthly_cuts_limit: number;
  cuts_used_this_month: number;
  weekly_credits_available: number;
  current_week_start: string | null;
  consecutive_months: number;
  profile: {
    full_name: string | null;
    phone: string | null;
  } | null;
  package: {
    name: string;
    price: number;
    duration_days: number | null;
  } | null;
  benefits: BenefitUsage[];
}

interface BenefitUsage {
  service_id: string;
  service_name: string;
  quantity: number;
  used: number;
}

interface Profile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
}

interface PaymentOrder {
  id: string;
  user_id: string;
  package_id: string | null;
  package_name: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  payment_status: string;
  notes: string | null;
  created_at: string;
  profile?: Profile | null;
  subscriber?: {
    is_active: boolean;
    consecutive_months: number;
    subscription_start_date: string;
    package_name: string | null;
  } | null;
}

const VIPPackagesManager = () => {
  const [activeTab, setActiveTab] = useState("orders");
  const [orderFilter, setOrderFilter] = useState<"all" | "pending" | "confirmed" | "renewal" | "purchase">("all");
  const [packages, setPackages] = useState<Package[]>([]);
  const [subscribers, setSubscribers] = useState<SubscriberWithUsage[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [packageItems, setPackageItems] = useState<PackageItem[]>([]);
  const [packageBenefits, setPackageBenefits] = useState<PackageBenefit[]>([]);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [packageSearchTerm, setPackageSearchTerm] = useState("");
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPackageEditor, setShowPackageEditor] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedSubscriber, setSelectedSubscriber] = useState<SubscriberWithUsage | null>(null);
  const [selectedBenefits, setSelectedBenefits] = useState<Set<string>>(new Set());
  const [registeringUsage, setRegisteringUsage] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all in parallel
      const [subsResult, packagesResult, profilesResult, itemsResult, benefitsResult, appointmentsResult, appointmentServicesResult, ordersResult] = await Promise.all([
        supabase.from("subscription_progress").select("*").order("is_active", { ascending: false }),
        supabase.from("packages").select("*").eq("active", true).order("name"),
        supabase.from("profiles").select("user_id, full_name, phone"),
        supabase.from("package_items").select("*"),
        supabase.from("package_benefits").select("*, services(name)"),
        supabase
          .from("appointments")
          .select("id, user_id, service_id, appointment_date, status, created_at")
          .in("status", ["completed", "confirmed"])
          .order("created_at", { ascending: false })
          .limit(10000),
        supabase.from("appointment_services").select("appointment_id, service_id"),
        supabase.from("package_payments").select("*").order("created_at", { ascending: false })
      ]);

      if (subsResult.error) throw subsResult.error;
      if (packagesResult.error) throw packagesResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (benefitsResult.error) throw benefitsResult.error;
      if (appointmentsResult.error) throw appointmentsResult.error;
      if (appointmentServicesResult.error) throw appointmentServicesResult.error;

      setPackages(packagesResult.data || []);
      setProfiles(profilesResult.data || []);
      setPackageItems(itemsResult.data || []);
      
      // Process orders with profile + subscriber data
      const allProfiles = profilesResult.data || [];
      const allSubs = subsResult.data || [];
      const ordersWithProfiles = (ordersResult.data || []).map(order => {
        const sub = allSubs.find(s => s.user_id === order.user_id);
        return {
          ...order,
          payment_status: (order as any).payment_status || 'confirmed',
          profile: allProfiles.find(p => p.user_id === order.user_id) || null,
          subscriber: sub ? {
            is_active: sub.is_active,
            consecutive_months: sub.consecutive_months,
            subscription_start_date: sub.subscription_start_date,
            package_name: sub.package_name,
          } : null,
        };
      });
      setOrders(ordersWithProfiles);
      
      // Process benefits with service names
      const processedBenefits = (benefitsResult.data || []).map(b => ({
        ...b,
        service_name: (b.services as any)?.name || "Serviço"
      }));
      setPackageBenefits(processedBenefits);

      const completedAppointments = appointmentsResult.data || [];
      const appointmentServices = appointmentServicesResult.data || [];

      // Map only real subscribers with a linked package, whether active or inactive
      const subscribersWithData = (subsResult.data || []).filter(sub => sub.package_id != null).map(sub => {
        const profile = profilesResult.data?.find(p => p.user_id === sub.user_id);
        const pkg = packagesResult.data?.find(p => p.id === sub.package_id);
        
        // Get all benefits for this package (from package_items + package_benefits)
        const pkgItems = (itemsResult.data || []).filter(i => i.package_id === sub.package_id);
        const pkgBenefits = processedBenefits.filter(b => b.package_id === sub.package_id);
        
        // Get completed/confirmed appointments for this subscriber AFTER last reset
        const usageResetTime = sub.usage_reset_date ? new Date(sub.usage_reset_date).getTime() : 0;
        const subscriptionStart = new Date(sub.subscription_start_date).getTime();
        const cutoffTime = usageResetTime || subscriptionStart;
        
        const userAppointments = completedAppointments.filter(a => {
          if (a.user_id !== sub.user_id) return false;
          // Compare using created_at timestamp to properly filter after reset
          const appointmentCreatedAt = new Date(a.created_at).getTime();
          return appointmentCreatedAt > cutoffTime;
        });
        
        // Count usage per service
        // First, count from main service_id of each appointment
        const usageByService: Record<string, number> = {};
        userAppointments.forEach(apt => {
          // Always count the main service_id
          usageByService[apt.service_id] = (usageByService[apt.service_id] || 0) + 1;
          
          // Also count any additional services from appointment_services
          const additionalServices = appointmentServices
            .filter(as => as.appointment_id === apt.id && as.service_id !== apt.service_id)
            .map(as => as.service_id);
          
          additionalServices.forEach(serviceId => {
            usageByService[serviceId] = (usageByService[serviceId] || 0) + 1;
          });
        });

        // Each elapsed week (booked OR fully expired) counts as 1 use of EVERY benefit
        // equally. We compute the floor as: distinct booked weeks + expired weeks.
        const expiredWeeks = (sub as any).expired_weeks_this_period || 0;
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        const bookedWeekKeys = new Set<number>();
        userAppointments.forEach(apt => {
          const weekIndex = Math.floor(
            (new Date(apt.created_at).getTime() - cutoffTime) / msPerWeek
          );
          bookedWeekKeys.add(weekIndex);
        });
        const weeksConsumed = bookedWeekKeys.size + expiredWeeks;

        const benefits: BenefitUsage[] = [];
        
        pkgItems.forEach(item => {
          const serviceId = item.service_id || '';
          const realUsed = usageByService[serviceId] || 0;
          benefits.push({
            service_id: serviceId,
            service_name: item.service_name,
            quantity: item.quantity,
            used: Math.min(item.quantity, Math.max(realUsed, weeksConsumed))
          });
        });
        
        pkgBenefits.forEach(benefit => {
          const existing = benefits.find(b => b.service_id === benefit.service_id);
          if (!existing) {
            const realUsed = usageByService[benefit.service_id] || 0;
            const qty = benefit.quantity || 1;
            benefits.push({
              service_id: benefit.service_id,
              service_name: benefit.service_name || "Serviço",
              quantity: qty,
              used: Math.min(qty, Math.max(realUsed, weeksConsumed))
            });
          }
        });

        return {
          ...sub,
          profile: profile || null,
          package: pkg ? { name: pkg.name, price: pkg.price, duration_days: pkg.duration_days } : null,
          benefits
        };
      });

      setSubscribers(subscribersWithData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const createSubscription = async () => {
    if (!selectedUserId || !selectedPackageId) {
      toast.error("Selecione um cliente e um pacote");
      return;
    }

    const pkg = packages.find(p => p.id === selectedPackageId);
    if (!pkg) return;

    // Get package items to count total cuts
    const pkgItems = packageItems.filter(i => i.package_id === selectedPackageId);
    const totalCuts = pkgItems.reduce((sum, item) => {
      const serviceName = item.service_name.toLowerCase();
      if (serviceName.includes('cabelo') || serviceName.includes('degradê') || serviceName.includes('degrade') || serviceName.includes('corte')) {
        return sum + item.quantity;
      }
      return sum;
    }, 0);

    const monthlyCutsLimit = totalCuts || 4;
    const weeklyCredits = Math.max(1, Math.ceil(monthlyCutsLimit / 4));

    const durationDays = pkg.duration_days || 30;
    const startDate = new Date();

    try {
      const { error } = await supabase
        .from("subscription_progress")
        .insert({
          user_id: selectedUserId,
          subscription_start_date: startDate.toISOString().split('T')[0],
          package_id: selectedPackageId,
          package_name: pkg.name,
          monthly_cuts_limit: monthlyCutsLimit,
          weekly_credits_available: weeklyCredits,
          current_week_start: startDate.toISOString().split('T')[0],
          consecutive_months: 1,
          is_active: true
        });

      if (error) throw error;

      toast.success("Assinatura criada com sucesso!");
      setShowAddModal(false);
      setSelectedUserId("");
      setSelectedPackageId("");
      fetchData();
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      if (error.code === '23505') {
        toast.error("Este cliente já possui uma assinatura");
      } else {
        toast.error("Erro ao criar assinatura");
      }
    }
  };

  const toggleSubscriptionStatus = async (subId: string, currentActive: boolean, sub?: SubscriberWithUsage) => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const nowTimestamp = today.toISOString();

      // When activating (from inactive to active), reset dates and counters
      const updateData: Record<string, unknown> = { is_active: !currentActive };
      
      if (!currentActive) {
        // Reactivating: update subscription_start_date to today (new 30-day window)
        const weeklyCredits = sub ? Math.max(1, Math.ceil(sub.monthly_cuts_limit / 4)) : 1;
        updateData.subscription_start_date = todayStr;
        updateData.usage_reset_date = nowTimestamp;
        updateData.cuts_used_this_month = 0;
        updateData.credits_expired_this_month = 0;
        updateData.current_month_start = todayStr;
        updateData.weekly_credits_available = weeklyCredits;
        updateData.current_week_start = todayStr;
        updateData.last_payment_date = todayStr;
        updateData.updated_at = nowTimestamp;
      }

      const { error } = await supabase
        .from("subscription_progress")
        .update(updateData)
        .eq("id", subId);

      if (error) throw error;

      setSubscribers(prev => 
        prev.map(s => s.id === subId ? { 
          ...s, 
          is_active: !currentActive,
          ...((!currentActive) ? {
            subscription_start_date: todayStr,
            usage_reset_date: nowTimestamp,
            cuts_used_this_month: 0,
            credits_expired_this_month: 0,
          } : {})
        } : s)
      );

      toast.success(currentActive ? "Assinatura pausada" : "Assinatura reativada (período renovado para 30 dias)");
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const deleteSubscription = async (subId: string, clientName: string) => {
    if (!confirm(`Tem certeza que deseja excluir a assinatura de ${clientName}?`)) return;

    try {
      const { error } = await supabase
        .from("subscription_progress")
        .delete()
        .eq("id", subId);

      if (error) throw error;

      setSubscribers(prev => prev.filter(s => s.id !== subId));
      toast.success("Assinatura excluída");
    } catch (error) {
      console.error("Error deleting subscription:", error);
      toast.error("Erro ao excluir assinatura");
    }
  };

  const resetWeeklyCredits = async (subId: string, monthlyLimit: number) => {
    const weeklyCredits = Math.ceil(monthlyLimit / 4);
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { error } = await supabase
        .from("subscription_progress")
        .update({ 
          weekly_credits_available: weeklyCredits,
          current_week_start: today,
          cuts_used_this_month: 0
        })
        .eq("id", subId);

      if (error) throw error;

      toast.success(`Créditos resetados: ${weeklyCredits} crédito(s) disponível(is)`);
      fetchData();
    } catch (error) {
      console.error("Error resetting credits:", error);
      toast.error("Erro ao resetar créditos");
    }
  };

  const resetBenefitsUsage = async (subId: string) => {
    // Use full timestamp to properly filter appointments created after this moment
    const now = new Date().toISOString();
    const todayStr = new Date().toISOString().split('T')[0];
    
    try {
      const { error } = await supabase
        .from("subscription_progress")
        .update({ 
          usage_reset_date: now,
          subscription_start_date: todayStr,
          cuts_used_this_month: 0,
          expired_weeks_this_period: 0,
        } as any)
        .eq("id", subId);

      if (error) throw error;

      toast.success("Uso dos benefícios zerado!");
      fetchData();
    } catch (error) {
      console.error("Error resetting benefits:", error);
      toast.error("Erro ao resetar benefícios");
    }
  };

  const renewSubscription = async (sub: SubscriberWithUsage) => {
    if (!sub.package) {
      toast.error("Pacote não encontrado para esta assinatura");
      return;
    }

    if (!confirm(`Gerar pedido de renovação pendente para ${sub.profile?.full_name || "Cliente"}?\n\nO pedido vai para a aba "Pedidos" aguardando confirmação de pagamento.`)) return;

    const todayStr = new Date().toISOString().split('T')[0];

    try {
      // Check if there is already a pending renewal order for this user
      const { data: existingPending } = await supabase
        .from("package_payments")
        .select("id")
        .eq("user_id", sub.user_id)
        .eq("payment_status", "pending")
        .ilike("notes", "%Renovação%")
        .limit(1)
        .maybeSingle();

      if (existingPending) {
        toast.info("Já existe um pedido de renovação pendente para este cliente. Confirme na aba Pedidos.");
        return;
      }

      // Create pending payment order — admin will confirm in the Orders tab
      const { error: paymentError } = await supabase
        .from("package_payments")
        .insert({
          user_id: sub.user_id,
          package_id: sub.package_id,
          package_name: sub.package_name || sub.package.name,
          amount: sub.package.price,
          payment_date: todayStr,
          payment_method: "pix",
          payment_status: "pending",
          notes: `Renovação mês ${sub.consecutive_months + 1} - ${sub.profile?.full_name || "Cliente"} (gerado pelo admin)`
        });

      if (paymentError) throw paymentError;

      toast.success("Pedido de renovação criado!", {
        description: "Confirme o pagamento na aba Pedidos para ativar."
      });
      fetchData();
    } catch (error) {
      console.error("Error creating renewal order:", error);
      toast.error("Erro ao gerar pedido de renovação");
    }
  };

  const deletePendingOrder = async (order: PaymentOrder) => {
    if (!confirm(`Excluir pedido pendente de ${order.profile?.full_name || "Cliente"}?`)) return;
    try {
      const { error } = await supabase
        .from("package_payments")
        .delete()
        .eq("id", order.id);
      if (error) throw error;

      // Also deactivate subscription if exists
      await supabase
        .from("subscription_progress")
        .update({ is_active: false })
        .eq("user_id", order.user_id);

      setOrders(prev => prev.filter(o => o.id !== order.id));
      toast.success("Pedido excluído");
    } catch (error) {
      console.error("Error deleting order:", error);
      toast.error("Erro ao excluir pedido");
    }
  };

  const confirmPaymentAndActivate = async (order: PaymentOrder, paymentMethod: string) => {
    try {
      // 1. Update payment status
      await supabase
        .from("package_payments")
        .update({ payment_status: "confirmed", payment_method: paymentMethod })
        .eq("id", order.id);

      // 2. Determine if this is a renewal or first purchase
      const isRenewal = order.notes?.includes('Renovação');

      // 3. Find and activate the subscriber's subscription
      const { data: sub } = await supabase
        .from("subscription_progress")
        .select("*")
        .eq("user_id", order.user_id)
        .limit(1)
        .maybeSingle();

      // Tolerância (em dias) após o vencimento para ainda contar como renovação consecutiva
      const RENEWAL_TOLERANCE_DAYS = 3;
      let computedNewMonths = 1;

      if (sub) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const nowTimestamp = today.toISOString();
        // Use the package from the paid order (may differ from previous package on upgrade/downgrade)
        const orderPkgItems = order.package_id ? packageItems.filter(i => i.package_id === order.package_id) : [];
        const itemsTotalQty = orderPkgItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
        const newMonthlyLimit = itemsTotalQty > 0 ? itemsTotalQty : sub.monthly_cuts_limit;
        const weeklyCredits = Math.max(1, Math.ceil(newMonthlyLimit / 4));

        // Calcular consecutive_months com regra de tolerância
        if (!isRenewal) {
          // Primeira compra (ou ativação inicial): se já tinha histórico mantém, senão 1
          computedNewMonths = sub.consecutive_months > 0 ? sub.consecutive_months : 1;
        } else {
          // Renovação: verificar se foi feita dentro do prazo + tolerância
          const durationDays = order.package_id
            ? (packages.find(p => p.id === order.package_id)?.duration_days ?? 30)
            : 30;
          const startDate = sub.subscription_start_date ? new Date(sub.subscription_start_date) : null;

          if (startDate) {
            const expirationDate = new Date(startDate);
            expirationDate.setDate(expirationDate.getDate() + durationDays);
            const toleranceLimit = new Date(expirationDate);
            toleranceLimit.setDate(toleranceLimit.getDate() + RENEWAL_TOLERANCE_DAYS);

            if (today <= toleranceLimit) {
              // Renovou dentro do prazo + tolerância → soma +1
              computedNewMonths = (sub.consecutive_months || 0) + 1;
            } else {
              // Passou da tolerância → reinicia contagem
              computedNewMonths = 1;
            }
          } else {
            computedNewMonths = (sub.consecutive_months || 0) + 1;
          }
        }

        await supabase
          .from("subscription_progress")
          .update({
            is_active: true,
            package_id: order.package_id ?? sub.package_id,
            monthly_cuts_limit: newMonthlyLimit,
            subscription_start_date: todayStr,
            usage_reset_date: nowTimestamp,
            cuts_used_this_month: 0,
            credits_expired_this_month: 0,
            expired_weeks_this_period: 0,
            current_month_start: todayStr,
            weekly_credits_available: weeklyCredits,
            current_week_start: todayStr,
            last_payment_date: todayStr,
            consecutive_months: computedNewMonths,
            updated_at: nowTimestamp,
          } as any)
          .eq("id", sub.id);
      }

      // 4. Notify client
      const monthInfo = sub ? ` (Mês ${computedNewMonths})` : '';
      await supabase.from("notifications").insert({
        user_id: order.user_id,
        title: isRenewal ? "Assinatura Renovada! 🔄" : "Assinatura Ativada! 🎉",
        message: `Seu ${order.package_name} foi ${isRenewal ? 'renovado' : 'ativado'} com sucesso${monthInfo}. Você já pode agendar usando seus benefícios!`,
        type: "subscription_activated",
      });

      toast.success(`Pagamento confirmado e assinatura ativada!`);
      fetchData();
    } catch (error) {
      console.error("Error confirming payment:", error);
      toast.error("Erro ao confirmar pagamento");
    }
  };

  const openUsageModal = (subscriber: SubscriberWithUsage) => {
    setSelectedSubscriber(subscriber);
    setSelectedBenefits(new Set());
    setShowUsageModal(true);
  };

  const toggleBenefitSelection = (serviceId: string) => {
    setSelectedBenefits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  const registerMultipleUsage = async () => {
    if (!selectedSubscriber || selectedBenefits.size === 0) return;
    
    // Get selected benefits
    const benefitsToRegister = selectedSubscriber.benefits.filter(
      b => selectedBenefits.has(b.service_id) && b.used < b.quantity
    );

    if (benefitsToRegister.length === 0) {
      toast.error("Selecione pelo menos um benefício disponível");
      return;
    }

    setRegisteringUsage(true);

    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      // Create appointments for each selected benefit with unique timestamps
      const insertPromises = benefitsToRegister.map((benefit, index) => {
        // Use unique time for each to avoid conflicts
        const seconds = (now.getSeconds() + index) % 60;
        const minutes = now.getMinutes() + Math.floor((now.getSeconds() + index) / 60);
        const uniqueTime = `23:${String(minutes % 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        return supabase
          .from("appointments")
          .insert({
            user_id: selectedSubscriber.user_id,
            service_id: benefit.service_id,
            appointment_date: today,
            appointment_time: uniqueTime,
            status: "completed",
            payment_status: "paid",
            payment_method: "subscription",
            notes: `Uso manual de assinatura - ${selectedSubscriber.package_name || 'Pacote VIP'}`
          });
      });

      const results = await Promise.all(insertPromises);
      
      // Check for errors
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        console.error("Some inserts failed:", errors);
        if (errors.length < benefitsToRegister.length) {
          toast.warning(`${benefitsToRegister.length - errors.length} de ${benefitsToRegister.length} usos registrados`);
        } else {
          throw errors[0].error;
        }
      } else {
        const serviceNames = benefitsToRegister.map(b => b.service_name).join(", ");
        toast.success(`Uso registrado: ${serviceNames}`);
      }

      // Decrement weekly credits and increment monthly cuts on subscription_progress
      const successfulCount = benefitsToRegister.length - errors.length;
      if (successfulCount > 0) {
        const currentWeekly = (selectedSubscriber as any).weekly_credits_available ?? 0;
        const currentMonthly = (selectedSubscriber as any).cuts_used_this_month ?? 0;
        const newWeekly = Math.max(0, currentWeekly - successfulCount);
        const newMonthly = currentMonthly + successfulCount;

        const { error: subUpdateError } = await supabase
          .from("subscription_progress")
          .update({
            weekly_credits_available: newWeekly,
            cuts_used_this_month: newMonthly,
            updated_at: new Date().toISOString(),
          })
          .eq("id", (selectedSubscriber as any).id);

        if (subUpdateError) {
          console.error("Error updating subscription credits:", subUpdateError);
        }
      }

      setShowUsageModal(false);
      setSelectedSubscriber(null);
      setSelectedBenefits(new Set());
      fetchData();
    } catch (error: any) {
      console.error("Error registering usage:", error);
      if (error.code === '23505') {
        toast.error("Aguarde alguns segundos e tente novamente");
      } else {
        toast.error("Erro ao registrar uso");
      }
    } finally {
      setRegisteringUsage(false);
    }
  };

  const filteredSubscribers = subscribers.filter(sub => {
    const name = sub.profile?.full_name?.toLowerCase() || "";
    const phone = sub.profile?.phone || "";
    return name.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm);
  });

  const usersWithoutSubscription = profiles.filter(
    p => !subscribers.find(s => s.user_id === p.user_id)
  );

  const calculateEndDate = (startDate: string, durationDays: number | null) => {
    const start = new Date(startDate);
    const end = addDays(start, durationDays || 30);
    return format(end, "dd/MM/yyyy", { locale: ptBR });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Crown className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Pacotes VIP</h2>
        <Button onClick={() => setShowAddModal(true)} className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          Novo
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/30">
          <TabsTrigger value="orders" className="data-[state=active]:bg-background gap-1">
            <CreditCard className="w-3.5 h-3.5" />
            Pedidos
            {orders.filter(o => o.payment_status === 'pending').length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {orders.filter(o => o.payment_status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="data-[state=active]:bg-background">
            Assinantes
          </TabsTrigger>
          <TabsTrigger value="packages" className="data-[state=active]:bg-background">
            Pacotes
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4 mt-4">
          {/* Summary Stats */}
          {(() => {
            const pendingCount = orders.filter(o => o.payment_status === 'pending').length;
            const confirmedCount = orders.filter(o => o.payment_status === 'confirmed').length;
            const renewalCount = orders.filter(o => o.notes?.includes('Renovação')).length;
            const purchaseCount = orders.filter(o => !o.notes?.includes('Renovação')).length;
            const totalRevenue = orders.filter(o => o.payment_status === 'confirmed').reduce((sum, o) => sum + o.amount, 0);

            return (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-card border border-border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-500">{confirmedCount}</p>
                    <p className="text-xs text-muted-foreground">Confirmados</p>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{renewalCount}</p>
                    <p className="text-xs text-muted-foreground">Renovações</p>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">R$ {totalRevenue.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">Receita Confirmada</p>
                  </div>
                </div>

                {/* Filter Buttons */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "all" as const, label: "Todos", count: orders.length },
                    { key: "pending" as const, label: "Pendentes", count: pendingCount },
                    { key: "confirmed" as const, label: "Confirmados", count: confirmedCount },
                    { key: "renewal" as const, label: "Renovações", count: renewalCount },
                    { key: "purchase" as const, label: "Compras", count: purchaseCount },
                  ].map(filter => (
                    <Button
                      key={filter.key}
                      size="sm"
                      variant={orderFilter === filter.key ? "default" : "outline"}
                      className="gap-1 text-xs"
                      onClick={() => setOrderFilter(filter.key)}
                    >
                      {filter.label}
                      <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] p-0 flex items-center justify-center text-[10px]">
                        {filter.count}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </>
            );
          })()}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pedido por nome..."
              value={orderSearchTerm}
              onChange={(e) => setOrderSearchTerm(e.target.value)}
              className="pl-10 bg-muted/30 border-muted"
            />
          </div>

          {(() => {
            let filteredOrders = orders.filter(o =>
              orderSearchTerm === "" ||
              (o.profile?.full_name || "").toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
              o.package_name.toLowerCase().includes(orderSearchTerm.toLowerCase())
            );

            // Apply filter
            if (orderFilter === "pending") {
              filteredOrders = filteredOrders.filter(o => o.payment_status === 'pending');
            } else if (orderFilter === "confirmed") {
              filteredOrders = filteredOrders.filter(o => o.payment_status === 'confirmed');
            } else if (orderFilter === "renewal") {
              filteredOrders = filteredOrders.filter(o => o.notes?.includes('Renovação'));
            } else if (orderFilter === "purchase") {
              filteredOrders = filteredOrders.filter(o => !o.notes?.includes('Renovação'));
            }

            // Show pending first
            const sortedOrders = [...filteredOrders].sort((a, b) => {
              if (a.payment_status === 'pending' && b.payment_status !== 'pending') return -1;
              if (a.payment_status !== 'pending' && b.payment_status === 'pending') return 1;
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });

            if (sortedOrders.length === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum pedido encontrado
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {sortedOrders.map(order => {
                  const isPending = order.payment_status === 'pending';
                  const isRenewal = order.notes?.includes('Renovação');

                  return (
                    <div 
                      key={order.id} 
                      className={`bg-card border rounded-lg p-4 ${
                        isPending ? 'border-amber-500/50 bg-amber-500/5' : 'border-border'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 space-y-1.5">
                          {/* Name + Badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground text-base">
                              {order.profile?.full_name || "Cliente"}
                            </span>
                            <Badge variant={isPending ? "outline" : "default"} className={
                              isPending 
                                ? "border-amber-500 text-amber-500" 
                                : "bg-green-600 hover:bg-green-600 text-white"
                            }>
                              {isPending ? (
                                <><Clock className="w-3 h-3 mr-1" /> Aguardando</>
                              ) : (
                                <><CheckCircle className="w-3 h-3 mr-1" /> Confirmado</>
                              )}
                            </Badge>
                            {isRenewal ? (
                              <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                                <RefreshCw className="w-3 h-3 mr-1" /> Renovação
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/30">
                                <ShoppingCart className="w-3 h-3 mr-1" /> Compra
                              </Badge>
                            )}
                            {/* Subscriber active status */}
                            {order.subscriber && (
                              <Badge variant="outline" className={`text-xs ${
                                order.subscriber.is_active 
                                  ? "border-green-500/50 text-green-500" 
                                  : "border-muted text-muted-foreground"
                              }`}>
                                {order.subscriber.is_active ? "Assinatura Ativa" : "Assinatura Inativa"}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Phone */}
                          <p className="text-sm text-muted-foreground">
                            📱 {order.profile?.phone || "Sem telefone"}
                          </p>
                          
                          {/* Package + Price */}
                          <p className="text-sm text-primary font-medium">
                            📦 {order.package_name} • <span className="text-foreground font-bold">R$ {order.amount.toFixed(2)}</span>
                          </p>

                          {/* Consecutive months */}
                          {order.subscriber && (
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-1 bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full text-xs font-bold border border-amber-500/30">
                                <Crown className="w-3 h-3" />
                                {order.subscriber.consecutive_months} {order.subscriber.consecutive_months === 1 ? "mês" : "meses"} consecutivo{order.subscriber.consecutive_months !== 1 ? "s" : ""}
                              </div>
                              {isRenewal && order.notes && (
                                <span className="text-xs text-muted-foreground italic">
                                  {order.notes}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Payment method */}
                          {order.payment_method && order.payment_status === 'confirmed' && (
                            <p className="text-xs text-muted-foreground">
                              💳 Pago via {order.payment_method === 'pix' ? 'PIX' : order.payment_method === 'dinheiro' ? 'Dinheiro' : order.payment_method === 'cartao' ? 'Cartão' : order.payment_method}
                            </p>
                          )}

                          {/* Date */}
                          <p className="text-xs text-muted-foreground">
                            🕐 {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        
                        {isPending && (
                          <div className="flex flex-col gap-2">
                            <p className="text-xs text-muted-foreground text-center font-medium">Confirmar pagamento:</p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="gap-1 text-xs bg-green-600 hover:bg-green-700"
                                onClick={() => confirmPaymentAndActivate(order, "pix")}
                              >
                                <DollarSign className="w-3 h-3" />
                                PIX
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-xs"
                                onClick={() => confirmPaymentAndActivate(order, "dinheiro")}
                              >
                                <DollarSign className="w-3 h-3" />
                                Dinheiro
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-xs"
                                onClick={() => confirmPaymentAndActivate(order, "cartao")}
                              >
                                <CreditCard className="w-3 h-3" />
                                Cartão
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1 text-xs w-full"
                              onClick={() => deletePendingOrder(order)}
                            >
                              <Trash2 className="w-3 h-3" />
                              Excluir Pedido
                            </Button>
                          </div>
                        )}

                        {!isPending && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={async () => {
                              if (!confirm(`Excluir registro de ${order.profile?.full_name || "Cliente"}?`)) return;
                              try {
                                const { error } = await supabase.from("package_payments").delete().eq("id", order.id);
                                if (error) throw error;
                                setOrders(prev => prev.filter(o => o.id !== order.id));
                                toast.success("Registro excluído");
                              } catch {
                                toast.error("Erro ao excluir");
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                            Excluir
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </TabsContent>

        {/* Packages Tab */}
        <TabsContent value="packages" className="space-y-4 mt-4">
          {/* Search and Add Package */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pacote..."
                value={packageSearchTerm}
                onChange={(e) => setPackageSearchTerm(e.target.value)}
                className="pl-10 bg-muted/30 border-muted"
              />
            </div>
            <Button 
              onClick={() => {
                setEditingPackage(null);
                setShowPackageEditor(true);
              }} 
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Adicionar Pacote
            </Button>
          </div>

          {/* Package Editor */}
          {showPackageEditor && (
            <PackageEditor
              packageToEdit={editingPackage}
              existingItems={packageItems}
              onClose={() => {
                setShowPackageEditor(false);
                setEditingPackage(null);
              }}
              onSave={() => fetchData()}
            />
          )}

          {/* Packages List */}
          {(() => {
            const filteredPackages = packages.filter(pkg => 
              packageSearchTerm === "" || 
              pkg.name.toLowerCase().includes(packageSearchTerm.toLowerCase()) ||
              (pkg.description && pkg.description.toLowerCase().includes(packageSearchTerm.toLowerCase()))
            );
            
            if (filteredPackages.length === 0 && !showPackageEditor) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  {packageSearchTerm ? "Nenhum pacote encontrado" : "Nenhum pacote cadastrado"}
                </div>
              );
            }
            
            return (
              <div className="space-y-3">
                {filteredPackages.map(pkg => {
                const items = packageItems.filter(i => i.package_id === pkg.id);
                const benefits = packageBenefits.filter(b => b.package_id === pkg.id);
                
                // Calculate total cuts for info display
                const totalCuts = items.reduce((sum, item) => {
                  const name = item.service_name.toLowerCase();
                  if (name.includes('corte') || name.includes('degradê') || name.includes('degrade')) {
                    return sum + item.quantity;
                  }
                  return sum;
                }, 0);
                const weeklyCredits = Math.max(1, Math.ceil(totalCuts / 4));
                
                return (
                  <div key={pkg.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{pkg.name}</h3>
                        <p className="text-sm text-muted-foreground">{pkg.description}</p>
                        {totalCuts > 0 && (
                          <p className="text-xs text-primary mt-1">
                            📊 {totalCuts} cortes = {weeklyCredits} crédito(s)/semana
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-lg font-bold text-primary">R$ {pkg.price}</span>
                          <p className="text-xs text-muted-foreground">{pkg.duration_days || 30} dias</p>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setEditingPackage(pkg);
                            setShowPackageEditor(true);
                          }}
                          className="shrink-0"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {items.map(item => (
                        <Badge key={item.id} variant="secondary" className="text-xs">
                          <Scissors className="w-3 h-3 mr-1" />
                          {item.quantity}x {item.service_name}
                        </Badge>
                      ))}
                      {benefits.map(benefit => (
                        <Badge key={benefit.id} variant="outline" className="text-xs">
                          <Scissors className="w-3 h-3 mr-1" />
                          {benefit.quantity || 1}x {benefit.service_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
              </div>
            );
          })()}
        </TabsContent>

        {/* Subscribers Tab */}
        <TabsContent value="subscribers" className="space-y-4 mt-4">
          {/* Search and Add */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-muted/30 border-muted"
              />
            </div>
            <Button onClick={() => setShowAddModal(true)} className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4" />
              Adicionar Assinatura
            </Button>
          </div>

          {/* Add Subscription Modal */}
          {showAddModal && (
            <div className="bg-card border border-primary/30 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-foreground">Nova Assinatura</h3>
              
              {usersWithoutSubscription.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todos os clientes já possuem assinatura
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Cliente</label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full p-2 rounded-lg bg-muted/30 border border-border text-foreground"
                      >
                        <option value="">Selecione um cliente...</option>
                        {usersWithoutSubscription.map(profile => (
                          <option key={profile.user_id} value={profile.user_id}>
                            {profile.full_name || "Sem nome"} - {profile.phone || "Sem telefone"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Pacote</label>
                      <select
                        value={selectedPackageId}
                        onChange={(e) => setSelectedPackageId(e.target.value)}
                        className="w-full p-2 rounded-lg bg-muted/30 border border-border text-foreground"
                      >
                        <option value="">Selecione um pacote...</option>
                        {packages.map(pkg => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.name} - R$ {pkg.price}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddModal(false);
                        setSelectedUserId("");
                        setSelectedPackageId("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={createSubscription}
                      disabled={!selectedUserId || !selectedPackageId}
                    >
                      Criar Assinatura
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Subscribers List */}
          {filteredSubscribers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum assinante encontrado
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSubscribers.map(sub => (
                <div 
                  key={sub.id} 
                  className={`bg-card border rounded-lg p-4 ${sub.is_active ? 'border-border' : 'border-muted opacity-60'}`}
                >
                  {/* Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground">
                          {sub.profile?.full_name || "Cliente"}
                        </span>
                        <Badge 
                          variant={sub.is_active ? "default" : "secondary"}
                          className={sub.is_active ? "bg-green-600 hover:bg-green-600 text-white" : ""}
                        >
                          {sub.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {sub.profile?.phone || "Sem telefone"}
                      </p>
                      <p className="text-sm text-primary font-medium mt-1">
                        {sub.package?.name || sub.package_name || "Sem pacote"} • R$ {sub.package?.price || 0}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full text-xs font-bold border border-amber-500/30">
                          <Crown className="w-3 h-3" />
                          {sub.consecutive_months} {sub.consecutive_months === 1 ? "mês" : "meses"} consecutivo{sub.consecutive_months !== 1 ? "s" : ""}
                        </div>
                      </div>
                      
                      {/* Weekly Credits Display */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                          sub.weekly_credits_available > 0 
                            ? "bg-green-500/20 text-green-500 border border-green-500/30" 
                            : "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                        }`}>
                          <Calendar className="w-3 h-3" />
                          {sub.weekly_credits_available}/{Math.max(1, Math.ceil(sub.monthly_cuts_limit / 4))} créditos/semana
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          ({sub.cuts_used_this_month}/{sub.monthly_cuts_limit} no mês)
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(sub.subscription_start_date), "dd/MM/yyyy", { locale: ptBR })} - {calculateEndDate(sub.subscription_start_date, sub.package?.duration_days || 30)}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={() => resetWeeklyCredits(sub.id, sub.monthly_cuts_limit)}
                        >
                          <RefreshCw className="w-3 h-3" />
                          Resetar Créditos
                        </Button>
                        <Button 
                          size="sm" 
                          variant="default"
                          className="gap-1 text-xs bg-primary hover:bg-primary/90"
                          onClick={() => openUsageModal(sub)}
                        >
                          <Scissors className="w-3 h-3" />
                          Registrar Uso
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={() => resetBenefitsUsage(sub.id)}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Resetar Benefícios
                        </Button>
                        <Button 
                          size="sm" 
                          variant="default"
                          className="gap-1 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={() => renewSubscription(sub)}
                          title="Gera um pedido pendente na aba Pedidos"
                        >
                          <ArrowRight className="w-3 h-3" />
                          Gerar Renovação
                        </Button>
                        {sub.is_active ? (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="gap-1 text-xs"
                             onClick={() => toggleSubscriptionStatus(sub.id, sub.is_active, sub)}
                          >
                            <X className="w-3 h-3" />
                            Pausar
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="default"
                            className="gap-1 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => toggleSubscriptionStatus(sub.id, sub.is_active, sub)}
                          >
                            <Check className="w-3 h-3" />
                            Ativar
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="gap-1 text-xs text-destructive hover:text-destructive"
                          onClick={() => deleteSubscription(sub.id, sub.profile?.full_name || "Cliente")}
                        >
                          <Trash2 className="w-3 h-3" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Benefits Usage */}
                  {sub.benefits.length > 0 && (
                    <div className="border-t border-border pt-3">
                      <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
                        Uso dos Benefícios
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {sub.benefits.map((benefit, idx) => {
                          const percentage = (benefit.used / benefit.quantity) * 100;
                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Scissors className="w-3 h-3" />
                                  {benefit.service_name}
                                </span>
                                <span className={`font-medium ${percentage >= 100 ? 'text-destructive' : 'text-primary'}`}>
                                  {benefit.used}/{benefit.quantity}
                                </span>
                              </div>
                              <Progress 
                                value={percentage} 
                                className={`h-1.5 ${percentage >= 100 ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Usage Registration Modal */}
      <Dialog open={showUsageModal} onOpenChange={(open) => {
        setShowUsageModal(open);
        if (!open) {
          setSelectedBenefits(new Set());
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-primary" />
              Registrar Uso - {selectedSubscriber?.profile?.full_name || "Cliente"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Info */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">
                ⚡ Selecione um ou mais serviços utilizados e clique em "Confirmar".
                O uso é contabilizado automaticamente pelos agendamentos. Use apenas para registros manuais.
              </p>
            </div>

            {/* Benefits List - Multiple Selection */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Selecione os serviços utilizados:
                {selectedBenefits.size > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedBenefits.size} selecionado{selectedBenefits.size > 1 ? 's' : ''}
                  </Badge>
                )}
              </p>
              
              {selectedSubscriber?.benefits.map((benefit, idx) => {
                const isAvailable = benefit.used < benefit.quantity;
                const percentage = (benefit.used / benefit.quantity) * 100;
                const isSelected = selectedBenefits.has(benefit.service_id);
                
                return (
                  <button
                    key={idx}
                    onClick={() => isAvailable && toggleBenefitSelection(benefit.service_id)}
                    disabled={!isAvailable}
                    className={`w-full p-3 rounded-lg border transition-all text-left ${
                      !isAvailable 
                        ? "border-muted bg-muted/20 opacity-50 cursor-not-allowed"
                        : isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "border-border hover:border-primary hover:bg-primary/5 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium flex items-center gap-2">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          isSelected 
                            ? "border-primary bg-primary" 
                            : isAvailable 
                              ? "border-muted-foreground" 
                              : "border-muted"
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        {benefit.service_name}
                      </span>
                      <Badge variant={percentage >= 100 ? "destructive" : "secondary"}>
                        {benefit.used}/{benefit.quantity}
                      </Badge>
                    </div>
                    <Progress 
                      value={percentage} 
                      className={`h-1.5 ${percentage >= 100 ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`}
                    />
                    {percentage >= 100 && (
                      <p className="text-xs text-destructive mt-2">
                        Limite atingido
                      </p>
                    )}
                  </button>
                );
              })}

              {(!selectedSubscriber?.benefits || selectedSubscriber.benefits.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum benefício encontrado para este pacote
                </p>
              )}
            </div>

            {/* Confirm Button */}
            {selectedSubscriber?.benefits && selectedSubscriber.benefits.length > 0 && (
              <Button
                onClick={registerMultipleUsage}
                disabled={selectedBenefits.size === 0 || registeringUsage}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
              >
                {registeringUsage ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirmar Uso {selectedBenefits.size > 0 && `(${selectedBenefits.size})`}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VIPPackagesManager;
