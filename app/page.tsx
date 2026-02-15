"use client";

import { useEffect, useState, useRef } from 'react';
import PocketBase from 'pocketbase';
import * as CryptoJS from 'crypto-js';

// --- CONFIG FROM ENV ---
// Mengambil konfigurasi dari environment variables dengan fallback string kosong
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
    const encryptSalt = (raw: string) => CryptoJS.AES.encrypt(raw, INTERNAL_APP_KEY).toString();
    
    const decryptSalt = (enc: string) => {
        if (!enc) return null;
        try {
            const bytes = CryptoJS.AES.decrypt(enc, INTERNAL_APP_KEY);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            return decrypted || null; 
        } catch (e) { 
            console.error("Gagal dekripsi salt. Periksa KEY1 & KEY2 di .env");
            return null; 
        }
    };

    const generateChatKey = (id1: string, id2: string, salt: string) => {
        const combined = [id1, id2].sort().join("");
        // Menghasilkan kunci unik berbasis ID pengguna, salt unik per teman, dan App Key internal
        return CryptoJS.SHA256(combined + salt + INTERNAL_APP_KEY).toString();
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
        } catch (err) { console.error("Load friends error:", err); }
    };

    const respondRequest = async (id: string, action: 'accepted' | 'reject') => {
        try {
            if (action === 'accepted') {
                // Membuat salt acak 6 digit untuk kunci chat unik pasangan ini
                const rawSalt = Math.random().toString(36).substring(2, 8).toUpperCase();
                await pb.collection('friends').update(id, { 
                    status: "accepted", 
                    chat_salt: encryptSalt(rawSalt) 
                });
            } else {
                await pb.collection('friends').delete(id);
            }
            loadFriends();
        } catch (err) {
            console.error("Error responding to request:", err);
        }
    };

    const handleLogout = () => {
        pb.authStore.clear();
        document.cookie = "pb_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        window.location.href = "/login";
    };

    // --- PUSH NOTIFICATION SETUP ---
    const setupNotifications = () => {
        if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator) {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    navigator.serviceWorker.register("/sw.js")
                        .then(() => console.log("Service Worker Active"))
                        .catch(e => console.error("SW Register fail:", e));
                }
            });
        }
    };

    const triggerLocalNotification = (senderName: string) => {
        if (document.visibilityState === "hidden" && Notification.permission === "granted") {
            new Notification("Pesan Baru", {
                body: `Pesan rahasia baru dari ${senderName}`,
                icon: "/icon.png" // Pastikan file ini ada di folder /public
            });
        }
    };

    // --- EFFECTS ---
    useEffect(() => {
        if (!pb.authStore.isValid) {
            window.location.href = "/login";
            return;
        }
        setMyUser(pb.authStore.model);
        loadFriends();
        setupNotifications();
        
        // Auto-close sidebar di mobile jika chat dipilih
        if (typeof window !== "undefined" && window.innerWidth < 768 && activeChat) {
            setIsSidebarOpen(false);
        }

        // Realtime listener untuk daftar teman & permintaan baru
        pb.collection('friends').subscribe('*', () => loadFriends());
        return () => { pb.collection('friends').unsubscribe(); };
    }, [activeChat]);

    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [messages]);

    const selectChat = async (friendRecord: any) => {
        const friendData = friendRecord.user === myUser.id ? friendRecord.expand.friend : friendRecord.expand.user;
        const salt = decryptSalt(friendRecord.chat_salt) || "fallback-salt";
        
        const key = generateChatKey(myUser.id, friendData.id, salt);
        currentChatKeyRef.current = key;
        
        setActiveChat({ ...friendData, salt });
        loadMessages(friendData.id);
        // Menjalankan subscribe dengan argumen nama agar closure tidak salah
        subscribeMessages(friendData.id, friendData.name || friendData.username || friendData.email);
        
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const loadMessages = async (friendId: string) => {
        const res = await pb.collection('messages').getFullList({
            filter: `(sender="${myUser.id}" && receiver="${friendId}") || (sender="${friendId}" && receiver="${myUser.id}")`,
            sort: 'created'
        });
        setMessages(res);
    };

    const subscribeMessages = async (friendId: string, friendName: string) => {
        await pb.collection('messages').unsubscribe('*');
        await pb.collection('messages').subscribe('*', (e) => {
            if (e.action === 'create') {
                const isFromMe = e.record.sender === myUser.id;
                const isFromTarget = e.record.sender === friendId;
                const isForMe = e.record.receiver === myUser.id;

                if (isFromMe || isFromTarget) {
                    setMessages(prev => [...prev, e.record]);
                }

                // Trigger notifikasi hanya jika pesan untuk saya dan tab sedang tidak dibuka
                if (isForMe) {
                    triggerLocalNotification(isFromTarget ? friendName : "Seseorang");
                }
            }
        });
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !activeChat) return;
        
        // Enkripsi pesan menggunakan kunci AES-256 yang di-generate khusus untuk pasangan chat ini
        const encrypted = CryptoJS.AES.encrypt(inputText.trim(), currentChatKeyRef.current).toString();
        
        await pb.collection('messages').create({
            sender: myUser.id, 
            receiver: activeChat.id, 
            text: encrypted
        });
        setInputText("");
    };

    const addFriend = async (e: React.FormEvent) => {
        e.preventDefault();
        const input = searchId.trim();
        if (!input || input === myUser.id || input === myUser.email) {
            return alert("ID atau Email tidak valid.");
        }

        try {
            const userList = await pb.collection('users').getList(1, 1, { 
                filter: `id = "${input}" || email = "${input}"` 
            });

            if (userList.items.length === 0) return alert("User tidak ditemukan.");
            const target = userList.items[0];

            const existing = await pb.collection('friends').getList(1, 1, {
                filter: `(user = "${myUser.id}" && friend = "${target.id}") || (user = "${target.id}" && friend = "${myUser.id}")`
            });

            if (existing.items.length > 0) {
                const status = existing.items[0].status;
                return alert(status === 'accepted' ? "Sudah berteman." : "Permintaan sudah dikirim.");
            }

            await pb.collection('friends').create({ 
                user: myUser.id, 
                friend: target.id, 
                status: 'pending' 
            });

            alert("Permintaan terkirim!");
            setSearchId("");
        } catch (err) { alert("Gagal kirim permintaan."); }
    };

    if (!myUser) return <div className="h-screen flex items-center justify-center bg-background text-foreground animate-pulse">Initializing...</div>;

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans border-t border-border">
            {/* Sidebar Overlay for Mobile */}
            <div className={`fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)} />

            {/* Sidebar */}
            <aside className={`fixed md:relative inset-y-0 left-0 w-[280px] md:w-80 bg-card border-r border-border flex flex-col z-50 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h1 className="text-sm font-bold tracking-tighter uppercase">Bitlab Chat</h1>
                    <button onClick={() => setShowNoti(!showNoti)} className="relative p-2 hover:bg-accent rounded-md transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        {requests.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />}
                    </button>
                </div>

                {showNoti && (
                    <div className="absolute top-14 left-4 right-4 bg-popover border border-border shadow-xl rounded-lg z-[60] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <p className="px-4 py-1 text-[10px] font-bold text-muted-foreground uppercase">Friend Requests</p>
                        <div className="max-h-60 overflow-y-auto">
                            {requests.length === 0 ? <p className="px-4 py-3 text-xs text-muted-foreground">No pending requests</p> : 
                                requests.map(req => (
                                    <div key={req.id} className="px-4 py-2 border-b border-border last:border-0 flex items-center justify-between gap-2">
                                        <span className="text-xs font-medium truncate">{req.expand.user.name || req.expand.user.email}</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => respondRequest(req.id, 'accepted')} className="px-2 py-1 bg-primary text-primary-foreground text-[10px] rounded hover:opacity-90">Accept</button>
                                            <button onClick={() => respondRequest(req.id, 'reject')} className="px-2 py-1 bg-destructive text-destructive-foreground text-[10px] rounded hover:opacity-90">Reject</button>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}

                <div className="p-4">
                    <form onSubmit={addFriend} className="flex gap-2">
                        <input value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="User ID / Email" className="flex-1 h-9 bg-transparent border border-input rounded-md px-3 text-xs focus:ring-1 focus:ring-ring outline-none transition-all" />
                        <button type="submit" className="h-9 px-3 bg-secondary text-secondary-foreground rounded-md text-[10px] font-bold hover:bg-secondary/80 uppercase">Add</button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto px-2 space-y-1">
                    <p className="px-2 text-[10px] font-bold text-muted-foreground uppercase mb-2">Direct Messages</p>
                    {friends.map(f => {
                        const friendData = f.user === myUser.id ? f.expand.friend : f.expand.user;
                        const isActive = activeChat?.id === friendData.id;
                        return (
                            <button key={f.id} onClick={() => selectChat(f)} className={`w-full p-2 flex items-center gap-3 rounded-md transition-all ${isActive ? 'bg-accent text-accent-foreground ring-1 ring-border' : 'hover:bg-accent/40'}`}>
                                <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0 flex items-center justify-center font-bold text-xs text-muted-foreground border border-border">
                                    {(friendData.name || friendData.username || 'U')[0].toUpperCase()}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="text-sm font-semibold truncate">{friendData.name || friendData.username || friendData.email}</div>
                                    <p className="text-[10px] text-emerald-500 truncate font-medium flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Secured Session
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-primary-foreground shadow-sm">
                            {(myUser.name || 'M')[0].toUpperCase()}
                        </div>
                        <div className="truncate">
                            <p className="text-xs font-bold truncate leading-none">{myUser.name || myUser.username}</p>
                            <p className="text-[9px] text-muted-foreground truncate mt-1">ID: {myUser.id}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="p-2 hover:text-destructive transition-colors" title="Logout">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col bg-background relative">
                <header className="h-14 border-b border-border flex items-center px-4 justify-between bg-background/95 backdrop-blur sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 hover:bg-accent rounded-md">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        {activeChat && (
                            <div className="flex items-center gap-2 animate-in fade-in duration-300">
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold border border-border shadow-sm">
                                    {(activeChat.name || 'U')[0].toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold leading-none">{activeChat.name || activeChat.email}</h2>
                                    <p className="text-[10px] text-emerald-500 font-bold tracking-tight">E2EE ENCRYPTED</p>
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                {!activeChat ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-3 opacity-50">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
                            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Select a chat to begin</p>
                    </div>
                ) : (
                    <>
                        <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
                            {messages.map(msg => {
                                let plainText = "";
                                try {
                                    // Dekripsi setiap pesan secara realtime menggunakan kunci sesi aktif
                                    const bytes = CryptoJS.AES.decrypt(msg.text, currentChatKeyRef.current);
                                    plainText = bytes.toString(CryptoJS.enc.Utf8);
                                } catch (e) { plainText = ""; }
                                
                                const isMe = msg.sender === myUser.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                                        <div className={`max-w-[85%] md:max-w-[70%] px-4 py-3 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-card text-foreground border border-border rounded-tl-none'}`}>
                                            <p className="whitespace-pre-wrap break-words leading-relaxed font-medium">
                                                {plainText || "🔒 [Decryption Error - Invalid Key]"}
                                            </p>
                                            <span className={`text-[8px] mt-2 block font-bold opacity-60 ${isMe ? 'text-right' : 'text-left'}`}>
                                                {new Date(msg.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-4 md:p-6 border-t border-border bg-background/50 backdrop-blur-sm">
                            <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex gap-3">
                                <input 
                                    value={inputText} 
                                    onChange={(e) => setInputText(e.target.value)} 
                                    placeholder="Type an encrypted message..." 
                                    className="flex-1 h-11 bg-card border border-input rounded-full px-5 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner" 
                                />
                                <button type="submit" className="w-11 h-11 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:scale-105 active:scale-95 transition-all shadow-md">
                                    <svg className="w-5 h-5 transform rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}