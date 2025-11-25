import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface GhostInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
  error?: string;
}

const GhostInput = forwardRef<HTMLInputElement, GhostInputProps>(
  ({ className, icon: Icon, error, ...props }, ref) => {
    return (
      <div className="space-y-1">
        <div className="relative group">
          {Icon && (
            <Icon className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          )}
          <input
            ref={ref}
            className={cn(
              "w-full bg-transparent border-0 border-b border-input",
              "py-3 text-foreground placeholder:text-muted-foreground",
              "focus:outline-none focus:border-primary focus:shadow-gold-glow",
              "transition-all duration-300",
              Icon && "pl-7",
              error && "border-destructive",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-sm text-destructive animate-fade-in">{error}</p>
        )}
      </div>
    );
  }
);

GhostInput.displayName = "GhostInput";

export default GhostInput;
