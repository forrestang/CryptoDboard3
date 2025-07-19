import { NextResponse } from 'next/server';
import { jsonStorage } from '@/lib/jsonStorage';

// GET /api/storage/export - Export all data
export async function GET() {
  try {
    const data = jsonStorage.exportData();
    
    const exportData = {
      ...data,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    
    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="crypto-dashboard-export-${new Date().toISOString().split('T')[0]}.json"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}