// Local Storage utility for CryptoDashboard settings persistence

export type ChartType = 'candles' | 'ohlc' | 'line';
export type TimeFrame = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'H12' | 'D1';
export type Mode = 'absolute' | 'percentage';

// Mode-specific settings (separate for absolute and percentage)
export interface ModeSettings {
  chartType: ChartType;
  decimals: number;
  rightMargin: number;
  isLocked: boolean;
  chartHeight?: number; // Chart height in pixels
  rebasePoint?: number; // Only for percentage mode
}

// Global settings that apply regardless of mode
export interface GlobalSettings {
  currentMode: Mode;
  currentTimeFrame: TimeFrame;
  networkSelection: 'base' | 'solana';
  manualTimers: Record<TimeFrame, string>;
}

// Component collapse states
export interface ComponentStates {
  leftPanelCollapsed: boolean;
  addTokensCollapsed: boolean;
  chartListCollapsed: boolean;
  testingCollapsed: boolean;
}

// Trending tokens settings
export interface TrendingTokensSettings {
  duration: '5m' | '1h' | '6h' | '24h';
  networks: { base: boolean; solana: boolean };
  results: number | 'max';
  columns: {
    mc: boolean;
    fdv: boolean;
    m5: boolean;
    m15: boolean;
    m30: boolean;
    h1: boolean;
    h6: boolean;
    h24: boolean;
    m5v: boolean;
    m15v: boolean;
    m30v: boolean;
    h1v: boolean;
    h6v: boolean;
    h24v: boolean;
  };
  columnWidths: {
    chain: number;
    actions: number;
    token: number;
    mc: number;
    fdv: number;
    m5: number;
    m15: number;
    m30: number;
    h1: number;
    h6: number;
    h24: number;
    m5v: number;
    m15v: number;
    m30v: number;
    h1v: number;
    h6v: number;
    h24v: number;
  };
  settingsOpen: boolean;
  autoUpdateInterval: string; // Manual timer interval (e.g., "00:05:00")
  fadeTime: string; // Fade transition duration (e.g., "00:00:04")
  persistTime: string; // Green pulse persist duration after fade (e.g., "00:00:02")
}

// Individual token state
export interface TokenState {
  visible: boolean;
  color: string;
  order: number;
}

// Storage keys
const STORAGE_KEYS = {
  ABSOLUTE_SETTINGS: 'crypto_dashboard_settings_absolute',
  PERCENTAGE_SETTINGS: 'crypto_dashboard_settings_percentage',
  GLOBAL_SETTINGS: 'crypto_dashboard_global_settings',
  COMPONENT_STATES: 'crypto_dashboard_component_states',
  TOKEN_STATES: 'crypto_dashboard_token_states',
  TRENDING_TOKENS_SETTINGS: 'crypto_dashboard_trending_tokens_settings'
} as const;

// Default values
const DEFAULT_MODE_SETTINGS: ModeSettings = {
  chartType: 'candles',
  decimals: 2,
  rightMargin: 10,
  isLocked: false,
  chartHeight: 400
};

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  currentMode: 'absolute',
  currentTimeFrame: 'M5',
  networkSelection: 'base',
  manualTimers: {
    'M1': '00:01:30',
    'M5': '00:05:00',
    'M15': '00:15:00',
    'H1': '01:00:00',
    'H4': '04:00:00',
    'H12': '12:00:00',
    'D1': '24:00:00'
  }
};

const DEFAULT_COMPONENT_STATES: ComponentStates = {
  leftPanelCollapsed: false,
  addTokensCollapsed: false,
  chartListCollapsed: false,
  testingCollapsed: false
};

const DEFAULT_TRENDING_TOKENS_SETTINGS: TrendingTokensSettings = {
  duration: '1h',
  networks: { base: true, solana: true },
  results: 5,
  columns: {
    mc: true,
    fdv: true,
    m5: true,
    m15: true,
    m30: true,
    h1: true,
    h6: true,
    h24: true,
    m5v: true,
    m15v: true,
    m30v: true,
    h1v: true,
    h6v: true,
    h24v: true,
  },
  columnWidths: {
    chain: 60,
    actions: 80,
    token: 120,
    mc: 80,
    fdv: 80,
    m5: 50,
    m15: 50,
    m30: 50,
    h1: 50,
    h6: 50,
    h24: 50,
    m5v: 60,
    m15v: 60,
    m30v: 60,
    h1v: 60,
    h6v: 60,
    h24v: 60,
  },
  settingsOpen: false,
  autoUpdateInterval: '00:05:00', // Default 5 minutes
  fadeTime: '00:00:04', // Default 4 seconds to match current behavior
  persistTime: '00:00:02' // Default 2 seconds persist time
};

// Utility functions
function isLocalStorageAvailable(): boolean {
  try {
    const test = 'localStorage_test';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

function safeGetItem<T>(key: string, defaultValue: T): T {
  if (!isLocalStorageAvailable()) {
    return defaultValue;
  }

  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    return JSON.parse(item) as T;
  } catch (error) {
        return defaultValue;
  }
}

function safeSetItem<T>(key: string, value: T): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
        return false;
  }
}

// Mode-specific settings functions
export function getModeSettings(mode: Mode): ModeSettings {
  const key = mode === 'absolute' ? STORAGE_KEYS.ABSOLUTE_SETTINGS : STORAGE_KEYS.PERCENTAGE_SETTINGS;
  return safeGetItem(key, DEFAULT_MODE_SETTINGS);
}

export function setModeSettings(mode: Mode, settings: ModeSettings): boolean {
  const key = mode === 'absolute' ? STORAGE_KEYS.ABSOLUTE_SETTINGS : STORAGE_KEYS.PERCENTAGE_SETTINGS;
  return safeSetItem(key, settings);
}

// Global settings functions
export function getGlobalSettings(): GlobalSettings {
  return safeGetItem(STORAGE_KEYS.GLOBAL_SETTINGS, DEFAULT_GLOBAL_SETTINGS);
}

export function setGlobalSettings(settings: GlobalSettings): boolean {
  return safeSetItem(STORAGE_KEYS.GLOBAL_SETTINGS, settings);
}

// Component states functions
export function getComponentStates(): ComponentStates {
  return safeGetItem(STORAGE_KEYS.COMPONENT_STATES, DEFAULT_COMPONENT_STATES);
}

export function setComponentStates(states: ComponentStates): boolean {
  return safeSetItem(STORAGE_KEYS.COMPONENT_STATES, states);
}

// Token states functions
export function getTokenStates(): Record<string, TokenState> {
  return safeGetItem(STORAGE_KEYS.TOKEN_STATES, {});
}

export function setTokenStates(states: Record<string, TokenState>): boolean {
  return safeSetItem(STORAGE_KEYS.TOKEN_STATES, states);
}

export function getTokenState(ca: string): TokenState | null {
  const allStates = getTokenStates();
  return allStates[ca] || null;
}

export function setTokenState(ca: string, state: TokenState): boolean {
  const allStates = getTokenStates();
  allStates[ca] = state;
  return setTokenStates(allStates);
}

export function removeTokenState(ca: string): boolean {
  const allStates = getTokenStates();
  delete allStates[ca];
  return setTokenStates(allStates);
}

// Trending tokens settings functions
export function getTrendingTokensSettings(): TrendingTokensSettings {
  const stored = safeGetItem(STORAGE_KEYS.TRENDING_TOKENS_SETTINGS, DEFAULT_TRENDING_TOKENS_SETTINGS);
  // Ensure backward compatibility by merging with defaults
  return {
    ...DEFAULT_TRENDING_TOKENS_SETTINGS,
    ...stored,
    columns: {
      ...DEFAULT_TRENDING_TOKENS_SETTINGS.columns,
      ...stored.columns
    },
    columnWidths: {
      ...DEFAULT_TRENDING_TOKENS_SETTINGS.columnWidths,
      ...stored.columnWidths
    }
  };
}

export function setTrendingTokensSettings(settings: TrendingTokensSettings): boolean {
  return safeSetItem(STORAGE_KEYS.TRENDING_TOKENS_SETTINGS, settings);
}

// Convenience functions for specific settings
export function updateManualTimer(timeFrame: TimeFrame, timerValue: string): boolean {
  const globalSettings = getGlobalSettings();
  globalSettings.manualTimers[timeFrame] = timerValue;
  return setGlobalSettings(globalSettings);
}

export function getManualTimer(timeFrame: TimeFrame): string {
  const globalSettings = getGlobalSettings();
  return globalSettings.manualTimers[timeFrame] || DEFAULT_GLOBAL_SETTINGS.manualTimers[timeFrame];
}

// Reset functions for settings that should always start as "off"
export function resetVolatileSettings(): void {
  // These settings should always start as "off" on page reload
  // This function should be called on app initialization
  }