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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);

  const chatBoxRef = useRef<HTMLDivElement>(null);
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

  // ================= LOAD NOTIFICATIONS =================

  const loadNotifications = async () => {
    try {
      const myId = pb.authStore.model?.id;
      if (!myId) return;

      const result = await pb.collection("notifications").getFullList({
        filter: `user="${myId}" && is_read=false`,
      });

      const grouped: Record<string, number> = {};
      result.forEach((n: any) => {
        grouped[n.sender] = (grouped[n.sender] || 0) + 1;
      });

      setUnreadCounts(grouped);
    } catch (err) {
      console.error("Load notification error:", err);
    }
  };

  // ================= LOAD FRIENDS =================

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
      console.error(err);
    }
  };

  // ================= REALTIME =================

  useEffect(() => {
    if (!pb.authStore.isValid) {
      window.location.href = "/login";
      return;
    }

    const init = async () => {
      setMyUser(pb.authStore.model);
      await loadFriends();
      await loadNotifications();
    };

    init();

    if ("Notification" in window) {
      Notification.requestPermission();
    }

    pb.collection("friends").subscribe("*", () => loadFriends());

    pb.collection("messages").subscribe("*", async (e) => {
      if (e.action !== "create") return;

      const msg = e.record;
      const myId = pb.authStore.model?.id;
      if (!myId) return;

      const isForMe = msg.receiver === myId;

      if (isForMe) {
        try {
          await pb.collection("notifications").create({
            user: myId,
            sender: msg.sender,
            title: "Pesan Baru",
            message: "Kamu menerima pesan baru",
            is_read: false,
            related_id: msg.id,
          });
        } catch (err) {
          console.error("Save notification error:", err);
        }

        await loadNotifications();
      }

      if (
        activeChat &&
        ((msg.sender === myId &&
          msg.receiver === activeChat.id) ||
          (msg.sender === activeChat.id &&
            msg.receiver === myId))
      ) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    pb.collection("notifications").subscribe("*", () =>
      loadNotifications()
    );

    return () => {
      pb.collection("friends").unsubscribe();
      pb.collection("messages").unsubscribe();
      pb.collection("notifications").unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (chatBoxRef.current)
      chatBoxRef.current.scrollTop =
        chatBoxRef.current.scrollHeight;
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

    if (!friendData) return;

    const salt =
      decryptSalt(friendRecord.chat_salt) || "fallback";
    const key = generateChatKey(
      myUser.id,
      friendData.id,
      salt
    );
    currentChatKeyRef.current = key;
    setActiveChat(friendData);

    const res = await pb.collection("messages").getFullList({
      filter: `(sender="${myUser.id}" && receiver="${friendData.id}") || (sender="${friendData.id}" && receiver="${myUser.id}")`,
      sort: "created",
    });

    setMessages(res);
    setLoadingMessages(false);

    await pb.collection("notifications").update(
      undefined,
      { is_read: true }
    );

    await loadNotifications();
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

  if (!myUser)
    return (
      <div className="h-screen flex items-center justify-center">
        Initializing...
      </div>
    );

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* SIDEBAR */}
      <aside className="w-80 border-r border-border flex flex-col">
        <div className="p-4 font-bold flex justify-between">
          Bitlab Chat
          <div className="relative">
            <button onClick={() => setShowNoti(!showNoti)}>
              🔔
            </button>
            {Object.values(unreadCounts).reduce(
              (a, b) => a + b,
              0
            ) > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 rounded-full">
                {Object.values(unreadCounts).reduce(
                  (a, b) => a + b,
                  0
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {friends.map((f) => {
            const friendData =
              f.user === myUser.id
                ? f.expand?.friend
                : f.expand?.user;

            if (!friendData) return null;

            return (
              <button
                key={f.id}
                onClick={() => selectChat(f)}
                className="w-full p-2 hover:bg-accent rounded text-left"
              >
                {friendData.name ||
                  friendData.username ||
                  friendData.email}
              </button>
            );
          })}
        </div>

        {/* PROFILE */}
        <div className="p-4 border-t border-border">
          <button
            onClick={() =>
              (window.location.href = "/profile")
            }
            className="w-full flex items-center gap-2"
          >
            {myUser.avatar ? (
              <img
                src={`${PB_URL}/api/files/_pb_users_auth_/${myUser.id}/${myUser.avatar}`}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-xs">
                {(myUser.name || "U")[0]}
              </div>
            )}
            <span>
              {myUser.name ||
                myUser.username ||
                myUser.email}
            </span>
          </button>
        </div>
      </aside>

      {/* CHAT */}
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
                  className={`px-4 py-2 rounded-xl ${
                    isMe
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border"
                  }`}
                >
                  <p>{plain}</p>
                  <span className="text-xs opacity-50">
                    {new Date(
                      msg.created
                    ).toLocaleTimeString([], {
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
              onChange={(e) =>
                setInputText(e.target.value)
              }
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
