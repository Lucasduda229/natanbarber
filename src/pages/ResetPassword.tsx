import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, CheckCircle, AlertCircle } from "lucide-react";
import { gsap } from "gsap";
import AnimatedBackground from "@/components/AnimatedBackground";
import GhostInput from "@/components/GhostInput";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logoImage from "@/assets/logo-barbershop.png";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validatingSession, setValidatingSession] = useState(true);
  const [formData, setFormData] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    gsap.fromTo(".auth-card", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" });

    const validateRecoverySession = async () => {
      // 1) Custom email link: /reset-password?type=recovery&token_hash=...
      // This keeps the email button URL on the custom domain.
      const searchParams = new URLSearchParams(window.location.search);
      const tokenHash = searchParams.get("token_hash");
      const queryType = searchParams.get("type");

      if (tokenHash && queryType === "recovery") {
        try {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: tokenHash,
          });

          if (verifyError) {
            setError("Link de recuperação inválido ou expirado. Solicite um novo link.");
            setValidatingSession(false);
            return;
          }

          // Remove sensitive params from the URL after successful verification
          window.history.replaceState({}, document.title, window.location.pathname);
          setValidatingSession(false);
          return;
        } catch {
          setError("Link de recuperação inválido ou expirado. Solicite um novo link.");
          setValidatingSession(false);
          return;
        }
      }

      // First check hash params (initial redirect from email)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const type = hashParams.get("type");

      if (accessToken && type === "recovery") {
        // Valid recovery link, user will be logged in automatically
        setValidatingSession(false);
        return;
      }

      // If no hash params, check if user has an active session (already processed the link)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // User has a valid session - allow password reset
        setValidatingSession(false);
        return;
      }

      // No valid recovery link and no session
      setError("Link de recuperação inválido ou expirado. Solicite um novo link.");
      setValidatingSession(false);
    };

    validateRecoverySession();
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
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

    const { error } = await supabase.auth.updateUser({
      password: formData.password,
    });

    setLoading(false);

    if (error) {
      toast.error("Erro ao redefinir senha", { description: error.message });
      return;
    }

    setSuccess(true);
    toast.success("Senha redefinida com sucesso!");
    
    // Redirect to booking after 3 seconds
    setTimeout(() => {
      navigate("/booking");
    }, 3000);
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
      </header>

      <main className="relative z-10 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <img src={logoImage} alt="Logo" className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-primary/30 shadow-gold-glow-strong animate-float" />
          </div>

          <div className="text-center mb-8 space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              {validatingSession ? "Verificando..." : success ? "Senha Redefinida!" : error ? "Link Inválido" : "Nova Senha"}
            </h1>
            <p className="text-muted-foreground">
              {validatingSession ? "Aguarde um momento" : success ? "Sua senha foi alterada com sucesso" : error ? "" : "Digite sua nova senha"}
            </p>
          </div>

          <div className="auth-card bg-card/40 backdrop-blur-xl rounded-2xl p-8 border border-primary/20 shadow-gold-glow">
            {validatingSession ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : success ? (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">Tudo Pronto!</h3>
                  <p className="text-muted-foreground text-sm">
                    Você será redirecionado automaticamente...
                  </p>
                </div>
                <Link to="/booking">
                  <Button className="w-full bg-gold-gradient text-background">
                    Ir para Agendamentos
                  </Button>
                </Link>
              </div>
            ) : error ? (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-10 h-10 text-destructive" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">Ops!</h3>
                  <p className="text-muted-foreground text-sm">{error}</p>
                </div>
                <Link to="/forgot-password">
                  <Button className="w-full bg-gold-gradient text-background">
                    Solicitar Novo Link
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <GhostInput
                  icon={Lock}
                  name="password"
                  type="password"
                  placeholder="Nova senha (mínimo 8 caracteres)"
                  value={formData.password}
                  onChange={handleChange}
                  error={errors.password}
                  autoFocus
                />

                <GhostInput
                  icon={Lock}
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirme a nova senha"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  error={errors.confirmPassword}
                />

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gold-gradient hover:opacity-90 text-background font-semibold py-6 rounded-xl shadow-gold-glow"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                      Salvando...
                    </span>
                  ) : (
                    "Redefinir Senha"
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ResetPassword;
