"use client";

import { useEffect, useState, useRef, useMemo } from 'react';
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
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const [inputText, setInputText] = useState("");
    const [searchId, setSearchId] = useState("");
    const [showNoti, setShowNoti] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    
    const chatBoxRef = useRef<HTMLDivElement>(null);
    // Kita simpan semua kunci chat di ref agar tidak hilang saat re-render
    const chatKeysRef = useRef<Record<string, string>>({});

    // --- ENCRYPTION ENGINE ---
    const decryptSalt = (enc: string) => {
        if (!enc) return null;
        try {
            const bytes = CryptoJS.AES.decrypt(enc, INTERNAL_APP_KEY);
            return bytes.toString(CryptoJS.enc.Utf8) || null; 
        } catch (e) { return null; }
    };

    const getChatKey = (friendRecord: any) => {
        const friendData = friendRecord.user === pb.authStore.model?.id ? friendRecord.expand.friend : friendRecord.expand.user;
        const salt = decryptSalt(friendRecord.chat_salt) || "fallback";
        const combined = [pb.authStore.model?.id, friendData.id].sort().join("");
        return CryptoJS.SHA256(combined + salt + INTERNAL_APP_KEY).toString();
    };

    // --- CORE LOGIC ---
    const loadFriends = async () => {
        try {
            const userId = pb.authStore.model?.id;
            const records = await pb.collection('friends').getFullList({
                expand: 'user,friend',
                filter: `user = "${userId}" || friend = "${userId}"`,
                sort: '-updated'
            });
            
            // Simpan semua kunci chat untuk dekripsi realtime
            const keys: Record<string, string> = {};
            records.forEach(r => {
                const fId = r.user === userId ? r.friend : r.user;
                keys[fId] = getChatKey(r);
            });
            chatKeysRef.current = keys;

            setFriends(records.filter(r => r.status === 'accepted'));
            setRequests(records.filter(r => r.status === 'pending' && r.friend === userId));
        } catch (err) { console.error(err); }
    };

    const selectChat = async (friendRecord: any) => {
        const friendData = friendRecord.user === myUser.id ? friendRecord.expand.friend : friendRecord.expand.user;
        setActiveChat(friendData);
        
        // Reset unread untuk teman ini
        setUnreadCounts(prev => ({ ...prev, [friendData.id]: 0 }));

        const res = await pb.collection('messages').getFullList({
            filter: `(sender="${myUser.id}" && receiver="${friendData.id}") || (sender="${friendData.id}" && receiver="${myUser.id}")`,
            sort: 'created'
        });
        setMessages(res);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    // --- REALTIME ---
    useEffect(() => {
        if (!pb.authStore.isValid) { window.location.href = "/login"; return; }
        setMyUser(pb.authStore.model);
        loadFriends();

        pb.collection('friends').subscribe('*', () => loadFriends());

        pb.collection('messages').subscribe('*', (e) => {
            if (e.action === 'create') {
                const msg = e.record;
                const myId = pb.authStore.model?.id;
                
                if (msg.sender === myId || (activeChat && msg.sender === activeChat.id)) {
                    setMessages(prev => [...prev, msg]);
                }

                if (msg.receiver === myId && (!activeChat || msg.sender !== activeChat.id)) {
                    // Update counter pesan baru di list teman
                    setUnreadCounts(prev => ({
                        ...prev,
                        [msg.sender]: (prev[msg.sender] || 0) + 1
                    }));
                    
                    if (Notification.permission === "granted") {
                        new Notification("Pesan Baru", { body: "Ada pesan rahasia baru", icon: "/icon.png" });
                    }
                }
            }
        });

        return () => {
            pb.collection('friends').unsubscribe();
            pb.collection('messages').unsubscribe();
        };
    }, [activeChat]);

    useEffect(() => {
        if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }, [messages]);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !activeChat) return;
        
        const key = chatKeysRef.current[activeChat.id];
        const encrypted = CryptoJS.AES.encrypt(inputText.trim(), key).toString();
        
        await pb.collection('messages').create({
            sender: myUser.id,
            receiver: activeChat.id,
            text: encrypted
        });
        setInputText("");
    };

    // Total pesan masuk untuk icon lonceng
    const totalUnread = useMemo(() => Object.values(unreadCounts).reduce((a, b) => a + b, 0), [unreadCounts]);

    if (!myUser) return <div className="h-screen flex items-center justify-center">Initializing...</div>;

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden border-t border-border">
            <aside className={`fixed md:relative inset-y-0 left-0 w-80 bg-card border-r border-border flex flex-col z-50 transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                {/* Header Sidebar */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h1 className="text-sm font-bold uppercase">Bitlab Chat</h1>
                    <button onClick={() => setShowNoti(!showNoti)} className="relative p-2 hover:bg-accent rounded-md">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        {(requests.length > 0 || totalUnread > 0) && (
                            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center bg-destructive text-[9px] font-bold text-white rounded-full">
                                {requests.length + totalUnread}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
                    <p className="px-2 text-[10px] font-bold text-muted-foreground uppercase mb-2">Direct Messages</p>
                    {friends.map(f => {
                        const friendData = f.user === myUser.id ? f.expand?.friend : f.expand?.user;
                        const unread = unreadCounts[friendData.id] || 0;
                        return (
                            <button key={f.id} onClick={() => selectChat(f)} className={`w-full p-2 flex items-center gap-3 rounded-md transition-all ${activeChat?.id === friendData?.id ? 'bg-accent' : 'hover:bg-accent/40'}`}>
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-xs border border-border">{(friendData?.name || 'U')[0].toUpperCase()}</div>
                                <div className="text-left flex-1 truncate">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-semibold truncate">{friendData?.name || friendData?.username}</span>
                                        {unread > 0 && <span className="text-[10px] bg-primary px-1.5 py-0.5 rounded-full text-white font-bold">{unread} baru</span>}
                                    </div>
                                    <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Secured Session</p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Info Akun Bawah */}
                <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
                    <div className="flex items-center gap-3 truncate">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white">{(myUser.name || 'M')[0].toUpperCase()}</div>
                        <div className="truncate">
                            <p className="text-xs font-bold truncate leading-none">{myUser.name || myUser.username}</p>
                            <p className="text-[9px] text-muted-foreground truncate mt-1">ID: {myUser.id}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col bg-background">
                {activeChat ? (
                    <>
                        <header className="h-14 border-b border-border flex items-center px-4 justify-between">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold">{activeChat.name || activeChat.email}</h2>
                                <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">E2EE</span>
                            </div>
                        </header>
                        <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map(msg => {
                                let plainText = "";
                                try {
                                    // Ambil kunci yang tepat berdasarkan lawan bicara
                                    const key = chatKeysRef.current[activeChat.id];
                                    const bytes = CryptoJS.AES.decrypt(msg.text, key);
                                    plainText = bytes.toString(CryptoJS.enc.Utf8);
                                } catch (e) { plainText = ""; }
                                
                                const isMe = msg.sender === myUser.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-card border border-border rounded-tl-none'}`}>
                                            <p className="break-words leading-relaxed">{plainText || "🔒 [Gagal Dekripsi - Kunci Tidak Cocok]"}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-4 border-t border-border">
                            <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex gap-3">
                                <input value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Tulis pesan rahasia..." className="flex-1 h-11 bg-card border rounded-full px-5 text-sm outline-none focus:ring-1 focus:ring-primary" />
                                <button type="submit" className="w-11 h-11 flex items-center justify-center bg-primary text-white rounded-full">
                                    <svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center opacity-20">Pilih teman untuk memulai chat aman</div>
                )}
            </main>
        </div>
    );
}