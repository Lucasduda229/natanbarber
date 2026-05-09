import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ExtraFeeConfig {
  enabled: boolean;
  name: string;
  amount: number;
}

const DEFAULT: ExtraFeeConfig = {
  enabled: false,
  name: "Taxa adicional",
  amount: 0,
};

const KEYS = ["extra_fee_enabled", "extra_fee_name", "extra_fee_amount"];

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
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return { config, loading, reload: load };
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
