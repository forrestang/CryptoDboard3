import Database from 'better-sqlite3';
import path from 'path';

// Database connection instance
let db: Database.Database | null = null;

// Initialize database connection
export function initDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'data', 'crypto_dashboard.db');
    db = new Database(dbPath);
    
    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    
    // Create tables if they don't exist
    createTables();
  }
  
  return db;
}

// Create database tables
function createTables() {
  if (!db) return;
  
  // Create Tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS Tokens (
      CA TEXT PRIMARY KEY,
      network TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      image_url TEXT,
      PA TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create OHLCVdata table
  db.exec(`
    CREATE TABLE IF NOT EXISTS OHLCVdata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      CA TEXT NOT NULL,
      symbol TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      timeframe TEXT NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (CA) REFERENCES Tokens(CA) ON DELETE CASCADE,
      UNIQUE(CA, timestamp, timeframe)
    )
  `);
  
  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ohlcv_ca_timeframe ON OHLCVdata(CA, timeframe);
    CREATE INDEX IF NOT EXISTS idx_ohlcv_timestamp ON OHLCVdata(timestamp);
    CREATE INDEX IF NOT EXISTS idx_tokens_network ON Tokens(network);
  `);
}

// Get database instance
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

// Close database connection
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// Token CRUD operations
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

// Insert or update token
export function insertToken(token: TokenData): boolean {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO Tokens (CA, network, name, symbol, image_url, PA, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  
  try {
    const result = stmt.run(token.CA, token.network, token.name, token.symbol, token.image_url || null, token.PA);
    return result.changes > 0;
  } catch (error) {
        return false;
  }
}

// Get token by CA
export function getToken(CA: string): TokenData | null {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT CA, network, name, symbol, image_url, PA
    FROM Tokens
    WHERE CA = ?
  `);
  
  try {
    const result = stmt.get(CA) as TokenData | undefined;
    return result || null;
  } catch (error) {
        return null;
  }
}

// Get all tokens
export function getAllTokens(): TokenData[] {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT CA, network, name, symbol, image_url, PA
    FROM Tokens
    ORDER BY created_at DESC
  `);
  
  try {
    return stmt.all() as TokenData[];
  } catch (error) {
        return [];
  }
}

// Delete token (will cascade delete OHLCV data)
export function deleteToken(CA: string): boolean {
  const db = getDatabase();
  
  const stmt = db.prepare(`DELETE FROM Tokens WHERE CA = ?`);
  
  try {
    const result = stmt.run(CA);
    return result.changes > 0;
  } catch (error) {
        return false;
  }
}

// Insert OHLCV data (batch insert with conflict resolution)
export function insertOHLCVData(data: OHLCVData[]): boolean {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO OHLCVdata (CA, symbol, timestamp, timeframe, open, high, low, close, volume)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  try {
    const transaction = db.transaction((dataArray: OHLCVData[]) => {
      for (const item of dataArray) {
        stmt.run(item.CA, item.symbol, item.timestamp, item.timeframe, item.open, item.high, item.low, item.close, item.volume);
      }
    });
    
    transaction(data);
    return true;
  } catch (error) {
        return false;
  }
}

// Get OHLCV data for a token
export function getOHLCVData(CA: string, timeframe: string, limit = 1000): OHLCVData[] {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT CA, symbol, timestamp, timeframe, open, high, low, close, volume
    FROM OHLCVdata
    WHERE CA = ? AND timeframe = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  
  try {
    return stmt.all(CA, timeframe, limit) as OHLCVData[];
  } catch (error) {
        return [];
  }
}

// Clear old OHLCV data for a token (keep only latest 1000 records per timeframe)
export function clearOldOHLCVData(CA: string, timeframe: string): boolean {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    DELETE FROM OHLCVdata
    WHERE CA = ? AND timeframe = ? AND timestamp < (
      SELECT timestamp FROM OHLCVdata
      WHERE CA = ? AND timeframe = ?
      ORDER BY timestamp DESC
      LIMIT 1 OFFSET 1000
    )
  `);
  
  try {
    stmt.run(CA, timeframe, CA, timeframe);
    return true;
  } catch (error) {
        return false;
  }
}