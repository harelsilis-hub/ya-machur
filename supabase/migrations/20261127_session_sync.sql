-- Sync focus progress across devices and support "press Start" phases.
-- Run once in the Supabase SQL editor.
alter table settings add column if not exists session_focus_ms bigint not null default 0;
alter table settings add column if not exists session_started_at bigint;
