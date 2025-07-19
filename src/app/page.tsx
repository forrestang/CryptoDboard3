'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import LeftPanel, { type LeftPanelRef } from '@/components/LeftPanel';
import MainArea from '@/components/MainArea';
import { type ChartListItem } from '@/lib/types';
import { TestingProvider } from '@/contexts/TestingContext';
import ConsoleManager from '@/components/ConsoleManager';
import { 
  getGlobalSettings, 
  setGlobalSettings, 
  getManualTimer, 
  updateManualTimer,
  resetVolatileSettings,
  getComponentStates,
  setComponentStates,
  type GlobalSettings,
  type ComponentStates 
} from '@/lib/localStorage';

type TimeFrame = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'H12' | 'D1';
type ChartType = 'candles' | 'ohlc' | 'line';

function MainApp() {
  // Initialize global settings from localStorage
  const globalSettings = getGlobalSettings();
  const componentStates = getComponentStates();
  
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(componentStates.leftPanelCollapsed);
  const [selectedTokens, setSelectedTokens] = useState<ChartListItem[]>([]);
  const [currentTimeFrame, setCurrentTimeFrame] = useState<TimeFrame>(globalSettings.currentTimeFrame);
  const [chartType, setChartType] = useState<ChartType>('candles');
  const [decimals, setDecimals] = useState(2);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Auto-refresh always starts as false on page reload
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [manualRefreshTime, setManualRefreshTime] = useState(getManualTimer(globalSettings.currentTimeFrame));
  const [countdown, setCountdown] = useState('xx:xx:xx');
  const [useManualTimer, setUseManualTimer] = useState(false);
  const [isValidManualTime, setIsValidManualTime] = useState(false);
  const [targetRefreshTime, setTargetRefreshTime] = useState<Date | null>(null);

  // Ref to access LeftPanel methods
  const leftPanelRef = useRef<LeftPanelRef>(null);

  // Initialize volatile settings to "off" on mount
  useEffect(() => {
    resetVolatileSettings();
  }, []);

  // Save global settings when they change
  useEffect(() => {
    const updatedSettings: GlobalSettings = {
      ...globalSettings,
      currentTimeFrame,
    };
    setGlobalSettings(updatedSettings);
  }, [currentTimeFrame]);

  // Load manual timer value when timeframe changes
  useEffect(() => {
    const timerValue = getManualTimer(currentTimeFrame);
    setManualRefreshTime(timerValue);
  }, [currentTimeFrame]);

  // Save manual timer value when it changes
  useEffect(() => {
    if (isValidManualTime) {
      updateManualTimer(currentTimeFrame, manualRefreshTime);
    }
  }, [currentTimeFrame, manualRefreshTime, isValidManualTime]);

  // Save component states when they change
  useEffect(() => {
    const updatedStates: ComponentStates = {
      ...componentStates,
      leftPanelCollapsed,
    };
    setComponentStates(updatedStates);
  }, [leftPanelCollapsed]);

  // Initialize manual timer validation
  useEffect(() => {
    const isValid = validateTimeFormat(manualRefreshTime);
    setIsValidManualTime(isValid);
  }, [manualRefreshTime]);

  // Update target refresh time when auto-refresh settings change
  useEffect(() => {
    if (autoRefresh) {
      const nextRefresh = useManualTimer && isValidManualTime 
        ? calculateManualRefreshTime(parseManualTime(manualRefreshTime))
        : calculateNextRefreshTime(currentTimeFrame);
      setTargetRefreshTime(nextRefresh);
    } else {
      setTargetRefreshTime(null);
    }
  }, [autoRefresh, useManualTimer, isValidManualTime, manualRefreshTime, currentTimeFrame]);

  // Parse manual time "hh:mm:ss" format into milliseconds
  const parseManualTime = useCallback((timeString: string): number => {
    const parts = timeString.split(':');
    if (parts.length !== 3) return 0;
    
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return 0;
    
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }, []);

  // Validate manual time format
  const validateTimeFormat = useCallback((timeString: string): boolean => {
    const regex = /^([0-9]{2}):([0-5][0-9]):([0-5][0-9])$/;
    const match = timeString.match(regex);
    
    if (!match) return false;
    
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    
    // Check valid ranges and ensure not all zeros
    return hours >= 0 && hours <= 23 && 
           minutes >= 0 && minutes <= 59 && 
           seconds >= 0 && seconds <= 59 &&
           (hours > 0 || minutes > 0 || seconds > 0);
  }, []);

  // Calculate next refresh time based on manual interval
  const calculateManualRefreshTime = useCallback((intervalMs: number): Date => {
    const now = new Date();
    return new Date(now.getTime() + intervalMs);
  }, []);

  // Calculate next refresh time based on timeframe
  const calculateNextRefreshTime = useCallback((timeframe: TimeFrame): Date => {
    const now = new Date();
    const nextRefresh = new Date(now);

    switch (timeframe) {
      case 'M1':
        // Next minute at :01 seconds
        // If we're already past :01 in the current minute, go to next minute
        if (now.getSeconds() >= 1) {
          nextRefresh.setMinutes(now.getMinutes() + 1);
        }
        nextRefresh.setSeconds(1);
        nextRefresh.setMilliseconds(0);
        break;
      case 'M5':
        // Next 5-minute mark at :01 seconds (e.g., 10:00:01, 10:05:01, 10:10:01, etc.)
        const currentMinute = now.getMinutes();
        const currentSecond = now.getSeconds();
        
        // Find next 5-minute boundary
        const nextFiveMinuteMark = Math.floor(currentMinute / 5) * 5 + 5;
        
        // If we're exactly at a 5-minute mark and it's past :01, go to next interval
        if (currentMinute % 5 === 0 && currentSecond > 1) {
          nextRefresh.setMinutes(nextFiveMinuteMark);
        } else if (currentMinute % 5 === 0 && currentSecond <= 1) {
          // We're at a 5-minute mark and before/at :01, use current interval
          nextRefresh.setMinutes(currentMinute);
        } else {
          // We're between 5-minute marks, go to next one
          nextRefresh.setMinutes(nextFiveMinuteMark);
        }
        
        nextRefresh.setSeconds(1);
        nextRefresh.setMilliseconds(0);
        
        // Handle minute overflow
        if (nextRefresh.getMinutes() >= 60) {
          nextRefresh.setHours(nextRefresh.getHours() + 1);
          nextRefresh.setMinutes(nextRefresh.getMinutes() - 60);
        }
        break;
      case 'M15':
        // Next 15-minute mark at :01 seconds (e.g., 10:00:01, 10:15:01, 10:30:01, etc.)
        const currentMinute15 = now.getMinutes();
        const currentSecond15 = now.getSeconds();
        
        // Find next 15-minute boundary
        const nextFifteenMinuteMark = Math.floor(currentMinute15 / 15) * 15 + 15;
        
        // If we're exactly at a 15-minute mark and it's past :01, go to next interval
        if (currentMinute15 % 15 === 0 && currentSecond15 > 1) {
          nextRefresh.setMinutes(nextFifteenMinuteMark);
        } else if (currentMinute15 % 15 === 0 && currentSecond15 <= 1) {
          // We're at a 15-minute mark and before/at :01, use current interval
          nextRefresh.setMinutes(currentMinute15);
        } else {
          // We're between 15-minute marks, go to next one
          nextRefresh.setMinutes(nextFifteenMinuteMark);
        }
        
        nextRefresh.setSeconds(1);
        nextRefresh.setMilliseconds(0);
        
        // Handle minute overflow
        if (nextRefresh.getMinutes() >= 60) {
          nextRefresh.setHours(nextRefresh.getHours() + 1);
          nextRefresh.setMinutes(nextRefresh.getMinutes() - 60);
        }
        break;
      case 'H1':
        // Next hour at :00:01
        nextRefresh.setHours(now.getHours() + 1);
        nextRefresh.setMinutes(0);
        nextRefresh.setSeconds(1);
        nextRefresh.setMilliseconds(0);
        break;
      case 'H4':
        // Next 4-hour mark at :00:01 (e.g., 00:00:01, 04:00:01, 08:00:01, 12:00:01, 16:00:01, 20:00:01)
        const currentHour4 = now.getHours();
        const currentMinute4 = now.getMinutes();
        const currentSecond4 = now.getSeconds();
        
        // Find next 4-hour boundary
        const nextFourHourMark = Math.floor(currentHour4 / 4) * 4 + 4;
        
        // If we're exactly at a 4-hour mark and it's past 00:01, go to next interval
        if (currentHour4 % 4 === 0 && (currentMinute4 > 0 || currentSecond4 > 1)) {
          nextRefresh.setHours(nextFourHourMark);
        } else if (currentHour4 % 4 === 0 && currentMinute4 === 0 && currentSecond4 <= 1) {
          // We're at a 4-hour mark and before/at 00:01, use current interval
          nextRefresh.setHours(currentHour4);
        } else {
          // We're between 4-hour marks, go to next one
          nextRefresh.setHours(nextFourHourMark);
        }
        
        nextRefresh.setMinutes(0);
        nextRefresh.setSeconds(1);
        nextRefresh.setMilliseconds(0);
        
        // Handle hour overflow (go to next day)
        if (nextRefresh.getHours() >= 24) {
          nextRefresh.setDate(nextRefresh.getDate() + 1);
          nextRefresh.setHours(nextRefresh.getHours() - 24);
        }
        break;
      case 'H12':
        // Next 12-hour mark at :00:01 (00:00:01, 12:00:01)
        const currentHour12 = now.getHours();
        const currentMinute12 = now.getMinutes();
        const currentSecond12 = now.getSeconds();
        
        // Determine if we're in first half (0-11) or second half (12-23) of day
        let nextTwelveHourMark;
        
        if (currentHour12 < 12) {
          // We're in AM, next refresh is at 12:00:01 (noon)
          if (currentHour12 === 0 && currentMinute12 === 0 && currentSecond12 <= 1) {
            // We're at midnight and before/at 00:01, use current interval
            nextTwelveHourMark = 0;
          } else {
            // Go to noon
            nextTwelveHourMark = 12;
          }
        } else {
          // We're in PM, next refresh is at 00:00:01 (midnight next day)
          if (currentHour12 === 12 && currentMinute12 === 0 && currentSecond12 <= 1) {
            // We're at noon and before/at 12:01, use current interval
            nextTwelveHourMark = 12;
          } else {
            // Go to midnight next day
            nextTwelveHourMark = 24; // Will be handled as next day
          }
        }
        
        nextRefresh.setHours(nextTwelveHourMark % 24);
        nextRefresh.setMinutes(0);
        nextRefresh.setSeconds(1);
        nextRefresh.setMilliseconds(0);
        
        // Handle day overflow
        if (nextTwelveHourMark === 24) {
          nextRefresh.setDate(nextRefresh.getDate() + 1);
        }
        break;
      case 'D1':
        // Next day at 00:00:01
        nextRefresh.setDate(now.getDate() + 1);
        nextRefresh.setHours(0);
        nextRefresh.setMinutes(0);
        nextRefresh.setSeconds(1);
        nextRefresh.setMilliseconds(0);
        break;
    }

    return nextRefresh;
  }, []);

  // Format countdown display as HH:MM:SS
  const formatCountdown = useCallback((milliseconds: number): string => {
    if (milliseconds <= 0) return '00:00:00';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Manual refresh handler
  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return; // Prevent multiple simultaneous refreshes
    
    if (selectedTokens.length === 0) {
      return;
    }

    setIsRefreshing(true);

    try {
      const response = await fetch('/api/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timeframe: currentTimeFrame }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Refresh failed');
      }

      const result = data.result;
      const progressUpdates = data.progressUpdates || [];

      // Show progress updates
      progressUpdates.forEach((update: string) => {
      });

      // Report results
      if (result.success.length > 0) {
      }
      
      if (result.failed.length > 0) {
        result.failed.forEach((failure: any) => {
        });
      }

      
      // Trigger chart update if any tokens were successfully refreshed
      if (result.success.length > 0) {
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, selectedTokens, currentTimeFrame]);

  // Auto-refresh countdown and timer logic
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (autoRefresh && targetRefreshTime) {
      const updateCountdown = () => {
        const now = new Date();
        const timeDiff = targetRefreshTime.getTime() - now.getTime();
        
        // Debug logging
        if (timeDiff <= 5000) { // Log when we're within 5 seconds
          const timerType = useManualTimer && isValidManualTime ? `manual (${manualRefreshTime})` : `${currentTimeFrame} timeframe`;
        }
        
        if (timeDiff <= 1000) { // 1 second threshold to catch the trigger moment
          // Time to refresh!
          const timerType = useManualTimer && isValidManualTime ? `manual timer (${manualRefreshTime})` : `${currentTimeFrame} timeframe`;
          
          // Prevent further triggers by temporarily clearing countdown
          setCountdown('00:00:00');
          
          // Execute the refresh with proper async handling
          (async () => {
            try {
              await handleManualRefresh();
              
              // Calculate next refresh time after completion
              const newNextRefresh = useManualTimer && isValidManualTime 
                ? calculateManualRefreshTime(parseManualTime(manualRefreshTime))
                : calculateNextRefreshTime(currentTimeFrame);
              setTargetRefreshTime(newNextRefresh);
            } catch (error) {
              
              // Still calculate next refresh time even if this one failed
              const newNextRefresh = useManualTimer && isValidManualTime 
                ? calculateManualRefreshTime(parseManualTime(manualRefreshTime))
                : calculateNextRefreshTime(currentTimeFrame);
              setTargetRefreshTime(newNextRefresh);
            }
          })();
        } else {
          setCountdown(formatCountdown(timeDiff));
        }
      };

      // Update immediately
      updateCountdown();
      
      // Then update every second
      intervalId = setInterval(updateCountdown, 1000);
    } else {
      setCountdown('xx:xx:xx');
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh, targetRefreshTime, useManualTimer, isValidManualTime, manualRefreshTime, currentTimeFrame, handleManualRefresh, calculateManualRefreshTime, parseManualTime, calculateNextRefreshTime, formatCountdown]);

  // Handle auto-refresh toggle
  const handleToggleAutoRefresh = () => {
    const newAutoRefresh = !autoRefresh;
    setAutoRefresh(newAutoRefresh);
    
    if (newAutoRefresh) {
      const nextRefresh = useManualTimer && isValidManualTime 
        ? calculateManualRefreshTime(parseManualTime(manualRefreshTime))
        : calculateNextRefreshTime(currentTimeFrame);
      
      const timerType = useManualTimer && isValidManualTime ? 'manual' : currentTimeFrame;
      
      if (selectedTokens.length === 0) {
      } else {
      }
    } else {
      setCountdown('xx:xx:xx');
    }
  };

  // Handle manual timer toggle
  const handleToggleManualTimer = () => {
    const newUseManualTimer = !useManualTimer;
    setUseManualTimer(newUseManualTimer);
    
    if (newUseManualTimer) {
      if (isValidManualTime) {
      } else {
      }
    } else {
    }
  };

  // Handle manual refresh time change
  const handleManualRefreshTimeChange = (time: string) => {
    setManualRefreshTime(time);
    const isValid = validateTimeFormat(time);
    setIsValidManualTime(isValid);
    
    if (useManualTimer && isValid) {
    }
  };

  // Handle adding token from Trending Tokens panel
  const handleAddTokenFromTT = async (ca: string, network: 'base' | 'solana', timeframe: TimeFrame) => {
    try {
      // Use LeftPanel's handleAddTokens method for consistent state management
      if (leftPanelRef.current) {
        await leftPanelRef.current.addTokens([ca], network, timeframe);
      }
    } catch (error) {
    }
  };

  return (
    <div className="min-h-screen text-white flex flex-col" style={{backgroundColor: '#0a0a0a'}}>
      {/* Header */}
      <Header 
        onManualRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={handleToggleAutoRefresh}
        countdown={countdown}
        manualRefreshTime={manualRefreshTime}
        onManualRefreshTimeChange={handleManualRefreshTimeChange}
        useManualTimer={useManualTimer}
        onToggleManualTimer={handleToggleManualTimer}
        isValidManualTime={isValidManualTime}
      />
      
      {/* Main Layout */}
      <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 80px)' }}>
        {/* Left Panel */}
        <LeftPanel 
          ref={leftPanelRef}
          collapsed={leftPanelCollapsed}
          onToggleCollapse={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
          onTokensChange={setSelectedTokens}
          currentTimeFrame={currentTimeFrame}
        />
        
        {/* Main Working Area */}
        <MainArea 
          leftPanelCollapsed={leftPanelCollapsed} 
          selectedTokens={selectedTokens}
          currentTimeFrame={currentTimeFrame}
          onTimeFrameChange={setCurrentTimeFrame}
          refreshTrigger={refreshTrigger}
          chartType={chartType}
          decimals={decimals}
          onChartTypeChange={setChartType}
          onDecimalsChange={setDecimals}
          onAddToken={handleAddTokenFromTT}
        />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <TestingProvider>
      <ConsoleManager />
      <MainApp />
    </TestingProvider>
  );
}
