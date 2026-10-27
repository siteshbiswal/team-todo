# Team To-Do

React + Supabase app replacing the team's recurring-task spreadsheet. Hosted on GitHub Pages.

## Setup
1. Copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
2. `npm ci && npm run dev`
3. In Supabase → Auth → URL Configuration, add the site URL (and `http://localhost:5173/team-todo/` for local dev).

## Admin
First user: sign in once, then in the Supabase SQL editor run
`update profiles set role='admin', name='<name as in task sheet>' where id = '<user id>';`
Admins can then edit tasks, owners, schedules and user roles in the Admin tab.

## How tasks work
`task_templates` hold the recurring definitions; a nightly job (06:00 IST) creates that day's `task_instances`.
Members see tasks where their profile name appears in the 1st/2nd responsible field; heads see their team.
