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
  const [searchId, setSearchId] = useState("");
  const [showNoti, setShowNoti] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const chatBoxRef = useRef<HTMLDivElement>(null);
  const activeChatRef = useRef<any>(null);
  const currentChatKeyRef = useRef<string>("");

  // ================= ENCRYPTION =================

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

  // ================= LOAD FRIENDS =================

  const loadFriends = async () => {
    const myId = pb.authStore.model?.id;
    if (!myId) return;

    const records = await pb.collection("friends").getFullList({
      expand: "user,friend",
      filter: `user="${myId}" || friend="${myId}"`,
      sort: "-updated",
    });

    setFriends(records.filter((r) => r.status === "accepted"));
    setRequests(
      records.filter(
        (r) => r.status === "pending" && r.friend === myId
      )
    );
  };

  // ================= LOAD MESSAGES =================

  const loadMessages = async (friendRecord: any) => {
    if (!myUser) return;

    const friendData =
      friendRecord.user === myUser.id
        ? friendRecord.expand.friend
        : friendRecord.expand.user;

    const salt =
      decryptSalt(friendRecord.chat_salt) || "fallback";

    const key = generateChatKey(
      myUser.id,
      friendData.id,
      salt
    );

    currentChatKeyRef.current = key;
    activeChatRef.current = friendData;
    setActiveChat(friendData);

    const res = await pb.collection("messages").getFullList({
      filter: `(sender="${myUser.id}" && receiver="${friendData.id}") || (sender="${friendData.id}" && receiver="${myUser.id}")`,
      sort: "created",
    });

    setMessages(res);

    // reset unread count
    setUnreadCounts((prev) => {
      const copy = { ...prev };
      delete copy[friendData.id];
      return copy;
    });
  };

  // ================= SEND MESSAGE =================

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatRef.current) return;

    const encrypted = CryptoJS.AES.encrypt(
      inputText.trim(),
      currentChatKeyRef.current
    ).toString();

    await pb.collection("messages").create({
      sender: myUser.id,
      receiver: activeChatRef.current.id,
      text: encrypted,
    });

    setInputText("");
  };

  // ================= REALTIME INIT (ONCE ONLY) =================

  useEffect(() => {
    if (!pb.authStore.isValid) {
      window.location.href = "/login";
      return;
    }

    const user = pb.authStore.model;
    setMyUser(user);
    loadFriends();

    if ("Notification" in window) {
      Notification.requestPermission();
    }

    pb.collection("friends").subscribe("*", () => {
      loadFriends();
    });

    pb.collection("messages").subscribe("*", async (e) => {
      if (e.action !== "create") return;

      const msg = e.record;
      const myId = pb.authStore.model?.id;
      if (!myId) return;

      const active = activeChatRef.current;

      const isRelevant =
        active &&
        ((msg.sender === myId &&
          msg.receiver === active.id) ||
          (msg.sender === active.id &&
            msg.receiver === myId));

      if (isRelevant) {
        setMessages((prev) => [...prev, msg]);
      }

      if (
        msg.receiver === myId &&
        (!active || msg.sender !== active.id)
      ) {
        setUnreadCounts((prev) => ({
          ...prev,
          [msg.sender]: (prev[msg.sender] || 0) + 1,
        }));

        if (Notification.permission === "granted") {
          new Notification("Pesan Baru", {
            body: "Pesan rahasia baru",
          });
        }
      }
    });

    return () => {
      pb.collection("friends").unsubscribe();
      pb.collection("messages").unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (chatBoxRef.current)
      chatBoxRef.current.scrollTop =
        chatBoxRef.current.scrollHeight;
  }, [messages]);

  // ================= UI =================

  if (!myUser)
    return (
      <div className="h-screen flex items-center justify-center">
        Initializing...
      </div>
    );

  return (
    <div className="flex h-screen bg-black text-white">
      {/* SIDEBAR */}
      <aside className="w-80 border-r border-gray-800 flex flex-col">
        <div className="p-4 font-bold">Bitlab Chat</div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {friends.map((f) => {
            const friendData =
              f.user === myUser.id
                ? f.expand?.friend
                : f.expand?.user;

            const unread = unreadCounts[friendData?.id] || 0;

            return (
              <button
                key={f.id}
                onClick={() => loadMessages(f)}
                className="w-full p-2 flex justify-between hover:bg-gray-800 rounded"
              >
                <span>
                  {friendData?.name ||
                    friendData?.username ||
                    friendData?.email}
                </span>
                {unread > 0 && (
                  <span className="bg-red-500 text-xs px-2 rounded-full">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* PROFILE */}
        <div className="p-4 border-t border-gray-800">
          <p className="font-semibold">
            {myUser.username || myUser.email}
          </p>
          <button
            className="text-red-400 text-sm mt-1"
            onClick={() => {
              pb.authStore.clear();
              window.location.href = "/login";
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* CHAT AREA */}
      <main className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-800 font-semibold">
          {activeChat
            ? activeChat.name || activeChat.email
            : "Pilih Chat"}
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
                bytes.toString(CryptoJS.enc.Utf8) ||
                "🔒 Decrypt Error";
            } catch {
              plain = "🔒 Decrypt Error";
            }

            const isMe = msg.sender === myUser.id;

            return (
              <div
                key={msg.id}
                className={`flex ${
                  isMe ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-xl ${
                    isMe
                      ? "bg-blue-600"
                      : "bg-gray-800"
                  }`}
                >
                  <p>{plain}</p>
                  <div className="text-xs text-gray-300 mt-1 text-right">
                    {new Date(
                      msg.created
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {activeChat && (
          <form
            onSubmit={sendMessage}
            className="p-4 border-t border-gray-800 flex gap-2"
          >
            <input
              value={inputText}
              onChange={(e) =>
                setInputText(e.target.value)
              }
              className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-4 py-2"
              placeholder="Type message..."
            />
            <button className="bg-blue-600 px-4 rounded-full">
              Send
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
