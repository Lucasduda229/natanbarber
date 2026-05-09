import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ExtraFeeConfig {
  enabled: boolean;
  name: string;
  amount: number;
  days: number[]; // 0=Domingo, 6=Sábado
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const DEFAULT: ExtraFeeConfig = {
  enabled: false,
  name: "Taxa adicional",
  amount: 0,
  days: ALL_DAYS,
};

const KEYS = ["extra_fee_enabled", "extra_fee_name", "extra_fee_amount", "extra_fee_days"];

const parseDays = (raw: string | undefined | null): number[] => {
  if (!raw) return ALL_DAYS;
  const parts = raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return parts.length ? Array.from(new Set(parts)).sort() : ALL_DAYS;
};

export const useExtraFee = () => {
  const [config, setConfig] = useState<ExtraFeeConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("admin_settings")
      .select("setting_key, setting_value")
      .in("setting_key", KEYS);

    const map = new Map((data ?? []).map((r) => [r.setting_key, r.setting_value]));
    setConfig({
      enabled: (map.get("extra_fee_enabled") ?? "false") === "true",
      name: map.get("extra_fee_name") || DEFAULT.name,
      amount: parseFloat(map.get("extra_fee_amount") || "0") || 0,
      days: parseDays(map.get("extra_fee_days")),
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return { config, loading, reload: load };
};

// Check whether the extra fee applies on a given date based on day-of-week filter.
// Accepts Date | string ('YYYY-MM-DD') | null/undefined.
export const isExtraFeeApplicable = (
  cfg: ExtraFeeConfig,
  date: Date | string | null | undefined,
): boolean => {
  if (!cfg.enabled || cfg.amount <= 0 || !date) return false;
  const days = cfg.days?.length ? cfg.days : ALL_DAYS;
  let dow: number;
  if (typeof date === "string") {
    const [y, m, d] = date.split("-").map(Number);
    if (!y || !m || !d) return false;
    dow = new Date(y, m - 1, d).getDay();
  } else {
    dow = date.getDay();
  }
  return days.includes(dow);
};

export const buildExtraFeeNote = (cfg: ExtraFeeConfig): string => {
  if (!cfg.enabled || cfg.amount <= 0) return "";
  return `Taxa adicional (${cfg.name}): +R$${cfg.amount.toFixed(2).replace(".", ",")}`;
};

// Regex to parse the fee value out of saved notes (admin financial reporting)
export const parseExtraFeeFromNotes = (notes: string | null): number => {
  if (!notes) return 0;
  const m = notes.match(/Taxa adicional \([^)]+\): \+R\$\s?(\d+(?:[.,]\d{1,2})?)/i);
  if (!m) return 0;
  return parseFloat(m[1].replace(",", ".")) || 0;
};
