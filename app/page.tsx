"use client";

import { useEffect, useState } from "react";
import PocketBase from "pocketbase";
import { Bell, Send } from "lucide-react";

const pb = new PocketBase(process.env.NEXT_PUBLIC_PB_URL);

export default function ChatPage() {
  const [myUser, setMyUser] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);

  // ===============================
  // INIT
  // ===============================

  useEffect(() => {
    if (!pb.authStore.isValid) {
      window.location.href = "/login";
      return;
    }

    setMyUser(pb.authStore.model);
    loadFriends();
    loadNotifications();

    if ("Notification" in window) {
      Notification.requestPermission();
    }

    // Friends realtime
    pb.collection("friends").subscribe("*", () => {
      loadFriends();
    });

    // Messages realtime
    pb.collection("messages").subscribe("*", async (e) => {
      if (e.action !== "create") return;

      const msg = e.record;
      const myId = pb.authStore.model?.id;
      if (!myId) return;

      // Kalau pesan untuk saya
      if (msg.receiver === myId && msg.sender !== myId) {
        await pb.collection("notifications").create({
          user: myId,
          type: "message",
          title: "Pesan Baru",
          message: "Kamu menerima pesan baru",
          is_read: false,
          related_id: msg.id,
        });

        if (Notification.permission === "granted") {
          new Notification("Pesan Baru", {
            body: "Kamu menerima pesan baru",
          });
        }
      }

      // Update chat aktif
      if (
        activeChat &&
        ((msg.sender === myId && msg.receiver === activeChat.id) ||
          (msg.receiver === myId && msg.sender === activeChat.id))
      ) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    // Notifications realtime
    pb.collection("notifications").subscribe("*", (e) => {
      if (e.record.user === pb.authStore.model?.id) {
        loadNotifications();
      }
    });

    return () => {
      pb.collection("friends").unsubscribe();
      pb.collection("messages").unsubscribe();
      pb.collection("notifications").unsubscribe();
    };
  }, [activeChat]);

  // ===============================
  // LOADERS
  // ===============================

  const loadFriends = async () => {
    const user = pb.authStore.model;
    if (!user) return;

    const res = await pb.collection("friends").getFullList({
      filter: `user="${user.id}"`,
      expand: "friend",
    });

    setFriends(res);
  };

  const loadMessages = async (friendId: string) => {
    const myId = pb.authStore.model?.id;
    if (!myId) return;

    const res = await pb.collection("messages").getFullList({
      filter: `(sender="${myId}" && receiver="${friendId}") || (sender="${friendId}" && receiver="${myId}")`,
      sort: "created",
    });

    setMessages(res);
  };

  const loadNotifications = async () => {
    const user = pb.authStore.model;
    if (!user) return;

    const res = await pb.collection("notifications").getFullList({
      filter: `user="${user.id}"`,
      sort: "-created",
    });

    setNotifications(res);
    setUnreadCount(res.filter((n) => !n.is_read).length);
  };

  // ===============================
  // SEND MESSAGE
  // ===============================

  const sendMessage = async () => {
    if (!text.trim() || !activeChat) return;

    const myId = pb.authStore.model?.id;

    await pb.collection("messages").create({
      sender: myId,
      receiver: activeChat.id,
      content: text,
    });

    setText("");
  };

  // ===============================
  // UI
  // ===============================

  return (
    <div className="flex h-screen bg-[#020817] text-white">

      {/* SIDEBAR */}
      <div className="w-72 border-r border-gray-800 flex flex-col">

        <div className="p-4 font-bold text-lg">BITLAB CHAT</div>

        <div className="flex-1 overflow-y-auto">
          {friends.map((f) => (
            <div
              key={f.id}
              onClick={() => {
                setActiveChat(f.expand.friend);
                loadMessages(f.expand.friend.id);
              }}
              className="p-4 cursor-pointer hover:bg-gray-800"
            >
              {f.expand.friend.username}
            </div>
          ))}
        </div>

        {/* PROFILE */}
        <div className="border-t border-gray-800 p-4">
          <p className="font-semibold">{myUser?.username}</p>
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
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col relative">

        {/* HEADER */}
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <div className="font-semibold">
            {activeChat ? activeChat.username : "Pilih Chat"}
          </div>

          <div className="relative">
            <Bell
              className="w-5 h-5 cursor-pointer"
              onClick={() => setShowNotif(!showNotif)}
            />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-xs px-2 rounded-full">
                {unreadCount}
              </span>
            )}

            {showNotif && (
              <div className="absolute right-0 top-8 w-72 bg-[#0f172a] border border-gray-700 rounded-lg p-3 z-50">
                {notifications.length === 0 && (
                  <p className="text-sm text-gray-400">
                    Tidak ada notifikasi
                  </p>
                )}

                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-2 rounded-md mb-2 cursor-pointer ${
                      n.is_read ? "" : "bg-gray-800"
                    }`}
                    onClick={async () => {
                      await pb.collection("notifications").update(n.id, {
                        is_read: true,
                      });
                      loadNotifications();
                    }}
                  >
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="text-xs text-gray-400">{n.message}</p>
                    <p className="text-[10px] text-gray-500">
                      {new Date(n.created).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => {
            const isMe = msg.sender === myUser?.id;

            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-xl ${
                    isMe ? "bg-blue-600" : "bg-gray-800"
                  }`}
                >
                  <p>{msg.content}</p>
                  <div className="text-xs text-gray-300 mt-1 text-right">
                    {new Date(msg.created).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* INPUT */}
        {activeChat && (
          <div className="p-4 border-t border-gray-800 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type an encrypted message..."
              className="flex-1 bg-[#0f172a] border border-gray-700 rounded-full px-4 py-2 outline-none"
            />
            <button
              onClick={sendMessage}
              className="bg-blue-600 p-2 rounded-full"
            >
              <Send size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
