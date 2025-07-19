import { NextRequest, NextResponse } from 'next/server';
import { incrementCallCount } from '@/lib/serverRateLimiter';
import { formatNumber, formatVolumeNumber } from '@/lib/formatters';

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

// Token market data response interface
interface TokenMarketDataResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      address: string;
      name: string;
      symbol: string;
      market_cap_usd?: string;
      fdv_usd?: string;
      volume_usd?: {
        h24?: string;
      };
    };
  };
}

// Parsed market data interface
interface ParsedMarketData {
  mc: string;
  fdv: string;
  h24Volume: string;
}

// POST /api/token-market-data - Fetch market data for a specific token
export async function POST(request: NextRequest) {
  try {
    const { network, ca } = await request.json();
    
    // Validate request parameters
    if (!network || !ca) {
      return NextResponse.json(
        { error: 'Network and ca parameters are required' },
        { status: 400 }
      );
    }
    
    const endpoint = `/networks/${network.toLowerCase()}/tokens/${ca}`;
    
    
    const response = await apiRequest<TokenMarketDataResponse>(endpoint);
    
    // Parse and format the market data
    const parsedData: ParsedMarketData = {
      mc: response.data.attributes.market_cap_usd ? formatNumber(response.data.attributes.market_cap_usd) : '-',
      fdv: response.data.attributes.fdv_usd ? formatNumber(response.data.attributes.fdv_usd) : '-',
      h24Volume: response.data.attributes.volume_usd?.h24 ? formatVolumeNumber(response.data.attributes.volume_usd.h24) : '-'
    };
    
    
    return NextResponse.json({
      success: true,
      data: parsedData
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