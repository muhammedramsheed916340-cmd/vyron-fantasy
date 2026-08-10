import { NextRequest, NextResponse } from 'next/server';
import { fetchMatches } from '@/lib/tg-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') || 'cricket';
    
    const matches = await fetchMatches(sport);
    
    return NextResponse.json({
      status: 'success',
      data: matches,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}
