import { useEffect, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Plus, Trash2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  SpecialHours,
  listSpecialHours,
  upsertSpecialHours,
  deleteSpecialHours,
  isOvernight,
} from "@/lib/specialHours";

const nextDayLabel = (d: string) => format(addDays(parseISO(d), 1), "dd/MM");

/**
 * Permite definir um horário de atendimento diferente para uma data específica.
 * Nessa data, o horário semanal é ignorado e valem apenas os horários definidos aqui.
 */
export const SpecialHoursEditor = () => {
  const [items, setItems] = useState<SpecialHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("18:00");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<SpecialHours | null>(null);

  const resetForm = () => {
    setEditing(null);
    setDate("");
    setStart("08:00");
    setEnd("18:00");
    setNote("");
  };

  const startEdit = (it: SpecialHours) => {
    setEditing(it);
    setDate(it.special_date);
    setStart(it.start_time.slice(0, 5));
    setEnd(it.end_time.slice(0, 5));
    setNote(it.note || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const load = async () => {
    try {
      setItems(await listSpecialHours(format(new Date(), "yyyy-MM-dd")));
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar horários especiais");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    if (!date) return toast.error("Selecione a data");
    if (!start || !end) return toast.error("Informe o horário de início e fim");
    setSaving(true);
    try {
      // Se mudou a data durante a edição, remove o registro antigo
      if (editing && editing.special_date !== date) {
        await deleteSpecialHours(editing.id);
      }
      await upsertSpecialHours({
        special_date: date,
        start_time: start,
        end_time: end,
        note: note.trim() || null,
      });
      toast.success(editing ? "Horário especial atualizado!" : "Horário especial salvo!");
      resetForm();
      load();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar horário especial");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSpecialHours(id);
      if (editing?.id === id) resetForm();
      toast.success("Horário especial removido");
      load();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao remover");
    }
  };

  return (
    <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="flex items-center gap-2 text-foreground text-base sm:text-lg">
          <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Horário para Dia Específico
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-card/60 h-9 text-sm" />
          <div className="flex items-center gap-2">
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="bg-card/60 h-9 text-sm w-28" />
            <span className="text-muted-foreground text-xs">até</span>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="bg-card/60 h-9 text-sm w-28" />
          </div>
          <Input
            placeholder="Obs. (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bg-card/60 h-9 text-sm sm:w-40"
          />
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving || !date} size="sm" className="bg-primary text-primary-foreground h-9 flex-1">
              {editing ? <Pencil className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              {editing ? "Atualizar" : "Salvar"}
            </Button>
            {editing && (
              <Button onClick={resetForm} variant="outline" size="sm" className="h-9" title="Cancelar edição">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        {editing && (
          <p className="text-xs text-primary">
            Editando o dia {format(parseISO(editing.special_date), "dd/MM/yyyy")}
          </p>
        )}
        {start && end && end <= start && (
          <p className="text-xs text-primary">
            🌙 Vira a noite: atende de {start}{date ? ` do dia ${format(parseISO(date), "dd/MM")}` : ""} até {end} do dia seguinte
            {date ? ` (${nextDayLabel(date)})` : ""}{start === end ? " — 24 horas" : ""}.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Nessa data, o horário semanal é substituído por este (slots de 30 em 30 min). Funciona também em dias que normalmente são fechados. Se o horário final for igual ou menor que o inicial, o atendimento continua até o dia seguinte (ex: 07:00 até 07:00 = 24h).
        </p>

        {loading ? (
          <div className="flex justify-center py-4">
            <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-center py-3 text-sm">Nenhum horário especial cadastrado</p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {format(parseISO(it.special_date), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {it.start_time.slice(0, 5)} até {it.end_time.slice(0, 5)}
                    {isOvernight(it) ? ` do dia ${nextDayLabel(it.special_date)}` : ""}
                    {it.note ? ` • ${it.note}` : ""}
                  </p>
                  {isOvernight(it) && (
                    <p className="text-[11px] text-primary">
                      🌙 Vira a noite{it.start_time === it.end_time ? " — 24 horas" : ""}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit(it)}
                  className="text-primary hover:bg-primary/20 h-8 w-8 p-0"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(it.id)}
                  className="text-destructive hover:bg-destructive/20 h-8 w-8 p-0 flex-shrink-0"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SpecialHoursEditor;

