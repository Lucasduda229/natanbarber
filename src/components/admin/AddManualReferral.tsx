import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Search, User as UserIcon } from "lucide-react";

export function AddManualReferral({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [amount, setAmount] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchClients();
    } else {
      setSelectedClient(null);
      setSearch("");
      setAmount(1);
    }
  }, [open]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .order("full_name", { ascending: true });
        
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const filteredClients = clients.filter(c => 
    c.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    c.phone?.includes(search)
  ).slice(0, 5); // show top 5

  const handleAdd = async () => {
    if (!selectedClient) {
      toast.error("Selecione um cliente");
      return;
    }
    if (amount < 1) {
      toast.error("A quantidade deve ser maior que 0");
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch current profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("total_referrals, referrals_balance, tickets_balance")
        .eq("user_id", selectedClient.user_id)
        .single();

      if (profileError) throw profileError;

      // 2. Calculate new values
      const ticketsToAdd = amount * 2;
      const newTotal = (profile.total_referrals || 0) + amount;
      const newBalance = (profile.referrals_balance || 0) + amount;
      const newTickets = (profile.tickets_balance || 0) + ticketsToAdd;

      // 3. Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          total_referrals: newTotal,
          referrals_balance: newBalance,
          tickets_balance: newTickets
        })
        .eq("user_id", selectedClient.user_id);

      if (updateError) throw updateError;

      // 4. Register in history for each added referral
      const historyInserts = Array.from({ length: amount }).map(() => ({
        referrer_id: selectedClient.user_id,
        referred_id: selectedClient.user_id, // Same ID indicates manual entry
        is_valid: true,
      }));
      
      const { error: historyError } = await supabase
        .from("referral_history")
        .insert(historyInserts);
        
      if (historyError) {
        console.warn("Could not insert history:", historyError);
        // We won't block the success message if only history fails
      }

      toast.success(`${amount} indicações adicionadas para ${selectedClient.full_name}!`, {
        description: `Foram adicionados ${ticketsToAdd} tickets de bônus.`
      });
      
      setOpen(false);
      onAdded();
    } catch (error: any) {
      console.error("Error adding manual referral:", error);
      toast.error("Erro ao adicionar indicações");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-primary/50 text-primary">
          <Plus className="w-4 h-4 mr-1" />
          Adicionar Indicações
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Indicações Manualmente</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {!selectedClient ? (
            <div className="space-y-3">
              <Label>Buscar Cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Nome ou telefone..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {search && (
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {filteredClients.length > 0 ? (
                    filteredClients.map(c => (
                      <div 
                        key={c.user_id} 
                        className="p-3 flex items-center justify-between hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedClient(c)}
                      >
                        <div>
                          <p className="font-medium text-sm">{c.full_name || "Sem Nome"}</p>
                          <p className="text-xs text-muted-foreground">{c.phone}</p>
                        </div>
                        <Button size="sm" variant="ghost">Selecionar</Button>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhum cliente encontrado.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{selectedClient.full_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedClient.phone}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedClient(null)}>
                  Trocar
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Quantidade de Indicações</Label>
                <Input 
                  type="number" 
                  min="1" 
                  value={amount} 
                  onChange={(e) => setAmount(parseInt(e.target.value) || 1)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  * O cliente receberá {amount * 2} tickets para a loja automaticamente.
                </p>
              </div>

              <Button 
                className="w-full bg-primary text-primary-foreground" 
                onClick={handleAdd}
                disabled={loading}
              >
                {loading ? "Processando..." : "Confirmar"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
