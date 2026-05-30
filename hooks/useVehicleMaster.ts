"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

type VehicleMasterRow = Database["public"]["Tables"]["vehicle_master"]["Row"];

export type VehicleMasterOption = Pick<
  VehicleMasterRow,
  | "id"
  | "manufacturer"
  | "model"
  | "model_detail"
  | "aliases"
  | "search_text"
  | "search_text_normalized"
  | "sort_order"
  | "active_car_count"
>;

const VEHICLE_MASTER_LIMIT = 3000;
const SEARCH_LIMIT = 30;

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, "");

const uniqueSorted = (values: Array<string | null>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b, "ko"));

const getSearchRank = (row: VehicleMasterOption, normalizedQuery: string) => {
  const detail = normalizeSearchText(row.model_detail);
  const model = normalizeSearchText(row.model);
  const manufacturer = normalizeSearchText(row.manufacturer);
  const aliases = row.aliases.map(normalizeSearchText);

  if (detail === normalizedQuery) {
    return 0;
  }

  if (aliases.includes(normalizedQuery)) {
    return 1;
  }

  if (detail.startsWith(normalizedQuery)) {
    return 2;
  }

  if (model === normalizedQuery) {
    return 3;
  }

  if (detail.includes(normalizedQuery)) {
    return 4;
  }

  if (model.includes(normalizedQuery) || manufacturer.includes(normalizedQuery)) {
    return 5;
  }

  return 6;
};

const sortSearchResults = (
  rows: VehicleMasterOption[],
  normalizedQuery: string
) =>
  [...rows].sort((a, b) => {
    const rankDiff =
      getSearchRank(a, normalizedQuery) - getSearchRank(b, normalizedQuery);

    if (rankDiff !== 0) {
      return rankDiff;
    }

    return (
      Number(b.active_car_count ?? 0) - Number(a.active_car_count ?? 0) ||
      a.manufacturer.localeCompare(b.manufacturer, "ko") ||
      a.model.localeCompare(b.model, "ko") ||
      a.model_detail.localeCompare(b.model_detail, "ko")
    );
  });

interface UseVehicleMasterOptionsArgs {
  manufacturer: string;
  model: string;
  searchQuery: string;
}

export const useVehicleMasterOptions = ({
  manufacturer,
  model,
  searchQuery,
}: UseVehicleMasterOptionsArgs) => {
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [modelDetails, setModelDetails] = useState<VehicleMasterOption[]>([]);
  const [searchResults, setSearchResults] = useState<VehicleMasterOption[]>([]);
  const [isLoadingManufacturers, setIsLoadingManufacturers] = useState(true);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingModelDetails, setIsLoadingModelDetails] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const normalizedSearchQuery = useMemo(
    () => normalizeSearchText(searchQuery),
    [searchQuery]
  );

  useEffect(() => {
    let isActive = true;

    const loadManufacturers = async () => {
      setIsLoadingManufacturers(true);

      if (!supabase) {
        setErrorMessage("차량 마스터 DB 설정을 확인해주세요.");
        setIsLoadingManufacturers(false);
        return;
      }

      const { data, error } = await supabase
        .from("vehicle_master")
        .select("manufacturer")
        .order("manufacturer", { ascending: true })
        .limit(VEHICLE_MASTER_LIMIT);

      if (!isActive) {
        return;
      }

      if (error) {
        setErrorMessage("제조사 목록을 불러오지 못했습니다.");
        setManufacturers([]);
      } else {
        setManufacturers(uniqueSorted(data.map((row) => row.manufacturer)));
      }

      setIsLoadingManufacturers(false);
    };

    void loadManufacturers();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadModels = async () => {
      setModels([]);

      if (!manufacturer || !supabase) {
        return;
      }

      setIsLoadingModels(true);

      const { data, error } = await supabase
        .from("vehicle_master")
        .select("model")
        .eq("manufacturer", manufacturer)
        .order("model", { ascending: true })
        .limit(VEHICLE_MASTER_LIMIT);

      if (!isActive) {
        return;
      }

      if (error) {
        setErrorMessage("모델 목록을 불러오지 못했습니다.");
        setModels([]);
      } else {
        setModels(uniqueSorted(data.map((row) => row.model)));
      }

      setIsLoadingModels(false);
    };

    void loadModels();

    return () => {
      isActive = false;
    };
  }, [manufacturer]);

  useEffect(() => {
    let isActive = true;

    const loadModelDetails = async () => {
      setModelDetails([]);

      if (!manufacturer || !model || !supabase) {
        return;
      }

      setIsLoadingModelDetails(true);

      const { data, error } = await supabase
        .from("vehicle_master")
        .select(
          "id, manufacturer, model, model_detail, aliases, search_text, search_text_normalized, sort_order, active_car_count"
        )
        .eq("manufacturer", manufacturer)
        .eq("model", model)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("model_detail", { ascending: true })
        .limit(VEHICLE_MASTER_LIMIT);

      if (!isActive) {
        return;
      }

      if (error) {
        setErrorMessage("세부모델 목록을 불러오지 못했습니다.");
        setModelDetails([]);
      } else {
        setModelDetails(data);
      }

      setIsLoadingModelDetails(false);
    };

    void loadModelDetails();

    return () => {
      isActive = false;
    };
  }, [manufacturer, model]);

  useEffect(() => {
    let isActive = true;

    if (normalizedSearchQuery.length < 2 || !supabase) {
      return;
    }

    const client = supabase;
    const timeoutId = window.setTimeout(() => {
      const searchVehicles = async () => {
        setIsSearching(true);

        const { data, error } = await client
          .from("vehicle_master")
          .select(
            "id, manufacturer, model, model_detail, aliases, search_text, search_text_normalized, sort_order, active_car_count"
          )
          .ilike("search_text_normalized", `%${normalizedSearchQuery}%`)
          .order("active_car_count", { ascending: false, nullsFirst: false })
          .limit(SEARCH_LIMIT);

        if (!isActive) {
          return;
        }

        if (error) {
          setErrorMessage("차량 검색 결과를 불러오지 못했습니다.");
          setSearchResults([]);
        } else {
          setSearchResults(sortSearchResults(data, normalizedSearchQuery));
        }

        setIsSearching(false);
      };

      void searchVehicles();
    }, 180);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [normalizedSearchQuery]);

  return {
    manufacturers,
    models,
    modelDetails,
    searchResults: normalizedSearchQuery.length < 2 ? [] : searchResults,
    isLoadingManufacturers,
    isLoadingModels,
    isLoadingModelDetails,
    isSearching: normalizedSearchQuery.length >= 2 && isSearching,
    errorMessage,
  };
};
