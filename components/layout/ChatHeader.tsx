interface ChatHeaderProps {
    activeChat: any;
    onOpenSidebar: () => void;
}

export default function ChatHeader({ activeChat, onOpenSidebar }: ChatHeaderProps) {
    return (
        <header className="h-14 border-b border-border flex items-center px-4 justify-between bg-background/95 backdrop-blur sticky top-0 z-30">
            <div className="flex items-center gap-3">
                <button
                    onClick={onOpenSidebar}
                    className="md:hidden p-2 -ml-2 hover:bg-accent rounded-md"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                {activeChat && (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold border border-border shadow-sm">
                            {(activeChat.name || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-sm font-bold leading-none">
                                {activeChat.name || activeChat.email}
                            </h2>
                            <p className="text-[10px] text-emerald-500 font-bold mt-0.5">
                                ECDH E2EE
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}

