import { NextRequest, NextResponse } from 'next/server';
import { jsonStorage } from '@/lib/jsonStorage';

// GET /api/storage/config - Get current storage configuration
export async function GET() {
  try {
    const config = jsonStorage.getConfig();
    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get storage configuration' },
      { status: 500 }
    );
  }
}

// POST /api/storage/config - Update storage configuration
export async function POST(request: NextRequest) {
  try {
    const { dataPath, tokensFile, ohlcvFile } = await request.json();
    
    if (!dataPath) {
      return NextResponse.json(
        { error: 'Data path is required' },
        { status: 400 }
      );
    }

    const updateConfig: any = { dataPath };
    if (tokensFile) updateConfig.tokensFile = tokensFile;
    if (ohlcvFile) updateConfig.ohlcvFile = ohlcvFile;

    const success = jsonStorage.updateConfig(updateConfig);
    
    if (success) {
      const config = jsonStorage.getConfig();
      return NextResponse.json({ 
        success: true, 
        config,
        message: 'Storage configuration updated successfully' 
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to update storage configuration' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update storage configuration' },
      { status: 500 }
    );
  }
}