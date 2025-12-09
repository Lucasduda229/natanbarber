import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { toast } from "sonner";

export const OfflineIndicator = () => {
  const { isOnline } = usePWA();
  const [showIndicator, setShowIndicator] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowIndicator(true);
      setWasOffline(true);
    } else {
      if (wasOffline) {
        toast.success("Conexão restaurada!", {
          icon: <Wifi className="h-4 w-4" />,
        });
        setWasOffline(false);
      }
      // Hide indicator after a short delay when back online
      const timer = setTimeout(() => setShowIndicator(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!showIndicator) return null;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all duration-300 ${
        isOnline
          ? "bg-green-500/90 text-white"
          : "bg-destructive/90 text-destructive-foreground"
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4" />
          <span className="text-sm font-medium">Online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">Sem conexão</span>
        </>
      )}
    </div>
  );
};
