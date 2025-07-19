import fs from 'fs';
import path from 'path';

// Default storage configuration
export interface StorageConfig {
  dataPath: string;
  tokensFile: string;
  ohlcvFile: string;
  settingsFile: string;
}

// Default configuration
const DEFAULT_CONFIG: StorageConfig = {
  dataPath: path.join(process.cwd(), 'data'),
  tokensFile: 'tokens.json',
  ohlcvFile: 'ohlcv.json',
  settingsFile: 'storage-settings.json'
};

// Token and OHLCV data interfaces
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

class JSONStorage {
  private config: StorageConfig;

  constructor(config?: Partial<StorageConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureDirectoryExists();
  }

  // Ensure storage directory exists
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.config.dataPath)) {
      fs.mkdirSync(this.config.dataPath, { recursive: true });
    }
  }

  // Get full file paths
  private getTokensPath(): string {
    return path.join(this.config.dataPath, this.config.tokensFile);
  }

  private getOHLCVPath(): string {
    return path.join(this.config.dataPath, this.config.ohlcvFile);
  }

  private getSettingsPath(): string {
    return path.join(this.config.dataPath, this.config.settingsFile);
  }

  // Load data from JSON file
  private loadJSON<T>(filePath: string, defaultValue: T): T {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
          }
    return defaultValue;
  }

  // Save data to JSON file
  private saveJSON<T>(filePath: string, data: T): boolean {
    try {
      const jsonData = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, jsonData, 'utf8');
      return true;
    } catch (error) {
            return false;
    }
  }

  // Update storage configuration
  updateConfig(newConfig: Partial<StorageConfig>): boolean {
    try {
      this.config = { ...this.config, ...newConfig };
      this.ensureDirectoryExists();
      
      // Save new config to settings file
      this.saveJSON(this.getSettingsPath(), this.config);
      return true;
    } catch (error) {
            return false;
    }
  }

  // Load storage configuration
  loadConfig(): StorageConfig {
    try {
      const savedConfig = this.loadJSON(this.getSettingsPath(), {});
      this.config = { ...DEFAULT_CONFIG, ...savedConfig };
      return this.config;
    } catch (error) {
            return this.config;
    }
  }

  // Get current configuration
  getConfig(): StorageConfig {
    return { ...this.config };
  }

  // Token operations
  getAllTokens(): TokenData[] {
    return this.loadJSON<TokenData[]>(this.getTokensPath(), []);
  }

  getToken(CA: string): TokenData | null {
    const tokens = this.getAllTokens();
    return tokens.find(token => token.CA === CA) || null;
  }

  insertToken(token: TokenData): boolean {
    try {
      const tokens = this.getAllTokens();
      const existingIndex = tokens.findIndex(t => t.CA === token.CA);
      
      const tokenWithTimestamp = {
        ...token,
        created_at: existingIndex === -1 ? new Date().toISOString() : tokens[existingIndex].created_at,
        updated_at: new Date().toISOString()
      };

      if (existingIndex !== -1) {
        tokens[existingIndex] = tokenWithTimestamp;
      } else {
        tokens.push(tokenWithTimestamp);
      }

      return this.saveJSON(this.getTokensPath(), tokens);
    } catch (error) {
            return false;
    }
  }

  deleteToken(CA: string): boolean {
    try {
      const tokens = this.getAllTokens();
      const filteredTokens = tokens.filter(token => token.CA !== CA);
      
      // Also remove OHLCV data for this token
      const ohlcvData = this.getAllOHLCVData();
      const filteredOHLCV = ohlcvData.filter(data => data.CA !== CA);
      
      const tokensSuccess = this.saveJSON(this.getTokensPath(), filteredTokens);
      const ohlcvSuccess = this.saveJSON(this.getOHLCVPath(), filteredOHLCV);
      
      return tokensSuccess && ohlcvSuccess;
    } catch (error) {
            return false;
    }
  }

  // OHLCV operations
  getAllOHLCVData(): OHLCVData[] {
    return this.loadJSON<OHLCVData[]>(this.getOHLCVPath(), []);
  }

  getOHLCVData(CA: string, timeframe: string, limit = 1000): OHLCVData[] {
    const allData = this.getAllOHLCVData();
    return allData
      .filter(data => data.CA === CA && data.timeframe === timeframe)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  insertOHLCVData(data: OHLCVData[]): boolean {
    try {
      const existingData = this.getAllOHLCVData();
      
      // Add timestamps and merge data
      const dataWithTimestamps = data.map(item => ({
        ...item,
        created_at: new Date().toISOString()
      }));

      // Remove duplicates (same CA, timestamp, timeframe)
      const mergedData = [...existingData];
      
      for (const newItem of dataWithTimestamps) {
        const existingIndex = mergedData.findIndex(
          existing => 
            existing.CA === newItem.CA && 
            existing.timestamp === newItem.timestamp && 
            existing.timeframe === newItem.timeframe
        );
        
        if (existingIndex !== -1) {
          mergedData[existingIndex] = newItem;
        } else {
          mergedData.push(newItem);
        }
      }

      return this.saveJSON(this.getOHLCVPath(), mergedData);
    } catch (error) {
            return false;
    }
  }

  clearOldOHLCVData(CA: string, timeframe: string): boolean {
    try {
      const allData = this.getAllOHLCVData();
      
      // Get data for this token and timeframe
      const relevantData = allData
        .filter(data => data.CA === CA && data.timeframe === timeframe)
        .sort((a, b) => b.timestamp - a.timestamp);
      
      if (relevantData.length <= 1000) {
        return true; // No need to clean up
      }

      // Keep only latest 1000 records
      const keepTimestamps = new Set(
        relevantData.slice(0, 1000).map(data => data.timestamp)
      );
      
      const filteredData = allData.filter(data => 
        !(data.CA === CA && data.timeframe === timeframe) || 
        keepTimestamps.has(data.timestamp)
      );

      return this.saveJSON(this.getOHLCVPath(), filteredData);
    } catch (error) {
            return false;
    }
  }

  // Utility functions
  exportData(): { tokens: TokenData[]; ohlcv: OHLCVData[]; config: StorageConfig } {
    return {
      tokens: this.getAllTokens(),
      ohlcv: this.getAllOHLCVData(),
      config: this.getConfig()
    };
  }

  importData(data: { tokens?: TokenData[]; ohlcv?: OHLCVData[] }): boolean {
    try {
      let success = true;
      
      if (data.tokens) {
        success = success && this.saveJSON(this.getTokensPath(), data.tokens);
      }
      
      if (data.ohlcv) {
        success = success && this.saveJSON(this.getOHLCVPath(), data.ohlcv);
      }
      
      return success;
    } catch (error) {
            return false;
    }
  }

  // Get storage statistics
  getStorageStats(): { tokensCount: number; ohlcvCount: number; totalSize: string } {
    try {
      const tokens = this.getAllTokens();
      const ohlcv = this.getAllOHLCVData();
      
      let totalBytes = 0;
      
      if (fs.existsSync(this.getTokensPath())) {
        totalBytes += fs.statSync(this.getTokensPath()).size;
      }
      
      if (fs.existsSync(this.getOHLCVPath())) {
        totalBytes += fs.statSync(this.getOHLCVPath()).size;
      }
      
      const totalSize = totalBytes > 1024 * 1024 
        ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`
        : `${(totalBytes / 1024).toFixed(2)} KB`;

      return {
        tokensCount: tokens.length,
        ohlcvCount: ohlcv.length,
        totalSize
      };
    } catch (error) {
            return { tokensCount: 0, ohlcvCount: 0, totalSize: '0 KB' };
    }
  }
}

// Create and export singleton instance
export const jsonStorage = new JSONStorage();

// Export individual functions for backward compatibility
export function getAllTokens(): TokenData[] {
  return jsonStorage.getAllTokens();
}

export function getToken(CA: string): TokenData | null {
  return jsonStorage.getToken(CA);
}

export function insertToken(token: TokenData): boolean {
  return jsonStorage.insertToken(token);
}

export function deleteToken(CA: string): boolean {
  return jsonStorage.deleteToken(CA);
}

export function getAllOHLCVData(): OHLCVData[] {
  return jsonStorage.getAllOHLCVData();
}

export function getOHLCVData(CA: string, timeframe: string, limit = 1000): OHLCVData[] {
  return jsonStorage.getOHLCVData(CA, timeframe, limit);
}

export function insertOHLCVData(data: OHLCVData[]): boolean {
  return jsonStorage.insertOHLCVData(data);
}

export function clearOldOHLCVData(CA: string, timeframe: string): boolean {
  return jsonStorage.clearOldOHLCVData(CA, timeframe);
}