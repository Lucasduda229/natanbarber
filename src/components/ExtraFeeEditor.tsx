import { useState, useEffect } from "react";
import { DollarSign, Save, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const KEYS = ["extra_fee_enabled", "extra_fee_name", "extra_fee_amount", "extra_fee_days"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const parseDays = (raw: string | undefined | null): number[] => {
  if (!raw) return ALL_DAYS;
  const parts = raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return parts.length ? Array.from(new Set(parts)).sort() : ALL_DAYS;
};

export const ExtraFeeEditor = () => {
  const [enabled, setEnabled] = useState(false);
  const [name, setName] = useState("Taxa adicional");
  const [amount, setAmount] = useState("0.00");
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [original, setOriginal] = useState({
    enabled: false,
    name: "Taxa adicional",
    amount: "0.00",
    days: ALL_DAYS,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("admin_settings")
      .select("setting_key, setting_value")
      .in("setting_key", KEYS);
    const map = new Map((data ?? []).map((r) => [r.setting_key, r.setting_value]));
    const next = {
      enabled: (map.get("extra_fee_enabled") ?? "false") === "true",
      name: map.get("extra_fee_name") || "Taxa adicional",
      amount: map.get("extra_fee_amount") || "0.00",
      days: parseDays(map.get("extra_fee_days")),
    };
    setEnabled(next.enabled);
    setName(next.name);
    setAmount(next.amount);
    setDays(next.days);
    setOriginal(next);
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const toggleDay = (d: number) => {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  };

  const handleSave = async () => {
    const numericAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(numericAmount) || numericAmount < 0) {
      toast.error("Valor inválido");
      return;
    }
    if (!name.trim()) {
      toast.error("Nome da taxa é obrigatório");
      return;
    }
    if (enabled && days.length === 0) {
      toast.error("Selecione ao menos um dia da semana");
      return;
    }

    setSaving(true);
    try {
      const daysCsv = (days.length ? days : ALL_DAYS).join(",");
      const rows = [
        { setting_key: "extra_fee_enabled", setting_value: enabled ? "true" : "false" },
        { setting_key: "extra_fee_name", setting_value: name.trim() },
        { setting_key: "extra_fee_amount", setting_value: numericAmount.toFixed(2) },
        { setting_key: "extra_fee_days", setting_value: daysCsv },
      ];
      const { error } = await supabase
        .from("admin_settings")
        .upsert(rows, { onConflict: "setting_key" });
      if (error) throw error;

      toast.success("Taxa adicional atualizada!");
      setOriginal({ enabled, name: name.trim(), amount: numericAmount.toFixed(2), days });
      setEditing(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar taxa");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEnabled(original.enabled);
    setName(original.name);
    setAmount(original.amount);
    setDays(original.days);
    setEditing(false);
  };

  if (loading) {
    return (
      <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
        <CardContent className="p-6 flex items-center justify-center">
          <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between pb-3 sm:pb-4">
        <CardTitle className="flex items-center gap-2 text-foreground text-base sm:text-lg">
          <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Taxa Adicional
        </CardTitle>
        {!editing ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving} className="border-muted-foreground/30">
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-primary/10">
          <div>
            <p className="text-sm font-medium text-foreground">Cobrar taxa nos agendamentos</p>
            <p className="text-xs text-muted-foreground">Quando ativada, a taxa será somada nos dias selecionados abaixo.</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!editing} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome da taxa</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!editing}
              placeholder="Ex: Taxa de domingo"
              className="bg-card/60"
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!editing}
              className="bg-card/60"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Dias em que a taxa é cobrada</Label>
            {editing && (
              <button
                type="button"
                onClick={() => setDays(days.length === 7 ? [] : ALL_DAYS)}
                className="text-xs text-primary hover:underline"
              >
                {days.length === 7 ? "Limpar" : "Todos os dias"}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, idx) => {
              const active = days.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!editing}
                  onClick={() => toggleDay(idx)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card/60 text-muted-foreground border-muted/40 hover:border-primary/40"
                  } ${!editing ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          A taxa só será cobrada nos dias selecionados. O valor e o motivo aparecem no resumo do agendamento e ficam registrados nas observações.
        </p>
      </CardContent>
    </Card>
  );
};
