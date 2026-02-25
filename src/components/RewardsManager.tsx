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
import { Trophy, Plus, Edit2, Trash2, Gift, Users, Crown, Star, Award } from "lucide-react";
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

// ---- Types ----
interface SubscriberReward {
  id: string;
  name: string;
  description: string | null;
  required_months: number;
  reward_description: string;
  is_active: boolean;
  target_audience: string;
  created_at: string;
}

interface LoyaltyProgram {
  id: string;
  name: string;
  description: string | null;
  required_visits: number;
  reward_description: string;
  is_active: boolean;
  created_at: string;
}

// ---- Subscriber Rewards Section ----
const SubscriberRewardsSection = () => {
  const [rewards, setRewards] = useState<SubscriberReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriberReward | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    required_months: 6,
    reward_description: "",
    is_active: true,
  });

  useEffect(() => { fetchRewards(); }, []);

  const fetchRewards = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("subscriber_rewards")
      .select("*")
      .eq("target_audience", "subscribers")
      .order("required_months", { ascending: true });
    if (!error) setRewards(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ name: "", description: "", required_months: 6, reward_description: "", is_active: true });
    setEditing(null);
    setDialogOpen(false);
  };

  const handleEdit = (r: SubscriberReward) => {
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description || "",
      required_months: r.required_months,
      reward_description: r.reward_description,
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
    const payload = { ...form, target_audience: "subscribers" };
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

  const toggleActive = async (r: SubscriberReward) => {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          <h3 className="text-base sm:text-lg font-bold text-foreground">Premiações por Meses Recorrentes</h3>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} size="sm" className="bg-gold-gradient w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Nova Premiação
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-primary/20 mx-3 sm:mx-0 max-w-[calc(100%-1.5rem)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editing ? "Editar Premiação" : "Nova Premiação para Assinantes"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Premiação *</Label>
                <Input
                  placeholder="Ex: Copo Stanley"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-background/50 border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Detalhes sobre a premiação..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-background/50 border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label>Meses Consecutivos Necessários *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.required_months}
                  onChange={(e) => setForm({ ...form, required_months: parseInt(e.target.value) || 1 })}
                  className="bg-background/50 border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label>Recompensa *</Label>
                <Input
                  placeholder="Ex: Copo Stanley exclusivo"
                  value={form.reward_description}
                  onChange={(e) => setForm({ ...form, reward_description: e.target.value })}
                  className="bg-background/50 border-primary/20"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
                <Label>Ativa</Label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">Cancelar</Button>
                <Button type="submit" className="flex-1 bg-gold-gradient">{editing ? "Salvar" : "Criar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-xs text-muted-foreground">
        Premiações automáticas para assinantes que mantêm a assinatura ativa por meses consecutivos.
      </p>

      {rewards.length === 0 ? (
        <Card className="bg-card/40 border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Crown className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma premiação de assinante criada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rewards.map((r) => (
            <Card key={r.id} className={`bg-card/40 border-primary/20 transition-all ${!r.is_active && "opacity-50"}`}>
              <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Award className={`h-4 w-4 flex-shrink-0 ${r.is_active ? "text-primary" : "text-muted-foreground"}`} />
                    <CardTitle className="text-sm sm:text-base text-foreground truncate">{r.name}</CardTitle>
                  </div>
                  <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                </div>
                {r.description && <CardDescription className="text-xs line-clamp-2 mt-1">{r.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3 px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    <Crown className="h-3 w-3 mr-1" /> {r.required_months} {r.required_months === 1 ? "mês" : "meses"}
                  </Badge>
                  <Badge variant="outline" className="border-green-500/30 text-green-400">
                    <Gift className="h-3 w-3 mr-1" /> {r.reward_description}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(r)} className="flex-1 text-xs">
                    <Edit2 className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(r.id)} className="text-destructive hover:text-destructive text-xs">
                    <Trash2 className="h-3 w-3" />
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

// ---- Visit Loyalty Section (reuses existing loyalty_programs table) ----
const VisitRewardsSection = () => {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LoyaltyProgram | null>(null);
  const [audienceFilter, setAudienceFilter] = useState<string>("all");
  const [form, setForm] = useState({
    name: "",
    description: "",
    required_visits: 10,
    reward_description: "",
    is_active: true,
  });

  useEffect(() => { fetchPrograms(); }, []);

  const fetchPrograms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("loyalty_programs")
      .select("*")
      .order("required_visits", { ascending: true });
    if (!error) setPrograms(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ name: "", description: "", required_visits: 10, reward_description: "", is_active: true });
    setEditing(null);
    setDialogOpen(false);
  };

  const handleEdit = (p: LoyaltyProgram) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || "",
      required_visits: p.required_visits,
      reward_description: p.reward_description,
      is_active: p.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.reward_description.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (editing) {
      const { error } = await supabase.from("loyalty_programs").update(form).eq("id", editing.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Programa atualizado!");
    } else {
      const { error } = await supabase.from("loyalty_programs").insert([form]);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Programa criado!");
    }
    fetchPrograms();
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este programa?")) return;
    const { error } = await supabase.from("loyalty_programs").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Programa excluído!");
    fetchPrograms();
  };

  const toggleActive = async (p: LoyaltyProgram) => {
    await supabase.from("loyalty_programs").update({ is_active: !p.is_active }).eq("id", p.id);
    fetchPrograms();
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          <h3 className="text-base sm:text-lg font-bold text-foreground">Premiações por Visitas</h3>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} size="sm" className="bg-gold-gradient w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Novo Programa
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-primary/20 mx-3 sm:mx-0 max-w-[calc(100%-1.5rem)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editing ? "Editar Programa" : "Novo Programa de Visitas"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Programa *</Label>
                <Input
                  placeholder="Ex: Cartão Fidelidade VIP"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-background/50 border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Detalhes do programa..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-background/50 border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label>Visitas Necessárias *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.required_visits}
                  onChange={(e) => setForm({ ...form, required_visits: parseInt(e.target.value) || 1 })}
                  className="bg-background/50 border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label>Recompensa *</Label>
                <Input
                  placeholder="Ex: 1 corte grátis"
                  value={form.reward_description}
                  onChange={(e) => setForm({ ...form, reward_description: e.target.value })}
                  className="bg-background/50 border-primary/20"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
                <Label>Ativo</Label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">Cancelar</Button>
                <Button type="submit" className="flex-1 bg-gold-gradient">{editing ? "Salvar" : "Criar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-xs text-muted-foreground">
        Programas de fidelidade baseados em número de visitas. Válido para todos os clientes.
      </p>

      {programs.length === 0 ? (
        <Card className="bg-card/40 border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Star className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum programa de visitas criado</p>
            <p className="text-xs text-muted-foreground mt-1">Crie programas para fidelizar seus clientes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {programs.map((p) => (
            <Card key={p.id} className={`bg-card/40 border-primary/20 transition-all ${!p.is_active && "opacity-50"}`}>
              <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Trophy className={`h-4 w-4 flex-shrink-0 ${p.is_active ? "text-primary" : "text-muted-foreground"}`} />
                    <CardTitle className="text-sm sm:text-base text-foreground truncate">{p.name}</CardTitle>
                  </div>
                  <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                </div>
                {p.description && <CardDescription className="text-xs line-clamp-2 mt-1">{p.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3 px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                    <Users className="h-3 w-3 mr-1" /> {p.required_visits} visitas
                  </Badge>
                  <Badge variant="outline" className="border-green-500/30 text-green-400">
                    <Gift className="h-3 w-3 mr-1" /> {p.reward_description}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(p)} className="flex-1 text-xs">
                    <Edit2 className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive text-xs">
                    <Trash2 className="h-3 w-3" />
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

// ---- Main Component ----
const RewardsManager = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-full bg-primary/20">
          <Trophy className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-foreground">Premiações</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Configure premiações para assinantes e clientes</p>
        </div>
      </div>

      <Tabs defaultValue="subscribers" className="w-full">
        <TabsList className="bg-card/60 border border-primary/20 w-full">
          <TabsTrigger value="subscribers" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm gap-1.5">
            <Crown className="w-4 h-4" />
            Assinantes
          </TabsTrigger>
          <TabsTrigger value="visits" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm gap-1.5">
            <Star className="w-4 h-4" />
            Visitas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscribers" className="mt-4">
          <SubscriberRewardsSection />
        </TabsContent>

        <TabsContent value="visits" className="mt-4">
          <VisitRewardsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RewardsManager;
