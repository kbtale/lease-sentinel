<h1 align="center">LeaseSentinel</h1>

<p align="center">
  AI-powered lease deadline extraction, multi-channel alerting, and calendar sync for landlords, tenants, and property managers.
  <br>
  Upload a PDF/DOCX lease or paste legal clauses to automate email, Slack, webhook, and calendar reminders.
  <br>
  <br>
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/AI-Gemini%202.5%20Flash-8E75B2?logo=google&logoColor=white" alt="Gemini" />
  <img src="https://img.shields.io/badge/Email-Resend-000000" alt="Resend" />
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="License" />
</p>

---

## Core Capabilities

- **PDF / DOCX / TXT Lease Upload & Multi-Deadline Extraction:** Upload up to a 10MB lease document (or paste full lease text), extract every renewal, termination, escalation, insurance, and payment cutoff with Gemini (`GEMINI_MODEL`, default `gemini-2.5-flash`), and review/edit deadlines before bulk saving.
- **Full Sentinel Lifecycle & Delivery Logs:** Edit deadline details, property labels, and reminder lead times (`30d` / `14d` / `7d` / `0d`), pause/resume/resolve monitors, trigger immediate signed test alerts, and inspect user-scoped delivery history logs.
- **Built-In Resend HTML Email + Optional Make.com Routing:** Deliver rich HTML deadline reminders directly via Resend (`RESEND_FROM_EMAIL`), direct HTTPS Slack/custom webhooks with optional `X-LeaseSentinel-Signature` HMAC-SHA256 signing, or optionally route via Make.com when `MAKE_WEBHOOK_URL` is configured.
- **RFC 5545 `.ics` Calendar Export:** Download single-deadline or bulk active `.ics` calendar files with `VALARM` reminders for Apple Calendar, Google Calendar, and Outlook.
- **Public Interactive Demo (`/demo`):** Visitors can test lease extraction, `.ics` export, and email/webhook payload previews without signing in.

---

## Security & Reliability Architecture

- **Row-Level Security:** Every Firestore read, write, update, test alert, and delivery log query verifies `userId === session.user.email`.
- **Hardened Cron Scheduling:** `/api/cron/check` fails closed when `CRON_SECRET` is unset, validates `Authorization` with `crypto.timingSafeEqual`, queries due and missed `PENDING` sentinels plus lead-time reminder windows, and tracks `notifiedWindows` idempotently so retries work without duplicates.
- **Admin Allowlist:** Manual cron triggers (`triggerCronManual()` and `/simulate` override) require both an authenticated session and an email allowlisted in `ADMIN_EMAILS`.
- **SSRF Guard:** `src/lib/url-safety.ts` validates targets by channel (`email`, E.164 `sms`, and HTTPS-only `slack`/`custom` webhooks), resolves DNS, and blocks loopback, RFC1918 private networks, link-local, and cloud metadata IPs (`169.254.169.254`).

---

## Getting Started

### Prerequisites

- Node.js 20+
- Google Cloud / Firebase project with Firestore enabled
- Google AI Studio API key (`GOOGLE_API_KEY`)
- Resend API key (`RESEND_API_KEY`) for magic-link auth and direct HTML email alerts

### 1. Clone & Install

```bash
git clone https://github.com/kbtale/lease-sentinel.git
cd lease-sentinel
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000/demo](http://localhost:3000/demo) to try the no-login interactive extractor, or sign in at [http://localhost:3000/login](http://localhost:3000/login).

---

## Project Structure

```text
src/
├── actions/                 # Auth, Admin, Fetch, and Sentinel lifecycle Server Actions
├── app/
│   ├── api/
│   │   ├── auth/            # NextAuth v5 handlers
│   │   ├── cron/check/      # Hardened daily scheduler with lead-time windows
│   │   └── demo/extract/    # Rate-limited public demo extraction endpoint
│   ├── demo/                # Public interactive lease playground
│   ├── login/               # Google OAuth + Resend Magic Link login
│   ├── simulate/            # Authenticated extraction tester (admin-only cron override)
│   └── page.tsx             # Main authenticated dashboard
├── components/
│   ├── dashboard/           # StatsBar, CreateSentinelCard, LeaseUploadDialog,
│   │                        # SentinelsTable, EditSentinelDialog, DeliveryLogsDrawer
│   ├── demo/                # DemoPlayground
│   ├── simulate/            # SimulateClient
│   └── ui/                  # Accessible Radix + Tailwind primitives
├── lib/
│   ├── admin.ts             # ADMIN_EMAILS allowlist helper
│   ├── ai.ts                # Single & multi-deadline Gemini extraction + Zod validation
│   ├── date-utils.ts        # UTC ISO date & lead-time window utilities
│   ├── dispatch.ts          # Unified Resend / Slack / Webhook / Make.com dispatcher
│   ├── document-parser.ts   # Server-side .pdf / .docx / .txt parser (10MB cap)
│   ├── email.ts             # Resend HTML/text deadline email builder & sender
│   ├── firebase.ts          # Lazy Firebase Admin Firestore singleton
│   ├── ics.ts               # RFC 5545 single & bulk .ics generator
│   ├── url-safety.ts        # DNS/IP SSRF guard & channel target validation
│   └── webhook.ts           # Timeout-safe HTTPS webhook sender with HMAC signing
└── models/
    └── schema.ts            # Zod domain schemas & ActionState helpers
```

---

## Development

```bash
npm run dev           # Start local dev server
npm run lint          # ESLint
npm test -- --run     # Vitest unit & component tests
npm run build         # Next.js production build
npm run docs          # Generate optional local TypeDoc output (.typedoc-out/)
```

---

## License

MIT — see [LICENSE](./LICENSE).
