import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const botApiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || 'http://140.238.244.166:3001';
        const response = await fetch(`${botApiUrl}/current-battle`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            const data = await response.json();
            return NextResponse.json(data);
        } else {
            return NextResponse.json(
                { error: 'Bot API returned error' },
                { status: response.status }
            );
        }
    } catch (error: any) {
        console.error('Error fetching from bot API:', error);
        return NextResponse.json(
            { error: 'Failed to fetch battle data' },
            { status: 500 }
        );
    }
}
