import { useEffect, useState } from "react";
import { DoorOpen, DoorClosed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const OpenClosedBadge = () => {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('barbershop-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'barbershop_status' },
        () => fetchStatus()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStatus = async () => {
    const { data, error } = await supabase
      .from("barbershop_status")
      .select("is_open")
      .limit(1)
      .single();

    if (!error && data) {
      setIsOpen(data.is_open);
    }
    setLoading(false);
  };

  if (loading || isOpen === null) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
        isOpen
          ? "text-green-500"
          : "text-red-500"
      }`}
    >
      <div className={`w-2.5 h-2.5 rounded-full ${isOpen ? "bg-green-500" : "bg-red-500"} animate-pulse`} />
      <span className="text-sm font-medium">{isOpen ? "Aberto Agora" : "Fechado"}</span>
    </div>
  );
};

export default OpenClosedBadge;
