import { useEffect, useState } from "react";
import { pb } from "@/lib/pb";

export function useFriends(userId?: string) {
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  const load = async () => {
    if (!userId) return;

    const records = await pb
      .collection("friends")
      .getFullList({
        expand: "user,friend",
        filter: `user="${userId}" || friend="${userId}"`,
        sort: "-updated",
      });

    setFriends(records.filter((r) => r.status === "accepted"));
    setRequests(
      records.filter(
        (r) =>
          r.status === "pending" &&
          r.friend === userId
      )
    );
  };

  useEffect(() => {
    load();
    pb.collection("friends").subscribe("*", load);
    return () =>
      pb.collection("friends").unsubscribe("*");
  }, [userId]);

  return { friends, requests, reload: load };
}
