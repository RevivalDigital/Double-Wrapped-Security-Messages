interface UserAvatarProps {
    user: any;
    onProfile: () => void;
    onClearCache: () => void;
}

export default function UserAvatar({ user, onProfile, onClearCache }: UserAvatarProps) {
    return (
        <div className="p-4 border-t border-border bg-muted/20 space-y-2">
            <button
                onClick={onProfile}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent group"
            >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                    {(user.name || 'M')[0].toUpperCase()}
                </div>
                <div className="flex-1 text-left truncate">
                    <p className="text-xs font-bold truncate">{user.name || user.username}</p>
                </div>
            </button>
            <button
                onClick={onClearCache}
                className="w-full flex items-center gap-2 p-2 text-xs text-muted-foreground hover:text-foreground"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Clear Cache</span>
            </button>
        </div>
    );
}

