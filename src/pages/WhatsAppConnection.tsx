import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ShieldCheck,
  Copy,
  Check,
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
  Zap,
  Lock,
  Webhook,
  Bot,
  KeyRound,
  Globe,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = "https://ttecccbrigcckurnezhl.supabase.co";
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

const BOT_ENDPOINTS = [
  {
    name: "Listar serviços",
    method: "POST",
    path: "/bot-servicos",
    desc: "Retorna o catálogo de serviços disponíveis.",
    icon: Bot,
  },
  {
    name: "Horários disponíveis",
    method: "POST",
    path: "/bot-horarios-disponiveis",
    desc: "Lista os horários livres em uma data.",
    icon: Globe,
  },
  {
    name: "Criar agendamento",
    method: "POST",
    path: "/bot-agendar",
    desc: "Cria um novo agendamento para o cliente.",
    icon: Zap,
  },
  {
    name: "Meus agendamentos",
    method: "POST",
    path: "/bot-meus-agendamentos",
    desc: "Lista os agendamentos do cliente pelo telefone.",
    icon: Webhook,
  },
];

export default function WhatsAppConnection() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  const [revealing, setRevealing] = useState(false);
  const [credentials, setCredentials] = useState<{
    BOT_API_SECRET?: string;
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showAnon, setShowAnon] = useState(false);
  const [showService, setShowService] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Guarda: só admin
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      toast.success("Copiado!");
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const revealCredentials = async () => {
    setRevealing(true);
    try {
      // 1) busca BOT_API_SECRET via edge function autenticada do usuário admin?
      // Nosso get-service-key exige x-bot-secret. Vamos primeiro pegar o BOT_API_SECRET
      // com um truque: usamos a função test/edge com o usuário autenticado.
      // Como get-service-key exige BOT_API_SECRET, usamos abordagem alternativa:
      // chamamos diretamente passando o token de admin para uma rota dedicada.
      // Aqui usamos invoke -> a função get-service-key valida x-bot-secret.
      // Solução: criamos um endpoint só para admin autenticado.
      const { data, error } = await supabase.functions.invoke(
        "get-connection-credentials",
        {
          body: {},
        }
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao revelar");

      setCredentials({
        BOT_API_SECRET: data.BOT_API_SECRET,
        SUPABASE_URL: data.SUPABASE_URL,
        SUPABASE_ANON_KEY: data.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: data.SUPABASE_SERVICE_ROLE_KEY,
      });
      toast.success("Credenciais carregadas");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao carregar credenciais");
    } finally {
      setRevealing(false);
    }
  };

  if (loading || !user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const mask = (v?: string) => (v ? v.slice(0, 6) + "•".repeat(20) + v.slice(-4) : "");

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 safe-top">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold">Conexão do Chatbot</h1>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-[10px] font-medium text-emerald-400"
              >
                <Lock className="mr-1 h-2.5 w-2.5" />
                PRIVADO
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Apenas administradores podem ver esta página
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-7 w-7 text-white"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold leading-tight text-foreground">
                Conectar seu Chatbot WhatsApp
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use as credenciais e endpoints abaixo para integrar seu bot externo
                (Evolution API, n8n, Make, Z-API, etc) à sua barbearia.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <CircleDot className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-400">
                  Backend pronto para receber requisições
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Credenciais */}
        <section>
          <div className="mb-3 flex items-center gap-2 px-1">
            <KeyRound className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Credenciais de acesso</h3>
          </div>

          {!credentials ? (
            <Card className="border-border/40">
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Credenciais protegidas</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Clique abaixo para revelar as chaves desta integração.
                    <br />
                    Nunca compartilhe estes valores publicamente.
                  </p>
                </div>
                <Button
                  onClick={revealCredentials}
                  disabled={revealing}
                  className="bg-gradient-to-br from-primary to-secondary text-primary-foreground hover:shadow-[0_0_20px_hsl(45_75%_52%_/_0.4)]"
                >
                  {revealing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      Revelar credenciais
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <CredentialRow
                label="SUPABASE_URL"
                value={credentials.SUPABASE_URL || SUPABASE_URL}
                onCopy={(v) => handleCopy("SUPABASE_URL", v)}
                copied={copiedKey === "SUPABASE_URL"}
              />
              <CredentialRow
                label="FUNCTIONS_URL"
                value={FUNCTIONS_BASE}
                onCopy={(v) => handleCopy("FUNCTIONS_URL", v)}
                copied={copiedKey === "FUNCTIONS_URL"}
              />
              <CredentialRow
                label="BOT_API_SECRET"
                value={credentials.BOT_API_SECRET || ""}
                masked={!showSecret}
                maskedValue={mask(credentials.BOT_API_SECRET)}
                onToggle={() => setShowSecret((v) => !v)}
                onCopy={(v) => handleCopy("BOT_API_SECRET", v)}
                copied={copiedKey === "BOT_API_SECRET"}
                sensitive
              />
              <CredentialRow
                label="SUPABASE_ANON_KEY"
                value={credentials.SUPABASE_ANON_KEY || ""}
                masked={!showAnon}
                maskedValue={mask(credentials.SUPABASE_ANON_KEY)}
                onToggle={() => setShowAnon((v) => !v)}
                onCopy={(v) => handleCopy("SUPABASE_ANON_KEY", v)}
                copied={copiedKey === "SUPABASE_ANON_KEY"}
              />
              <CredentialRow
                label="SUPABASE_SERVICE_ROLE_KEY"
                value={credentials.SUPABASE_SERVICE_ROLE_KEY || ""}
                masked={!showService}
                maskedValue={mask(credentials.SUPABASE_SERVICE_ROLE_KEY)}
                onToggle={() => setShowService((v) => !v)}
                onCopy={(v) => handleCopy("SUPABASE_SERVICE_ROLE_KEY", v)}
                copied={copiedKey === "SUPABASE_SERVICE_ROLE_KEY"}
                sensitive
              />
            </div>
          )}
        </section>

        {/* Endpoints disponíveis */}
        <section>
          <div className="mb-3 flex items-center gap-2 px-1">
            <Webhook className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Endpoints do bot</h3>
          </div>
          <div className="grid gap-3">
            {BOT_ENDPOINTS.map((ep) => {
              const Icon = ep.icon;
              const fullUrl = `${FUNCTIONS_BASE}${ep.path}`;
              return (
                <Card key={ep.path} className="border-border/40">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold">{ep.name}</h4>
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-400"
                          >
                            {ep.method}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {ep.desc}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="flex-1 truncate rounded-md border border-border/40 bg-muted/30 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                            {fullUrl}
                          </code>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleCopy(ep.path, fullUrl)}
                          >
                            {copiedKey === ep.path ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Como usar */}
        <section>
          <div className="mb-3 flex items-center gap-2 px-1">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Como usar</h3>
          </div>
          <Card className="border-border/40">
            <CardContent className="space-y-4 p-5 text-sm">
              <div>
                <p className="text-muted-foreground">
                  Toda requisição precisa do header{" "}
                  <code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-primary">
                    x-bot-secret
                  </code>{" "}
                  com o valor do{" "}
                  <code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-primary">
                    BOT_API_SECRET
                  </code>
                  .
                </p>
              </div>

              <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Exemplo (cURL)
                </p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground/90">
{`curl -X POST ${FUNCTIONS_BASE}/bot-servicos \\
  -H "Content-Type: application/json" \\
  -H "x-bot-secret: SEU_BOT_API_SECRET" \\
  -d '{}'`}
                </pre>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-amber-400">Atenção:</span> Nunca
                  exponha estas chaves em código de frontend ou repositórios públicos.
                  Use apenas no servidor do seu bot.
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Documentação externa */}
        <section className="pt-2">
          <a
            href="https://doc.evolution-api.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-2xl border border-border/40 bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ExternalLink className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Documentação Evolution API</p>
                <p className="text-xs text-muted-foreground">
                  Servidor open-source para WhatsApp
                </p>
              </div>
            </div>
            <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
          </a>
        </section>
      </div>
    </div>
  );
}

interface CredentialRowProps {
  label: string;
  value: string;
  masked?: boolean;
  maskedValue?: string;
  onToggle?: () => void;
  onCopy: (v: string) => void;
  copied: boolean;
  sensitive?: boolean;
}

function CredentialRow({
  label,
  value,
  masked,
  maskedValue,
  onToggle,
  onCopy,
  copied,
  sensitive,
}: CredentialRowProps) {
  return (
    <div className="rounded-xl border border-border/40 bg-card p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {sensitive && (
          <Badge
            variant="outline"
            className="border-red-500/30 bg-red-500/10 text-[9px] text-red-400"
          >
            SENSÍVEL
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5 font-mono text-xs text-foreground/90">
          {masked && maskedValue ? maskedValue : value || "—"}
        </code>
        {onToggle && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={onToggle}
          >
            {masked ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={() => onCopy(value)}
          disabled={!value}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
