import { useEffect, useState, useCallback } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Settings,
  QrCode,
  Smartphone,
  RefreshCw,
  Power,
  Wifi,
  WifiOff,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = "https://ttecccbrigcckurnezhl.supabase.co";
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

interface BotConfig {
  id: string;
  bot_base_url: string | null;
  qrcode_endpoint: string | null;
  pairing_endpoint: string | null;
  status_endpoint: string | null;
  disconnect_endpoint: string | null;
  auth_header_name: string | null;
  auth_header_value: string | null;
  last_status: string | null;
  last_connected_at: string | null;
}

type ConnStatus = "connected" | "disconnected" | "connecting" | "unknown";

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

  // Bot config
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);
  const [editCfg, setEditCfg] = useState<Partial<BotConfig>>({});

  // Conexão WhatsApp
  const [status, setStatus] = useState<ConnStatus>("unknown");
  const [qrData, setQrData] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [loadingQr, setLoadingQr] = useState(false);
  const [loadingPair, setLoadingPair] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Guarda admin
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  // Load config
  const loadConfig = useCallback(async () => {
    const { data, error } = await supabase
      .from("whatsapp_bot_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      return;
    }
    if (data) {
      setConfig(data as BotConfig);
      setStatus((data.last_status as ConnStatus) || "unknown");
      setEditCfg(data);
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

  const saveConfig = async () => {
    if (!config) return;
    setSavingCfg(true);
    const { error } = await supabase
      .from("whatsapp_bot_config")
      .update({
        bot_base_url: editCfg.bot_base_url || null,
        qrcode_endpoint: editCfg.qrcode_endpoint || null,
        pairing_endpoint: editCfg.pairing_endpoint || null,
        status_endpoint: editCfg.status_endpoint || null,
        disconnect_endpoint: editCfg.disconnect_endpoint || null,
        auth_header_name: editCfg.auth_header_name || "Authorization",
        auth_header_value: editCfg.auth_header_value || null,
      })
      .eq("id", config.id);

    if (error) {
      toast.error("Erro ao salvar configuração");
    } else {
      toast.success("Configuração salva");
      setConfigOpen(false);
      loadConfig();
    }
    setSavingCfg(false);
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

  const fetchQr = async () => {
    if (!config?.qrcode_endpoint) {
      toast.error("Configure o endpoint de QR Code primeiro");
      setConfigOpen(true);
      return;
    }
    setLoadingQr(true);
    setQrData(null);
    try {
      const data = await callProxy("qrcode");
      // Aceita base64, data:image, ou objeto { qrcode | base64 | qr | image }
      let qr: string | null = null;
      if (typeof data === "string") qr = data;
      else if (data && typeof data === "object") {
        const d = data as any;
        qr = d.qrcode || d.base64 || d.qr || d.image || d.code || null;
      }
      if (!qr) throw new Error("Resposta do bot não contém QR Code");
      setQrData(qr);
      toast.success("QR Code gerado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar QR");
    } finally {
      setLoadingQr(false);
    }
  };

  const fetchPairing = async () => {
    if (!config?.pairing_endpoint) {
      toast.error("Configure o endpoint de pareamento primeiro");
      setConfigOpen(true);
      return;
    }
    if (!phoneInput.trim()) {
      toast.error("Digite o número de telefone");
      return;
    }
    setLoadingPair(true);
    setPairingCode(null);
    try {
      const data = await callProxy("pairing", { phone: phoneInput.replace(/\D/g, "") });
      let code: string | null = null;
      if (typeof data === "string") code = data;
      else if (data && typeof data === "object") {
        const d = data as any;
        code = d.code || d.pairingCode || d.pairing_code || null;
      }
      if (!code) throw new Error("Resposta do bot não contém código");
      setPairingCode(code);
      toast.success("Código gerado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar código");
    } finally {
      setLoadingPair(false);
    }
  };

  const checkStatus = async () => {
    if (!config?.status_endpoint) {
      toast.error("Configure o endpoint de status primeiro");
      setConfigOpen(true);
      return;
    }
    setLoadingStatus(true);
    try {
      await callProxy("status");
      await loadConfig();
      toast.success("Status atualizado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao verificar status");
    } finally {
      setLoadingStatus(false);
    }
  };

  const disconnect = async () => {
    if (!config?.disconnect_endpoint) {
      toast.error("Configure o endpoint de desconexão primeiro");
      setConfigOpen(true);
      return;
    }
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

  if (loading || !user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const mask = (v?: string) => (v ? v.slice(0, 6) + "•".repeat(20) + v.slice(-4) : "");

  const statusMeta: Record<ConnStatus, { label: string; color: string; icon: typeof Wifi }> = {
    connected: { label: "Conectado", color: "emerald", icon: Wifi },
    disconnected: { label: "Desconectado", color: "red", icon: WifiOff },
    connecting: { label: "Conectando", color: "amber", icon: Loader2 },
    unknown: { label: "Desconhecido", color: "gray", icon: AlertCircle },
  };
  const sm = statusMeta[status];
  const StatusIcon = sm.icon;

  // QR rendering: aceita data URI ou raw base64
  const qrSrc = qrData
    ? qrData.startsWith("data:") || qrData.startsWith("http")
      ? qrData
      : `data:image/png;base64,${qrData.replace(/^base64,/, "")}`
    : null;

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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfigOpen(true)}
            className="rounded-full"
            title="Configurar URLs do bot"
          >
            <Settings className="h-5 w-5" />
          </Button>
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
                  className={`h-6 w-6 ${status === "connecting" ? "animate-spin" : ""}`}
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
                onClick={checkStatus}
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

        {/* Conectar — QR / Código */}
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

              {/* QR */}
              <TabsContent value="qr" className="mt-5">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex h-64 w-64 items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/10 p-3">
                    {loadingQr ? (
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    ) : qrSrc ? (
                      <img
                        src={qrSrc}
                        alt="QR Code WhatsApp"
                        className="h-full w-full rounded-xl bg-white object-contain p-2"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-center">
                        <QrCode className="h-12 w-12 text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground">
                          Clique em "Gerar QR" para começar
                        </p>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={fetchQr}
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
                        <QrCode className="mr-2 h-4 w-4" />
                        {qrData ? "Atualizar QR" : "Gerar QR"}
                      </>
                    )}
                  </Button>

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
                      Toque em <b>Conectar um aparelho</b> e aponte para este QR
                    </li>
                  </ol>
                </div>
              </TabsContent>

              {/* Código */}
              <TabsContent value="code" className="mt-5">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-full max-w-xs">
                    <Label htmlFor="phone" className="text-xs">
                      Número do WhatsApp (com DDI)
                    </Label>
                    <Input
                      id="phone"
                      placeholder="5511999999999"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="mt-1.5 font-mono"
                    />
                  </div>

                  {pairingCode && (
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
                    </div>
                  )}

                  <Button
                    onClick={fetchPairing}
                    disabled={loadingPair}
                    className="w-full max-w-xs bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50"
                  >
                    {loadingPair ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Smartphone className="mr-2 h-4 w-4" />
                        {pairingCode ? "Gerar novo código" : "Gerar código"}
                      </>
                    )}
                  </Button>

                  <ol className="space-y-1.5 text-[12px] text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                        1
                      </span>
                      Abra o WhatsApp → <b>Aparelhos conectados</b>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                        2
                      </span>
                      Toque em <b>Conectar com número de telefone</b>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                        3
                      </span>
                      Digite o código mostrado acima
                    </li>
                  </ol>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Aviso quando bot não configurado */}
        {config &&
          !config.bot_base_url &&
          !config.qrcode_endpoint &&
          !config.pairing_endpoint && (
            <button
              onClick={() => setConfigOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-left transition-colors hover:bg-amber-500/10"
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Configure as URLs do seu chatbot
                </p>
                <p className="text-xs text-muted-foreground">
                  Toque aqui para informar onde seu bot expõe QR/código
                </p>
              </div>
              <Settings className="h-4 w-4 text-amber-400" />
            </button>
          )}

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

      {/* Dialog: configurar URLs do bot */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Configurar Chatbot
            </DialogTitle>
            <DialogDescription>
              Informe as URLs onde seu bot expõe QR Code, código de pareamento e status.
              Pode usar URL completa ou caminho relativo à URL base.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">URL base do bot</Label>
              <Input
                placeholder="https://meu-chatbot.com"
                value={editCfg.bot_base_url || ""}
                onChange={(e) => setEditCfg({ ...editCfg, bot_base_url: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Endpoint QR Code (GET)</Label>
              <Input
                placeholder="/instance/qrcode  ou  https://..."
                value={editCfg.qrcode_endpoint || ""}
                onChange={(e) => setEditCfg({ ...editCfg, qrcode_endpoint: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Endpoint Pareamento (POST)</Label>
              <Input
                placeholder="/instance/pairing-code"
                value={editCfg.pairing_endpoint || ""}
                onChange={(e) => setEditCfg({ ...editCfg, pairing_endpoint: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Recebe {`{ "number": "5511999999999" }`}
              </p>
            </div>

            <div>
              <Label className="text-xs">Endpoint Status (GET)</Label>
              <Input
                placeholder="/instance/connectionState"
                value={editCfg.status_endpoint || ""}
                onChange={(e) => setEditCfg({ ...editCfg, status_endpoint: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Endpoint Desconectar (POST)</Label>
              <Input
                placeholder="/instance/logout"
                value={editCfg.disconnect_endpoint || ""}
                onChange={(e) => setEditCfg({ ...editCfg, disconnect_endpoint: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Header de auth</Label>
                <Input
                  placeholder="Authorization"
                  value={editCfg.auth_header_name || ""}
                  onChange={(e) =>
                    setEditCfg({ ...editCfg, auth_header_name: e.target.value })
                  }
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Valor (token/apikey)</Label>
                <Input
                  type="password"
                  placeholder="Bearer xxx ou apikey"
                  value={editCfg.auth_header_value || ""}
                  onChange={(e) =>
                    setEditCfg({ ...editCfg, auth_header_value: e.target.value })
                  }
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={saveConfig}
              disabled={savingCfg}
              className="bg-gradient-to-br from-primary to-secondary text-primary-foreground"
            >
              {savingCfg ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
