import { writeFileSync } from "node:fs";
import vm from "node:vm";

const BASE_URL = "https://www.carmanager.co.kr/Scripts/Common";
const OUTPUT_SQL = "supabase/vehicle_master.sql";
const OUTPUT_STATS = "supabase/vehicle_master.stats.json";

const SOURCES = [
  ["CarBaseMaker", `${BASE_URL}/CarBaseMaker.js`],
  ["CarBaseModel", `${BASE_URL}/CarBaseModel.js`],
  ["CarBaseModelDetail", `${BASE_URL}/CarBaseModelDetail.js`],
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

const buildAliases = ({ manufacturer, model, modelDetail }) => {
  const aliases = new Set();
  const detailWithoutYears = cleanYears(modelDetail);
  const detailWithoutParens = modelDetail.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();

  addAlias(aliases, manufacturer);
  addAlias(aliases, model);
  addAlias(aliases, modelDetail);
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

  return [...aliases].sort((a, b) => a.localeCompare(b, "ko"));
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

const context = {};
for (const [, url] of SOURCES) {
  vm.runInNewContext(await fetchSource(url), context);
}

const makers = context.CarBaseMaker;
const models = Object.values(context.CarBaseModel).flat();
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
    const dedupeKey = [manufacturer, modelName, modelDetail].map(normalizeLoose).join("|");

    if (seenTriples.has(dedupeKey)) {
      duplicateCount += 1;
      continue;
    }

    seenTriples.add(dedupeKey);

    const aliases = buildAliases({ manufacturer, model: modelName, modelDetail });
    const searchText = [
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

const valuesSql = rows
  .map(
    (row) => `  (
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
  )`,
  )
  .join(",\n");

const generatedAt = new Date().toISOString();
const sql = `-- Generated by scripts/build-vehicle-master.mjs at ${generatedAt}
-- Source: Carmanager public CarBase*.js datasets.

begin;

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

insert into public.vehicle_master (
  source,
  source_maker_no,
  source_model_no,
  source_model_detail_no,
  manufacturer,
  model,
  model_detail,
  aliases,
  search_text,
  search_text_normalized,
  country,
  maker_code,
  model_code,
  model_detail_code,
  kind_code,
  kind_sub_code,
  sort_order,
  active_car_count,
  source_created_at_text
) values
${valuesSql};

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

commit;

-- Validation queries:
-- select count(distinct manufacturer) as manufacturers from public.vehicle_master;
-- select count(distinct manufacturer || '|' || model) as models from public.vehicle_master;
-- select count(*) as model_details from public.vehicle_master;
-- select * from public.vehicle_master where search_text_normalized ilike '%그랜저gn7%';
-- select * from public.vehicle_master where search_text_normalized ilike '%더뉴그랜저%';
`;

const stats = {
  generatedAt,
  source: {
    makers: makers.length,
    models: Object.values(context.CarBaseModel).flat().length,
    modelDetails: Object.values(detailsByModel).flat().length,
  },
  output: {
    manufacturers: new Set(rows.map((row) => row.manufacturer)).size,
    models: new Set(rows.map((row) => `${row.manufacturer}|${row.model}`)).size,
    modelDetails: rows.length,
    duplicatesRemoved: duplicateCount,
    skipped,
    orphanModelNos,
    orphanModelFixesApplied: orphanModelNos.filter((modelNo) => ORPHAN_MODEL_FIXES[modelNo]).length,
  },
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

writeFileSync(OUTPUT_SQL, sql);
writeFileSync(OUTPUT_STATS, `${JSON.stringify(stats, null, 2)}\n`);

console.log(JSON.stringify(stats, null, 2));
