"use client";

import { useEffect, useState, useRef } from 'react';
import PocketBase from 'pocketbase';
import * as CryptoJS from 'crypto-js';

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
    
    const chatBoxRef = useRef<HTMLDivElement>(null);
    const currentChatKeyRef = useRef<string>("");

    // --- HELPER ENCRYPTION ---
    const decryptSalt = (enc: string) => {
        if (!enc) return null;
        try {
            const bytes = CryptoJS.AES.decrypt(enc, INTERNAL_APP_KEY);
            return bytes.toString(CryptoJS.enc.Utf8) || null; 
        } catch (e) { return null; }
    };

    const generateChatKey = (id1: string, id2: string, salt: string) => {
        const combined = [id1, id2].sort().join("");
        return CryptoJS.SHA256(combined + salt + INTERNAL_APP_KEY).toString();
    };

    // --- NOTIFICATION ENGINE ---
    const triggerLocalNotification = (senderName: string) => {
        if (Notification.permission === "granted") {
            new Notification(`Pesan dari ${senderName}`, {
                body: "Klik untuk membuka pesan rahasia",
                icon: "/icon.png"
            });
        }
    };

    // --- LOGIC FUNCTIONS ---
    const loadFriends = async () => {
        try {
            const userId = pb.authStore.model?.id;
            const records = await pb.collection('friends').getFullList({
                expand: 'user,friend',
                filter: `user = "${userId}" || friend = "${userId}"`,
                sort: '-updated'
            });
            setFriends(records.filter(r => r.status === 'accepted'));
            setRequests(records.filter(r => r.status === 'pending' && r.friend === userId));
        } catch (err) { console.error(err); }
    };

    const loadMessages = async (friendId: string) => {
        const res = await pb.collection('messages').getFullList({
            filter: `(sender="${pb.authStore.model?.id}" && receiver="${friendId}") || (sender="${friendId}" && receiver="${pb.authStore.model?.id}")`,
            sort: 'created'
        });
        setMessages(res);
    };

    const selectChat = async (friendRecord: any) => {
        const friendData = friendRecord.user === myUser.id ? friendRecord.expand.friend : friendRecord.expand.user;
        const salt = decryptSalt(friendRecord.chat_salt) || "fallback";
        const key = generateChatKey(myUser.id, friendData.id, salt);
        
        currentChatKeyRef.current = key;
        setActiveChat({ ...friendData, salt });
        loadMessages(friendData.id);
        
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    // --- REALTIME SUBSCRIPTIONS ---
    useEffect(() => {
        if (!pb.authStore.isValid) { window.location.href = "/login"; return; }
        setMyUser(pb.authStore.model);
        loadFriends();

        // 1. Listen for Friends/Requests
        pb.collection('friends').subscribe('*', () => loadFriends());

        // 2. Global Message Listener for Notifications & Active Chat Sync
        pb.collection('messages').subscribe('*', (e) => {
            if (e.action === 'create') {
                const msg = e.record;
                const myId = pb.authStore.model?.id;
                const isFromActive = activeChat && msg.sender === activeChat.id;
                const isFromMe = msg.sender === myId;
                const isForMe = msg.receiver === myId;

                // Update UI jika pesan bagian dari percakapan yang terbuka
                if (isFromActive || isFromMe) {
                    setMessages(prev => [...prev, msg]);
                }

                // Notifikasi jika pesan untuk saya tapi saya sedang tidak buka chat pengirimnya
                if (isForMe && !isFromActive) {
                    const sender = friends.find(f => (f.user === msg.sender || f.friend === msg.sender));
                    const senderData = sender?.expand?.user?.id === msg.sender ? sender.expand.user : sender?.expand?.friend;
                    triggerLocalNotification(senderData?.name || senderData?.username || "Seseorang");
                }
            }
        });

        if (typeof window !== "undefined" && "Notification" in window) {
            Notification.requestPermission();
        }

        return () => {
            pb.collection('friends').unsubscribe();
            pb.collection('messages').unsubscribe();
        };
    }, [activeChat, friends]);

    useEffect(() => {
        if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }, [messages]);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !activeChat) return;
        const encrypted = CryptoJS.AES.encrypt(inputText.trim(), currentChatKeyRef.current).toString();
        await pb.collection('messages').create({ sender: myUser.id, receiver: activeChat.id, text: encrypted });
        setInputText("");
    };

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden border-t border-border">
            {/* Sidebar Overlay Mobile */}
            <div className={`fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)} />

            {/* Sidebar */}
            <aside className={`fixed md:relative inset-y-0 left-0 w-[280px] md:w-80 bg-card border-r border-border flex flex-col z-50 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h1 className="text-sm font-bold uppercase tracking-widest">Bitlab Chat</h1>
                    <button onClick={() => setShowNoti(!showNoti)} className="relative p-2 hover:bg-accent rounded-md">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        {requests.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />}
                    </button>
                </div>

                {showNoti && (
                    <div className="absolute top-14 left-4 right-4 bg-popover border border-border shadow-2xl rounded-lg z-[60] py-2 animate-in fade-in slide-in-from-top-2">
                        <p className="px-4 py-1 text-[10px] font-bold text-muted-foreground uppercase">Requests</p>
                        {requests.length === 0 ? <p className="px-4 py-3 text-xs text-muted-foreground">No requests</p> : 
                            requests.map(req => (
                                <div key={req.id} className="px-4 py-2 border-b border-border last:border-0 flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium truncate">{req.expand?.user?.name || req.expand?.user?.email || "User"}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => {/* respondRequest logic */}} className="px-2 py-1 bg-primary text-[10px] rounded">Accept</button>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-2 mt-4 space-y-1">
                    <p className="px-2 text-[10px] font-bold text-muted-foreground uppercase mb-2">Messages</p>
                    {friends.map(f => {
                        const friendData = f.user === myUser?.id ? f.expand?.friend : f.expand?.user;
                        const isActive = activeChat?.id === friendData?.id;
                        return (
                            <button key={f.id} onClick={() => selectChat(f)} className={`w-full p-2 flex items-center gap-3 rounded-md transition-all ${isActive ? 'bg-accent' : 'hover:bg-accent/40'}`}>
                                <div className="w-10 h-10 rounded-full bg-muted flex flex-shrink-0 items-center justify-center font-bold text-xs">
                                    {(friendData?.name || 'U')[0].toUpperCase()}
                                </div>
                                <div className="text-left truncate">
                                    <div className="text-sm font-semibold truncate">{friendData?.name || friendData?.username}</div>
                                    <p className="text-[10px] text-emerald-500 font-bold">Secured</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* Main Chat */}
            <main className="flex-1 flex flex-col bg-background">
                <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-background/95 backdrop-blur sticky top-0 z-30">
                    <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    {activeChat && (
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">{(activeChat.name || 'U')[0].toUpperCase()}</div>
                            <h2 className="text-sm font-bold">{activeChat.name || activeChat.email}</h2>
                        </div>
                    )}
                </header>

                {!activeChat ? (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                        <p className="text-[10px] font-bold uppercase tracking-widest">Select a session</p>
                    </div>
                ) : (
                    <>
                        <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
                            {messages.map(msg => {
                                let plainText = "";
                                try {
                                    const bytes = CryptoJS.AES.decrypt(msg.text, currentChatKeyRef.current);
                                    plainText = bytes.toString(CryptoJS.enc.Utf8);
                                } catch (e) { plainText = ""; }
                                const isMe = msg.sender === myUser?.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'}`}>
                                            <p>{plainText || "🔒 [Encrypted]"}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-4 bg-background">
                            <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex gap-2">
                                <input value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type a message..." className="flex-1 h-11 bg-card border border-input rounded-full px-5 text-sm outline-none focus:ring-1 focus:ring-primary" />
                                <button type="submit" className="w-11 h-11 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                                    <svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}