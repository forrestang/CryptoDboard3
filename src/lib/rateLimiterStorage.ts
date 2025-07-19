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

// localStorage key for rate limiter data
const RATE_LIMITER_KEY = 'crypto_dashboard_rate_limiter';

// Check if localStorage is available
function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const test = 'localStorage_test';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// Load rate limiter data from localStorage
export async function loadRateLimiterData(): Promise<RateLimiterData> {
  try {
    if (!isLocalStorageAvailable()) {
      return { ...defaultRateLimiterData };
    }
    
    const data = localStorage.getItem(RATE_LIMITER_KEY);
    if (!data) {
      return { ...defaultRateLimiterData };
    }
    
    return JSON.parse(data);
  } catch (error) {
    // Data is corrupted, return default data
        return { ...defaultRateLimiterData };
  }
}

// Save rate limiter data to localStorage
export async function saveRateLimiterData(data: RateLimiterData): Promise<void> {
  try {
    if (!isLocalStorageAvailable()) {
            return;
    }
    
    localStorage.setItem(RATE_LIMITER_KEY, JSON.stringify(data));
  } catch (error) {
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

// Increment call count and save
export async function incrementCallCount(): Promise<boolean> {
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