'use client';

import { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Play, 
  Pause,
  Settings,
  Watch
} from 'lucide-react';
import StorageSettings from './StorageSettings';
// Remove direct import of getApiCallCount since it's server-side only

interface HeaderProps {
  onManualRefresh: () => void;
  isRefreshing: boolean;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  countdown: string;
  manualRefreshTime: string;
  onManualRefreshTimeChange: (time: string) => void;
  useManualTimer: boolean;
  onToggleManualTimer: () => void;
  isValidManualTime: boolean;
}

export default function Header({ 
  onManualRefresh, 
  isRefreshing, 
  autoRefresh,
  onToggleAutoRefresh,
  countdown,
  manualRefreshTime,
  onManualRefreshTimeChange,
  useManualTimer,
  onToggleManualTimer,
  isValidManualTime
}: HeaderProps) {
  const [showStorageSettings, setShowStorageSettings] = useState(false);
  const [apiCounter, setApiCounter] = useState({ current: 0, max: 30, resetTime: Date.now() });

  // Update API counter every second by fetching from server
  useEffect(() => {
    const updateCounter = async () => {
      try {
        const response = await fetch('/api/rate-limit');
        if (response.ok) {
          const data = await response.json();
          setApiCounter(data);
        } else {
        }
      } catch (error) {
      }
    };

    // Update immediately
    updateCounter();

    // Set up interval to update every second
    const intervalId = setInterval(updateCounter, 1000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  // Get color class based on remaining API calls
  const getApiCounterColor = () => {
    const remaining = apiCounter.max - apiCounter.current;
    if (remaining > 20) return 'text-green-400';
    if (remaining > 10) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <header className="border-b border-gray-800 px-3 py-2 flex items-center justify-between" style={{backgroundColor: '#111111'}}>
      <div className="flex items-center space-x-2">
        <h1 className="text-lg font-bold text-green-400">CryptoDashboard</h1>
      </div>
      
      {/* Right side controls */}
      <div className="flex items-center space-x-4">
        {/* Refresh Controls Group */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onManualRefresh}
            disabled={isRefreshing}
            className={`p-1.5 rounded transition-colors ${
              isRefreshing 
                ? 'text-green-400 bg-gray-900 cursor-not-allowed' 
                : 'text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
            title={isRefreshing ? 'Refreshing...' : 'Manual Refresh'}
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          
          <button
            onClick={onToggleAutoRefresh}
            className={`p-1.5 rounded transition-colors ${
              autoRefresh 
                ? 'bg-green-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
            title={autoRefresh ? 'Disable Auto Refresh' : 'Enable Auto Refresh'}
          >
            {autoRefresh ? <Pause size={16} /> : <Play size={16} />}
          </button>
          
          <span className={`text-sm font-mono ${autoRefresh ? 'text-green-400' : 'text-gray-500'}`}>
            {countdown}
          </span>
          
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={manualRefreshTime}
              onChange={(e) => onManualRefreshTimeChange(e.target.value)}
              placeholder="hh:mm:ss"
              className={`bg-gray-950 text-white border rounded px-1 py-1 text-sm w-20 font-mono focus:outline-none ${
                isValidManualTime 
                  ? 'border-green-500 focus:border-green-400' 
                  : 'border-gray-800 focus:border-red-500'
              }`}
              title="Manual Refresh Time"
            />
            <button
              onClick={onToggleManualTimer}
              className={`p-1.5 rounded transition-colors ${
                useManualTimer 
                  ? 'bg-green-600 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
              title={useManualTimer ? 'Disable Manual Timer' : 'Enable Manual Timer'}
            >
              <Watch size={16} />
            </button>
          </div>
        </div>

        {/* API Counter Group */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400">API:</span>
          <span className={`text-sm font-mono ${getApiCounterColor()}`}>{apiCounter.current}/{apiCounter.max}</span>
        </div>

        {/* Storage Settings Button */}
        <button
          onClick={() => setShowStorageSettings(true)}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-900 rounded transition-colors"
          title="Storage Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Storage Settings Modal */}
      <StorageSettings
        isOpen={showStorageSettings}
        onClose={() => setShowStorageSettings(false)}
        onStoragePathChange={(newPath) => {
          // TODO: Handle storage path change if needed
        }}
      />
    </header>
  );
}