"use client";

import { useEffect, useRef, useState } from 'react';
import useChatPageHook, { ECDHCrypto, FileMetadata, FilePreview, pb } from './hooks/useChatPage';
import { NotificationPermissionBanner } from '../components/NotificationPermissionBanner';
import Sidebar from '../components/layout/Sidebar';
import ChatHeader from '../components/layout/ChatHeader';
import EmptyState from '../components/layout/EmptyState';
import ChatContainer from '../components/chat/ChatContainer';

// ==================== KEY BACKUP MODAL ====================
function KeyBackupModal({ 
    onSetupComplete 
}: { 
    onSetupComplete: (passphrase: string) => void;
}) {
    const [passphrase, setPassphrase] = useState("");
    const [confirmPassphrase, setConfirmPassphrase] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (passphrase.length < 8) {
            setError("Passphrase harus minimal 8 karakter");
            return;
        }

        if (passphrase !== confirmPassphrase) {
            setError("Passphrase tidak cocok");
            return;
        }

        onSetupComplete(passphrase);
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg max-w-md w-full p-6">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold mb-2">Setup Backup Passphrase</h2>
                    <p className="text-sm text-muted-foreground">
                        Buat passphrase untuk backup kunci enkripsi Anda. 
                        Passphrase ini diperlukan untuk memulihkan chat di perangkat baru.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Passphrase Backup</label>
                        <input
                            type="password"
                            value={passphrase}
                            onChange={(e) => setPassphrase(e.target.value)}
                            className="w-full h-10 bg-background border border-input rounded-md px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Minimal 8 karakter"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Konfirmasi Passphrase</label>
                        <input
                            type="password"
                            value={confirmPassphrase}
                            onChange={(e) => setConfirmPassphrase(e.target.value)}
                            className="w-full h-10 bg-background border border-input rounded-md px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Ulangi passphrase"
                            required
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                            <p className="text-xs text-destructive">{error}</p>
                        </div>
                    )}

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3">
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            ⚠️ PENTING: Simpan passphrase ini dengan aman! Tanpa passphrase, 
                            Anda tidak dapat membaca chat lama di perangkat baru.
                        </p>
                    </div>

                    <button
                        type="submit"
                        className="w-full h-10 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
                    >
                        Buat Backup
                    </button>
                </form>
            </div>
        </div>
    );
}

// ==================== KEY RESTORE MODAL ====================
function KeyRestoreModal({ 
    onRestore,
    onSkip
}: { 
    onRestore: (passphrase: string) => Promise<boolean>;
    onSkip: () => void;
}) {
    const [passphrase, setPassphrase] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const success = await onRestore(passphrase);
            if (!success) {
                setError("Passphrase salah atau backup tidak ditemukan");
            }
        } catch (err) {
            setError("Gagal memulihkan kunci: " + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg max-w-md w-full p-6">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold mb-2">Pulihkan Kunci Enkripsi</h2>
                    <p className="text-sm text-muted-foreground">
                        Masukkan passphrase backup Anda untuk memulihkan chat lama.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Passphrase Backup</label>
                        <input
                            type="password"
                            value={passphrase}
                            onChange={(e) => setPassphrase(e.target.value)}
                            className="w-full h-10 bg-background border border-input rounded-md px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Masukkan passphrase"
                            required
                            disabled={loading}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                            <p className="text-xs text-destructive">{error}</p>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onSkip}
                            className="flex-1 h-10 bg-secondary text-secondary-foreground rounded-md font-medium hover:bg-secondary/80 transition-colors"
                            disabled={loading}
                        >
                            Lewati
                        </button>
                        <button
                            type="submit"
                            className="flex-1 h-10 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            disabled={loading}
                        >
                            {loading && <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>}
                            Pulihkan
                        </button>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                        Jika lewati, Anda akan membuat kunci baru dan tidak bisa membaca chat lama.
                    </p>
                </form>
            </div>
        </div>
    );
}
/*
function DecryptedMessage({ text, sharedSecret }: { text: string; sharedSecret: CryptoKey | null }) {
    const [decrypted, setDecrypted] = useState("...");

    useEffect(() => {
        if (!sharedSecret) {
            setDecrypted("⚠️ Kunci tidak tersedia");
            return;
        }

        ECDHCrypto.decryptMessage(text, sharedSecret)
            .then(setDecrypted)
            .catch(() => setDecrypted("⚠️ Gagal dekripsi"));
    }, [text, sharedSecret]);

    return <p className="whitespace-pre-wrap break-words">{decrypted}</p>;
}

function DecryptedFile({ 
    message,
    sharedSecret, 
}: { 
    message: any;
    sharedSecret: CryptoKey | null;
}) {
    const [fileUrl, setFileUrl] = useState<string>("");
    const [metadata, setMetadata] = useState<FileMetadata | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let objectUrl = "";
        
        const decrypt = async () => {
            if (!sharedSecret) {
                setError(true);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(false);
                
                // Decrypt metadata
                const decryptedMetaStr = await ECDHCrypto.decryptMessage(message.text, sharedSecret);
                const meta: FileMetadata = JSON.parse(decryptedMetaStr);
                setMetadata(meta);
                
                if (!message.file) throw new Error("No file attachment");
                
                // Fetch and decrypt file
                const fileUrl = pb.files.getUrl(message, message.file);
                const response = await fetch(fileUrl);
                const encryptedBlob = await response.blob();
                const encryptedArrayBuffer = await encryptedBlob.arrayBuffer();
                
                const encryptedArray = new Uint8Array(encryptedArrayBuffer);
                const iv = encryptedArray.slice(0, 12);
                const data = encryptedArray.slice(12);
                
                const decryptedBuffer = await window.crypto.subtle.decrypt(
                    { name: "AES-GCM", iv },
                    sharedSecret,
                    data
                );
                
                const blob = new Blob([decryptedBuffer], { type: meta.mimeType });
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
    }, [message, sharedSecret]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs">Mendekripsi...</span>
            </div>
        );
    }

    if (error || !metadata) {
        return (
            <div className="p-3 bg-destructive/10 rounded-lg">
                <p className="text-xs text-destructive">⚠️ Gagal mendekripsi file</p>
            </div>
        );
    }

    if (message.type === 'image') {
        return (
            <div className="max-w-sm">
                <img src={fileUrl} alt={metadata.filename} className="rounded-lg w-full h-auto" />
                <p className="text-[8px] opacity-50 mt-1">{metadata.filename}</p>
            </div>
        );
    }

    if (message.type === 'video') {
        return (
            <div className="max-w-md">
                <video controls className="rounded-lg w-full" src={fileUrl}>
                    Browser Anda tidak mendukung video.
                </video>
                <p className="text-[8px] opacity-50 mt-1">{metadata.filename}</p>
            </div>
        );
    }

    if (message.type === 'audio') {
        return (
            <div className="min-w-[280px]">
                <audio controls className="w-full" src={fileUrl}>
                    Browser Anda tidak mendukung audio.
                </audio>
                <p className="text-[8px] opacity-50 mt-1">{metadata.filename}</p>
            </div>
        );
    }

    return (
        <a 
            href={fileUrl} 
            download={metadata.filename}
            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
        >
            <div className="w-10 h-10 bg-primary/20 rounded flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{metadata.filename}</p>
                <p className="text-[10px] opacity-50">{(metadata.size / 1024).toFixed(1)} KB</p>
            </div>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
        </a>
    );
}
*/
function FilePreviewModal({ 
    preview, 
    onSend, 
    onCancel 
}: { 
    preview: FilePreview; 
    onSend: () => void; 
    onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h3 className="font-bold text-sm">Preview File</h3>
                    <button onClick={onCancel} className="p-1 hover:bg-accent rounded">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-muted/20">
                    <div className="flex flex-col items-center justify-center space-y-4">
                        {preview.type === 'image' && preview.previewUrl && (
                            <img 
                                src={preview.previewUrl} 
                                alt={preview.file.name} 
                                className="max-w-full max-h-[50vh] rounded-lg border border-border"
                            />
                        )}
                        
                        {preview.type === 'video' && preview.previewUrl && (
                            <video 
                                controls 
                                className="max-w-full max-h-[50vh] rounded-lg border border-border"
                                src={preview.previewUrl}
                            />
                        )}
                        
                        {preview.type === 'audio' && preview.previewUrl && (
                            <div className="w-full max-w-md">
                                <div className="p-4 bg-card rounded-lg border border-border">
                                    <audio controls className="w-full" src={preview.previewUrl} />
                                </div>
                            </div>
                        )}
                        
                        {preview.type === 'file' && (
                            <div className="w-full max-w-md p-6 bg-card rounded-lg border border-border">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-20 h-20 bg-primary/20 rounded-lg flex items-center justify-center">
                                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <p className="font-medium text-sm break-all">{preview.file.name}</p>
                                    <p className="text-xs text-muted-foreground">{(preview.file.size / 1024).toFixed(1)} KB</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-border flex gap-2">
                    <button
                        onClick={onCancel}
                        className="flex-1 h-10 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={onSend}
                        className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Kirim
                    </button>
                </div>
            </div>
        </div>
    );
}

/*
function VoiceRecorder({ onRecord }: { onRecord: (blob: Blob) => void }) {
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
                onRecord(blob);
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

// ==================== MAIN CHAT HOOK ====================
function useChatPage() {
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
        if (!input || input === myUser.id) {
            alert("ID tidak valid.");
            return;
        }

        try {
            const userList = await pb.collection('users').getList(1, 1, {
                filter: `id = "${input}" || email = "${input}"`
            });

            if (userList.items.length === 0) {
                alert("User tidak ditemukan.");
                return;
            }

            await pb.collection('friends').create({
                user: myUser.id,
                friend: userList.items[0].id,
                status: 'pending'
            });

            alert("Permintaan terkirim!");
            setSearchId("");
        } catch (err) {
            alert("Gagal kirim permintaan.");
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
        respondRequest
    };
}
*/

// ==================== MAIN CHAT COMPONENT ====================
export default function ChatPage() {
    const {
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
        respondRequest
    } = useChatPageHook();

    if (!myUser || initializingKeys) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-sm text-muted-foreground">Menginisialisasi...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden border-t border-border">
            {showBackupModal && (
                <KeyBackupModal onSetupComplete={handleSetupBackup} />
            )}

            {showRestoreModal && (
                <KeyRestoreModal
                    onRestore={handleRestoreBackup}
                    onSkip={handleSkipRestore}
                />
            )}

            {filePreview && (
                <FilePreviewModal
                    preview={filePreview}
                    onSend={confirmSendFile}
                    onCancel={cancelFilePreview}
                />
            )}

            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file, 'image');
                    e.target.value = '';
                }}
            />
            <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file, 'video');
                    e.target.value = '';
                }}
            />
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file, 'file');
                    e.target.value = '';
                }}
            />

            <div
                className={`fixed inset-0 bg-black/50 z-40 md:hidden ${isSidebarOpen ? 'block' : 'hidden'}`}
                onClick={() => setIsSidebarOpen(false)}
            />

            <Sidebar
                myUser={myUser}
                friends={friends}
                requests={requests}
                activeChat={activeChat}
                unreadCounts={unreadCounts}
                searchId={searchId}
                setSearchId={setSearchId}
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                showNoti={showNoti}
                setShowNoti={setShowNoti}
                onAddFriend={addFriend}
                onSelectChat={selectChat}
                onClearCache={handleClearCache}
                respondRequest={respondRequest}
                onRemoveFriend={removeFriend}
            />

            <main className="flex-1 flex flex-col bg-background">
                <ChatHeader
                    activeChat={activeChat}
                    onOpenSidebar={() => setIsSidebarOpen(true)}
                />

                {!activeChat ? (
                    <EmptyState />
                ) : (
                    <ChatContainer
                        myUser={myUser}
                        activeChat={activeChat}
                        messages={messages}
                        loadingMessages={loadingMessages}
                        loadError={loadError}
                        chatBoxRef={chatBoxRef}
                        currentSharedSecretRef={currentSharedSecretRef}
                        inputText={inputText}
                        setInputText={setInputText}
                        uploadingFile={uploadingFile}
                        showAttachMenu={showAttachMenu}
                        setShowAttachMenu={setShowAttachMenu}
                        sendMessage={sendMessage}
                        handleFileSelect={handleFileSelect}
                        handleVoiceRecord={handleVoiceRecord}
                        fileInputRef={fileInputRef}
                        imageInputRef={imageInputRef}
                        videoInputRef={videoInputRef}
                    />
                )}
            </main>
            <NotificationPermissionBanner />
        </div>
    );
}
