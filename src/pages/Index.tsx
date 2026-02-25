import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import AnimatedBackground from "@/components/AnimatedBackground";
import OpenClosedBadge from "@/components/OpenClosedBadge";
import { ServiceGallery } from "@/components/ServiceGallery";
import { ReviewsDisplay } from "@/components/ReviewsDisplay";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import logoImage from "@/assets/logo-barbershop.png";

const Index = () => {
  return (
    <div className="min-h-screen relative overflow-hidden safe-bottom">
      <AnimatedBackground />
      
      {/* PWA Install Button - Fixed Top Right */}
      <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-50">
        <PWAInstallButton />
      </div>
      
      {/* Hero Section */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[65vh] sm:min-h-[70vh] text-center px-4 py-8 sm:py-12">
        <div className="space-y-3 sm:space-y-4 w-full max-w-lg mx-auto">
          <div className="flex justify-center mb-4 sm:mb-6">
            <img 
              src={logoImage} 
              alt="Natan Barbershop Logo" 
              className="w-24 h-24 xs:w-28 xs:h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-primary/30 shadow-gold-glow-strong animate-float" 
            />
          </div>
          
          <a 
            href="https://www.instagram.com/_natan_barber_/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors group touch-target justify-center"
          >
            <Instagram className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-sm">@_natan_barber_</span>
          </a>
          
          <div className="flex justify-center">
            <OpenClosedBadge />
          </div>
          
          <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-7xl font-bold text-foreground animate-fade-in leading-tight">
            Natan Barbershop
          </h1>
          
          <p className="text-base xs:text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto animate-fade-in px-2">
            Agende seu horário de forma rápida e exclusiva
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 justify-center items-center animate-fade-in mt-6 sm:mt-8 w-full max-w-sm sm:max-w-none px-4">
          <Link to="/register" className="w-full sm:w-auto">
            <Button 
              size="lg" 
              className="w-full sm:w-auto bg-gold-gradient hover:opacity-90 text-background font-semibold px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg rounded-xl shadow-gold-glow transition-all hover:shadow-gold-glow-strong touch-target"
            >
              Criar Conta
            </Button>
          </Link>
          
          <Link to="/login" className="w-full sm:w-auto">
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full sm:w-auto border-primary bg-card/50 text-primary hover:bg-primary hover:text-background px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg rounded-xl transition-all shadow-md touch-target"
            >
              Já tenho conta
            </Button>
          </Link>
        </div>
      </div>

      {/* Gallery Section */}
      <div className="relative z-10 px-3 sm:px-4 pb-6 sm:pb-8 max-w-6xl mx-auto">
        <ServiceGallery />
      </div>

      {/* Reviews Section */}
      <div className="relative z-10 px-3 sm:px-4 pb-8 sm:pb-12 max-w-6xl mx-auto">
        <ReviewsDisplay />
      </div>
    </div>
  );
};

export default Index;