import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  variable: '--font-jakarta', // Pastikan ini terdaftar di tailwind.config
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
    // Tambahkan class 'dark' di sini untuk memaksa Dark Mode Shadcn
    <html lang="id" className={`${jakarta.variable} dark`} style={{ colorScheme: 'dark' }}>
      <body
        className="font-sans bg-background text-foreground antialiased selection:bg-blue-500/30"
      >
        {children}
      </body>
    </html>
  );
}