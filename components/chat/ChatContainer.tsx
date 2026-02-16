import { Dispatch, RefObject, SetStateAction } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { MessageType } from '../../app/hooks/useChatPage';

interface ChatContainerProps {
    myUser: any;
    activeChat: any;
    messages: any[];
    loadingMessages: boolean;
    loadError: string | null;
    chatBoxRef: RefObject<HTMLDivElement | null>;
    currentSharedSecretRef: RefObject<CryptoKey | null>;
    inputText: string;
    setInputText: Dispatch<SetStateAction<string>>;
    uploadingFile: boolean;
    showAttachMenu: boolean;
    setShowAttachMenu: Dispatch<SetStateAction<boolean>>;
    sendMessage: (e: React.FormEvent) => void | Promise<void>;
    handleFileSelect: (file: File, type: MessageType) => void;
    handleVoiceRecord: (blob: Blob) => void;
    fileInputRef: RefObject<HTMLInputElement | null>;
    imageInputRef: RefObject<HTMLInputElement | null>;
    videoInputRef: RefObject<HTMLInputElement | null>;
}

export default function ChatContainer({
    myUser,
    activeChat,
    messages,
    loadingMessages,
    loadError,
    chatBoxRef,
    currentSharedSecretRef,
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
}: ChatContainerProps) {
    return (
        <>
            <MessageList
                myUser={myUser}
                messages={messages}
                loading={loadingMessages}
                error={loadError}
                containerRef={chatBoxRef}
                sharedSecret={currentSharedSecretRef.current}
            />

            <MessageInput
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
        </>
    );
}
