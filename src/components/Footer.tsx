import { Scissors, Instagram, MessageCircle, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

const LOCATION = {
  address: "Rua Visconde de Barbacena, 99999",
  neighborhood: "Barro Branco, Lauro Müller - SC",
  cep: "CEP: 88882-000, Brasil",
};

const GOOGLE_MAPS_URL = "https://www.google.com/maps/search/?api=1&query=Rua+Visconde+de+Barbacena+99999+Barro+Branco+Lauro+Muller+SC";

export function Footer() {
  return (
    <footer className="bg-[#0f0f0f] text-[#a1a1aa] py-12 px-4 sm:px-6 relative z-10 w-full mt-auto border-t border-white/5">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-10 md:gap-4 mb-10">
        
        {/* Left Side: Brand & Description */}
        <div className="flex flex-col gap-4 max-w-sm">
          <div className="flex items-center gap-2">
            <Scissors className="w-6 h-6 text-red-600 transform -scale-x-100" />
            <span className="text-white text-xl font-serif tracking-widest uppercase">
              Natan Barbershop
            </span>
          </div>
          <p className="text-sm leading-relaxed">
            Tradição e estilo em cada corte. Sua barbearia premium.
          </p>
        </div>

        {/* Middle: Location Card */}
        <div className="flex-1 max-w-sm w-full">
          <div className="bg-card/60 backdrop-blur-xl rounded-xl border-l-4 border-l-primary border-y border-r border-primary/10 overflow-hidden shadow-md">
            <div className="p-4">
              <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Nossa Localização
              </h3>
              <div className="text-muted-foreground text-sm space-y-0.5 mb-4">
                <p>{LOCATION.address}</p>
                <p className="text-xs">{LOCATION.neighborhood}</p>
                <p className="text-xs opacity-70">{LOCATION.cep}</p>
              </div>
              <a 
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button 
                  className="w-full bg-primary/90 hover:bg-primary text-background font-medium h-11 rounded-lg active:scale-[0.98] transition-transform"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Ver Rota no Google Maps
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Right Side: Contact */}
        <div className="flex flex-col gap-4">
          <h3 className="text-white text-sm font-bold tracking-widest uppercase mb-1">
            CONTATO
          </h3>
          <div className="flex items-center gap-2 text-sm hover:text-white transition-colors cursor-pointer">
            <MessageCircle className="w-5 h-5" />
            <span>(48) 9952-0220</span>
          </div>
          <div className="flex items-center mt-2">
            <a 
              href="https://www.instagram.com/_natan_barber_/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#a1a1aa] hover:text-white transition-colors flex items-center gap-2"
            >
              <Instagram className="w-5 h-5" />
              <span className="text-sm">@_natan_barber_</span>
            </a>
          </div>
        </div>

      </div>

      {/* Bottom Separator & Copyright */}
      <div className="max-w-6xl mx-auto border-t border-white/10 pt-6 text-center text-xs text-[#71717a]">
        © 2026 Barbearia Natan Barbershop. Todos os direitos reservados.
      </div>
    </footer>
  );
}
