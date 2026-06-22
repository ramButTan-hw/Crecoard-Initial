-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Boards
create table boards (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references profiles(id) on delete cascade not null,
  name text not null default 'My Board',
  is_public boolean default false not null,
  background_color text default '#1a1b1e' not null,
  background_image text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Boxes
create table boxes (
  id uuid primary key default uuid_generate_v4(),
  board_id uuid references boards(id) on delete cascade not null,
  x float not null default 0,
  y float not null default 0,
  width float not null default 240,
  height float not null default 160,
  z_index integer not null default 1,
  locked boolean default false not null,
  title text not null default '',
  content jsonb not null default '{}',
  style jsonb not null default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Servers (communities)
create table servers (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  icon text,
  description text,
  is_public boolean default true not null,
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at timestamptz default now() not null
);

-- Server members
create table server_members (
  server_id uuid references servers(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text check (role in ('owner','admin','member')) default 'member' not null,
  joined_at timestamptz default now() not null,
  primary key (server_id, user_id)
);

-- Channels
create table channels (
  id uuid primary key default uuid_generate_v4(),
  server_id uuid references servers(id) on delete cascade not null,
  name text not null,
  type text check (type in ('text','announcement')) default 'text' not null,
  position integer default 0 not null,
  created_at timestamptz default now() not null
);

-- Messages (server channels + DMs)
create table messages (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid references channels(id) on delete cascade,
  dm_recipient_id uuid references profiles(id) on delete cascade,
  sender_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  edited boolean default false not null,
  created_at timestamptz default now() not null,
  constraint message_target check (
    (channel_id is not null and dm_recipient_id is null) or
    (channel_id is null and dm_recipient_id is not null)
  )
);

-- Indexes
create index on boxes(board_id);
create index on messages(channel_id, created_at desc);
create index on messages(sender_id, dm_recipient_id, created_at desc);
create index on server_members(user_id);

-- Row-level security
alter table profiles enable row level security;
alter table boards enable row level security;
alter table boxes enable row level security;
alter table servers enable row level security;
alter table server_members enable row level security;
alter table channels enable row level security;
alter table messages enable row level security;

-- RLS Policies
create policy "profiles: public read" on profiles for select using (true);
create policy "profiles: own update" on profiles for update using (auth.uid() = id);

create policy "boards: owner full" on boards for all using (auth.uid() = owner_id);
create policy "boards: public read" on boards for select using (is_public = true);

create policy "boxes: board owner" on boxes for all
  using (exists (select 1 from boards where boards.id = board_id and boards.owner_id = auth.uid()));

create policy "servers: public read" on servers for select using (is_public = true or owner_id = auth.uid());
create policy "servers: owner" on servers for all using (auth.uid() = owner_id);

create policy "members: self" on server_members for all using (auth.uid() = user_id);
create policy "members: server read" on server_members for select
  using (exists (select 1 from server_members sm where sm.server_id = server_id and sm.user_id = auth.uid()));

create policy "channels: member read" on channels for select
  using (exists (select 1 from server_members sm where sm.server_id = channels.server_id and sm.user_id = auth.uid()));

create policy "messages: send" on messages for insert with check (auth.uid() = sender_id);
create policy "messages: channel read" on messages for select
  using (
    (channel_id is not null and exists (
      select 1 from channels c join server_members sm on sm.server_id = c.server_id
      where c.id = channel_id and sm.user_id = auth.uid()
    )) or
    (dm_recipient_id is not null and (auth.uid() = sender_id or auth.uid() = dm_recipient_id))
  );

-- Trigger: auto-create profile on signup
create or replace function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
