"use client";

import { useEffect, useState, useRef } from 'react';
import PocketBase from 'pocketbase';
import CryptoJS from 'crypto-js';

const PB_URL = process.env.NEXT_PUBLIC_PB_URL || 'https://pb.bitlab.web.id';
const pb = new PocketBase(PB_URL);

const KEY1 = process.env.NEXT_PUBLIC_KEY1 || "BITLAB-SEC-";
const KEY2 = process.env.NEXT_PUBLIC_KEY2 || "2026-PRO";
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
    
    const chatBoxRef = useRef<HTMLDivElement>(null);
    const currentChatKeyRef = useRef<string>("");

    // --- LOGOUT FUNCTION ---
    const handleLogout = () => {
        pb.authStore.clear();
        // Hapus cookie agar middleware me-redirect ke /login
        document.cookie = "pb_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        window.location.href = "/login";
    };

    const decryptSalt = (enc: string) => {
        if (!enc) return null;
        try {
            return CryptoJS.AES.decrypt(enc, INTERNAL_APP_KEY).toString(CryptoJS.enc.Utf8) || null;
        } catch (e) { return null; }
    };

    const encryptSalt = (raw: string) => CryptoJS.AES.encrypt(raw, INTERNAL_APP_KEY).toString();

    const generateChatKey = (id1: string, id2: string, salt: string) => {
        const combined = [id1, id2].sort().join("");
        return CryptoJS.SHA256(combined + salt + INTERNAL_APP_KEY).toString();
    };

    useEffect(() => {
        if (!pb.authStore.isValid) {
            window.location.href = "/login";
            return;
        }
        setMyUser(pb.authStore.model);
        loadFriends();

        pb.collection('friends').subscribe('*', () => loadFriends());
        return () => { pb.collection('friends').unsubscribe(); };
    }, []);

    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [messages]);

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

    const selectChat = async (friendRecord: any) => {
        const friendData = friendRecord.user === myUser.id ? friendRecord.expand.friend : friendRecord.expand.user;
        const salt = decryptSalt(friendRecord.chat_salt) || friendRecord.chat_salt;
        
        const key = generateChatKey(myUser.id, friendData.id, salt);
        currentChatKeyRef.current = key;
        
        setActiveChat({ ...friendData, salt });
        loadMessages(friendData.id);
        subscribeMessages(friendData.id);
    };

    const loadMessages = async (friendId: string) => {
        const res = await pb.collection('messages').getFullList({
            filter: `(sender="${myUser.id}" && receiver="${friendId}") || (sender="${friendId}" && receiver="${myUser.id}")`,
            sort: 'created'
        });
        setMessages(res);
    };

    const subscribeMessages = async (friendId: string) => {
        await pb.collection('messages').unsubscribe('*');
        await pb.collection('messages').subscribe('*', (e) => {
            if (e.action === 'create' && 
               ((e.record.sender === myUser.id && e.record.receiver === friendId) || 
                (e.record.sender === friendId && e.record.receiver === myUser.id))) {
                setMessages(prev => [...prev, e.record]);
            }
        });
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !activeChat) return;

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
        if (!searchId || searchId === myUser.id) return;
        try {
            const userList = await pb.collection('users').getList(1, 1, { 
                filter: `id = "${searchId}" || email = "${searchId}"` 
            });
            if (userList.items.length === 0) return alert("User tidak ditemukan.");
            const target = userList.items[0];
            
            await pb.collection('friends').create({
                user: myUser.id, friend: target.id, status: 'pending', sender: myUser.id, receiver: target.id
            });
            alert("Permintaan terkirim!");
            setSearchId("");
        } catch (err) { alert("Gagal kirim permintaan."); }
    };

    const respondRequest = async (id: string, action: 'accepted' | 'reject') => {
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
    };

    if (!myUser) return <div className="bg-slate-950 h-screen flex items-center justify-center text-blue-400 font-bold">LOADING SECURE ENGINE...</div>;

    return (
        <div className="bg-slate-950 text-slate-100 h-screen overflow-hidden font-sans flex">
            {/* Notification Dropdown */}
            <div className="absolute top-4 right-6 z-[100] flex flex-col items-end gap-2">
                <button onClick={() => setShowNoti(!showNoti)} className="relative p-2.5 bg-slate-900 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all shadow-2xl group">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-slate-400 group-hover:text-blue-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31a8.967 8.967 0 0 1-2.312-6.022c0-4.741-3.844-8.584-8.584-8.584s-8.584 3.844-8.584 8.584c0 2.208-.795 4.316-2.312 6.022a23.847 23.847 0 0 0 5.454 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                    </svg>
                    {requests.length > 0 && <span className="absolute top-2 right-2.5 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>}
                </button>

                {showNoti && (
                    <div className="mt-1 w-80 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl glass overflow-hidden block transform origin-top-right transition-all">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Permintaan Pertemanan</h3>
                            <span className="bg-blue-600 text-[9px] px-2 py-0.5 rounded-full font-bold">{requests.length}</span>
                        </div>
                        <div className="max-h-80 overflow-y-auto p-3 space-y-2">
                            {requests.map(req => (
                                <div key={req.id} className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
                                    <div className="text-[10px] font-bold truncate flex-1 text-left">
                                        {/* Menampilkan Name, fallback ke Email */}
                                        {req.expand.user.name || req.expand.user.email}
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => respondRequest(req.id, 'accepted')} className="bg-emerald-600 px-3 py-1.5 rounded-lg text-[10px] hover:bg-emerald-500">Terima</button>
                                        <button onClick={() => respondRequest(req.id, 'reject')} className="bg-red-600 px-3 py-1.5 rounded-lg text-[10px] hover:bg-red-500">Tolak</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar */}
            <aside className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/40">
                <div className="p-6 border-b border-slate-800">
                    <h1 className="text-xl font-black italic text-blue-400 tracking-tighter mb-4">BITLAB CHAT</h1>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3">
                        <p className="text-[8px] font-bold text-slate-500 uppercase mb-1">ID SAYA</p>
                        <code className="text-[10px] font-mono text-blue-300 italic">{myUser.id}</code>
                    </div>
                </div>

                <div className="p-4 border-b border-slate-800 bg-slate-950/30">
                    <form onSubmit={addFriend} className="relative">
                        <input 
                            type="text" 
                            value={searchId}
                            onChange={(e) => setSearchId(e.target.value)}
                            placeholder="Masukkan ID atau Email..." 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-[11px] outline-none focus:border-blue-500"
                        />
                        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 font-bold text-[10px] hover:text-blue-300">ADD</button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {friends.map(f => {
                        const friendData = f.user === myUser.id ? f.expand.friend : f.expand.user;
                        return (
                            <div key={f.id} onClick={() => selectChat(f)} className="p-4 hover:bg-blue-500/10 cursor-pointer border-b border-slate-800/30 flex items-center gap-3 transition-all">
                                <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center font-bold uppercase text-blue-400">
                                    {(friendData.name || friendData.username || 'U')[0]}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    {/* PRIORITAS NAMA */}
                                    <div className="text-xs font-bold truncate">{friendData.name || friendData.username || friendData.email}</div>
                                    <div className="text-[9px] text-slate-500 italic">Secure Connection</div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black uppercase">
                            {(myUser.name || 'M')[0]}
                        </div>
                        {/* MENAMPILKAN NAMA USER LOGIN */}
                        <p className="text-xs font-bold truncate text-slate-300">{myUser.name || myUser.username || myUser.email}</p>
                    </div>
                    {/* LOGOUT BUTTON */}
                    <button 
                        onClick={handleLogout}
                        className="p-2 hover:bg-red-500/10 rounded-lg group transition-colors"
                        title="Logout"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-slate-500 group-hover:text-red-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                        </svg>
                    </button>
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col relative bg-slate-950">
                {!activeChat ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20">
                        <p className="text-slate-600 font-bold uppercase tracking-[0.2em] text-[10px]">Pilih teman untuk chat</p>
                    </div>
                ) : (
                    <>
                        <div className="p-4 border-b border-slate-800 glass z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-black text-xs uppercase">
                                    {(activeChat.name || activeChat.username || 'U')[0]}
                                </div>
                                <div>
                                    {/* NAMA TEMAN DI HEADER CHAT */}
                                    <h2 className="font-bold text-sm">{activeChat.name || activeChat.username || activeChat.email}</h2>
                                    <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-widest">Double-Wrapped Security Enabled</p>
                                </div>
                            </div>
                        </div>

                        <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
                            {messages.map(msg => {
                                let plainText = "";
                                try {
                                    const bytes = CryptoJS.AES.decrypt(msg.text, currentChatKeyRef.current);
                                    plainText = bytes.toString(CryptoJS.enc.Utf8);
                                } catch (e) { plainText = "🔒 [Pesan Terenkripsi]"; }

                                const isMe = msg.sender === myUser.id;
                                return (
                                    <div key={msg.id} className={`max-w-[75%] p-3 rounded-2xl text-sm ${isMe ? 'bg-blue-600 self-end rounded-tr-none' : 'bg-slate-800 self-start rounded-tl-none border border-slate-700'}`}>
                                        <p>{plainText || "🔒 [Gagal Dekripsi]"}</p>
                                        <span className="text-[8px] opacity-30 mt-1 block text-right">
                                            {new Date(msg.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <form onSubmit={sendMessage} className="p-4 bg-slate-900/30 border-t border-slate-800">
                            <div className="max-w-4xl mx-auto flex gap-3">
                                <input 
                                    type="text" 
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="Tulis pesan rahasia..." 
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-sm outline-none focus:border-blue-500"
                                />
                                <button type="submit" className="bg-blue-600 px-8 rounded-2xl font-black text-[10px] uppercase hover:bg-blue-500 transition-colors">Kirim</button>
                            </div>
                        </form>
                    </>
                )}
            </main>
        </div>
    );
}