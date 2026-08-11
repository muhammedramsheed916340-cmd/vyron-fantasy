import { NextRequest, NextResponse } from 'next/server';

/**
 * DEPRECATED: This route previously called a non-existent TG API endpoint
 * (POST /fantasy/list-contests returns 404 on the TG API).
 *
 * Use /api/fantasy/platform-contests instead, which calls
 * the Dream11/My11Circle APIs directly.
 *
 * This route is kept for backward compatibility but will
 * return a redirect message.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    status: 'fail',
    message: 'This endpoint is deprecated. Use /api/fantasy/platform-contests instead. The TG API does not have a list-contests endpoint.',
    deprecated: true,
    useInstead: '/api/fantasy/platform-contests',
  });
}
