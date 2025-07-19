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

// Types for API responses
interface TrendingPoolsResponse {
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

// Fetch trending pools from GeckoTerminal API
async function fetchTrendingPools(
  network: string,
  duration: '5m' | '1h' | '6h' | '24h' = '1h'
): Promise<TrendingPoolsResponse['data']> {
  const endpoint = `/networks/${network.toLowerCase()}/trending_pools?page=1&duration=${duration}`;
  
  try {
    const response = await apiRequest<TrendingPoolsResponse>(endpoint);
    return response.data;
  } catch (error) {
        throw error;
  }
}

// POST /api/trending-tokens - Fetch trending tokens data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { networks, duration } = body;
    
    // Validate request parameters
    if (!networks || typeof networks !== 'object') {
      return NextResponse.json(
        { error: 'Networks parameter is required and must be an object' },
        { status: 400 }
      );
    }
    
    if (!duration || !['5m', '1h', '6h', '24h'].includes(duration)) {
      return NextResponse.json(
        { error: 'Duration parameter is required and must be one of: 5m, 1h, 6h, 24h' },
        { status: 400 }
      );
    }
    
    const networkCalls: Array<{ network: string; duration: string }> = [];
    let expectedApiCalls = 0;
    
    // Collect network calls to make based on selected networks
    if (networks.base) {
      networkCalls.push({ network: 'base', duration });
      expectedApiCalls++;
    }
    
    if (networks.solana) {
      networkCalls.push({ network: 'solana', duration });
      expectedApiCalls++;
    }
    
    if (networkCalls.length === 0) {
      return NextResponse.json(
        { error: 'At least one network must be selected' },
        { status: 400 }
      );
    }
    
        
    // Execute API calls sequentially to avoid race conditions in rate limiter
    const results = [];
    for (const { network, duration: dur } of networkCalls) {
      try {
        const data = await fetchTrendingPools(network, dur as '5m' | '1h' | '6h' | '24h');
        results.push({
          network,
          data
        });
      } catch (error) {
                throw error;
      }
    }
    
    // Return combined results
    const response = {
      success: true,
      data: results,
      apiCallsUsed: expectedApiCalls
    };
    
    return NextResponse.json(response);
    
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