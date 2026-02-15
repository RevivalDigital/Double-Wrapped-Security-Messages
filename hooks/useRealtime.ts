import { useEffect } from "react";
import { pb } from "@/lib/pb";

export function useRealtime(
  myId?: string,
  activeId?: string,
  onMessage?: (msg: any) => void
) {
  useEffect(() => {
    if (!myId) return;

    const handleMessage = (e: any) => {
      if (e.action !== "create") return;

      const msg = e.record;

      const relevant =
        activeId &&
        (
          (msg.sender === myId &&
            msg.receiver === activeId) ||
          (msg.sender === activeId &&
            msg.receiver === myId)
        );

      if (relevant && onMessage) {
        onMessage(msg);
      }
    };

    pb.collection("messages").subscribe("*", handleMessage);

    return () => {
      // 🔥 DO NOT return Promise
      pb.collection("messages")
        .unsubscribe("*")
        .catch(() => {});
    };
  }, [myId, activeId, onMessage]);
}
