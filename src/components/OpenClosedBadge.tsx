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
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm transition-all ${
        isOpen
          ? "bg-green-500/10 border-green-500/30 text-green-500"
          : "bg-red-500/10 border-red-500/30 text-red-500"
      }`}
    >
      {isOpen ? (
        <>
          <DoorOpen className="w-4 h-4" />
          <span className="text-sm font-medium">Aberto</span>
        </>
      ) : (
        <>
          <DoorClosed className="w-4 h-4" />
          <span className="text-sm font-medium">Fechado</span>
        </>
      )}
    </div>
  );
};

export default OpenClosedBadge;
