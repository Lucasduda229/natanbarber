import { Scissors, Instagram, MessageCircle } from "lucide-react";

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

        {/* Right Side: Contact */}
        <div className="flex flex-col gap-4">
          <h3 className="text-white text-sm font-bold tracking-widest uppercase mb-1">
            CONTATO
          </h3>
          <div className="flex items-center gap-2 text-sm hover:text-white transition-colors cursor-pointer">
            <MessageCircle className="w-5 h-5" />
            <span>(48) 9952-0220</span>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <a 
              href="https://www.instagram.com/_natan_barber_/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#a1a1aa] hover:text-white transition-colors"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a 
              href="https://wa.me/554899520220" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#a1a1aa] hover:text-white transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
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
