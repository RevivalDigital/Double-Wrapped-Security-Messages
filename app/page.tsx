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
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isLoadingTimeout, setIsLoadingTimeout] = useState(false);
    
    const chatBoxRef = useRef<HTMLDivElement>(null);
    const currentChatKeyRef = useRef<string>("");
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- HELPER ENCRYPTION (TIDAK BERUBAH) ---
    const encryptSalt = (raw: string) => CryptoJS.AES.encrypt(raw, INTERNAL_APP_KEY).toString();
    
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

    // --- LOCAL STORAGE CACHE (ENCRYPTED) ---
    const encryptCache = (data: any) => {
        try {
            const jsonStr = JSON.stringify(data);
            return CryptoJS.AES.encrypt(jsonStr, INTERNAL_APP_KEY).toString();
        } catch (e) {
            console.error('Encrypt cache error:', e);
            return null;
        }
    };

    const decryptCache = (encrypted: string) => {
        try {
            const bytes = CryptoJS.AES.decrypt(encrypted, INTERNAL_APP_KEY);
            const jsonStr = bytes.toString(CryptoJS.enc.Utf8);
            return jsonStr ? JSON.parse(jsonStr) : null;
        } catch (e) {
            console.error('Decrypt cache error:', e);
            return null;
        }
    };

    const getCacheKey = (userId: string, friendId: string) => {
        return `bitlab_chat_${userId}_${friendId}`;
    };

    const saveMessagesToCache = (userId: string, friendId: string, messages: any[]) => {
        try {
            const cacheKey = getCacheKey(userId, friendId);
            const cacheData = {
                messages,
                timestamp: Date.now(),
                version: '1.0' // Untuk migration jika format berubah
            };
            const encrypted = encryptCache(cacheData);
            if (encrypted) {
                localStorage.setItem(cacheKey, encrypted);
                console.log(`💾 Cached ${messages.length} messages for ${friendId}`);
            }
        } catch (e) {
            console.error('Save cache error:', e);
        }
    };

    const loadMessagesFromCache = (userId: string, friendId: string) => {
        try {
            const cacheKey = getCacheKey(userId, friendId);
            const encrypted = localStorage.getItem(cacheKey);
            
            if (!encrypted) return null;
            
            const cacheData = decryptCache(encrypted);
            if (!cacheData || !cacheData.messages) return null;
            
            // Cache expires after 7 days
            const age = Date.now() - cacheData.timestamp;
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
            
            if (age > maxAge) {
                localStorage.removeItem(cacheKey);
                console.log('🗑️ Cache expired, removed');
                return null;
            }
            
            console.log(`📦 Loaded ${cacheData.messages.length} messages from cache`);
            return cacheData.messages;
        } catch (e) {
            console.error('Load cache error:', e);
            return null;
        }
    };

    const clearChatCache = (userId: string, friendId?: string) => {
        try {
            if (friendId) {
                // Clear specific chat
                const cacheKey = getCacheKey(userId, friendId);
                localStorage.removeItem(cacheKey);
                console.log(`🗑️ Cleared cache for ${friendId}`);
            } else {
                // Clear all chats for user
                const prefix = `bitlab_chat_${userId}_`;
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith(prefix)) {
                        localStorage.removeItem(key);
                    }
                });
                console.log('🗑️ Cleared all chat cache');
            }
        } catch (e) {
            console.error('Clear cache error:', e);
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
            
            // Load unread counts dari database
            await loadUnreadCounts(records.filter(r => r.status === 'accepted'));
        } catch (err) { console.error(err); }
    };

    const loadUnreadCounts = async (friendRecords: any[]) => {
        try {
            const myId = pb.authStore.model?.id;
            const newCounts: Record<string, number> = {};
            
            for (const f of friendRecords) {
                const friendData = f.user === myId ? f.expand?.friend : f.expand?.user;
                const isUserFirst = f.user === myId;
                const lastRead = isUserFirst ? f.last_read_user : f.last_read_friend;
                
                if (friendData?.id) {
                    // Hitung pesan yang belum dibaca
                    const filter = lastRead 
                        ? `sender="${friendData.id}" && receiver="${myId}" && created>"${lastRead}"`
                        : `sender="${friendData.id}" && receiver="${myId}"`;
                    
                    const result = await pb.collection('messages').getList(1, 1, {
                        filter,
                        fields: 'id'
                    });
                    
                    if (result.totalItems > 0) {
                        newCounts[friendData.id] = result.totalItems;
                    }
                }
            }
            
            setUnreadCounts(newCounts);
        } catch (err) {
            console.error('Error loading unread counts:', err);
        }
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

    const triggerLocalNotification = (senderName: string) => {
        if (Notification.permission === "granted") {
            new Notification("Pesan Baru", {
                body: `Pesan rahasia baru dari ${senderName}`,
                icon: "/icon.png"
            });
        }
    };

    const getTotalUnread = () => {
        return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
    };

    // --- REALTIME ENGINE ---
    useEffect(() => {
        if (!pb.authStore.isValid) { window.location.href = "/login"; return; }
        setMyUser(pb.authStore.model);
        loadFriends();
        
        if (typeof window !== "undefined" && "Notification" in window) {
            Notification.requestPermission();
        }

        // Realtime Friends & Requests
        pb.collection('friends').subscribe('*', () => loadFriends());

        // Realtime Global Messages (NOTIFIKASI + SYNC UI)
        pb.collection('messages').subscribe('*', async (e) => {
            if (e.action === 'create') {
                const msg = e.record;
                const myId = pb.authStore.model?.id;
                if (!myId) return; // Guard clause
                
                const isForMe = msg.receiver === myId;
                const isFromMe = msg.sender === myId;
                const isFromActive = activeChat && msg.sender === activeChat.id;

                // Sync UI jika chat sedang dibuka
                if (isFromActive || isFromMe) {
                    setMessages(prev => {
                        const updated = [...prev, msg];
                        
                        // Update cache dengan pesan baru
                        if (activeChat && myId) {
                            saveMessagesToCache(myId, activeChat.id, updated);
                        }
                        
                        return updated;
                    });
                }

                // Notifikasi jika tab sedang di-minimize atau sedang buka chat orang lain
                if (isForMe && !isFromActive) {
                    // Increment unread count di memory (untuk real-time UI)
                    setUnreadCounts(prev => ({
                        ...prev,
                        [msg.sender]: (prev[msg.sender] || 0) + 1
                    }));

                    // Get sender name for notification
                    try {
                        const sender = await pb.collection('users').getOne(msg.sender);
                        triggerLocalNotification(sender.name || sender.username || sender.email || "Seseorang");
                    } catch (err) {
                        triggerLocalNotification("Seseorang");
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

    const selectChat = async (friendRecord: any) => {
        if (!myUser?.id) return; // Guard clause untuk TypeScript
        
        setLoadingMessages(true);
        setLoadError(null);
        setIsLoadingTimeout(false);
        
        // Clear previous timeout
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
        }
        
        // Set timeout warning after 5 seconds
        loadingTimeoutRef.current = setTimeout(() => {
            if (loadingMessages) {
                setIsLoadingTimeout(true);
                console.warn('⚠️ Loading taking longer than expected...');
            }
        }, 5000);
        
        const friendData = friendRecord.user === myUser.id ? friendRecord.expand.friend : friendRecord.expand.user;
        const salt = decryptSalt(friendRecord.chat_salt) || "fallback";
        const key = generateChatKey(myUser.id, friendData.id, salt);
        currentChatKeyRef.current = key;
        
        setActiveChat({ ...friendData, salt, friendRecordId: friendRecord.id });
        
        // Reset unread count untuk friend ini (di memory)
        setUnreadCounts(prev => {
            const newCounts = { ...prev };
            delete newCounts[friendData.id];
            return newCounts;
        });
        
        // Update last_read di database untuk persistensi
        try {
            const isUserFirst = friendRecord.user === myUser.id;
            const updateData = isUserFirst 
                ? { last_read_user: new Date().toISOString() }
                : { last_read_friend: new Date().toISOString() };
            await pb.collection('friends').update(friendRecord.id, updateData);
        } catch (err) {
            console.error('Error updating last_read:', err);
        }
        
        // STEP 1: Load dari cache dulu (instant)
        const cachedMessages = loadMessagesFromCache(myUser.id, friendData.id);
        if (cachedMessages && cachedMessages.length > 0) {
            setMessages(cachedMessages);
            setLoadingMessages(false); // Hide loading karena sudah ada cache
            setLoadError(null);
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
            console.log('✅ Loaded from cache, syncing with server...');
        }
        
        // STEP 2: Sync dengan server di background
        try {
            const res = await pb.collection('messages').getList(1, 50, {
                filter: `(sender="${myUser.id}" && receiver="${friendData.id}") || (sender="${friendData.id}" && receiver="${myUser.id}")`,
                sort: '-created' // Descending (terbaru dulu)
            });
            
            const freshMessages = res.items.reverse();
            
            // Update UI dengan data fresh dari server
            setMessages(freshMessages);
            setLoadError(null);
            
            // Save ke cache untuk next time
            saveMessagesToCache(myUser.id, friendData.id, freshMessages);
            
        } catch (err: any) {
            console.error('Error loading messages:', err);
            const errorMsg = err?.message || 'Failed to load messages';
            setLoadError(errorMsg);
            
            // Jika error dan tidak ada cache, set empty
            if (!cachedMessages) {
                setMessages([]);
            }
        } finally {
            setLoadingMessages(false);
            setIsLoadingTimeout(false);
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
        }
        
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    // Retry loading messages
    const retryLoadMessages = () => {
        if (activeChat?.friendRecordId) {
            const friendRecord = friends.find(f => f.id === activeChat.friendRecordId);
            if (friendRecord) {
                selectChat(friendRecord);
            }
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !activeChat) return;
        const encrypted = CryptoJS.AES.encrypt(inputText.trim(), currentChatKeyRef.current).toString();
        await pb.collection('messages').create({ sender: myUser.id, receiver: activeChat.id, text: encrypted });
        setInputText("");
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

    if (!myUser) return <div className="h-screen flex items-center justify-center bg-background">Initializing...</div>;

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden border-t border-border">
            {/* Sidebar Overlay Mobile */}
            <div className={`fixed inset-0 bg-black/50 z-40 md:hidden ${isSidebarOpen ? 'block' : 'hidden'}`} onClick={() => setIsSidebarOpen(false)} />

            {/* Sidebar */}
            <aside className={`fixed md:relative inset-y-0 left-0 w-80 bg-card border-r border-border flex flex-col z-50 transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h1 className="text-sm font-bold uppercase tracking-tighter">Bitlab Chat</h1>
                    <button onClick={() => setShowNoti(!showNoti)} className="relative p-2 hover:bg-accent rounded-md">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        {(requests.length > 0 || getTotalUnread() > 0) && (
                            <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold px-1 shadow-lg animate-pulse">
                                {requests.length + getTotalUnread()}
                            </span>
                        )}
                    </button>
                </div>

                {/* Notifikasi Permintaan Teman (DIPERBAIKI) */}
                {showNoti && (
                    <div className="absolute top-14 left-4 right-4 bg-popover border border-border shadow-xl rounded-lg z-[60] py-2">
                        <p className="px-4 py-1 text-[10px] font-bold text-muted-foreground uppercase">Friend Requests</p>
                        {requests.length === 0 ? <p className="px-4 py-3 text-xs">No pending requests</p> : 
                            requests.map(req => (
                                <div key={req.id} className="px-4 py-2 flex items-center justify-between border-b last:border-0">
                                    <span className="text-xs truncate font-medium">{req.expand?.user?.name || req.expand?.user?.email || "Unknown User"}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => respondRequest(req.id, 'accepted')} className="px-2 py-1 bg-primary text-white text-[10px] rounded hover:opacity-80">Accept</button>
                                        <button onClick={() => respondRequest(req.id, 'reject')} className="px-2 py-1 bg-destructive text-white text-[10px] rounded hover:opacity-80">Reject</button>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                )}

                <div className="p-4">
                    <form onSubmit={addFriend} className="flex gap-2">
                        <input value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="User ID / Email" className="flex-1 h-9 bg-transparent border border-input rounded-md px-3 text-xs outline-none focus:ring-1 focus:ring-primary" />
                        <button type="submit" className="h-9 px-3 bg-secondary text-secondary-foreground rounded-md text-[10px] font-bold">ADD</button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto px-2 space-y-1">
                    <p className="px-2 text-[10px] font-bold text-muted-foreground uppercase mb-2">Direct Messages</p>
                    {friends.map(f => {
                        const friendData = f.user === myUser.id ? f.expand?.friend : f.expand?.user;
                        const unreadCount = unreadCounts[friendData?.id] || 0;
                        return (
                            <button key={f.id} onClick={() => selectChat(f)} className={`w-full p-2 flex items-center gap-3 rounded-md transition-all ${activeChat?.id === friendData?.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/40'}`}>
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-xs border border-border">{(friendData?.name || 'U')[0].toUpperCase()}</div>
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold px-1 shadow-lg border-2 border-card">
                                            {unreadCount}
                                        </span>
                                    )}
                                </div>
                                <div className="text-left truncate flex-1">
                                    <div className="text-sm font-semibold truncate">{friendData?.name || friendData?.username || friendData?.email}</div>
                                    {unreadCount > 0 ? (
                                        <p className="text-[10px] text-red-500 font-bold">{unreadCount} pesan baru</p>
                                    ) : (
                                        <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Secured Session</p>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
                
                {/* INFO AKUN DI SIDEBAR BAWAH (DIPERTAHANKAN) */}
                <div className="p-4 border-t border-border bg-muted/20 space-y-2">
                    <button 
                        onClick={() => window.location.href = "/profile"} 
                        className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors group"
                    >
                        {myUser.avatar ? (
                            <img 
                                src={`${PB_URL}/api/files/_pb_users_auth_/${myUser.id}/${myUser.avatar}`}
                                alt="Avatar"
                                className="w-8 h-8 rounded-full object-cover border border-border"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                                {(myUser.name || 'M')[0].toUpperCase()}
                            </div>
                        )}
                        <div className="flex-1 text-left truncate">
                            <p className="text-xs font-bold truncate leading-none">{myUser.name || myUser.username}</p>
                            <p className="text-[9px] text-muted-foreground truncate mt-1">View Profile</p>
                        </div>
                        <svg className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    
                    {/* Clear Cache Button */}
                    <button 
                        onClick={() => {
                            if (confirm('Clear all cached messages? This will free up storage but messages will need to reload from server.')) {
                                clearChatCache(myUser.id);
                                alert('✅ Cache cleared successfully!');
                            }
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 transition-colors text-xs text-muted-foreground hover:text-foreground"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Clear Cache</span>
                    </button>
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col bg-background">
                <header className="h-14 border-b border-border flex items-center px-4 justify-between bg-background/95 backdrop-blur sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 hover:bg-accent rounded-md">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        {activeChat && (
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold border border-border shadow-sm">{(activeChat.name || 'U')[0].toUpperCase()}</div>
                                <div>
                                    <h2 className="text-sm font-bold leading-none">{activeChat.name || activeChat.email}</h2>
                                    <p className="text-[10px] text-emerald-500 font-bold mt-0.5">E2EE ENCRYPTED</p>
                                </div>
                            </div>
                        )}
                    </div>
                    {activeChat && (
                        <button 
                            onClick={retryLoadMessages}
                            disabled={loadingMessages}
                            className="p-2 hover:bg-accent rounded-md transition-colors disabled:opacity-50"
                            title="Sync messages"
                        >
                            <svg className={`w-4 h-4 ${loadingMessages ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    )}
                </header>

                {!activeChat ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-3 opacity-30">
                        <p className="text-[10px] font-bold uppercase tracking-widest">Select a session to chat</p>
                    </div>
                ) : (
                    <>
                        <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                            {loadingMessages ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center space-y-3">
                                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                                        <p className="text-sm text-muted-foreground">Loading messages...</p>
                                        {isLoadingTimeout && (
                                            <div className="space-y-2">
                                                <p className="text-xs text-yellow-500">Taking longer than expected...</p>
                                                <button 
                                                    onClick={retryLoadMessages}
                                                    className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-xs font-semibold hover:opacity-90 transition-opacity"
                                                >
                                                    Cancel & Retry
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : loadError ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center space-y-3 max-w-md">
                                        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                                            <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-destructive mb-1">Failed to Load Messages</p>
                                            <p className="text-xs text-muted-foreground">{loadError}</p>
                                        </div>
                                        <button 
                                            onClick={retryLoadMessages}
                                            className="px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Retry
                                        </button>
                                    </div>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center space-y-3">
                                        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto">
                                            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">No messages yet</p>
                                            <p className="text-xs text-muted-foreground mt-1">Start the conversation! 👋</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                messages.map(msg => {
                                let plainText = "";
                                try {
                                    const bytes = CryptoJS.AES.decrypt(msg.text, currentChatKeyRef.current);
                                    plainText = bytes.toString(CryptoJS.enc.Utf8);
                                } catch (e) { plainText = ""; }
                                const isMe = msg.sender === myUser.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-card border border-border rounded-tl-none'}`}>
                                            <p className="break-words leading-relaxed">{plainText || "🔒 [Decryption Error]"}</p>
                                            <span className="text-[8px] mt-1 block opacity-50 text-right">{new Date(msg.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                );
                            })
                            )}
                        </div>
                        <div className="p-4 border-t border-border bg-background/50">
                            <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex gap-3">
                                <input value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type an encrypted message..." className="flex-1 h-11 bg-card border border-input rounded-full px-5 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner" />
                                <button type="submit" className="w-11 h-11 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:scale-105 transition-all shadow-md">
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
