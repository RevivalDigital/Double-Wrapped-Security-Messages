"use client";

import { useEffect, useState, useRef } from 'react';
import PocketBase from 'pocketbase';
import * as CryptoJS from 'crypto-js';

const PB_URL = process.env.NEXT_PUBLIC_PB_URL || "";
const pb = new PocketBase(PB_URL);

const KEY1 = process.env.NEXT_PUBLIC_KEY1 || "";
const KEY2 = process.env.NEXT_PUBLIC_KEY2 || "";
const INTERNAL_APP_KEY = KEY1 + KEY2;

// --- TYPE DEFINITIONS ---
type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file';

interface EncryptedFileData {
    filename: string;
    mimeType: string;
    size: number;
    encryptedData: string;
}

// --- GCM HELPER FUNCTIONS ---
async function getCryptoKey(rawKey: string) {
    const enc = new TextEncoder();
    const keyData = enc.encode(rawKey.padEnd(32, '0').slice(0, 32));
    return window.crypto.subtle.importKey("raw", keyData, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptGCM(text: string, secretKey: string) {
    const enc = new TextEncoder();
    const key = await getCryptoKey(secretKey);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
}

async function decryptGCM(base64Data: string, secretKey: string) {
    try {
        const key = await getCryptoKey(secretKey);
        const combined = new Uint8Array(atob(base64Data).split("").map(c => c.charCodeAt(0)));
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);
        const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        // Fallback untuk pesan lama (non-GCM)
        try {
            const bytes = CryptoJS.AES.decrypt(base64Data, secretKey);
            const originalText = bytes.toString(CryptoJS.enc.Utf8);
            return originalText || "⚠️ Pesan tidak dapat didekripsi.";
        } catch (err) {
            return "⚠️ Kesalahan dekripsi.";
        }
    }
}

// --- FILE ENCRYPTION FUNCTIONS ---
async function encryptFile(file: File, secretKey: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                const key = await getCryptoKey(secretKey);
                const iv = window.crypto.getRandomValues(new Uint8Array(12));
                const encrypted = await window.crypto.subtle.encrypt(
                    { name: "AES-GCM", iv },
                    key,
                    arrayBuffer
                );
                const combined = new Uint8Array(iv.length + encrypted.byteLength);
                combined.set(iv);
                combined.set(new Uint8Array(encrypted), iv.length);
                resolve(btoa(String.fromCharCode(...combined)));
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

async function decryptFile(base64Data: string, secretKey: string): Promise<ArrayBuffer> {
    const key = await getCryptoKey(secretKey);
    const combined = new Uint8Array(atob(base64Data).split("").map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    return await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
}

// --- SUB-COMPONENT UNTUK DISPLAY TEXT ---
function DecryptedMessage({ text, secretKey }: { text: string; secretKey: string }) {
    const [decrypted, setDecrypted] = useState("...");
    useEffect(() => {
        decryptGCM(text, secretKey).then(setDecrypted);
    }, [text, secretKey]);
    return <p className="whitespace-pre-wrap break-words">{decrypted}</p>;
}

// --- SUB-COMPONENT UNTUK DISPLAY FILE ---
function DecryptedFile({ 
    encryptedData, 
    secretKey, 
    type 
}: { 
    encryptedData: string; 
    secretKey: string; 
    type: MessageType;
}) {
    const [fileUrl, setFileUrl] = useState<string>("");
    const [fileData, setFileData] = useState<EncryptedFileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let objectUrl = "";
        
        const decrypt = async () => {
            try {
                setLoading(true);
                setError(false);
                
                // Decrypt metadata
                const decryptedMeta = await decryptGCM(encryptedData, secretKey);
                const metadata: EncryptedFileData = JSON.parse(decryptedMeta);
                setFileData(metadata);
                
                // Decrypt file content
                const decryptedBuffer = await decryptFile(metadata.encryptedData, secretKey);
                const blob = new Blob([decryptedBuffer], { type: metadata.mimeType });
                objectUrl = URL.createObjectURL(blob);
                setFileUrl(objectUrl);
                setLoading(false);
            } catch (err) {
                console.error("File decryption error:", err);
                setError(true);
                setLoading(false);
            }
        };
        
        decrypt();
        
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [encryptedData, secretKey]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs">Mendekripsi...</span>
            </div>
        );
    }

    if (error || !fileData) {
        return (
            <div className="p-3 bg-destructive/10 rounded-lg">
                <p className="text-xs text-destructive">⚠️ Gagal mendekripsi file</p>
            </div>
        );
    }

    // Render berdasarkan tipe
    if (type === 'image') {
        return (
            <div className="max-w-sm">
                <img src={fileUrl} alt={fileData.filename} className="rounded-lg w-full h-auto" />
                <p className="text-[8px] opacity-50 mt-1">{fileData.filename}</p>
            </div>
        );
    }

    if (type === 'video') {
        return (
            <div className="max-w-md">
                <video controls className="rounded-lg w-full" src={fileUrl}>
                    Browser Anda tidak mendukung video.
                </video>
                <p className="text-[8px] opacity-50 mt-1">{fileData.filename}</p>
            </div>
        );
    }

    if (type === 'audio') {
        return (
            <div className="min-w-[280px]">
                <audio controls className="w-full" src={fileUrl}>
                    Browser Anda tidak mendukung audio.
                </audio>
                <p className="text-[8px] opacity-50 mt-1">{fileData.filename}</p>
            </div>
        );
    }

    // File biasa
    return (
        <a 
            href={fileUrl} 
            download={fileData.filename}
            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
        >
            <div className="w-10 h-10 bg-primary/20 rounded flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{fileData.filename}</p>
                <p className="text-[10px] opacity-50">{(fileData.size / 1024).toFixed(1)} KB</p>
            </div>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
        </a>
    );
}

// --- VOICE RECORDER COMPONENT ---
function VoiceRecorder({ onSend }: { onSend: (blob: Blob) => void }) {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                onSend(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setDuration(0);
            
            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Mic access denied:", err);
            alert("Gagal mengakses mikrofon");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
            chunksRef.current = [];
        }
    };

    if (!isRecording) {
        return (
            <button
                type="button"
                onClick={startRecording}
                className="w-10 h-10 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center hover:bg-secondary/80 transition-colors"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            </button>
        );
    }

    return (
        <div className="flex items-center gap-2 bg-destructive/10 px-4 py-2 rounded-full">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-mono">{Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}</span>
            <button type="button" onClick={cancelRecording} className="ml-2 p-1 hover:bg-destructive/20 rounded">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            <button type="button" onClick={stopRecording} className="p-1 bg-primary text-primary-foreground rounded hover:bg-primary/80">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
            </button>
        </div>
    );
}

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
    const [uploadingFile, setUploadingFile] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    
    const chatBoxRef = useRef<HTMLDivElement>(null);
    const currentChatKeyRef = useRef<string>("");
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    // --- EXISTING HELPERS ---
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

    // --- CACHE LOGIC ---
    const encryptCache = (data: any) => {
        try { return CryptoJS.AES.encrypt(JSON.stringify(data), INTERNAL_APP_KEY).toString(); }
        catch (e) { return null; }
    };

    const decryptCache = (encrypted: string) => {
        try {
            const bytes = CryptoJS.AES.decrypt(encrypted, INTERNAL_APP_KEY);
            const jsonStr = bytes.toString(CryptoJS.enc.Utf8);
            return jsonStr ? JSON.parse(jsonStr) : null;
        } catch (e) { return null; }
    };

    const saveMessagesToCache = (userId: string, friendId: string, messages: any[]) => {
        const cacheKey = `bitlab_chat_${userId}_${friendId}`;
        const encrypted = encryptCache({ messages, timestamp: Date.now() });
        if (encrypted) localStorage.setItem(cacheKey, encrypted);
    };

    const loadMessagesFromCache = (userId: string, friendId: string) => {
        const encrypted = localStorage.getItem(`bitlab_chat_${userId}_${friendId}`);
        if (!encrypted) return null;
        const cacheData = decryptCache(encrypted);
        if (!cacheData || Date.now() - cacheData.timestamp > 7 * 24 * 60 * 60 * 1000) return null;
        return cacheData.messages;
    };

    const clearChatCache = (userId: string, friendId?: string) => {
        if (friendId) localStorage.removeItem(`bitlab_chat_${userId}_${friendId}`);
        else Object.keys(localStorage).forEach(k => k.startsWith(`bitlab_chat_${userId}_`) && localStorage.removeItem(k));
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
            await loadUnreadCounts(records.filter(r => r.status === 'accepted'));
        } catch (err) { console.error(err); }
    };

    const loadUnreadCounts = async (friendRecords: any[]) => {
        try {
            const myId = pb.authStore.model?.id;
            const newCounts: Record<string, number> = {};
            for (const f of friendRecords) {
                const friendData = f.user === myId ? f.expand?.friend : f.expand?.user;
                const lastRead = f.user === myId ? f.last_read_user : f.last_read_friend;
                if (friendData?.id) {
                    const filter = lastRead ? `sender="${friendData.id}" && receiver="${myId}" && created>"${lastRead}"` : `sender="${friendData.id}" && receiver="${myId}"`;
                    const result = await pb.collection('messages').getList(1, 1, { filter, fields: 'id' });
                    if (result.totalItems > 0) newCounts[friendData.id] = result.totalItems;
                }
            }
            setUnreadCounts(newCounts);
        } catch (err) { console.error(err); }
    };

    const respondRequest = async (id: string, action: 'accepted' | 'reject') => {
        try {
            if (action === 'accepted') {
                const salt = Math.random().toString(36).substring(2, 8).toUpperCase();
                await pb.collection('friends').update(id, { status: "accepted", chat_salt: encryptSalt(salt) });
            } else await pb.collection('friends').delete(id);
            loadFriends();
        } catch (err) { console.error(err); }
    };

    const triggerLocalNotification = (name: string) => {
        if (Notification.permission === "granted") new Notification("Pesan Baru", { body: `Pesan rahasia dari ${name}`, icon: "/icon.png" });
    };

    // --- REALTIME ENGINE ---
    useEffect(() => {
        if (!pb.authStore.isValid) { window.location.href = "/login"; return; }
        setMyUser(pb.authStore.model);
        loadFriends();
        if (typeof window !== "undefined" && "Notification" in window) Notification.requestPermission();

        pb.collection('friends').subscribe('*', () => loadFriends());
        pb.collection('messages').subscribe('*', async (e) => {
            if (e.action === 'create') {
                const msg = e.record;
                const myId = pb.authStore.model?.id;
                if (!myId) return;

                const isRelevant = activeChat && ((msg.sender === myId && msg.receiver === activeChat.id) || (msg.sender === activeChat.id && msg.receiver === myId));

                if (isRelevant) {
                    setMessages(prev => {
                        const updated = [...prev, msg];
                        saveMessagesToCache(myId, activeChat.id, updated);
                        return updated;
                    });
                }

                if (msg.receiver === myId && (!activeChat || msg.sender !== activeChat.id)) {
                    setUnreadCounts(prev => ({ ...prev, [msg.sender]: (prev[msg.sender] || 0) + 1 }));
                    try {
                        const sender = await pb.collection('users').getOne(msg.sender);
                        triggerLocalNotification(sender.name || sender.username || "Seseorang");
                    } catch { triggerLocalNotification("Seseorang"); }
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
        if (!myUser?.id) return;
        setMessages([]);
        setLoadingMessages(true);
        setLoadError(null);
        
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = setTimeout(() => loadingMessages && setIsLoadingTimeout(true), 5000);
        
        const friendData = friendRecord.user === myUser.id ? friendRecord.expand.friend : friendRecord.expand.user;
        const salt = decryptSalt(friendRecord.chat_salt) || "fallback";
        const key = generateChatKey(myUser.id, friendData.id, salt);
        currentChatKeyRef.current = key;
        
        setActiveChat({ ...friendData, salt, friendRecordId: friendRecord.id });
        setUnreadCounts(prev => { const n = { ...prev }; delete n[friendData.id]; return n; });

        try {
            const isUserFirst = friendRecord.user === myUser.id;
            await pb.collection('friends').update(friendRecord.id, {
                [isUserFirst ? 'last_read_user' : 'last_read_friend']: new Date().toISOString()
            });
        } catch (err) { console.error(err); }
        
        const cached = loadMessagesFromCache(myUser.id, friendData.id);
        if (cached) { setMessages(cached); setLoadingMessages(false); }
        
        try {
            const res = await pb.collection('messages').getList(1, 50, {
                filter: `(sender="${myUser.id}" && receiver="${friendData.id}") || (sender="${friendData.id}" && receiver="${myUser.id}")`,
                sort: '-created',
                $autoCancel: false
            });
            const fresh = res.items.reverse();
            setMessages(fresh);
            saveMessagesToCache(myUser.id, friendData.id, fresh);
        } catch (err: any) {
            if (!err?.isAbort) setLoadError(err?.message || 'Failed to load');
        } finally {
            setLoadingMessages(false);
            setIsLoadingTimeout(false);
        }
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !activeChat) return;
        try {
            const encrypted = await encryptGCM(inputText.trim(), currentChatKeyRef.current);
            await pb.collection('messages').create({ 
                sender: myUser.id, 
                receiver: activeChat.id, 
                text: encrypted,
                type: 'text'
            });
            setInputText("");
        } catch (err) {
            console.error("Encryption failed", err);
        }
    };

    // --- FILE HANDLING ---
    const handleFileUpload = async (file: File, type: MessageType) => {
        if (!activeChat || !file) return;
        
        // Validasi ukuran file (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert("File terlalu besar. Maksimal 10MB");
            return;
        }

        try {
            setUploadingFile(true);
            
            // Encrypt file
            const encryptedFileData = await encryptFile(file, currentChatKeyRef.current);
            
            // Prepare metadata
            const metadata: EncryptedFileData = {
                filename: file.name,
                mimeType: file.type,
                size: file.size,
                encryptedData: encryptedFileData
            };
            
            // Encrypt metadata
            const encryptedMetadata = await encryptGCM(JSON.stringify(metadata), currentChatKeyRef.current);
            
            // Send message
            await pb.collection('messages').create({
                sender: myUser.id,
                receiver: activeChat.id,
                text: encryptedMetadata,
                type: type
            });
            
            setShowAttachMenu(false);
        } catch (err) {
            console.error("File upload failed:", err);
            alert("Gagal mengirim file");
        } finally {
            setUploadingFile(false);
        }
    };

    const handleVoiceMessage = async (blob: Blob) => {
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        await handleFileUpload(file, 'audio');
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
            {/* Hidden file inputs */}
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'image')}
            />
            <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'video')}
            />
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'file')}
            />

            <div className={`fixed inset-0 bg-black/50 z-40 md:hidden ${isSidebarOpen ? 'block' : 'hidden'}`} onClick={() => setIsSidebarOpen(false)} />

            <aside className={`fixed md:relative inset-y-0 left-0 w-80 bg-card border-r border-border flex flex-col z-50 transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h1 className="text-sm font-bold uppercase tracking-tighter">Bitlab Chat</h1>
                    <button onClick={() => setShowNoti(!showNoti)} className="relative p-2 hover:bg-accent rounded-md">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        {(requests.length > 0 || Object.values(unreadCounts).reduce((a,b)=>a+b,0) > 0) && (
                            <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold px-1 animate-pulse">
                                {requests.length + Object.values(unreadCounts).reduce((a,b)=>a+b,0)}
                            </span>
                        )}
                    </button>
                </div>

                {showNoti && (
                    <div className="absolute top-14 left-4 right-4 bg-popover border border-border shadow-xl rounded-lg z-[60] py-2">
                        <p className="px-4 py-1 text-[10px] font-bold text-muted-foreground uppercase">Requests</p>
                        {requests.length === 0 ? <p className="px-4 py-3 text-xs">No pending requests</p> : 
                            requests.map(req => (
                                <div key={req.id} className="px-4 py-2 flex items-center justify-between border-b last:border-0">
                                    <span className="text-xs truncate font-medium">{req.expand?.user?.name || req.expand?.user?.email}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => respondRequest(req.id, 'accepted')} className="px-2 py-1 bg-primary text-white text-[10px] rounded">Accept</button>
                                        <button onClick={() => respondRequest(req.id, 'reject')} className="px-2 py-1 bg-destructive text-white text-[10px] rounded">Reject</button>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                )}

                <div className="p-4">
                    <form onSubmit={addFriend} className="flex gap-2">
                        <input value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="User ID / Email" className="flex-1 h-9 bg-transparent border border-input rounded-md px-3 text-xs outline-none" />
                        <button type="submit" className="h-9 px-3 bg-secondary text-secondary-foreground rounded-md text-[10px] font-bold">ADD</button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto px-2 space-y-1">
                    <p className="px-2 text-[10px] font-bold text-muted-foreground uppercase mb-2">Direct Messages</p>
                    {friends.map(f => {
                        const friendData = f.user === myUser.id ? f.expand?.friend : f.expand?.user;
                        const unread = unreadCounts[friendData?.id] || 0;
                        return (
                            <button key={f.id} onClick={() => selectChat(f)} className={`w-full p-2 flex items-center gap-3 rounded-md transition-all ${activeChat?.id === friendData?.id ? 'bg-accent' : 'hover:bg-accent/40'}`}>
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-xs border border-border">{(friendData?.name || 'U')[0].toUpperCase()}</div>
                                    {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold px-1 border-2 border-card">{unread}</span>}
                                </div>
                                <div className="text-left truncate flex-1">
                                    <div className="text-sm font-semibold truncate">{friendData?.name || friendData?.email}</div>
                                    <p className={`text-[10px] font-bold ${unread > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{unread > 0 ? `${unread} pesan baru` : 'Secured Session'}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
                
                <div className="p-4 border-t border-border bg-muted/20 space-y-2">
                    <button onClick={() => window.location.href = "/profile"} className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent group">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground">{(myUser.name || 'M')[0].toUpperCase()}</div>
                        <div className="flex-1 text-left truncate"><p className="text-xs font-bold truncate">{myUser.name || myUser.username}</p></div>
                    </button>
                    <button onClick={() => { if(confirm('Clear cache?')) clearChatCache(myUser.id); }} className="w-full flex items-center gap-2 p-2 text-xs text-muted-foreground hover:text-foreground">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        <span>Clear Cache</span>
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col bg-background">
                <header className="h-14 border-b border-border flex items-center px-4 justify-between bg-background/95 backdrop-blur sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 hover:bg-accent rounded-md"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                        {activeChat && (
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold border border-border shadow-sm">{(activeChat.name || 'U')[0].toUpperCase()}</div>
                                <div><h2 className="text-sm font-bold leading-none">{activeChat.name || activeChat.email}</h2><p className="text-[10px] text-emerald-500 font-bold mt-0.5">AES-GCM PROTECTED</p></div>
                            </div>
                        )}
                    </div>
                </header>

                {!activeChat ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-3 opacity-30"><p className="text-[10px] font-bold uppercase tracking-widest">Select a session</p></div>
                ) : (
                    <>
                        <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                            {loadingMessages ? (
                                <div className="flex items-center justify-center h-full"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
                            ) : loadError ? (
                                <div className="flex items-center justify-center h-full text-center"><p className="text-destructive text-sm">{loadError}</p></div>
                            ) : (
                                messages.map((m, idx) => (
                                    <div key={m.id || idx} className={`flex ${m.sender === myUser.id ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${m.sender === myUser.id ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'}`}>
                                            {m.type === 'text' ? (
                                                <DecryptedMessage text={m.text} secretKey={currentChatKeyRef.current} />
                                            ) : (
                                                <DecryptedFile 
                                                    encryptedData={m.text} 
                                                    secretKey={currentChatKeyRef.current}
                                                    type={m.type as MessageType}
                                                />
                                            )}
                                            <p className="text-[8px] opacity-50 mt-1 text-right">{new Date(m.created).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        <form onSubmit={sendMessage} className="p-4 border-t border-border bg-background">
                            {uploadingFile && (
                                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    <span>Mengenkripsi dan mengirim...</span>
                                </div>
                            )}
                            
                            <div className="flex gap-2 items-center">
                                {/* Attach button */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowAttachMenu(!showAttachMenu)}
                                        className="w-10 h-10 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center hover:bg-secondary/80 transition-colors"
                                        disabled={uploadingFile}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                        </svg>
                                    </button>
                                    
                                    {showAttachMenu && (
                                        <div className="absolute bottom-full left-0 mb-2 bg-popover border border-border rounded-lg shadow-xl p-2 space-y-1 min-w-[160px]">
                                            <button
                                                type="button"
                                                onClick={() => { imageInputRef.current?.click(); setShowAttachMenu(false); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent rounded text-sm"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                <span>Gambar</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { videoInputRef.current?.click(); setShowAttachMenu(false); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent rounded text-sm"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                                <span>Video</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent rounded text-sm"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <span>File</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Voice recorder */}
                                <VoiceRecorder onSend={handleVoiceMessage} />
                                
                                {/* Text input */}
                                <input 
                                    value={inputText} 
                                    onChange={(e) => setInputText(e.target.value)} 
                                    placeholder="Type a message..." 
                                    className="flex-1 h-10 bg-muted rounded-full px-4 text-sm outline-none focus:ring-2 focus:ring-primary" 
                                    disabled={uploadingFile}
                                />
                                
                                {/* Send button */}
                                <button 
                                    type="submit" 
                                    className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                                    disabled={uploadingFile}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </main>
        </div>
    );
}
