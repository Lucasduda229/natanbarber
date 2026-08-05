import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, Image as ImageIcon, Store, Gift, Tag, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StoreProduct {
  id: string;
  name: string;
  image_url: string;
  cost_in_tickets: number;
  category?: string;
  active: boolean;
}

export function StoreManager() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  const [newProductName, setNewProductName] = useState("");
  const [newProductCost, setNewProductCost] = useState("");
  const [newProductImage, setNewProductImage] = useState<File | null>(null);
  const [newProductCategory, setNewProductCategory] = useState("Vales");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("store_products")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching store products:", error);
      toast.error("Erro ao carregar produtos da loja");
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewProductImage(e.target.files[0]);
    }
  };

  const handleAddProduct = async () => {
    if (!newProductName || !newProductCost) {
      toast.error("Preencha o nome e o custo em tickets!");
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = "";

      if (newProductImage) {
        const fileExt = newProductImage.name.split(".").pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from("products")
          .upload(filePath, newProductImage);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("products")
          .getPublicUrl(filePath);

        imageUrl = publicUrlData.publicUrl;
      }

      if (editingProductId) {
        const updateData: any = {
          name: newProductName,
          cost_in_tickets: parseInt(newProductCost),
          category: newProductCategory,
          active: true
        };
        if (imageUrl) {
          updateData.image_url = imageUrl;
        }

        const { error } = await supabase
          .from("store_products")
          .update(updateData)
          .eq("id", editingProductId);

        if (error) throw error;
        toast.success("Produto atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("store_products")
          .insert({
            name: newProductName,
            cost_in_tickets: parseInt(newProductCost),
            image_url: imageUrl,
            category: newProductCategory,
            active: true
          });

        if (error) throw error;
        toast.success("Produto adicionado com sucesso!");
      }

      setIsAddDialogOpen(false);
      setEditingProductId(null);
      setNewProductName("");
      setNewProductCost("");
      setNewProductCategory("Vales");
      setNewProductImage(null);
      fetchProducts();
    } catch (error: any) {
      console.error("Error adding product:", error);
      toast.error("Erro ao adicionar produto", { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    
    try {
      const { error } = await supabase
        .from("store_products")
        .delete()
        .eq("id", id);
        
      if (error) throw error;
      
      toast.success("Produto excluído com sucesso!");
      fetchProducts();
    } catch (error: any) {
      console.error("Error deleting product:", error);
      toast.error("Erro ao excluir produto");
    }
  };

  return (
    <Card className="bg-card/40 backdrop-blur-md border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            Loja de Produtos
          </CardTitle>
          <CardDescription>Gerencie os produtos disponíveis para resgate com tickets.</CardDescription>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setEditingProductId(null);
            setNewProductName("");
            setNewProductCost("");
            setNewProductCategory("Vales");
            setNewProductImage(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => {
              setEditingProductId(null);
              setNewProductName("");
              setNewProductCost("");
              setNewProductCategory("Vales");
              setNewProductImage(null);
            }}>
              <Plus className="w-4 h-4 mr-1" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProductId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Produto</Label>
                <Input 
                  id="name" 
                  value={newProductName} 
                  onChange={(e) => setNewProductName(e.target.value)} 
                  placeholder="Ex: Pomada Modeladora"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Custo (Quantidade de Tickets)</Label>
                <Input 
                  id="cost" 
                  type="number" 
                  min="1"
                  value={newProductCost} 
                  onChange={(e) => setNewProductCost(e.target.value)} 
                  placeholder="Ex: 5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image">Foto do Produto (Opcional)</Label>
                <Input 
                  id="image" 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <select 
                  id="category"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newProductCategory}
                  onChange={(e) => setNewProductCategory(e.target.value)}
                >
                  <option value="Vales">Vales & Cupons</option>
                  <option value="Produtos">Produtos Físicos</option>
                </select>
              </div>
              <Button 
                className="w-full" 
                onClick={handleAddProduct}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Salvando..." : "Salvar Produto"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            Nenhum produto cadastrado na loja.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {products.map((product) => (
              <div key={product.id} className="bg-background/60 border rounded-lg overflow-hidden flex flex-col">
                <div className="aspect-video bg-black/40 relative flex items-center justify-center p-2">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-contain rounded-sm" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                  )}
                </div>
                <div className="p-3 flex justify-between items-start gap-2">
                  <div>
                    <h4 className="font-semibold text-sm line-clamp-1">{product.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-primary font-medium flex items-center gap-1">
                        <Gift className="w-3 h-3" />
                        {product.cost_in_tickets} tickets
                      </p>
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded border flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {product.category || 'Produtos'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0 h-8 w-8"
                      onClick={() => {
                        setEditingProductId(product.id);
                        setNewProductName(product.name);
                        setNewProductCost(product.cost_in_tickets.toString());
                        setNewProductCategory(product.category || "Produtos");
                        setIsAddDialogOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10 shrink-0 h-8 w-8"
                      onClick={() => handleDeleteProduct(product.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
