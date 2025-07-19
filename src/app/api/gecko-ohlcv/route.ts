import { NextRequest, NextResponse } from 'next/server';
import { incrementCallCount } from '@/lib/serverRateLimiter';

// Base API URL for GeckoTerminal
const API_BASE_URL = 'https://api.geckoterminal.com/api/v2';

// API Error classes
class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

class RateLimitError extends Error {
  constructor() {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
  }
}

// Generic API request function with rate limiting
async function apiRequest<T>(endpoint: string): Promise<T> {
  // Check rate limit before making request
  if (!(await incrementCallCount())) {
    throw new RateLimitError();
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CryptoDashboard/1.0'
      }
    });
    
    if (!response.ok) {
      throw new APIError(response.status, `API request failed: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof APIError || error instanceof RateLimitError) {
      throw error;
    }
    throw new APIError(0, `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// OHLCV response interface
interface OHLCVResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      ohlcv_list: [number, number, number, number, number, number][]; // [timestamp, open, high, low, close, volume]
    };
  };
}

// Parsed OHLCV data interface
interface ParsedOHLCVData {
  timestamp: number;
  readable_timestamp?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Map timeframe to API format
function mapTimeframeToAPI(timeframe: string): { timeframe: string; aggregate: number } {
  const mapping: Record<string, { timeframe: string; aggregate: number }> = {
    'M1': { timeframe: 'minute', aggregate: 1 },
    'M5': { timeframe: 'minute', aggregate: 5 },
    'M15': { timeframe: 'minute', aggregate: 15 },
    'H1': { timeframe: 'hour', aggregate: 1 },
    'H4': { timeframe: 'hour', aggregate: 4 },
    'H12': { timeframe: 'hour', aggregate: 12 },
    'D1': { timeframe: 'day', aggregate: 1 }
  };
  
  return mapping[timeframe] || { timeframe: 'minute', aggregate: 5 };
}

// Get timeframe interval in seconds
function getTimeframeInterval(timeframe: string): number {
  const intervals: Record<string, number> = {
    'M1': 60,        // 1 minute
    'M5': 300,       // 5 minutes
    'M15': 900,      // 15 minutes
    'H1': 3600,      // 1 hour
    'H4': 14400,     // 4 hours
    'H12': 43200,    // 12 hours
    'D1': 86400      // 1 day
  };
  
  return intervals[timeframe] || 300; // Default to M5
}

// Convert Unix timestamp to human-readable format
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

// Fill gaps in time series data
function fillTimeSeriesGaps(data: ParsedOHLCVData[], timeframe: string): ParsedOHLCVData[] {
  if (data.length === 0) return data;
  
  // Sort data by timestamp ascending
  const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const interval = getTimeframeInterval(timeframe);
  const filledData: ParsedOHLCVData[] = [];
  
  for (let i = 0; i < sortedData.length; i++) {
    const currentData = sortedData[i];
    
    // Add readable timestamp to existing data if not already present
    if (!currentData.readable_timestamp) {
      currentData.readable_timestamp = formatTimestamp(currentData.timestamp);
    }
    
    filledData.push(currentData);
    
    // Check if there's a next data point
    if (i < sortedData.length - 1) {
      const nextData = sortedData[i + 1];
      const currentTime = currentData.timestamp;
      const nextTime = nextData.timestamp;
      
      // Calculate expected next timestamp
      let expectedTime = currentTime + interval;
      
      // Fill gaps if there's a time jump
      while (expectedTime < nextTime) {
        filledData.push({
          timestamp: expectedTime,
          readable_timestamp: formatTimestamp(expectedTime),
          open: currentData.close,
          high: currentData.close,
          low: currentData.close,
          close: currentData.close,
          volume: 0
        });
        expectedTime += interval;
      }
    }
  }
  
  return filledData;
}

// POST /api/gecko-ohlcv - Fetch OHLCV data from GeckoTerminal
export async function POST(request: NextRequest) {
  try {
    const { network, poolAddress, timeframe } = await request.json();
    
    // Validate request parameters
    if (!network || !poolAddress || !timeframe) {
      return NextResponse.json(
        { error: 'Network, poolAddress, and timeframe parameters are required' },
        { status: 400 }
      );
    }
    
    const { timeframe: apiTimeframe, aggregate } = mapTimeframeToAPI(timeframe);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    const endpoint = `/networks/${network.toLowerCase()}/pools/${poolAddress}/ohlcv/${apiTimeframe}?aggregate=${aggregate}&before_timestamp=${currentTimestamp}&limit=1000&currency=usd`;
    
        
    const response = await apiRequest<OHLCVResponse>(endpoint);
    
    // Parse OHLCV data
    const parsedData = response.data.attributes.ohlcv_list.map(([timestamp, open, high, low, close, volume]) => ({
      timestamp,
      readable_timestamp: formatTimestamp(timestamp),
      open,
      high,
      low,
      close,
      volume
    }));
    
    // Fill gaps in the data to ensure complete time series
    const filledData = fillTimeSeriesGaps(parsedData, timeframe);
    
        
    return NextResponse.json({
      success: true,
      data: filledData
    });
    
  } catch (error) {
        
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before making more requests.' },
        { status: 429 }
      );
    }
    
    if (error instanceof APIError) {
      return NextResponse.json(
        { error: `API Error: ${error.message}` },
        { status: error.status || 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}