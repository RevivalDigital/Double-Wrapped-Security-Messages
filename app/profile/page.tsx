"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import PocketBase from 'pocketbase';
import * as CryptoJS from 'crypto-js';

const PB_URL = process.env.NEXT_PUBLIC_PB_URL || "";
const pb = new PocketBase(PB_URL);

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Form states
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [avatar, setAvatar] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState("");
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!pb.authStore.isValid) {
            router.push("/login");
            return;
        }
        
        const currentUser = pb.authStore.model;
        setUser(currentUser);
        setName(currentUser?.name || "");
        setEmail(currentUser?.email || "");
        setAvatarPreview(currentUser?.avatar ? `${PB_URL}/api/files/_pb_users_auth_/${currentUser.id}/${currentUser.avatar}` : "");
        setLoading(false);
    }, [router]);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatar(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            
            if (avatar) {
                formData.append('avatar', avatar);
            }
            
            const updated = await pb.collection('users').update(user.id, formData);
            
            // Update auth store
            pb.authStore.save(pb.authStore.token, updated);
            setUser(updated);
            
            alert("✅ Profile berhasil diupdate!");
        } catch (err: any) {
            console.error(err);
            alert(`❌ Gagal update profile: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (newPassword !== confirmPassword) {
            return alert("❌ Password baru tidak cocok!");
        }
        
        if (newPassword.length < 8) {
            return alert("❌ Password minimal 8 karakter!");
        }
        
        setSaving(true);
        
        try {
            await pb.collection('users').update(user.id, {
                oldPassword: currentPassword,
                password: newPassword,
                passwordConfirm: confirmPassword
            });
            
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            alert("✅ Password berhasil diubah!");
        } catch (err: any) {
            console.error(err);
            alert(`❌ Gagal ubah password: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAvatar = async () => {
        if (!confirm("Hapus foto profile?")) return;
        
        setSaving(true);
        try {
            const updated = await pb.collection('users').update(user.id, {
                avatar: null
            });
            
            pb.authStore.save(pb.authStore.token, updated);
            setUser(updated);
            setAvatar(null);
            setAvatarPreview("");
            
            alert("✅ Foto profile berhasil dihapus!");
        } catch (err: any) {
            alert(`❌ Gagal hapus foto: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const handleLogout = async () => {
        try {
            if (typeof window !== "undefined") {
                try {
                    Object.keys(window.localStorage).forEach((k) => {
                        if (user?.id && k.startsWith(`chat_${user.id}_`)) {
                            window.localStorage.removeItem(k);
                        }
                    });
                } catch {
                }
            }

            if (typeof indexedDB !== "undefined") {
                try {
                    indexedDB.deleteDatabase("BitlabSecureChat");
                } catch {
                }

                try {
                    indexedDB.deleteDatabase("e2ee-db");
                } catch {
                }
            }
        } catch {
        }

        pb.authStore.clear();
        router.push("/login");
    };

    const copyUserId = () => {
        navigator.clipboard.writeText(user.id);
        alert("✅ User ID berhasil dicopy!");
    };

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-card border-b border-border backdrop-blur">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button 
                        onClick={() => router.push("/")} 
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-sm font-semibold">Back to Chat</span>
                    </button>
                    <h1 className="text-sm font-bold uppercase tracking-tighter">Profile Settings</h1>
                    <div className="w-20"></div> {/* Spacer for centering */}
                </div>
            </header>

            <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
                {/* Avatar Section */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-lg font-bold mb-4">Profile Picture</h2>
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            {avatarPreview ? (
                                <img 
                                    src={avatarPreview} 
                                    alt="Avatar" 
                                    className="w-24 h-24 rounded-full object-cover border-4 border-border"
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-3xl font-bold text-primary-foreground border-4 border-border">
                                    {(name || 'U')[0].toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 space-y-2">
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                accept="image/*" 
                                onChange={handleAvatarChange}
                                className="hidden"
                            />
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
                                >
                                    Choose Photo
                                </button>
                                {avatarPreview && (
                                    <button 
                                        onClick={handleDeleteAvatar}
                                        disabled={saving}
                                        className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max size 5MB.</p>
                        </div>
                    </div>
                </div>

                {/* Profile Info */}
                <form onSubmit={handleUpdateProfile} className="bg-card border border-border rounded-lg p-6 space-y-4">
                    <h2 className="text-lg font-bold mb-4">Personal Information</h2>
                    
                    <div>
                        <label className="block text-sm font-semibold mb-2">Display Name</label>
                        <input 
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            className="w-full h-11 bg-background border border-input rounded-md px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-2">Email Address</label>
                        <input 
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="w-full h-11 bg-background border border-input rounded-md px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-2">User ID</label>
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                value={user?.id || ""}
                                readOnly
                                className="flex-1 h-11 bg-muted border border-border rounded-md px-4 text-sm text-muted-foreground"
                            />
                            <button 
                                type="button"
                                onClick={copyUserId}
                                className="px-4 h-11 bg-secondary text-secondary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
                            >
                                Copy
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Share this ID with friends to connect</p>
                    </div>

                    <button 
                        type="submit" 
                        disabled={saving}
                        className="w-full h-11 bg-primary text-primary-foreground rounded-md text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Saving...
                            </>
                        ) : (
                            "Save Changes"
                        )}
                    </button>
                </form>

                {/* Change Password */}
                <form onSubmit={handleChangePassword} className="bg-card border border-border rounded-lg p-6 space-y-4">
                    <h2 className="text-lg font-bold mb-4">Change Password</h2>
                    
                    <div>
                        <label className="block text-sm font-semibold mb-2">Current Password</label>
                        <input 
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                            className="w-full h-11 bg-background border border-input rounded-md px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-2">New Password</label>
                        <input 
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password (min 8 characters)"
                            className="w-full h-11 bg-background border border-input rounded-md px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-2">Confirm New Password</label>
                        <input 
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            className="w-full h-11 bg-background border border-input rounded-md px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                        className="w-full h-11 bg-primary text-primary-foreground rounded-md text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Updating...
                            </>
                        ) : (
                            "Update Password"
                        )}
                    </button>
                </form>

                <div className="bg-card border border-destructive/20 rounded-lg p-6 space-y-4">
                    <h2 className="text-lg font-bold text-destructive mb-4">Danger Zone</h2>
                    
                    <div className="space-y-2">
                        <button 
                            onClick={() => setShowLogoutModal(true)}
                            className="w-full h-11 bg-destructive text-destructive-foreground rounded-md text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Logout
                        </button>
                        <p className="text-xs text-muted-foreground text-center">
                            Anda akan keluar dan data lokal perangkat akan dibersihkan.
                        </p>
                    </div>
                </div>

                {showLogoutModal && (
                    <div className="fixed inset-0 bg-black/70 z-[180] flex items-center justify-center px-4">
                        <div className="bg-card border border-border rounded-lg max-w-sm w-full p-5">
                            <h2 className="text-sm font-bold mb-2">Logout dan hapus data lokal?</h2>
                            <p className="text-xs text-muted-foreground mb-3">
                                Tindakan ini akan menghapus semua pesan yang tersimpan offline dan kunci enkripsi
                                lokal di perangkat ini, lalu mengeluarkan Anda dari akun.
                            </p>
                            <p className="text-xs text-amber-500 font-semibold mb-4">
                                Setelah login kembali, Anda perlu memasukkan ulang Passphrase backup untuk memulihkan
                                kunci dan membaca chat lama di perangkat ini.
                            </p>
                            <div className="flex justify-end gap-2 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setShowLogoutModal(false)}
                                    className="h-8 px-3 rounded-md bg-muted hover:bg-muted/80"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await handleLogout();
                                        setShowLogoutModal(false);
                                    }}
                                    className="h-8 px-3 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    Logout sekarang
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="text-center py-8">
                    <p className="text-xs text-muted-foreground">
                        Bitlab Chat • End-to-End Encrypted Messaging
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Version 1.0.0 • Powered by PocketBase
                    </p>
                </div>
            </div>
        </div>
    );
}
