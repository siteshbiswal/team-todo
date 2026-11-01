# Team To-Do

React + Supabase app replacing the team's Excel workbook: a recurring to-do list plus six trackers
(Outstanding, Tenders, POs, Logistics, Service/Warranty, Sourcing). Hosted on GitHub Pages.

## How people get in
There are **no accounts, roles or passwords**. Everyone uses one shared link that carries a secret key:

`https://<user>.github.io/team-todo/?k=<KEY>`

Opening it once saves the key on that device and removes it from the address bar; later visits just work.
Anyone with the link sees and can edit everything (costs and margins included). Without the key the web address shows nothing,
and the database refuses every request that doesn't carry it (row-level security checks the key's hash).
- **Share the link:** Manage → Sharing → Copy.
- **If the link leaks:** Manage → Sharing → *Create a new link* (the old one stops working at once; send the new one to the team).
- **Lost the link / locked out:** in the Supabase SQL editor run
  `update app_access set key_hash = encode(sha256(convert_to('<new 32+ char key>','utf8')),'hex');`
  and share `…/team-todo/?k=<new key>`.
- **Who changed what:** each person can set an optional name (👤 in the header, saved on their device). It powers "Only mine"
  and is recorded in Manage → History.

## Features
- **To-do:** 67 recurring tasks generated daily (IST) from templates; Today view, board with date range, bulk done, history.
- **Trackers:** same columns and dropdowns as the workbook; calculated fields (balance, days overdue, margin, warranty end,
  best vendor, margin %) are computed in the database. Inline editing, search, sort, status filter, Excel export/import.
- **Follow-ups:** everything with a next-follow-up date due today or earlier is listed on Today with a one-click "Done".
- **Summary:** to-do completion by team/person/date range, outstanding ageing and top debtors, tender/PO status, late deliveries, open complaints.
- **Phone friendly**, light/dark/system theme, installable to the home screen.

## Setup
1. Copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
2. `npm ci && npm run dev` (open `http://localhost:5173/team-todo/?k=<KEY>`).

## Importing the workbook
Open a tracker → **Import** and pick the workbook. The sheet is found by its original name (`1 Outstanding` … `6 Sourcing`);
example/placeholder rows are skipped. Import POs before Logistics and Service.

## Testing
- `npm run check` — type-check, lint and unit tests (also run by CI on every push, together with `npm audit` and a build).
- `npm run build && npm run e2e` — browser tests in Chromium against a faked Supabase API (needs Playwright installed locally):
  `functional`, `robustness` (API failures, hostile data, double taps, 5,000-row performance), `a11y` (axe WCAG 2.1 AA, light and dark,
  keyboard/focus), `responsive` (7 widths, touch targets), `excel` (export/import, time zones).
  Run one with `npm run e2e -- a11y`; set `WORKBOOK=/path/to/workbook.xlsx` to also test importing the real workbook.
- Database access is tested by running as the browser role inside a rolled-back transaction with the right key, a wrong key, and no key.
