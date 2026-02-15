import { useState, useCallback } from "react";
import { pb } from "@/lib/pb";
import { cache } from "@/lib/cache";

export function useMessages(
  userId?: string,
  friendId?: string
) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !friendId) return;

    setLoading(true);

    try {
      // 1️⃣ Load cache first
      const cached = cache.get(userId, friendId);
      if (cached?.data) {
        setMessages(cached.data);
      }

      // 2️⃣ Fetch fresh data
      const res = await pb.collection("messages").getList(1, 50, {
        filter: `(sender="${userId}" && receiver="${friendId}") || (sender="${friendId}" && receiver="${userId}")`,
        sort: "-created",
      });

      const fresh = res.items.reverse();

      setMessages(fresh);
      cache.set(userId, friendId, fresh);
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, friendId]);

  return {
    messages,
    setMessages,
    load,
    loading,
  };
}
