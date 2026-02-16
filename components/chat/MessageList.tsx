import { RefObject } from 'react';
import MessageBubble from './MessageBubble';

interface MessageListProps {
    myUser: any;
    messages: any[];
    loading: boolean;
    error: string | null;
    containerRef: RefObject<HTMLDivElement>;
    sharedSecret: CryptoKey | null;
}

export default function MessageList({
    myUser,
    messages,
    loading,
    error,
    containerRef,
    sharedSecret
}: MessageListProps) {
    return (
        <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
                <div className="flex items-center justify-center h-full">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : error ? (
                <div className="flex items-center justify-center h-full text-center">
                    <p className="text-destructive text-sm">{error}</p>
                </div>
            ) : (
                messages.map((m, idx) => (
                    <MessageBubble
                        key={m.id || idx}
                        message={m}
                        isOwn={m.sender === myUser.id}
                        sharedSecret={sharedSecret}
                    />
                ))
            )}
        </div>
    );
}

