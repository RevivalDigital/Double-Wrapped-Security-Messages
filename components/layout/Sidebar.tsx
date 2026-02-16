import { Dispatch, SetStateAction } from 'react';
import NotificationDropdown from '../ui/NotificationDropdown';
import UserAvatar from '../ui/UserAvatar';

interface SidebarProps {
    myUser: any;
    friends: any[];
    requests: any[];
    activeChat: any;
    unreadCounts: Record<string, number>;
    searchId: string;
    setSearchId: Dispatch<SetStateAction<string>>;
    isSidebarOpen: boolean;
    setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
    showNoti: boolean;
    setShowNoti: Dispatch<SetStateAction<boolean>>;
    onAddFriend: (e: React.FormEvent) => void;
    onSelectChat: (friendRecord: any) => void;
    onClearCache: () => void;
    respondRequest: (id: string, action: 'accepted' | 'reject') => void;
}

export default function Sidebar({
    myUser,
    friends,
    requests,
    activeChat,
    unreadCounts,
    searchId,
    setSearchId,
    isSidebarOpen,
    setIsSidebarOpen,
    showNoti,
    setShowNoti,
    onAddFriend,
    onSelectChat,
    onClearCache,
    respondRequest
}: SidebarProps) {
    return (
        <aside className={`fixed md:relative inset-y-0 left-0 w-80 bg-card border-r border-border flex flex-col z-50 transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                    <h1 className="text-sm font-bold uppercase tracking-tighter">Bitlab Chat</h1>
                    <p className="text-[9px] text-emerald-500 font-bold">ECDH ENCRYPTED</p>
                </div>
                <NotificationDropdown
                    requests={requests}
                    unreadCounts={unreadCounts}
                    show={showNoti}
                    onToggle={() => setShowNoti(!showNoti)}
                    respondRequest={respondRequest}
                />
            </div>

            <div className="p-4">
                <form onSubmit={onAddFriend} className="flex gap-2">
                    <input
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        placeholder="User ID / Email"
                        className="flex-1 h-9 bg-transparent border border-input rounded-md px-3 text-xs outline-none"
                    />
                    <button
                        type="submit"
                        className="h-9 px-3 bg-secondary text-secondary-foreground rounded-md text-[10px] font-bold"
                    >
                        ADD
                    </button>
                </form>
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-1">
                <p className="px-2 text-[10px] font-bold text-muted-foreground uppercase mb-2">
                    Direct Messages
                </p>
                {friends.map(f => {
                    const friendData = f.user === myUser.id ? f.expand?.friend : f.expand?.user;
                    const unread = unreadCounts[friendData?.id] || 0;
                    return (
                        <button
                            key={f.id}
                            onClick={() => onSelectChat(f)}
                            className={`w-full p-2 flex items-center gap-3 rounded-md transition-all ${activeChat?.id === friendData?.id ? 'bg-accent' : 'hover:bg-accent/40'}`}
                        >
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-xs border border-border">
                                    {(friendData?.name || 'U')[0].toUpperCase()}
                                </div>
                                {unread > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold px-1 border-2 border-card">
                                        {unread}
                                    </span>
                                )}
                            </div>
                            <div className="text-left truncate flex-1">
                                <div className="text-sm font-semibold truncate">
                                    {friendData?.name || friendData?.email}
                                </div>
                                <p className={`text-[10px] font-bold ${unread > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                    {unread > 0 ? `${unread} pesan baru` : 'E2EE Active'}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </div>

            <UserAvatar
                user={myUser}
                onProfile={() => { window.location.href = "/profile"; }}
                onClearCache={onClearCache}
            />
        </aside>
    );
}

