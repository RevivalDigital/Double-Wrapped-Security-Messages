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
  const [requests, setRequests] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);

  const chatBoxRef = useRef<HTMLDivElement>(null);
  const currentChatKeyRef = useRef<string>("");
  const activeChatRef = useRef<any>(null);

  // =========================
  // ENCRYPTION
  // =========================
  const encryptSalt = (raw: string) =>
    CryptoJS.AES.encrypt(raw, INTERNAL_APP_KEY).toString();

  const decryptSalt = (enc: string) => {
    try {
      const bytes = CryptoJS.AES.decrypt(enc, INTERNAL_APP_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      return null;
    }
  };

  const generateChatKey = (id1: string, id2: string, salt: string) => {
    const combined = [id1, id2].sort().join("");
    return CryptoJS.SHA256(combined + salt + INTERNAL_APP_KEY).toString();
  };

  // =========================
  // LOAD FRIENDS
  // =========================
  const loadFriends = async () => {
    const userId = pb.authStore.model?.id;
    if (!userId) return;

    const records = await pb.collection("friends").getFullList({
      expand: "user,friend",
      filter: `user="${userId}" || friend="${userId}"`,
    });

    setFriends(records.filter((r: any) => r.status === "accepted"));
    setRequests(
      records.filter(
        (r: any) => r.status === "pending" && r.friend === userId
      )
    );
  };

  // =========================
  // INIT
  // =========================
  useEffect(() => {
    if (!pb.authStore.isValid) {
      window.location.href = "/login";
      return;
    }

    setMyUser(pb.authStore.model);
    loadFriends();

    // CLEAN BEFORE SUBSCRIBE
    pb.collection("messages").unsubscribe();
    pb.collection("friends").unsubscribe();

    pb.collection("friends").subscribe("*", () => loadFriends());

    // GLOBAL MESSAGE REALTIME (ONCE ONLY)
    pb.collection("messages").subscribe("*", (e) => {
      if (e.action !== "create") return;

      const msg = e.record;
      const myId = pb.authStore.model?.id;
      if (!myId) return;

      const active = activeChatRef.current;

      const isRelevant =
        active &&
        ((msg.sender === myId && msg.receiver === active.id) ||
          (msg.sender === active.id && msg.receiver === myId));

      if (isRelevant) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }

      if (msg.receiver === myId && (!active || msg.sender !== active.id)) {
        setUnreadCounts((prev) => ({
          ...prev,
          [msg.sender]: (prev[msg.sender] || 0) + 1,
        }));
      }
    });

    return () => {
      pb.collection("messages").unsubscribe();
      pb.collection("friends").unsubscribe();
    };
  }, []);

  // =========================
  // SCROLL
  // =========================
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  // =========================
  // SELECT CHAT
  // =========================
  const selectChat = async (friendRecord: any) => {
    if (!myUser?.id) return;

    setMessages([]);
    setLoadingMessages(true);

    const friendData =
      friendRecord.user === myUser.id
        ? friendRecord.expand.friend
        : friendRecord.expand.user;

    const salt = decryptSalt(friendRecord.chat_salt) || "fallback";
    const key = generateChatKey(myUser.id, friendData.id, salt);

    currentChatKeyRef.current = key;
    activeChatRef.current = friendData;
    setActiveChat(friendData);

    setUnreadCounts((prev) => {
      const updated = { ...prev };
      delete updated[friendData.id];
      return updated;
    });

    const res = await pb.collection("messages").getList(1, 50, {
      filter: `(sender="${myUser.id}" && receiver="${friendData.id}") || (sender="${friendData.id}" && receiver="${myUser.id}")`,
      sort: "created",
      $autoCancel: false,
    });

    setMessages(res.items);
    setLoadingMessages(false);
  };

  // =========================
  // SEND MESSAGE
  // =========================
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

  if (!myUser)
    return (
      <div className="h-screen flex items-center justify-center">
        Initializing...
      </div>
    );

  return (
    <div className="flex h-screen">
      <aside className="w-72 border-r p-4 overflow-y-auto">
        <h2 className="font-bold mb-4">Friends</h2>
        {friends.map((f) => {
          const friendData =
            f.user === myUser.id ? f.expand.friend : f.expand.user;
          const unread = unreadCounts[friendData.id] || 0;

          return (
            <button
              key={f.id}
              onClick={() => selectChat(f)}
              className={`w-full text-left p-2 rounded mb-2 ${
                activeChat?.id === friendData.id
                  ? "bg-blue-200"
                  : "hover:bg-gray-100"
              }`}
            >
              {friendData.name || friendData.email}
              {unread > 0 && (
                <span className="ml-2 text-red-500 text-xs font-bold">
                  ({unread})
                </span>
              )}
            </button>
          );
        })}
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="border-b p-4 font-bold">
          {activeChat
            ? activeChat.name || activeChat.email
            : "Select a chat"}
        </div>

        <div
          ref={chatBoxRef}
          className="flex-1 overflow-y-auto p-4 space-y-3"
        >
          {loadingMessages ? (
            <div>Loading...</div>
          ) : (
            messages.map((msg) => {
              let plain = "";
              try {
                const bytes = CryptoJS.AES.decrypt(
                  msg.text,
                  currentChatKeyRef.current
                );
                plain = bytes.toString(CryptoJS.enc.Utf8);
              } catch {}

              const isMe = msg.sender === myUser.id;

              return (
                <div
                  key={msg.id}
                  className={`max-w-xs p-2 rounded text-white ${
                    isMe ? "bg-blue-500 ml-auto" : "bg-gray-500"
                  }`}
                >
                  {plain || "🔒 [Decrypt Error]"}
                </div>
              );
            })
          )}
        </div>

        {activeChat && (
          <form onSubmit={sendMessage} className="p-4 border-t flex">
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 border rounded p-2 mr-2"
              placeholder="Type message..."
            />
            <button className="bg-blue-500 text-white px-4 rounded">
              Send
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
