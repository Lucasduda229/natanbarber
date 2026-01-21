import { useState, useEffect } from "react";
import { Plus, Search, Scissors, X, Trash2, Crown, Calendar, RefreshCw, Pencil, RotateCcw, Check, ArrowRight } from "lucide-react";
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

const VIPPackagesManager = () => {
  const [activeTab, setActiveTab] = useState("subscribers");
  const [packages, setPackages] = useState<Package[]>([]);
  const [subscribers, setSubscribers] = useState<SubscriberWithUsage[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [packageItems, setPackageItems] = useState<PackageItem[]>([]);
  const [packageBenefits, setPackageBenefits] = useState<PackageBenefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPackageEditor, setShowPackageEditor] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedSubscriber, setSelectedSubscriber] = useState<SubscriberWithUsage | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all in parallel
      const [subsResult, packagesResult, profilesResult, itemsResult, benefitsResult, appointmentsResult, appointmentServicesResult] = await Promise.all([
        supabase.from("subscription_progress").select("*").order("is_active", { ascending: false }),
        supabase.from("packages").select("*").eq("active", true).order("name"),
        supabase.from("profiles").select("user_id, full_name, phone"),
        supabase.from("package_items").select("*"),
        supabase.from("package_benefits").select("*, services(name)"),
        supabase
          .from("appointments")
          .select("id, user_id, service_id, appointment_date, status, created_at")
          .in("status", ["completed", "confirmed"]),
        supabase.from("appointment_services").select("appointment_id, service_id")
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
      
      // Process benefits with service names
      const processedBenefits = (benefitsResult.data || []).map(b => ({
        ...b,
        service_name: (b.services as any)?.name || "Serviço"
      }));
      setPackageBenefits(processedBenefits);

      const completedAppointments = appointmentsResult.data || [];
      const appointmentServices = appointmentServicesResult.data || [];

      // Map subscribers with profiles and packages
      const subscribersWithData = (subsResult.data || []).map(sub => {
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

        // Combine into unified benefits list with actual usage
        const benefits: BenefitUsage[] = [];
        
        pkgItems.forEach(item => {
          const serviceId = item.service_id || '';
          benefits.push({
            service_id: serviceId,
            service_name: item.service_name,
            quantity: item.quantity,
            used: usageByService[serviceId] || 0
          });
        });
        
        pkgBenefits.forEach(benefit => {
          // Check if already added from package_items
          const existing = benefits.find(b => b.service_id === benefit.service_id);
          if (!existing) {
            benefits.push({
              service_id: benefit.service_id,
              service_name: benefit.service_name || "Serviço",
              quantity: benefit.quantity || 1,
              used: usageByService[benefit.service_id] || 0
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

  const toggleSubscriptionStatus = async (subId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("subscription_progress")
        .update({ is_active: !currentActive })
        .eq("id", subId);

      if (error) throw error;

      setSubscribers(prev => 
        prev.map(s => s.id === subId ? { ...s, is_active: !currentActive } : s)
      );

      toast.success(currentActive ? "Assinatura cancelada" : "Assinatura reativada");
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
    
    try {
      const { error } = await supabase
        .from("subscription_progress")
        .update({ 
          usage_reset_date: now
        })
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
    if (!confirm(`Renovar assinatura de ${sub.profile?.full_name || "Cliente"} para o próximo mês?`)) return;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const nowTimestamp = today.toISOString();
    
    // Calculate weekly credits based on monthly limit
    const weeklyCredits = Math.max(1, Math.ceil(sub.monthly_cuts_limit / 4));

    try {
      const { error } = await supabase
        .from("subscription_progress")
        .update({
          // Reset subscription start date to today
          subscription_start_date: todayStr,
          // Increment consecutive months
          consecutive_months: sub.consecutive_months + 1,
          // Reset monthly usage
          cuts_used_this_month: 0,
          current_month_start: todayStr,
          // Reset weekly credits
          weekly_credits_available: weeklyCredits,
          current_week_start: todayStr,
          credits_expired_this_month: 0,
          // Reset benefits usage timestamp
          usage_reset_date: nowTimestamp,
          // Update last payment date
          last_payment_date: todayStr,
          // Ensure active
          is_active: true,
          updated_at: nowTimestamp
        })
        .eq("id", sub.id);

      if (error) throw error;

      toast.success(`Assinatura renovada! ${sub.profile?.full_name || "Cliente"} agora está no mês ${sub.consecutive_months + 1}`);
      fetchData();
    } catch (error) {
      console.error("Error renewing subscription:", error);
      toast.error("Erro ao renovar assinatura");
    }
  };

  const openUsageModal = (subscriber: SubscriberWithUsage) => {
    setSelectedSubscriber(subscriber);
    setShowUsageModal(true);
  };

  const registerUsage = async (benefit: BenefitUsage) => {
    if (!selectedSubscriber) return;
    
    // Check if there are remaining credits for this benefit
    if (benefit.used >= benefit.quantity) {
      toast.error(`Limite de ${benefit.service_name} atingido`);
      return;
    }

    try {
      // Use a unique timestamp to avoid slot conflicts (use seconds as time)
      const now = new Date();
      const uniqueTime = `23:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const today = now.toISOString().split('T')[0];
      
      const { error: appointmentError } = await supabase
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

      if (appointmentError) throw appointmentError;

      toast.success(`Uso de ${benefit.service_name} registrado!`);
      setShowUsageModal(false);
      setSelectedSubscriber(null);
      fetchData();
    } catch (error: any) {
      console.error("Error registering usage:", error);
      if (error.code === '23505') {
        toast.error("Aguarde 1 segundo e tente novamente");
      } else {
        toast.error("Erro ao registrar uso");
      }
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
        <TabsList className="grid w-full grid-cols-2 bg-muted/30">
          <TabsTrigger value="packages" className="data-[state=active]:bg-background">
            Pacotes
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="data-[state=active]:bg-background">
            Assinantes
          </TabsTrigger>
        </TabsList>

        {/* Packages Tab */}
        <TabsContent value="packages" className="space-y-4 mt-4">
          {/* Add/Edit Package Button */}
          <div className="flex justify-end">
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
          {packages.length === 0 && !showPackageEditor ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum pacote cadastrado
            </div>
          ) : (
            <div className="space-y-3">
              {packages.map(pkg => {
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
          )}
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
                        >
                          <ArrowRight className="w-3 h-3" />
                          Renovar Mês
                        </Button>
                        {sub.is_active ? (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => toggleSubscriptionStatus(sub.id, sub.is_active)}
                          >
                            <X className="w-3 h-3" />
                            Pausar
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="default"
                            className="gap-1 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => toggleSubscriptionStatus(sub.id, sub.is_active)}
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
      <Dialog open={showUsageModal} onOpenChange={setShowUsageModal}>
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
                ⚡ O uso é contabilizado automaticamente pelos agendamentos confirmados/concluídos. 
                Use este botão apenas para registros manuais.
              </p>
            </div>

            {/* Benefits List */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Selecione o serviço utilizado:</p>
              
              {selectedSubscriber?.benefits.map((benefit, idx) => {
                const isAvailable = benefit.used < benefit.quantity;
                const percentage = (benefit.used / benefit.quantity) * 100;
                
                return (
                  <button
                    key={idx}
                    onClick={() => isAvailable && registerUsage(benefit)}
                    disabled={!isAvailable}
                    className={`w-full p-3 rounded-lg border transition-all text-left ${
                      isAvailable 
                        ? "border-border hover:border-primary hover:bg-primary/5 cursor-pointer" 
                        : "border-muted bg-muted/20 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium flex items-center gap-2">
                        <Scissors className="w-4 h-4" />
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
                    {isAvailable && (
                      <p className="text-xs text-primary mt-2 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Clique para registrar uso
                      </p>
                    )}
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VIPPackagesManager;
