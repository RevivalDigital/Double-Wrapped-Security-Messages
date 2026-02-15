import "./globals.css"; // Baris ini wajib ada
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  variable: "--font-jakarta" 
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark"> {/* Tambahkan class dark di sini */}
      <body className={`${jakarta.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}