# LeaseSentinel

**AI-powered lease deadline monitoring with proactive webhook alerts.**

LeaseSentinel transforms natural language lease clauses into structured deadline trackers. Paste a lease clause, and Gemini AI extracts the critical date; when that date arrives, your configured webhook fires:Slack, Discord, CRM, or any HTTP endpoint.
<img width="1439" height="725" alt="image" src="https://github.com/user-attachments/assets/e22d2ea9-6e9d-4f24-91d4-1029b3cbbb77" />
<img width="1158" height="717" alt="image" src="https://github.com/user-attachments/assets/c9182d69-ca49-4741-832e-3d2f3cf37fad" />

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
