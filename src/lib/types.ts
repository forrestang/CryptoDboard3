// Shared types for the application

export interface TokenData {
  CA: string;
  network: string;
  name: string;
  symbol: string;
  image_url?: string;
  PA: string;
  created_at?: string;
  updated_at?: string;
}

export interface OHLCVData {
  CA: string;
  symbol: string;
  timestamp: number;
  readable_timestamp?: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  created_at?: string;
}

// Chart List Management
export interface ChartListItem {
  CA: string;
  network: string;
  name: string;
  symbol: string;
  image_url?: string;
  PA: string;
  visible: boolean;
  color: string;
  order: number;
}