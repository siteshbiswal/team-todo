# Team To-Do

React + Supabase app replacing the team's Excel workbook: recurring to-do list plus six trackers
(Outstanding, Tenders, POs, Logistics, Service/Warranty, Sourcing). Hosted on GitHub Pages.

## Features
- **To-do:** 67 recurring tasks generated daily (IST) from templates; Today view, board with date range, bulk done, history.
- **Trackers:** same columns and dropdowns as the workbook; calculated fields (balance, days overdue, margin, warranty end,
  best vendor, margin %) are computed in the database. Inline editing, search, sort, status filter, Excel export, admin Excel import.
- **Follow-ups:** everything with a next-follow-up date due today or earlier is listed on Today with a one-click "Done".
- **Summary:** to-do completion by team/person/date range, outstanding ageing and top debtors, tender/PO status, late deliveries, open complaints.
- **Access:** all signed-in staff can view every tracker; only the owning team (or heads/admins) can edit; vendor costs, rates and margins
  are visible to heads/admins only; deletes and audit log are admin-only. Enforced by Postgres row-level security.

## Setup
1. Copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
2. `npm ci && npm run dev` (open `http://localhost:5173/team-todo/`), `npm test` for unit tests.
3. In Supabase → Auth → URL Configuration add the site URL (and the localhost URL for local dev).

## Admin
First user: sign in once, then in the Supabase SQL editor run
`update profiles set role='admin', name='<name as in task sheet>' where id = '<user id>';`
Then use the Admin tab to set each person's name, role and team. A member sees to-dos where their **name** appears in the
1st/2nd responsible field, and can edit the trackers belonging to their **team**
(Sales / Pre-Sales, Tendering, Logistics Follow-up, Sourcing, Accounts, Admin).

## Importing the workbook
Admin → open a tracker → **Import Excel** and pick the workbook. The sheet is found by its original name
(`1 Outstanding` … `6 Sourcing`); example/placeholder rows are skipped. Import POs before Logistics and Service.

## Testing
- `npm run check` — type-check, lint and unit tests (also run by CI on every push, together with `npm audit` and a build).
- `npm run build && npm run e2e` — browser tests in Chromium against a faked Supabase API (needs Playwright installed locally):
  `functional` (every screen and role), `robustness` (API failures, hostile data, double taps, 5,000-row performance),
  `a11y` (axe WCAG 2.1 AA in light and dark, keyboard and focus), `responsive` (7 screen widths, touch targets), `excel` (export/import, time zones).
  Run one with `npm run e2e -- a11y`; set `WORKBOOK=/path/to/workbook.xlsx` to also test importing the real workbook.
- Database access rules are tested by running as each role (pending, member, head, admin, signed-out) inside a rolled-back transaction.
