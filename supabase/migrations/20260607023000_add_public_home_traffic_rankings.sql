create or replace function public.public_get_home_traffic_rankings()
returns table (
  top_vehicles jsonb,
  top_models jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'vehicle_id', ranked.vehicle_id,
            'view_count', ranked.view_count,
            'car_number', vehicle.car_number,
            'manufacturer', vehicle.manufacturer,
            'model', vehicle.model,
            'generation', vehicle.generation,
            'model_detail', coalesce(master.model_detail, vehicle.generation, vehicle.model)
          )
          order by ranked.view_count desc, ranked.vehicle_id
        )
        from (
          select view.vehicle_id, count(*) as view_count
          from public.page_views as view
          where view.vehicle_id is not null
            and view.review_id is null
          group by view.vehicle_id
          order by count(*) desc, view.vehicle_id
          limit 10
        ) as ranked
        left join public.vehicles as vehicle on vehicle.id = ranked.vehicle_id
        left join lateral (
          select vehicle_master.model_detail
          from public.vehicle_master
          where vehicle_master.manufacturer = vehicle.manufacturer
            and (
              vehicle_master.model_detail = vehicle.generation
              or vehicle_master.model = vehicle.model
            )
          order by
            case
              when vehicle_master.model_detail = vehicle.generation then 0
              else 1
            end,
            vehicle_master.id
          limit 1
        ) as master on true
      ),
      '[]'::jsonb
    ) as top_vehicles,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'model_name', ranked.model_name,
            'manufacturer', ranked.manufacturer,
            'view_count', ranked.view_count
          )
          order by ranked.view_count desc, ranked.model_name
        )
        from (
          select
            coalesce(
              nullif(master.model_detail, ''),
              nullif(vehicle.generation, ''),
              nullif(vehicle.model, ''),
              '모델 정보 없음'
            ) as model_name,
            nullif(vehicle.manufacturer, '') as manufacturer,
            count(*) as view_count
          from public.page_views as view
          join public.vehicles as vehicle on vehicle.id = view.vehicle_id
          left join lateral (
            select vehicle_master.model_detail
            from public.vehicle_master
            where vehicle_master.manufacturer = vehicle.manufacturer
              and (
                vehicle_master.model_detail = vehicle.generation
                or vehicle_master.model = vehicle.model
              )
            order by
              case
                when vehicle_master.model_detail = vehicle.generation then 0
                else 1
              end,
              vehicle_master.id
            limit 1
          ) as master on true
          where view.vehicle_id is not null
            and view.review_id is null
          group by
            coalesce(
              nullif(master.model_detail, ''),
              nullif(vehicle.generation, ''),
              nullif(vehicle.model, ''),
              '모델 정보 없음'
            ),
            nullif(vehicle.manufacturer, '')
          order by count(*) desc, model_name
          limit 10
        ) as ranked
      ),
      '[]'::jsonb
    ) as top_models;
$$;

revoke all on function public.public_get_home_traffic_rankings() from public;
grant execute on function public.public_get_home_traffic_rankings() to anon;
grant execute on function public.public_get_home_traffic_rankings() to authenticated;

