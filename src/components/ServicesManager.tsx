import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Scissors, Plus, Pencil, Trash2, Clock, DollarSign, Crown, Save, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  active: boolean;
  subscribers_only: boolean | null;
  created_at: string;
}

interface ServiceFormData {
  name: string;
  description: string;
  price: string;
  duration_minutes: string;
  active: boolean;
  subscribers_only: boolean;
}

const initialFormData: ServiceFormData = {
  name: "",
  description: "",
  price: "",
  duration_minutes: "30",
  active: true,
  subscribers_only: false,
};

export const ServicesManager = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(initialFormData);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast.error("Erro ao carregar serviços");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        description: service.description || "",
        price: service.price.toString(),
        duration_minutes: service.duration_minutes.toString(),
        active: service.active,
        subscribers_only: service.subscribers_only || false,
      });
    } else {
      setEditingService(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingService(null);
    setFormData(initialFormData);
  };

  const handleSaveService = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome do serviço é obrigatório");
      return;
    }

    if (!formData.price || parseFloat(formData.price) < 0) {
      toast.error("Preço inválido");
      return;
    }

    if (formData.duration_minutes === "" || parseInt(formData.duration_minutes) < 0) {
      toast.error("Duração inválida");
      return;
    }

    setSaving(true);
    try {
      const serviceData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: parseFloat(formData.price),
        duration_minutes: parseInt(formData.duration_minutes),
        active: formData.active,
        subscribers_only: formData.subscribers_only,
      };

      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update(serviceData)
          .eq("id", editingService.id);

        if (error) throw error;
        toast.success("Serviço atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("services").insert(serviceData);

        if (error) throw error;
        toast.success("Serviço criado com sucesso!");
      }

      handleCloseDialog();
      fetchServices();
    } catch (error) {
      console.error("Error saving service:", error);
      toast.error("Erro ao salvar serviço");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (service: Service) => {
    try {
      const { error } = await supabase
        .from("services")
        .update({ active: !service.active })
        .eq("id", service.id);

      if (error) throw error;
      toast.success(service.active ? "Serviço desativado" : "Serviço ativado");
      fetchServices();
    } catch (error) {
      console.error("Error toggling service:", error);
      toast.error("Erro ao alterar status do serviço");
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", serviceId);

      if (error) throw error;
      toast.success("Serviço excluído com sucesso!");
      fetchServices();
    } catch (error: any) {
      console.error("Error deleting service:", error);
      if (error.message?.includes("violates foreign key constraint")) {
        toast.error("Não é possível excluir: serviço possui agendamentos vinculados");
      } else {
        toast.error("Erro ao excluir serviço");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
          <CardTitle className="flex items-center gap-2 text-foreground text-base sm:text-lg">
            <Scissors className="w-5 h-5 text-primary" />
            Serviços ({services.length})
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-gold-gradient text-background w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Serviço
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-primary/20 mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {editingService ? "Editar Serviço" : "Novo Serviço"}
                </DialogTitle>
                <DialogDescription>
                  {editingService
                    ? "Altere as informações do serviço"
                    : "Preencha os dados do novo serviço"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Serviço *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Corte Tradicional"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="bg-background/50 border-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Descrição opcional do serviço"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="bg-background/50 border-primary/20 min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Preço (R$) *</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                      className="bg-background/50 border-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Duração (min) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="0"
                      step="5"
                      placeholder="30"
                      value={formData.duration_minutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          duration_minutes: e.target.value,
                        })
                      }
                      className="bg-background/50 border-primary/20"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-background/30 border border-primary/10">
                  <div className="space-y-0.5">
                    <Label htmlFor="active" className="cursor-pointer">
                      Serviço Ativo
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Serviços inativos não aparecem para clientes
                    </p>
                  </div>
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, active: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="subscribers_only"
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <Crown className="w-4 h-4 text-amber-500" />
                      Exclusivo Assinantes
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Apenas assinantes podem agendar este serviço
                    </p>
                  </div>
                  <Switch
                    id="subscribers_only"
                    checked={formData.subscribers_only}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, subscribers_only: checked })
                    }
                  />
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={handleCloseDialog}
                  className="w-full sm:w-auto"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveService}
                  disabled={saving}
                  className="bg-gold-gradient text-background w-full sm:w-auto"
                >
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {editingService ? "Salvar Alterações" : "Criar Serviço"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          {services.length === 0 ? (
            <div className="text-center py-12">
              <Scissors className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum serviço cadastrado</p>
              <p className="text-sm text-muted-foreground/70">
                Clique em "Novo Serviço" para adicionar
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((service) => (
                <div
                  key={service.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border transition-all gap-3 ${
                    service.active
                      ? "bg-background/30 border-primary/20 hover:border-primary/40"
                      : "bg-muted/20 border-muted/30 opacity-60"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-foreground truncate">
                        {service.name}
                      </h3>
                      {!service.active && (
                        <Badge variant="secondary" className="text-xs">
                          Inativo
                        </Badge>
                      )}
                      {service.subscribers_only && (
                        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">
                          <Crown className="w-3 h-3 mr-1" />
                          VIP
                        </Badge>
                      )}
                    </div>
                    {service.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {service.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-primary" />
                        R$ {service.price.toFixed(2)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        {service.duration_minutes} min
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(service)}
                      className="border-primary/30 hover:bg-primary/10 h-9"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(service)}
                      className={`h-9 ${
                        service.active
                          ? "border-muted/50 hover:bg-muted/20"
                          : "border-green-500/50 text-green-500 hover:bg-green-500/10"
                      }`}
                    >
                      {service.active ? "Desativar" : "Ativar"}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-destructive/50 text-destructive hover:bg-destructive/10 h-9"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-destructive/20 mx-4 max-w-[calc(100vw-2rem)] sm:max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-destructive">
                            Excluir Serviço
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir{" "}
                            <strong>"{service.name}"</strong>?
                            <br />
                            <br />
                            Esta ação não pode ser desfeita. Se houver
                            agendamentos vinculados, a exclusão será bloqueada.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                          <AlertDialogCancel className="w-full sm:w-auto">
                            Cancelar
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteService(service.id)}
                            className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
