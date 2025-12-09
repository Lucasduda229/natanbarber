import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trophy, Plus, Edit2, Trash2, Gift, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface LoyaltyProgram {
  id: string;
  name: string;
  description: string | null;
  required_visits: number;
  reward_description: string;
  is_active: boolean;
  created_at: string;
}

const LoyaltyProgramManager = () => {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<LoyaltyProgram | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    required_visits: 10,
    reward_description: "",
    is_active: true,
  });

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("loyalty_programs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar programas");
    } else {
      setPrograms(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.reward_description.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (editingProgram) {
      const { error } = await supabase
        .from("loyalty_programs")
        .update(formData)
        .eq("id", editingProgram.id);

      if (error) {
        toast.error("Erro ao atualizar programa");
      } else {
        toast.success("Programa atualizado!");
        fetchPrograms();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from("loyalty_programs")
        .insert([formData]);

      if (error) {
        toast.error("Erro ao criar programa");
      } else {
        toast.success("Programa criado!");
        fetchPrograms();
        resetForm();
      }
    }
  };

  const handleEdit = (program: LoyaltyProgram) => {
    setEditingProgram(program);
    setFormData({
      name: program.name,
      description: program.description || "",
      required_visits: program.required_visits,
      reward_description: program.reward_description,
      is_active: program.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este programa?")) return;

    const { error } = await supabase
      .from("loyalty_programs")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir programa");
    } else {
      toast.success("Programa excluído!");
      fetchPrograms();
    }
  };

  const toggleActive = async (program: LoyaltyProgram) => {
    const { error } = await supabase
      .from("loyalty_programs")
      .update({ is_active: !program.is_active })
      .eq("id", program.id);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      fetchPrograms();
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      required_visits: 10,
      reward_description: "",
      is_active: true,
    });
    setEditingProgram(null);
    setDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <h2 className="text-lg sm:text-2xl font-bold text-foreground">Programas de Fidelidade</h2>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="bg-gold-gradient w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Novo Programa
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-primary/20 mx-3 sm:mx-0 max-w-[calc(100%-1.5rem)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingProgram ? "Editar Programa" : "Criar Programa de Fidelidade"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Programa *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Cartão Fidelidade VIP"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-background/50 border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o programa..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-background/50 border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visits">Visitas Necessárias *</Label>
                <Input
                  id="visits"
                  type="number"
                  min={1}
                  value={formData.required_visits}
                  onChange={(e) => setFormData({ ...formData, required_visits: parseInt(e.target.value) || 1 })}
                  className="bg-background/50 border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reward">Recompensa *</Label>
                <Input
                  id="reward"
                  placeholder="Ex: 1 corte de cabelo grátis"
                  value={formData.reward_description}
                  onChange={(e) => setFormData({ ...formData, reward_description: e.target.value })}
                  className="bg-background/50 border-primary/20"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="active">Programa ativo</Label>
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 bg-gold-gradient">
                  {editingProgram ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {programs.length === 0 ? (
        <Card className="bg-card/40 border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Gift className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg">Nenhum programa criado ainda</p>
            <p className="text-muted-foreground text-sm">Crie seu primeiro programa de fidelidade</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          {programs.map((program) => (
            <Card key={program.id} className={`bg-card/40 border-primary/20 transition-all ${!program.is_active && "opacity-60"}`}>
              <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Trophy className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${program.is_active ? "text-primary" : "text-muted-foreground"}`} />
                    <CardTitle className="text-base sm:text-lg text-foreground truncate">{program.name}</CardTitle>
                  </div>
                  <Switch
                    checked={program.is_active}
                    onCheckedChange={() => toggleActive(program)}
                  />
                </div>
                {program.description && (
                  <CardDescription className="text-muted-foreground text-sm line-clamp-2">{program.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>{program.required_visits} visitas</span>
                  </div>
                  <div className="flex items-center gap-1 text-primary">
                    <Gift className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="truncate max-w-[120px] sm:max-w-none">{program.reward_description}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(program)}
                    className="flex-1"
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(program.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
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

export default LoyaltyProgramManager;
