'use client';

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Copy, Trash2 } from 'lucide-react';
import AddTokens from './AddTokens';
import ChartList from './ChartList';
import { type ChartListItem } from '../lib/types';
import { 
  getTokensFromAPI,
  addTokensViaAPI,
  deleteTokenViaAPI 
} from '../lib/tokenApi';
import { tokensToChartListItems } from '../lib/colorUtils';
import { useTestingContext } from '../contexts/TestingContext';
import { copyToClipboard } from '../lib/clipboard';
import { 
  getComponentStates, 
  setComponentStates, 
  getTokenStates, 
  setTokenState, 
  removeTokenState 
} from '../lib/localStorage';

type TimeFrame = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'H12' | 'D1';

export interface LeftPanelRef {
  addTokens: (addresses: string[], network: 'base' | 'solana', timeframe: TimeFrame) => Promise<void>;
}

interface LeftPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onTokensChange: (tokens: ChartListItem[]) => void;
  currentTimeFrame: TimeFrame;
}

const LeftPanel = forwardRef<LeftPanelRef, LeftPanelProps>(({ collapsed, onToggleCollapse, onTokensChange, currentTimeFrame }, ref) => {
  const [chartListItems, setChartListItems] = useState<ChartListItem[]>([]);
  const [isAddingTokens, setIsAddingTokens] = useState(false);
  const [isTestingCollapsed, setIsTestingCollapsed] = useState(false); // Start with default to avoid hydration mismatch
  const { testingMessages, clearTestingMessages } = useTestingContext();

  // Load testing collapse state from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    setIsTestingCollapsed(getComponentStates().testingCollapsed);
  }, []);

  // Save testing collapse state when it changes
  useEffect(() => {
    const currentStates = getComponentStates();
    setComponentStates({
      ...currentStates,
      testingCollapsed: isTestingCollapsed,
    });
  }, [isTestingCollapsed]);

  // Save token states when chartListItems change
  useEffect(() => {
    chartListItems.forEach((item, index) => {
      setTokenState(item.CA, {
        visible: item.visible,
        color: item.color,
        order: index,
      });
    });
  }, [chartListItems]);

  // Notify parent component when tokens change
  useEffect(() => {
    onTokensChange(chartListItems);
  }, [chartListItems, onTokensChange]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    addTokens: handleAddTokens
  }), []);


  // Load tokens from API on component mount
  useEffect(() => {
    const loadTokens = async () => {
      try {
        const tokens = await getTokensFromAPI();
        const chartItems = tokensToChartListItems(tokens);
        setChartListItems(chartItems);
      } catch (error) {
      }
    };

    loadTokens();
  }, []);

  const handleAddTokens = async (addresses: string[], network: 'base' | 'solana', timeframe: TimeFrame) => {
    setIsAddingTokens(true);

    try {
      const result = await addTokensViaAPI(addresses, network, timeframe);

      // Only update chart list if new tokens were successfully added
      if (result.success.length > 0) {
        // Get all tokens from API to find the newly added ones
        const allTokens = await getTokensFromAPI();
        const updatedChartItems = tokensToChartListItems(allTokens, chartListItems);
        setChartListItems(updatedChartItems);
      }

      // Report results
      if (result.success.length > 0) {
        // Success feedback can be added here if needed
      }
      
      if (result.failed.length > 0) {
        result.failed.forEach(failure => {
          // Error feedback can be added here if needed
        });
      }
    } catch (error) {
      // Error handling
    } finally {
      setIsAddingTokens(false);
    }
  };

  const handleToggleVisibility = (CA: string) => {
    setChartListItems(prev => prev.map(item => 
      item.CA === CA ? { ...item, visible: !item.visible } : item
    ));
  };

  const handleChangeColor = (CA: string, color: string) => {
    setChartListItems(prev => prev.map(item => 
      item.CA === CA ? { ...item, color } : item
    ));
  };

  const handleDeleteToken = async (CA: string) => {
    try {
      const success = await deleteTokenViaAPI(CA);
      if (success) {
        setChartListItems(prev => prev.filter(item => item.CA !== CA));
        // Remove token state from localStorage
        removeTokenState(CA);
      } else {
      }
    } catch (error) {
    }
  };

  const handleReorderTokens = (reorderedTokens: ChartListItem[]) => {
    setChartListItems(reorderedTokens);
  };

  const handleToggleSelectAll = () => {
    const allSelected = chartListItems.every(item => item.visible);
    setChartListItems(prev => prev.map(item => ({ ...item, visible: !allSelected })));
  };

  const handleClearAll = async () => {
    if (chartListItems.length === 0) return;

    try {
      const deletePromises = chartListItems.map(item => deleteTokenViaAPI(item.CA));
      await Promise.all(deletePromises);
      // Remove all token states from localStorage
      chartListItems.forEach(item => removeTokenState(item.CA));
      setChartListItems([]);
    } catch (error) {
    }
  };

  const copyTestingToClipboard = async () => {
    const text = testingMessages.join('\n');
    await copyToClipboard(text);
  };

  const clearTesting = () => {
    clearTestingMessages();
  };

  return (
    <div className={`border-r border-gray-700 transition-all duration-300 ${
      collapsed ? 'w-8' : 'w-80'
    } flex flex-col h-full overflow-hidden`} style={{backgroundColor: '#0a0a0a'}}>
      {/* Collapse/Expand Button */}
      <div className="p-1.5 border-b border-gray-700 flex justify-end" style={{backgroundColor: '#111111'}}>
        <button
          onClick={onToggleCollapse}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-900 rounded transition-colors"
          title={collapsed ? 'Expand Panel' : 'Collapse Panel'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Panel Content */}
      {!collapsed && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Unified Container for all three components */}
          <div className="overflow-hidden flex flex-col h-full" style={{backgroundColor: '#111111'}}>
            {/* Add Tokens Component */}
            <div className="flex-shrink-0">
              <AddTokens 
                onAddTokens={handleAddTokens}
                isLoading={isAddingTokens}
                currentTimeFrame={currentTimeFrame}
              />
            </div>

            {/* Chart List Component */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <ChartList 
                tokens={chartListItems}
                onToggleVisibility={handleToggleVisibility}
                onChangeColor={handleChangeColor}
                onDeleteToken={handleDeleteToken}
                onReorderTokens={handleReorderTokens}
                onToggleSelectAll={handleToggleSelectAll}
                onClearAll={handleClearAll}
              />
            </div>

            {/* Testing Component - 15 lines tall */}
            <div className="border-t border-gray-700 flex-shrink-0">
              <div className="flex items-center justify-between p-2 border-b border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300">Testing</h3>
              <div className="flex items-center space-x-1">
                <button 
                  onClick={copyTestingToClipboard}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-900 rounded transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy size={12} />
                </button>
                <button 
                  onClick={clearTesting}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-900 rounded transition-colors"
                  title="Clear"
                >
                  <Trash2 size={12} />
                </button>
                <button 
                  onClick={() => setIsTestingCollapsed(!isTestingCollapsed)}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-900 rounded transition-colors"
                  title={isTestingCollapsed ? "Expand" : "Collapse"}
                >
                  {isTestingCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                </button>
              </div>
            </div>
            {!isTestingCollapsed && (
              <div className="p-2 overflow-y-auto" style={{ height: '240px' }}>
                <div className="text-xs text-green-400 font-mono whitespace-pre-wrap" style={{ lineHeight: '16px' }}>
                  {testingMessages.join('\n')}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

LeftPanel.displayName = 'LeftPanel';

export default LeftPanel;