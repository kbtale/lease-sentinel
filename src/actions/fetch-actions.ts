"use server";

import { getAdminDb } from "@/lib/firebase";
import { Sentinel } from "@/models/schema";
import { auth } from "@/auth";

/**
 * Fetches all sentinels for the authenticated user.
 * 
 * @summary Retrieves user's sentinels from Firestore with RLS filtering.
 * @category Server Actions
 * 
 * @security
 * **Authentication Required**: Returns empty array for unauthenticated requests.
 * 
 * **Row-Level Security**: Queries are filtered by `userId` (user's email) to ensure
 * users can only access their own sentinels. This filtering happens at the database
 * query level, not post-fetch, for efficiency and security.
 * 
 * @remarks
 * This function handles Firestore-specific serialization internally:
 * - Converts Firestore `Timestamp` objects to JavaScript `Date` objects
 * - Ensures all returned data is JSON-serializable for React Server Components
 * 
 * Results are ordered by `createdAt` descending (newest first).
 * 
 * @returns Promise resolving to array of {@link Sentinel} objects belonging to the
 *   current user, or empty array if:
 *   - User is not authenticated
 *   - No sentinels exist
 *   - Database error occurs
 * 
 * @example
 * ```tsx
 * // Server Component usage
 * import { getSentinels } from "@/actions/fetch-actions";
 * 
 * export default async function Dashboard() {
 *   const sentinels = await getSentinels();
 * 
 *   return (
 *     <ul>
 *       {sentinels.map((s) => (
 *         <li key={s.id}>{s.eventName} - {s.triggerDate}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 * 
 * @see {@link Sentinel} for the returned entity structure.
 * @see {@link createSentinel} for creating new sentinels.
 */
export async function getSentinels(): Promise<Sentinel[]> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return [];
    }

    const snapshot = await getAdminDb()
      .collection("sentinels")
      .where("userId", "==", session.user.email)
      .orderBy("createdAt", "desc")
      .get();

    const sentinels: Sentinel[] = snapshot.docs.map((doc) => {
      const data = doc.data();

      let createdAt: Date;
      if (data.createdAt && typeof data.createdAt.toDate === "function") {
        createdAt = data.createdAt.toDate();
      } else if (data.createdAt instanceof Date) {
        createdAt = data.createdAt;
      } else {
        createdAt = new Date();
      }

      return {
        id: doc.id,
        userId: data.userId as string,
        eventName: data.eventName as string,
        triggerDate: data.triggerDate as string,
        originalClause: data.originalClause as string,
        webhookUrl: data.webhookUrl as string | undefined,
        notificationMethod: (data.notificationMethod || "custom") as "slack" | "teams" | "email" | "sms" | "custom",
        notificationTarget: (data.notificationTarget || data.webhookUrl || "") as string,
        status: data.status as "PENDING" | "FIRED",
        createdAt: createdAt,
      };
    });

    return sentinels;
  } catch (error) {
    console.error("Failed to fetch sentinels:", error);
    return [];
  }
}
