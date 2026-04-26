import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ShieldCheck,
  Copy,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  KeyRound,
  QrCode,
  Smartphone,
  RefreshCw,
  Power,
  Wifi,
  WifiOff,
  AlertCircle,
  Plug,
} from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = "https://ttecccbrigcckurnezhl.supabase.co";
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

type ConnStatus = "connected" | "disconnected" | "connecting" | "unknown";

interface BotConfig {
  id: string;
  qrcode_endpoint: string | null;
  pairing_endpoint: string | null;
  status_endpoint: string | null;
  last_status: string | null;
  last_connected_at: string | null;
}

export default function WhatsAppConnection() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  // Credenciais
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

  // Conexão
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [status, setStatus] = useState<ConnStatus>("unknown");
  const [qrData, setQrData] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [loadingQr, setLoadingQr] = useState(false);
  const [loadingPair, setLoadingPair] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const triedAutoQr = useRef(false);

  // Guarda admin
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  // Carrega config silenciosamente (apenas para saber status atual e se endpoints existem)
  const loadConfig = useCallback(async () => {
    const { data, error } = await supabase
      .from("whatsapp_bot_config")
      .select("id, qrcode_endpoint, pairing_endpoint, status_endpoint, last_status, last_connected_at")
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error(error);
      return;
    }
    if (data) {
      setConfig(data as BotConfig);
      setStatus((data.last_status as ConnStatus) || "disconnected");
    }
  }, []);

  useEffect(() => {
    if (user && isAdmin) loadConfig();
  }, [user, isAdmin, loadConfig]);

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
      const { data, error } = await supabase.functions.invoke(
        "get-connection-credentials",
        { body: {} }
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
      toast.error(e.message || "Erro ao carregar credenciais");
    } finally {
      setRevealing(false);
    }
  };

  const callProxy = async (action: string, payload?: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke(
      "whatsapp-bot-proxy",
      { body: { action, ...payload } }
    );
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Falha");
    return data.data;
  };

  const fetchQr = useCallback(
    async (silent = false) => {
      setLoadingQr(true);
      setQrData(null);
      try {
        const data = await callProxy("qrcode");
        let qr: string | null = null;
        if (typeof data === "string") qr = data;
        else if (data && typeof data === "object") {
          const d = data as any;
          qr = d.qrcode || d.base64 || d.qr || d.image || d.code || null;
        }
        if (!qr) throw new Error("Bot não retornou QR Code");
        setQrData(qr);
        if (!silent) toast.success("QR Code gerado");
      } catch (e: any) {
        if (!silent) {
          // Mensagem amigável quando bot offline / sem endpoint
          const msg = e.message || "";
          if (msg.includes("não configurado") || msg.includes("502")) {
            toast.error("Chatbot offline. Conecte o servidor primeiro.");
          } else {
            toast.error(msg || "Erro ao gerar QR");
          }
        }
      } finally {
        setLoadingQr(false);
      }
    },
    []
  );

  const fetchPairing = async () => {
    const phone = phoneInput.replace(/\D/g, "");
    if (!phone || phone.length < 10) {
      toast.error("Digite um número válido com DDI e DDD");
      return;
    }
    setLoadingPair(true);
    setPairingCode(null);
    try {
      const data = await callProxy("pairing", { phone });
      let code: string | null = null;
      if (typeof data === "string") code = data;
      else if (data && typeof data === "object") {
        const d = data as any;
        code = d.code || d.pairingCode || d.pairing_code || null;
      }
      if (!code) throw new Error("Bot não retornou código");
      setPairingCode(code);
      toast.success("Código gerado");
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("não configurado") || msg.includes("502")) {
        toast.error("Chatbot offline. Não é possível gerar código agora.");
      } else {
        toast.error(msg || "Erro ao gerar código");
      }
    } finally {
      setLoadingPair(false);
    }
  };

  const checkStatus = async (silent = false) => {
    setLoadingStatus(true);
    try {
      await callProxy("status");
      await loadConfig();
      if (!silent) toast.success("Status atualizado");
    } catch (e: any) {
      if (!silent) toast.error(e.message || "Erro ao verificar status");
    } finally {
      setLoadingStatus(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Desconectar o WhatsApp?")) return;
    try {
      await callProxy("disconnect");
      setQrData(null);
      setPairingCode(null);
      await loadConfig();
      toast.success("Desconectado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao desconectar");
    }
  };

  // 🔄 Auto: tenta verificar status ao abrir a página (silencioso)
  useEffect(() => {
    if (config?.status_endpoint && !triedAutoQr.current) {
      checkStatus(true);
    }
  }, [config?.status_endpoint]);

  // 🔄 Auto-gera QR quando o bot estiver online
  useEffect(() => {
    if (
      status === "connecting" &&
      config?.qrcode_endpoint &&
      !qrData &&
      !triedAutoQr.current
    ) {
      triedAutoQr.current = true;
      fetchQr(true);
    }
    // Reset trigger quando desconectar
    if (status === "disconnected") {
      triedAutoQr.current = false;
    }
  }, [status, config?.qrcode_endpoint, qrData, fetchQr]);

  if (loading || !user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const mask = (v?: string) => (v ? v.slice(0, 6) + "•".repeat(20) + v.slice(-4) : "");

  const statusMeta: Record<ConnStatus, { label: string; icon: typeof Wifi }> = {
    connected: { label: "Conectado", icon: Wifi },
    disconnected: { label: "Desconectado", icon: WifiOff },
    connecting: { label: "Conectando...", icon: Loader2 },
    unknown: { label: "Aguardando", icon: AlertCircle },
  };
  const sm = statusMeta[status];
  const StatusIcon = sm.icon;

  const qrSrc = qrData
    ? qrData.startsWith("data:") || qrData.startsWith("http")
      ? qrData
      : `data:image/png;base64,${qrData.replace(/^base64,/, "")}`
    : null;

  // O bot está pronto para gerar (online ou conectando)?
  const botReady = status === "connecting" || status === "unknown" || !!config?.qrcode_endpoint;
  const botOffline = status === "disconnected" && !config?.qrcode_endpoint;

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
              Apenas administradores
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6">
        {/* Status card */}
        <Card
          className={`overflow-hidden border-2 ${
            status === "connected"
              ? "border-emerald-500/40 bg-emerald-500/5"
              : status === "connecting"
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-border/40 bg-card"
          }`}
        >
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  status === "connected"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : status === "connecting"
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-muted/40 text-muted-foreground"
                }`}
              >
                <StatusIcon
                  className={`h-6 w-6 ${
                    status === "connecting" ? "animate-spin" : ""
                  }`}
                />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status do WhatsApp
                </p>
                <p className="text-lg font-bold">{sm.label}</p>
                {config?.last_connected_at && status === "connected" && (
                  <p className="text-[11px] text-muted-foreground">
                    Desde{" "}
                    {new Date(config.last_connected_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => checkStatus()}
                disabled={loadingStatus}
                title="Atualizar status"
              >
                {loadingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              {status === "connected" && (
                <Button
                  size="icon"
                  variant="outline"
                  onClick={disconnect}
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  title="Desconectar"
                >
                  <Power className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Aviso quando offline */}
        {botOffline && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Chatbot desconectado
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Quando o servidor do chatbot estiver online, o QR Code aparecerá
                aqui automaticamente.
              </p>
            </div>
          </div>
        )}

        {/* Card de conexão — abas */}
        <Card className="border-border/40">
          <CardContent className="p-5">
            <Tabs defaultValue="qr" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="qr" className="gap-2">
                  <QrCode className="h-4 w-4" />
                  QR Code
                </TabsTrigger>
                <TabsTrigger value="code" className="gap-2">
                  <Smartphone className="h-4 w-4" />
                  Código
                </TabsTrigger>
              </TabsList>

              {/* ===== QR Code: gera automaticamente quando bot online ===== */}
              <TabsContent value="qr" className="mt-5">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative flex h-64 w-64 items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/10 p-3">
                    {loadingQr ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-xs text-muted-foreground">
                          Gerando QR...
                        </p>
                      </div>
                    ) : qrSrc ? (
                      <img
                        src={qrSrc}
                        alt="QR Code WhatsApp"
                        className="h-full w-full rounded-xl bg-white object-contain p-2"
                      />
                    ) : status === "connected" ? (
                      <div className="flex flex-col items-center gap-2 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                          <Check className="h-6 w-6 text-emerald-400" />
                        </div>
                        <p className="text-sm font-medium">WhatsApp conectado</p>
                        <p className="text-xs text-muted-foreground">
                          Não é necessário escanear QR
                        </p>
                      </div>
                    ) : botOffline ? (
                      <div className="flex flex-col items-center gap-2 text-center">
                        <WifiOff className="h-10 w-10 text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground">
                          Aguardando o chatbot ficar online...
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-center">
                        <QrCode className="h-12 w-12 text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground">
                          Toque em "Atualizar QR" abaixo
                        </p>
                      </div>
                    )}
                  </div>

                  {status !== "connected" && (
                    <Button
                      onClick={() => fetchQr()}
                      disabled={loadingQr}
                      className="w-full max-w-xs bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50"
                    >
                      {loadingQr ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          {qrData ? "Atualizar QR" : "Gerar QR"}
                        </>
                      )}
                    </Button>
                  )}

                  {status !== "connected" && (
                    <ol className="space-y-1.5 text-[12px] text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                          1
                        </span>
                        Abra o WhatsApp no celular
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                          2
                        </span>
                        Toque em <b>Mais opções</b> → <b>Aparelhos conectados</b>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                          3
                        </span>
                        Toque em <b>Conectar um aparelho</b> e aponte para o QR
                      </li>
                    </ol>
                  )}
                </div>
              </TabsContent>

              {/* ===== Código: telefone + Conectar ===== */}
              <TabsContent value="code" className="mt-5">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-full max-w-xs">
                    <Label htmlFor="phone" className="text-xs">
                      Número do WhatsApp (com DDI + DDD)
                    </Label>
                    <Input
                      id="phone"
                      placeholder="55 11 99999-9999"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !loadingPair) fetchPairing();
                      }}
                      disabled={status === "connected"}
                      className="mt-1.5 font-mono"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Exemplo: 5511999999999
                    </p>
                  </div>

                  {status === "connected" ? (
                    <div className="flex w-full max-w-xs flex-col items-center gap-2 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
                        <Check className="h-5 w-5 text-emerald-400" />
                      </div>
                      <p className="text-sm font-medium">WhatsApp já conectado</p>
                    </div>
                  ) : (
                    <Button
                      onClick={fetchPairing}
                      disabled={loadingPair || !phoneInput.trim()}
                      className="w-full max-w-xs bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50"
                    >
                      {loadingPair ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Conectando...
                        </>
                      ) : (
                        <>
                          <Plug className="mr-2 h-4 w-4" />
                          Conectar
                        </>
                      )}
                    </Button>
                  )}

                  {pairingCode && status !== "connected" && (
                    <div className="w-full max-w-xs rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                        Código de pareamento
                      </p>
                      <p className="font-mono text-3xl font-bold tracking-[0.3em] text-foreground">
                        {pairingCode}
                      </p>
                      <button
                        onClick={() => handleCopy("pairing", pairingCode)}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
                      >
                        {copiedKey === "pairing" ? (
                          <>
                            <Check className="h-3 w-3" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copiar
                          </>
                        )}
                      </button>
                      <ol className="mt-4 space-y-1.5 text-left text-[11px] text-muted-foreground">
                        <li>1. Abra o WhatsApp → <b>Aparelhos conectados</b></li>
                        <li>2. Toque em <b>Conectar com número de telefone</b></li>
                        <li>3. Digite o código mostrado acima</li>
                      </ol>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

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
                  </p>
                </div>
                <Button
                  onClick={revealCredentials}
                  disabled={revealing}
                  className="bg-gradient-to-br from-primary to-secondary text-primary-foreground"
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
            {masked ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
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
