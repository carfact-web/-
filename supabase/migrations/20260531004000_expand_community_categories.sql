alter table public.community_posts
  drop constraint if exists community_posts_category_check;

alter table public.community_posts
  add constraint community_posts_category_check
  check (
    category in (
      'free',
      'maintenance',
      'question',
      'news',
      'shop_review',
      'electric',
      'imported',
      'domestic'
    )
  );
