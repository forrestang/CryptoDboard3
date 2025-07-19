import { NextRequest, NextResponse } from 'next/server';
import { getChartData } from '@/lib/tokenManager';

// GET /api/chart-data - Get OHLCV data for chart display
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const CA = searchParams.get('CA');
    const timeframe = searchParams.get('timeframe');
    
    if (!CA || !timeframe) {
      return NextResponse.json(
        { error: 'Contract address and timeframe are required' },
        { status: 400 }
      );
    }

    const chartData = getChartData(CA, timeframe);
    return NextResponse.json({ data: chartData });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get chart data' },
      { status: 500 }
    );
  }
}