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
    const chatKeysRef = useRef<Record<string, string>>({});

    // --- ENCRYPTION ENGINE ---
    const encryptSalt = (raw: string) => CryptoJS.AES.encrypt(raw, INTERNAL_APP_KEY).toString();
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

    // --- NOTIFICATION HELPER ---
    const triggerDesktopNotification = (title: string, body: string) => {
        if (typeof window !== "undefined" && Notification.permission === "granted") {
            new Notification(title, { body, icon: "/icon.png" });
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

    const respondRequest = async (id: string, action: 'accepted' | 'reject') => {
        try {
            if (action === 'accepted') {
                const rawSalt = Math.random().toString(36).substring(2, 8).toUpperCase();
                await pb.collection('friends').update(id, { 
                    status: "accepted", 
                    chat_salt: encryptSalt(rawSalt) 
                });
            } else {
                await pb.collection('friends').delete(id);
            }
            loadFriends();
        } catch (err) { console.error(err); }
    };

    const addFriend = async (e: React.FormEvent) => {
        e.preventDefault();
        const input = searchId.trim();
        if (!input || input === myUser.id) return alert("ID tidak valid.");
        try {
            const userList = await pb.collection('users').getList(1, 1, { filter: `id = "${input}" || email = "${input}"` });
            if (userList.items.length === 0) return alert("User tidak ditemukan.");
            await pb.collection('friends').create({ user: myUser.id, friend: userList.items[0].id, status: 'pending' });
            alert("Permintaan terkirim!");
            setSearchId("");
        } catch (err) { alert("Gagal kirim permintaan."); }
    };

    // --- PERSISTENCE & REALTIME ---
    useEffect(() => {
        if (!pb.authStore.isValid) { window.location.href = "/login"; return; }
        setMyUser(pb.authStore.model);
        loadFriends();

        // Load unread counts from LocalStorage (Anti-Refresh)
        const savedUnread = localStorage.getItem('unread_counts');
        if (savedUnread) setUnreadCounts(JSON.parse(savedUnread));

        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }

        pb.collection('friends').subscribe('*', () => loadFriends());
        pb.collection('messages').subscribe('*', (e) => {
            if (e.action === 'create') {
                const msg = e.record;
                const myId = pb.authStore.model?.id;
                
                if (msg.sender === myId || (activeChat && msg.sender === activeChat.id)) {
                    setMessages(prev => [...prev, msg]);
                }
                
                if (msg.receiver === myId && (!activeChat || msg.sender !== activeChat.id)) {
                    setUnreadCounts(prev => {
                        const newCounts = { ...prev, [msg.sender]: (prev[msg.sender] || 0) + 1 };
                        localStorage.setItem('unread_counts', JSON.stringify(newCounts));
                        return newCounts;
                    });
                    triggerDesktopNotification("Pesan Baru", "Seseorang mengirimkan pesan terenkripsi.");
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

    const selectChat = async (friendRecord: any) => {
        const friendData = friendRecord.user === myUser.id ? friendRecord.expand.friend : friendRecord.expand.user;
        setActiveChat(friendData);
        
        setUnreadCounts(prev => {
            const newCounts = { ...prev, [friendData.id]: 0 };
            localStorage.setItem('unread_counts', JSON.stringify(newCounts));
            return newCounts;
        });

        const res = await pb.collection('messages').getFullList({
            filter: `(sender="${myUser.id}" && receiver="${friendData.id}") || (sender="${friendData.id}" && receiver="${myUser.id}")`,
            sort: 'created'
        });
        setMessages(res);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !activeChat) return;
        const key = chatKeysRef.current[activeChat.id];
        const encrypted = CryptoJS.AES.encrypt(inputText.trim(), key).toString();
        await pb.collection('messages').create({ sender: myUser.id, receiver: activeChat.id, text: encrypted });
        setInputText("");
    };

    const totalUnread = useMemo(() => Object.values(unreadCounts).reduce((a, b) => a + b, 0), [unreadCounts]);

    if (!myUser) return <div className="h-screen flex items-center justify-center bg-background">Initializing...</div>;

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden border-t border-border">
            <aside className={`fixed md:relative inset-y-0 left-0 w-80 bg-card border-r border-border flex flex-col z-50 transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                
                {/* Header Sidebar + Lonceng */}
                <div className="p-4 border-b border-border flex items-center justify-between relative">
                    <h1 className="text-sm font-bold uppercase tracking-tighter">Bitlab Chat</h1>
                    <button onClick={() => setShowNoti(!showNoti)} className="relative p-2 hover:bg-accent rounded-md transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        {(requests.length > 0 || totalUnread > 0) && (
                            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center bg-destructive text-[9px] font-bold text-white rounded-full animate-pulse">
                                {requests.length + totalUnread}
                            </span>
                        )}
                    </button>

                    {/* Pop-up Lonceng (DIPERJELAS) */}
                    {showNoti && (
                        <div className="absolute top-14 right-4 w-72 bg-popover border border-border shadow-2xl rounded-lg z-[70] py-2 animate-in fade-in zoom-in-95">
                            <div className="px-4 py-2 border-b border-border">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Notifications</p>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {/* Permintaan Teman */}
                                {requests.length > 0 && (
                                    <div className="p-2">
                                        <p className="px-2 text-[9px] font-bold text-primary mb-1">FRIEND REQUESTS</p>
                                        {requests.map(req => (
                                            <div key={req.id} className="px-2 py-2 flex items-center justify-between bg-muted/30 rounded-md mb-1">
                                                <span className="text-[11px] truncate w-24 font-medium">{req.expand?.user?.name || req.expand?.user?.email}</span>
                                                <div className="flex gap-1">
                                                    <button onClick={() => respondRequest(req.id, 'accepted')} className="px-2 py-1 bg-primary text-white text-[9px] rounded">Accept</button>
                                                    <button onClick={() => respondRequest(req.id, 'reject')} className="px-2 py-1 bg-destructive text-white text-[9px] rounded">Reject</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {/* Info Pesan Masuk */}
                                {totalUnread > 0 ? (
                                    <div className="p-2">
                                        <p className="px-2 text-[9px] font-bold text-primary mb-1">UNREAD MESSAGES</p>
                                        {friends.map(f => {
                                            const fData = f.user === myUser.id ? f.expand?.friend : f.expand?.user;
                                            if (!unreadCounts[fData.id]) return null;
                                            return (
                                                <div key={fData.id} className="px-2 py-2 text-xs border-b border-border last:border-0">
                                                    Ada <span className="font-bold">{unreadCounts[fData.id]}</span> pesan baru dari <span className="font-bold">{fData.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : requests.length === 0 && <p className="px-4 py-6 text-center text-xs text-muted-foreground">Tidak ada notifikasi baru</p>}
                            </div>
                        </div>
                    )}
                </div>

                {/* Tambah Teman */}
                <div className="p-4 border-b border-border bg-muted/10">
                    <form onSubmit={addFriend} className="flex gap-2">
                        <input value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="User ID / Email" className="flex-1 h-9 bg-background border border-input rounded-md px-3 text-xs outline-none focus:ring-1 focus:ring-primary" />
                        <button type="submit" className="h-9 px-3 bg-secondary text-secondary-foreground rounded-md text-[10px] font-bold hover:bg-secondary/80">ADD</button>
                    </form>
                </div>

                {/* List Teman */}
                <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
                    <p className="px-2 text-[10px] font-bold text-muted-foreground uppercase mb-2 tracking-widest">Messages</p>
                    {friends.map(f => {
                        const friendData = f.user === myUser.id ? f.expand?.friend : f.expand?.user;
                        const unread = unreadCounts[friendData.id] || 0;
                        return (
                            <button key={f.id} onClick={() => selectChat(f)} className={`w-full p-2 flex items-center gap-3 rounded-md transition-all ${activeChat?.id === friendData?.id ? 'bg-accent' : 'hover:bg-accent/40'}`}>
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-xs border border-border">{(friendData?.name || 'U')[0].toUpperCase()}</div>
                                <div className="text-left flex-1 truncate">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-semibold truncate">{friendData?.name || friendData?.username}</span>
                                        {unread > 0 && <span className="text-[9px] bg-primary px-1.5 py-0.5 rounded-full text-white font-black animate-bounce">{unread} BARU</span>}
                                    </div>
                                    <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> E2EE Secure</p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Sidebar Bawah (Info ID & Akun) */}
                <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
                    <div className="flex items-center gap-3 truncate">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white shadow-lg">{(myUser.name || 'M')[0].toUpperCase()}</div>
                        <div className="truncate">
                            <p className="text-xs font-bold truncate leading-none">{myUser.name || myUser.username}</p>
                            <p className="text-[9px] text-muted-foreground truncate mt-1 tracking-tighter font-mono">ID: {myUser.id}</p>
                        </div>
                    </div>
                    <button onClick={() => { pb.authStore.clear(); window.location.href="/login"; }} className="p-2 hover:text-destructive transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col bg-background relative">
                {activeChat ? (
                    <>
                        <header className="h-14 border-b border-border flex items-center px-4 justify-between bg-background/80 backdrop-blur-md sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 hover:bg-accent rounded-md"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                                <div><h2 className="text-sm font-bold">{activeChat.name || activeChat.email}</h2><p className="text-[10px] text-emerald-500 font-black">ENCRYPTED</p></div>
                            </div>
                        </header>
                        <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                            {messages.map(msg => {
                                let plainText = "";
                                try {
                                    const key = chatKeysRef.current[activeChat.id];
                                    const bytes = CryptoJS.AES.decrypt(msg.text, key);
                                    plainText = bytes.toString(CryptoJS.enc.Utf8);
                                } catch (e) { plainText = ""; }
                                const isMe = msg.sender === myUser.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] md:max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-card border border-border rounded-tl-none'}`}>
                                            <p className="break-words leading-relaxed">{plainText || "🔒 [Decryption Error]"}</p>
                                            <span className="text-[8px] mt-1 block opacity-50 text-right">{new Date(msg.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-4 border-t border-border bg-background">
                            <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex gap-3">
                                <input value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type an encrypted message..." className="flex-1 h-11 bg-muted/30 border border-input rounded-full px-5 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                                <button type="submit" className="w-11 h-11 flex items-center justify-center bg-primary text-white rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg"><svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg></button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 space-y-4 font-bold uppercase tracking-widest text-[10px]">Select a session to chat</div>
                )}
            </main>
        </div>
    );
}