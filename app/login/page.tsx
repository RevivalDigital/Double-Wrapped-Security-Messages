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
                alert("Registrasi berhasil!");
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
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Mesh Gradients */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/10 blur-[120px] rounded-full"></div>

            <div className="w-full max-w-[400px] z-10">
                <div className="bg-slate-900/50 backdrop-blur-2xl border border-slate-800 rounded-[2rem] p-8 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="inline-block px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
                            <span className="text-[10px] text-blue-400 font-bold tracking-[0.2em] uppercase">Encrypted System</span>
                        </div>
                        <h1 className="text-3xl font-black italic text-white tracking-tighter mb-1">
                            BITLAB<span className="text-blue-500">SECURE</span>
                        </h1>
                        <p className="text-xs text-slate-400 font-medium italic">
                            {isRegister ? 'Create a secure identity' : 'Authorized Access Only'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {isRegister && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                                <input 
                                    type="text" required value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="John Doe"
                                    className="w-full bg-slate-950/50 border border-slate-800 text-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-700"
                                />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Email Address</label>
                            <input 
                                type="email" required value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@bitlab.id"
                                className="w-full bg-slate-950/50 border border-slate-800 text-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-700"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                            <input 
                                type="password" required value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-slate-950/50 border border-slate-800 text-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-700"
                            />
                        </div>

                        <button 
                            type="submit" disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-[0.1em] transition-all active:scale-[0.98] shadow-lg shadow-blue-900/20 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Processing
                                </span>
                            ) : (isRegister ? 'Create Account' : 'Initialize Session')}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <button 
                            onClick={() => setIsRegister(!isRegister)}
                            className="text-[11px] font-medium text-slate-500 hover:text-blue-400 transition-colors inline-flex items-center gap-1"
                        >
                            {isRegister ? 'Already have an account?' : 'Need a secure identity?'}
                            <span className="font-bold uppercase tracking-tighter underline">
                                {isRegister ? 'Login' : 'Register'}
                            </span>
                        </button>
                    </div>
                </div>
                
                <p className="text-center mt-8 text-[9px] text-slate-600 uppercase tracking-[0.4em] font-bold">
                    System Protocol v2.0.26
                </p>
            </div>
        </div>
    );
}