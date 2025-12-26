# LeaseSentinel Internal API

> **AI-powered lease deadline monitoring with proactive webhook alerts.**

This documentation site provides searchable, interactive access to LeaseSentinel's internal API. Use the **search bar** to find functions, types, and implementation details—including comments explaining _why_ decisions were made.

---

## System Architecture

LeaseSentinel follows a **Deep Module** design philosophy: each module has a simple interface but encapsulates significant complexity internally.

![Architecture Diagram](/architecture.png)

---

## Module Overview

### Server Actions (`src/actions/`)

The **command interface** for the application. All mutations flow through here.

| Action           | Purpose                                            |
| ---------------- | -------------------------------------------------- |
| `createSentinel` | Validate input → AI extraction → Firestore persist |
| `deleteSentinel` | Auth check → Ownership verification → Delete       |
| `fetchSentinels` | RLS-filtered read of user's sentinels              |

**Search tips**: Use `@category:Server Actions` to filter results.

---

### AI Extraction (`src/lib/ai.ts`)

Encapsulates all Gemini API interactions. Transforms natural language lease clauses into structured `{ eventName, triggerDate }` objects.

**Key function**: `extractLeaseData`

---

### Auth Configuration (`src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`)

Implements the **Dual-Auth pattern** for Edge/Node.js runtime compatibility:

- `auth.config.ts` → Edge-safe config (Google OAuth only, no adapters)
- `auth.ts` → Full config with Firestore adapter + Resend Magic Link (Node.js only)
- `proxy.ts` → Middleware handling public routes (`/login`, `/api-docs`) and protected routes

**Providers:**

- Google OAuth — Standard social login
- Resend Magic Link — Passwordless email authentication (requires database adapter)

**Search tips**: Use `@category:Auth Configuration` to explore authentication logic.

---

### Database Schemas (`src/models/schema.ts`)

Zod schemas that define the **single source of truth** for all domain types:

- `SentinelSchema` → Core deadline entity
- `LogSchema` → Webhook dispatch audit log
- `ActionState` → Standardized Server Action responses

---

### Webhook Dispatcher (`src/lib/webhook.ts`)

Handles external HTTP notifications with timeout safety.

**Key function**: `dispatchAlert` — 5-second AbortController timeout prevents slow webhooks from blocking batch jobs.

---

## Searching the Docs

This site indexes **comments and documents**, not just symbol names. You can search for:

- Function names: `createSentinel`
- Concepts: `Row-Level Security`
- Categories: `Server Actions`
- Patterns: `ActionState`

---

## Quick Links

- **Server Actions** — All mutation functions
- **Schemas** — Zod type definitions
- **AI Module** — Gemini extraction logic
- **Auth** — NextAuth configuration

---

## Contributing to Docs

When adding new functions, use the semantic JSDoc template:

```typescript
/**
 * @summary One-sentence high-level intent.
 * @category Server Actions
 * @security Describe auth/RLS requirements.
 *
 * @param input - Description with schema reference.
 * @returns ActionState<ReturnType>
 *
 * @example
 * // Client component usage
 * const [state, action] = useActionState(myFunction, null);
 */
```

This ensures your documentation is **searchable** and **categorized** correctly.
