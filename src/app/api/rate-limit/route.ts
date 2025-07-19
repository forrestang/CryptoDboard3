import { NextResponse } from 'next/server';
import { getApiCallCountInfo } from '@/lib/serverRateLimiter';

// GET /api/rate-limit - Get current API rate limit status
export async function GET() {
  try {
    const rateLimitData = await getApiCallCountInfo();
    return NextResponse.json(rateLimitData);
  } catch (error) {
        return NextResponse.json(
      { error: 'Failed to get rate limit data' },
      { status: 500 }
    );
  }
}