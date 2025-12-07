import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import { gsap } from "gsap";
import AnimatedBackground from "@/components/AnimatedBackground";
import GhostInput from "@/components/GhostInput";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import logoImage from "@/assets/logo-barbershop.png";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) navigate("/booking");
    gsap.fromTo(".auth-card", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" });
  }, [user, navigate]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.email.trim()) newErrors.email = "Email é obrigatório";
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
      <header className="auth-header relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-3 group">
          <img src={logoImage} alt="Natan Barbershop" className="w-12 h-12 rounded-full object-cover border-2 border-primary/30 shadow-gold-glow transition-all group-hover:scale-110" />
          <span className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">Natan Barbershop</span>
        </Link>
        <Link to="/register"><Button variant="ghost" className="text-foreground hover:text-primary">Cadastrar</Button></Link>
      </header>
      <main className="relative z-10 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <img src={logoImage} alt="Logo" className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-primary/30 shadow-gold-glow-strong animate-float" />
          </div>
          <div className="text-center mb-8 space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">Bem-vindo de Volta</h1>
            <p className="text-muted-foreground text-lg">Acesse sua conta para agendar</p>
          </div>
          <div className="auth-card bg-card/40 backdrop-blur-xl rounded-2xl p-8 border border-primary/20 shadow-gold-glow">
            <form onSubmit={handleSubmit} className="space-y-6">
              <GhostInput icon={Mail} name="email" type="email" placeholder="seu@email.com" value={formData.email} onChange={handleChange} error={errors.email} autoFocus />
              <GhostInput icon={Lock} name="password" type="password" placeholder="Sua senha" value={formData.password} onChange={handleChange} error={errors.password} />
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
