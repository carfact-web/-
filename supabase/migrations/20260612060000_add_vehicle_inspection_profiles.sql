create table if not exists public.vehicle_inspection_profiles (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  model text not null,
  generations text[] not null default '{}',
  summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_inspection_profiles_unique unique (manufacturer, model)
);

create table if not exists public.vehicle_inspection_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.vehicle_inspection_profiles(id) on delete cascade,
  title text not null,
  symptoms text[] not null default '{}',
  related_parts text[] not null default '{}',
  importance text not null check (importance in ('상', '중', '하')),
  estimated_repair_cost text not null,
  ai_summary text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_inspection_items_profile_title_unique unique (profile_id, title)
);

create table if not exists public.vehicle_inspection_year_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.vehicle_inspection_profiles(id) on delete cascade,
  min_year integer not null,
  max_year integer not null,
  label text not null,
  summary text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_inspection_year_notes_profile_label_unique unique (profile_id, label)
);

create table if not exists public.vehicle_inspection_engine_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.vehicle_inspection_profiles(id) on delete cascade,
  engine text not null,
  summary text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_inspection_engine_notes_profile_engine_unique unique (profile_id, engine)
);

create index if not exists vehicle_inspection_profiles_lookup_idx
  on public.vehicle_inspection_profiles (manufacturer, model);

create index if not exists vehicle_inspection_profiles_generations_gin_idx
  on public.vehicle_inspection_profiles using gin (generations);

create index if not exists vehicle_inspection_items_profile_order_idx
  on public.vehicle_inspection_items (profile_id, display_order);

create index if not exists vehicle_inspection_year_notes_profile_order_idx
  on public.vehicle_inspection_year_notes (profile_id, display_order);

create index if not exists vehicle_inspection_engine_notes_profile_order_idx
  on public.vehicle_inspection_engine_notes (profile_id, display_order);

alter table public.vehicle_inspection_profiles enable row level security;
alter table public.vehicle_inspection_items enable row level security;
alter table public.vehicle_inspection_year_notes enable row level security;
alter table public.vehicle_inspection_engine_notes enable row level security;

drop policy if exists "Public read vehicle inspection profiles"
  on public.vehicle_inspection_profiles;
create policy "Public read vehicle inspection profiles"
  on public.vehicle_inspection_profiles for select
  using (true);

drop policy if exists "Public read vehicle inspection items"
  on public.vehicle_inspection_items;
create policy "Public read vehicle inspection items"
  on public.vehicle_inspection_items for select
  using (true);

drop policy if exists "Public read vehicle inspection year notes"
  on public.vehicle_inspection_year_notes;
create policy "Public read vehicle inspection year notes"
  on public.vehicle_inspection_year_notes for select
  using (true);

drop policy if exists "Public read vehicle inspection engine notes"
  on public.vehicle_inspection_engine_notes;
create policy "Public read vehicle inspection engine notes"
  on public.vehicle_inspection_engine_notes for select
  using (true);

with upserted_profile as (
  insert into public.vehicle_inspection_profiles (
    manufacturer,
    model,
    generations,
    summary
  )
  values (
    '쉐보레',
    '말리부',
    array['올 뉴 말리부', '올뉴 말리부', '더 뉴 말리부', '더뉴 말리부'],
    '말리부는 냉각계통과 하체 부싱류 점검이 자주 권장되는 차량입니다. 특히 10만km 이상 차량은 냉각수 누수와 하체 소음을 우선 확인해보세요.'
  )
  on conflict (manufacturer, model) do update
    set generations = excluded.generations,
        summary = excluded.summary,
        updated_at = now()
  returning id
)
insert into public.vehicle_inspection_items (
  profile_id,
  title,
  symptoms,
  related_parts,
  importance,
  estimated_repair_cost,
  ai_summary,
  display_order
)
select
  upserted_profile.id,
  item.title,
  item.symptoms,
  item.related_parts,
  item.importance,
  item.estimated_repair_cost,
  item.ai_summary,
  item.display_order
from upserted_profile
cross join (
  values
    (
      '냉각팬 모터 소음',
      array['정차 중 냉각팬 작동음이 크게 들림', '저속 주행 후 팬 진동 또는 거친 회전음 발생'],
      array['냉각팬 모터', '팬 슈라우드', '팬 릴레이'],
      '중',
      '20만~45만원',
      '정차 또는 저속에서 팬 소음이 크면 냉각팬 모터와 팬 슈라우드 체결 상태를 확인하는 것이 좋습니다.',
      1
    ),
    (
      '서모스탯 하우징 누수',
      array['냉각수 보충 주기가 짧아짐', '하우징 주변에 냉각수 자국이나 냄새 발생'],
      array['서모스탯 하우징', '가스켓', '냉각수 호스'],
      '상',
      '20만~45만원',
      '냉각수 감소가 보이면 서모스탯 하우징 주변 누수 흔적과 수온 안정성을 먼저 확인해보세요.',
      2
    ),
    (
      '워터펌프 누수',
      array['엔진룸 하부 냉각수 누수 흔적', '냉각수 냄새 또는 수온 상승 경고'],
      array['워터펌프', '워터펌프 가스켓', '구동 벨트'],
      '상',
      '30만~70만원',
      '워터펌프 누수는 과열로 이어질 수 있어 냉각수 라인과 펌프 주변 누수 여부를 우선 점검해야 합니다.',
      3
    ),
    (
      '점화코일 노후',
      array['가속 시 울컥거림', '엔진 경고등 또는 실화 코드 발생'],
      array['점화코일', '점화 배선', 'ECU 실화 진단'],
      '중',
      '8만~25만원',
      '가속 중 떨림이나 실화 코드가 있으면 점화코일 노후와 커넥터 상태를 함께 확인해보세요.',
      4
    ),
    (
      '점화플러그 노후',
      array['냉간 시동성 저하', '공회전 떨림 또는 연비 저하'],
      array['점화플러그', '점화코일', '연소실'],
      '하',
      '8만~18만원',
      '주행거리가 누적된 말리부는 점화플러그 교체 이력과 공회전 안정성을 확인하면 좋습니다.',
      5
    ),
    (
      '터보차저 계통 이상',
      array['가속력 저하 또는 부스트 압력 부족', '터보 작동음, 흡기 라인 누설, 엔진 경고등'],
      array['터보차저', '웨이스트게이트', '인터쿨러 호스', '부스트 센서'],
      '상',
      '80만~180만원',
      '터보 모델은 가속 시 출력 저하, 부스트 누설, 터보 소음과 관련 정비 이력을 확인하는 것이 중요합니다.',
      6
    ),
    (
      '변속 충격',
      array['저속 변속 시 울컥거림', 'D/R 전환 충격 또는 지연'],
      array['자동변속기', '미션오일', '밸브바디', '미션 마운트'],
      '상',
      '20만~180만원',
      '시운전에서는 냉간과 열간 모두 D/R 전환 충격, 저속 변속감, 미션오일 관리 이력을 확인해보세요.',
      7
    ),
    (
      'AGM 배터리 방전',
      array['시동 지연 또는 전압 저하 경고', '스탑앤고 기능 제한'],
      array['AGM 배터리', '발전기', '배터리 센서'],
      '중',
      '25만~45만원',
      '전장 장비가 많은 차량은 AGM 배터리 상태와 충전 전압을 확인해 방전 이력을 점검하는 것이 좋습니다.',
      8
    ),
    (
      'BCM 및 전장 오류',
      array['간헐적 경고등 점등', '도어락, 조명, 편의장비 오작동'],
      array['BCM', '배선 커넥터', '퓨즈박스', '접지부'],
      '중',
      '20만~80만원',
      '간헐적 전장 오류는 진단기로 이력 코드를 확인하고 BCM, 접지, 커넥터 상태를 함께 봐야 합니다.',
      9
    ),
    (
      '디스플레이 먹통',
      array['센터 디스플레이 꺼짐', '후방카메라 또는 터치 반응 불량'],
      array['인포테인먼트 모니터', '헤드유닛', '후방카메라 배선'],
      '중',
      '20만~120만원',
      '실내 점검 때 디스플레이 부팅, 터치, 후방카메라 전환이 정상인지 반드시 확인해보세요.',
      10
    ),
    (
      '로어암 부싱 마모',
      array['방지턱 통과 시 둔탁한 소음', '제동 또는 조향 시 차체 흔들림'],
      array['로어암', '로어암 부싱', '볼조인트'],
      '중',
      '20만~60만원',
      '하체에서는 로어암 부싱 갈라짐, 유격, 방지턱 통과 소음을 중점적으로 확인하는 것이 좋습니다.',
      11
    ),
    (
      '스태빌라이저 링크 소음',
      array['요철 통과 시 딸깍거림', '저속 조향 중 하체 잡소리'],
      array['스태빌라이저 링크', '스태빌라이저 부싱'],
      '하',
      '10만~25만원',
      '가벼운 하체 잡소리는 스태빌라이저 링크와 부싱 마모 여부를 점검해보세요.',
      12
    ),
    (
      '허브베어링 소음',
      array['속도 증가에 따라 웅웅거리는 주행 소음', '코너링 시 특정 바퀴 쪽 소음 변화'],
      array['허브베어링', '휠 허브', '타이어'],
      '중',
      '15만~40만원',
      '주행 중 속도에 비례하는 소음이 있으면 타이어 편마모와 허브베어링 소음을 구분해서 확인해야 합니다.',
      13
    ),
    (
      '에어컨 컴프레서 불량',
      array['냉방 성능 저하', '컴프레서 작동 시 이음 또는 간헐적 냉방'],
      array['에어컨 컴프레서', '냉매 라인', '콘덴서', '압력 센서'],
      '중',
      '50만~120만원',
      '냉방 성능과 컴프레서 작동음을 확인하고, 냉매 누설 정비 이력이 있는지도 함께 확인해보세요.',
      14
    )
) as item(
  title,
  symptoms,
  related_parts,
  importance,
  estimated_repair_cost,
  ai_summary,
  display_order
)
on conflict (profile_id, title) do update
  set symptoms = excluded.symptoms,
      related_parts = excluded.related_parts,
      importance = excluded.importance,
      estimated_repair_cost = excluded.estimated_repair_cost,
      ai_summary = excluded.ai_summary,
      display_order = excluded.display_order,
      updated_at = now();

with target_profile as (
  select id
  from public.vehicle_inspection_profiles
  where manufacturer = '쉐보레'
    and model = '말리부'
)
insert into public.vehicle_inspection_year_notes (
  profile_id,
  min_year,
  max_year,
  label,
  summary,
  display_order
)
select
  target_profile.id,
  note.min_year,
  note.max_year,
  note.label,
  note.summary,
  note.display_order
from target_profile
cross join (
  values
    (2016, 2018, '2016~2018 초기형', '초기형은 냉각계통 누수와 하체 소음 점검을 우선 권장합니다.', 1),
    (2019, 2023, '2019~2023 페이스리프트', '페이스리프트 모델은 전반적인 완성도가 개선되었지만 기본 냉각계통과 전장 점검은 필요합니다.', 2)
) as note(min_year, max_year, label, summary, display_order)
on conflict (profile_id, label) do update
  set min_year = excluded.min_year,
      max_year = excluded.max_year,
      summary = excluded.summary,
      display_order = excluded.display_order,
      updated_at = now();

with target_profile as (
  select id
  from public.vehicle_inspection_profiles
  where manufacturer = '쉐보레'
    and model = '말리부'
)
insert into public.vehicle_inspection_engine_notes (
  profile_id,
  engine,
  summary,
  display_order
)
select
  target_profile.id,
  note.engine,
  note.summary,
  note.display_order
from target_profile
cross join (
  values
    ('1.35 터보', '연비가 우수한 편이며, 터보 계통과 냉각수 상태를 기본 점검 항목으로 두는 것이 좋습니다.', 1),
    ('1.5 터보', '거래량이 많은 엔진으로, 냉각계통 누수와 점화계통 정비 이력을 확인하는 것을 권장합니다.', 2),
    ('2.0 터보', '고성능 모델 특성상 터보차저, 변속기, 냉각계통 관리 상태가 구매 판단에 중요합니다.', 3)
) as note(engine, summary, display_order)
on conflict (profile_id, engine) do update
  set summary = excluded.summary,
      display_order = excluded.display_order,
      updated_at = now();
