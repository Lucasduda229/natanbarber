import { useState, useEffect } from "react";
import { Plus, Search, Scissors, X, Trash2, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  is_active: boolean;
  package_id: string | null;
  package_name: string | null;
  monthly_cuts_limit: number;
  cuts_used_this_month: number;
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
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all in parallel
      const [subsResult, packagesResult, profilesResult, itemsResult, benefitsResult] = await Promise.all([
        supabase.from("subscription_progress").select("*").order("is_active", { ascending: false }),
        supabase.from("packages").select("*").eq("active", true).order("price"),
        supabase.from("profiles").select("user_id, full_name, phone"),
        supabase.from("package_items").select("*"),
        supabase.from("package_benefits").select("*, services(name)")
      ]);

      if (subsResult.error) throw subsResult.error;
      if (packagesResult.error) throw packagesResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (benefitsResult.error) throw benefitsResult.error;

      setPackages(packagesResult.data || []);
      setProfiles(profilesResult.data || []);
      setPackageItems(itemsResult.data || []);
      
      // Process benefits with service names
      const processedBenefits = (benefitsResult.data || []).map(b => ({
        ...b,
        service_name: (b.services as any)?.name || "Serviço"
      }));
      setPackageBenefits(processedBenefits);

      // Map subscribers with profiles and packages
      const subscribersWithData = (subsResult.data || []).map(sub => {
        const profile = profilesResult.data?.find(p => p.user_id === sub.user_id);
        const pkg = packagesResult.data?.find(p => p.id === sub.package_id);
        
        // Get all benefits for this package (from package_items + package_benefits)
        const pkgItems = (itemsResult.data || []).filter(i => i.package_id === sub.package_id);
        const pkgBenefits = processedBenefits.filter(b => b.package_id === sub.package_id);
        
        // Combine into unified benefits list
        const benefits: BenefitUsage[] = [];
        
        pkgItems.forEach(item => {
          benefits.push({
            service_id: item.service_id || item.id,
            service_name: item.service_name,
            quantity: item.quantity,
            used: 0 // TODO: Track actual usage from client_package_usage
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
              used: 0
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

    const durationDays = pkg.duration_days || 30;
    const startDate = new Date();
    const endDate = addDays(startDate, durationDays);

    try {
      const { error } = await supabase
        .from("subscription_progress")
        .insert({
          user_id: selectedUserId,
          subscription_start_date: startDate.toISOString().split('T')[0],
          package_id: selectedPackageId,
          package_name: pkg.name,
          monthly_cuts_limit: 4,
          weekly_credits_available: 1,
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

  const registerUsage = async (subId: string, serviceId: string) => {
    // TODO: Implement actual usage registration via client_package_usage
    toast.info("Funcionalidade em desenvolvimento");
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
          {packages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum pacote cadastrado
            </div>
          ) : (
            <div className="space-y-3">
              {packages.map(pkg => {
                const items = packageItems.filter(i => i.package_id === pkg.id);
                const benefits = packageBenefits.filter(b => b.package_id === pkg.id);
                
                return (
                  <div key={pkg.id} className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-foreground">{pkg.name}</h3>
                        <p className="text-sm text-muted-foreground">{pkg.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-primary">R$ {pkg.price}</span>
                        <p className="text-xs text-muted-foreground">{pkg.duration_days || 30} dias</p>
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
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(sub.subscription_start_date), "dd/MM/yyyy", { locale: ptBR })} - {calculateEndDate(sub.subscription_start_date, sub.package?.duration_days || 30)}
                      </span>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={() => registerUsage(sub.id, "")}
                        >
                          <Scissors className="w-3 h-3" />
                          Registrar Uso
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={() => toggleSubscriptionStatus(sub.id, sub.is_active)}
                        >
                          <X className="w-3 h-3" />
                          Cancelar
                        </Button>
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
    </div>
  );
};

export default VIPPackagesManager;
