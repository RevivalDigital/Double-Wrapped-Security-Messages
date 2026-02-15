"use client";

import { useEffect, useState, useRef } from 'react';
import PocketBase from 'pocketbase';
import * as CryptoJS from 'crypto-js';

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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    
    const chatBoxRef = useRef<HTMLDivElement>(null);
    const currentChatKeyRef = useRef<string>("");

    const handleLogout = () => {
        pb.authStore.clear();
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
        
        // Mobile auto-hide sidebar if chat is active
        if (window.innerWidth < 768 && activeChat) {
            setIsSidebarOpen(false);
        }

        pb.collection('friends').subscribe('*', () => loadFriends());
        return () => { pb.collection('friends').unsubscribe(); };
    }, [activeChat]);

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
        if (window.innerWidth < 768) setIsSidebarOpen(false);
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
            sender: myUser.id, receiver: activeChat.id, text: encrypted
        });
        setInputText("");
    };

    const addFriend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchId || searchId === myUser.id) return;
        try {
            const userList = await pb.collection('users').getList(1, 1, { filter: `id = "${searchId}" || email = "${searchId}"` });
            if (userList.items.length === 0) return alert("User tidak ditemukan.");
            const target = userList.items[0];
            await pb.collection('friends').create({ user: myUser.id, friend: target.id, status: 'pending', sender: myUser.id, receiver: target.id });
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
                {/* Header Sidebar */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h1 className="text-sm font-semibold tracking-tight uppercase">Bitlab Chat</h1>
                    <button onClick={() => setShowNoti(!showNoti)} className="relative p-2 hover:bg-accent rounded-md transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        {requests.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />}
                    </button>
                </div>

                {/* Notifications Dropdown (Shadcn Popover style) */}
                {showNoti && (
                    <div className="absolute top-14 left-4 right-4 bg-popover border border-border shadow-md rounded-lg z-[60] py-2 animate-in fade-in zoom-in duration-200">
                        <p className="px-4 py-1 text-[10px] font-bold text-muted-foreground uppercase">Requests</p>
                        <div className="max-h-60 overflow-y-auto">
                            {requests.length === 0 ? <p className="px-4 py-3 text-xs text-muted-foreground">No requests</p> : 
                                requests.map(req => (
                                    <div key={req.id} className="px-4 py-2 border-b border-border last:border-0 flex items-center justify-between gap-2">
                                        <span className="text-xs font-medium truncate">{req.expand.user.name || req.expand.user.email}</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => respondRequest(req.id, 'accepted')} className="px-2 py-1 bg-primary text-primary-foreground text-[10px] rounded hover:opacity-90">Accept</button>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}

                {/* Search / Add Friend */}
                <div className="p-4">
                    <form onSubmit={addFriend} className="flex gap-2">
                        <input value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="User ID/Email" className="flex-1 h-9 bg-transparent border border-input rounded-md px-3 text-xs focus:ring-1 focus:ring-ring outline-none" />
                        <button type="submit" className="h-9 px-3 bg-secondary text-secondary-foreground rounded-md text-[10px] font-medium hover:bg-secondary/80 uppercase">Add</button>
                    </form>
                </div>

                {/* Friends List */}
                <div className="flex-1 overflow-y-auto px-2 space-y-1">
                    <p className="px-2 text-[10px] font-medium text-muted-foreground uppercase mb-2">Messages</p>
                    {friends.map(f => {
                        const friendData = f.user === myUser.id ? f.expand.friend : f.expand.user;
                        const isActive = activeChat?.id === friendData.id;
                        return (
                            <button key={f.id} onClick={() => selectChat(f)} className={`w-full p-2 flex items-center gap-3 rounded-md transition-colors ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}>
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-semibold text-xs text-muted-foreground border border-border">
                                    {(friendData.name || friendData.username || 'U')[0].toUpperCase()}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="text-sm font-medium truncate">{friendData.name || friendData.username || friendData.email}</div>
                                    <p className="text-[10px] text-muted-foreground truncate italic">Secured Session</p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Current User Info */}
                <div className="p-4 border-t border-border flex items-center justify-between bg-muted/30">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                            {(myUser.name || 'M')[0].toUpperCase()}
                        </div>
                        <div className="truncate">
                            <p className="text-xs font-semibold truncate leading-none">{myUser.name || myUser.username}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{myUser.id}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="p-2 hover:text-destructive transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col bg-background relative">
                {/* Header Mobile Chat */}
                <header className="h-14 border-b border-border flex items-center px-4 justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 hover:bg-accent rounded-md">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        {activeChat && (
                            <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold border border-border">
                                    {(activeChat.name || 'U')[0].toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold leading-none">{activeChat.name || activeChat.email}</h2>
                                    <p className="text-[10px] text-emerald-500 font-medium">Encrypted</p>
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                {!activeChat ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Select a conversation</p>
                    </div>
                ) : (
                    <>
                        {/* Messages Box */}
                        <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                            {messages.map(msg => {
                                let plainText = "";
                                try {
                                    const bytes = CryptoJS.AES.decrypt(msg.text, currentChatKeyRef.current);
                                    plainText = bytes.toString(CryptoJS.enc.Utf8);
                                } catch (e) { plainText = "🔒 [Encrypted]"; }
                                const isMe = msg.sender === myUser.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-1 duration-200`}>
                                        <div className={`max-w-[85%] md:max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground border border-border'}`}>
                                            <p className="whitespace-pre-wrap break-words">{plainText || "🔒 [Decryption Error]"}</p>
                                            <span className={`text-[8px] mt-1 block opacity-50 ${isMe ? 'text-right' : 'text-left'}`}>
                                                {new Date(msg.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t border-border bg-background">
                            <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex gap-2">
                                <input value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type a message..." className="flex-1 h-10 bg-transparent border border-input rounded-md px-4 text-sm outline-none focus:ring-1 focus:ring-ring" />
                                <button type="submit" className="h-10 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">Send</button>
                            </form>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}