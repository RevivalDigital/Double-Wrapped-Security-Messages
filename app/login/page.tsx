"use client";

import { useState } from 'react';
import PocketBase from 'pocketbase';

const PB_URL = process.env.NEXT_PUBLIC_PB_URL || 'https://pb.bitlab.web.id';
const pb = new PocketBase(PB_URL);

export default function LoginPage() {
    const [isRegister, setIsRegister] = useState(false);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isRegister) {
                await pb.collection('users').create({
                    email, password, passwordConfirm: password, name
                });
                alert("Registrasi berhasil! Silakan login.");
                setIsRegister(false);
            } else {
                await pb.collection('users').authWithPassword(email, password);
                document.cookie = pb.authStore.exportToCookie({ 
                    httpOnly: false, secure: true, sameSite: 'Lax', path: '/' 
                });
                window.location.href = "/";
            }
        } catch (err: any) {
            alert(err.message || "Terjadi kesalahan.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 sm:p-10 relative overflow-hidden">
            {/* Background Subtle Pattern - Khas Shadcn */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            
            <div className="w-full max-w-[380px] z-10 space-y-6">
                <div className="flex flex-col space-y-2 text-center">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {isRegister ? 'Create an account' : 'Welcome back'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {isRegister 
                            ? 'Enter your details below to create your secure identity' 
                            : 'Enter your credentials to access your secure messages'}
                    </p>
                </div>

                <div className="grid gap-6 p-1">
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4">
                            {isRegister && (
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="name">
                                        Full Name
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        placeholder="John Doe"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                            )}
                            <div className="grid gap-2">
                                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="email">
                                    Email Address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                            <div className="grid gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium leading-none" htmlFor="password">
                                        Password
                                    </label>
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 mt-2"
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Please wait
                                    </div>
                                ) : (isRegister ? 'Sign Up' : 'Sign In')}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="text-center text-sm">
                    <span className="text-muted-foreground">
                        {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                    </span>
                    <button
                        onClick={() => setIsRegister(!isRegister)}
                        className="underline underline-offset-4 hover:text-primary transition-colors font-medium"
                    >
                        {isRegister ? 'Login' : 'Register'}
                    </button>
                </div>

                <p className="text-center text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                    Bitlab Secure Connection &copy; 2026
                </p>
            </div>
        </div>
    );
}