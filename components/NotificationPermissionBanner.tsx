"use client";

import { useState, useEffect } from 'react';
import { notificationManager } from '@/lib/notifications';

export function NotificationPermissionBanner() {
    const [show, setShow] = useState(false);
    const [requesting, setRequesting] = useState(false);

    useEffect(() => {
        // Check if we should show the banner
        const checkPermission = () => {
            if (!notificationManager.isSupported()) {
                return;
            }

            const permission = notificationManager.getPermissionStatus();
            
            // Show banner if permission is default (not granted or denied)
            if (permission === 'default') {
                // Don't show immediately, wait a bit
                setTimeout(() => setShow(true), 3000);
            }
        };

        checkPermission();
    }, []);

    const handleEnable = async () => {
        setRequesting(true);
        const granted = await notificationManager.requestPermission();
        
        if (granted) {
            setShow(false);
            // Show test notification
            notificationManager.show('✅ Notifikasi Aktif', {
                body: 'Anda akan menerima notifikasi untuk pesan baru',
            });
        } else {
            alert('Gagal mengaktifkan notifikasi. Silakan cek pengaturan browser Anda.');
        }
        
        setRequesting(false);
    };

    const handleDismiss = () => {
        setShow(false);
        // Store in localStorage to not show again this session
        localStorage.setItem('notification_banner_dismissed', Date.now().toString());
    };

    if (!show) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[150] animate-in slide-in-from-bottom-4">
            <div className="bg-card border-2 border-primary/50 rounded-lg shadow-2xl p-4">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm mb-1">
                            Aktifkan Notifikasi
                        </h3>
                        <p className="text-xs text-muted-foreground mb-3">
                            Terima pemberitahuan untuk pesan baru bahkan saat app tidak aktif
                        </p>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={handleEnable}
                                disabled={requesting}
                                className="flex-1 h-9 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {requesting ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                                        <span>Meminta...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Aktifkan</span>
                                    </>
                                )}
                            </button>
                            
                            <button
                                onClick={handleDismiss}
                                disabled={requesting}
                                className="h-9 px-4 bg-secondary text-secondary-foreground rounded-md text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
                            >
                                Nanti
                            </button>
                        </div>
                    </div>
                    
                    <button
                        onClick={handleDismiss}
                        disabled={requesting}
                        className="p-1 hover:bg-accent rounded transition-colors disabled:opacity-50"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
