// Server-side API functions that call GeckoTerminal directly
import { incrementCallCount } from './serverRateLimiter';

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

// Token response interface
interface TokenResponse {
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

// OHLCV response interface
interface OHLCVResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      ohlcv_list: [number, number, number, number, number, number][];
    };
  };
}

// Parsed token data interface
export interface ParsedTokenData {
  CA: string;
  network: string;
  name: string;
  symbol: string;
  image_url?: string;
  PA: string;
}

// Parsed OHLCV data interface
export interface ParsedOHLCVData {
  timestamp: number;
  readable_timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Fetch token data from GeckoTerminal API
export async function fetchTokenDataServer(network: string, address: string): Promise<ParsedTokenData> {
  const endpoint = `/networks/${network.toLowerCase()}/tokens/${address}`;
  
  try {
    const response = await apiRequest<TokenResponse>(endpoint);
    
    // Parse network from data.id (format: "network_address")
    const networkFromId = response.data.id.split('_')[0];
    
    // Parse pool address from relationships.top_pools.data[0].id (format: "network_pooladdress")
    const poolId = response.data.relationships.top_pools.data[0]?.id;
    if (!poolId) {
      throw new APIError(0, 'No pool found for this token');
    }
    const PA = poolId.split('_')[1];
    
    return {
      CA: response.data.attributes.address,
      network: networkFromId,
      name: response.data.attributes.name,
      symbol: response.data.attributes.symbol,
      image_url: response.data.attributes.image_url,
      PA: PA
    };
  } catch (error) {
        throw error;
  }
}

// Utility function to format timestamp
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

// Map timeframe to GeckoTerminal API parameters
function mapTimeframeToAPI(timeframe: string): { timeframe: string; aggregate: string } {
  const mapping: { [key: string]: { timeframe: string; aggregate: string } } = {
    'M1': { timeframe: 'minute', aggregate: '1' },
    'M5': { timeframe: 'minute', aggregate: '5' },
    'M15': { timeframe: 'minute', aggregate: '15' },
    'H1': { timeframe: 'hour', aggregate: '1' },
    'H4': { timeframe: 'hour', aggregate: '4' },
    'H12': { timeframe: 'hour', aggregate: '12' },
    'D1': { timeframe: 'day', aggregate: '1' }
  };
  
  return mapping[timeframe] || { timeframe: 'hour', aggregate: '1' };
}

// Fill gaps in time series data
function fillTimeSeriesGaps(data: ParsedOHLCVData[], timeframe: string): ParsedOHLCVData[] {
  if (data.length === 0) return data;
  
  const intervalMap: { [key: string]: number } = {
    'M1': 60,
    'M5': 300,
    'M15': 900,
    'H1': 3600,
    'H4': 14400,
    'H12': 43200,
    'D1': 86400
  };
  
  const intervalSeconds = intervalMap[timeframe];
  if (!intervalSeconds) return data;
  
  // Sort data by timestamp
  const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const filledData: ParsedOHLCVData[] = [];
  
  for (let i = 0; i < sortedData.length; i++) {
    const currentItem = sortedData[i];
    filledData.push(currentItem);
    
    if (i < sortedData.length - 1) {
      const nextItem = sortedData[i + 1];
      const timeDiff = nextItem.timestamp - currentItem.timestamp;
      
      // If there's a gap larger than our interval, fill it
      if (timeDiff > intervalSeconds) {
        const gapsToFill = Math.floor(timeDiff / intervalSeconds) - 1;
        
        for (let j = 1; j <= gapsToFill; j++) {
          const fillTimestamp = currentItem.timestamp + (j * intervalSeconds);
          filledData.push({
            timestamp: fillTimestamp,
            readable_timestamp: formatTimestamp(fillTimestamp),
            open: currentItem.close,
            high: currentItem.close,
            low: currentItem.close,
            close: currentItem.close,
            volume: 0
          });
        }
      }
    }
  }
  
  return filledData;
}

// Fetch OHLCV data from GeckoTerminal API
export async function fetchOHLCVDataServer(
  network: string,
  poolAddress: string,
  timeframe: string
): Promise<ParsedOHLCVData[]> {
  const { timeframe: apiTimeframe, aggregate } = mapTimeframeToAPI(timeframe);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  
  const endpoint = `/networks/${network.toLowerCase()}/pools/${poolAddress}/ohlcv/${apiTimeframe}?aggregate=${aggregate}&before_timestamp=${currentTimestamp}&limit=1000&currency=usd`;
  
  try {
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
    return fillTimeSeriesGaps(parsedData, timeframe);
  } catch (error) {
        throw error;
  }
}