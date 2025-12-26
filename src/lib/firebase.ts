import "server-only";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

/**
 * Cached Firestore instance to prevent connection leaks.
 * @internal
 */
let cachedDb: Firestore | null = null;

/**
 * Initializes or retrieves the Firebase Admin SDK app instance.
 * 
 * @summary Singleton factory for Firebase Admin app initialization.
 * @category Database
 * @internal
 * 
 * @remarks
 * Uses the singleton pattern to prevent connection leaks during Next.js hot-reload.
 * In development, Next.js re-executes modules on each file change. Without caching,
 * this would create multiple Firebase connections, eventually exhausting the
 * connection pool.
 * 
 * @returns The Firebase Admin App instance.
 * @throws Error if required environment variables are missing:
 *   - `FIREBASE_PROJECT_ID`
 *   - `FIREBASE_CLIENT_EMAIL`
 *   - `FIREBASE_PRIVATE_KEY`
 */
function getFirebaseApp(): App {
  const existingApps = getApps();

  if (existingApps.length > 0) {
    return existingApps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase environment variables. Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    );
  }

  const sanitizedPrivateKey = privateKey.replace(/\\n/g, "\n");

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: sanitizedPrivateKey,
    }),
  });
}

/**
 * Gets the Firestore database instance for server-side operations.
 * 
 * @summary Returns a cached Firestore client for database operations.
 * @category Database
 * 
 * @remarks
 * This function uses lazy initialization to prevent build-time errors when
 * environment variables aren't available (e.g., during `next build` in CI).
 * The Firestore instance is cached globally to ensure a single connection
 * is reused across all requests.
 * 
 * **Import Restriction**: This module is marked with `"server-only"` to prevent
 * accidental client-side imports, which would expose Firebase Admin credentials.
 * 
 * @returns Firestore database instance configured with Admin SDK credentials.
 * 
 * @example
 * ```typescript
 * // Server Action or API route
 * import { getAdminDb } from "@/lib/firebase";
 * 
 * const db = getAdminDb();
 * const snapshot = await db.collection("sentinels").get();
 * ```
 * 
 * @see {@link createSentinel} for usage in Server Actions.
 * @see {@link getSentinels} for read operations.
 */
export function getAdminDb(): Firestore {
  if (!cachedDb) {
    const app = getFirebaseApp();
    cachedDb = getFirestore(app);
  }
  return cachedDb;
}
