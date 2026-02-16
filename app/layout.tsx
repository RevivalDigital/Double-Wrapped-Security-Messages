import "./globals.css"; // Baris ini wajib ada
import { Plus_Jakarta_Sans } from "next/font/google";
import type { Metadata } from "next";

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  variable: "--font-jakarta" 
});

export const metadata: Metadata = {
  title: "Bitlab Chat - Secure E2EE Messaging",
  description: "End-to-end encrypted chat application with ECDH encryption",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
  // Security: Prevent search engines from indexing sensitive pages
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Security Meta Tags */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        
        {/* Prevent caching of sensitive data */}
        <meta httpEquiv="Cache-Control" content="no-store, no-cache, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Bitlab Chat" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Bitlab Chat" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#000000" />
        
        {/* Viewport with security considerations */}
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" 
        />
      </head>
      <body 
        className={`${jakarta.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        {/* Main Content */}
        {children}
        
        {/* Security Notice for Developers */}
        <noscript>
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#000',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            textAlign: 'center',
            zIndex: 9999,
          }}>
            <div>
              <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>JavaScript Required</h1>
              <p>This application requires JavaScript for encryption operations.</p>
              <p style={{ marginTop: '8px', fontSize: '14px', opacity: 0.7 }}>
                Please enable JavaScript to use Bitlab Chat securely.
              </p>
            </div>
          </div>
        </noscript>
      </body>
    </html>
  );
}