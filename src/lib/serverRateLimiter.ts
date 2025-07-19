import { promises as fs } from 'fs';
import path from 'path';

// Simple mutex for file operations to prevent race conditions
let rateLimiterMutex: Promise<any> = Promise.resolve();

// Rate limiter data structure
interface RateLimiterData {
  lastReset: number;
  callCount: number;
  maxCalls: number;
  windowMs: number;
  globalStartTime: number | null;
}

// Default rate limiter state
const defaultRateLimiterData: RateLimiterData = {
  lastReset: Date.now(),
  callCount: 0,
  maxCalls: 30,
  windowMs: 60000, // 1 minute
  globalStartTime: null
};

// Path to rate limiter data file
const RATE_LIMITER_FILE_PATH = path.join(process.cwd(), 'data', 'rateLimiter.json');

// Load rate limiter data from file
async function loadRateLimiterData(): Promise<RateLimiterData> {
  try {
    const data = await fs.readFile(RATE_LIMITER_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is corrupted, return default data
        return { ...defaultRateLimiterData };
  }
}

// Save rate limiter data to file
async function saveRateLimiterData(data: RateLimiterData): Promise<void> {
  try {
    await fs.writeFile(RATE_LIMITER_FILE_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
        throw error;
  }
}

// Get current rate limiter data with reset logic
export async function getRateLimiterData(): Promise<RateLimiterData> {
  const data = await loadRateLimiterData();
  const now = Date.now();
  
  // If globalStartTime is set, check if we need to reset based on fixed intervals
  if (data.globalStartTime !== null) {
    const timeSinceStart = now - data.globalStartTime;
    const intervalsElapsed = Math.floor(timeSinceStart / data.windowMs);
    const shouldReset = intervalsElapsed > Math.floor((data.lastReset - data.globalStartTime) / data.windowMs);
    
    if (shouldReset) {
      data.callCount = 0;
      data.lastReset = now;
      await saveRateLimiterData(data);
          }
  }
  
  return data;
}

// Increment call count and save (returns true if allowed, false if rate limited)
export async function incrementCallCount(): Promise<boolean> {
  // Use mutex to prevent race conditions during concurrent API calls
  return await (rateLimiterMutex = rateLimiterMutex.then(async (): Promise<boolean> => {
    const data = await getRateLimiterData();
    const now = Date.now();
    
    // Set globalStartTime on first API call
    if (data.globalStartTime === null) {
      data.globalStartTime = now;
      data.lastReset = now;
    }
    
    // Check if we can make another call
    if (data.callCount >= data.maxCalls) {
            return false;
    }
    
    // Increment call count
    data.callCount++;
    await saveRateLimiterData(data);
    
        
    return true;
  }));
}

// Get current API call count info
export async function getApiCallCountInfo(): Promise<{ current: number; max: number; resetTime: number }> {
  const data = await getRateLimiterData();
  
  // If no global start time, return default values
  if (data.globalStartTime === null) {
    return {
      current: 0,
      max: data.maxCalls,
      resetTime: Date.now() + data.windowMs
    };
  }
  
  // Calculate next reset time based on global start time
  const now = Date.now();
  const timeSinceStart = now - data.globalStartTime;
  const intervalsElapsed = Math.floor(timeSinceStart / data.windowMs);
  const nextResetTime = data.globalStartTime + ((intervalsElapsed + 1) * data.windowMs);
  
  return {
    current: data.callCount,
    max: data.maxCalls,
    resetTime: nextResetTime
  };
}

// Reset rate limiter (for testing)
export async function resetRateLimiter(): Promise<void> {
  const data = { ...defaultRateLimiterData };
  await saveRateLimiterData(data);
  }