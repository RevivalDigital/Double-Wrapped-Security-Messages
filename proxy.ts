import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    // Authentication Check
    const authCookie = request.cookies.get('pb_auth');
    const isChatPage = request.nextUrl.pathname === '/';
    const isLoginPage = request.nextUrl.pathname.startsWith('/login');
    const isProfilePage = request.nextUrl.pathname.startsWith('/profile');

    // Redirect to login if accessing protected pages without auth
    if ((isChatPage || isProfilePage) && !authCookie) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Redirect to home if already logged in and trying to access login
    if (isLoginPage && authCookie) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    const response = NextResponse.next();

    // Generate nonce untuk inline scripts
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

    // Content Security Policy (CSP) - Compatible dengan Next.js
    const cspHeader = `
        default-src 'self';
        script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdnjs.cloudflare.com;
        style-src 'self' 'unsafe-inline';
        img-src 'self' blob: data: https:;
        font-src 'self' data:;
        connect-src 'self' ${process.env.NEXT_PUBLIC_PB_URL || ''} https://api.anthropic.com wss: ws:;
        media-src 'self' blob: data:;
        object-src 'none';
        base-uri 'self';
        form-action 'self';
        frame-ancestors 'none';
        upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    // Security Headers
    response.headers.set('Content-Security-Policy', cspHeader);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=()');
    
    // Strict Transport Security (HSTS)
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Feature Policy untuk IndexedDB
    response.headers.set('Feature-Policy', "sync-xhr 'none'");

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - manifest.json (PWA manifest)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|manifest.json).*)',
    ],
};