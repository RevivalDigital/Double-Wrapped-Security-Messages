import { useState } from "react";
import { pb } from "@/lib/pb";
import { cache } from "@/lib/cache";

export function useMessages(
  userId?: string,
  friendId?: string
) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!userId || !friendId) return;

    setLoading(true);

    const cached = cache.get(userId, friendId);
    if (cached?.data) setMessages(cached.data);

    const res = await pb.collection("messages").getList(
      1,
      50,
      {
        filter: `(sender="${userId}" && receiver="${friendId}") || (sender="${friendId}" && receiver="${userId}")`,
        sort: "-created",
      }
    );

    const fresh = res.items.reverse();
    setMessages(fresh);
    cache.set(userId, friendId, fresh);

    setLoading(false);
  };

  return { messages, setMessages, load, loading };
}
