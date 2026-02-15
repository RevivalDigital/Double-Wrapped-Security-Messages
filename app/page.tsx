"use client";

import { useEffect, useState, useRef } from "react";
import PocketBase from "pocketbase";
import * as CryptoJS from "crypto-js";

const PB_URL = process.env.NEXT_PUBLIC_PB_URL || "";
const pb = new PocketBase(PB_URL);

const KEY1 = process.env.NEXT_PUBLIC_KEY1 || "";
const KEY2 = process.env.NEXT_PUBLIC_KEY2 || "";
const INTERNAL_APP_KEY = KEY1 + KEY2;

export default function ChatPage() {
  const [myUser, setMyUser] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);

  const chatBoxRef = useRef<HTMLDivElement>(null);
  const currentChatKeyRef = useRef<string>("");

  // ================= ENCRYPTION =================

  const decryptSalt = (enc: string) => {
    if (!enc) return null;
    try {
      const bytes = CryptoJS.AES.decrypt(enc, INTERNAL_APP_KEY);
      return bytes.toString(CryptoJS.enc.Utf8) || null;
    } catch {
      return null;
    }
  };

  const generateChatKey = (id1: string, id2: string, salt: string) => {
    const combined = [id1, id2].sort().join("");
    return CryptoJS.SHA256(combined + salt + INTERNAL_APP_KEY).toString();
  };

  // ================= LOAD FRIENDS =================

  const loadFriends = async () => {
    const userId = pb.authStore.model?.id;
    if (!userId) return;

    const records = await pb.collection("friends").getFullList({
      expand: "user,friend",
      filter: `user="${userId}" || friend="${userId}"`,
      sort: "-updated",
    });

    const accepted = records.filter((r) => r.status === "accepted");
    setFriends(accepted);

    await loadUnreadCounts(accepted);
  };

  const loadUnreadCounts = async (friendRecords: any[]) => {
    const myId = pb.authStore.model?.id;
    if (!myId) return;

    const counts: Record<string, number> = {};

    for (const f of friendRecords) {
      const friendData =
        f.user === myId ? f.expand?.friend : f.expand?.user;

      const lastRead =
        f.user === myId ? f.last_read_user : f.last_read_friend;

      const filter = lastRead
        ? `sender="${friendData.id}" && receiver="${myId}" && created>"${lastRead}"`
        : `sender="${friendData.id}" && receiver="${myId}"`;

      const result = await pb.collection("messages").getList(1, 1, {
        filter,
      });

      if (result.totalItems > 0) {
        counts[friendData.id] = result.totalItems;
      }
    }

    setUnreadCounts(counts);
  };

  // ================= INIT + REALTIME =================

  useEffect(() => {
    if (!pb.authStore.isValid) {
      window.location.href = "/login";
      return;
    }

    setMyUser(pb.authStore.model);
    loadFriends();

    // 🔔 Request browser permission
    if ("Notification" in window) {
      Notification.requestPermission();
    }

    // Subscribe friends realtime
    pb.collection("friends").subscribe("*", loadFriends);

    // Subscribe messages realtime (ONLY ONCE)
    pb.collection("messages").subscribe("*", async (e) => {
      if (e.action !== "create") return;

      const msg = e.record;
      const myId = pb.authStore.model?.id;
      if (!myId) return;

      // Tambah ke chat aktif
      if (
        activeChat &&
        ((msg.sender === myId && msg.receiver === activeChat.id) ||
          (msg.sender === activeChat.id && msg.receiver === myId))
      ) {
        setMessages((prev) => [...prev, msg]);

        // Auto update last_read jika chat sedang dibuka
        const friendRecord = friends.find(
          (f) =>
            (f.user === myId && f.friend === activeChat.id) ||
            (f.friend === myId && f.user === activeChat.id)
        );

        if (friendRecord) {
          const isUserFirst = friendRecord.user === myId;
          await pb.collection("friends").update(friendRecord.id, {
            [isUserFirst ? "last_read_user" : "last_read_friend"]:
              new Date().toISOString(),
          });
        }
      }

      // 🔔 Browser notification jika tab tidak aktif
      if (msg.receiver === myId && document.hidden) {
        if (Notification.permission === "granted") {
          new Notification("Pesan Baru", {
            body: "Kamu menerima pesan baru",
          });
        }
      }

      loadFriends();
    });

    return () => {
      pb.collection("friends").unsubscribe();
      pb.collection("messages").unsubscribe();
    };
  }, []);

  // Auto scroll
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  // ================= SELECT CHAT =================

  const selectChat = async (friendRecord: any) => {
    if (!myUser?.id) return;

    setLoadingMessages(true);
    setMessages([]);

    const friendData =
      friendRecord.user === myUser.id
        ? friendRecord.expand?.friend
        : friendRecord.expand?.user;

    const salt = decryptSalt(friendRecord.chat_salt) || "fallback";

    const key = generateChatKey(myUser.id, friendData.id, salt);
    currentChatKeyRef.current = key;

    setActiveChat(friendData);

    const res = await pb.collection("messages").getFullList({
      filter: `(sender="${myUser.id}" && receiver="${friendData.id}") || (sender="${friendData.id}" && receiver="${myUser.id}")`,
      sort: "created",
    });

    setMessages(res);

    const isUserFirst = friendRecord.user === myUser.id;
    await pb.collection("friends").update(friendRecord.id, {
      [isUserFirst ? "last_read_user" : "last_read_friend"]:
        new Date().toISOString(),
    });

    setLoadingMessages(false);
    loadFriends();
  };

  // ================= SEND MESSAGE =================

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    const encrypted = CryptoJS.AES.encrypt(
      inputText.trim(),
      currentChatKeyRef.current
    ).toString();

    await pb.collection("messages").create({
      sender: myUser.id,
      receiver: activeChat.id,
      text: encrypted,
    });

    setInputText("");
  };

  if (!myUser) {
    return (
      <div className="h-screen flex items-center justify-center">
        Initializing...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* SIDEBAR */}
      <aside className="w-80 border-r border-border flex flex-col">
        <div className="p-4 font-bold">Bitlab Chat</div>

        <div className="flex-1 overflow-y-auto px-2">
          {friends.map((f) => {
            const friendData =
              f.user === myUser.id
                ? f.expand?.friend
                : f.expand?.user;

            const unread = unreadCounts[friendData?.id] || 0;

            return (
              <button
                key={f.id}
                onClick={() => selectChat(f)}
                className="w-full p-3 hover:bg-accent rounded text-left flex justify-between items-center"
              >
                <span>
                  {friendData.name ||
                    friendData.username ||
                    friendData.email}
                </span>

                {unread > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 rounded-full">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* PROFILE */}
        <div className="p-4 border-t border-border">
          <a
            href="/profile"
            className="flex items-center gap-3 hover:bg-accent p-2 rounded"
          >
            <div className="font-semibold">
              {myUser.name || myUser.username}
            </div>
          </a>
        </div>
      </aside>

      {/* CHAT AREA */}
      <main className="flex-1 flex flex-col">
        <div className="p-4 border-b border-border font-semibold">
          {activeChat
            ? activeChat.name || activeChat.email
            : "Select Chat"}
        </div>

        <div
          ref={chatBoxRef}
          className="flex-1 overflow-y-auto p-4 space-y-3"
        >
          {messages.map((msg) => {
            let plain = "";
            try {
              const bytes = CryptoJS.AES.decrypt(
                msg.text,
                currentChatKeyRef.current
              );
              plain =
                bytes.toString(CryptoJS.enc.Utf8) || "🔒 Error";
            } catch {
              plain = "🔒 Error";
            }

            const isMe = msg.sender === myUser.id;

            return (
              <div
                key={msg.id}
                className={`flex ${
                  isMe ? "justify-end" : "justify-start"
                }`}
              >
                <div className="px-4 py-2 rounded-xl bg-card border">
                  <p>{plain}</p>
                  <span className="text-xs opacity-50">
                    {new Date(msg.created).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {activeChat && (
          <form
            onSubmit={sendMessage}
            className="p-4 border-t border-border flex gap-2"
          >
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 border rounded px-4 py-2"
              placeholder="Type message..."
            />
            <button className="bg-primary text-white px-4 rounded">
              Send
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
