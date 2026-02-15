"use client";

import { useEffect, useState, useRef } from "react";
import PocketBase from "pocketbase";
import * as CryptoJS from "crypto-js";

/* ================= CONFIG ================= */

const PB_URL = process.env.NEXT_PUBLIC_PB_URL || "";

if (!PB_URL) {
  console.error("NEXT_PUBLIC_PB_URL is not defined");
}

const pb = new PocketBase(PB_URL);

const KEY1 = process.env.NEXT_PUBLIC_KEY1 || "";
const KEY2 = process.env.NEXT_PUBLIC_KEY2 || "";
const INTERNAL_APP_KEY = KEY1 + KEY2;

/* ================= COMPONENT ================= */

export default function ChatPage() {
  const [myUser, setMyUser] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [unreadMap, setUnreadMap] = useState<{ [key: string]: number }>({});

  const chatBoxRef = useRef<HTMLDivElement>(null);
  const currentChatKeyRef = useRef<string>("");

  /* ================= ENCRYPTION ================= */

  const encryptSalt = (raw: string) =>
    CryptoJS.AES.encrypt(raw, INTERNAL_APP_KEY).toString();

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
    return CryptoJS.SHA256(
      combined + salt + INTERNAL_APP_KEY
    ).toString();
  };

  /* ================= FRIENDS ================= */

  const loadFriends = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const records = await pb.collection("friends").getFullList({
        expand: "user,friend",
        filter: `user="${userId}" || friend="${userId}"`,
        sort: "-updated",
      });

      setFriends(records.filter((r) => r.status === "accepted"));
      setRequests(
        records.filter(
          (r) => r.status === "pending" && r.friend === userId
        )
      );
    } catch (err) {
      console.error("Load friends error:", err);
    }
  };

  /* ================= NOTIFICATION ================= */

  const setupNotifications = () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission();
    }
  };

  const triggerLocalNotification = (senderName: string) => {
    if (Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return;

    new Notification("Pesan Baru 🔒", {
      body: `Pesan baru dari ${senderName}`,
      icon: "/icon.png",
      tag: "new-message",
    });
  };

  /* ================= INIT ================= */

  useEffect(() => {
    if (!pb.authStore.isValid) {
      window.location.href = "/login";
      return;
    }

    setMyUser(pb.authStore.model);
    loadFriends();
    setupNotifications();

    pb.collection("friends").subscribe("*", loadFriends);

    return () => {
      pb.collection("friends").unsubscribe("*");
    };
  }, []);

  /* ================= GLOBAL MESSAGE LISTENER ================= */

  useEffect(() => {
    if (!myUser) return;

    const unsubscribe = pb
      .collection("messages")
      .subscribe("*", (e) => {
        if (e.action !== "create") return;

        const msg = e.record;
        if (msg.receiver !== myUser.id) return;

        const senderId = msg.sender;
        const isActive = activeChat?.id === senderId;

        if (isActive) {
          setMessages((prev) => [...prev, msg]);
        } else {
          setUnreadMap((prev) => ({
            ...prev,
            [senderId]: (prev[senderId] || 0) + 1,
          }));

          triggerLocalNotification("Teman");
        }
      });

    return () => {
      pb.collection("messages").unsubscribe("*");
    };
  }, [myUser, activeChat]);

  /* ================= CHAT ================= */

  const selectChat = async (friendRecord: any) => {
    if (!myUser) return;

    const friendData =
      friendRecord.user === myUser.id
        ? friendRecord.expand.friend
        : friendRecord.expand.user;

    const salt =
      decryptSalt(friendRecord.chat_salt) || "fallback-salt";

    const key = generateChatKey(
      myUser.id,
      friendData.id,
      salt
    );

    currentChatKeyRef.current = key;
    setActiveChat({ ...friendData, salt });

    setUnreadMap((prev) => ({
      ...prev,
      [friendData.id]: 0,
    }));

    const res = await pb.collection("messages").getFullList({
      filter: `(sender="${myUser.id}" && receiver="${friendData.id}") || (sender="${friendData.id}" && receiver="${myUser.id}")`,
      sort: "created",
    });

    setMessages(res);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat || !myUser) return;

    try {
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
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  /* ================= AUTO SCROLL ================= */

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop =
        chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  if (!myUser) {
    return (
      <div className="h-screen flex items-center justify-center">
        Initializing...
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="flex h-screen overflow-hidden">

      {/* SIDEBAR */}
      <aside className="w-80 border-r overflow-y-auto p-4 space-y-2">
        <h2 className="font-bold text-sm mb-2">
          Direct Messages
        </h2>

        {friends.map((f) => {
          const friendData =
            f.user === myUser.id
              ? f.expand.friend
              : f.expand.user;

          return (
            <button
              key={f.id}
              onClick={() => selectChat(f)}
              className="w-full text-left p-2 border rounded relative"
            >
              {friendData.name || friendData.email}

              {unreadMap[friendData.id] > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs px-2 rounded-full">
                  {unreadMap[friendData.id]}
                </span>
              )}
            </button>
          );
        })}
      </aside>

      {/* CHAT */}
      <main className="flex-1 flex flex-col">

        <div
          ref={chatBoxRef}
          className="flex-1 overflow-y-auto p-4 space-y-3"
        >
          {messages.map((msg) => {
            let plain = "";

            if (currentChatKeyRef.current) {
              try {
                const bytes = CryptoJS.AES.decrypt(
                  msg.text,
                  currentChatKeyRef.current
                );
                plain = bytes.toString(CryptoJS.enc.Utf8);
              } catch {}
            }

            const isMe = msg.sender === myUser.id;

            return (
              <div
                key={msg.id}
                className={isMe ? "text-right" : "text-left"}
              >
                <div className="inline-block px-3 py-2 border rounded">
                  {plain || "🔒 [Encrypted]"}
                </div>
              </div>
            );
          })}
        </div>

        {activeChat && (
          <form
            onSubmit={sendMessage}
            className="p-4 border-t flex gap-2"
          >
            <input
              value={inputText}
              onChange={(e) =>
                setInputText(e.target.value)
              }
              className="flex-1 border px-3 py-2 rounded"
              placeholder="Type message..."
            />
            <button className="px-4 border rounded">
              Send
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
