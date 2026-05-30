"use client";

import { useMemo, useState } from "react";
import {
  useVehicleMasterOptions,
  type VehicleMasterOption,
} from "@/hooks/useVehicleMaster";
import { cn } from "@/utils/cn";

const formControlClassName = cn(
  "w-full rounded-xl border border-transparent bg-zinc-800 p-3 text-white outline-none transition",
  "focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-60"
);
const searchResultButtonClassName = cn(
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-left transition",
  "hover:border-zinc-600 hover:bg-zinc-800/90 active:scale-[0.99]"
);
const helperTextClassName = cn("px-1 text-xs text-zinc-500");

const currentYear = new Date().getFullYear();
const fallbackStartYear = 2008;

const toFullYear = (year: string) => {
  const numericYear = Number(year);

  if (numericYear >= 1000) {
    return numericYear;
  }

  return numericYear <= 29 ? 2000 + numericYear : 1900 + numericYear;
};

const parseYearRange = (modelDetail: string) => {
  const yearBlocks = [...modelDetail.matchAll(/\(([^)]*(?:년|~)[^)]*)\)/g)]
    .map((match) => match[1]);
  const years = yearBlocks
    .flatMap((block) =>
      [...block.matchAll(/\d{2,4}/g)].map((match) => toFullYear(match[0]))
    )
    .filter((year) => year >= 1900 && year <= currentYear + 1);

  if (years.length === 0) {
    return { earliestYear: fallbackStartYear, latestYear: currentYear };
  }

  const hasOpenEnd = yearBlocks.some(
    (block) => /년\s*~/.test(block) || /\d{2,4}\s*~\s*$/.test(block)
  );

  return {
    earliestYear: Math.min(...years),
    latestYear: hasOpenEnd ? currentYear : Math.min(Math.max(...years), currentYear),
  };
};

const buildYears = (modelDetail: string) => {
  if (!modelDetail) {
    return [];
  }

  const { earliestYear, latestYear } = parseYearRange(modelDetail);

  if (earliestYear > latestYear) {
    return [];
  }

  return Array.from(
    { length: latestYear - earliestYear + 1 },
    (_, index) => String(latestYear - index)
  );
};

const mergeSelectedOption = <T extends string>(
  options: T[],
  selectedValue: T
) => {
  if (!selectedValue || options.includes(selectedValue)) {
    return options;
  }

  return [selectedValue, ...options];
};

const getSearchResultTitle = (result: VehicleMasterOption) => {
  const detail = result.model_detail.replace(/^\[[^\]]+\]/, "").trim();
  return detail || result.model_detail;
};

interface VehicleMasterFieldsProps {
  brandValue: string;
  modelValue: string;
  modelDetailValue: string;
  yearValue: string;
  fuelTypeValue: string;
  mileageValue: string;
  fuelTypes: string[];
  onBrandChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onModelDetailChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onFuelTypeChange: (value: string) => void;
  onMileageChange: (value: string) => void;
  onClearValidation: () => void;
}

export function VehicleMasterFields({
  brandValue,
  modelValue,
  modelDetailValue,
  yearValue,
  fuelTypeValue,
  mileageValue,
  fuelTypes,
  onBrandChange,
  onModelChange,
  onModelDetailChange,
  onYearChange,
  onFuelTypeChange,
  onMileageChange,
  onClearValidation,
}: VehicleMasterFieldsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const {
    manufacturers,
    models,
    modelDetails,
    searchResults,
    isLoadingManufacturers,
    isLoadingModels,
    isLoadingModelDetails,
    isSearching,
    errorMessage,
  } = useVehicleMasterOptions({
    manufacturer: brandValue,
    model: modelValue,
    searchQuery,
  });

  const years = useMemo(() => buildYears(modelDetailValue), [modelDetailValue]);
  const manufacturerOptions = mergeSelectedOption(manufacturers, brandValue);
  const modelOptions = mergeSelectedOption(models, modelValue);
  const modelDetailOptions = useMemo(() => {
    if (
      !modelDetailValue ||
      modelDetails.some((item) => item.model_detail === modelDetailValue)
    ) {
      return modelDetails;
    }

    return [
      {
        id: modelDetailValue,
        manufacturer: brandValue,
        model: modelValue,
        model_detail: modelDetailValue,
        aliases: [],
        search_text: modelDetailValue,
        search_text_normalized: modelDetailValue,
        sort_order: null,
        active_car_count: null,
      },
      ...modelDetails,
    ];
  }, [brandValue, modelDetails, modelDetailValue, modelValue]);
  const yearOptions = mergeSelectedOption(years, yearValue);

  const selectSearchResult = (result: VehicleMasterOption) => {
    onBrandChange(result.manufacturer);
    onModelChange(result.model);
    onModelDetailChange(result.model_detail);
    onYearChange("");
    onClearValidation();
    setSearchQuery("");
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="차량명 검색 (예: 포터, 봉고III, K9)"
          className={formControlClassName}
          aria-label="차량명 검색"
        />

        {searchQuery && (
          <div className="space-y-2">
            {isSearching && (
              <p className={helperTextClassName}>차량 마스터 검색 중입니다.</p>
            )}

            {!isSearching &&
              searchQuery.trim().length >= 2 &&
              searchResults.length === 0 && (
                <p className={helperTextClassName}>검색 결과가 없습니다.</p>
              )}

            {searchResults.slice(0, 8).map((result) => (
              <button
                type="button"
                key={result.id}
                onClick={() => selectSearchResult(result)}
                className={searchResultButtonClassName}
              >
                <span className="block text-sm font-semibold text-white">
                  {getSearchResultTitle(result)}
                </span>
                <span className="mt-1 block text-xs text-zinc-500">
                  {result.manufacturer} · {result.model}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <select
        value={brandValue}
        onChange={(event) => {
          onBrandChange(event.target.value);
          onModelChange("");
          onModelDetailChange("");
          onYearChange("");
          onClearValidation();
        }}
        disabled={isLoadingManufacturers}
        className={formControlClassName}
      >
        <option value="">
          {isLoadingManufacturers ? "제조사 불러오는 중" : "제조사 선택"}
        </option>
        {manufacturerOptions.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <select
        value={modelValue}
        onChange={(event) => {
          onModelChange(event.target.value);
          onModelDetailChange("");
          onYearChange("");
          onClearValidation();
        }}
        disabled={!brandValue || isLoadingModels}
        className={formControlClassName}
      >
        <option value="">
          {isLoadingModels ? "모델 불러오는 중" : "모델 선택"}
        </option>
        {modelOptions.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <select
        value={modelDetailValue}
        onChange={(event) => {
          onModelDetailChange(event.target.value);
          onYearChange("");
          onClearValidation();
        }}
        disabled={!brandValue || !modelValue || isLoadingModelDetails}
        className={formControlClassName}
      >
        <option value="">
          {isLoadingModelDetails ? "세부모델 불러오는 중" : "세부모델 선택"}
        </option>
        {modelDetailOptions.map((item) => (
          <option key={item.id} value={item.model_detail}>
            {item.model_detail}
          </option>
        ))}
      </select>

      <select
        value={yearValue}
        onChange={(event) => {
          onYearChange(event.target.value);
          onClearValidation();
        }}
        disabled={!modelDetailValue}
        className={formControlClassName}
      >
        <option value="">연식 선택</option>
        {yearOptions.map((item) => (
          <option key={item} value={item}>
            {item}년
          </option>
        ))}
      </select>

      <select
        value={fuelTypeValue}
        onChange={(event) => onFuelTypeChange(event.target.value)}
        className={formControlClassName}
      >
        <option value="">연료 선택</option>
        {fuelTypes.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <input
        value={mileageValue}
        onChange={(event) => onMileageChange(event.target.value)}
        placeholder="주행거리 입력 (예: 120000)"
        inputMode="numeric"
        className={formControlClassName}
      />

      {errorMessage && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
