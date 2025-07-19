// Simple in-memory store to replace SQLite temporarily

export interface TokenData {
  CA: string;
  network: string;
  name: string;
  symbol: string;
  image_url?: string;
  PA: string;
}

export interface OHLCVData {
  CA: string;
  symbol: string;
  timestamp: number;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// In-memory storage
let tokens: TokenData[] = [];
let ohlcvData: OHLCVData[] = [];

// Token operations
export function getAllTokens(): TokenData[] {
  return tokens;
}

export function insertToken(token: TokenData): boolean {
  // Remove existing token with same CA
  tokens = tokens.filter(t => t.CA !== token.CA);
  // Add new token
  tokens.push(token);
  return true;
}

export function deleteToken(CA: string): boolean {
  const initialLength = tokens.length;
  tokens = tokens.filter(t => t.CA !== CA);
  // Also remove OHLCV data for this token
  ohlcvData = ohlcvData.filter(d => d.CA !== CA);
  return tokens.length < initialLength;
}

export function getToken(CA: string): TokenData | null {
  return tokens.find(t => t.CA === CA) || null;
}

// OHLCV operations
export function insertOHLCVData(data: OHLCVData[]): boolean {
  // Simple append for now
  ohlcvData.push(...data);
  return true;
}

export function getOHLCVData(CA: string, timeframe: string, limit = 1000): OHLCVData[] {
  return ohlcvData
    .filter(d => d.CA === CA && d.timeframe === timeframe)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export function clearOldOHLCVData(CA: string, timeframe: string): boolean {
  // Keep only the latest 1000 records
  const relevantData = ohlcvData
    .filter(d => d.CA === CA && d.timeframe === timeframe)
    .sort((a, b) => b.timestamp - a.timestamp);
  
  if (relevantData.length > 1000) {
    const keepTimestamps = new Set(relevantData.slice(0, 1000).map(d => d.timestamp));
    ohlcvData = ohlcvData.filter(d => 
      !(d.CA === CA && d.timeframe === timeframe) || keepTimestamps.has(d.timestamp)
    );
  }
  
  return true;
}