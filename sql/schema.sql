-- Supabase SQL schema for the birthday reminder system
-- Run this in the Supabase SQL editor or via psql against your project database.

create table if not exists birthdays (
  owner_user_id bigint not null,
  name text not null,
  month int not null,
  day int not null,
  primary key (owner_user_id, name)
);

create table if not exists sent_log (
  owner_user_id bigint not null,
  yyyymmdd text not null,
  primary key (owner_user_id, yyyymmdd)
);
