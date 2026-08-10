import { NextResponse } from 'next/server';
import { fetchPromotions } from '@/lib/tg-api';

export async function GET() {
  try {
    const promotions = await fetchPromotions();
    
    return NextResponse.json({
      status: 'success',
      data: promotions,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch promotions' },
      { status: 500 }
    );
  }
}
