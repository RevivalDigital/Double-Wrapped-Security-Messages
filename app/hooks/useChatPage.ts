import { useEffect, useRef, useState } from 'react';
import PocketBase from 'pocketbase';

const PB_URL = process.env.NEXT_PUBLIC_PB_URL || "";
export const pb = new PocketBase(PB_URL);

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file';

export interface FileMetadata {
    filename: string;
    mimeType: string;
    size: number;
}

export interface FilePreview {
    file: File;
    type: MessageType;
    previewUrl?: string;
}

interface StoredKeyPair {
    publicKey: JsonWebKey;
    privateKey: JsonWebKey;
    userId: string;
    timestamp: number;
}

class SecureIndexedDB {
    private dbName = 'BitlabSecureChat';
    private version = 1;
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains('keyPairs')) {
                    db.createObjectStore('keyPairs', { keyPath: 'userId' });
                }

                if (!db.objectStoreNames.contains('messages')) {
                    const msgStore = db.createObjectStore('messages', { keyPath: 'cacheKey' });
                    msgStore.createIndex('userId', 'userId', { unique: false });
                    msgStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('sharedSecrets')) {
                    db.createObjectStore('sharedSecrets', { keyPath: 'id' });
                }
            };
        });
    }

    async saveKeyPair(userId: string, publicKey: JsonWebKey, privateKey: JsonWebKey): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(['keyPairs'], 'readwrite');
            const store = tx.objectStore('keyPairs');
            const data: StoredKeyPair = { userId, publicKey, privateKey, timestamp: Date.now() };

            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getKeyPair(userId: string): Promise<StoredKeyPair | null> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(['keyPairs'], 'readonly');
            const store = tx.objectStore('keyPairs');
            const request = store.get(userId);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async saveMessages(userId: string, friendId: string, messages: any[]): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(['messages'], 'readwrite');
            const store = tx.objectStore('messages');
            const cacheKey = `${userId}_${friendId}`;

            const request = store.put({
                cacheKey,
                userId,
                friendId,
                messages,
                timestamp: Date.now()
            });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getMessages(userId: string, friendId: string): Promise<any[] | null> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(['messages'], 'readonly');
            const store = tx.objectStore('messages');
            const cacheKey = `${userId}_${friendId}`;
            const request = store.get(cacheKey);

            request.onsuccess = () => {
                const data = request.result;
                if (!data) return resolve(null);

                if (Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
                    this.deleteMessages(userId, friendId);
                    return resolve(null);
                }

                resolve(data.messages);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteMessages(userId: string, friendId: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(['messages'], 'readwrite');
            const store = tx.objectStore('messages');
            const cacheKey = `${userId}_${friendId}`;
            const request = store.delete(cacheKey);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAllMessages(userId: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(['keyPairs', 'messages', 'sharedSecrets'], 'readwrite');

            const keyStore = tx.objectStore('keyPairs');
            try {
                keyStore.delete(userId);
            } catch {
            }

            const msgStore = tx.objectStore('messages');
            try {
                const index = msgStore.index('userId');
                const request = index.openCursor(IDBKeyRange.only(userId));

                request.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest).result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    }
                };
            } catch {
            }

            const secretStore = tx.objectStore('sharedSecrets');
            try {
                secretStore.clear();
            } catch {
            }

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async saveSharedSecret(id: string, secret: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(['sharedSecrets'], 'readwrite');
            const store = tx.objectStore('sharedSecrets');
            const request = store.put({ id, secret, timestamp: Date.now() });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getSharedSecret(id: string): Promise<string | null> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(['sharedSecrets'], 'readonly');
            const store = tx.objectStore('sharedSecrets');
            const request = store.get(id);

            request.onsuccess = () => {
                const data = request.result;
                resolve(data ? data.secret : null);
            };
            request.onerror = () => reject(request.error);
        });
    }
}

const secureDB = new SecureIndexedDB();

export class ECDHCrypto {
    static async generateKeyPair(): Promise<CryptoKeyPair> {
        return window.crypto.subtle.generateKey(
            {
                name: "ECDH",
                namedCurve: "P-256"
            },
            true,
            ["deriveKey", "deriveBits"]
        );
    }

    static async exportPublicKey(publicKey: CryptoKey): Promise<JsonWebKey> {
        return window.crypto.subtle.exportKey("jwk", publicKey);
    }

    static async exportPrivateKey(privateKey: CryptoKey): Promise<JsonWebKey> {
        return window.crypto.subtle.exportKey("jwk", privateKey);
    }

    static async importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
        return window.crypto.subtle.importKey(
            "jwk",
            jwk,
            { name: "ECDH", namedCurve: "P-256" },
            true,
            []
        );
    }

    static async importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
        return window.crypto.subtle.importKey(
            "jwk",
            jwk,
            { name: "ECDH", namedCurve: "P-256" },
            true,
            ["deriveKey", "deriveBits"]
        );
    }

    static async deriveSharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
        return window.crypto.subtle.deriveKey(
            { name: "ECDH", public: publicKey },
            privateKey,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    }

    static async encryptPrivateKeyWithPassphrase(privateKeyJwk: JsonWebKey, passphrase: string): Promise<string> {
        const encoder = new TextEncoder();
        const passphraseData = encoder.encode(passphrase);

        const passphraseKey = await window.crypto.subtle.importKey(
            "raw",
            passphraseData,
            "PBKDF2",
            false,
            ["deriveBits", "deriveKey"]
        );

        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const derivedKey = await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 100000,
                hash: "SHA-256"
            },
            passphraseKey,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );

        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const privateKeyString = JSON.stringify(privateKeyJwk);
        const encrypted = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            derivedKey,
            encoder.encode(privateKeyString)
        );

        const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(encrypted), salt.length + iv.length);

        return btoa(String.fromCharCode(...combined));
    }

    static async decryptPrivateKeyWithPassphrase(encryptedData: string, passphrase: string): Promise<JsonWebKey> {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const passphraseData = encoder.encode(passphrase);

        const combined = new Uint8Array(atob(encryptedData).split("").map(c => c.charCodeAt(0)));
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const encrypted = combined.slice(28);

        const passphraseKey = await window.crypto.subtle.importKey(
            "raw",
            passphraseData,
            "PBKDF2",
            false,
            ["deriveBits", "deriveKey"]
        );

        const derivedKey = await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 100000,
                hash: "SHA-256"
            },
            passphraseKey,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );

        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            derivedKey,
            encrypted
        );

        const privateKeyString = decoder.decode(decrypted);
        return JSON.parse(privateKeyString);
    }

    static async encryptMessage(text: string, sharedSecret: CryptoKey): Promise<string> {
        const encoder = new TextEncoder();
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            sharedSecret,
            encoder.encode(text)
        );

        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        return btoa(String.fromCharCode(...combined));
    }

    static async decryptMessage(encryptedData: string, sharedSecret: CryptoKey): Promise<string> {
        const decoder = new TextDecoder();
        const combined = new Uint8Array(atob(encryptedData).split("").map(c => c.charCodeAt(0)));
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            sharedSecret,
            data
        );

        return decoder.decode(decrypted);
    }
}

export default function useChatPage() {
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
    const [friendNotification, setFriendNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [myKeyPair, setMyKeyPair] = useState<CryptoKeyPair | null>(null);
    const [sharedSecrets, setSharedSecrets] = useState<Map<string, CryptoKey>>(new Map());
    const [initializingKeys, setInitializingKeys] = useState(true);

    const chatBoxRef = useRef<HTMLDivElement>(null);
    const currentSharedSecretRef = useRef<CryptoKey | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const initApp = async () => {
            try {
                await secureDB.init();

                if (!pb.authStore.isValid) {
                    window.location.href = "/login";
                    return;
                }

                const user = pb.authStore.model;
                if (!user) {
                    window.location.href = "/login";
                    return;
                }

                setMyUser(user);

                const storedKeyPair = await secureDB.getKeyPair(user.id);

                if (storedKeyPair) {
                    const publicKey = await ECDHCrypto.importPublicKey(storedKeyPair.publicKey);
                    const privateKey = await ECDHCrypto.importPrivateKey(storedKeyPair.privateKey);
                    setMyKeyPair({ publicKey, privateKey });
                    setInitializingKeys(false);
                } else {
                    try {
                        const userRecord = await pb.collection('users').getOne(user.id);
                        if (userRecord.encrypted_private_key) {
                            setShowRestoreModal(true);
                            setInitializingKeys(false);
                        } else {
                            setShowBackupModal(true);
                            setInitializingKeys(false);
                        }
                    } catch (err) {
                        console.error("Error checking backup:", err);
                        setShowBackupModal(true);
                        setInitializingKeys(false);
                    }
                }

                loadFriends();
                if (typeof window !== "undefined" && "Notification" in window) {
                    Notification.requestPermission();
                }
            } catch (err) {
                console.error("Initialization error:", err);
                alert("Gagal menginisialisasi aplikasi");
            }
        };

        initApp();
    }, []);

    const handleSetupBackup = async (passphrase: string) => {
        try {
            const keyPair = await ECDHCrypto.generateKeyPair();

            const publicKeyJwk = await ECDHCrypto.exportPublicKey(keyPair.publicKey);
            const privateKeyJwk = await ECDHCrypto.exportPrivateKey(keyPair.privateKey);

            const encryptedPrivateKey = await ECDHCrypto.encryptPrivateKeyWithPassphrase(
                privateKeyJwk,
                passphrase
            );

            await secureDB.saveKeyPair(myUser.id, publicKeyJwk, privateKeyJwk);

            await pb.collection('users').update(myUser.id, {
                public_key: JSON.stringify(publicKeyJwk),
                encrypted_private_key: encryptedPrivateKey
            });

            setMyKeyPair(keyPair);
            setShowBackupModal(false);
            alert("✅ Backup berhasil dibuat!");
        } catch (err) {
            console.error("Backup setup error:", err);
            alert("Gagal membuat backup: " + (err as Error).message);
        }
    };

    const handleRestoreBackup = async (passphrase: string): Promise<boolean> => {
        try {
            const userRecord = await pb.collection('users').getOne(myUser.id);
            if (!userRecord.encrypted_private_key || !userRecord.public_key) {
                return false;
            }

            const privateKeyJwk = await ECDHCrypto.decryptPrivateKeyWithPassphrase(
                userRecord.encrypted_private_key,
                passphrase
            );

            const publicKeyJwk = JSON.parse(userRecord.public_key);

            const publicKey = await ECDHCrypto.importPublicKey(publicKeyJwk);
            const privateKey = await ECDHCrypto.importPrivateKey(privateKeyJwk);

            await secureDB.saveKeyPair(myUser.id, publicKeyJwk, privateKeyJwk);

            setMyKeyPair({ publicKey, privateKey });
            setShowRestoreModal(false);
            alert("✅ Kunci berhasil dipulihkan!");
            return true;
        } catch (err) {
            console.error("Restore error:", err);
            return false;
        }
    };

    const handleSkipRestore = async () => {
        setShowRestoreModal(false);
        setShowBackupModal(true);
    };

    const deriveSharedSecretWithFriend = async (friendId: string): Promise<CryptoKey | null> => {
        try {
            if (!myKeyPair) return null;

            const cacheId = [myUser.id, friendId].sort().join('_');
            const cached = await secureDB.getSharedSecret(cacheId);
            if (cached) {
                const keyData = JSON.parse(cached);
                return window.crypto.subtle.importKey(
                    "jwk",
                    keyData,
                    { name: "AES-GCM", length: 256 },
                    true,
                    ["encrypt", "decrypt"]
                );
            }

            const friendRecord = await pb.collection('users').getOne(friendId);
            if (!friendRecord.public_key) {
                console.error("Friend doesn't have public key");
                return null;
            }

            const friendPublicKeyJwk = JSON.parse(friendRecord.public_key);
            const friendPublicKey = await ECDHCrypto.importPublicKey(friendPublicKeyJwk);

            const sharedSecret = await ECDHCrypto.deriveSharedSecret(
                myKeyPair.privateKey,
                friendPublicKey
            );

            const exportedSecret = await window.crypto.subtle.exportKey("jwk", sharedSecret);
            await secureDB.saveSharedSecret(cacheId, JSON.stringify(exportedSecret));

            return sharedSecret;
        } catch (err) {
            console.error("Error deriving shared secret:", err);
            return null;
        }
    };

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
        } catch (err) {
            console.error(err);
        }
    };

    const loadUnreadCounts = async (friendRecords: any[]) => {
        try {
            const myId = pb.authStore.model?.id;
            const newCounts: Record<string, number> = {};
            for (const f of friendRecords) {
                const friendData = f.user === myId ? f.expand?.friend : f.expand?.user;
                const lastRead = f.user === myId ? f.last_read_user : f.last_read_friend;
                if (friendData?.id) {
                    const filter = lastRead
                        ? `sender="${friendData.id}" && receiver="${myId}" && created>"${lastRead}"`
                        : `sender="${friendData.id}" && receiver="${myId}"`;
                    const result = await pb.collection('messages').getList(1, 1, { filter, fields: 'id' });
                    if (result.totalItems > 0) newCounts[friendData.id] = result.totalItems;
                }
            }
            setUnreadCounts(newCounts);
        } catch (err) {
            console.error(err);
        }
    };

    const respondRequest = async (id: string, action: 'accepted' | 'reject') => {
        try {
            if (action === 'accepted') {
                await pb.collection('friends').update(id, { status: "accepted" });
            } else {
                await pb.collection('friends').delete(id);
            }
            loadFriends();
        } catch (err) {
            console.error(err);
        }
    };

    const removeFriend = async (friendRecordId: string) => {
        try {
            const record = friends.find(f => f.id === friendRecordId);

            await pb.collection('friends').delete(friendRecordId);

            setFriends(prev => prev.filter(f => f.id !== friendRecordId));

            if (record) {
                const userId = pb.authStore.model?.id;
                const friendData = record.user === userId ? record.expand?.friend : record.expand?.user;
                if (friendData?.id) {
                    setUnreadCounts(prev => {
                        const updated = { ...prev };
                        delete updated[friendData.id];
                        return updated;
                    });
                }
            }

            if (activeChat?.friendRecordId === friendRecordId) {
                setActiveChat(null);
                setMessages([]);
            }

            setFriendNotification({ type: 'success', message: 'Pertemanan berhasil dihapus.' });
        } catch (err) {
            console.error(err);
            setFriendNotification({ type: 'error', message: 'Gagal menghapus pertemanan.' });
        }
    };

    const clearFriendNotification = () => {
        setFriendNotification(null);
    };

    const triggerLocalNotification = (name: string) => {
        if (Notification.permission === "granted") {
            new Notification("Pesan Baru", {
                body: `Pesan dari ${name}`,
                icon: "/icon.png"
            });
        }
    };

    useEffect(() => {
        if (!myUser) return;

        pb.collection('friends').subscribe('*', () => loadFriends());
        pb.collection('messages').subscribe('*', async (e) => {
            if (e.action === 'create') {
                const msg = e.record;
                const myId = pb.authStore.model?.id;
                if (!myId) return;

                const isRelevant = activeChat && (
                    (msg.sender === myId && msg.receiver === activeChat.id) ||
                    (msg.sender === activeChat.id && msg.receiver === myId)
                );

                if (isRelevant) {
                    setMessages(prev => {
                        const updated = [...prev, msg];
                        secureDB.saveMessages(myId, activeChat.id, updated);
                        return updated;
                    });
                }

                if (msg.receiver === myId && (!activeChat || msg.sender !== activeChat.id)) {
                    setUnreadCounts(prev => ({
                        ...prev,
                        [msg.sender]: (prev[msg.sender] || 0) + 1
                    }));

                    try {
                        const sender = await pb.collection('users').getOne(msg.sender);
                        triggerLocalNotification(sender.name || sender.username || "Seseorang");
                    } catch {
                        triggerLocalNotification("Seseorang");
                    }
                }
            }
        });

        return () => {
            pb.collection('friends').unsubscribe();
            pb.collection('messages').unsubscribe();
        };
    }, [activeChat, myUser]);

    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [messages]);

    const selectChat = async (friendRecord: any) => {
        if (!myUser?.id || !myKeyPair) return;

        setMessages([]);
        setLoadingMessages(true);
        setLoadError(null);

        const friendData = friendRecord.user === myUser.id
            ? friendRecord.expand.friend
            : friendRecord.expand.user;

        const sharedSecret = await deriveSharedSecretWithFriend(friendData.id);
        if (!sharedSecret) {
            setLoadError("Gagal membuat kunci enkripsi dengan teman");
            setLoadingMessages(false);
            return;
        }

        currentSharedSecretRef.current = sharedSecret;
        setSharedSecrets(prev => new Map(prev).set(friendData.id, sharedSecret));

        setActiveChat({ ...friendData, friendRecordId: friendRecord.id });
        setUnreadCounts(prev => {
            const n = { ...prev };
            delete n[friendData.id];
            return n;
        });

        try {
            const isUserFirst = friendRecord.user === myUser.id;
            await pb.collection('friends').update(friendRecord.id, {
                [isUserFirst ? 'last_read_user' : 'last_read_friend']: new Date().toISOString()
            });
        } catch (err) {
            console.error(err);
        }

        const cached = await secureDB.getMessages(myUser.id, friendData.id);
        if (cached) {
            setMessages(cached);
            setLoadingMessages(false);
        }

        try {
            const res = await pb.collection('messages').getList(1, 50, {
                filter: `(sender="${myUser.id}" && receiver="${friendData.id}") || (sender="${friendData.id}" && receiver="${myUser.id}")`,
                sort: '-created',
                $autoCancel: false
            });
            const fresh = res.items.reverse();
            setMessages(fresh);
            await secureDB.saveMessages(myUser.id, friendData.id, fresh);
        } catch (err: any) {
            if (!err?.isAbort) {
                setLoadError(err?.message || 'Failed to load');
            }
        } finally {
            setLoadingMessages(false);
        }

        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !activeChat || !currentSharedSecretRef.current) return;

        try {
            const encrypted = await ECDHCrypto.encryptMessage(
                inputText.trim(),
                currentSharedSecretRef.current
            );

            await pb.collection('messages').create({
                sender: myUser.id,
                receiver: activeChat.id,
                text: encrypted,
                type: 'text'
            });

            setInputText("");
        } catch (err) {
            console.error("Encryption failed", err);
            alert("Gagal mengirim pesan");
        }
    };

    const handleFileSelect = (file: File, type: MessageType) => {
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            alert("File terlalu besar. Maksimal 10MB");
            return;
        }

        let previewUrl: string | undefined;
        if (type === 'image' || type === 'video' || type === 'audio') {
            previewUrl = URL.createObjectURL(file);
        }

        setFilePreview({ file, type, previewUrl });
    };

    const confirmSendFile = async () => {
        if (!filePreview || !activeChat || !currentSharedSecretRef.current) return;

        const currentPreview = filePreview;

        try {
            setUploadingFile(true);
            setFilePreview(null);

            const { file, type } = currentPreview;
            const arrayBuffer = await file.arrayBuffer();

            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encrypted = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv },
                currentSharedSecretRef.current,
                arrayBuffer
            );

            const encryptedArray = new Uint8Array(iv.length + encrypted.byteLength);
            encryptedArray.set(iv);
            encryptedArray.set(new Uint8Array(encrypted), iv.length);

            const encryptedBlob = new Blob([encryptedArray], { type: 'application/octet-stream' });
            const encryptedFile = new File(
                [encryptedBlob],
                `encrypted_${file.name}`,
                { type: 'application/octet-stream' }
            );

            const metadata: FileMetadata = {
                filename: file.name,
                mimeType: file.type,
                size: file.size
            };

            const encryptedMetadata = await ECDHCrypto.encryptMessage(
                JSON.stringify(metadata),
                currentSharedSecretRef.current
            );

            const formData = new FormData();
            formData.append('sender', myUser.id);
            formData.append('receiver', activeChat.id);
            formData.append('text', encryptedMetadata);
            formData.append('type', type);
            formData.append('file', encryptedFile);

            await pb.collection('messages').create(formData);
            setShowAttachMenu(false);
        } catch (err) {
            console.error("File upload failed:", err);
            alert("Gagal mengirim file: " + (err as Error).message);
        } finally {
            setUploadingFile(false);
            if (currentPreview.previewUrl) {
                URL.revokeObjectURL(currentPreview.previewUrl);
            }
        }
    };

    const cancelFilePreview = () => {
        if (filePreview?.previewUrl) {
            URL.revokeObjectURL(filePreview.previewUrl);
        }
        setFilePreview(null);
    };

    const handleVoiceRecord = (blob: Blob) => {
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        handleFileSelect(file, 'audio');
    };

    const addFriend = async (e: React.FormEvent) => {
        e.preventDefault();
        const input = searchId.trim();
        if (!input) {
            setFriendNotification({ type: 'error', message: "ID tidak valid." });
            return;
        }

        try {
            const userList = await pb.collection('users').getList(1, 1, {
                filter: `id = "${input}" || email = "${input}"`
            });

            if (userList.items.length === 0) {
                setFriendNotification({ type: 'error', message: "User tidak ditemukan." });
                return;
            }

            const targetUser = userList.items[0];

            if (targetUser.id === myUser.id) {
                setFriendNotification({ type: 'error', message: "Tidak bisa menambahkan diri sendiri." });
                return;
            }

            const existing = await pb.collection('friends').getFullList(1, {
                filter: `(user = "${myUser.id}" && friend = "${targetUser.id}") || (user = "${targetUser.id}" && friend = "${myUser.id}")`
            });

            if (existing.length > 0) {
                const relation = existing[0];

                if (relation.status === 'accepted') {
                    setFriendNotification({ type: 'info', message: "Kalian sudah berteman." });
                    return;
                }

                if (relation.status === 'pending') {
                    if (relation.user === myUser.id) {
                        setFriendNotification({ type: 'info', message: "Permintaan sudah dikirim, menunggu konfirmasi." });
                    } else {
                        setFriendNotification({ type: 'info', message: "Pengguna ini sudah mengirim permintaan, cek permintaan pertemanan." });
                    }
                    return;
                }
            }

            await pb.collection('friends').create({
                user: myUser.id,
                friend: targetUser.id,
                status: 'pending'
            });

            setFriendNotification({ type: 'success', message: "Permintaan terkirim!" });
            setSearchId("");
        } catch (err) {
            setFriendNotification({ type: 'error', message: "Gagal kirim permintaan." });
        }
    };

    const handleClearCache = async () => {
        if (confirm('Hapus semua cache pesan?')) {
            try {
                await secureDB.clearAllMessages(myUser.id);
                alert("Cache berhasil dihapus");
            } catch (err) {
                console.error(err);
                alert("Gagal menghapus cache");
            }
        }
    };

    return {
        myUser,
        friends,
        requests,
        activeChat,
        messages,
        inputText,
        setInputText,
        searchId,
        setSearchId,
        showNoti,
        setShowNoti,
        isSidebarOpen,
        setIsSidebarOpen,
        unreadCounts,
        loadingMessages,
        loadError,
        uploadingFile,
        showAttachMenu,
        setShowAttachMenu,
        filePreview,
        setFilePreview,
        showBackupModal,
        showRestoreModal,
        initializingKeys,
        chatBoxRef,
        currentSharedSecretRef,
        fileInputRef,
        imageInputRef,
        videoInputRef,
        handleSetupBackup,
        handleRestoreBackup,
        handleSkipRestore,
        selectChat,
        sendMessage,
        handleFileSelect,
        confirmSendFile,
        cancelFilePreview,
        handleVoiceRecord,
        addFriend,
        handleClearCache,
        respondRequest,
        removeFriend,
        friendNotification,
        clearFriendNotification
    };
}
