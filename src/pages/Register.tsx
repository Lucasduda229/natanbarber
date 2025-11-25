import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, Phone } from "lucide-react";
import { gsap } from "gsap";
import AnimatedBackground from "@/components/AnimatedBackground";
import GhostInput from "@/components/GhostInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
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

    if (!formData.name.trim()) {
      newErrors.name = "Nome é obrigatório";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email é obrigatório";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email inválido";
    }

    if (!formData.password) {
      newErrors.password = "Senha é obrigatória";
    } else if (formData.password.length < 8) {
      newErrors.password = "Senha deve ter no mínimo 8 caracteres";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "As senhas não coincidem";
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

    // Simulate registration (replace with actual Firebase/Supabase integration)
    setTimeout(() => {
      setLoading(false);
      toast.success("Conta criada com sucesso!", {
        description: "Redirecionando para agenda...",
      });
      
      // Redirect to external booking system
      setTimeout(() => {
        window.location.href = "https://natanbarbershop.base44.app/";
      }, 1500);
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
        <Link to="/login">
          <Button variant="ghost" className="text-foreground hover:text-primary">
            Entrar
          </Button>
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Hero Text */}
          <div className="text-center mb-8 space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              Seja Bem-vindo
            </h1>
            <p className="text-muted-foreground text-lg">
              Crie sua conta e garanta seu horário na nossa agenda exclusiva
            </p>
          </div>

          {/* Auth Card */}
          <div className="auth-card bg-card/40 backdrop-blur-xl rounded-2xl p-8 border border-primary/20 shadow-gold-glow">
            <form onSubmit={handleSubmit} className="space-y-6">
              <GhostInput
                icon={User}
                name="name"
                type="text"
                placeholder="Seu nome completo"
                value={formData.name}
                onChange={handleChange}
                error={errors.name}
                autoFocus
              />

              <GhostInput
                icon={Mail}
                name="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
              />

              <GhostInput
                icon={Lock}
                name="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
              />

              <GhostInput
                icon={Lock}
                name="confirmPassword"
                type="password"
                placeholder="Confirme sua senha"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
              />

              <GhostInput
                icon={Phone}
                name="phone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={formData.phone}
                onChange={handleChange}
              />

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gold-gradient hover:opacity-90 text-background font-semibold py-6 rounded-xl shadow-gold-glow transition-all hover:shadow-gold-glow-strong"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                    Criando conta...
                  </span>
                ) : (
                  "Finalizar Cadastro"
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Já tem conta?{" "}
                <Link to="/login" className="text-primary hover:underline font-semibold">
                  Entrar
                </Link>
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Register;
