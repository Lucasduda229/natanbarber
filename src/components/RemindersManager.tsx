import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bell, CheckCircle2, XCircle, Clock, Save, Sparkles, Link2, Lock, Zap, Crown } from "lucide-react";
import { toast } from "sonner";

interface ReminderSetting {
  id: string;
  reminder_type: string;
  is_enabled: boolean;
  message_template: string;
  send_time: string | null;
}

const REMINDER_META: Record<
  string,
  {
    title: string;
    description: string;
    icon: typeof Bell;
    hasTime: boolean;
    accent: string; // tailwind color class for icon tint
  }
> = {
  appointment_confirmed: {
    title: "Confirmação de agendamento",
    description: "Mensagem enviada assim que um agendamento é confirmado.",
    icon: CheckCircle2,
    hasTime: false,
    accent: "text-emerald-400",
  },
  appointment_cancelled: {
    title: "Cancelamento de agendamento",
    description: "Mensagem enviada quando um agendamento é cancelado.",
    icon: XCircle,
    hasTime: false,
    accent: "text-red-400",
  },
  reminder_24h: {
    title: "Lembrete 24h antes",
    description: "Disparado um dia antes para confirmar a presença do cliente.",
    icon: Clock,
    hasTime: true,
    accent: "text-primary",
  },
};

const VARIABLES = [
  { key: "{nome}", desc: "Nome do cliente" },
  { key: "{data}", desc: "Data" },
  { key: "{hora}", desc: "Horário" },
  { key: "{servico}", desc: "Serviço" },
];

export const RemindersManager = () => {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<ReminderSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reminder_settings")
      .select("*")
      .order("reminder_type");

    if (error) {
      toast.error("Erro ao carregar lembretes");
      console.error(error);
    } else {
      const order = ["appointment_confirmed", "appointment_cancelled", "reminder_24h"];
      const sorted = (data || []).sort(
        (a, b) => order.indexOf(a.reminder_type) - order.indexOf(b.reminder_type)
      );
      setReminders(sorted);
    }
    setLoading(false);
  };

  const updateField = (
    id: string,
    field: keyof ReminderSetting,
    value: string | boolean | null
  ) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const insertVariable = (id: string, variable: string) => {
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder) return;
    const textarea = document.getElementById(`msg-${id}`) as HTMLTextAreaElement | null;
    const start = textarea?.selectionStart ?? reminder.message_template.length;
    const end = textarea?.selectionEnd ?? reminder.message_template.length;
    const newValue =
      reminder.message_template.slice(0, start) +
      variable +
      reminder.message_template.slice(end);
    updateField(id, "message_template", newValue);
    setTimeout(() => {
      textarea?.focus();
      const pos = start + variable.length;
      textarea?.setSelectionRange(pos, pos);
    }, 0);
  };

  const saveReminder = async (reminder: ReminderSetting) => {
    setSavingId(reminder.id);
    const { error } = await supabase
      .from("reminder_settings")
      .update({
        is_enabled: reminder.is_enabled,
        message_template: reminder.message_template,
        send_time: reminder.send_time,
      })
      .eq("id", reminder.id);

    if (error) {
      toast.error("Erro ao salvar");
      console.error(error);
    } else {
      toast.success("Lembrete atualizado");
    }
    setSavingId(null);
  };

  const toggleEnabled = async (reminder: ReminderSetting, enabled: boolean) => {
    updateField(reminder.id, "is_enabled", enabled);
    const { error } = await supabase
      .from("reminder_settings")
      .update({ is_enabled: enabled })
      .eq("id", reminder.id);

    if (error) {
      toast.error("Erro ao atualizar status");
      updateField(reminder.id, "is_enabled", !enabled);
    } else {
      toast.success(enabled ? "Lembrete ativado" : "Lembrete desativado");
    }
  };

  if (loading) {
    return (
      <Card className="border-border/40">
        <CardContent className="p-10 text-center text-muted-foreground text-sm">
          Carregando lembretes...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Banner: upgrade para plano automático */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-card p-4">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Função bloqueada
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
                <Zap className="h-2.5 w-2.5" />
                Upgrade
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Migre para o <b className="text-amber-400">Plano Automático</b> para liberar o envio automático de lembretes via WhatsApp pelo seu chatbot.
            </p>
          </div>
        </div>
      </div>

      {/* Botão Conectar WhatsApp — leva à página privada do chatbot */}
      <button
        type="button"
        onClick={() => navigate("/admin/whatsapp-connection")}
        className="group relative w-full overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-emerald-600/10 to-card p-5 text-left transition-all hover:border-emerald-500/50 hover:shadow-[0_8px_32px_-12px_rgba(16,185,129,0.4)] active:scale-[0.99]"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold text-foreground">
                Conectar WhatsApp
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
                <Lock className="h-2.5 w-2.5" />
                PRIVADO
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Integre seu chatbot externo à barbearia
            </p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 transition-transform group-hover:translate-x-0.5">
            <Link2 className="h-4 w-4" />
          </div>
        </div>
      </button>

      {/* Header explicativo refinado */}
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-card to-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              Mensagens automáticas
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Personalize o que seus clientes recebem. Toque numa variável para inserir.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {VARIABLES.map((v) => (
                <span
                  key={v.key}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 font-mono text-[11px] text-primary"
                  title={v.desc}
                >
                  {v.key}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cards de lembretes */}
      {reminders.map((reminder) => {
        const meta = REMINDER_META[reminder.reminder_type];
        if (!meta) return null;
        const Icon = meta.icon;
        const isOn = reminder.is_enabled;

        return (
          <Card
            key={reminder.id}
            className={`overflow-hidden border-border/40 bg-card transition-all duration-300 ${
              isOn
                ? "shadow-[0_4px_24px_-12px_hsl(45_75%_52%_/_0.25)]"
                : "opacity-70"
            }`}
          >
            {/* Top bar com toggle */}
            <div className="flex items-center justify-between gap-3 border-b border-border/30 bg-muted/20 px-5 py-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl bg-background/60 ring-1 ring-border/40 ${meta.accent}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold leading-tight text-foreground">
                    {meta.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {meta.description}
                  </p>
                </div>
              </div>
              <Switch
                checked={isOn}
                onCheckedChange={(v) => toggleEnabled(reminder, v)}
              />
            </div>

            {/* Corpo */}
            <CardContent className="space-y-4 p-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label
                    htmlFor={`msg-${reminder.id}`}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    MENSAGEM
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {VARIABLES.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVariable(reminder.id, v.key)}
                        disabled={!isOn}
                        className="rounded-md border border-border/50 bg-background/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-40 disabled:hover:border-border/50 disabled:hover:bg-background/40 disabled:hover:text-muted-foreground"
                      >
                        {v.key}
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  id={`msg-${reminder.id}`}
                  value={reminder.message_template}
                  onChange={(e) =>
                    updateField(reminder.id, "message_template", e.target.value)
                  }
                  rows={4}
                  className="resize-none rounded-xl border-border/50 bg-background/40 font-mono text-[13px] leading-relaxed focus-visible:ring-primary/40"
                  disabled={!isOn}
                />
              </div>

              {meta.hasTime && (
                <div className="flex items-end gap-3 rounded-xl border border-border/40 bg-muted/20 p-3">
                  <Clock className="mt-2 h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <Label
                      htmlFor={`time-${reminder.id}`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Horário do envio
                    </Label>
                    <Input
                      id={`time-${reminder.id}`}
                      type="time"
                      value={reminder.send_time?.slice(0, 5) || ""}
                      onChange={(e) =>
                        updateField(
                          reminder.id,
                          "send_time",
                          e.target.value ? `${e.target.value}:00` : null
                        )
                      }
                      className="mt-1 h-9 w-32 rounded-lg border-border/50 bg-background/60"
                      disabled={!isOn}
                    />
                  </div>
                  <p className="pb-2 text-[11px] text-muted-foreground">
                    Enviado no dia anterior
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button
                  onClick={() => saveReminder(reminder)}
                  disabled={savingId === reminder.id || !isOn}
                  size="sm"
                  className="h-9 rounded-lg bg-gradient-to-br from-primary to-secondary px-4 font-medium text-primary-foreground shadow-sm transition-all hover:shadow-[0_0_20px_hsl(45_75%_52%_/_0.4)]"
                >
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  {savingId === reminder.id ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default RemindersManager;
