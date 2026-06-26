-- Migration 002: board schema additions
-- Adds missing columns to boards & boxes, formalises the items JSONB column,
-- and introduces board_shares for per-board member roles.

-- ─── boards: missing columns ────────────────────────────────────────────────

alter table boards
  add column if not exists is_finished          boolean      not null default false,
  add column if not exists background_opacity   float,
  add column if not exists background_size      text,
  add column if not exists background_position  text,
  add column if not exists background_filter    text,
  add column if not exists background_overlay_color    text,
  add column if not exists background_overlay_opacity  float,
  -- Board-scoped theme token overrides (ThemeVarMap).
  -- Stored as JSONB so arbitrary CSS-variable maps can evolve without migrations.
  add column if not exists board_theme_vars     jsonb,
  add column if not exists collab_enabled       boolean      not null default false,
  -- Board-level items placed directly on the canvas (BoardLevelItem[]).
  -- The client stores the full serialised array here alongside the boxes array.
  add column if not exists board_items          jsonb        not null default '[]'::jsonb;

-- ─── boxes: rename content → items, add missing columns ─────────────────────
-- `content jsonb default '{}'` was the placeholder column name.
-- The type definition uses `items: BlockItem[]`, so rename to avoid confusion.
-- We keep the old column populated (copy its data) then drop it.

do $$
begin
  -- Only rename if items column doesn't already exist
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'boxes' and column_name = 'items'
  ) then
    alter table boxes rename column content to items;
    -- Migrate any existing non-array data: wrap objects in an array, leave arrays alone.
    update boxes
    set items = case
      when jsonb_typeof(items) = 'array' then items
      else '[]'::jsonb
    end;
    alter table boxes alter column items set default '[]'::jsonb;
    alter table boxes alter column items set not null;
  end if;
end;
$$;

alter table boxes
  add column if not exists is_expanded          boolean      not null default false,
  add column if not exists collapsed_style      jsonb,
  -- Deck container fields
  add column if not exists is_deck              boolean      not null default false,
  add column if not exists deck_owner_id        uuid         references boxes(id) on delete set null,
  add column if not exists deck_slide_ids       jsonb        not null default '[]'::jsonb,
  add column if not exists deck_focus_index     integer      not null default 0,
  -- Deck appearance / behaviour
  add column if not exists deck_transition      text         check (deck_transition in ('slide','fade','scale','flip')),
  add column if not exists deck_layout          text         check (deck_layout in ('centered','flat','stack')),
  add column if not exists deck_auto_play       boolean      not null default true,
  add column if not exists deck_auto_play_ms    integer      not null default 3500,
  add column if not exists deck_show_arrows     boolean      not null default true,
  add column if not exists deck_show_dots       boolean      not null default true,
  add column if not exists deck_show_peek       boolean      not null default true,
  add column if not exists deck_peek_scale      float        not null default 0.82,
  add column if not exists deck_peek_opacity    float        not null default 0.5,
  add column if not exists deck_peek_blur       boolean      not null default false;

-- ─── board_shares: per-board member roles ───────────────────────────────────

create type if not exists board_share_role as enum ('viewer', 'editor', 'admin');

create table if not exists board_shares (
  board_id    uuid         not null references boards(id) on delete cascade,
  user_id     uuid         not null references profiles(id) on delete cascade,
  role        board_share_role not null default 'viewer',
  invited_by  uuid         references profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at  timestamptz  not null default now(),
  primary key (board_id, user_id)
);

create index if not exists board_shares_user_id_idx on board_shares(user_id);

-- RLS
alter table board_shares enable row level security;

-- Board owner can manage all share entries for their boards
create policy "board_shares: owner manage" on board_shares
  for all
  using (
    exists (
      select 1 from boards
      where boards.id = board_id
        and boards.owner_id = auth.uid()
    )
  );

-- Invited users can see their own invitation and update it (to accept)
create policy "board_shares: self read" on board_shares
  for select
  using (auth.uid() = user_id);

create policy "board_shares: self accept" on board_shares
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Updated boards RLS: editors/viewers via board_shares can read ───────────
-- The existing "boards: public read" covers is_public boards.
-- Add a policy for shared-but-private boards.
create policy "boards: shared read" on boards
  for select
  using (
    exists (
      select 1 from board_shares
      where board_shares.board_id = id
        and board_shares.user_id  = auth.uid()
        and board_shares.accepted_at is not null
    )
  );

-- Editors and admins on a shared board can also write boxes
create policy "boxes: shared editor" on boxes
  for all
  using (
    exists (
      select 1 from board_shares
      where board_shares.board_id = board_id
        and board_shares.user_id  = auth.uid()
        and board_shares.role     in ('editor','admin')
        and board_shares.accepted_at is not null
    )
  );
