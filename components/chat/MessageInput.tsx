import { Dispatch, RefObject, SetStateAction, useState, useRef } from 'react';
import AttachMenu from './AttachMenu';
import { MessageType } from '../../app/hooks/useChatPage';

interface MessageInputProps {
    inputText: string;
    setInputText: Dispatch<SetStateAction<string>>;
    uploadingFile: boolean;
    showAttachMenu: boolean;
    setShowAttachMenu: Dispatch<SetStateAction<boolean>>;
    sendMessage: (e: React.FormEvent) => void | Promise<void>;
    handleFileSelect: (file: File, type: MessageType) => void;
    handleVoiceRecord: (blob: Blob) => void;
    fileInputRef: RefObject<HTMLInputElement>;
    imageInputRef: RefObject<HTMLInputElement>;
    videoInputRef: RefObject<HTMLInputElement>;
}

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

export default function MessageInput({
    inputText,
    setInputText,
    uploadingFile,
    showAttachMenu,
    setShowAttachMenu,
    sendMessage,
    handleFileSelect,
    handleVoiceRecord,
    fileInputRef,
    imageInputRef,
    videoInputRef
}: MessageInputProps) {
    return (
        <form onSubmit={sendMessage} className="p-4 border-t border-border bg-background">
            {uploadingFile && (
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span>Mengenkripsi dan mengirim...</span>
                </div>
            )}

            <div className="flex gap-2 items-center">
                <AttachMenu
                    show={showAttachMenu}
                    setShow={setShowAttachMenu}
                    uploadingFile={uploadingFile}
                    fileInputRef={fileInputRef}
                    imageInputRef={imageInputRef}
                    videoInputRef={videoInputRef}
                />

                <VoiceRecorder onRecord={handleVoiceRecord} />

                <input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 h-10 bg-muted rounded-full px-4 text-sm outline-none focus:ring-2 focus:ring-primary"
                    disabled={uploadingFile}
                />

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
    );
}

