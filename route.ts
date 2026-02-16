import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const report = await request.json();
        
        // Log CSP violation
        console.error('🚨 CSP Violation Detected:', {
            timestamp: new Date().toISOString(),
            documentURI: report['document-uri'] || report.documentURI,
            violatedDirective: report['violated-directive'] || report.violatedDirective,
            effectiveDirective: report['effective-directive'] || report.effectiveDirective,
            blockedURI: report['blocked-uri'] || report.blockedURI,
            sourceFile: report['source-file'] || report.sourceFile,
            lineNumber: report['line-number'] || report.lineNumber,
            columnNumber: report['column-number'] || report.columnNumber,
            statusCode: report['status-code'] || report.statusCode,
        });

        // In production, you might want to:
        // 1. Send to monitoring service (Sentry, LogRocket, etc.)
        // 2. Store in database for analysis
        // 3. Alert security team for critical violations
        
        // Example: Send to Sentry (uncomment if using Sentry)
        // import * as Sentry from '@sentry/nextjs';
        // Sentry.captureMessage('CSP Violation', {
        //     level: 'warning',
        //     extra: report,
        //     tags: {
        //         type: 'csp_violation',
        //         directive: report['violated-directive'],
        //     },
        // });

        return NextResponse.json({ status: 'logged' }, { status: 200 });
    } catch (error) {
        console.error('Error processing CSP report:', error);
        return NextResponse.json({ error: 'Invalid report' }, { status: 400 });
    }
}

// Health check endpoint
export async function GET() {
    return NextResponse.json({ 
        status: 'ok',
        message: 'CSP reporting endpoint is active' 
    });
}