import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import AnimatedBackground from "@/components/AnimatedBackground";
import OpenClosedBadge from "@/components/OpenClosedBadge";
import { ServiceGallery } from "@/components/ServiceGallery";
import { ReviewsDisplay } from "@/components/ReviewsDisplay";
import logoImage from "@/assets/logo-barbershop.png";

const Index = () => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />
      
      {/* Hero Section */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[70vh] text-center px-4 py-12">
        <div className="space-y-4">
          <div className="flex justify-center mb-6">
            <img 
              src={logoImage} 
              alt="Natan Barbershop Logo" 
              className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-primary/30 shadow-gold-glow-strong animate-float"
            />
          </div>
          
          <a 
            href="https://www.instagram.com/_natan_barber_/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors group"
          >
            <Instagram className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-sm">@_natan_barber_</span>
          </a>
          
          <div className="flex justify-center">
            <OpenClosedBadge />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-foreground animate-fade-in">
            Natan Barbershop
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto animate-fade-in">
            Estilo, Elegância e Precisão em Cada Corte
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in mt-8">
          <Link to="/register">
            <Button 
              size="lg"
              className="bg-gold-gradient hover:opacity-90 text-background font-semibold px-8 py-6 text-lg rounded-xl shadow-gold-glow transition-all hover:shadow-gold-glow-strong"
            >
              Criar Conta
            </Button>
          </Link>
          
          <Link to="/login">
            <Button 
              size="lg"
              variant="outline"
              className="border-primary/50 text-foreground hover:bg-primary/10 px-8 py-6 text-lg rounded-xl transition-all"
            >
              Já tenho conta
            </Button>
          </Link>
        </div>

        <p className="text-sm text-muted-foreground animate-fade-in mt-4">
          Agende seu horário de forma rápida e exclusiva
        </p>
      </div>

      {/* Gallery Section */}
      <div className="relative z-10 px-4 pb-8 max-w-6xl mx-auto">
        <ServiceGallery />
      </div>

      {/* Reviews Section */}
      <div className="relative z-10 px-4 pb-12 max-w-6xl mx-auto">
        <ReviewsDisplay />
      </div>
    </div>
  );
};

export default Index;
