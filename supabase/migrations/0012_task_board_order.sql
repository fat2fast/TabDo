-- Migration: 0012_task_board_order.sql
-- Description: Adds board_order column for manual custom reordering of tasks within Kanban board lanes

alter table public.tasks add column if not exists board_order double precision;

-- Initialize existing tasks with created_at epoch
update public.tasks
set board_order = extract(epoch from created_at)
where board_order is null;

-- Default for newly created tasks
alter table public.tasks alter column board_order set default (extract(epoch from now()));

create index if not exists idx_tasks_user_board_order on public.tasks(user_id, status, board_order desc);
