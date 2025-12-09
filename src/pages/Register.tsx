import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, Phone } from "lucide-react";
import { gsap } from "gsap";
import AnimatedBackground from "@/components/AnimatedBackground";
import OpenClosedBadge from "@/components/OpenClosedBadge";
import GhostInput from "@/components/GhostInput";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import logoImage from "@/assets/logo-barbershop.png";

const Register = () => {
  const navigate = useNavigate();
  const { signUp, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Only redirect if auth is finished loading AND user exists
    if (!authLoading && user) {
      navigate("/booking");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    
    tl.fromTo(".auth-logo", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.6 })
      .fromTo(".auth-title", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, "-=0.3")
      .fromTo(".auth-subtitle", { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.4 }, "-=0.2")
      .fromTo(".auth-card", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 }, "-=0.2")
      .fromTo(".form-field", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.1 }, "-=0.3")
      .fromTo(".form-submit", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, "-=0.1")
      .fromTo(".form-footer", { opacity: 0 }, { opacity: 1, duration: 0.4 }, "-=0.2");
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Nome é obrigatório";
    if (!formData.email.trim()) newErrors.email = "Email é obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Email inválido";
    if (!formData.password) newErrors.password = "Senha é obrigatória";
    else if (formData.password.length < 8) newErrors.password = "Mínimo 8 caracteres";
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Senhas não coincidem";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    const { error } = await signUp(formData.email, formData.password, { full_name: formData.name, phone: formData.phone });
    setLoading(false);
    if (error) {
      toast.error("Erro ao criar conta", { description: error.message });
      return;
    }
    toast.success("Conta criada com sucesso!", { description: "Faça login para continuar." });
    navigate("/login");
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
          <Link to="/login"><Button variant="ghost" className="text-foreground hover:text-primary text-sm sm:text-base px-2 sm:px-4">Entrar</Button></Link>
        </div>
      </header>
      <main className="relative z-10 flex items-center justify-center px-3 sm:px-4 py-6 sm:py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-4 sm:mb-6 auth-logo" style={{ opacity: 0 }}>
            <img src={logoImage} alt="Logo" className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-primary/30 shadow-gold-glow-strong animate-float" />
          </div>
          <div className="text-center mb-6 sm:mb-8 space-y-2">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground auth-title" style={{ opacity: 0 }}>Seja Bem-vindo</h1>
            <p className="text-muted-foreground text-sm sm:text-base auth-subtitle" style={{ opacity: 0 }}>Agende seu horário de forma rápida e exclusiva</p>
          </div>
          <div className="auth-card bg-card/40 backdrop-blur-xl rounded-2xl p-5 sm:p-8 border border-primary/20 shadow-gold-glow" style={{ opacity: 0 }}>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="form-field" style={{ opacity: 0 }}>
                <GhostInput icon={User} name="name" type="text" placeholder="Seu nome completo" value={formData.name} onChange={handleChange} error={errors.name} autoFocus />
              </div>
              <div className="form-field" style={{ opacity: 0 }}>
                <GhostInput icon={Mail} name="email" type="email" placeholder="seu@email.com" value={formData.email} onChange={handleChange} error={errors.email} />
              </div>
              <div className="form-field" style={{ opacity: 0 }}>
                <GhostInput icon={Lock} name="password" type="password" placeholder="Mínimo 8 caracteres" value={formData.password} onChange={handleChange} error={errors.password} />
              </div>
              <div className="form-field" style={{ opacity: 0 }}>
                <GhostInput icon={Lock} name="confirmPassword" type="password" placeholder="Confirme sua senha" value={formData.confirmPassword} onChange={handleChange} error={errors.confirmPassword} />
              </div>
              <div className="form-field" style={{ opacity: 0 }}>
                <GhostInput icon={Phone} name="phone" type="tel" placeholder="(00) 00000-0000" value={formData.phone} onChange={handleChange} />
              </div>
              <div className="form-submit" style={{ opacity: 0 }}>
                <Button type="submit" disabled={loading} className="w-full bg-gold-gradient hover:opacity-90 text-background font-semibold py-6 rounded-xl shadow-gold-glow">
                  {loading ? <span className="flex items-center gap-2"><span className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />Criando...</span> : "Finalizar Cadastro"}
                </Button>
              </div>
              <p className="text-center text-sm text-muted-foreground form-footer" style={{ opacity: 0 }}>Já tem conta? <Link to="/login" className="text-primary hover:underline font-semibold">Entrar</Link></p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Register;
