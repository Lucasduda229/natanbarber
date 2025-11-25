import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import { gsap } from "gsap";
import AnimatedBackground from "@/components/AnimatedBackground";
import GhostInput from "@/components/GhostInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Animate elements on mount
    gsap.fromTo(
      ".auth-card",
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
    );
    gsap.fromTo(
      ".auth-header",
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.6, delay: 0.2, ease: "power3.out" }
    );
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email é obrigatório";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email inválido";
    }

    if (!formData.password) {
      newErrors.password = "Senha é obrigatória";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      gsap.timeline()
        .to(".auth-card", { x: -5, duration: 0.1 })
        .to(".auth-card", { x: 5, duration: 0.1 })
        .to(".auth-card", { x: -5, duration: 0.1 })
        .to(".auth-card", { x: 5, duration: 0.1 })
        .to(".auth-card", { x: 0, duration: 0.1 });
      return;
    }

    setLoading(true);

    // Simulate login (replace with actual Firebase/Supabase integration)
    setTimeout(() => {
      // Check credentials (this is just a demo - implement real auth)
      if (formData.email && formData.password) {
        setLoading(false);
        toast.success("Login realizado com sucesso!", {
          description: "Redirecionando para agenda...",
        });
        
        // Redirect to external booking system
        setTimeout(() => {
          window.location.href = "https://natanbarbershop.base44.app/";
        }, 1500);
      } else {
        setLoading(false);
        toast.error("Erro ao fazer login", {
          description: "Verifique suas credenciais e tente novamente",
        });
        gsap.timeline()
          .to(".auth-card", { x: -10, duration: 0.1 })
          .to(".auth-card", { x: 10, duration: 0.1 })
          .to(".auth-card", { x: -10, duration: 0.1 })
          .to(".auth-card", { x: 10, duration: 0.1 })
          .to(".auth-card", { x: 0, duration: 0.1 });
      }
    }, 2000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />

      {/* Header */}
      <header className="auth-header relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold-gradient rounded-lg flex items-center justify-center">
            <span className="text-xl font-bold text-background">N</span>
          </div>
          <span className="text-xl font-bold text-foreground">Natan Barbershop</span>
        </div>
        <Link to="/register">
          <Button variant="ghost" className="text-foreground hover:text-primary">
            Cadastrar
          </Button>
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Hero Text */}
          <div className="text-center mb-8 space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              Bem-vindo de Volta
            </h1>
            <p className="text-muted-foreground text-lg">
              Acesse sua conta para agendar seu horário
            </p>
          </div>

          {/* Auth Card */}
          <div className="auth-card bg-card/40 backdrop-blur-xl rounded-2xl p-8 border border-primary/20 shadow-gold-glow">
            <form onSubmit={handleSubmit} className="space-y-6">
              <GhostInput
                icon={Mail}
                name="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                autoFocus
              />

              <GhostInput
                icon={Lock}
                name="password"
                type="password"
                placeholder="Sua senha"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    className="border-primary data-[state=checked]:bg-primary"
                  />
                  <label
                    htmlFor="remember"
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Lembrar-me
                  </label>
                </div>
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Esqueci a senha
                </Link>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gold-gradient hover:opacity-90 text-background font-semibold py-6 rounded-xl shadow-gold-glow transition-all hover:shadow-gold-glow-strong"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  "Entrar"
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-input"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Ou continue com</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full border-input hover:border-primary transition-colors"
                onClick={() => toast.info("Login com Google em breve!")}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Entrar com Google
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Não tem conta?{" "}
                <Link to="/register" className="text-primary hover:underline font-semibold">
                  Cadastre-se
                </Link>
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
