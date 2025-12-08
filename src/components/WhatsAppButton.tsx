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
  const whatsappUrl = generateWhatsAppLink(phone, message);
  const isDisabled = disabled || !phone;

  // Usar link nativo em vez de window.open para evitar bloqueio de pop-up
  if (isDisabled) {
    return (
      <Button
        size={size}
        disabled
        className={`bg-green-600 hover:bg-green-700 text-white ${className}`}
      >
        <MessageCircle className="w-4 h-4" />
        {size !== "icon" && <span className="ml-1">WhatsApp</span>}
      </Button>
    );
  }

  return (
    <Button
      size={size}
      className={`bg-green-600 hover:bg-green-700 text-white ${className}`}
      asChild
    >
      <a 
        href={whatsappUrl} 
        target="_blank" 
        rel="noopener noreferrer"
      >
        <MessageCircle className="w-4 h-4" />
        {size !== "icon" && <span className="ml-1">WhatsApp</span>}
      </a>
    </Button>
  );
};
