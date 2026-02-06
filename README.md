<h1 align="center">LeaseSentinel</h1>

<p align="center">
  AI-powered lease deadline monitoring with webhook alerts.
  <br>
  Transforms natural language lease clauses into structured deadline trackers.
  <br>
  <br>
<img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/AI-Gemini%203-8E75B2?logo=google&logoColor=white" alt="Gemini" />
  <img src="https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="License" />
</p>

<hr>

https://github.com/user-attachments/assets/8eb97ecf-a650-4fab-9aaa-3ae42a62de68

---

## Mental Model

Think of LeaseSentinel as a **three-stage pipeline**:

<img width="3104" height="1376" alt="image 1" src="https://github.com/user-attachments/assets/40ae07ff-fdb8-4d4b-bb0e-211191fedc90" />

1. **Ingest** → User pastes lease clause + webhook URL
2. **Extract** → Gemini 1.5 Flash parses dates from natural language
3. **Monitor** → Firestore stores the sentinel; cron job checks daily
4. **Alert** → When `triggerDate` arrives, webhook fires with payload

---

## Getting Started

**Time to Hello World: ~3 minutes**

### Prerequisites

- Node.js 18+
- Google Cloud project with Firestore enabled
- Firebase Admin SDK credentials

### 1. Clone & Install

```bash
git clone <repo-url>
cd lease-sentinel
npm install
```

### 2. Configure Environment

Create `.env.local` with:

```env
# Auth (NextAuth v5)
AUTH_SECRET="openssl rand -base64 32"
AUTH_GOOGLE_ID="your-google-oauth-client-id"
AUTH_GOOGLE_SECRET="your-google-oauth-secret"
RESEND_API_KEY="your-resend-api-key"

# AI
GOOGLE_API_KEY="your-gemini-api-key"

# Firebase Admin
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google or Magic Link email, and create your first Sentinel.

---

## Deep Module Architecture

LeaseSentinel follows a **Deep Module** design philosophy: each module has a simple interface but encapsulates significant complexity internally. This minimizes cognitive load: developers interact with clean APIs without needing to understand implementation details.

<img width="2048" height="2080" alt="Image 2" src="https://github.com/user-attachments/assets/3980fcc6-316a-4a01-8322-a40bd2932bdb" />

### Module Isolation Principles

| Module       | Interface                                           | Hidden Complexity                                                 |
| ------------ | --------------------------------------------------- | ----------------------------------------------------------------- |
| **AI**       | `extractLeaseData(text) → {eventName, triggerDate}` | Prompt engineering, JSON parsing, error recovery                  |
| **Database** | `getAdminDb() → Firestore`                          | Singleton caching, credential management, Timestamp serialization |
| **Auth**     | `auth() → Session`                                  | Dual-config Edge/Node split, JWT strategy, Firestore adapter      |
| **Webhook**  | `dispatchAlert(url, payload) → boolean`             | AbortController timeout, error handling                           |

### Why This Matters

A new developer working on the dashboard doesn't need to understand:

- How Gemini prompts are structured
- Why there are two auth configuration files
- How Firestore Timestamps are serialized

They call `createSentinel()` and get back an `ActionState`. The complexity is **encapsulated**.

---

## Dual-Auth Configuration

NextAuth v5's Edge middleware is incompatible with the Firestore adapter. LeaseSentinel solves this with a **split configuration**:

| File             | Runtime | Purpose                              |
| ---------------- | ------- | ------------------------------------ |
| `auth.config.ts` | Edge    | Shared config (providers, callbacks) |
| `auth.ts`        | Node.js | Full NextAuth + Firestore adapter    |
| `proxy.ts`       | Edge    | Middleware using Edge-safe config    |

See [ADR-001](./docs/adr/ADR-001-dual-auth.md) for the full architectural decision record.

---

## Project Structure

```
src/
├── actions/           # Server Actions (CRUD operations)
│   ├── sentinel.actions.ts   # Create/Delete sentinels
│   ├── fetch-actions.ts      # Read operations
│   └── auth.actions.ts       # Sign in/out wrappers
├── app/               # Next.js App Router
│   ├── api/auth/      # NextAuth route handlers
│   └── page.tsx       # Dashboard
├── components/        # React UI (shadcn/ui based)
├── lib/               # Core utilities
│   ├── ai.ts          # Gemini extraction logic
│   ├── firebase.ts    # Admin SDK initialization
│   ├── webhook.ts     # HTTP dispatch with timeout
│   └── date-utils.ts  # ISO date calculations
└── models/
    └── schema.ts      # Zod schemas + ActionState types
```

---

## Key Design Decisions

### Server Actions with ActionState Pattern

All mutations return `ActionState<T>` instead of throwing:

```typescript
interface ActionState<T = unknown> {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
}
```

### Row-Level Security via userId

Every Sentinel is tagged with `userId` (user's email). All queries filter by this field, enforcing data isolation without Firestore security rules.

### Webhook Timeout Safety

`dispatchAlert()` uses `AbortController` with a 5-second timeout, preventing slow external services from blocking the batch job.

---

## Notification Orchestration (Make.com)

<img width="802" height="609" alt="image" src="https://github.com/user-attachments/assets/333997a4-b056-4601-987d-29bd5c1a8cda" />
<img width="1032" height="434" alt="image" src="https://github.com/user-attachments/assets/c4a887ea-5faf-422a-8195-a04e1f49d66d" />

_Serverless webhook orchestration layer handling multi-channel alert delivery._

**How it Works:**

1. **Webhook Receiver** :  The scenario triggers when LeaseSentinel's cron job dispatches a POST request containing the sentinel payload (`eventName`, `triggerDate`, `notificationMethod`, `notificationTarget`).

2. **Router Module** :  A conditional router parses the `notificationMethod` field and splits execution into three isolated branches, ensuring each notification type is processed independently without blocking.

3. **Slack Branch** :  Executes a custom HTTP request to Slack's `users.lookupByEmail` API to resolve the user ID from the target email, then posts a formatted Block Kit message to the resolved DM channel.

4. **SMS Branch (Twilio)** :  Connects to Twilio's Programmable Messaging API to deliver time-sensitive deadline alerts via SMS to the configured phone number.

5. **Email Branch (Gmail)** :  Handles SMTP delivery through Gmail's API with templated HTML formatting for professional, branded notifications.

**Architecture Benefits:**

- **Decoupled** :  Notification logic lives outside the Next.js runtime, enabling independent scaling and iteration
- **Fault-tolerant** :  Each branch executes in isolation; a Twilio outage doesn't block Slack delivery
- **Observable** :  Make.com provides execution history, retry logic, and error alerting out of the box

## Development

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
npm run test     # Vitest unit tests
npm run docs     # Generate TypeDoc documentation
```

---

## Tech Stack

| Layer         | Technology                          |
| ------------- | ----------------------------------- |
| Framework     | Next.js 16 (App Router)             |
| Auth          | NextAuth v5 + Google OAuth + Resend |
| Database      | Firebase Firestore                  |
| AI            | Google Gemini 1.5 Flash             |
| Validation    | Zod v4                              |
| Styling       | Tailwind CSS v4                     |
| Testing       | Vitest + React Testing Library      |
| Documentation | TypeDoc                             |
| Deployment    | Vercel                              |

---

## License

MIT
