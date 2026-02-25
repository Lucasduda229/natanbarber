import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trophy, Plus, Edit2, Trash2, Gift, Users, Crown, Star, Award, Check, X, Clock, Package } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

// ---- Types ----
interface Reward {
  id: string;
  name: string;
  description: string | null;
  required_months: number;
  required_visits: number | null;
  reward_description: string;
  is_active: boolean;
  target_audience: string;
  requirement_type: string;
  created_at: string;
}

interface RewardClaim {
  id: string;
  reward_id: string | null;
  user_id: string;
  reward_name: string;
  reward_description: string;
  claimed_at: string;
  delivered_at: string | null;
  status: string;
  admin_notes: string | null;
  profiles?: {
    full_name: string | null;
    phone: string | null;
  } | null;
}

// ---- Reward Form (shared between Dialog & Drawer) ----
const RewardForm = ({ form, setForm, editing, onSubmit, onCancel }: {
  form: any;
  setForm: (f: any) => void;
  editing: Reward | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) => (
  <form onSubmit={onSubmit} className="space-y-4 px-1">
    <div className="space-y-1.5">
      <Label className="text-sm">Nome da Premiação *</Label>
      <Input
        placeholder="Ex: Copo Stanley"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="bg-background/50 border-primary/20 h-11"
      />
    </div>
    <div className="space-y-1.5">
      <Label className="text-sm">Descrição</Label>
      <Textarea
        placeholder="Detalhes sobre a premiação..."
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className="bg-background/50 border-primary/20 min-h-[60px]"
        rows={2}
      />
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-sm">Público-alvo *</Label>
        <Select value={form.target_audience} onValueChange={(v) => setForm({ ...form, target_audience: v })}>
          <SelectTrigger className="bg-background/50 border-primary/20 h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="subscribers">
              <span className="flex items-center gap-2"><Crown className="h-3 w-3" /> Assinantes</span>
            </SelectItem>
            <SelectItem value="all_clients">
              <span className="flex items-center gap-2"><Users className="h-3 w-3" /> Todos</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Requisito *</Label>
        <Select value={form.requirement_type} onValueChange={(v) => setForm({ ...form, requirement_type: v })}>
          <SelectTrigger className="bg-background/50 border-primary/20 h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="months">Meses</SelectItem>
            <SelectItem value="visits">Visitas</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    {form.requirement_type === "months" ? (
      <div className="space-y-1.5">
        <Label className="text-sm">Meses Consecutivos *</Label>
        <Input
          type="number"
          min={1}
          value={form.required_months}
          onChange={(e) => setForm({ ...form, required_months: parseInt(e.target.value) || 1 })}
          className="bg-background/50 border-primary/20 h-11"
        />
      </div>
    ) : (
      <div className="space-y-1.5">
        <Label className="text-sm">Visitas Necessárias *</Label>
        <Input
          type="number"
          min={1}
          value={form.required_visits}
          onChange={(e) => setForm({ ...form, required_visits: parseInt(e.target.value) || 1 })}
          className="bg-background/50 border-primary/20 h-11"
        />
      </div>
    )}

    <div className="space-y-1.5">
      <Label className="text-sm">Recompensa *</Label>
      <Input
        placeholder="Ex: Copo Stanley exclusivo"
        value={form.reward_description}
        onChange={(e) => setForm({ ...form, reward_description: e.target.value })}
        className="bg-background/50 border-primary/20 h-11"
      />
    </div>

    <div className="flex items-center gap-2">
      <Switch
        checked={form.is_active}
        onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
      />
      <Label className="text-sm">Ativa</Label>
    </div>

    <div className="flex gap-2 pt-2 pb-2">
      <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-12 rounded-2xl">
        Cancelar
      </Button>
      <Button type="submit" className="flex-1 h-12 rounded-2xl bg-gold-gradient font-semibold">
        {editing ? "Salvar" : "Criar"}
      </Button>
    </div>
  </form>
);

// ---- Rewards CRUD Section ----
const RewardsCRUDSection = () => {
  const isMobile = useIsMobile();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    requirement_type: "months" as "months" | "visits",
    required_months: 6,
    required_visits: 10,
    reward_description: "",
    target_audience: "subscribers" as "subscribers" | "all_clients",
    is_active: true,
  });

  useEffect(() => { fetchRewards(); }, []);

  const fetchRewards = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("subscriber_rewards")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setRewards(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ name: "", description: "", requirement_type: "months", required_months: 6, required_visits: 10, reward_description: "", target_audience: "subscribers", is_active: true });
    setEditing(null);
    setDialogOpen(false);
  };

  const handleEdit = (r: Reward) => {
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description || "",
      requirement_type: r.requirement_type as "months" | "visits",
      required_months: r.required_months,
      required_visits: r.required_visits || 10,
      reward_description: r.reward_description,
      target_audience: r.target_audience as "subscribers" | "all_clients",
      is_active: r.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.reward_description.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const payload = {
      name: form.name,
      description: form.description || null,
      requirement_type: form.requirement_type,
      required_months: form.requirement_type === "months" ? form.required_months : 0,
      required_visits: form.requirement_type === "visits" ? form.required_visits : null,
      reward_description: form.reward_description,
      target_audience: form.target_audience,
      is_active: form.is_active,
    };

    if (editing) {
      const { error } = await supabase.from("subscriber_rewards").update(payload).eq("id", editing.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Premiação atualizada!");
    } else {
      const { error } = await supabase.from("subscriber_rewards").insert([payload]);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Premiação criada!");
    }
    fetchRewards();
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta premiação?")) return;
    const { error } = await supabase.from("subscriber_rewards").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Premiação excluída!");
    fetchRewards();
  };

  const toggleActive = async (r: Reward) => {
    await supabase.from("subscriber_rewards").update({ is_active: !r.is_active }).eq("id", r.id);
    fetchRewards();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const formContent = (
    <RewardForm
      form={form}
      setForm={setForm}
      editing={editing}
      onSubmit={handleSubmit}
      onCancel={resetForm}
    />
  );

  const triggerButton = (
    <Button onClick={() => { setEditing(null); setForm({ name: "", description: "", requirement_type: "months", required_months: 6, required_visits: 10, reward_description: "", target_audience: "subscribers", is_active: true }); }} size="sm" className="bg-gold-gradient w-full sm:w-auto h-11 rounded-2xl text-sm font-semibold gap-1.5">
      <Plus className="h-4 w-4" /> Nova Premiação
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Crie premiações para assinantes recorrentes ou clientes em geral.
        </p>

        {isMobile ? (
          <Drawer open={dialogOpen} onOpenChange={setDialogOpen}>
            <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
            <DrawerContent className="bg-card border-primary/20 rounded-t-3xl px-4 pb-6 max-h-[90vh]">
              <DrawerHeader className="px-0 pb-2">
                <DrawerTitle className="text-foreground text-lg">
                  {editing ? "Editar Premiação" : "Nova Premiação"}
                </DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto">{formContent}</div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>{triggerButton}</DialogTrigger>
            <DialogContent className="bg-card border-primary/20 sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {editing ? "Editar Premiação" : "Nova Premiação"}
                </DialogTitle>
              </DialogHeader>
              {formContent}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {rewards.length === 0 ? (
        <Card className="bg-card/40 border-primary/20 rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Gift className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">Nenhuma premiação criada</p>
            <p className="text-xs text-muted-foreground mt-1">Crie sua primeira premiação</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rewards.map((r) => (
            <Card key={r.id} className={`bg-card/40 border-primary/20 rounded-2xl transition-all ${!r.is_active && "opacity-50"}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`p-1.5 rounded-xl ${r.is_active ? "bg-primary/15" : "bg-muted/30"}`}>
                      <Award className={`h-4 w-4 ${r.is_active ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{r.name}</p>
                      {r.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{r.description}</p>}
                    </div>
                  </div>
                  <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <Badge variant="outline" className="border-primary/30 text-primary text-[10px] rounded-lg px-2 py-0.5">
                    {r.target_audience === "subscribers" ? (
                      <><Crown className="h-3 w-3 mr-1" /> Assinantes</>
                    ) : (
                      <><Users className="h-3 w-3 mr-1" /> Todos</>
                    )}
                  </Badge>
                  <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-[10px] rounded-lg px-2 py-0.5">
                    {r.requirement_type === "months" ? (
                      <><Clock className="h-3 w-3 mr-1" /> {r.required_months} {r.required_months === 1 ? "mês" : "meses"}</>
                    ) : (
                      <><Star className="h-3 w-3 mr-1" /> {r.required_visits} visitas</>
                    )}
                  </Badge>
                  <Badge variant="outline" className="border-green-500/30 text-green-400 text-[10px] rounded-lg px-2 py-0.5">
                    <Gift className="h-3 w-3 mr-1" /> {r.reward_description}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(r)} className="flex-1 h-10 rounded-xl text-xs font-medium gap-1.5">
                    <Edit2 className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(r.id)} className="h-10 rounded-xl text-destructive hover:text-destructive px-3">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ---- Claims Management Section ----
const ClaimsManagementSection = () => {
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => { fetchClaims(); }, []);

  const fetchClaims = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reward_claims")
      .select("*")
      .order("claimed_at", { ascending: false });

    if (!error && data) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", userIds);

      const profileMap: Record<string, { full_name: string | null; phone: string | null }> = {};
      profiles?.forEach(p => { profileMap[p.user_id] = p; });

      setClaims(data.map(c => ({ ...c, profiles: profileMap[c.user_id] || null })));
    }
    setLoading(false);
  };

  const updateClaimStatus = async (claimId: string, status: string) => {
    const updateData: any = { status };
    if (status === "delivered") updateData.delivered_at = new Date().toISOString();
    const { error } = await supabase.from("reward_claims").update(updateData).eq("id", claimId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(status === "delivered" ? "Premiação marcada como entregue!" : "Status atualizado!");
    fetchClaims();
  };

  const filteredClaims = statusFilter === "all" ? claims : claims.filter(c => c.status === statusFilter);

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    delivered: "bg-green-500/20 text-green-400 border-green-500/30",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    delivered: "Entregue",
    cancelled: "Cancelado",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter pills for mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {[
          { value: "all", label: "Todos", count: claims.length },
          { value: "pending", label: "Pendentes", count: claims.filter(c => c.status === "pending").length },
          { value: "delivered", label: "Entregues", count: claims.filter(c => c.status === "delivered").length },
          { value: "cancelled", label: "Cancelados", count: claims.filter(c => c.status === "cancelled").length },
        ].map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              statusFilter === filter.value
                ? "bg-primary text-primary-foreground"
                : "bg-card/60 text-muted-foreground border border-primary/10 hover:border-primary/30"
            }`}
          >
            {filter.label}
            {filter.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                statusFilter === filter.value ? "bg-primary-foreground/20" : "bg-muted/50"
              }`}>
                {filter.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredClaims.length === 0 ? (
        <Card className="bg-card/40 border-primary/20 rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              {statusFilter === "all" ? "Nenhuma premiação solicitada ainda" : `Nenhuma premiação ${statusLabels[statusFilter]?.toLowerCase()}`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Quando clientes resgatarem prêmios, aparecerão aqui
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredClaims.map((claim) => (
            <Card key={claim.id} className="bg-card/40 border-primary/20 rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-foreground">
                        {claim.profiles?.full_name || "Cliente"}
                      </span>
                      <Badge variant="outline" className={`text-[10px] rounded-lg ${statusColors[claim.status]}`}>
                        {statusLabels[claim.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-primary font-medium">{claim.reward_name}</span> — {claim.reward_description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-3">
                  <Clock className="h-3 w-3" />
                  {format(new Date(claim.claimed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {claim.delivered_at && (
                    <span className="text-green-400">
                      · Entregue {format(new Date(claim.delivered_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  )}
                  {claim.profiles?.phone && <span>· {claim.profiles.phone}</span>}
                </div>

                {claim.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateClaimStatus(claim.id, "delivered")}
                      className="flex-1 h-10 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" /> Marcar Entregue
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateClaimStatus(claim.id, "cancelled")}
                      className="h-10 rounded-xl text-destructive hover:text-destructive px-4 text-xs gap-1.5"
                    >
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ---- Main Component ----
const RewardsManager = () => {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-primary/15">
          <Trophy className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Premiações</h2>
          <p className="text-xs text-muted-foreground">Configure e gerencie premiações</p>
        </div>
      </div>

      <Tabs defaultValue="rewards" className="w-full">
        <TabsList className="bg-card/60 border border-primary/20 w-full h-12 rounded-2xl p-1">
          <TabsTrigger value="rewards" className="flex-1 h-full rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-semibold gap-1.5">
            <Award className="w-4 h-4" />
            Premiações
          </TabsTrigger>
          <TabsTrigger value="claims" className="flex-1 h-full rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-semibold gap-1.5">
            <Package className="w-4 h-4" />
            Entregas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rewards" className="mt-4">
          <RewardsCRUDSection />
        </TabsContent>

        <TabsContent value="claims" className="mt-4">
          <ClaimsManagementSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RewardsManager;
