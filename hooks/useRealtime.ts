import { useEffect } from "react";
import { pb } from "@/lib/pb";

export function useRealtime(
  myId?: string,
  activeId?: string,
  onMessage?: (msg: any) => void
) {
  useEffect(() => {
    if (!myId) return;

    pb.collection("messages").subscribe("*", (e) => {
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
    });

    return () =>
      pb.collection("messages").unsubscribe("*");
  }, [myId, activeId]);
}
