// GeckoTerminal API client - now using server-side endpoints with proper rate limiting

// Get current API call count (still used by other components)
export async function getApiCallCount(): Promise<{ current: number; max: number; resetTime: number }> {
  try {
    const response = await fetch('/api/rate-limit');
    if (response.ok) {
      return await response.json();
    } else {
      return { current: 0, max: 30, resetTime: Date.now() + 60000 };
    }
  } catch (error) {
    return { current: 0, max: 30, resetTime: Date.now() + 60000 };
  }
}

// Reset API call counter (for testing purposes)
export async function resetApiCallCount(): Promise<void> {
  // This function is kept for compatibility, but now would need to be implemented server-side
}

// API Error types
export class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

export class RateLimitError extends Error {
  constructor(public resetTime: number) {
    super(`Rate limit exceeded. Resets at ${new Date(resetTime).toLocaleTimeString()}`);
    this.name = 'RateLimitError';
  }
}

// Types for API responses
export interface TokenResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      address: string;
      name: string;
      symbol: string;
      image_url?: string;
    };
    relationships: {
      top_pools: {
        data: {
          id: string;
          type: string;
        }[];
      };
    };
  };
}

export interface OHLCVResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      ohlcv_list: [number, number, number, number, number, number][]; // [timestamp, open, high, low, close, volume]
    };
  };
}

export interface TrendingPoolsResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      name: string;
      address: string;
      market_cap_usd?: string;
      fdv_usd?: string;
      price_change_percentage: {
        m5?: string;
        m15?: string;
        m30?: string;
        h1?: string;
        h6?: string;
        h24?: string;
      };
      transactions: {
        m5?: { buys: number; sells: number; buyers: number; sellers: number };
        m15?: { buys: number; sells: number; buyers: number; sellers: number };
        m30?: { buys: number; sells: number; buyers: number; sellers: number };
        h1?: { buys: number; sells: number; buyers: number; sellers: number };
        h6?: { buys: number; sells: number; buyers: number; sellers: number };
        h24?: { buys: number; sells: number; buyers: number; sellers: number };
      };
      volume_usd: {
        m5?: string;
        m15?: string;
        m30?: string;
        h1?: string;
        h6?: string;
        h24?: string;
      };
    };
  }[];
}

// Parsed data interfaces
export interface ParsedTokenData {
  CA: string;
  network: string;
  name: string;
  symbol: string;
  image_url?: string;
  PA: string;
}

export interface ParsedOHLCVData {
  timestamp: number;
  readable_timestamp?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Fetch token data
export async function fetchTokenData(network: string, address: string): Promise<ParsedTokenData> {
  try {
    const response = await fetch('/api/gecko-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ network, address }),
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new RateLimitError(Date.now() + 60000);
      }
      throw new APIError(response.status, `HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new APIError(0, result.error || 'Failed to fetch token data');
    }
    
    return result.data;
  } catch (error) {
    throw error;
  }
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
      
      // Fill gaps between current and next data points
      while (expectedTime < nextTime) {
        // Create filled data point with previous close price and zero volume
        const filledPoint: ParsedOHLCVData = {
          timestamp: expectedTime,
          readable_timestamp: formatTimestamp(expectedTime),
          open: currentData.close,
          high: currentData.close,
          low: currentData.close,
          close: currentData.close,
          volume: 0
        };
        
        filledData.push(filledPoint);
        expectedTime += interval;
      }
    }
  }
  
  return filledData;
}

// Fetch OHLCV data
export async function fetchOHLCVData(
  network: string, 
  poolAddress: string, 
  timeframe: string
): Promise<ParsedOHLCVData[]> {
  try {
    const response = await fetch('/api/gecko-ohlcv', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ network, poolAddress, timeframe }),
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new RateLimitError(Date.now() + 60000);
      }
      throw new APIError(response.status, `HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new APIError(0, result.error || 'Failed to fetch OHLCV data');
    }
    
    return result.data;
  } catch (error) {
    throw error;
  }
}

// DEPRECATED: Fetch trending pools - now handled by /api/trending-tokens
// export async function fetchTrendingPools(
//   network: string,
//   duration: '5m' | '1h' | '6h' | '24h' = '1h'
// ): Promise<TrendingPoolsResponse['data']> {
//   // This function is deprecated - use /api/trending-tokens endpoint instead
//   throw new Error('fetchTrendingPools is deprecated - use /api/trending-tokens endpoint instead');
// }

// Utility function to wait for rate limit reset
export async function waitForRateLimit(): Promise<void> {
  const { resetTime } = await getApiCallCount();
  const waitTime = resetTime - Date.now();
  
  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
}

// Batch API calls with rate limiting
export async function batchApiCalls<T>(
  calls: (() => Promise<T>)[],
  onProgress?: (completed: number, total: number) => void
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < calls.length; i++) {
    try {
      const result = await calls[i]();
      results.push(result);
      
      if (onProgress) {
        onProgress(i + 1, calls.length);
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        // Wait for rate limit reset and retry
        await waitForRateLimit();
        const result = await calls[i]();
        results.push(result);
        
        if (onProgress) {
          onProgress(i + 1, calls.length);
        }
      } else {
        throw error;
      }
    }
  }
  
  return results;
}