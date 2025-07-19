'use client';

import { useState, useEffect } from 'react';
import { 
  Infinity, 
  Settings, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Plus,
  Copy 
} from 'lucide-react';
// import { fetchTrendingPools, type TrendingPoolsResponse } from '@/lib/api'; // Deprecated
import { getTrendingTokensSettings, setTrendingTokensSettings, type TrendingTokensSettings } from '@/lib/localStorage';

// Trending token data interface
interface TrendingToken {
  id: string;
  chain: string;
  name: string;
  address: string;
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

export default function TrendingTokensPanel() {
  const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [settings, setSettings] = useState<TrendingTokensSettings>(() => getTrendingTokensSettings());

  // Derived state from settings
  const [infinityScroll, setInfinityScroll] = useState(false); // Local state for backup component
  const settingsOpen = settings.settingsOpen;

  // Persist settings changes to localStorage
  useEffect(() => {
    setTrendingTokensSettings(settings);
  }, [settings]);

  // Update infinity scroll - now using local state
  // const setInfinityScroll = (value: boolean) => {
  //   setSettings(prev => ({ ...prev, infinityScroll: value }));
  // };

  // Update settings open state
  const setSettingsOpen = (value: boolean) => {
    setSettings(prev => ({ ...prev, settingsOpen: value }));
  };

  return (
    <div className="bg-gray-900 h-full flex flex-col">
      {/* Trending Tokens Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-white">Trending Tokens</h2>
        </div>
        
        {/* Header Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setInfinityScroll(!infinityScroll)}
            className="p-2 rounded transition-colors"
            title="Toggle Infinity Scroll"
          >
            <Infinity size={16} />
          </button>
          
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="p-2 rounded transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>
          
          <button
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-800 sticky top-0">
            <tr>
              <th className="text-left p-2 text-gray-400 font-mono">CHAIN</th>
              <th className="text-left p-2 text-gray-400 font-mono">ACTIONS</th>
              <th className="text-left p-2 text-gray-400 font-mono">TOKEN</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={3} className="p-8 text-center text-gray-500">
                No trending tokens data. Click refresh to load from API.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}