create table if not exists public.user_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  board_key text not null default 'default',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, board_key)
);

create or replace function public.set_user_boards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_boards_updated_at on public.user_boards;

create trigger set_user_boards_updated_at
before update on public.user_boards
for each row
execute function public.set_user_boards_updated_at();

alter table public.user_boards enable row level security;

drop policy if exists "Users can read their own boards" on public.user_boards;
drop policy if exists "Users can create their own boards" on public.user_boards;
drop policy if exists "Users can update their own boards" on public.user_boards;
drop policy if exists "Users can delete their own boards" on public.user_boards;

create policy "Users can read their own boards"
on public.user_boards
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own boards"
on public.user_boards
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own boards"
on public.user_boards
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own boards"
on public.user_boards
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_boards to authenticated;

create index if not exists user_boards_user_id_idx
on public.user_boards (user_id);
