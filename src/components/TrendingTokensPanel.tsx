'use client';

import { useState, useEffect, Fragment, useRef } from 'react';
import { 
  Settings, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Plus,
  Copy,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Play,
  Pause,
  ListRestart
} from 'lucide-react';
// Removed client-side API import - now using server-side endpoint
import { getTrendingTokensSettings, setTrendingTokensSettings, type TrendingTokensSettings } from '@/lib/localStorage';
import { type TrendingPoolsResponse } from '@/lib/api';
import { copyToClipboard } from '../lib/clipboard';

// Trending token data interface
interface TrendingToken {
  id: string;
  chain: string;
  name: string;
  address: string; // Pool Address (PA)
  contractAddress: string; // Contract Address (CA)
  marketCap?: string;
  fdv?: string;
  priceChanges: {
    m5?: string;
    m15?: string;
    m30?: string;
    h1?: string;
    h6?: string;
    h24?: string;
  };
  volumeChanges: {
    m5?: string;
    m15?: string;
    m30?: string;
    h1?: string;
    h6?: string;
    h24?: string;
  };
  transactions: {
    m5?: { buys: number; sells: number; buyers: number; sellers: number };
    m15?: { buys: number; sells: number; buyers: number; sellers: number };
    m30?: { buys: number; sells: number; buyers: number; sellers: number };
    h1?: { buys: number; sells: number; buyers: number; sellers: number };
    h6?: { buys: number; sells: number; buyers: number; sellers: number };
    h24?: { buys: number; sells: number; buyers: number; sellers: number };
  };
}

// Token transition state for smooth animations
interface TokenTransitionState {
  token: TrendingToken;
  state: 'existing' | 'dropping' | 'adding' | 'stable';
  opacity: number;
  isVisible: boolean;
  pulseEffect?: 'red' | 'green' | 'none';
}

type TimeFrame = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'H12' | 'D1';

interface TrendingTokensPanelProps {
  onAddToken?: (ca: string, network: 'base' | 'solana', timeframe: TimeFrame) => void;
  currentTimeFrame?: TimeFrame;
}

export default function TrendingTokensPanel({ onAddToken, currentTimeFrame }: TrendingTokensPanelProps = {}) {
  const [mounted, setMounted] = useState(false);
  const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  
  // Button feedback state for animations
  const [buttonStates, setButtonStates] = useState<{[tokenId: string]: {adding: boolean, copied: boolean}}>({});
  
  // Settings state
  const [settings, setSettings] = useState<TrendingTokensSettings>({
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
    settingsOpen: false,
    autoUpdateInterval: '00:05:00',
    fadeTime: '00:00:04',
    persistTime: '00:00:02'
  });

  // Derived state from settings
  const settingsOpen = settings.settingsOpen;

  // Auto-update state (always starts as paused)
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [autoUpdateCountdown, setAutoUpdateCountdown] = useState('00:00:00');
  const [autoUpdateInterval, setAutoUpdateInterval] = useState('00:05:00');
  const [isValidAutoUpdateTime, setIsValidAutoUpdateTime] = useState(true);
  
  // Spacer height for bottom scrollable area
  const [spacerHeight, setSpacerHeight] = useState(0);
  
  // Add flag to prevent duplicate API calls
  const [isFetchingData, setIsFetchingData] = useState(false);
  
  // Track if current fetch is from auto-refresh vs manual refresh
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  
  // Fade time state and validation
  const [fadeTime, setFadeTime] = useState('00:00:04');
  
  // Column width state management (resets to defaults on page refresh)
  const defaultColumnWidths = {
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
  };
  
  const [columnWidths, setColumnWidths] = useState(defaultColumnWidths);
  
  // Resize state for drag-to-resize functionality
  const [resizeState, setResizeState] = useState<{
    isResizing: boolean;
    columnKey: string | null;
    startX: number;
    startWidth: number;
  }>({
    isResizing: false,
    columnKey: null,
    startX: 0,
    startWidth: 0,
  });
  const [isValidFadeTime, setIsValidFadeTime] = useState(true);
  
  // Persist time state and validation
  const [persistTime, setPersistTime] = useState('00:00:02');
  const [isValidPersistTime, setIsValidPersistTime] = useState(true);
  
  // Add unique identifier for debugging
  const componentId = useState(() => Math.random().toString(36).substr(2, 9))[0];
  
  // Use ref to track interval to prevent multiple intervals
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use ref to prevent double API calls in React StrictMode
  const lastTriggerTimeRef = useRef<number>(0);
  
  // Refs for synchronized scrollbars
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  // Enhanced token transition state for smooth animations
  const [tokenTransitionStates, setTokenTransitionStates] = useState<TokenTransitionState[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Button state helper functions
  const setTokenAdding = (tokenId: string, adding: boolean) => {
    setButtonStates(prev => ({
      ...prev,
      [tokenId]: { ...prev[tokenId], adding }
    }));
  };

  const setTokenCopied = (tokenId: string, copied: boolean) => {
    setButtonStates(prev => ({
      ...prev,
      [tokenId]: { ...prev[tokenId], copied }
    }));
    // Auto-reset copied state after 1.5 seconds
    if (copied) {
      setTimeout(() => {
        setButtonStates(prev => ({
          ...prev,
          [tokenId]: { ...prev[tokenId], copied: false }
        }));
      }, 1500);
    }
  };

  // Auto-update timer helper functions
  const validateTimerFormat = (time: string): boolean => {
    const timeRegex = /^(\d{1,2}):(\d{2}):(\d{2})$/;
    const match = time.match(timeRegex);
    if (!match) return false;
    
    const [, hours, minutes, seconds] = match;
    const h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const s = parseInt(seconds, 10);
    
    return h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59;
  };

  // Fade time helper functions
  const validateFadeTime = (time: string): boolean => {
    const timeRegex = /^(\d{1,2}):(\d{2}):(\d{2})$/;
    const match = time.match(timeRegex);
    if (!match) return false;
    
    const [, hours, minutes, seconds] = match;
    const h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const s = parseInt(seconds, 10);
    
    // Valid range: 00:00:01 to 24:00:00 (1 second to 24 hours)
    if (h < 0 || h > 24 || m < 0 || m > 59 || s < 0 || s > 59) return false;
    
    const totalSeconds = h * 3600 + m * 60 + s;
    return totalSeconds >= 1 && totalSeconds <= 86400; // 1 second to 24 hours
  };

  const parseTimeToSeconds = (time: string): number => {
    if (!time || typeof time !== 'string') return 4; // Default to 4 seconds
    const parts = time.split(':');
    if (parts.length !== 3) return 4; // Default to 4 seconds
    const [hours, minutes, seconds] = parts.map(Number);
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return 4; // Default to 4 seconds
    return hours * 3600 + minutes * 60 + seconds;
  };

  const formatSecondsToTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle auto-update interval changes
  const handleAutoUpdateIntervalChange = (value: string) => {
    setAutoUpdateInterval(value);
    const isValid = validateTimerFormat(value);
    setIsValidAutoUpdateTime(isValid);
    
    if (isValid) {
      // Save to localStorage
      const updatedSettings = { ...settings, autoUpdateInterval: value };
      setSettings(updatedSettings);
    }
  };

  // Handle fade time changes
  const handleFadeTimeChange = (value: string) => {
    setFadeTime(value);
    const isValid = validateFadeTime(value);
    setIsValidFadeTime(isValid);
    
    if (isValid) {
      // Save to localStorage
      const updatedSettings = { ...settings, fadeTime: value };
      setSettings(updatedSettings);
    }
  };

  // Persist time helper functions
  const validatePersistTime = (time: string): boolean => {
    const timeRegex = /^(\d{1,2}):(\d{2}):(\d{2})$/;
    const match = time.match(timeRegex);
    if (!match) return false;
    
    const [, hours, minutes, seconds] = match;
    const h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const s = parseInt(seconds, 10);
    
    // Valid range: 00:00:00 to reasonable max (allow 0 for no persist)
    if (h < 0 || h > 24 || m < 0 || m > 59 || s < 0 || s > 59) return false;
    
    const totalSeconds = h * 3600 + m * 60 + s;
    if (totalSeconds < 0 || totalSeconds > 86400) return false; // 0 seconds to 24 hours
    
    // Additional validation: persistTime + fadeTime should be less than autoUpdateInterval
    const fadeSeconds = parseTimeToSeconds(fadeTime);
    const autoUpdateSeconds = parseTimeToSeconds(autoUpdateInterval);
    return (totalSeconds + fadeSeconds) < autoUpdateSeconds;
  };

  // Handle persist time changes
  const handlePersistTimeChange = (value: string) => {
    setPersistTime(value);
    const isValid = validatePersistTime(value);
    setIsValidPersistTime(isValid);
    
    if (isValid) {
      // Save to localStorage
      const updatedSettings = { ...settings, persistTime: value };
      setSettings(updatedSettings);
    }
  };

  // Toggle auto-update
  const toggleAutoUpdate = () => {
    if (!isValidAutoUpdateTime) return;
    
    const newAutoUpdateState = !autoUpdate;
    setAutoUpdate(newAutoUpdateState);
    
    if (newAutoUpdateState) {
      // Starting auto-update - set initial countdown
      const intervalSeconds = parseTimeToSeconds(autoUpdateInterval);
      setAutoUpdateCountdown(formatSecondsToTime(intervalSeconds));
    } else {
      // Stopping auto-update - clear countdown
      setAutoUpdateCountdown('00:00:00');
    }
  };

  // Initialize token transition states from current tokens
  const initializeTransitionStates = (tokens: TrendingToken[]): TokenTransitionState[] => {
    return tokens.map(token => ({
      token,
      state: 'stable',
      opacity: 1.0,
      isVisible: true,
      pulseEffect: 'none'
    }));
  };

  // Start smooth transition process for auto-refresh
  const startSmoothTransition = async () => {
    if (isTransitioning) {
            return; // Prevent overlapping transitions
    }
    
        setIsTransitioning(true);
    setIsAutoRefreshing(true); // Mark this as an auto-refresh
    const currentTokens = trendingTokens;
    
    try {
      // Execute the API call to get new data
            await fetchTrendingTokensData();
      
            // This will trigger the transition logic in the useEffect
    } catch (error) {
            setIsTransitioning(false);
      setIsAutoRefreshing(false);
      // Don't break the auto-refresh cycle - let it continue
    }
  };

  // Calculate smooth transition states
  const calculateTransitionStates = (
    currentTokens: TrendingToken[], 
    newTokens: TrendingToken[]
  ): TokenTransitionState[] => {
    const transitionStates: TokenTransitionState[] = [];
    
    // Add existing tokens (either staying or dropping)
    currentTokens.forEach(currentToken => {
      const isStaying = newTokens.some(newToken => newToken.id === currentToken.id);
      
      transitionStates.push({
        token: currentToken,
        state: isStaying ? 'stable' : 'dropping',
        opacity: 1.0,
        isVisible: true,
        pulseEffect: isStaying ? 'none' : 'red'
      });
    });
    
    // Add new tokens
    newTokens.forEach(newToken => {
      const isExisting = currentTokens.some(currentToken => currentToken.id === newToken.id);
      
      if (!isExisting) {
        transitionStates.push({
          token: newToken,
          state: 'adding',
          opacity: 0.0,
          isVisible: true,
          pulseEffect: 'green'
        });
      }
    });
    
    return transitionStates;
  };

  // Fix hydration error by ensuring client-side only rendering
  useEffect(() => {
        setMounted(true);
    // Load settings from localStorage after mounting
    const savedSettings = getTrendingTokensSettings();
    setSettings(savedSettings);
    // Load column widths from settings
    setColumnWidths(savedSettings.columnWidths);
    // Load auto-update interval from settings (but keep auto-update disabled)
    setAutoUpdateInterval(savedSettings.autoUpdateInterval);
    // Load fade time from settings
    setFadeTime(savedSettings.fadeTime);
    // Load persist time from settings
    setPersistTime(savedSettings.persistTime);
    
    return () => {
          };
  }, [componentId]);

  // Save settings to localStorage when changed
  useEffect(() => {
    if (mounted) {
      setTrendingTokensSettings(settings);
    }
  }, [settings, mounted]);

  // Save column widths to localStorage when changed
  useEffect(() => {
    if (mounted) {
      setTrendingTokensSettings({
        ...settings,
        columnWidths
      });
    }
  }, [columnWidths, mounted, settings]);

  // Auto-update timer logic - using a more robust approach
  useEffect(() => {
    // Function to create and manage the timer
    const createTimer = () => {
      // Always clear any existing interval first
      if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      if (!autoUpdate || !isValidAutoUpdateTime) {
                return null;
      }

            
      const intervalId = setInterval(() => {
        // Use callback to get current state to avoid stale closures
        setAutoUpdateCountdown(currentCountdown => {
          const currentSeconds = parseTimeToSeconds(currentCountdown);
                    
          if (currentSeconds <= 1) {
            const now = Date.now();
            const timeSinceLastTrigger = now - lastTriggerTimeRef.current;
            
            // Prevent duplicate triggers within 100ms (React StrictMode protection)
            if (timeSinceLastTrigger < 100) {
                            const intervalSeconds = parseTimeToSeconds(autoUpdateInterval);
              return formatSecondsToTime(intervalSeconds);
            }
            
                        lastTriggerTimeRef.current = now;
            
            // Trigger API call
            startSmoothTransition();
            
            // Reset to new interval
            const intervalSeconds = parseTimeToSeconds(autoUpdateInterval);
            const resetTime = formatSecondsToTime(intervalSeconds);
                        return resetTime;
          } else {
            return formatSecondsToTime(currentSeconds - 1);
          }
        });
      }, 1000);
      
      timerIntervalRef.current = intervalId;
            return intervalId;
    };

    // Create the timer
    const timerId = createTimer();

    // Cleanup function
    return () => {
      if (timerId) {
                clearInterval(timerId);
        if (timerIntervalRef.current === timerId) {
          timerIntervalRef.current = null;
        }
      }
    };
  }, [autoUpdate, isValidAutoUpdateTime, autoUpdateInterval, componentId]);

  // Initialize transition states when tokens first load
  useEffect(() => {
    if (trendingTokens.length > 0 && tokenTransitionStates.length === 0) {
      setTokenTransitionStates(initializeTransitionStates(trendingTokens));
    }
  }, [trendingTokens]);

  // Handle smooth transitions when new data arrives during auto-update
  useEffect(() => {
    if (!isTransitioning) return;
    
    // Get current transition states for comparison
    const currentTokens = tokenTransitionStates.map(state => state.token);
    
    if (currentTokens.length > 0 && trendingTokens.length > 0) {
      // Calculate transition states
      const newTransitionStates = calculateTransitionStates(currentTokens, trendingTokens);
      setTokenTransitionStates(newTransitionStates);
      
      // Start the transition animation sequence
      executeTransitionSequence();
    }
  }, [trendingTokens, isTransitioning]);

  // Update scrollbar widths when table content changes
  useEffect(() => {
    if (mounted) {
      // Use timeout to ensure DOM has rendered
      setTimeout(() => {
        updateScrollbarWidths();
        // Also update spacer height when tokens change
        const newSpacerHeight = calculateSpacerHeight();
        setSpacerHeight(newSpacerHeight);
      }, 100);
      
      // Additional timeout for debugging
      setTimeout(() => {
                updateScrollbarWidths();
        // Also update spacer height
        const newSpacerHeight = calculateSpacerHeight();
        setSpacerHeight(newSpacerHeight);
      }, 500);
    }
  }, [trendingTokens, settings.columns, mounted, tokenTransitionStates]);

  // Monitor table size changes with ResizeObserver
  useEffect(() => {
    if (!tableContainerRef.current || !mounted) return;

    const table = tableContainerRef.current.querySelector('table');
    if (!table) return;

    const resizeObserver = new ResizeObserver(() => {
      updateScrollbarWidths();
      // Also update spacer height when table size changes
      const newSpacerHeight = calculateSpacerHeight();
      setSpacerHeight(newSpacerHeight);
    });

    resizeObserver.observe(table);

    return () => {
      resizeObserver.disconnect();
    };
  }, [mounted]);

  // Window resize listener to recalculate spacer height
  useEffect(() => {
    if (!mounted) return;

    const handleResize = () => {
      const newSpacerHeight = calculateSpacerHeight();
      setSpacerHeight(newSpacerHeight);
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [mounted]);

  // Execute the smooth transition sequence
  const executeTransitionSequence = () => {
    const totalFadeTimeMs = parseTimeToSeconds(fadeTime) * 1000;
    const persistTimeMs = parseTimeToSeconds(persistTime) * 1000;
    const totalTransitionTimeMs = totalFadeTimeMs + persistTimeMs;
    
    // Phase 1: Fade out dropping tokens (always start at 0.1s)
    setTimeout(() => {
      setTokenTransitionStates(prevStates => 
        prevStates.map(state => ({
          ...state,
          opacity: state.state === 'dropping' ? 0.0 : state.opacity
        }))
      );
    }, 100);

    // Phase 2: Fade in new tokens (always start at 0.1s, same time as fade out)
    setTimeout(() => {
      setTokenTransitionStates(prevStates => 
        prevStates.map(state => ({
          ...state,
          opacity: state.state === 'adding' ? 1.0 : state.opacity
        }))
      );
    }, 100);

    // Phase 3: Fade complete - stop RED pulsing, keep GREEN pulsing (at configured fade time)
    setTimeout(() => {
      setTokenTransitionStates(prevStates => 
        prevStates
          .filter(state => state.state !== 'dropping') // Remove dropped tokens
          .map(state => ({
            ...state,
            state: state.state === 'adding' ? 'adding' : 'stable', // Keep adding state for persist
            pulseEffect: state.state === 'adding' ? 'green' : 'none', // Keep green pulse for new tokens
            opacity: 1.0
          }))
      );
    }, totalFadeTimeMs);

    // Phase 4: Final cleanup - stop GREEN pulsing (after fade + persist time)
    setTimeout(() => {
      setTokenTransitionStates(prevStates => 
        prevStates.map(state => ({
          ...state,
          state: 'stable',
          pulseEffect: 'none',
          opacity: 1.0
        }))
      );
      setIsTransitioning(false);
      setIsAutoRefreshing(false); // Ensure auto-refresh flag is cleared
    }, totalTransitionTimeMs);
  };

  // Calculate visible column count for colspan
  const getVisibleColumnCount = () => {
    let count = 3; // CHAIN, ACTIONS, TOKEN are always visible
    if (settings.columns.mc) count++;
    if (settings.columns.fdv) count++;
    if (settings.columns.m5) count++;
    if (settings.columns.m15) count++;
    if (settings.columns.m30) count++;
    if (settings.columns.h1) count++;
    if (settings.columns.h6) count++;
    if (settings.columns.h24) count++;
    if (settings.columns.m5v) count++;
    if (settings.columns.m15v) count++;
    if (settings.columns.m30v) count++;
    if (settings.columns.h1v) count++;
    if (settings.columns.h6v) count++;
    if (settings.columns.h24v) count++;
    return count;
  };

  // Handle column resize functionality
  const handleResizeStart = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[columnKey as keyof typeof columnWidths];
    
    setResizeState({
      isResizing: true,
      columnKey,
      startX,
      startWidth,
    });
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizeState.isResizing || !resizeState.columnKey) return;
    
    const deltaX = e.clientX - resizeState.startX;
    const newWidth = Math.max(30, resizeState.startWidth + deltaX); // Minimum width of 30px
    
    setColumnWidths(prev => ({
      ...prev,
      [resizeState.columnKey!]: newWidth,
    }));
  };

  const handleResizeEnd = () => {
    setResizeState({
      isResizing: false,
      columnKey: null,
      startX: 0,
      startWidth: 0,
    });
  };

  // Reset table to default settings
  const handleResetTable = () => {
    // Reset column widths to defaults
    setColumnWidths(defaultColumnWidths);
    // Reset sorting to no sorting
    setSortConfig(null);
      };

  // Add global mouse event listeners for resize
  useEffect(() => {
    if (resizeState.isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizeState.isResizing, resizeState.startX, resizeState.startWidth, resizeState.columnKey]);

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortConfig && sortConfig.key === column) {
      // Toggle direction
      setSortConfig({
        key: column,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      // New column
      setSortConfig({
        key: column,
        direction: 'asc'
      });
    }
  };

  // Get sorted transition states for display
  const sortedTransitionStates = [...tokenTransitionStates].sort((a, b) => {
    if (!sortConfig) return 0;

    let aValue: any = '';
    let bValue: any = '';

    switch (sortConfig.key) {
      case 'chain':
        aValue = a.token.chain;
        bValue = b.token.chain;
        break;
      case 'token':
        aValue = a.token.name;
        bValue = b.token.name;
        break;
      case 'mc':
        aValue = parseFloat(a.token.marketCap || '0');
        bValue = parseFloat(b.token.marketCap || '0');
        break;
      case 'fdv':
        aValue = parseFloat(a.token.fdv || '0');
        bValue = parseFloat(b.token.fdv || '0');
        break;
      case 'm5':
        aValue = parseFloat(a.token.priceChanges.m5 || '0');
        bValue = parseFloat(b.token.priceChanges.m5 || '0');
        break;
      case 'm15':
        aValue = parseFloat(a.token.priceChanges.m15 || '0');
        bValue = parseFloat(b.token.priceChanges.m15 || '0');
        break;
      case 'm30':
        aValue = parseFloat(a.token.priceChanges.m30 || '0');
        bValue = parseFloat(b.token.priceChanges.m30 || '0');
        break;
      case 'h1':
        aValue = parseFloat(a.token.priceChanges.h1 || '0');
        bValue = parseFloat(b.token.priceChanges.h1 || '0');
        break;
      case 'h6':
        aValue = parseFloat(a.token.priceChanges.h6 || '0');
        bValue = parseFloat(b.token.priceChanges.h6 || '0');
        break;
      case 'h24':
        aValue = parseFloat(a.token.priceChanges.h24 || '0');
        bValue = parseFloat(b.token.priceChanges.h24 || '0');
        break;
      case 'm5v':
        aValue = parseFloat(a.token.volumeChanges.m5 || '0');
        bValue = parseFloat(b.token.volumeChanges.m5 || '0');
        break;
      case 'm15v':
        aValue = parseFloat(a.token.volumeChanges.m15 || '0');
        bValue = parseFloat(b.token.volumeChanges.m15 || '0');
        break;
      case 'm30v':
        aValue = parseFloat(a.token.volumeChanges.m30 || '0');
        bValue = parseFloat(b.token.volumeChanges.m30 || '0');
        break;
      case 'h1v':
        aValue = parseFloat(a.token.volumeChanges.h1 || '0');
        bValue = parseFloat(b.token.volumeChanges.h1 || '0');
        break;
      case 'h6v':
        aValue = parseFloat(a.token.volumeChanges.h6 || '0');
        bValue = parseFloat(b.token.volumeChanges.h6 || '0');
        break;
      case 'h24v':
        aValue = parseFloat(a.token.volumeChanges.h24 || '0');
        bValue = parseFloat(b.token.volumeChanges.h24 || '0');
        break;
      default:
        return 0;
    }

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Get sort icon
  const getSortIcon = (column: string) => {
    if (!sortConfig || sortConfig.key !== column) {
      return <ArrowUpDown size={10} className="opacity-50" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp size={10} className="text-green-400" /> : 
      <ArrowDown size={10} className="text-green-400" />;
  };

  // Format large numbers with abbreviations
  const formatNumber = (value: string | number | undefined): string => {
    if (!value) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '-';
    
    if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + 'M';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + 'K';
    } else {
      return num.toFixed(2);
    }
  };

  // Format volume numbers with abbreviations (1 decimal place)
  const formatVolumeNumber = (value: string | number | undefined): string => {
    if (!value) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '-';
    
    if (num >= 1e9) {
      return (num / 1e9).toFixed(1) + 'B';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(1) + 'M';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(1) + 'K';
    } else {
      return num.toFixed(1);
    }
  };

  // Format price change by removing +/- symbols and rounding to 1 decimal place
  // Add abbreviations for values ≥1000 (e.g., 1358.8% → 1.4K%)
  const formatPriceChange = (value: string | undefined): string => {
    if (!value) return '-';
    const cleanValue = value.replace(/^[+\-]/, '');
    const numValue = parseFloat(cleanValue);
    if (isNaN(numValue)) return cleanValue;
    
    // Apply abbreviations for large values
    if (numValue >= 1e6) {
      return (numValue / 1e6).toFixed(1) + 'M';
    } else if (numValue >= 1e3) {
      return (numValue / 1e3).toFixed(1) + 'K';
    } else {
      return numValue.toFixed(1);
    }
  };

  // Get color class for price changes
  const getPriceChangeColor = (value: string | undefined): string => {
    if (!value) return 'text-gray-300';
    
    // Parse the original value (WITH +/- symbols) to determine actual sign
    const originalNumValue = parseFloat(value);
    if (isNaN(originalNumValue)) return 'text-gray-300';
    
    // Determine color based on the original numeric value
    if (originalNumValue > 0) return 'text-green-500';
    if (originalNumValue < 0) return 'text-red-500';
    return 'text-gray-300';
  };

  // Scroll synchronization functions
  const handleTableScroll = () => {
    if (!tableContainerRef.current || !topScrollRef.current || !bottomScrollRef.current || !leftScrollRef.current) return;
    
    const scrollLeft = tableContainerRef.current.scrollLeft;
    const scrollTop = tableContainerRef.current.scrollTop;
    
    topScrollRef.current.scrollLeft = scrollLeft;
    bottomScrollRef.current.scrollLeft = scrollLeft;
    leftScrollRef.current.scrollTop = scrollTop;
  };

  const handleTopScrollbarScroll = () => {
    if (!topScrollRef.current || !tableContainerRef.current || !bottomScrollRef.current) return;
    
    const scrollLeft = topScrollRef.current.scrollLeft;
    tableContainerRef.current.scrollLeft = scrollLeft;
    bottomScrollRef.current.scrollLeft = scrollLeft;
  };

  const handleBottomScrollbarScroll = () => {
    if (!bottomScrollRef.current || !tableContainerRef.current || !topScrollRef.current) return;
    
    const scrollLeft = bottomScrollRef.current.scrollLeft;
    tableContainerRef.current.scrollLeft = scrollLeft;
    topScrollRef.current.scrollLeft = scrollLeft;
  };

  const handleLeftScrollbarScroll = () => {
    if (!leftScrollRef.current || !tableContainerRef.current) return;
    
    const scrollTop = leftScrollRef.current.scrollTop;
    tableContainerRef.current.scrollTop = scrollTop;
  };

  // Update scrollbar dimensions to match table dimensions
  const updateScrollbarWidths = () => {
    if (!tableContainerRef.current || !topScrollRef.current || !bottomScrollRef.current || !leftScrollRef.current) return;
    
    const table = tableContainerRef.current.querySelector('table');
    if (!table) return;
    
    const tableWidth = table.scrollWidth;
    const tableHeight = table.scrollHeight;
    const containerHeight = tableContainerRef.current.clientHeight;
    const leftScrollHeight = leftScrollRef.current.clientHeight;
    
    // Set the content div width to match the table's scroll width
    const topScrollContent = topScrollRef.current.querySelector('div');
    const bottomScrollContent = bottomScrollRef.current.querySelector('div');
    const leftScrollContent = leftScrollRef.current.querySelector('#left-scroll-content');
    
    if (topScrollContent) {
      topScrollContent.style.width = `${tableWidth}px`;
    }
    if (bottomScrollContent) {
      bottomScrollContent.style.width = `${tableWidth}px`;
    }
    if (leftScrollContent) {
      // The left scrollbar content should match the table's scrollable height
      // Only set height if table content is larger than container
      if (tableHeight > containerHeight) {
        (leftScrollContent as HTMLElement).style.height = `${tableHeight}px`;
      } else {
        // If no overflow needed, set to a minimal height
        (leftScrollContent as HTMLElement).style.height = `${containerHeight + 1}px`;
      }
    }
  };

  // Calculate spacer height to allow bottom element to scroll to top
  const calculateSpacerHeight = () => {
    if (!tableContainerRef.current) return 0;
    
    const containerHeight = tableContainerRef.current.clientHeight;
    const firstRow = tableContainerRef.current.querySelector('tbody tr');
    const rowHeight = firstRow?.clientHeight || 24; // fallback to estimated row height
    
    // Spacer height = container height - one row height
    // This allows the bottom-most row to scroll all the way to the top
    const spacerHeight = Math.max(0, containerHeight - rowHeight);
    
    return spacerHeight;
  };

  // Parse API response to TrendingToken format
  const parseApiResponse = (apiData: TrendingPoolsResponse['data'], network: string): TrendingToken[] => {
    return apiData.map(item => {
      const tokenName = item.attributes.name.split('/')[0];
      // Extract Contract Address from base_token.id (text after underscore)
      const contractAddress = (item as any).relationships?.base_token?.data?.id?.split('_')[1] || item.attributes.address;
      
      return {
        id: item.id,
        chain: network.toUpperCase() === 'SOLANA' ? 'SOL' : 'BASE',
        name: tokenName,
        address: item.attributes.address, // Pool Address (PA)
        contractAddress, // Contract Address (CA) from base_token.id
        marketCap: item.attributes.market_cap_usd,
        fdv: item.attributes.fdv_usd,
        priceChanges: {
          m5: item.attributes.price_change_percentage.m5,
          m15: item.attributes.price_change_percentage.m15,
          m30: item.attributes.price_change_percentage.m30,
          h1: item.attributes.price_change_percentage.h1,
          h6: item.attributes.price_change_percentage.h6,
          h24: item.attributes.price_change_percentage.h24,
        },
        volumeChanges: {
          m5: item.attributes.volume_usd.m5,
          m15: item.attributes.volume_usd.m15,
          m30: item.attributes.volume_usd.m30,
          h1: item.attributes.volume_usd.h1,
          h6: item.attributes.volume_usd.h6,
          h24: item.attributes.volume_usd.h24,
        },
        transactions: item.attributes.transactions
      };
    });
  };

  // Fetch trending tokens data via server-side API
  const fetchTrendingTokensData = async () => {
    // Prevent duplicate calls
    if (isFetchingData) {
            return;
    }
    
    const timestamp = new Date().toISOString();
            setIsFetchingData(true);
    
    // Only show jarring loading state for manual refresh, not auto-refresh
    if (!isAutoRefreshing) {
      setLoading(true);
    }
    try {
            
      // Call server-side API endpoint
      const response = await fetch('/api/trending-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          networks: settings.networks,
          duration: settings.duration
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const responseData = await response.json();
            
      // Parse the response data
      const combinedResults: TrendingToken[] = [];
      
      for (const networkResult of responseData.data) {
        const networkName = networkResult.network;
        const tokens = parseApiResponse(networkResult.data, networkName);
        combinedResults.push(...tokens);
      }
      
      let limitedResults = combinedResults;
      
      if (settings.results !== 'max') {
        const baseTokens = combinedResults.filter(token => token.chain === 'BASE').slice(0, settings.results as number);
        const solTokens = combinedResults.filter(token => token.chain === 'SOL').slice(0, settings.results as number);
        limitedResults = [...baseTokens, ...solTokens];
      }
      
      setTrendingTokens(limitedResults);
            
      // Update scrollbar dimensions after new data is loaded
      setTimeout(() => {
        updateScrollbarWidths();
      }, 200);
    } catch (error) {
            setTrendingTokens([]);
    } finally {
      setLoading(false);
      setIsFetchingData(false);
      setIsAutoRefreshing(false); // Reset auto-refresh flag
    }
  };

  if (!mounted) {
    return <div className="h-full flex flex-col rounded border-l-[4px] border-r-[4px]" style={{backgroundColor: '#0a0a0a', borderColor: '#111111'}}>
      <div className="bg-gray-950 border-b border-gray-800 px-3 py-2">
        <div className="text-lg font-semibold text-white">Trending Tokens</div>
      </div>
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Loading...
      </div>
    </div>;
  }

  return (
    <div className="h-full flex flex-col rounded border-l-[4px] border-r-[4px]" style={{backgroundColor: '#0a0a0a', borderColor: '#111111', position: 'relative'}}>
      {/* Extended bottom border */}
      <div style={{position: 'absolute', bottom: '-12px', left: '0', right: '0', height: '4px', backgroundColor: '#111111'}}></div>
      {/* CSS for smooth transitions and pulsing animations */}
      <style jsx>{`
        @keyframes pulse-red {
          0%, 100% { color: #ef4444; }
          50% { color: #dc2626; }
        }
        @keyframes pulse-green {
          0%, 100% { color: #10b981; }
          50% { color: #059669; }
        }
        .token-row {
          transition: opacity ${mounted ? Math.max(parseTimeToSeconds(fadeTime) - 0.1, 0.1) : 3}s ease-in-out;
        }
        .pulse-red {
          animation: pulse-red 1s ease-in-out infinite;
        }
        .pulse-green {
          animation: pulse-green 1s ease-in-out infinite;
        }
        .token-name {
          transition: color 0.3s ease-in-out;
        }
        /* Hide scrollbars for webkit browsers (Chrome, Safari) */
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      
      {/* Trending Tokens Header */}
      <div className="border-b border-gray-800 px-3 py-2 flex items-center justify-between" style={{backgroundColor: '#111111'}}>
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-white">Trending Tokens</h2>
        </div>
        
        {/* Header Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setIsAutoRefreshing(false); // Ensure manual refresh shows loading state
              fetchTrendingTokensData();
            }}
            disabled={loading}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-900 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          
          {/* Auto-Update Controls Group */}
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleAutoUpdate}
              className={`p-2 rounded transition-colors ${
                autoUpdate 
                  ? 'bg-green-600 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
              title={autoUpdate ? 'Pause Auto Update' : 'Start Auto Update'}
            >
              {autoUpdate ? <Pause size={16} /> : <Play size={16} />}
            </button>
            
            <span className={`text-sm font-mono ${autoUpdate ? 'text-green-400' : 'text-gray-500'}`}>
              {autoUpdateCountdown}
            </span>
            
            <input
              type="text"
              value={autoUpdateInterval}
              onChange={(e) => handleAutoUpdateIntervalChange(e.target.value)}
              placeholder="hh:mm:ss"
              className={`bg-gray-950 text-white border rounded px-1 py-1 text-sm w-20 font-mono focus:outline-none ${
                isValidAutoUpdateTime 
                  ? 'border-green-500 focus:border-green-400' 
                  : 'border-gray-800 focus:border-red-500'
              }`}
              title="Auto Update Interval"
            />
          </div>

          <button
            onClick={() => setSettings(prev => ({ ...prev, settingsOpen: !prev.settingsOpen }))}
            className={`p-2 rounded transition-colors ${
              settingsOpen
                ? 'bg-green-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {settingsOpen && (
        <div className="border-b border-gray-800 px-4 py-2 space-y-2" style={{backgroundColor: '#0a0a0a'}}>
          {/* API Settings - Responsive Layout */}
          <div className="flex flex-wrap items-center gap-3 py-1">
            <div className="flex items-center space-x-4 flex-shrink-0">
              <label className="text-xs text-gray-400">Duration:</label>
              <div className="flex items-center space-x-2">
                {['5m', '1h', '6h', '24h'].map(duration => (
                  <label key={duration} className="flex items-center space-x-1">
                    <input
                      type="radio"
                      name="duration"
                      value={duration}
                      checked={settings.duration === duration}
                      onChange={(e) => setSettings(prev => ({ ...prev, duration: e.target.value as any }))}
                      className="text-green-500 focus:ring-green-500"
                    />
                    <span className="text-xs text-gray-300">{duration}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex items-center space-x-4 flex-shrink-0">
              <label className="text-xs text-gray-400">Networks:</label>
              <div className="flex items-center space-x-2">
                {['Base', 'Solana'].map(network => (
                  <label key={network} className="flex items-center space-x-1">
                    <input
                      type="checkbox"
                      checked={network === 'Base' ? settings.networks.base : settings.networks.solana}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        networks: { 
                          ...prev.networks, 
                          [network === 'Base' ? 'base' : 'solana']: e.target.checked 
                        } 
                      }))}
                      className="text-green-500 focus:ring-green-500"
                    />
                    <span className="text-xs text-gray-300">{network}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex items-center space-x-2 flex-shrink-0">
              <label className="text-xs text-gray-400">Results:</label>
              <select 
                className="bg-gray-700 text-white border border-gray-800 rounded px-2 py-1 text-xs w-16"
                value={settings.results}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  results: e.target.value === 'max' ? 'max' : parseInt(e.target.value) 
                }))}
              >
                {Array.from({length: 10}, (_, i) => (
                  <option key={i+1} value={i+1}>{i+1}</option>
                ))}
                <option value="max">Max</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2 flex-shrink-0">
              <label className="text-xs text-gray-400">Fade Time:</label>
              <input
                type="text"
                value={fadeTime}
                onChange={(e) => handleFadeTimeChange(e.target.value)}
                placeholder="hh:mm:ss"
                className={`bg-gray-900 text-white border rounded px-1 py-1 text-xs w-20 font-mono focus:outline-none ${
                  isValidFadeTime 
                    ? 'border-blue-500 focus:border-blue-400' 
                    : 'border-red-500 focus:border-red-400'
                }`}
                title="Fade transition duration (00:00:01 to 24:00:00)"
              />
            </div>
            
            <div className="flex items-center space-x-2 flex-shrink-0">
              <label className="text-xs text-gray-400">Persist Time:</label>
              <input
                type="text"
                value={persistTime}
                onChange={(e) => handlePersistTimeChange(e.target.value)}
                placeholder="hh:mm:ss"
                className={`bg-gray-900 text-white border rounded px-1 py-1 text-xs w-20 font-mono focus:outline-none ${
                  isValidPersistTime 
                    ? 'border-blue-500 focus:border-blue-400' 
                    : 'border-red-500 focus:border-red-400'
                }`}
                title="Green pulse duration after fade completes (00:00:00 to less than auto-update)"
              />
            </div>
          </div>

          {/* Column Visibility - Horizontal Layout */}
          <div className="space-y-1">
            <div className="flex items-center space-x-6 py-1">
              <div className="flex items-center space-x-4">
                <label className="text-xs text-gray-400">Market Data:</label>
                <div className="flex items-center space-x-2">
                  {['MC', 'FDV'].map(item => (
                    <label key={item} className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={settings.columns[item.toLowerCase() as keyof typeof settings.columns]}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          columns: { 
                            ...prev.columns, 
                            [item.toLowerCase()]: e.target.checked 
                          } 
                        }))}
                        className="text-green-500 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-300">{item}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleResetTable}
                  className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-white hover:bg-gray-900 rounded transition-colors duration-200"
                  title="reset table"
                >
                  <ListRestart className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 py-1">
              <div className="flex items-center space-x-4 flex-shrink-0">
                <label className="text-xs text-gray-400">Price Changes:</label>
                <div className="flex items-center space-x-2">
                  {['M5', 'M15', 'M30', 'H1', 'H6', 'H24'].map(tf => (
                    <label key={tf} className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={settings.columns[tf.toLowerCase() as keyof typeof settings.columns]}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          columns: { 
                            ...prev.columns, 
                            [tf.toLowerCase()]: e.target.checked 
                          } 
                        }))}
                        className="text-green-500 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-300">{tf}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-4 flex-shrink-0">
                <label className="text-xs text-gray-400">Volume Changes:</label>
                <div className="flex items-center space-x-2">
                  {['M5v', 'M15v', 'M30v', 'H1v', 'H6v', 'H24v'].map(tf => (
                    <label key={tf} className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={settings.columns[tf.toLowerCase() as keyof typeof settings.columns]}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          columns: { 
                            ...prev.columns, 
                            [tf.toLowerCase()]: e.target.checked 
                          } 
                        }))}
                        className="text-green-500 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-300">{tf}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="flex-1 flex flex-col">
        {/* Top scroll bar */}
        <div 
          ref={topScrollRef}
          className="overflow-x-auto sleek-horizontal-scrollbar" 
          style={{ height: '12px', width: '100%' }}
          onScroll={handleTopScrollbarScroll}
        >
          <div style={{ height: '1px', width: '2000px' }}></div>
        </div>
        
        {/* Main table area with left scrollbar */}
        <div className="flex-1 flex" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {/* Left vertical scrollbar */}
          <div 
            ref={leftScrollRef}
            className="overflow-y-auto sleek-vertical-scrollbar" 
            style={{ 
              width: '8px', 
              height: '100%',
              maxHeight: 'calc(100vh - 180px)'
            }}
            onScroll={handleLeftScrollbarScroll}
          >
            <div 
              id="left-scroll-content" 
              style={{ 
                width: '1px', 
                height: '800px'
              }}
            ></div>
          </div>
          
          <div 
            ref={tableContainerRef}
            className="flex-1 overflow-auto hide-scrollbar"
            style={{ 
              scrollbarWidth: 'none', /* Firefox */
              msOverflowStyle: 'none', /* IE/Edge */
              maxHeight: 'calc(100vh - 180px)'
            }}
            onScroll={handleTableScroll}
          >
          <table className="w-full text-xs table-fixed">
          <thead className="sticky top-0" style={{backgroundColor: '#0a0a0a'}}>
            <tr>
              <th 
                className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                onClick={() => handleSort('chain')}
                style={{ width: `${columnWidths.chain}px` }}
              >
                <div className="flex items-center space-x-1">
                  <span>CHAIN</span>
                  {getSortIcon('chain')}
                </div>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                  onMouseDown={(e) => handleResizeStart(e, 'chain')}
                />
              </th>
              <th 
                className="text-left p-1 text-gray-400 font-mono whitespace-nowrap relative"
                style={{ width: `${columnWidths.actions}px` }}
              >
                ACTIONS
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                  onMouseDown={(e) => handleResizeStart(e, 'actions')}
                />
              </th>
              <th 
                className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                onClick={() => handleSort('token')}
                style={{ width: `${columnWidths.token}px` }}
              >
                <div className="flex items-center space-x-1">
                  <span>TOKEN</span>
                  {getSortIcon('token')}
                </div>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                  onMouseDown={(e) => handleResizeStart(e, 'token')}
                />
              </th>
              {settings.columns.mc && (
                <th 
                  className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                  onClick={() => handleSort('mc')}
                  style={{ width: `${columnWidths.mc}px` }}
                >
                  <div className="flex items-center space-x-1">
                    <span>MC</span>
                    {getSortIcon('mc')}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                    onMouseDown={(e) => handleResizeStart(e, 'mc')}
                  />
                </th>
              )}
              {settings.columns.fdv && (
                <th 
                  className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                  onClick={() => handleSort('fdv')}
                  style={{ width: `${columnWidths.fdv}px` }}
                >
                  <div className="flex items-center space-x-1">
                    <span>FDV</span>
                    {getSortIcon('fdv')}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                    onMouseDown={(e) => handleResizeStart(e, 'fdv')}
                  />
                </th>
              )}
              {settings.columns.m5 && (
                <th 
                  className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                  onClick={() => handleSort('m5')}
                  style={{ width: `${columnWidths.m5}px` }}
                >
                  <div className="flex items-center space-x-1">
                    <span>5M</span>
                    {getSortIcon('m5')}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                    onMouseDown={(e) => handleResizeStart(e, 'm5')}
                  />
                </th>
              )}
              {settings.columns.m15 && (
                <th 
                  className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                  onClick={() => handleSort('m15')}
                  style={{ width: `${columnWidths.m15}px` }}
                >
                  <div className="flex items-center space-x-1">
                    <span>15M</span>
                    {getSortIcon('m15')}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                    onMouseDown={(e) => handleResizeStart(e, 'm15')}
                  />
                </th>
              )}
              {settings.columns.m30 && (
                <th 
                  className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                  onClick={() => handleSort('m30')}
                  style={{ width: `${columnWidths.m30}px` }}
                >
                  <div className="flex items-center space-x-1">
                    <span>30M</span>
                    {getSortIcon('m30')}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                    onMouseDown={(e) => handleResizeStart(e, 'm30')}
                  />
                </th>
              )}
              {settings.columns.h1 && (
                <th 
                  className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                  onClick={() => handleSort('h1')}
                  style={{ width: `${columnWidths.h1}px` }}
                >
                  <div className="flex items-center space-x-1">
                    <span>H1</span>
                    {getSortIcon('h1')}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                    onMouseDown={(e) => handleResizeStart(e, 'h1')}
                  />
                </th>
              )}
              {settings.columns.h6 && (
                <th 
                  className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                  onClick={() => handleSort('h6')}
                  style={{ width: `${columnWidths.h6}px` }}
                >
                  <div className="flex items-center space-x-1">
                    <span>H6</span>
                    {getSortIcon('h6')}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                    onMouseDown={(e) => handleResizeStart(e, 'h6')}
                  />
                </th>
              )}
              {settings.columns.h24 && (
                <th 
                  className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                  onClick={() => handleSort('h24')}
                  style={{ width: `${columnWidths.h24}px` }}
                >
                  <div className="flex items-center space-x-1">
                    <span>H24</span>
                    {getSortIcon('h24')}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                    onMouseDown={(e) => handleResizeStart(e, 'h24')}
                  />
                </th>
              )}
              {settings.columns.m5v && (
                <th 
                  className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                  onClick={() => handleSort('m5v')}
                  style={{ width: `${columnWidths.m5v}px` }}
                >
                  <div className="flex items-center space-x-1">
                    <span>M5v</span>
                    {getSortIcon('m5v')}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                    onMouseDown={(e) => handleResizeStart(e, 'm5v')}
                  />
                </th>
              )}
              {settings.columns.m15v && (
                <th 
                  className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                  onClick={() => handleSort('m15v')}
                  style={{ width: `${columnWidths.m15v}px` }}
                >
                  <div className="flex items-center space-x-1">
                    <span>M15v</span>
                    {getSortIcon('m15v')}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                    onMouseDown={(e) => handleResizeStart(e, 'm15v')}
                  />
                </th>
              )}
              {settings.columns.m30v && (
                <th 
                  className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                  onClick={() => handleSort('m30v')}
                  style={{ width: `${columnWidths.m30v}px` }}
                >
                  <div className="flex items-center space-x-1">
                    <span>M30v</span>
                    {getSortIcon('m30v')}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                    onMouseDown={(e) => handleResizeStart(e, 'm30v')}
                  />
                </th>
              )}
              {settings.columns.h1v && (
                <th 
                  className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                  onClick={() => handleSort('h1v')}
                  style={{ width: `${columnWidths.h1v}px` }}
                >
                  <div className="flex items-center space-x-1">
                    <span>H1v</span>
                    {getSortIcon('h1v')}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                    onMouseDown={(e) => handleResizeStart(e, 'h1v')}
                  />
                </th>
              )}
              {settings.columns.h6v && (
                <th 
                  className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                  onClick={() => handleSort('h6v')}
                  style={{ width: `${columnWidths.h6v}px` }}
                >
                  <div className="flex items-center space-x-1">
                    <span>H6v</span>
                    {getSortIcon('h6v')}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                    onMouseDown={(e) => handleResizeStart(e, 'h6v')}
                  />
                </th>
              )}
              {settings.columns.h24v && (
                <th 
                  className="text-left p-1 text-gray-400 font-mono whitespace-nowrap cursor-pointer hover:text-white relative"
                  onClick={() => handleSort('h24v')}
                  style={{ width: `${columnWidths.h24v}px` }}
                >
                  <div className="flex items-center space-x-1">
                    <span>H24v</span>
                    {getSortIcon('h24v')}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-500"
                    onMouseDown={(e) => handleResizeStart(e, 'h24v')}
                  />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading && !isAutoRefreshing ? (
              <tr>
                <td colSpan={getVisibleColumnCount()} className="p-8 text-center text-gray-500">
                  Loading trending tokens...
                </td>
              </tr>
            ) : tokenTransitionStates.length === 0 ? (
              <tr>
                <td colSpan={getVisibleColumnCount()} className="p-8 text-center text-gray-500">
                  No trending tokens data. Click refresh to load from API.
                </td>
              </tr>
            ) : (
              sortedTransitionStates.map((transitionState, index) => {
                const token = transitionState.token;
                const pulseClass = transitionState.pulseEffect === 'red' ? 'pulse-red' : 
                                  transitionState.pulseEffect === 'green' ? 'pulse-green' : '';
                
                return (
                <Fragment key={token.id}>
                <tr 
                  className="border-b border-gray-800 hover:bg-gray-950 token-row"
                  style={{ 
                    opacity: transitionState.opacity,
                    backgroundColor: index % 2 === 0 ? '#0a0a0a' : '#111111'
                  }}
                >
                  <td className="p-1 text-gray-300 font-mono whitespace-nowrap overflow-hidden">{token.chain}</td>
                  <td className="p-1 text-gray-300 font-mono whitespace-nowrap overflow-hidden">
                    <div className="flex items-center space-x-1">
                      <button 
                        className={`p-1 rounded transition-all duration-200 transform hover:scale-110 active:scale-95 ${
                          buttonStates[token.id]?.adding 
                            ? 'text-blue-400 cursor-wait' 
                            : 'text-green-500 hover:text-green-400'
                        }`}
                        onClick={async () => {
                          if (onAddToken && currentTimeFrame) {
                            const network = token.chain === 'SOL' ? 'solana' : 'base';
                            setTokenAdding(token.id, true);
                            try {
                              await onAddToken(token.contractAddress, network, currentTimeFrame);
                              // Brief success state
                              setTokenAdding(token.id, false);
                              setTimeout(() => setTokenAdding(token.id, false), 100);
                            } catch (error) {
                              setTokenAdding(token.id, false);
                                                          }
                          } else {
                                                      }
                        }}
                        disabled={buttonStates[token.id]?.adding}
                        title={buttonStates[token.id]?.adding ? "Adding..." : "Add to Chart List"}
                      >
                        <Plus size={12} />
                      </button>
                      <button 
                        className={`p-1 rounded transition-all duration-200 transform hover:scale-110 active:scale-95 ${
                          buttonStates[token.id]?.copied 
                            ? 'text-green-400' 
                            : 'text-gray-400 hover:text-gray-300'
                        }`}
                        onClick={async () => {
                          const success = await copyToClipboard(token.contractAddress);
                          if (success) {
                            setTokenCopied(token.id, true);
                          }
                        }}
                        title={buttonStates[token.id]?.copied ? "Copied!" : "Copy Contract Address"}
                      >
                        {buttonStates[token.id]?.copied ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                      <button 
                        className="text-gray-400 hover:text-gray-300 p-1 rounded"
                        onClick={() => setExpandedRows(prev => 
                          prev.has(token.id) 
                            ? new Set([...prev].filter(id => id !== token.id))
                            : new Set([...prev, token.id])
                        )}
                        title="Toggle Details"
                      >
                        {expandedRows.has(token.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                  </td>
                  <td className={`p-1 font-mono whitespace-nowrap overflow-hidden token-name ${
                    pulseClass || 'text-gray-300'
                  }`}>
                    {token.name}
                  </td>
                  {settings.columns.mc && (
                    <td className="p-1 text-gray-300 font-mono whitespace-nowrap overflow-hidden">
                      {token.marketCap ? `$${formatNumber(token.marketCap)}` : '-'}
                    </td>
                  )}
                  {settings.columns.fdv && (
                    <td className="p-1 text-gray-300 font-mono whitespace-nowrap overflow-hidden">
                      {token.fdv ? `$${formatNumber(token.fdv)}` : '-'}
                    </td>
                  )}
                  {settings.columns.m5 && (
                    <td className={`p-1 font-mono whitespace-nowrap overflow-hidden ${getPriceChangeColor(token.priceChanges.m5)}`}>
                      {formatPriceChange(token.priceChanges.m5)}
                    </td>
                  )}
                  {settings.columns.m15 && (
                    <td className={`p-1 font-mono whitespace-nowrap overflow-hidden ${getPriceChangeColor(token.priceChanges.m15)}`}>
                      {formatPriceChange(token.priceChanges.m15)}
                    </td>
                  )}
                  {settings.columns.m30 && (
                    <td className={`p-1 font-mono whitespace-nowrap overflow-hidden ${getPriceChangeColor(token.priceChanges.m30)}`}>
                      {formatPriceChange(token.priceChanges.m30)}
                    </td>
                  )}
                  {settings.columns.h1 && (
                    <td className={`p-1 font-mono whitespace-nowrap overflow-hidden ${getPriceChangeColor(token.priceChanges.h1)}`}>
                      {formatPriceChange(token.priceChanges.h1)}
                    </td>
                  )}
                  {settings.columns.h6 && (
                    <td className={`p-1 font-mono whitespace-nowrap overflow-hidden ${getPriceChangeColor(token.priceChanges.h6)}`}>
                      {formatPriceChange(token.priceChanges.h6)}
                    </td>
                  )}
                  {settings.columns.h24 && (
                    <td className={`p-1 font-mono whitespace-nowrap overflow-hidden ${getPriceChangeColor(token.priceChanges.h24)}`}>
                      {formatPriceChange(token.priceChanges.h24)}
                    </td>
                  )}
                  {settings.columns.m5v && (
                    <td className="p-1 text-yellow-500 font-mono whitespace-nowrap overflow-hidden">
                      {token.volumeChanges.m5 ? `$${formatVolumeNumber(token.volumeChanges.m5)}` : '-'}
                    </td>
                  )}
                  {settings.columns.m15v && (
                    <td className="p-1 text-yellow-500 font-mono whitespace-nowrap overflow-hidden">
                      {token.volumeChanges.m15 ? `$${formatVolumeNumber(token.volumeChanges.m15)}` : '-'}
                    </td>
                  )}
                  {settings.columns.m30v && (
                    <td className="p-1 text-yellow-500 font-mono whitespace-nowrap overflow-hidden">
                      {token.volumeChanges.m30 ? `$${formatVolumeNumber(token.volumeChanges.m30)}` : '-'}
                    </td>
                  )}
                  {settings.columns.h1v && (
                    <td className="p-1 text-yellow-500 font-mono whitespace-nowrap overflow-hidden">
                      {token.volumeChanges.h1 ? `$${formatVolumeNumber(token.volumeChanges.h1)}` : '-'}
                    </td>
                  )}
                  {settings.columns.h6v && (
                    <td className="p-1 text-yellow-500 font-mono whitespace-nowrap overflow-hidden">
                      {token.volumeChanges.h6 ? `$${formatVolumeNumber(token.volumeChanges.h6)}` : '-'}
                    </td>
                  )}
                  {settings.columns.h24v && (
                    <td className="p-1 text-yellow-500 font-mono whitespace-nowrap overflow-hidden">
                      {token.volumeChanges.h24 ? `$${formatVolumeNumber(token.volumeChanges.h24)}` : '-'}
                    </td>
                  )}
                </tr>
                {/* Expanded Row Details */}
                {expandedRows.has(token.id) && (
                  <tr className="bg-gray-850">
                    <td colSpan={getVisibleColumnCount()} className="p-2">
                      <div className="text-xs">
                        <div className="flex space-x-6">
                          {/* Buys/Sells Section */}
                          <div className="min-w-0">
                            <h4 className="text-gray-300 font-semibold mb-1">Buys/Sells</h4>
                            <div className="space-y-0.5">
                              {(['m5', 'm15', 'm30', 'h1', 'h6', 'h24'] as const).map(timeframe => {
                                const txData = token.transactions[timeframe];
                                return (
                                  <div key={timeframe} className="flex items-center space-x-2">
                                    <span className="text-gray-400 w-6 text-right">{timeframe.toUpperCase()}:</span>
                                    <span className="text-green-400 w-12 text-right">
                                      {txData?.buys || 0}
                                    </span>
                                    <span className="text-red-400 w-12 text-right">
                                      {txData?.sells || 0}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Buyers/Sellers Section */}
                          <div className="min-w-0">
                            <h4 className="text-gray-300 font-semibold mb-1">Buyers/Sellers</h4>
                            <div className="space-y-0.5">
                              {(['m5', 'm15', 'm30', 'h1', 'h6', 'h24'] as const).map(timeframe => {
                                const txData = token.transactions[timeframe];
                                return (
                                  <div key={timeframe} className="flex items-center space-x-2">
                                    <span className="text-gray-400 w-6 text-right">{timeframe.toUpperCase()}:</span>
                                    <span className="text-green-400 w-12 text-right">
                                      {txData?.buyers || 0}
                                    </span>
                                    <span className="text-red-400 w-12 text-right">
                                      {txData?.sellers || 0}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })
            )}
          </tbody>
          </table>
          {/* Spacer div to allow bottom element to scroll to top */}
          <div style={{ height: `${spacerHeight}px` }}></div>
          </div>
        </div>
        
        {/* Bottom scroll bar */}
        <div 
          ref={bottomScrollRef}
          className="overflow-x-auto sleek-horizontal-scrollbar" 
          style={{ height: '12px', width: '100%' }}
          onScroll={handleBottomScrollbarScroll}
        >
          <div style={{ height: '1px', width: '2000px' }}></div>
        </div>
      </div>
    </div>
  );
}