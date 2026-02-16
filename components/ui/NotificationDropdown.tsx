interface NotificationDropdownProps {
    requests: any[];
    unreadCounts: Record<string, number>;
    show: boolean;
    onToggle: () => void;
    respondRequest: (id: string, action: 'accepted' | 'reject') => void;
}

export default function NotificationDropdown({
    requests,
    unreadCounts,
    show,
    onToggle,
    respondRequest
}: NotificationDropdownProps) {
    const totalUnread = requests.length + Object.values(unreadCounts).reduce((a, b) => a + b, 0);

    return (
        <div className="relative">
            <button
                onClick={onToggle}
                className="relative p-2 hover:bg-accent rounded-md"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold px-1 animate-pulse">
                        {totalUnread}
                    </span>
                )}
            </button>

            {show && (
                <div className="absolute top-10 right-0 left-auto bg-popover border border-border shadow-xl rounded-lg z-[60] py-2 w-72">
                    <p className="px-4 py-1 text-[10px] font-bold text-muted-foreground uppercase">Requests</p>
                    {requests.length === 0 ? (
                        <p className="px-4 py-3 text-xs">No pending requests</p>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="px-4 py-2 flex items-center justify-between border-b last:border-0">
                                <span className="text-xs truncate font-medium">
                                    {req.expand?.user?.name || req.expand?.user?.email}
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => respondRequest(req.id, 'accepted')}
                                        className="px-2 py-1 bg-primary text-white text-[10px] rounded"
                                    >
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => respondRequest(req.id, 'reject')}
                                        className="px-2 py-1 bg-destructive text-white text-[10px] rounded"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

