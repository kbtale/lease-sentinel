import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

// I use a cached reference to avoid re-initialization
let cachedDb: Firestore | null = null;

/**
 * Initializes or retrieves the Firebase Admin SDK app instance.
 * Uses singleton pattern to prevent connection leaks during Next.js hot-reload.
 * 
 * @returns The Firebase Admin App instance.
 * @throws Error if required environment variables are missing.
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

  // Private keys from environment variables have escaped newlines that must be converted
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
 * I use lazy initialization to prevent build-time errors when env vars aren't available.
 * 
 * @returns Firestore database instance.
 */
export function getAdminDb(): Firestore {
  if (!cachedDb) {
    const app = getFirebaseApp();
    cachedDb = getFirestore(app);
  }
  return cachedDb;
}
