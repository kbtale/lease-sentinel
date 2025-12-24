"use server";

import { getAdminDb } from "@/lib/firebase";
import { Sentinel } from "@/models/schema";

/**
 * Fetches all sentinels from Firestore, ordered by creation date (newest first).
 * I serialize Firestore Timestamps to ISO strings to ensure compatibility with Client Components.
 * 
 * @returns Promise resolving to array of Sentinel objects, or empty array on error.
 */
export async function getSentinels(): Promise<Sentinel[]> {
  try {
    const snapshot = await getAdminDb()
      .collection("sentinels")
      .orderBy("createdAt", "desc")
      .get();

    // I convert Firestore documents to plain JSON-compatible objects
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
