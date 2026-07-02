import { supabase } from "@/lib/supabase";
import type { VehicleIssueKeywordRule } from "@/utils/vehicleIssueKeywords";

const aiKeywordStorageKey = "carfact-admin-ai-keyword-rules";

interface AiKeywordRuleRow {
  id: string;
  label: string;
  include_keywords: string[];
  exclude_keywords: string[];
  category: string;
  fuel_type: string;
  target_model: string;
  is_default_maintenance: boolean;
  is_visible: boolean;
  memo: string;
}

export const toVehicleIssueKeywordRule = (
  row: AiKeywordRuleRow,
): VehicleIssueKeywordRule => ({
  id: row.id,
  label: row.label,
  includeKeywords: row.include_keywords ?? [],
  excludeKeywords: row.exclude_keywords ?? [],
  category: row.category ?? "",
  fuelType: row.fuel_type ?? "",
  targetModel: row.target_model ?? "",
  isDefaultMaintenance: row.is_default_maintenance ?? false,
  isVisible: row.is_visible ?? true,
  memo: row.memo ?? "",
});

const readStoredAiKeywordRules = (): VehicleIssueKeywordRule[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(aiKeywordStorageKey);

    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue) as unknown;

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter(
        (rule): rule is VehicleIssueKeywordRule =>
          Boolean(
            rule &&
              typeof rule === "object" &&
              "label" in rule &&
              typeof rule.label === "string" &&
              "includeKeywords" in rule &&
              Array.isArray(rule.includeKeywords),
          ),
      )
      .filter((rule) => rule.isVisible !== false);
  } catch {
    return [];
  }
};

export const fetchPublicAiKeywordRules = async () => {
  if (!supabase) {
    return readStoredAiKeywordRules();
  }

  const { data, error } = await supabase.rpc("public_list_ai_keyword_rules");

  if (error) {
    if (
      error.message.includes("public_list_ai_keyword_rules") ||
      error.message.includes("admin_ai_keyword_rules")
    ) {
      return readStoredAiKeywordRules();
    }

    throw error;
  }

  return (data ?? []).map(toVehicleIssueKeywordRule);
};
