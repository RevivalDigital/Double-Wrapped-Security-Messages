import { useEffect, useState } from 'react';
import { ECDHCrypto, FileMetadata, pb } from '../../app/hooks/useChatPage';

interface MessageBubbleProps {
    message: any;
    isOwn: boolean;
    sharedSecret: CryptoKey | null;
}

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

                const decryptedMetaStr = await ECDHCrypto.decryptMessage(message.text, sharedSecret);
                const meta: FileMetadata = JSON.parse(decryptedMetaStr);
                setMetadata(meta);

                if (!message.file) throw new Error("No file attachment");

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

export default function MessageBubble({ message, isOwn, sharedSecret }: MessageBubbleProps) {
    return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${isOwn ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'}`}>
                {(!message.type || message.type === 'text') ? (
                    <DecryptedMessage text={message.text} sharedSecret={sharedSecret} />
                ) : (
                    <DecryptedFile message={message} sharedSecret={sharedSecret} />
                )}
                <p className="text-[8px] opacity-50 mt-1 text-right">
                    {new Date(message.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </div>
    );
}

