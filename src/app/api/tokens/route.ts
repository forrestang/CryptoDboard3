import { NextRequest, NextResponse } from 'next/server';
import { getAllTokens, deleteToken } from '@/lib/jsonStorage';
import { addTokens } from '@/lib/tokenManager';

// GET /api/tokens - Get all tokens
export async function GET() {
  try {
    const tokens = getAllTokens();
    return NextResponse.json({ tokens });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get tokens' },
      { status: 500 }
    );
  }
}

// POST /api/tokens - Add new tokens
export async function POST(request: NextRequest) {
  try {
    const { addresses, network, timeframe } = await request.json();
    
    if (!addresses || !Array.isArray(addresses) || !network || !timeframe) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    const result = await addTokens(addresses, network, timeframe);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to add tokens' },
      { status: 500 }
    );
  }
}

// DELETE /api/tokens - Delete a token
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const CA = searchParams.get('CA');
    
    if (!CA) {
      return NextResponse.json(
        { error: 'Contract address is required' },
        { status: 400 }
      );
    }

    const success = deleteToken(CA);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Failed to delete token' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete token' },
      { status: 500 }
    );
  }
}