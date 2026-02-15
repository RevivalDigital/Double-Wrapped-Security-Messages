"use client";

import { useEffect, useState, useRef } from "react";
import { pb } from "@/lib/pb";
import CryptoJS from "crypto-js";

interface Friend {
  id: string;
  friend: string;
  expand?: any;
}

interface Message {
  id: string;
  sender: string;
  receiver: string;
  text: string;
  created: string;
}

interface ActiveChat {
  id: string;
  username: string;
  chatKey: string;
}

export default function ChatPage() {
  const myId = pb.authStore.model?.id;

  const [friends, setFriends] = useState<Friend[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // =========================
  // LOAD FRIENDS
  // =========================
  useEffect(() => {
    if (!myId) return;

    const loadFriends = async () => {
      const res = await pb.collection("friends").getFullList({
        filter: `user="${myId}"`,
        expand: "friend",
      });
      setFriends(res as any);
    };

    loadFriends();
  }, [myId]);

  // =========================
  // REALTIME SUBSCRIBE (GLOBAL)
  // =========================
  useEffect(() => {
    if (!myId) return;

    pb.collection("messages").subscribe(
      `receiver="${myId}" || sender="${myId}"`,
      (e) => {
        if (e.action !== "create") return;

        const msg = e.record as Message;

        setMessages((prev) => {
          if (!activeChat) return prev;

          const isRelevant =
            (msg.sender === myId && msg.receiver === activeChat.id) ||
            (msg.sender === activeChat.id && msg.receiver === myId);

          if (!isRelevant) return prev;

          return [...prev, msg];
        });
      }
    );

    return () => {
      pb.collection("messages").unsubscribe();
    };
  }, [myId, activeChat]);

  // =========================
  // LOAD MESSAGES PER CHAT
  // =========================
  const loadMessages = async (friendId: string) => {
    if (!myId) return;

    setLoadingMessages(true);
    setMessages([]);

    const res = await pb.collection("messages").getList(1, 100, {
      filter: `(sender="${myId}" && receiver="${friendId}") || (sender="${friendId}" && receiver="${myId}")`,
      sort: "created",
    });

    setMessages(res.items as any);
    setLoadingMessages(false);
  };

  // =========================
  // SELECT CHAT
  // =========================
  const selectChat = async (friend: Friend) => {
    const friendId = friend.expand?.friend?.id;
    const username = friend.expand?.friend?.username;

    if (!friendId) return;

    // Generate deterministic chat key
    const salt = [myId, friendId].sort().join(":");
    const chatKey = CryptoJS.SHA256(salt).toString();

    setActiveChat({
      id: friendId,
      username,
      chatKey,
    });

    await loadMessages(friendId);
  };

  // =========================
  // SEND MESSAGE (E2EE)
  // =========================
  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChat || !myId) return;

    const encrypted = CryptoJS.AES.encrypt(
      newMessage,
      activeChat.chatKey
    ).toString();

    await pb.collection("messages").create({
      sender: myId,
      receiver: activeChat.id,
      text: encrypted,
    });

    setNewMessage("");
  };

  // =========================
  // AUTO SCROLL
  // =========================
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // =========================
  // RENDER
  // =========================
  return (
    <div className="flex h-screen">

      {/* FRIEND LIST */}
      <div className="w-1/4 border-r p-4 overflow-y-auto">
        <h2 className="font-bold mb-4">Friends</h2>
        {friends.map((f) => (
          <div
            key={f.id}
            onClick={() => selectChat(f)}
            className={`p-2 cursor-pointer rounded ${
              activeChat?.id === f.expand?.friend?.id
                ? "bg-blue-200"
                : "hover:bg-gray-100"
            }`}
          >
            {f.expand?.friend?.username}
          </div>
        ))}
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col">

        {/* HEADER */}
        <div className="p-4 border-b font-bold">
          {activeChat ? activeChat.username : "Select a chat"}
        </div>

        {/* MESSAGES */}
        <div className="flex-1 p-4 overflow-y-auto space-y-2">
          {loadingMessages && <div>Loading...</div>}

          {messages.map((msg) => {
            let plainText = "";

            try {
              const bytes = CryptoJS.AES.decrypt(
                msg.text,
                activeChat?.chatKey || ""
              );
              plainText = bytes.toString(CryptoJS.enc.Utf8);
            } catch {
              plainText = "[Decrypt error]";
            }

            const isMine = msg.sender === myId;

            return (
              <div
                key={msg.id}
                className={`max-w-xs p-2 rounded text-white ${
                  isMine ? "bg-blue-500 ml-auto" : "bg-gray-500"
                }`}
              >
                {plainText || "[Invalid message]"}
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {/* INPUT */}
        {activeChat && (
          <div className="p-4 border-t flex">
            <input
              className="flex-1 border rounded p-2 mr-2"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type message..."
            />
            <button
              onClick={sendMessage}
              className="bg-blue-500 text-white px-4 rounded"
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
