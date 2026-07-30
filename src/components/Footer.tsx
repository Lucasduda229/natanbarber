import { Scissors, Instagram, MessageCircle, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import whatsappIcon from "@/assets/whatsapp-icon.svg";

const LOCATION = {
  address: "Rua Visconde de Barbacena, 99999",
  neighborhood: "Barro Branco, Lauro Müller - SC",
  cep: "CEP: 88882-000, Brasil",
};

const GOOGLE_MAPS_URL = "https://www.google.com/maps/search/?api=1&query=Rua+Visconde+de+Barbacena+99999+Barro+Branco+Lauro+Muller+SC";

export function Footer() {
  return (
    <footer className="bg-transparent text-[#a1a1aa] pt-12 pb-4 px-4 sm:px-6 relative z-10 w-full mt-auto border-t border-white/5">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-10 md:gap-4 mb-8">
        
        {/* Left Side: Brand & Description */}
        <div className="flex flex-col gap-4 max-w-sm">
          <div className="flex items-center gap-2">
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
            <img src={whatsappIcon} alt="WhatsApp" className="w-5 h-5" />
            <span>(48) 9952-0220</span>
          </div>
          <div className="flex items-center mt-2">
            <a 
              href="https://www.instagram.com/_natan_barber_/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#a1a1aa] hover:text-white transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                <defs>
                  <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f09433"/>
                    <stop offset="25%" stopColor="#e6683c"/>
                    <stop offset="50%" stopColor="#dc2743"/>
                    <stop offset="75%" stopColor="#cc2366"/>
                    <stop offset="100%" stopColor="#bc1888"/>
                  </linearGradient>
                </defs>
                <path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
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
