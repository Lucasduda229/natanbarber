import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Crown, Check, ChevronLeft, User, Phone, CreditCard, Copy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generatePixPayload } from "@/lib/pix";
import { QRCodeSVG } from "qrcode.react";
import AnimatedBackground from "@/components/AnimatedBackground";
import logoImage from "@/assets/logo-barbershop.png";
import pixIcon from "@/assets/pix-icon.png";
import CancellationPolicy from "@/components/CancellationPolicy";

const PIX_KEY = "48 99918-2561";

interface Package {
  id: string;
  name: string;
  description: string;
  price: number;
  items: PackageItem[];
}

interface PackageItem {
  id: string;
  service_name: string;
  quantity: number;
}

const BuySubscription = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: Select Package, 2: Customer Info, 3: Payment
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerWhatsApp, setCustomerWhatsApp] = useState("");
  const [formErrors, setFormErrors] = useState<{ name?: string; whatsapp?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPackages();
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchPackages = async () => {
    const { data: packagesData } = await supabase
      .from("packages")
      .select("*")
      .eq("active", true)
      .order("price");

    if (packagesData) {
      const packagesWithItems = await Promise.all(
        packagesData.map(async (pkg) => {
          const { data: items } = await supabase
            .from("package_items")
            .select("*")
            .eq("package_id", pkg.id);
          return { ...pkg, items: items || [] };
        })
      );
      setPackages(packagesWithItems);
    }
  };

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile) {
      setCustomerName(profile.full_name || "");
      setCustomerWhatsApp(profile.phone || "");
    }
  };

  const handlePackageSelect = (pkg: Package) => {
    setSelectedPackage(pkg);
  };

  const validateCustomerInfo = (): boolean => {
    const errors: { name?: string; whatsapp?: string } = {};
    
    const trimmedName = customerName.trim();
    if (!trimmedName) {
      errors.name = "Nome é obrigatório";
    } else if (trimmedName.length < 2) {
      errors.name = "Nome deve ter pelo menos 2 caracteres";
    }
    
    const cleanWhatsApp = customerWhatsApp.replace(/\D/g, "");
    if (!cleanWhatsApp) {
      errors.whatsapp = "WhatsApp é obrigatório";
    } else if (cleanWhatsApp.length < 10 || cleanWhatsApp.length > 11) {
      errors.whatsapp = "WhatsApp deve ter 10 ou 11 dígitos";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleContinueToInfo = () => {
    if (!selectedPackage) {
      toast.error("Selecione um pacote");
      return;
    }
    setStep(2);
  };

  const handleContinueToPayment = async () => {
    if (!validateCustomerInfo()) return;

    if (!user) {
      toast.error("Login necessário", { description: "Faça login para continuar." });
      navigate("/login");
      return;
    }

    // Update user profile
    await supabase
      .from("profiles")
      .update({ 
        full_name: customerName.trim(), 
        phone: customerWhatsApp.replace(/\D/g, "") 
      })
      .eq("user_id", user.id);

    setStep(3);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedPackage || !user) return;

    setLoading(true);

    // Calculate monthly cuts based on package items
    const totalCuts = selectedPackage.items.reduce((sum, item) => {
      const serviceName = item.service_name.toLowerCase();
      if (serviceName.includes('cabelo') || serviceName.includes('degradê') || serviceName.includes('corte')) {
        return sum + item.quantity;
      }
      return sum;
    }, 0);

    const monthlyCutsLimit = Math.max(totalCuts, 4); // Minimum 4 cuts

    // Create a pending subscription purchase (will be activated by admin)
    const { error } = await supabase
      .from("subscription_progress")
      .insert({
        user_id: user.id,
        package_id: selectedPackage.id,
        package_name: selectedPackage.name,
        monthly_cuts_limit: monthlyCutsLimit,
        cuts_used_this_month: 0,
        is_active: false, // Admin will activate after payment confirmation
        consecutive_months: 0,
      });

    if (error) {
      // If already exists, just show success (they can still pay)
      if (!error.message.includes("duplicate")) {
        toast.error("Erro ao processar", { description: "Tente novamente." });
        setLoading(false);
        return;
      }
    }

    // Notify admins about new subscription purchase request
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (admins) {
      const notifications = admins.map((admin) => ({
        user_id: admin.user_id,
        title: "Nova Compra de Assinatura",
        message: `${customerName} solicitou o ${selectedPackage.name} - R$ ${selectedPackage.price.toFixed(2)}`,
        type: "subscription_purchase",
      }));

      await supabase.from("notifications").insert(notifications);
    }

    setLoading(false);
    setStep(4); // Success step
    toast.success("Pedido enviado!", { description: "Aguardando confirmação do pagamento." });
  };

  const copyPixKey = () => {
    navigator.clipboard.writeText(PIX_KEY.replace(/\s/g, ""));
    toast.success("Chave PIX copiada!");
  };

  const getPackageColor = (pkgName: string) => {
    if (pkgName.toLowerCase().includes('ouro')) return { bg: "bg-yellow-500", text: "text-yellow-500", border: "border-yellow-500" };
    if (pkgName.toLowerCase().includes('prata')) return { bg: "bg-slate-400", text: "text-slate-400", border: "border-slate-400" };
    return { bg: "bg-amber-600", text: "text-amber-600", border: "border-amber-600" };
  };

  const renderPackagesByTier = (tier: string, tierLabel: string, tierColor: string, tierBg: string) => {
    const tierPackages = packages.filter(p => p.name.toLowerCase().includes(tier));
    if (tierPackages.length === 0) return null;

    return (
      <div key={tier} className="space-y-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${tierBg} flex items-center justify-center`}>
            <Package className={`w-4 h-4 ${tierColor}`} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Pacotes {tierLabel}</h3>
          </div>
        </div>
        
        <div className="grid gap-3">
          {tierPackages.sort((a, b) => b.price - a.price).map((pkg) => {
            const isSelected = selectedPackage?.id === pkg.id;
            const colors = getPackageColor(pkg.name);
            
            return (
              <div
                key={pkg.id}
                className={`relative rounded-xl p-4 cursor-pointer transition-all active:scale-[0.98] ${
                  isSelected 
                    ? `${colors.bg}/20 border-2 ${colors.border} ring-2 ${colors.border}/30` 
                    : `bg-gradient-to-br from-${tier === 'ouro' ? 'yellow-500' : tier === 'prata' ? 'slate-400' : 'amber-600'}/10 to-card/80 border border-${tier === 'ouro' ? 'yellow-500' : tier === 'prata' ? 'slate-400' : 'amber-600'}/20`
                }`}
                onClick={() => handlePackageSelect(pkg)}
              >
                {isSelected && (
                  <div className={`absolute top-3 right-3 w-6 h-6 rounded-full ${colors.bg} flex items-center justify-center`}>
                    <Check className="w-4 h-4 text-background" />
                  </div>
                )}
                
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className={`inline-block px-2 py-0.5 rounded-full ${colors.bg}/20 ${colors.text} text-[10px] font-bold mb-2`}>
                      {tierLabel.toUpperCase()}
                    </span>
                    <h4 className={`font-semibold text-sm mb-2 pr-8 ${isSelected ? colors.text : "text-foreground"}`}>
                      {pkg.name}
                    </h4>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {pkg.items.map((item) => (
                        <span key={item.id} className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                          {item.quantity}x {item.service_name}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pkg.description}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xl font-bold ${colors.text}`}>
                      R$ {pkg.price.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">mensal</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen relative overflow-hidden safe-bottom">
      <AnimatedBackground />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 py-4 max-w-3xl mx-auto">
        <Button variant="ghost" size="icon" onClick={() => step > 1 ? setStep(step - 1) : navigate("/booking")}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <img src={logoImage} alt="Natan Barbershop" className="w-10 h-10 rounded-full object-cover border-2 border-primary/30" />
          <span className="font-bold text-foreground">Assinar Pacote</span>
        </div>
        <div className="w-10" />
      </header>

      <main className="relative z-10 px-4 pb-32 max-w-3xl mx-auto">
        {/* Step 1: Select Package */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="text-center mb-6">
              <Crown className="w-12 h-12 text-primary mx-auto mb-2" />
              <h1 className="text-2xl font-bold text-foreground">Escolha seu Pacote</h1>
              <p className="text-muted-foreground text-sm">Selecione o pacote ideal para você</p>
            </div>

            <div className="space-y-6">
              {renderPackagesByTier('bronze', 'Bronze', 'text-amber-600', 'bg-amber-600/20')}
              {renderPackagesByTier('prata', 'Prata', 'text-slate-400', 'bg-slate-400/20')}
              {renderPackagesByTier('ouro', 'Ouro', 'text-yellow-500', 'bg-yellow-500/20')}
            </div>
          </div>
        )}

        {/* Step 2: Customer Info */}
        {step === 2 && selectedPackage && (
          <div className="space-y-6 animate-in fade-in">
            <div className="text-center mb-6">
              <User className="w-12 h-12 text-primary mx-auto mb-2" />
              <h1 className="text-2xl font-bold text-foreground">Seus Dados</h1>
              <p className="text-muted-foreground text-sm">Preencha suas informações</p>
            </div>

            <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <User className="w-5 h-5 text-primary" />
                  Informações de Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Nome Completo *</Label>
                  <Input
                    id="customerName"
                    placeholder="Digite seu nome"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (formErrors.name) setFormErrors(prev => ({ ...prev, name: undefined }));
                    }}
                    className={formErrors.name ? 'border-destructive' : ''}
                  />
                  {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="customerWhatsApp">WhatsApp *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="customerWhatsApp"
                      placeholder="(00) 00000-0000"
                      value={customerWhatsApp}
                      onChange={(e) => {
                        setCustomerWhatsApp(e.target.value);
                        if (formErrors.whatsapp) setFormErrors(prev => ({ ...prev, whatsapp: undefined }));
                      }}
                      className={`pl-10 ${formErrors.whatsapp ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {formErrors.whatsapp && <p className="text-sm text-destructive">{formErrors.whatsapp}</p>}
                </div>
              </CardContent>
            </Card>

            {/* Package Summary */}
            <Card className={`${getPackageColor(selectedPackage.name).bg}/10 border-2 ${getPackageColor(selectedPackage.name).border}/30`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pacote selecionado</p>
                    <p className="font-bold text-foreground">{selectedPackage.name}</p>
                  </div>
                  <p className={`text-xl font-bold ${getPackageColor(selectedPackage.name).text}`}>
                    R$ {selectedPackage.price.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Payment */}
        {step === 3 && selectedPackage && (
          <div className="space-y-6 animate-in fade-in">
            <div className="text-center mb-6">
              <CreditCard className="w-12 h-12 text-primary mx-auto mb-2" />
              <h1 className="text-2xl font-bold text-foreground">Pagamento PIX</h1>
              <p className="text-muted-foreground text-sm">Escaneie o QR Code ou copie a chave</p>
            </div>

            {/* Package Summary */}
            <Card className={`${getPackageColor(selectedPackage.name).bg}/10 border-2 ${getPackageColor(selectedPackage.name).border}/30`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Pacote</p>
                    <p className="font-bold text-foreground">{selectedPackage.name}</p>
                  </div>
                  <p className={`text-2xl font-bold ${getPackageColor(selectedPackage.name).text}`}>
                    R$ {selectedPackage.price.toFixed(2)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedPackage.items.map((item) => (
                    <span key={item.id} className="text-xs bg-muted/50 px-2 py-1 rounded">
                      {item.quantity}x {item.service_name}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* QR Code */}
            <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-3 bg-white rounded-xl shadow-lg">
                    <QRCodeSVG
                      value={generatePixPayload({
                        pixKey: PIX_KEY,
                        merchantName: "NATAN BARBER",
                        merchantCity: "LAURO MULLER",
                        amount: selectedPackage.price,
                        description: selectedPackage.name.substring(0, 25),
                      })}
                      size={180}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Escaneie o QR Code com seu app de banco
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* PIX Key */}
            <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card/50">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center p-2 shadow-sm">
                <img src={pixIcon} alt="PIX" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Ou copie a chave</p>
                <p className="font-mono text-foreground">{PIX_KEY}</p>
              </div>
              <Button variant="outline" size="icon" onClick={copyPixKey}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            <CancellationPolicy variant="full" />

            <Button
              onClick={handleConfirmPurchase}
              disabled={loading}
              className="w-full bg-gold-gradient hover:opacity-90 text-background font-semibold py-6 rounded-xl shadow-gold-glow"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  Processando...
                </span>
              ) : (
                "Confirmar Pagamento"
              )}
            </Button>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && selectedPackage && (
          <div className="text-center space-y-6 py-12 animate-in fade-in">
            <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <Check className="w-12 h-12 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Pedido Enviado!</h2>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                Seu pedido de assinatura foi enviado. Após a confirmação do pagamento pelo barbeiro, sua assinatura será ativada.
              </p>
            </div>

            <Card className="bg-card/60 backdrop-blur-xl border-primary/20 max-w-sm mx-auto">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pacote</span>
                  <span className="font-semibold text-foreground">{selectedPackage.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valor</span>
                  <span className={`font-bold ${getPackageColor(selectedPackage.name).text}`}>
                    R$ {selectedPackage.price.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-amber-500 font-medium">Aguardando confirmação</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 max-w-sm mx-auto">
              <Button onClick={() => navigate("/booking")} className="bg-gold-gradient text-background">
                Voltar ao Início
              </Button>
              <Button variant="outline" onClick={() => navigate("/my-appointments")}>
                Ver Meus Agendamentos
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Fixed Continue Button */}
      {step === 1 && selectedPackage && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/98 backdrop-blur-xl border-t-2 border-primary/30 shadow-2xl safe-bottom">
          <div className="max-w-3xl mx-auto">
            <div className={`rounded-xl border-2 p-3 ${getPackageColor(selectedPackage.name).bg}/15 ${getPackageColor(selectedPackage.name).border}/50`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Package className={`w-6 h-6 ${getPackageColor(selectedPackage.name).text}`} />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{selectedPackage.name}</p>
                    <p className={`text-lg font-bold ${getPackageColor(selectedPackage.name).text}`}>
                      R$ {selectedPackage.price.toFixed(2)}
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={handleContinueToInfo}
                  size="lg"
                  className={`h-12 px-6 text-base rounded-xl font-bold shadow-lg ${getPackageColor(selectedPackage.name).bg} hover:opacity-90 text-background`}
                >
                  Continuar <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Continue Button for Step 2 */}
      {step === 2 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/98 backdrop-blur-xl border-t border-border shadow-2xl safe-bottom">
          <div className="max-w-3xl mx-auto">
            <Button 
              onClick={handleContinueToPayment}
              className="w-full h-14 text-lg bg-gold-gradient hover:opacity-90 text-background font-bold rounded-xl shadow-gold-glow"
            >
              Ir para Pagamento <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuySubscription;
