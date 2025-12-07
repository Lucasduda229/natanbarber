import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { gsap } from "gsap";
import AnimatedBackground from "@/components/AnimatedBackground";
import GhostInput from "@/components/GhostInput";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logoImage from "@/assets/logo-barbershop.png";

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    gsap.fromTo(".auth-card", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError("Email é obrigatório");
      return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Email inválido");
      return;
    }

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      toast.error("Erro ao enviar email", { description: error.message });
      return;
    }

    setSent(true);
    toast.success("Email enviado!", { description: "Verifique sua caixa de entrada" });
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />
      
      <header className="auth-header relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-3 group">
          <img src={logoImage} alt="Natan Barbershop" className="w-12 h-12 rounded-full object-cover border-2 border-primary/30 shadow-gold-glow transition-all group-hover:scale-110" />
          <span className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">Natan Barbershop</span>
        </Link>
        <Link to="/login">
          <Button variant="ghost" className="text-foreground hover:text-primary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </header>

      <main className="relative z-10 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <img src={logoImage} alt="Logo" className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-primary/30 shadow-gold-glow-strong animate-float" />
          </div>

          <div className="text-center mb-8 space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Recuperar Senha</h1>
            <p className="text-muted-foreground">
              {sent ? "Verifique seu email" : "Digite seu email para receber o link de recuperação"}
            </p>
          </div>

          <div className="auth-card bg-card/40 backdrop-blur-xl rounded-2xl p-8 border border-primary/20 shadow-gold-glow">
            {sent ? (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">Email Enviado!</h3>
                  <p className="text-muted-foreground text-sm">
                    Enviamos um link de recuperação para <span className="text-primary font-medium">{email}</span>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Verifique sua caixa de entrada e spam.
                  </p>
                </div>
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    onClick={() => setSent(false)}
                    className="w-full border-primary/30 hover:border-primary"
                  >
                    Enviar novamente
                  </Button>
                  <Link to="/login" className="block">
                    <Button className="w-full bg-gold-gradient text-background">
                      Voltar para Login
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <GhostInput
                  icon={Mail}
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  error={error}
                  autoFocus
                />

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gold-gradient hover:opacity-90 text-background font-semibold py-6 rounded-xl shadow-gold-glow"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                      Enviando...
                    </span>
                  ) : (
                    "Enviar Link de Recuperação"
                  )}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Lembrou a senha?{" "}
                  <Link to="/login" className="text-primary hover:underline font-semibold">
                    Fazer Login
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
