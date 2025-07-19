'use client';

import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { getComponentStates, setComponentStates, getGlobalSettings, setGlobalSettings } from '../lib/localStorage';

type TimeFrame = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'H12' | 'D1';

interface AddTokensProps {
  onAddTokens: (addresses: string[], network: 'base' | 'solana', timeframe: TimeFrame) => void;
  isLoading?: boolean;
  currentTimeFrame: TimeFrame;
}

export default function AddTokens({ onAddTokens, isLoading = false, currentTimeFrame }: AddTokensProps) {
  const [collapsed, setCollapsed] = useState(() => getComponentStates().addTokensCollapsed);
  const [inputValue, setInputValue] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<'base' | 'solana'>(() => 
    getGlobalSettings().networkSelection
  );

  // Save collapse state when it changes
  useEffect(() => {
    const currentStates = getComponentStates();
    setComponentStates({
      ...currentStates,
      addTokensCollapsed: collapsed,
    });
  }, [collapsed]);

  // Save network selection when it changes
  useEffect(() => {
    const currentGlobalSettings = getGlobalSettings();
    setGlobalSettings({
      ...currentGlobalSettings,
      networkSelection: selectedNetwork,
    });
  }, [selectedNetwork]);

  const parseAddresses = (input: string): string[] => {
    if (!input.trim()) return [];
    
    // Split by commas, spaces, and newlines, then filter out empty strings
    return input
      .split(/[,\s\n]+/)
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);
  };

  const handleAddTokens = () => {
    const addresses = parseAddresses(inputValue);
    if (addresses.length === 0) return;
    
    onAddTokens(addresses, selectedNetwork, currentTimeFrame);
    setInputValue(''); // Clear input after adding
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleAddTokens();
    }
  };

  return (
    <div className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300">Add Tokens</h3>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-900 rounded transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="p-2 space-y-3">
          {/* Textarea Input */}
          <div>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter one or more Contract Addresses which can be separated by commas, spaces or newlines..."
              className="w-full h-24 p-2 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              style={{backgroundColor: '#0a0a0a'}}
              disabled={isLoading}
            />
            <div className="mt-1 text-xs text-gray-500">
              Tip: Use Ctrl+Enter to quickly add tokens
            </div>
          </div>

          {/* Network Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Network:
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="network"
                  value="base"
                  checked={selectedNetwork === 'base'}
                  onChange={(e) => setSelectedNetwork(e.target.value as 'base' | 'solana')}
                  className="mr-2 text-green-500 focus:ring-green-500"
                  disabled={isLoading}
                />
                <span className="text-sm text-gray-300">Base</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="network"
                  value="solana"
                  checked={selectedNetwork === 'solana'}
                  onChange={(e) => setSelectedNetwork(e.target.value as 'base' | 'solana')}
                  className="mr-2 text-green-500 focus:ring-green-500"
                  disabled={isLoading}
                />
                <span className="text-sm text-gray-300">Solana</span>
              </label>
            </div>
          </div>

          {/* Add Button */}
          <button
            onClick={handleAddTokens}
            disabled={!inputValue.trim() || isLoading}
            className="w-full flex items-center justify-center space-x-2 p-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
          >
            <Plus size={16} />
            <span>{isLoading ? 'Adding Tokens...' : 'Add Tokens'}</span>
          </button>
        </div>
      )}
    </div>
  );
}