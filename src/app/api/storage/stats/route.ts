import { NextResponse } from 'next/server';
import { jsonStorage } from '@/lib/jsonStorage';

// GET /api/storage/stats - Get storage statistics
export async function GET() {
  try {
    const stats = jsonStorage.getStorageStats();
    return NextResponse.json({ stats });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get storage statistics' },
      { status: 500 }
    );
  }
}