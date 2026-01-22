import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import { gsap } from "gsap";
import AnimatedBackground from "@/components/AnimatedBackground";
import OpenClosedBadge from "@/components/OpenClosedBadge";
import GhostInput from "@/components/GhostInput";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import logoImage from "@/assets/logo-barbershop.png";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Removed auto-redirect: users should always see the login page
  // and fill credentials manually after logout

  useEffect(() => {
    gsap.fromTo(".auth-card", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" });
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!formData.email.trim()) {
      newErrors.email = "Email é obrigatório";
    } else if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = "Email inválido";
    }
    
    if (!formData.password) newErrors.password = "Senha é obrigatória";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    const { error } = await signIn(formData.email, formData.password);
    setLoading(false);
    if (error) {
      toast.error("Erro ao entrar", { description: "Verifique suas credenciais" });
      gsap.timeline().to(".auth-card", { x: -10, duration: 0.1 }).to(".auth-card", { x: 10, duration: 0.1 }).to(".auth-card", { x: 0, duration: 0.1 });
      return;
    }
    toast.success("Login realizado!", { description: "Redirecionando..." });
    navigate("/booking");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />
      <header className="auth-header relative z-10 flex items-center justify-between px-3 sm:px-6 py-4 sm:py-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
          <img src={logoImage} alt="Natan Barbershop" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-primary/30 shadow-gold-glow transition-all group-hover:scale-110" />
          <span className="text-base sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors hidden sm:block">Natan Barbershop</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <OpenClosedBadge />
          <Link to="/register"><Button variant="ghost" className="text-foreground hover:text-primary text-sm sm:text-base px-2 sm:px-4">Cadastrar</Button></Link>
        </div>
      </header>
      <main className="relative z-10 flex items-center justify-center px-3 sm:px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-4 sm:mb-6">
            <img src={logoImage} alt="Logo" className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-primary/30 shadow-gold-glow-strong animate-float" />
          </div>
          <div className="text-center mb-6 sm:mb-8 space-y-2">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground">Bem-vindo de Volta</h1>
            <p className="text-muted-foreground text-sm sm:text-lg">Acesse sua conta para agendar</p>
          </div>
          <div className="auth-card bg-card/40 backdrop-blur-xl rounded-2xl p-5 sm:p-8 border border-primary/20 shadow-gold-glow">
            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
              <GhostInput icon={Mail} name="email" type="email" placeholder="seu@email.com" value={formData.email} onChange={handleChange} error={errors.email} autoFocus autoComplete="off" />
              <GhostInput icon={Lock} name="password" type="password" placeholder="Sua senha" value={formData.password} onChange={handleChange} error={errors.password} autoComplete="new-password" />
              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Esqueci a senha
                </Link>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gold-gradient hover:opacity-90 text-background font-semibold py-6 rounded-xl shadow-gold-glow">
                {loading ? <span className="flex items-center gap-2"><span className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />Entrando...</span> : "Entrar"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">Não tem conta? <Link to="/register" className="text-primary hover:underline font-semibold">Cadastre-se</Link></p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
