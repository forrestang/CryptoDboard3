import { NextRequest, NextResponse } from 'next/server';
import { jsonStorage } from '@/lib/jsonStorage';

// POST /api/storage/import - Import data from file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const text = await file.text();
    let importData;
    
    try {
      importData = JSON.parse(text);
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON file' },
        { status: 400 }
      );
    }

    // Validate the import data structure
    if (!importData.tokens && !importData.ohlcv) {
      return NextResponse.json(
        { error: 'Import file must contain tokens or ohlcv data' },
        { status: 400 }
      );
    }

    // Import the data
    const success = jsonStorage.importData({
      tokens: importData.tokens,
      ohlcv: importData.ohlcv
    });

    if (success) {
      const stats = jsonStorage.getStorageStats();
      return NextResponse.json({
        success: true,
        message: 'Data imported successfully',
        stats
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to import data' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to import data' },
      { status: 500 }
    );
  }
}