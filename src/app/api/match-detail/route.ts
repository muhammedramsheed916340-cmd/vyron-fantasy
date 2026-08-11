import { NextRequest, NextResponse } from 'next/server';
import { fetchMatchDetail } from '@/lib/tg-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');

    if (!matchId) {
      return NextResponse.json(
        { status: 'error', message: 'matchId is required' },
        { status: 400 }
      );
    }

    const matchDetail = await fetchMatchDetail(matchId);

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
