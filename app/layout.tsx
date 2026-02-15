import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Menggunakan font Plus Jakarta Sans agar tampilan lebih modern dan clean
const jakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: "Bitlab - Secure Connect",
  description: "End-to-End Encrypted Chat System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body
        className={`${jakarta.variable} font-sans bg-slate-950 text-slate-100 antialiased selection:bg-blue-500/30`}
      >
        {children}
      </body>
    </html>
  );
}