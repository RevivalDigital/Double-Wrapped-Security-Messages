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
    // Kita simpan keys di state agar perubahan memicu re-render yang benar
    const [chatKeys, setChatKeys] = useState<Record<string, string>>({});

    // --- ENCRYPTION ENGINE (UTUH) ---
    const decryptSalt = (enc: string) => {
        if (!enc) return null;
        try {
            const bytes = CryptoJS.AES.decrypt(enc, INTERNAL_APP_KEY);
            return bytes.toString(CryptoJS.enc.Utf8) || null; 
        } catch (e) { return null; }
    };

    const getChatKey = (friendRecord: any) => {
        const myId = pb.authStore.model?.id;
        const friendData = friendRecord.user === myId ? friendRecord.expand.friend : friendRecord.expand.user;
        const salt = decryptSalt(friendRecord.chat_salt) || "fallback";
        const combined = [myId, friendData.id].sort().join("");
        return CryptoJS.SHA256(combined + salt + INTERNAL_APP_KEY).toString();
    };

    // --- DATABASE PERSISTENT LOGIC ---
    const syncUnreadFromDB = async (friendRecords: any[]) => {
        const counts: Record<string, number> = {};
        for (const rel of friendRecords) {
            const friendId = rel.user === pb.authStore.model?.id ? rel.friend : rel.user;
            const lastRead = rel.last_read || "2000-01-01 00:00:00";
            const result = await pb.collection('messages').getList(1, 1, {
                filter: `sender = "${friendId}" && receiver = "${pb.authStore.model?.id}" && created > "${lastRead}"`
            });
            counts[friendId] = result.totalItems;
        }
        setUnreadCounts(counts);
    };

    const loadFriends = async () => {
        try {
            const userId = pb.authStore.model?.id;
            const records = await pb.collection('friends').getFullList({
                expand: 'user,friend',
                filter: `user = "${userId}" || friend = "${userId}"`,
                sort: '-updated'
            });
            
            const newKeys: Record<string, string> = {};
            records.forEach(r => {
                const fId = r.user === userId ? r.friend : r.user;
                newKeys[fId] = getChatKey(r);
            });
            // UPDATE STATE KEYS AGAR DEKRIPSI JALAN
            setChatKeys(newKeys);

            const accepted = records.filter(r => r.status === 'accepted');
            setFriends(accepted);
            setRequests(records.filter(r => r.status === 'pending' && r.friend === userId));
            syncUnreadFromDB(accepted);
        } catch (err) { console.error(err); }
    };

    // --- REALTIME & CORE ---
    useEffect(() => {
        if (!pb.authStore.isValid) { window.location.href = "/login"; return; }
        setMyUser(pb.authStore.model);
        loadFriends();

        pb.collection('friends').subscribe('*', () => loadFriends());
        pb.collection('messages').subscribe('*', async (e) => {
            if (e.action === 'create') {
                const msg = e.record;
                const myId = pb.authStore.model?.id;
                
                if (msg.sender === myId || (activeChat && msg.sender === activeChat.id)) {
                    setMessages(prev => [...prev, msg]);
                    if (activeChat && msg.sender === activeChat.id) {
                        const rel = friends.find(f => (f.user === activeChat.id || f.friend === activeChat.id));
                        if (rel) await pb.collection('friends').update(rel.id, { last_read: new Date().toISOString() });
                    }
                }
                
                if (msg.receiver === myId && (!activeChat || msg.sender !== activeChat.id)) {
                    setUnreadCounts(prev => ({ ...prev, [msg.sender]: (prev[msg.sender] || 0) + 1 }));
                }
            }
        });

        return () => {
            pb.collection('friends').unsubscribe();
            pb.collection('messages').unsubscribe();
        };
    }, [activeChat, friends]);

    const selectChat = async (friendRecord: any) => {
        const friendData = friendRecord.user === pb.authStore.model?.id ? friendRecord.expand.friend : friendRecord.expand.user;
        setActiveChat(friendData);
        
        await pb.collection('friends').update(friendRecord.id, { last_read: new Date().toISOString() });
        setUnreadCounts(prev => ({ ...prev, [friendData.id]: 0 }));

        const res = await pb.collection('messages').getFullList({
            filter: `(sender="${pb.authStore.model?.id}" && receiver="${friendData.id}") || (sender="${friendData.id}" && receiver="${pb.authStore.model?.id}")`,
            sort: 'created'
        });
        setMessages(res);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !activeChat) return;
        const key = chatKeys[activeChat.id]; // Ambil dari state
        const encrypted = CryptoJS.AES.encrypt(inputText.trim(), key).toString();
        await pb.collection('messages').create({ sender: myUser.id, receiver: activeChat.id, text: encrypted });
        setInputText("");
    };

    // --- RENDER ---
    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            <aside className={`fixed md:relative inset-y-0 left-0 w-80 bg-card border-r border-border flex flex-col z-50 transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                {/* Header & Sidebar tetap sama seperti sebelumnya */}
                <div className="p-4 border-b flex items-center justify-between">
                    <h1 className="text-sm font-bold uppercase">Bitlab Chat</h1>
                    <button onClick={() => setShowNoti(!showNoti)} className="relative p-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        {Object.values(unreadCounts).some(v => v > 0) && <span className="absolute top-1 right-1 h-3 w-3 bg-destructive rounded-full" />}
                    </button>
                </div>

                {/* List Teman (Sama) */}
                <div className="flex-1 overflow-y-auto p-2">
                    {friends.map(f => {
                        const friendData = f.user === myUser.id ? f.expand?.friend : f.expand?.user;
                        const unread = unreadCounts[friendData.id] || 0;
                        return (
                            <button key={f.id} onClick={() => selectChat(f)} className={`w-full p-3 flex items-center gap-3 rounded-md mb-1 ${activeChat?.id === friendData?.id ? 'bg-accent' : 'hover:bg-accent/40'}`}>
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">{(friendData?.name || 'U')[0]}</div>
                                <div className="text-left flex-1">
                                    <div className="flex justify-between items-center"><span className="text-sm font-bold">{friendData.name}</span>{unread > 0 && <span className="text-[10px] bg-primary text-white px-2 rounded-full">{unread}</span>}</div>
                                    <p className="text-[10px] text-emerald-500">ENCRYPTED</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </aside>

            <main className="flex-1 flex flex-col bg-background">
                {activeChat ? (
                    <>
                        <header className="h-14 border-b flex items-center px-4 justify-between">
                            <h2 className="text-sm font-bold">{activeChat.name}</h2>
                        </header>
                        <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map(msg => {
                                let plainText = "";
                                // AMBIL KUNCI DARI STATE
                                const key = chatKeys[activeChat.id];
                                if (key) {
                                    try {
                                        const bytes = CryptoJS.AES.decrypt(msg.text, key);
                                        plainText = bytes.toString(CryptoJS.enc.Utf8);
                                    } catch (e) { plainText = ""; }
                                }
                                const isMe = msg.sender === myUser.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-primary text-white' : 'bg-card border border-border'}`}>
                                            <p className="break-words">{plainText || "🔒 [Sedang Mendekripsi...]"}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Input Form Tetap Sama */}
                        <div className="p-4 border-t">
                            <form onSubmit={sendMessage} className="flex gap-2">
                                <input value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type a message..." className="flex-1 h-10 bg-muted/30 border rounded-full px-4 outline-none text-sm" />
                                <button type="submit" className="h-10 w-10 bg-primary text-white rounded-full flex items-center justify-center">➤</button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center opacity-20 font-bold uppercase tracking-widest">Select a Chat</div>
                )}
            </main>
        </div>
    );
}