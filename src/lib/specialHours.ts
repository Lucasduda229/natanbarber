import { supabase } from "@/integrations/supabase/client";

export interface SpecialHours {
  id: string;
  special_date: string; // yyyy-MM-dd
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  note: string | null;
}

// Tabela nova; cast para não depender dos types gerados
const table = () => (supabase as any).from("special_hours");

/** Gera slots de 30 em 30 min entre início e fim (inclusive), no formato HH:mm:00 */
export const generateSlotTimes = (start: string, end: string): string[] => {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const out: string[] = [];
  for (let m = toMin(start); m <= toMin(end); m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`);
  }
  return out;
};

/** Horário especial de uma data (ou null se usa o horário semanal) */
export const fetchSpecialHoursForDate = async (dateStr: string): Promise<SpecialHours | null> => {
  const { data, error } = await table().select("*").eq("special_date", dateStr).maybeSingle();
  if (error) return null;
  return (data as SpecialHours) || null;
};

/** Datas futuras com horário especial */
export const fetchUpcomingSpecialDates = async (fromDate: string): Promise<string[]> => {
  const { data, error } = await table().select("special_date").gte("special_date", fromDate);
  if (error || !data) return [];
  return (data as { special_date: string }[]).map((d) => d.special_date);
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

