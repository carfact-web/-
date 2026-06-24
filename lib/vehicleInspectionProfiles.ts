import { supabase } from "@/lib/supabase";
import type { VehicleInspectionProfile } from "@/data/vehicleInspectionData";

interface VehicleInspectionProfileRow {
  id: string;
  generations: unknown;
  manufacturer: string;
  model: string;
  summary: string;
}

interface VehicleInspectionItemRow {
  ai_summary: string;
  estimated_repair_cost: string;
  importance: "상" | "중" | "하";
  related_parts: unknown;
  symptoms: unknown;
  title: string;
}

interface VehicleInspectionYearNoteRow {
  label: string;
  max_year: number;
  min_year: number;
  summary: string;
}

interface VehicleInspectionEngineNoteRow {
  engine: string;
  summary: string;
}

const normalizeMatchText = (value: string) =>
  value.replace(/\s+/g, "").trim().toLowerCase();

const matchesLooseText = (target: string, candidates: string[]) => {
  const normalizedTarget = normalizeMatchText(target);

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeMatchText(candidate);

    return (
      normalizedTarget === normalizedCandidate ||
      normalizedTarget.includes(normalizedCandidate) ||
      normalizedCandidate.includes(normalizedTarget)
    );
  });
};

export const fetchVehicleInspectionProfile = async (
  brand: string,
  model: string,
  generation?: string,
) => {
  if (!supabase || !brand.trim() || !model.trim()) {
    return null;
  }

  // The generated Supabase type file is missing these newer inspection tables.
  // Keep this narrow cast local until the generated types are refreshed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data: profiles, error: profileError } = await client
    .from("vehicle_inspection_profiles")
    .select("*")
    .eq("manufacturer", brand)
    .eq("model", model);

  if (profileError) {
    throw profileError;
  }

  const profile = ((profiles ?? []) as VehicleInspectionProfileRow[]).find((item) => {
    const generations = Array.isArray(item.generations)
      ? (item.generations as string[])
      : [];

    return !generation || generations.length === 0
      ? true
      : matchesLooseText(generation, generations);
  });

  if (!profile) {
    return null;
  }

  const [{ data: items, error: itemError }, { data: yearNotes, error: yearError }, { data: engineNotes, error: engineError }] =
    await Promise.all([
      client
        .from("vehicle_inspection_items")
        .select("*")
        .eq("profile_id", profile.id)
        .order("display_order", { ascending: true }),
      client
        .from("vehicle_inspection_year_notes")
        .select("*")
        .eq("profile_id", profile.id)
        .order("display_order", { ascending: true }),
      client
        .from("vehicle_inspection_engine_notes")
        .select("*")
        .eq("profile_id", profile.id)
        .order("display_order", { ascending: true }),
    ]);

  if (itemError) throw itemError;
  if (yearError) throw yearError;
  if (engineError) throw engineError;

  return {
    brand: profile.manufacturer,
    model: profile.model,
    generations: Array.isArray(profile.generations)
      ? (profile.generations as string[])
      : [],
    summary: profile.summary,
    checkItems: ((items ?? []) as VehicleInspectionItemRow[]).map((item) => ({
      title: item.title,
      symptoms: Array.isArray(item.symptoms) ? (item.symptoms as string[]) : [],
      relatedParts: Array.isArray(item.related_parts)
        ? (item.related_parts as string[])
        : [],
      importance: item.importance,
      estimatedRepairCost: item.estimated_repair_cost,
      aiSummary: item.ai_summary,
    })),
    yearNotes: ((yearNotes ?? []) as VehicleInspectionYearNoteRow[]).map((note) => ({
      minYear: note.min_year,
      maxYear: note.max_year,
      label: note.label,
      summary: note.summary,
    })),
    engineNotes: ((engineNotes ?? []) as VehicleInspectionEngineNoteRow[]).map((note) => ({
      engine: note.engine,
      summary: note.summary,
    })),
  } satisfies VehicleInspectionProfile;
};
