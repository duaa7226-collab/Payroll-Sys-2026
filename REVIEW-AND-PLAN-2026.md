# Nokhaba Payroll — 2026 product review & dashboard-module integration plan

Reviewed the full application (Next.js 16 App Router, 12 in-app views, 31 API routes,
Prisma/Supabase auth, branding + PDF pipeline) plus the company-branding work delivered
alongside this document.

---

## 1. Verdict

The foundation is genuinely good: Tailwind 4 design tokens with an emerald/slate palette,
shadcn/ui primitives, bilingual (EN/AR) content, tabular numerals for finance, a real
payroll rules engine, and payslip/PDF output that has already been tuned for print.

What keeps it from reading as a **2026 flagship product** is not the color palette — it is
the interaction model and the finish:

- The whole app is **one URL with 12 tabs held in `useState`** — no deep links, no browser
  back/forward, refresh always returns to the dashboard, nothing can be linked from another
  system. This is also the single biggest blocker for embedding it in your dashboard.
- Every screen is **client-side fetched with hand-rolled `useEffect`**, so first paint is a
  skeleton or empty space, errors are silent, and there is no shared cache.
- **Dark mode is designed but unreachable** (no theme provider, no toggle, `<html>` never
  gets `class="dark"`), even though `next-themes` is already a dependency.
- **Native `alert()` / `confirm()`** is used in 19 places for destructive and error flows.
- The app has no **first-run experience**: a fresh database lands the user on a dashboard
  with no data and no instruction to upload the monthly Excel file.
- Build integrity is weak: `next.config.ts` sets `typescript.ignoreBuildErrors: true` and a
  `tsc --noEmit` run currently fails with dozens of real errors (dashboard API nullability,
  Prisma batch payloads, `never[]` inference in income/expenses and drivers views).

So: **strong engine, mid-2020s presentation.** The roadmap below is ordered so each phase
ships something visible, not a rewrite.

---

## 2. Findings

Severity: **P0** = trust / blocks embedding · **P1** = perceived quality · **P2** = scale & polish.

### P0 — fix before showing this to anyone external

| # | Finding | Where |
|---|---|---|
| 1 | **No URL routing.** Tabs are state; there is not a single `next/link` or `useRouter` usage. Modules cannot be linked, bookmarked, or mounted. | `src/app/page.tsx` (`TABS`, `activeTab`) |
| 2 | **Type safety is disabled in the build.** `ignoreBuildErrors: true`, and `tsc` reports real errors today. Any refactor can silently break a screen. | `next.config.ts`, `src/app/api/dashboard/route.ts:109`, `src/app/api/income-expenses/dashboard/route.ts` |
| 3 | **Destructive actions use `confirm()`/`alert()`** — unstyled, blocking, unannounced to screen readers, and "Clear all data" uses two chained confirms. | `dashboard-view.tsx` `handleClearData` (+18 other call sites) |
| 4 | **Branding upload is only validated in the browser.** The logo is stored as a base64 data URL in `CompanyProfile.logo`; the 2 MB check lives in the client, while `PUT /api/company` accepts any string length/type. A large upload bloats the DB and every login payload. | `company-branding-view.tsx`, `src/app/api/company/route.ts` |
| 5 | **`.env.example` is unsafe/misleading.** It contains a live-looking Supabase project URL and publishable/anon key, and the URL variable is misspelled `NNEXT_PUBLIC_SUPABASE_URL`, which fails silently on a new deployment. README names `NEXT_PUBLIC_SUPABASE_ANON_KEY` while the code prefers `PUBLISHABLE_KEY`. | `.env.example`, `README.md`, `src/middleware.ts` |
| 6 | **Single-tenant data model.** `CompanyProfile` is a single row read with `findFirst()`; payroll tables have no `organizationId`. If your dashboard serves more than one company, embedding payroll as a module is impossible without adding tenancy. | `prisma/schema.prisma`, `src/app/api/company/route.ts` |

### P1 — what "stunning" actually requires here

1. **First paint and empty states.** Only the dashboard has a skeleton; most views render
   `Loading...` text or nothing. Add per-route `loading.tsx`, real empty states with a
   primary action ("Import this month's Excel"), and error boundaries that keep the shell.
2. **Information hierarchy on the dashboard.** Eight chart cards compete at equal weight.
   Lead with 3–4 KPI tiles (net payroll, headcount, variance, exceptions), then one
   trend chart, then detail. Add period-over-period deltas ("+4.2% vs September") — the data
   to compute this already exists per run.
3. **Navigation.** 12 flat tabs, no search, no breadcrumb, mobile drawer without a backdrop
   or scroll lock. Group into Overview / People / Payroll / Finance / Settings with routes.
4. **Typography scale.** Three font families load (Geist, Geist Mono, Cairo) with many 9–11 px
   labels; Arabic at that size is hard to read and fails contrast in the muted tones. Set a
   minimum 12 px for labels, 13 px body in Arabic, and a clear display/heading scale.
5. **Dark mode + theming.** Wire `next-themes` with a `ThemeProvider` and a header toggle;
   the `.dark` token set is already complete. Consider per-company accent color derived from
   the logo so branding is not only a logo swap.
6. **Motion.** Only a shimmer exists. Add purposeful 150–250 ms transitions (tab/page
   change, cards, table row insert), respect `prefers-reduced-motion`, and drop `framer-motion`
   if the target is CSS-only.
7. **Accessibility.** `alt` text is present on branding images but width/height are not, so
   the login banner shifts on load; icon buttons in tables are small; the sign-in banner's
   low-opacity Arabic footer sits near the contrast limit; focus styling relies on a single
   ring token.
8. **Payload.** The sign-in route is **~270 KB HTML** with the current 82 KB logo embedded
   three times (banner, form mark, RSC payload) — measured on this branch. Moving logo
   storage to Supabase Storage + `next/image` (or a `/branding/logo` route with an ETag)
   cuts that by ~75% and scales to real logos.
9. **Client bundle.** All 12 views are statically imported into one client component; only
   Map Rider is dynamic. Route-level splitting will remove PDF/Excel/chart code from first load.
10. **Copy.** Mixed languages inside one sentence ("Access is restricted to authorized
    members of Nokhaba Tatweer"), tiny all-caps eyebrow text, and product/company names used
    interchangeably. Branding now supplies the company name — use it consistently.

### P2 — scale, ops, polish

- `next-intl` and `@tanstack/react-query` are installed but unused; both are the right answer
  to the ad-hoc fetch/polling and hardcoded bilingual strings.
- Audit logging covers company/profile edits but not destructive operations end-to-end;
  add an explicit audit entry for data clears and payroll re-runs with actor + counts.
- PDF layouts duplicate hex colors and spacing instead of the app tokens — they will drift
  from the UI every redesign.
- No CI: no workflow runs `tsc`, ESLint, or the build. Add one job; it will immediately
  surface the errors above.
- `reactStrictMode: false` hides double-render bugs. Turn it on after the fetch refactor.

---

## 3. Delivered with this review: company logo + sign-in banner

**What changed**

| File | Purpose |
|---|---|
| `src/lib/branding.ts` | Shared `Branding` type, defaults, monogram helper. |
| `src/app/api/branding/route.ts` | **Public** `GET /api/branding` returning only `name`, `nameAr`, `logo` (cache 30 s / SWR 300 s). No contact, tax, IBAN or signature fields. |
| `src/components/brand/brand-banner.tsx` | `BrandMark` (logo tile with monogram fallback) and `BrandBanner` (premium emerald aurora banner with logo, company name and Arabic name). |
| `src/app/login/page.tsx` | Server component: loads branding from the DB **before** render, so there is no flash of placeholder branding. Falls back to defaults if the DB is unavailable. |
| `src/app/login/login-view.tsx` | Sign-in UI. Logo + company name now sit **above the form** on every screen size, the left banner shows the same logo, and the restricted-access line uses the company name. |
| `src/app/page.tsx` | App header now renders the uploaded logo + company name instead of a generic wallet icon. |
| `src/components/payroll/company-branding-view.tsx` | New "Sign-in Screen & Banner" card previews exactly how the logo, banner, form mark and app header will look; copy explains where the logo appears. |
| `src/middleware.ts` | `/api/branding` is public (and stays reachable while Supabase env vars are missing). |

**How the owner uses it:** Settings → *Company Branding* → *Logo & Signatures* → upload a
square transparent PNG → **Save Changes**. The sign-in banner, the logo above the sign-in
form and the app header all update within 30 seconds; the server-rendered login page picks
up the change on the next request.

**Verified:** `tsc` on all touched files is clean (the remaining errors are pre-existing and
documented above), ESLint clean apart from one pre-existing warning, `/login` returns 200 with
the company name and logo in the server HTML, `/api/branding` returns the three public fields,
and `/` still redirects unauthenticated users to `/login?next=/`.

**Recommended follow-up (not done, needs your decision):** downscale/convert the upload with
`sharp` (already a dependency) and store it in Supabase Storage instead of a base64 column.

---

## 4. Connecting payroll to your dashboard as a module

### 4.1 What "module" can mean — pick one

| Option | How it works | Effort | Trade-offs |
|---|---|---|---|
| **A. Subdomain module (recommended)** | `payroll.yourdomain.com`, launched from the dashboard nav; payroll keeps its own session (or accepts an SSO hand-off). | Low–Medium | Two origins, but zero layout/packaging work. Independent deploys. Best first step. |
| **B. Same-origin path mount** | Dashboard gateway proxies `/payroll/*` to this app (`basePath: '/payroll'`). One origin, cookies just work. | Medium | Requires a `basePath` audit: every `fetch('/api/...')` in this codebase is an absolute path and will **not** be prefixed automatically. Also needs the gateway to strip/forward correctly. |
| **C. iframe module** | Dashboard renders an iframe with `?embed=1`; payroll hides its own shell. | Medium | Third-party cookie restrictions (iframe cross-site needs `SameSite=None; Secure`), double scrollbars, PDF/print and focus quirks, mobile height plumbing. Good as a stopgap, not a destination. |
| **D. True micro-frontend** | Payroll views published as a package (or Module Federation remote) consumed by the dashboard shell. | High | Requires extracting UI from Next server routes, a shared design-token package, duplicated auth, and versioning. Only worth it for KPI cards on the dashboard home. |

**Recommendation:** ship **A** first (a module tile in the dashboard that opens
`payroll.yourdomain.com` with SSO), then use **C** only if the dashboard team insists payroll
render *inside* the dashboard frame, and reserve **D** for a small "Payroll snapshot" card.

### 4.2 Prerequisites inside this repo (in order)

1. **Routing refactor (P0, ~3–5 days).** Convert `activeTab` into routes:
   `/dashboard`, `/drivers`, `/payslips`, `/finance/income-expenses`, `/settings/branding`, …
   Shared `layout.tsx` holds header + sidebar; `next/link` for navigation; `loading.tsx` and
   `error.tsx` per segment. This is what makes deep links from the dashboard possible at all.
2. **Parse URL state.** `?runId=`, `?month=`, `?embed=1`, and finance filters must live in the
   URL so the dashboard can link to a specific payroll run.
3. **basePath support (only for Option B).** Add `basePath` from `NEXT_BASE_PATH`, prefix all
   `fetch()` calls through one helper (`apiFetch()`), verify middleware matcher and Supabase
   auth redirect URLs include the prefix, and confirm PDF/print routes still resolve assets.
4. **Embed mode (Option C).** `EMBED_MODE=1` or `?embed=1` hides the app header/sidebar, sends
   height to the parent via `postMessage`, and sets
   `Content-Security-Policy: frame-ancestors https://dashboard.yourdomain.com`
   (never `X-Frame-Options: ALLOWALL`).
5. **SSO hand-off.** Preferred flow: the dashboard mints a short-lived signed token for the
   signed-in user → `GET /auth/sso?token=…` → payroll verifies it server-side (shared secret,
   ≤60 s TTL, single use), maps the role to `owner`/`admin`/`viewer`, creates/refreshes the
   Supabase session cookie, redirects to `/dashboard`. Add `aud`/`iss` checks and audit the
   sign-in. If Supabase is your IdP, use a Supabase admin-generated session for the same
   effect instead of a custom token.
6. **Branding single source of truth.** When embedded, push `{name, nameAr, logo, accent}`
   from the dashboard's company settings to `PUT /api/company` (or add a small
   `POST /api/branding/sync` with service credentials) so users never upload the logo twice.
   The public `/api/branding` endpoint already exposes the read side for the shell.
7. **Tenancy decision (blocker for multi-company dashboards).** If the dashboard serves
   multiple companies, add `organizationId` to `CompanyProfile`, `Driver`, `PayrollRun`,
   `IncomeRecord`, `Expense`, `DriverCount`, `AuditLog`, and scope every `findFirst()` /
   `findMany()` through it before embedding. Single-company deployments can skip this.
8. **Module navigation contract.** Emit `postMessage` events the shell can consume:
   `payroll:ready`, `payroll:route-changed`, `payroll:run-completed`, `payroll:height`.
   Accept `payload:theme` (light/dark/accent) and `payload:locale` (en/ar).
9. **Ops.** Two deploy targets or one gateway route, a documented env contract (see
   `.env.example`), health endpoint, structured logs, and a canary on `/api/dashboard`.

### 4.3 What your dashboard must provide

- A launch point (nav item or card) with the target URL per environment.
- Identity: either a session token hand-off endpoint, or confirmation that Supabase is the
  IdP for both products.
- The company/branding record (name, Arabic name, logo URL or base64, accent color).
- Role mapping: which dashboard role becomes `owner`, `admin`, `viewer`.
- If iframing: the parent origin(s) for `frame-ancestors`, and agreement that payroll
  cookies are `SameSite=None; Secure` on HTTPS.

### 4.4 Suggested phases

| Phase | Scope | Outcome | Effort |
|---|---|---|---|
| 0 (now) | Branding + banner (delivered), `.env.example` fix, typecheck/CI job | Demo-ready sign-in and shell | 0.5–1 day |
| 1 | Routing refactor, URL state, loading/error/empty states, theming toggle | Bookmarkable, linkable, modern shell | 1–1.5 weeks |
| 2 | SSO hand-off + subdomain module launch (Option A) | Payroll reachable from the dashboard with one identity | 4–6 days |
| 3 | Optional iframe embed (`?embed=1`, CSP, postMessage), branding sync | Payroll rendered inside the dashboard | 4–6 days |
| 4 | Tenancy scoping (if multi-company), Storage-based logo, dashboard KPI card | Scales to many companies / embedded cards | 1.5–2 weeks |

### 4.5 Decisions needed from you

1. Same origin as the dashboard, or a subdomain?
2. Does the dashboard own identity (Azure AD / Okta / its own JWT) or is Supabase the IdP?
3. One company per deployment, or many companies in one dashboard? *(Changes the data model —
   see 4.2 #7.)*
4. Full payroll inside the dashboard frame, or a launch-out module plus a KPI card?
5. Whose visual language wins when both are on screen: dashboard tokens with the payroll
   logo, or payroll's emerald system with a synced accent?

---

## 5. Design system targets for the "2026" bar

- **Type:** Geist for UI, Cairo for Arabic; remove Geist Mono unless used in data tables.
  Scale 12/13/14/16/20/28/34; tabular numerals everywhere money appears.
- **Surfaces:** keep the emerald primary; add one accent derived from the logo; 12 px radius
  for controls, 16–20 px for cards; one elevation level only.
- **Density:** 8 pt spacing grid; table rows 44 px minimum on touch; sticky table headers.
- **Motion:** 180 ms ease-out for navigation and cards; no motion for table sorting; honor
  `prefers-reduced-motion`.
- **States:** every view needs loading, empty-with-CTA, error-with-retry, and success toast.
- **Accessibility:** WCAG AA on muted text, visible focus ring, 44 px targets, labelled icon
  buttons, `lang`/`dir` switching with the Arabic font in RTL contexts.
- **Performance budget:** < 180 KB JS on first load per route, < 500 KB HTML for `/login`
  (currently ~270 KB — already inside budget, but only because the logo is small).

## 6. Acceptance checklist

- [ ] Every view has a URL and survives refresh / deep link.
- [ ] `npx tsc --noEmit` passes and CI enforces it.
- [ ] No `alert()` / `confirm()` anywhere; destructive actions use `AlertDialog` with typed
      confirmation and an audit entry.
- [ ] Logo change appears above the sign-in form, on the banner and in the header.
- [ ] Login page loads in < 1 s on 4G with a 200 KB logo.
- [ ] Light/dark toggle works on every screen, including print previews.
- [ ] SSO launch from the dashboard lands on the intended payroll run, not the default tab.
