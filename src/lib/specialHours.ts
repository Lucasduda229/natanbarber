import { supabase } from "@/integrations/supabase/client";
import { addDays, format, parseISO, subDays } from "date-fns";

export interface SpecialHours {
  id: string;
  special_date: string; // yyyy-MM-dd
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  note: string | null;
}

// Tabela nova; cast para não depender dos types gerados
const table = () => (supabase as any).from("special_hours");

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;

/** Gera slots de 30 em 30 min entre início e fim (inclusive), no formato HH:mm:00 */
export const generateSlotTimes = (start: string, end: string): string[] => {
  const out: string[] = [];
  for (let m = toMin(start); m <= toMin(end); m += 30) out.push(fromMin(m));
  return out;
};

/** Horário que "vira a noite": fim igual ou antes do início (ex: 07:00 até 07:00 = 24h) */
export const isOvernight = (row: Pick<SpecialHours, "start_time" | "end_time">) =>
  toMin(row.end_time) <= toMin(row.start_time);

/** Slots que o horário especial gera no PRÓPRIO dia */
const ownDaySlots = (row: SpecialHours) =>
  isOvernight(row) ? generateSlotTimes(row.start_time, "23:30") : generateSlotTimes(row.start_time, row.end_time);

/** Slots que um horário overnight do dia anterior gera na madrugada seguinte (até o fim, exclusivo) */
const carrySlots = (prev: SpecialHours) => {
  const endMin = toMin(prev.end_time);
  return endMin <= 0 ? [] : generateSlotTimes("00:00", fromMin(endMin - 30));
};

/**
 * Horário especial efetivo de uma data:
 * - replace: slots que substituem o horário semanal (null = usa o semanal)
 * - extra: slots da madrugada vindos de um horário overnight do dia anterior (somam aos demais)
 */
export const getSpecialSlotsForDate = async (
  dateStr: string
): Promise<{ replace: string[] | null; extra: string[] }> => {
  const prevStr = format(subDays(parseISO(dateStr), 1), "yyyy-MM-dd");
  const { data, error } = await table().select("*").in("special_date", [dateStr, prevStr]);
  if (error || !data) return { replace: null, extra: [] };
  const rows = data as SpecialHours[];
  const own = rows.find((r) => r.special_date === dateStr);
  const prev = rows.find((r) => r.special_date === prevStr);
  return {
    replace: own ? ownDaySlots(own) : null,
    extra: prev && isOvernight(prev) ? carrySlots(prev) : [],
  };
};

/** Combina slots semanais com o horário especial (mantém o formato de objeto do time_slots) */
export const applySpecialSlots = <T extends { slot_time: string }>(
  weekly: T[] | null | undefined,
  special: { replace: string[] | null; extra: string[] },
  dateStr: string
): T[] => {
  const make = (t: string) => ({ id: `special-${dateStr}-${t}`, slot_time: t, is_blocked: false } as unknown as T);
  const base: T[] = special.replace ? special.replace.map(make) : [...(weekly || [])];
  const existing = new Set(base.map((s) => s.slot_time.slice(0, 8)));
  for (const t of special.extra) if (!existing.has(t)) base.push(make(t));
  return base.sort((a, b) => a.slot_time.localeCompare(b.slot_time));
};

/** Datas futuras liberadas por horário especial (inclui a madrugada seguinte dos overnight) */
export const fetchUpcomingSpecialDates = async (fromDate: string): Promise<string[]> => {
  const prevStr = format(subDays(parseISO(fromDate), 1), "yyyy-MM-dd");
  const { data, error } = await table().select("special_date, start_time, end_time").gte("special_date", prevStr);
  if (error || !data) return [];
  const out = new Set<string>();
  for (const r of data as SpecialHours[]) {
    out.add(r.special_date);
    if (isOvernight(r) && toMin(r.end_time) > 0) out.add(format(addDays(parseISO(r.special_date), 1), "yyyy-MM-dd"));
  }
  return Array.from(out).filter((d) => d >= fromDate);
};

export const listSpecialHours = async (fromDate: string): Promise<SpecialHours[]> => {
  const { data, error } = await table().select("*").gte("special_date", fromDate).order("special_date");
  if (error) throw error;
  return (data as SpecialHours[]) || [];
};

export const upsertSpecialHours = async (row: { special_date: string; start_time: string; end_time: string; note?: string | null }) => {
  const { error } = await table().upsert(row, { onConflict: "special_date" });
  if (error) throw error;
};

export const deleteSpecialHours = async (id: string) => {
  const { error } = await table().delete().eq("id", id);
  if (error) throw error;
};
