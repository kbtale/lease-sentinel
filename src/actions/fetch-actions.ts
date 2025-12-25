"use server";

import { getAdminDb } from "@/lib/firebase";
import { Sentinel } from "@/models/schema";
import { auth } from "@/auth";

/**
 * Fetches sentinels for the current user, ordered by creation date (newest first).
 * I filter by userId to enforce Row-Level Security - users only see their own data.
 * 
 * @returns Promise resolving to array of Sentinel objects, or empty array on error.
 */
export async function getSentinels(): Promise<Sentinel[]> {
  try {
    // Auth check - I enforce authentication for data isolation
    const session = await auth();
    if (!session?.user?.email) {
      return [];
    }

    // Filter by userId to enforce Row-Level Security
    const snapshot = await getAdminDb()
      .collection("sentinels")
      .where("userId", "==", session.user.email)
      .orderBy("createdAt", "desc")
      .get();

    // Convert Firestore documents to plain JSON-compatible objects
    // because Firestore Timestamps cannot be passed directly to Client Components
    const sentinels: Sentinel[] = snapshot.docs.map((doc) => {
      const data = doc.data();

      // Convert Firestore Timestamp to ISO string if present
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
        webhookUrl: data.webhookUrl as string,
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
