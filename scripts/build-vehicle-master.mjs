import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const BASE_URL = "https://www.carmanager.co.kr/Scripts/Common";
const OUTPUT_DIR = "supabase/vehicle_master";
const OUTPUT_STATS = "supabase/vehicle_master.stats.json";
const MIN_MARKET_YEAR = 2008;

const SOURCES = [
  ["CarBaseMaker", `${BASE_URL}/CarBaseMaker.js`],
  ["CarBaseModel", `${BASE_URL}/CarBaseModel.js`],
  ["CarBaseModelDetail", `${BASE_URL}/CarBaseModelDetail.js`],
];

const INSERT_COLUMNS = [
  "source",
  "source_maker_no",
  "source_model_no",
  "source_model_detail_no",
  "manufacturer",
  "model",
  "model_detail",
  "aliases",
  "search_text",
  "search_text_normalized",
  "country",
  "maker_code",
  "model_code",
  "model_detail_code",
  "kind_code",
  "kind_sub_code",
  "sort_order",
  "active_car_count",
  "source_created_at_text",
];

const REQUIRED_IMPORT_MAKERS = [
  "BMW",
  "벤츠",
  "아우디",
  "폭스바겐",
  "볼보",
  "렉서스",
  "토요타",
  "포르쉐",
  "랜드로버",
  "미니",
  "지프",
  "테슬라",
];

const ORPHAN_MODEL_FIXES = {
  // Present in CarBaseModelDetail, missing from CarBaseModel.
  // These are legacy Daewoo commercial vehicle rows.
  100317: {
    MakerNo: 10057,
    ModelNo: 100317,
    ModelName: "야무진",
    KindCode: "D",
    ModelCode: "ORPHAN_FIX_100317",
    ModelSortNo: null,
  },
  100389: {
    MakerNo: 10057,
    ModelNo: 100389,
    ModelName: "라보",
    KindCode: "D",
    ModelCode: "ORPHAN_FIX_100389",
    ModelSortNo: null,
  },
};

const sqlString = (value) =>
  value === null || value === undefined
    ? "null"
    : `'${String(value).replaceAll("'", "''")}'`;

const sqlNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return "null";
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? String(numberValue) : "null";
};

const normalizeLoose = (value) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, "");

const cleanYears = (value) =>
  value
    .replace(/\([^)]*년[^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

const cleanParentheticals = (value) =>
  value
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const addAlias = (aliases, value) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return;
  }

  aliases.add(text);

  const compact = normalizeLoose(text);
  if (compact && compact !== text) {
    aliases.add(compact);
  }
};

const addAliases = (aliases, values) => {
  for (const value of values) {
    addAlias(aliases, value);
  }
};

const extractCommercialVehicleName = (modelDetail) => {
  const detailName = cleanParentheticals(cleanYears(modelDetail))
    .replace(/^\[[^\]]+\]\s*/, "")
    .trim();

  if (!/[봉포][고터]/.test(detailName)) {
    return null;
  }

  return detailName;
};

const buildCommercialVehicleAliases = (modelDetail) => {
  const vehicleName = extractCommercialVehicleName(modelDetail);
  if (!vehicleName) {
    return [];
  }

  const aliases = new Set();
  const add = (value) => addAlias(aliases, value);
  const normalized = normalizeLoose(vehicleName);

  add(vehicleName);

  if (normalized.includes("포터")) {
    add("포터");
    add("현대 포터");

    if (/포터\s*(2|II|Ⅱ)/i.test(vehicleName) || normalized.includes("포터2")) {
      addAliases(aliases, [
        "포터2",
        "포터II",
        "포터Ⅱ",
        "현대 포터2",
        "현대 포터II",
        "현대 포터Ⅱ",
      ]);
    }
  }

  if (normalized.includes("봉고")) {
    add("봉고");
    add("기아 봉고");

    if (/봉고\s*(3|III|Ⅲ)/i.test(vehicleName) || normalized.includes("봉고3")) {
      addAliases(aliases, [
        "봉고3",
        "봉고III",
        "봉고Ⅲ",
        "기아 봉고3",
        "기아 봉고III",
        "기아 봉고Ⅲ",
      ]);

      if (normalized.includes("더뉴봉고3")) {
        addAliases(aliases, ["더 뉴 봉고3", "기아 더 뉴 봉고3"]);
      }
    }
  }

  return [...aliases];
};

const buildAliases = ({ manufacturer, model, modelDetail }) => {
  const aliases = new Set();
  const detailWithoutYears = cleanYears(modelDetail);
  const detailWithoutParens = modelDetail.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  const commercialVehicleAliases = buildCommercialVehicleAliases(modelDetail);

  addAlias(aliases, manufacturer);
  addAlias(aliases, model);
  addAlias(aliases, modelDetail);
  addAliases(aliases, commercialVehicleAliases);
  addAlias(aliases, detailWithoutYears);
  addAlias(aliases, detailWithoutParens);
  addAlias(aliases, `${manufacturer} ${model}`);
  addAlias(aliases, `${model} ${modelDetail}`);
  addAlias(aliases, `${manufacturer} ${model} ${modelDetail}`);

  for (const match of modelDetail.matchAll(/\(([A-Z0-9][A-Z0-9._ -]{1,12})\)/g)) {
    const code = match[1].replace(/\s+/g, "");
    if (/\d{2}년|년~|~/.test(code)) {
      continue;
    }

    addAlias(aliases, code);
    addAlias(aliases, `${model}${code}`);
    addAlias(aliases, `${model} ${code}`);
  }

  return {
    aliases: [...aliases].sort((a, b) => a.localeCompare(b, "ko")),
    prioritySearchAliases: commercialVehicleAliases,
  };
};

const toFullYear = (year) => {
  const numericYear = Number(year);
  if (numericYear >= 1000) {
    return numericYear;
  }

  return numericYear <= 29 ? 2000 + numericYear : 1900 + numericYear;
};

const parseYearRange = (modelDetail) => {
  const yearBlocks = [...modelDetail.matchAll(/\(([^)]*(?:년|~)[^)]*)\)/g)].map((match) => match[1]);
  const years = yearBlocks
    .flatMap((block) => [...block.matchAll(/\d{2,4}/g)].map((match) => toFullYear(match[0])))
    .filter((year) => year >= 1900 && year <= 2099);

  if (years.length === 0) {
    return { earliestYear: null, latestYear: null };
  }

  const hasOpenEnd = yearBlocks.some((block) => /년\s*~/.test(block) || /\d{2,4}\s*~\s*$/.test(block));
  return {
    earliestYear: Math.min(...years),
    latestYear: hasOpenEnd ? null : Math.max(...years),
  };
};

const shouldKeepModelDetail = (modelDetail) => {
  const range = parseYearRange(modelDetail);
  if (range.latestYear === null) {
    return { keep: true, ...range };
  }

  return {
    keep: range.latestYear >= MIN_MARKET_YEAR,
    ...range,
  };
};

const sqlArray = (values) =>
  `array[${values.map(sqlString).join(", ")}]::text[]`;

const fetchSource = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
};

const rowToValuesSql = (row) => `  (
    ${sqlString(row.source)},
    ${sqlNumber(row.source_maker_no)},
    ${sqlNumber(row.source_model_no)},
    ${sqlNumber(row.source_model_detail_no)},
    ${sqlString(row.manufacturer)},
    ${sqlString(row.model)},
    ${sqlString(row.model_detail)},
    ${sqlArray(row.aliases)},
    ${sqlString(row.search_text)},
    ${sqlString(row.search_text_normalized)},
    ${sqlString(row.country)},
    ${sqlString(row.maker_code)},
    ${sqlString(row.model_code)},
    ${sqlString(row.model_detail_code)},
    ${sqlString(row.kind_code)},
    ${sqlString(row.kind_sub_code)},
    ${sqlNumber(row.sort_order)},
    ${sqlNumber(row.active_car_count)},
    ${sqlString(row.source_created_at_text)}
  )`;

const buildInsertSql = ({ partNumber, rows, generatedAt }) => `-- Generated by scripts/build-vehicle-master.mjs at ${generatedAt}
-- Source: Carmanager public CarBase*.js datasets.
-- Part ${partNumber}: insert ${rows.length} filtered vehicle_master rows.

insert into public.vehicle_master (
  ${INSERT_COLUMNS.join(",\n  ")}
) values
${rows.map(rowToValuesSql).join(",\n")};
`;

const buildCreateSql = (generatedAt) => `-- Generated by scripts/build-vehicle-master.mjs at ${generatedAt}
-- Run this file first in Supabase SQL Editor.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

do $$
declare
  backup_table text := 'vehicle_master_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
begin
  if to_regclass('public.vehicle_master') is not null then
    execute format('create table public.%I as table public.vehicle_master', backup_table);
  end if;
end $$;

drop table if exists public.vehicle_master;

create table public.vehicle_master (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'carmanager',
  source_maker_no integer,
  source_model_no integer,
  source_model_detail_no integer,
  manufacturer text not null,
  model text not null,
  model_detail text not null,
  aliases text[] not null default '{}'::text[],
  search_text text not null,
  search_text_normalized text not null,
  country text,
  maker_code text,
  model_code text,
  model_detail_code text,
  kind_code text,
  kind_sub_code text,
  sort_order integer,
  active_car_count integer,
  source_created_at_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_master_source_detail_unique unique (source, source_model_detail_no),
  constraint vehicle_master_name_unique unique (manufacturer, model, model_detail)
);
`;

const buildIndexesSql = (generatedAt) => `-- Generated by scripts/build-vehicle-master.mjs at ${generatedAt}
-- Run this file after all insert parts.

create index vehicle_master_manufacturer_idx
  on public.vehicle_master (manufacturer);

create index vehicle_master_model_idx
  on public.vehicle_master (model);

create index vehicle_master_model_detail_idx
  on public.vehicle_master (model_detail);

create index vehicle_master_aliases_gin_idx
  on public.vehicle_master using gin (aliases);

create index vehicle_master_search_text_trgm_idx
  on public.vehicle_master using gin (search_text gin_trgm_ops);

create index vehicle_master_search_text_normalized_trgm_idx
  on public.vehicle_master using gin (search_text_normalized gin_trgm_ops);

alter table public.vehicle_master enable row level security;

drop policy if exists "Public read vehicle master" on public.vehicle_master;
create policy "Public read vehicle master"
  on public.vehicle_master for select
  using (true);

-- Validation:
-- select count(*) as row_count,
--        count(distinct manufacturer) as manufacturer_count,
--        count(distinct manufacturer || '|' || model) as model_count,
--        count(distinct manufacturer || '|' || model || '|' || model_detail) as model_detail_count
-- from public.vehicle_master;
`;

const context = {};
for (const [, url] of SOURCES) {
  vm.runInNewContext(await fetchSource(url), context);
}

const makers = context.CarBaseMaker;
const sourceModels = Object.values(context.CarBaseModel).flat();
const models = [...sourceModels];
const detailsByModel = context.CarBaseModelDetail;

const makerMap = new Map(makers.map((maker) => [String(maker.MakerNo), maker]));
const modelMap = new Map(models.map((model) => [String(model.ModelNo), model]));

const orphanModelNos = Object.keys(detailsByModel).filter(
  (modelNo) => !modelMap.has(String(modelNo)),
);

for (const modelNo of orphanModelNos) {
  const fixedModel = ORPHAN_MODEL_FIXES[modelNo];
  if (fixedModel) {
    modelMap.set(String(modelNo), fixedModel);
    models.push(fixedModel);
  }
}

const rows = [];
const skipped = [];
const excludedBefore2008 = [];
const seenTriples = new Set();
let duplicateCount = 0;

for (const [modelNo, details] of Object.entries(detailsByModel)) {
  const model = modelMap.get(String(modelNo));
  if (!model) {
    skipped.push({ reason: "missing_model", modelNo, count: details.length });
    continue;
  }

  const maker = makerMap.get(String(model.MakerNo));
  if (!maker) {
    skipped.push({ reason: "missing_maker", modelNo, makerNo: model.MakerNo, count: details.length });
    continue;
  }

  for (const detail of details) {
    const manufacturer = String(maker.MakerName).trim();
    const modelName = String(model.ModelName).trim();
    const modelDetail = String(detail.MDetailName).trim();
    const yearDecision = shouldKeepModelDetail(modelDetail);

    if (!yearDecision.keep) {
      excludedBefore2008.push({
        manufacturer,
        model: modelName,
        model_detail: modelDetail,
        source_model_detail_no: detail.MDetailNo,
        latestYear: yearDecision.latestYear,
      });
      continue;
    }

    const dedupeKey = [manufacturer, modelName, modelDetail].map(normalizeLoose).join("|");

    if (seenTriples.has(dedupeKey)) {
      duplicateCount += 1;
      continue;
    }

    seenTriples.add(dedupeKey);

    const { aliases, prioritySearchAliases } = buildAliases({
      manufacturer,
      model: modelName,
      modelDetail,
    });
    const searchText = [
      ...prioritySearchAliases,
      manufacturer,
      modelName,
      modelDetail,
      maker.CountryName,
      ...aliases,
    ].join(" ");

    rows.push({
      source: "carmanager",
      source_maker_no: maker.MakerNo,
      source_model_no: model.ModelNo,
      source_model_detail_no: detail.MDetailNo,
      manufacturer,
      model: modelName,
      model_detail: modelDetail,
      aliases,
      search_text: searchText,
      search_text_normalized: normalizeLoose(searchText),
      country: maker.CountryName,
      maker_code: maker.MakerCode,
      model_code: model.ModelCode,
      model_detail_code: detail.MDetailCode,
      kind_code: model.KindCode,
      kind_sub_code: detail.KindSubCode,
      sort_order:
        detail.MDetailSortNo === null || detail.MDetailSortNo === undefined
          ? model.ModelSortNo
          : detail.MDetailSortNo,
      active_car_count: detail.CarCount,
      source_created_at_text: detail.CreateDate,
    });
  }
}

rows.sort((a, b) =>
  a.manufacturer.localeCompare(b.manufacturer, "ko") ||
  a.model.localeCompare(b.model, "ko") ||
  Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) ||
  a.model_detail.localeCompare(b.model_detail, "ko"),
);

const generatedAt = new Date().toISOString();
const chunkSize = Math.ceil(rows.length / 3);
const chunks = [
  rows.slice(0, chunkSize),
  rows.slice(chunkSize, chunkSize * 2),
  rows.slice(chunkSize * 2),
];

rmSync(OUTPUT_DIR, { recursive: true, force: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

const files = [
  ["1_create_vehicle_master.sql", buildCreateSql(generatedAt)],
  ["2_insert_vehicle_master_part1.sql", buildInsertSql({ partNumber: 1, rows: chunks[0], generatedAt })],
  ["3_insert_vehicle_master_part2.sql", buildInsertSql({ partNumber: 2, rows: chunks[1], generatedAt })],
  ["4_insert_vehicle_master_part3.sql", buildInsertSql({ partNumber: 3, rows: chunks[2], generatedAt })],
  ["5_create_vehicle_master_indexes.sql", buildIndexesSql(generatedAt)],
];

for (const [fileName, content] of files) {
  writeFileSync(join(OUTPUT_DIR, fileName), content);
}

const missingRequiredImportMakers = REQUIRED_IMPORT_MAKERS.filter(
  (requiredMaker) => !rows.some((row) => row.manufacturer === requiredMaker),
);

const fileSizes = Object.fromEntries(
  files.map(([fileName, content]) => [fileName, Buffer.byteLength(content)]),
);

const stats = {
  generatedAt,
  minMarketYear: MIN_MARKET_YEAR,
  source: {
    makers: makers.length,
    models: sourceModels.length,
    modelDetails: Object.values(detailsByModel).flat().length,
  },
  output: {
    manufacturers: new Set(rows.map((row) => row.manufacturer)).size,
    models: new Set(rows.map((row) => `${row.manufacturer}|${row.model}`)).size,
    modelDetails: rows.length,
    duplicatesRemoved: duplicateCount,
    excludedBefore2008: excludedBefore2008.length,
    excludedBefore2008Models: new Set(
      excludedBefore2008.map((row) => `${row.manufacturer}|${row.model}`),
    ).size,
    skipped,
    orphanModelNos,
    orphanModelFixesApplied: orphanModelNos.filter((modelNo) => ORPHAN_MODEL_FIXES[modelNo]).length,
    missingRequiredImportMakers,
  },
  fileSizes,
  sampleSearchAliases: {
    "그랜저": rows
      .filter((row) => row.model === "그랜저")
      .slice(0, 5)
      .map((row) => ({
        manufacturer: row.manufacturer,
        model: row.model,
        model_detail: row.model_detail,
        aliases: row.aliases.filter((alias) => /그랜저|GN7|더뉴/.test(alias)).slice(0, 12),
      })),
  },
};

writeFileSync(OUTPUT_STATS, `${JSON.stringify(stats, null, 2)}\n`);
console.log(JSON.stringify(stats, null, 2));
