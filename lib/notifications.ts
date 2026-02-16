// Notification Helper Utility
// Handles browser notifications with proper permission management

type ExtendedNotificationOptions = NotificationOptions & {
    vibrate?: number[];
    renotify?: boolean;
};

export class NotificationManager {
    private static instance: NotificationManager;
    private permissionGranted: boolean = false;

    private constructor() {
        this.checkPermission();
    }

    static getInstance(): NotificationManager {
        if (!NotificationManager.instance) {
            NotificationManager.instance = new NotificationManager();
        }
        return NotificationManager.instance;
    }

    // Check current notification permission
    private checkPermission(): void {
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return;
        }

        this.permissionGranted = Notification.permission === 'granted';
    }

    // Request notification permission
    async requestPermission(): Promise<boolean> {
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return false;
        }

        // Already granted
        if (Notification.permission === 'granted') {
            this.permissionGranted = true;
            return true;
        }

        // Already denied
        if (Notification.permission === 'denied') {
            console.warn('Notification permission was denied');
            return false;
        }

        // Request permission
        try {
            const permission = await Notification.requestPermission();
            this.permissionGranted = permission === 'granted';
            return this.permissionGranted;
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        }
    }

    // Show notification
    show(title: string, options?: ExtendedNotificationOptions): Notification | null {
        if (!this.permissionGranted) {
            console.warn('Notification permission not granted');
            return null;
        }

        try {
            const baseOptions: ExtendedNotificationOptions = {
                icon: '/icon-192.png',
                badge: '/icon-96.png',
                vibrate: [200, 100, 200],
                requireInteraction: false,
                ...options
            };

            const notification = new Notification(title, baseOptions);

            // Auto-close after 5 seconds
            setTimeout(() => notification.close(), 5000);

            // Click handler - focus window
            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            return notification;
        } catch (error) {
            console.error('Error showing notification:', error);
            return null;
        }
    }

    // Show message notification
    showMessageNotification(senderName: string, preview?: string): void {
        const body = preview 
            ? `${preview.substring(0, 50)}${preview.length > 50 ? '...' : ''}`
            : 'Pesan baru';

        this.show('💬 Pesan Baru', {
            body: `${senderName}: ${body}`,
            tag: `message-${Date.now()}`,
            renotify: true
        });
    }

    // Get permission status
    getPermissionStatus(): NotificationPermission {
        return Notification.permission;
    }

    // Check if notifications are supported
    isSupported(): boolean {
        return 'Notification' in window;
    }
}

// Export singleton instance
export const notificationManager = NotificationManager.getInstance();
