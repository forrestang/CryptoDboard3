import { fetchTokenDataServer, fetchOHLCVDataServer, type ParsedTokenData, type ParsedOHLCVData } from './serverApi';
import { getApiCallCount } from './api';
import { 
  insertToken, 
  insertOHLCVData, 
  getToken, 
  getAllTokens, 
  deleteToken, 
  getOHLCVData,
  clearOldOHLCVData,
  type TokenData,
  type OHLCVData 
} from './jsonStorage';
import { type ChartListItem } from './types';

// Re-export ChartListItem for backward compatibility
export { type ChartListItem } from './types';

// Token management functions that combine API and database operations

// Add token(s) to the system
export async function addTokens(
  contractAddresses: string[],
  network: 'base' | 'solana',
  timeframe: string,
  onProgress?: (completed: number, total: number, currentToken: string) => void
): Promise<{ success: TokenData[]; failed: { address: string; error: string }[] }> {
  const success: TokenData[] = [];
  const failed: { address: string; error: string }[] = [];
  
  for (let i = 0; i < contractAddresses.length; i++) {
    const address = contractAddresses[i].trim();
    
    if (!address) continue;
    
    try {
      // Check if token already exists
      const existingToken = getToken(address);
      if (existingToken) {
        success.push(existingToken);
        if (onProgress) onProgress(i + 1, contractAddresses.length, address);
        continue;
      }
      
      // Fetch token data from API
      const tokenData = await fetchTokenDataServer(network, address);
      
      // Insert token into database
      const inserted = insertToken(tokenData);
      if (inserted) {
        success.push(tokenData);
        
        // Fetch initial OHLCV data for selected timeframe
        await fetchAndStoreOHLCV(tokenData.CA, tokenData.symbol, tokenData.network, tokenData.PA, timeframe);
      } else {
        failed.push({ address, error: 'Failed to insert token into database' });
      }
      
      if (onProgress) onProgress(i + 1, contractAddresses.length, address);
    } catch (error) {
      failed.push({ 
        address, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
  
  return { success, failed };
}

// Fetch and store OHLCV data for a token
export async function fetchAndStoreOHLCV(
  CA: string,
  symbol: string,
  network: string,
  PA: string,
  timeframe: string
): Promise<boolean> {
  try {
    // Fetch OHLCV data from API
    const ohlcvData = await fetchOHLCVDataServer(network, PA, timeframe);
    
    // Convert to database format
    const dbData: OHLCVData[] = ohlcvData.map(item => ({
      CA,
      symbol,
      timestamp: item.timestamp,
      readable_timestamp: item.readable_timestamp,
      timeframe,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume
    }));
    
    // Insert into database
    const inserted = insertOHLCVData(dbData);
    
    if (inserted) {
      // Clear old data to maintain limit of 1000 records
      clearOldOHLCVData(CA, timeframe);
    }
    
    return inserted;
  } catch (error) {
        return false;
  }
}

// Refresh OHLCV data for all tokens
export async function refreshAllTokensOHLCV(
  timeframe: string,
  onProgress?: (completed: number, total: number, currentToken: string) => void
): Promise<{ success: string[]; failed: { symbol: string; error: string }[] }> {
  const tokens = getAllTokens();
  const success: string[] = [];
  const failed: { symbol: string; error: string }[] = [];
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    try {
      const refreshed = await fetchAndStoreOHLCV(token.CA, token.symbol, token.network, token.PA, timeframe);
      
      if (refreshed) {
        success.push(token.symbol);
      } else {
        failed.push({ symbol: token.symbol, error: 'Failed to refresh data' });
      }
      
      if (onProgress) onProgress(i + 1, tokens.length, token.symbol);
    } catch (error) {
      failed.push({ 
        symbol: token.symbol, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
  
  return { success, failed };
}

// Get token list with their latest OHLCV data
export function getTokensWithLatestData(timeframe: string): Array<TokenData & { latestPrice?: number; latestVolume?: number }> {
  const tokens = getAllTokens();
  
  return tokens.map(token => {
    const ohlcvData = getOHLCVData(token.CA, timeframe, 1);
    const latestData = ohlcvData[0];
    
    return {
      ...token,
      latestPrice: latestData?.close,
      latestVolume: latestData?.volume
    };
  });
}

// Remove token and all its data
export async function removeToken(CA: string): Promise<boolean> {
  return deleteToken(CA);
}

// Parse contract addresses from user input
export function parseContractAddresses(input: string): string[] {
  if (!input.trim()) return [];
  
  // Split by commas, spaces, newlines, and filter out empty strings
  return input
    .split(/[,\s\n]+/)
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0);
}

// Get API usage information
export function getAPIUsage() {
  return getApiCallCount();
}

// Validate contract address format (basic validation)
export function validateContractAddress(address: string, network: 'base' | 'solana'): boolean {
  if (!address || typeof address !== 'string') return false;
  
  // Basic length and format validation
  if (network === 'base') {
    // Ethereum-style addresses (Base uses Ethereum format)
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  } else if (network === 'solana') {
    // Solana addresses are base58 encoded, typically 32-44 characters
    return /^[A-Za-z0-9]{32,44}$/.test(address);
  }
  
  return false;
}

// Get chart data for LightWeight Charts
export function getChartData(CA: string, timeframe: string): Array<{
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  const ohlcvData = getOHLCVData(CA, timeframe);
  
  return ohlcvData
    .map(item => ({
      time: item.timestamp,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume
    }))
    .sort((a, b) => a.time - b.time); // Sort by time ascending for charts
}

// Chart List Management
// ChartListItem interface is now in ./types.ts

const COLOR_PALETTE = [
  '#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff',
  '#8000ff', '#ff00ff', '#ff0080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080',
  '#808080', '#c0c0c0', '#ff4444', '#ff8844', '#ffff44', '#88ff44', '#44ff44', '#44ff88', '#44ffff',
  '#4488ff', '#4444ff', '#8844ff', '#ff44ff', '#ff4488', '#ffffff', '#ffaaaa', '#ffddaa', '#ffffaa',
  '#aaffaa', '#aaffff', '#aaaaff', '#ddaaff', '#ffaaff', '#dddddd', '#ff6666', '#ffaa66', '#ffff66',
  '#66ff66', '#66ffff', '#6666ff', '#aa66ff', '#ff66aa', '#555555', '#ff9999', '#ffcc99', '#00cc99'
];

// Get next available color that's most distant from existing colors
export function getNextAvailableColor(existingColors: string[]): string {
  if (existingColors.length === 0) return COLOR_PALETTE[0];
  
  // Find the color in the palette that's most distant from all existing colors
  let maxDistance = 0;
  let bestColor = COLOR_PALETTE[0];
  
  for (const color of COLOR_PALETTE) {
    if (existingColors.includes(color)) continue;
    
    let minDistance = Infinity;
    for (const existingColor of existingColors) {
      const distance = getColorDistance(color, existingColor);
      minDistance = Math.min(minDistance, distance);
    }
    
    if (minDistance > maxDistance) {
      maxDistance = minDistance;
      bestColor = color;
    }
  }
  
  return bestColor;
}

// Calculate color distance (simplified RGB distance)
function getColorDistance(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return 0;
  
  const dr = rgb1.r - rgb2.r;
  const dg = rgb1.g - rgb2.g;
  const db = rgb1.b - rgb2.b;
  
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Convert tokens to chart list items (server-side version)
export function tokensToChartListItems(tokens: TokenData[], existingChartList: ChartListItem[] = []): ChartListItem[] {
  const existingColors = existingChartList.map(item => item.color);
  let nextOrder = Math.max(...existingChartList.map(item => item.order), -1) + 1;
  
  return tokens.map(token => {
    // Check if token already exists in chart list
    const existing = existingChartList.find(item => item.CA === token.CA);
    if (existing) return existing;
    
    // Create new chart list item
    const color = getNextAvailableColor(existingColors);
    existingColors.push(color);
    
    return {
      ...token,
      visible: true,
      color,
      order: nextOrder++
    };
  });
}