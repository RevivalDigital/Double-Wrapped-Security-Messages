import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Ambil cookie PocketBase (Default name is 'pb_auth')
  // Catatan: Pastikan saat login, Anda menginstruksikan PB untuk menyimpan ke cookie
  const authCookie = request.cookies.get('pb_auth');

  // Tentukan rute yang ingin diproteksi (contoh: halaman chat utama)
  const isChatPage = request.nextUrl.pathname === '/';
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

  // LOGIKA 1: Jika mencoba akses chat tapi belum login
  if (isChatPage && !authCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // LOGIKA 2: Jika sudah login tapi mencoba ke halaman login lagi
  if (isLoginPage && authCookie) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// Konfigurasi rute mana saja yang akan diperiksa oleh middleware
export const config = {
  matcher: [
    /*
     * Cocokkan semua request rute kecuali:
     * - api (rute API)
     * - _next/static (file statis)
     * - _next/image (optimasi gambar)
     * - favicon.ico (icon)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
