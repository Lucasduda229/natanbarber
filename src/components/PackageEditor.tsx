import { useState, useEffect } from "react";
import { Plus, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Service {
  id: string;
  name: string;
  price: number;
}

interface PackageItem {
  service_id: string;
  service_name: string;
  quantity: number;
}

interface PackageData {
  id?: string;
  name: string;
  price: number;
  description: string;
  duration_days: number;
  items: PackageItem[];
}

interface PackageEditorProps {
  packageToEdit?: {
    id: string;
    name: string;
    price: number;
    description: string | null;
    duration_days: number | null;
  } | null;
  existingItems?: { package_id: string; service_id: string | null; service_name: string; quantity: number }[];
  onClose: () => void;
  onSave: () => void;
}

const PackageEditor = ({ packageToEdit, existingItems = [], onClose, onSave }: PackageEditorProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [packageData, setPackageData] = useState<PackageData>({
    id: undefined,
    name: "",
    price: 0,
    description: "",
    duration_days: 30,
    items: []
  });

  // Initialize/update package data when packageToEdit changes
  useEffect(() => {
    if (packageToEdit) {
      const items = existingItems
        .filter(i => i.package_id === packageToEdit.id)
        .map(i => ({
          service_id: i.service_id || "",
          service_name: i.service_name,
          quantity: i.quantity
        }));
      
      setPackageData({
        id: packageToEdit.id,
        name: packageToEdit.name,
        price: packageToEdit.price,
        description: packageToEdit.description || "",
        duration_days: packageToEdit.duration_days || 30,
        items
      });
    } else {
      setPackageData({
        id: undefined,
        name: "",
        price: 0,
        description: "",
        duration_days: 30,
        items: []
      });
    }
  }, [packageToEdit, existingItems]);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    const { data } = await supabase
      .from("services")
      .select("id, name, price")
      .eq("active", true)
      .order("name");
    
    if (data) setServices(data);
  };

  const addItem = () => {
    if (services.length === 0) return;
    
    const firstService = services[0];
    setPackageData(prev => ({
      ...prev,
      items: [...prev.items, { 
        service_id: firstService.id, 
        service_name: firstService.name, 
        quantity: 1 
      }]
    }));
  };

  const removeItem = (index: number) => {
    setPackageData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: keyof PackageItem, value: string | number) => {
    setPackageData(prev => {
      const newItems = [...prev.items];
      if (field === 'service_id') {
        const service = services.find(s => s.id === value);
        newItems[index] = {
          ...newItems[index],
          service_id: value as string,
          service_name: service?.name || ""
        };
      } else {
        newItems[index] = { ...newItems[index], [field]: value };
      }
      return { ...prev, items: newItems };
    });
  };

  // No auto-sync - quantities are set manually as configured in the package
  // Each service keeps its configured quantity exactly as the admin sets it

  const handleSave = async () => {
    if (!packageData.name.trim()) {
      toast.error("Nome do pacote é obrigatório");
      return;
    }
    if (packageData.price <= 0) {
      toast.error("Preço deve ser maior que zero");
      return;
    }
    if (packageData.items.length === 0) {
      toast.error("Adicione pelo menos um serviço ao pacote");
      return;
    }

    setLoading(true);

    try {
      // Use items exactly as configured (no auto-sync)
      const itemsToSave = [...packageData.items];

      if (packageData.id) {
        // UPDATE existing package
        const { error: pkgError } = await supabase
          .from("packages")
          .update({
            name: packageData.name,
            price: packageData.price,
            description: packageData.description || null,
            duration_days: packageData.duration_days
          })
          .eq("id", packageData.id);

        if (pkgError) throw pkgError;

        // Delete old items
        await supabase
          .from("package_items")
          .delete()
          .eq("package_id", packageData.id);

        // Insert new items
        const itemsToInsert = itemsToSave.map(item => ({
          package_id: packageData.id!,
          service_id: item.service_id,
          service_name: item.service_name,
          quantity: item.quantity
        }));

        const { error: itemsError } = await supabase
          .from("package_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        toast.success("Pacote atualizado com sucesso!");
      } else {
        // CREATE new package
        const { data: newPkg, error: pkgError } = await supabase
          .from("packages")
          .insert({
            name: packageData.name,
            price: packageData.price,
            description: packageData.description || null,
            duration_days: packageData.duration_days,
            active: true
          })
          .select()
          .single();

        if (pkgError || !newPkg) throw pkgError;

        // Insert items
        const itemsToInsert = itemsToSave.map(item => ({
          package_id: newPkg.id,
          service_id: item.service_id,
          service_name: item.service_name,
          quantity: item.quantity
        }));

        const { error: itemsError } = await supabase
          .from("package_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        toast.success("Pacote criado com sucesso!");
      }

      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving package:", error);
      toast.error("Erro ao salvar pacote");
    } finally {
      setLoading(false);
    }
  };

  // Calculate total cuts for weekly credits preview
  const totalCuts = packageData.items.reduce((sum, item) => {
    const name = item.service_name.toLowerCase();
    if (name.includes('corte') || name.includes('degradê') || name.includes('degrade')) {
      return sum + item.quantity;
    }
    return sum;
  }, 0);

  const weeklyCredits = Math.max(1, Math.ceil(totalCuts / 4));

  return (
    <div className="bg-card border border-primary/30 rounded-lg p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          {packageData.id ? "Editar Pacote" : "Novo Pacote"}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome do Pacote</Label>
          <Input
            value={packageData.name}
            onChange={(e) => setPackageData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Pacote Ouro"
            className="bg-muted/30"
          />
        </div>
        <div className="space-y-2">
          <Label>Preço (R$)</Label>
          <Input
            type="number"
            value={packageData.price}
            onChange={(e) => setPackageData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
            placeholder="0.00"
            className="bg-muted/30"
          />
        </div>
        <div className="space-y-2">
          <Label>Descrição (opcional)</Label>
          <Input
            value={packageData.description}
            onChange={(e) => setPackageData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Descrição do pacote..."
            className="bg-muted/30"
          />
        </div>
        <div className="space-y-2">
          <Label>Duração (dias)</Label>
          <Input
            type="number"
            value={packageData.duration_days}
            onChange={(e) => setPackageData(prev => ({ ...prev, duration_days: parseInt(e.target.value) || 30 }))}
            placeholder="30"
            className="bg-muted/30"
          />
        </div>
      </div>

      {/* Services/Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Serviços Incluídos</Label>
          <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
            <Plus className="w-3 h-3" />
            Adicionar Serviço
          </Button>
        </div>

        {packageData.items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum serviço adicionado. Clique em "Adicionar Serviço" para começar.
          </p>
        ) : (
          <div className="space-y-2">
            {packageData.items.map((item, index) => (
              <div key={index} className="flex items-center gap-3 bg-muted/20 p-3 rounded-lg">
                <select
                  value={item.service_id}
                  onChange={(e) => updateItem(index, 'service_id', e.target.value)}
                  className="flex-1 p-2 rounded-lg bg-background border border-border text-foreground"
                >
                  {services.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name} (R$ {service.price})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Qtd:</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-16 bg-background"
                  />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => removeItem(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Weekly credits info */}
        {totalCuts > 0 && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-sm">
            <p className="text-primary font-medium">
              📊 Créditos Semanais: {weeklyCredits} por semana ({totalCuts} cortes total)
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancelar
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={loading}
          className="flex-1 gap-2"
        >
          <Save className="w-4 h-4" />
          {loading ? "Salvando..." : "Salvar Pacote"}
        </Button>
      </div>
    </div>
  );
};

export default PackageEditor;
