import { useState } from 'react';

interface UserAvatarProps {
    user: any;
    onProfile: () => void;
    onClearCache: () => void;
    onLogout: () => void;
}

export default function UserAvatar({ user, onProfile, onClearCache, onLogout }: UserAvatarProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="p-4 border-t border-border bg-muted/20 space-y-2">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent group"
            >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                    {(user.name || 'M')[0].toUpperCase()}
                </div>
                <div className="flex-1 text-left truncate">
                    <p className="text-xs font-bold truncate">{user.name || user.username}</p>
                </div>
                <svg
                    className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && (
                <div className="w-full bg-background border border-border rounded-md text-xs overflow-hidden">
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onProfile();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Profile</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onClearCache();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Clear Cache</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-destructive/20 text-destructive text-left"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Logout</span>
                    </button>
                </div>
            )}
        </div>
    );
}
