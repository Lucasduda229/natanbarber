import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { generateWhatsAppLink } from "@/lib/whatsapp";

interface WhatsAppButtonProps {
  phone: string;
  message: string;
  size?: "sm" | "default" | "icon";
  disabled?: boolean;
  className?: string;
}

export const WhatsAppButton = ({ 
  phone, 
  message, 
  size = "sm", 
  disabled,
  className = ""
}: WhatsAppButtonProps) => {
  const handleClick = () => {
    window.open(generateWhatsAppLink(phone, message), "_blank");
  };

  return (
    <Button
      size={size}
      onClick={handleClick}
      disabled={disabled || !phone}
      className={`bg-green-600 hover:bg-green-700 text-white ${className}`}
    >
      <MessageCircle className="w-4 h-4" />
      {size !== "icon" && <span className="ml-1">WhatsApp</span>}
    </Button>
  );
};
