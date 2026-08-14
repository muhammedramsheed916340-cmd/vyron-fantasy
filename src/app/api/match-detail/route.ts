import { NextRequest, NextResponse } from 'next/server';
import { fetchMatchDetail } from '@/lib/tg-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');
    // If _t timestamp is present, the client wants fresh data (bypass ISR cache)
    // This is used before team generation to get the latest lineup/Playing XI data.
    const noCache = searchParams.has('_t');

    if (!matchId) {
      return NextResponse.json(
        { status: 'error', message: 'matchId is required' },
        { status: 400 }
      );
    }

    const matchDetail = await fetchMatchDetail(matchId, noCache);

    if (!matchDetail) {
      return NextResponse.json(
        { status: 'error', message: 'Match not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: 'success',
      data: matchDetail,
    });
  } catch (error) {
    console.error('Match Detail API Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch match detail' },
      { status: 500 }
    );
  }
}
