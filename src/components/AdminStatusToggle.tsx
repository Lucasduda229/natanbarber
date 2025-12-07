import { useEffect, useState } from "react";
import { DoorOpen, DoorClosed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const AdminStatusToggle = () => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    const { data, error } = await supabase
      .from("barbershop_status")
      .select("id, is_open")
      .limit(1)
      .single();

    if (!error && data) {
      setIsOpen(data.is_open);
    }
    setLoading(false);
  };

  const toggleStatus = async () => {
    setUpdating(true);
    
    const { data: statusData } = await supabase
      .from("barbershop_status")
      .select("id")
      .limit(1)
      .single();

    if (!statusData) {
      toast.error("Erro ao encontrar status");
      setUpdating(false);
      return;
    }

    const { error } = await supabase
      .from("barbershop_status")
      .update({ is_open: !isOpen, updated_at: new Date().toISOString() })
      .eq("id", statusData.id);

    if (error) {
      toast.error("Erro ao atualizar status");
      setUpdating(false);
      return;
    }

    setIsOpen(!isOpen);
    toast.success(`Barbearia agora está ${!isOpen ? "Aberta" : "Fechada"}`);
    setUpdating(false);
  };

  if (loading) {
    return (
      <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
        <CardContent className="p-4 flex items-center justify-center">
          <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`backdrop-blur-xl ${isOpen ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-foreground text-lg">
          {isOpen ? <DoorOpen className="w-5 h-5 text-green-500" /> : <DoorClosed className="w-5 h-5 text-red-500" />}
          Status da Barbearia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isOpen ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            <span className={`font-semibold ${isOpen ? "text-green-500" : "text-red-500"}`}>
              {isOpen ? "Aberta" : "Fechada"}
            </span>
          </div>
          <Button
            onClick={toggleStatus}
            disabled={updating}
            variant="outline"
            className={`${
              isOpen
                ? "border-red-500/30 text-red-500 hover:bg-red-500/10"
                : "border-green-500/30 text-green-500 hover:bg-green-500/10"
            }`}
          >
            {updating ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isOpen ? (
              <>
                <DoorClosed className="w-4 h-4 mr-2" />
                Fechar
              </>
            ) : (
              <>
                <DoorOpen className="w-4 h-4 mr-2" />
                Abrir
              </>
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {isOpen 
            ? "Clientes podem visualizar que a barbearia está aberta." 
            : "Clientes verão que a barbearia está fechada."}
        </p>
      </CardContent>
    </Card>
  );
};

export default AdminStatusToggle;
