import { NextRequest, NextResponse } from 'next/server';

/**
 * DEPRECATED: This route previously called a non-existent TG API endpoint
 * (POST /fantasy/list-contests returns 404 on the TG API).
 *
 * The TG API does NOT have any contest-related endpoints.
 * Use /api/fantasy/platform-contests instead, which calls
 * the Dream11/My11Circle APIs directly using the session token
 * from verify-otp.
 *
 * This route returns a clear error with redirect info.
 * HTTP 404 is NEVER silently converted to empty contests.
 */
export async function POST(request: NextRequest) {
  console.error('[LIST-CONTESTS] DEPRECATED endpoint called! Use /api/fantasy/platform-contests instead.');

  return NextResponse.json({
    status: 'fail',
    message: 'This endpoint is deprecated. The TG API does not have a list-contests endpoint (returns HTTP 404). Use /api/fantasy/platform-contests instead, which calls Dream11/My11Circle APIs directly.',
    deprecated: true,
    useInstead: '/api/fantasy/platform-contests',
    httpStatus: 404,
    _debug: {
      reason: 'TG_API_NO_CONTEST_ENDPOINT',
      tgApiEndpoint: 'https://tgsoftware-api.online/api/fantasy/list-contests',
      tgApiResponse: 'HTTP 404',
      correctEndpoint: '/api/fantasy/platform-contests',
    },
  });
}
