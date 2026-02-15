"use client";

import { useEffect, useRef, useState } from "react";
import { pb } from "@/lib/pb";
import {
  decryptSalt,
  generateChatKey,
  encryptMessage,
  decryptMessage,
} from "@/lib/crypto";
import { useFriends } from "@/hooks/useFriends";
import { useMessages } from "@/hooks/useMessages";
import { useRealtime } from "@/hooks/useRealtime";

export default function ChatPage() {
  const [myUser, setMyUser] = useState<any>(null);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [chatKey, setChatKey] = useState("");
  const [input, setInput] = useState("");

  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      window.location.href = "/login";
      return;
    }
    setMyUser(pb.authStore.model);
  }, []);

  const { friends } = useFriends(myUser?.id);

  const {
    messages,
    setMessages,
    load,
  } = useMessages(myUser?.id, activeChat?.id);

  useRealtime(
    myUser?.id,
    activeChat?.id,
    (msg) =>
      setMessages((prev) => [...prev, msg])
  );

  const selectChat = async (record: any) => {
    const friend =
      record.user === myUser.id
        ? record.expand.friend
        : record.expand.user;

    const salt =
      decryptSalt(record.chat_salt) || "fallback";

    setChatKey(
      generateChatKey(
        myUser.id,
        friend.id,
        salt
      )
    );

    setActiveChat(friend);
    await load();
  };

  const send = async (e: any) => {
    e.preventDefault();
    if (!input.trim()) return;

    await pb.collection("messages").create({
      sender: myUser.id,
      receiver: activeChat.id,
      text: encryptMessage(input, chatKey),
    });

    setInput("");
  };

  if (!myUser) return <div>Loading...</div>;

  return (
    <div className="flex h-screen">

      {/* Sidebar */}
      <aside className="w-80 border-r p-4">
        {friends.map((f) => {
          const friend =
            f.user === myUser.id
              ? f.expand.friend
              : f.expand.user;

          return (
            <button
              key={f.id}
              onClick={() => selectChat(f)}
              className="block w-full text-left p-2"
            >
              {friend.name || friend.email}
            </button>
          );
        })}
      </aside>

      {/* Chat */}
      <main className="flex-1 flex flex-col">
        <div
          ref={chatRef}
          className="flex-1 p-4 overflow-y-auto"
        >
          {messages.map((m) => (
            <div key={m.id}>
              {decryptMessage(m.text, chatKey) ||
                "🔒 Error"}
            </div>
          ))}
        </div>

        {activeChat && (
          <form
            onSubmit={send}
            className="p-4 border-t flex gap-2"
          >
            <input
              value={input}
              onChange={(e) =>
                setInput(e.target.value)
              }
              className="flex-1 border p-2"
            />
            <button>Send</button>
          </form>
        )}
      </main>
    </div>
  );
}
