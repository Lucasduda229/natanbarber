import { usePWA } from "@/hooks/usePWA";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Check, Smartphone, Share, PlusSquare } from "lucide-react";
import { Link } from "react-router-dom";
import AnimatedBackground from "@/components/AnimatedBackground";
import logo from "@/assets/logo-barbershop.png";

const Install = () => {
  const { isInstallable, isInstalled, isIOS, installApp } = usePWA();

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      console.log("App installed successfully!");
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground />
      
      <div className="relative z-10 container mx-auto px-4 py-12">
        <div className="flex flex-col items-center mb-8">
          <Link to="/">
            <img
              src={logo}
              alt="Natan Barbershop Logo"
              className="w-24 h-24 object-contain mb-4"
            />
          </Link>
          <h1 className="text-3xl font-bold text-foreground text-center">
            Instale o App
          </h1>
          <p className="text-muted-foreground text-center mt-2">
            Tenha acesso rápido e offline à sua barbearia favorita
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-6">
          {isInstalled ? (
            <Card className="border-green-500/50 bg-green-500/10">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                  <Check className="h-8 w-8 text-green-500" />
                </div>
                <CardTitle className="text-green-500">App Instalado!</CardTitle>
                <CardDescription>
                  O Natan Barbershop já está instalado no seu dispositivo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/">
                  <Button variant="outline" className="w-full">
                    Voltar para o início
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : isIOS ? (
            <Card>
              <CardHeader>
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                  <Smartphone className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-center">Instalação no iOS</CardTitle>
                <CardDescription className="text-center">
                  Siga os passos abaixo para instalar o app no seu iPhone/iPad
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Toque no botão Compartilhar</p>
                    <div className="flex items-center gap-2 mt-1 text-muted-foreground text-sm">
                      <Share className="h-4 w-4" />
                      <span>Na barra inferior do Safari</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Selecione "Adicionar à Tela de Início"</p>
                    <div className="flex items-center gap-2 mt-1 text-muted-foreground text-sm">
                      <PlusSquare className="h-4 w-4" />
                      <span>Role para baixo no menu</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Toque em "Adicionar"</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      O ícone aparecerá na sua tela inicial
                    </p>
                  </div>
                </div>

                <Link to="/">
                  <Button variant="outline" className="w-full mt-4">
                    Voltar para o início
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : isInstallable ? (
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                  <Download className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Instalar Aplicativo</CardTitle>
                <CardDescription>
                  Instale o app para ter acesso rápido direto da sua tela inicial
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Acesso rápido sem abrir o navegador</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Funciona offline</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Ocupa pouco espaço</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Atualizações automáticas</span>
                  </div>
                </div>

                <Button onClick={handleInstall} className="w-full" size="lg">
                  <Download className="h-4 w-4 mr-2" />
                  Instalar Agora
                </Button>

                <Link to="/">
                  <Button variant="ghost" className="w-full">
                    Continuar no navegador
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Smartphone className="h-8 w-8 text-muted-foreground" />
                </div>
                <CardTitle>Instalação não disponível</CardTitle>
                <CardDescription>
                  A instalação do app não está disponível neste momento. 
                  Tente acessar pelo Chrome no Android ou Safari no iOS.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/">
                  <Button variant="outline" className="w-full">
                    Voltar para o início
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Features */}
          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="text-center p-4 bg-card rounded-lg border">
              <div className="text-2xl font-bold text-primary">5MB</div>
              <div className="text-sm text-muted-foreground">Tamanho</div>
            </div>
            <div className="text-center p-4 bg-card rounded-lg border">
              <div className="text-2xl font-bold text-primary">100%</div>
              <div className="text-sm text-muted-foreground">Offline</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Install;
