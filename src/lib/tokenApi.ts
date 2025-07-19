// Client-side API utilities for token management

export interface TokenData {
  CA: string;
  network: string;
  name: string;
  symbol: string;
  image_url?: string;
  PA: string;
}

export interface AddTokensResult {
  success: TokenData[];
  failed: { address: string; error: string }[];
}

// Get all tokens from the API
export async function getTokensFromAPI(): Promise<TokenData[]> {
  try {
    const response = await fetch('/api/tokens');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.tokens || [];
  } catch (error) {
        throw error;
  }
}

// Add tokens via API
export async function addTokensViaAPI(
  addresses: string[], 
  network: 'base' | 'solana',
  timeframe: string
): Promise<AddTokensResult> {
  try {
    const response = await fetch('/api/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ addresses, network, timeframe }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
        throw error;
  }
}

// Delete token via API
export async function deleteTokenViaAPI(CA: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/tokens?CA=${encodeURIComponent(CA)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success || false;
  } catch (error) {
        throw error;
  }
}