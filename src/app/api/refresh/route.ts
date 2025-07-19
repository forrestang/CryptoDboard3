import { NextRequest, NextResponse } from 'next/server';
import { refreshAllTokensOHLCV } from '@/lib/tokenManager';

// POST /api/refresh - Manually refresh OHLCV data for all tokens
export async function POST(request: NextRequest) {
  try {
    const { timeframe } = await request.json();
    
    if (!timeframe) {
      return NextResponse.json(
        { error: 'Timeframe is required' },
        { status: 400 }
      );
    }

    // Track progress for the response
    const progressUpdates: string[] = [];
    
    const result = await refreshAllTokensOHLCV(
      timeframe,
      (completed: number, total: number, currentToken: string) => {
        progressUpdates.push(`Refreshing ${completed}/${total}: ${currentToken}`);
      }
    );

    return NextResponse.json({
      success: true,
      result,
      progressUpdates
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to refresh tokens',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}