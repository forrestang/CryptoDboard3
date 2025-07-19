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

// Parsed token data interface
interface ParsedTokenData {
  CA: string;
  network: string;
  name: string;
  symbol: string;
  image_url?: string;
  PA: string;
}

// POST /api/gecko-token - Fetch token data from GeckoTerminal
export async function POST(request: NextRequest) {
  try {
    const { network, address } = await request.json();
    
    // Validate request parameters
    if (!network || !address) {
      return NextResponse.json(
        { error: 'Network and address parameters are required' },
        { status: 400 }
      );
    }
    
    const endpoint = `/networks/${network.toLowerCase()}/tokens/${address}`;
    
        
    const response = await apiRequest<TokenResponse>(endpoint);
    
    // Parse network from data.id (format: "network_address")
    const networkFromId = response.data.id.split('_')[0];
    
    // Parse pool address from relationships.top_pools.data[0].id (format: "network_pooladdress")
    const poolId = response.data.relationships.top_pools.data[0]?.id;
    if (!poolId) {
      throw new APIError(0, 'No pool found for this token');
    }
    const PA = poolId.split('_')[1];
    
    const parsedData: ParsedTokenData = {
      CA: response.data.attributes.address,
      network: networkFromId,
      name: response.data.attributes.name,
      symbol: response.data.attributes.symbol,
      image_url: response.data.attributes.image_url,
      PA: PA
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