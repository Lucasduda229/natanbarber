import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AnimatedBackground from "@/components/AnimatedBackground";
import OpenClosedBadge from "@/components/OpenClosedBadge";
import logoImage from "@/assets/logo-barbershop.png";

const Index = () => {
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      <AnimatedBackground />
      
      <div className="relative z-10 text-center space-y-8 px-4">
        <div className="space-y-4">
          <div className="flex justify-center mb-6">
            <img 
              src={logoImage} 
              alt="Natan Barbershop Logo" 
              className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-primary/30 shadow-gold-glow-strong animate-float"
            />
          </div>
          
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

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in">
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

        <p className="text-sm text-muted-foreground animate-fade-in">
          Agende seu horário de forma rápida e exclusiva
        </p>
      </div>
    </div>
  );
};

export default Index;
