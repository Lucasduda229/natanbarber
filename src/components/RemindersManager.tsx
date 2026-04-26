import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle, XCircle, Clock, Save, Info } from "lucide-react";
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
  { title: string; description: string; icon: typeof Bell; hasTime: boolean }
> = {
  appointment_confirmed: {
    title: "Agendamento Confirmado",
    description: "Enviado quando um agendamento é confirmado.",
    icon: CheckCircle,
    hasTime: false,
  },
  appointment_cancelled: {
    title: "Agendamento Cancelado",
    description: "Enviado quando um agendamento é cancelado.",
    icon: XCircle,
    hasTime: false,
  },
  reminder_24h: {
    title: "Lembrete 24h Antes",
    description: "Enviado um dia antes do horário marcado para confirmar presença.",
    icon: Clock,
    hasTime: true,
  },
};

const VARIABLES = [
  { key: "{nome}", desc: "Nome do cliente" },
  { key: "{data}", desc: "Data do agendamento" },
  { key: "{hora}", desc: "Horário" },
  { key: "{servico}", desc: "Nome do serviço" },
];

export const RemindersManager = () => {
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
      // Order: confirmed → cancelled → 24h
      const order = ["appointment_confirmed", "appointment_cancelled", "reminder_24h"];
      const sorted = (data || []).sort(
        (a, b) => order.indexOf(a.reminder_type) - order.indexOf(b.reminder_type)
      );
      setReminders(sorted);
    }
    setLoading(false);
  };

  const updateField = (id: string, field: keyof ReminderSetting, value: string | boolean | null) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
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
      toast.success("Lembrete atualizado!");
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
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Carregando lembretes...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            Configure as mensagens automáticas que serão enviadas aos clientes. Use as
            variáveis abaixo no texto:
            <div className="flex flex-wrap gap-2 mt-2">
              {VARIABLES.map((v) => (
                <Badge key={v.key} variant="secondary" className="font-mono text-xs">
                  {v.key} <span className="ml-1 font-normal opacity-70">— {v.desc}</span>
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {reminders.map((reminder) => {
        const meta = REMINDER_META[reminder.reminder_type];
        if (!meta) return null;
        const Icon = meta.icon;

        return (
          <Card key={reminder.id} className={!reminder.is_enabled ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{meta.title}</CardTitle>
                    <CardDescription className="mt-1">{meta.description}</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={reminder.is_enabled}
                  onCheckedChange={(v) => toggleEnabled(reminder, v)}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor={`msg-${reminder.id}`}>Mensagem</Label>
                <Textarea
                  id={`msg-${reminder.id}`}
                  value={reminder.message_template}
                  onChange={(e) =>
                    updateField(reminder.id, "message_template", e.target.value)
                  }
                  rows={4}
                  className="mt-2 font-mono text-sm"
                  disabled={!reminder.is_enabled}
                />
              </div>

              {meta.hasTime && (
                <div>
                  <Label htmlFor={`time-${reminder.id}`}>Horário do envio</Label>
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
                    className="mt-2 w-40"
                    disabled={!reminder.is_enabled}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Hora em que o lembrete será enviado no dia anterior ao agendamento.
                  </p>
                </div>
              )}

              <Button
                onClick={() => saveReminder(reminder)}
                disabled={savingId === reminder.id}
                className="w-full sm:w-auto"
              >
                <Save className="w-4 h-4 mr-2" />
                {savingId === reminder.id ? "Salvando..." : "Salvar alterações"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default RemindersManager;
