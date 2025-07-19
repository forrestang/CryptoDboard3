'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown, SquareX, Copy, Trash2, Check, DollarSign } from 'lucide-react';
import { type ChartListItem } from '../lib/types';
import { 
  getComponentStates, 
  setComponentStates 
} from '../lib/localStorage';
import { copyToClipboard } from '../lib/clipboard';

interface ChartListProps {
  tokens: ChartListItem[];
  onToggleVisibility: (CA: string) => void;
  onChangeColor: (CA: string, color: string) => void;
  onDeleteToken: (CA: string) => void;
  onReorderTokens: (reorderedTokens: ChartListItem[]) => void;
  onToggleSelectAll: () => void;
  onClearAll: () => void;
}

const COLOR_PALETTE = [
  '#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff',
  '#8000ff', '#ff00ff', '#ff0080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080',
  '#808080', '#c0c0c0', '#ff4444', '#ff8844', '#ffff44', '#88ff44', '#44ff44', '#44ff88', '#44ffff',
  '#4488ff', '#4444ff', '#8844ff', '#ff44ff', '#ff4488', '#ffffff', '#ffaaaa', '#ffddaa', '#ffffaa',
  '#aaffaa', '#aaffff', '#aaaaff', '#ddaaff', '#ffaaff', '#dddddd', '#ff6666', '#ffaa66', '#ffff66',
  '#66ff66', '#66ffff', '#6666ff', '#aa66ff', '#ff66aa', '#555555', '#ff9999', '#ffcc99', '#00cc99'
];

export default function ChartList({
  tokens,
  onToggleVisibility,
  onChangeColor,
  onDeleteToken,
  onReorderTokens,
  onToggleSelectAll,
  onClearAll
}: ChartListProps) {
  const [collapsed, setCollapsed] = useState(() => getComponentStates().chartListCollapsed);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Spacer height for bottom scrollable area
  const [spacerHeight, setSpacerHeight] = useState(0);

  // Save collapse state when it changes
  useEffect(() => {
    const currentStates = getComponentStates();
    setComponentStates({
      ...currentStates,
      chartListCollapsed: collapsed,
    });
  }, [collapsed]);

  // Debug scrollbar dimensions and update spacer height
  useEffect(() => {
    if (!scrollContainerRef.current || collapsed) return;

    const debugScrollbar = () => {
      const container = scrollContainerRef.current;
      if (!container) return;
      
      const content = container.querySelector('.chart-list-content');
      const spacer = content ? content.querySelector('div[style*="height:"]') : null;
      
      
      // Update spacer height
      const newSpacerHeight = calculateSpacerHeight();
      setSpacerHeight(newSpacerHeight);
    };

    // Debug immediately
    debugScrollbar();
    
    // Debug after DOM renders
    setTimeout(debugScrollbar, 100);
    setTimeout(debugScrollbar, 500);
  }, [tokens.length, collapsed]);

  // Add ResizeObserver to detect container height changes
  useEffect(() => {
    if (!scrollContainerRef.current || collapsed) return;

    const container = scrollContainerRef.current;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        
        // Recalculate spacer height when container size changes
        const newSpacerHeight = calculateSpacerHeight();
        setSpacerHeight(newSpacerHeight);
      }
    });

    resizeObserver.observe(container);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
    };
  }, [collapsed]);

  // Add window resize listener for additional responsiveness
  useEffect(() => {
    const handleWindowResize = () => {
      if (!scrollContainerRef.current || collapsed) return;
      
      setTimeout(() => {
        const newSpacerHeight = calculateSpacerHeight();
        setSpacerHeight(newSpacerHeight);
      }, 100); // Small delay to ensure DOM has updated
    };

    window.addEventListener('resize', handleWindowResize);
    
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [collapsed]);

  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [colorPickerPosition, setColorPickerPosition] = useState<{ x: number; y: number; placement: 'top' | 'bottom' } | null>(null);
  const [draggedItem, setDraggedItem] = useState<ChartListItem | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [copiedStates, setCopiedStates] = useState<Set<string>>(new Set());

  // Market data state
  interface MarketData {
    mc: string;
    fdv: string;
    h24Volume: string;
  }
  
  interface MarketDataCache {
    data: MarketData;
    timestamp: number;
    loading: boolean;
  }
  
  const [marketDataCache, setMarketDataCache] = useState<Record<string, MarketDataCache>>({});
  const [activeMarketData, setActiveMarketData] = useState<string | null>(null);
  const [marketDataPosition, setMarketDataPosition] = useState<{ x: number; y: number; placement: 'top' | 'bottom' } | null>(null);

  const allSelected = tokens.length > 0 && tokens.every(token => token.visible);

  const copyToClipboardHandler = async (text: string, tokenCA: string) => {
    const success = await copyToClipboard(text);
    
    if (success) {
      // Add copy animation
      setCopiedStates(prev => new Set([...prev, tokenCA]));
      
      // Remove animation after 1.5 seconds
      setTimeout(() => {
        setCopiedStates(prev => {
          const newSet = new Set(prev);
          newSet.delete(tokenCA);
          return newSet;
        });
      }, 1500);
    }
  };

  // Fetch market data with caching
  const fetchMarketData = async (network: string, ca: string) => {
    const cacheKey = `${network}_${ca}`;
    const cached = marketDataCache[cacheKey];
    const now = Date.now();
    
    // Check if cached data is still valid (30 seconds)
    if (cached && (now - cached.timestamp) < 30000 && !cached.loading) {
      // Use cached data
      setActiveMarketData(cacheKey);
      return;
    }
    
    // Set loading state
    setMarketDataCache(prev => ({
      ...prev,
      [cacheKey]: {
        data: cached?.data || { mc: '-', fdv: '-', h24Volume: '-' },
        timestamp: cached?.timestamp || now,
        loading: true
      }
    }));
    
    try {
      const response = await fetch('/api/token-market-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ network, ca })
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        }
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Cache the new data
        setMarketDataCache(prev => ({
          ...prev,
          [cacheKey]: {
            data: result.data,
            timestamp: now,
            loading: false
          }
        }));
        
        // Show the popup
        setActiveMarketData(cacheKey);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      
      // Clear loading state and show error
      setMarketDataCache(prev => ({
        ...prev,
        [cacheKey]: {
          data: { 
            mc: 'Error', 
            fdv: 'Error', 
            h24Volume: error instanceof Error ? error.message : 'Error'
          },
          timestamp: now,
          loading: false
        }
      }));
      
      // Still show popup with error message
      setActiveMarketData(cacheKey);
    }
  };

  // Handle market data button click
  const handleMarketDataClick = (e: React.MouseEvent, token: ChartListItem) => {
    e.preventDefault();
    
    const cacheKey = `${token.network}_${token.CA}`;
    
    // Calculate position for popup
    const buttonRect = e.currentTarget.getBoundingClientRect();
    const dropdownHeight = 100; // Approximate height of market data popup
    const windowHeight = window.innerHeight;
    
    // Determine if we should show above or below based on available space
    const spaceBelow = windowHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    const showAbove = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight;
    
    setMarketDataPosition({
      x: buttonRect.left,
      y: showAbove ? buttonRect.top - dropdownHeight : buttonRect.bottom,
      placement: showAbove ? 'top' : 'bottom'
    });
    
    // Fetch market data
    fetchMarketData(token.network, token.CA);
  };

  const handleColorSelect = (CA: string, color: string) => {
    onChangeColor(CA, color);
    setActiveColorPicker(null);
    setColorPickerPosition(null);
  };

  const handleToggleVisibility = (CA: string) => {
    onToggleVisibility(CA);
  };

  const handleDeleteToken = (CA: string) => {
    onDeleteToken(CA);
  };

  const getTextColor = (backgroundColor: string) => {
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  };

  const handleDragStart = (e: React.DragEvent, token: ChartListItem) => {
    setDraggedItem(token);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetOrder: number) => {
    e.preventDefault();
    setDropTarget(targetOrder);
  };

  const handleDrop = (e: React.DragEvent, targetOrder: number) => {
    e.preventDefault();
    
    if (!draggedItem) return;

    const reorderedTokens = [...tokens];
    const draggedIndex = reorderedTokens.findIndex(t => t.CA === draggedItem.CA);
    const targetIndex = reorderedTokens.findIndex(t => t.order === targetOrder);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      // Remove dragged item
      const [draggedToken] = reorderedTokens.splice(draggedIndex, 1);
      
      // Insert at target position
      reorderedTokens.splice(targetIndex, 0, draggedToken);
      
      // Update order values
      const updatedTokens = reorderedTokens.map((token, index) => ({
        ...token,
        order: index
      }));
      
      onReorderTokens(updatedTokens);
    }

    setDraggedItem(null);
    setDropTarget(null);
  };

  // Calculate spacer height to allow bottom element to scroll to top
  const calculateSpacerHeight = useCallback(() => {
    if (!scrollContainerRef.current) return 0;
    
    const containerHeight = scrollContainerRef.current.clientHeight;
    const firstRow = scrollContainerRef.current.querySelector('.chart-list-item');
    const rowHeight = firstRow ? firstRow.clientHeight : 64; // Default to 64px if no row found
    
    // Spacer height = container height - one row height
    // This allows the bottom-most row to scroll all the way to the top
    const spacerHeight = Math.max(0, containerHeight - rowHeight);
    
    
    return spacerHeight;
  }, []);

  const sortedTokens = [...tokens].sort((a, b) => a.order - b.order);

  return (
    <div className="border-t border-gray-700 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            className="text-green-500 focus:ring-green-500"
          />
          <span className="text-sm font-semibold text-gray-300">
            Chart List ({tokens.length})
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={onClearAll}
            className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-900 rounded transition-colors"
            title="Clear All"
          >
            <SquareX size={14} />
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-900 rounded transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-scroll sleek-vertical-scrollbar chart-list-container"
        >
          {tokens.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No tokens added yet. Use the Add Tokens component above to add some.
            </div>
          ) : (
            <div className="p-2 space-y-1 chart-list-content">
              {sortedTokens.map((token) => (
                <div
                  key={token.CA}
                  draggable
                  onDragStart={(e) => handleDragStart(e, token)}
                  onDragOver={(e) => handleDragOver(e, token.order)}
                  onDrop={(e) => handleDrop(e, token.order)}
                  className={`chart-list-item flex items-center space-x-2 p-2 rounded transition-colors cursor-move ${
                    dropTarget === token.order ? 'bg-gray-700' : 'hover:bg-gray-700'
                  }`}
                  style={{backgroundColor: '#0a0a0a'}}
                >
                  {/* Visibility Checkbox */}
                  <input
                    type="checkbox"
                    checked={token.visible}
                    onChange={() => handleToggleVisibility(token.CA)}
                    className="text-green-500 focus:ring-green-500"
                  />

                  {/* Network */}
                  <span className="text-xs font-mono text-gray-400 w-8">
                    {token.network.toUpperCase() === 'BASE' ? 'BASE' : 'SOL'}
                  </span>

                  {/* Color Picker */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        const isActive = activeColorPicker === token.CA;
                        setActiveColorPicker(isActive ? null : token.CA);
                        
                        if (!isActive) {
                          // Calculate fixed position for dropdown to avoid clipping
                          const buttonRect = e.currentTarget.getBoundingClientRect();
                          const dropdownHeight = 135; // Approximate height of color picker dropdown
                          const windowHeight = window.innerHeight;
                          
                          // Determine if we should show above or below based on available space
                          const spaceBelow = windowHeight - buttonRect.bottom;
                          const spaceAbove = buttonRect.top;
                          const showAbove = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight;
                          
                          setColorPickerPosition({
                            x: buttonRect.left,
                            y: showAbove ? buttonRect.top - dropdownHeight : buttonRect.bottom,
                            placement: showAbove ? 'top' : 'bottom'
                          });
                        } else {
                          setColorPickerPosition(null);
                        }
                      }}
                      className="w-4 h-4 rounded-full border border-gray-600"
                      style={{ backgroundColor: token.color }}
                    >
                    </button>
                    
                  </div>

                  {/* Token Image */}
                  {token.image_url ? (
                    <img
                      src={token.image_url}
                      alt={token.symbol}
                      className="w-6 h-6 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center">
                      <span className="text-xs text-gray-400">?</span>
                    </div>
                  )}

                  {/* Symbol */}
                  <span className="text-sm text-gray-200 font-medium flex-1 truncate">
                    {token.symbol}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => handleMarketDataClick(e, token)}
                      className={`p-0.5 rounded transition-all duration-300 ${
                        marketDataCache[`${token.network}_${token.CA}`]?.loading
                          ? 'text-blue-400 cursor-wait'
                          : 'text-gray-400 hover:text-green-400 hover:bg-gray-800'
                      }`}
                      title="Market Data"
                      disabled={marketDataCache[`${token.network}_${token.CA}`]?.loading}
                    >
                      <DollarSign size={12} />
                    </button>
                    <button
                      onClick={() => copyToClipboardHandler(token.CA, token.CA)}
                      className={`p-0.5 rounded transition-all duration-300 ${
                        copiedStates.has(token.CA)
                          ? 'text-green-400 bg-green-600/20'
                          : 'text-gray-400 hover:text-green-400 hover:bg-gray-600'
                      }`}
                      title={copiedStates.has(token.CA) ? "Copied!" : "Copy Contract Address"}
                    >
                      {copiedStates.has(token.CA) ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                    <button
                      onClick={() => handleDeleteToken(token.CA)}
                      className="p-0.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                      title="Delete Token"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {/* Dynamic spacer to allow bottom element to scroll to top */}
              <div style={{ height: `${spacerHeight}px` }}></div>
            </div>
          )}
        </div>
      )}

      {/* Fixed position color picker dropdown to avoid clipping */}
      {activeColorPicker && colorPickerPosition && (
        <>
          {/* Backdrop to close color picker */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setActiveColorPicker(null);
              setColorPickerPosition(null);
            }}
          />
          
          {/* Color picker dropdown */}
          <div 
            className="fixed z-50 p-2 bg-gray-950 border border-gray-800 rounded shadow-xl"
            style={{
              left: colorPickerPosition.x,
              top: colorPickerPosition.y,
              width: '182px' // 166px + 16px padding
            }}
          >
            <div className="grid grid-cols-9 gap-0" style={{ width: '166px' }}>
              {COLOR_PALETTE.map((color, index) => (
                <button
                  key={`${color}-${index}`}
                  onClick={() => handleColorSelect(activeColorPicker, color)}
                  className="rounded-full border border-gray-800 hover:border-gray-600 hover:scale-110 transition-all duration-150 relative overflow-hidden flex-shrink-0"
                  style={{ 
                    backgroundColor: color,
                    width: '18.4px',
                    height: '18.4px'
                  }}
                  title={color}
                >
                  {/* Find the active token's color to show selection indicator */}
                  {(() => {
                    const activeToken = tokens.find(t => t.CA === activeColorPicker);
                    return activeToken?.color === color && (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          background: `linear-gradient(45deg, transparent 45%, ${getTextColor(color)} 45%, ${getTextColor(color)} 55%, transparent 55%)`
                        }}
                      />
                    );
                  })()}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Fixed position market data popup */}
      {activeMarketData && marketDataPosition && (
        <>
          {/* Backdrop to close market data popup */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setActiveMarketData(null);
              setMarketDataPosition(null);
            }}
          />
          
          {/* Market data popup */}
          <div 
            className="fixed z-50 p-3 bg-gray-950 border border-gray-800 rounded shadow-xl"
            style={{
              left: marketDataPosition.x,
              top: marketDataPosition.y,
              minWidth: '160px'
            }}
          >
            {(() => {
              const cached = marketDataCache[activeMarketData];
              if (!cached) return null;
              
              if (cached.loading) {
                return (
                  <div className="flex items-center justify-center py-2">
                    <div className="text-sm text-gray-400">Loading...</div>
                  </div>
                );
              }
              
              return (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">MC:</span>
                    <span className="text-sm text-gray-200 font-mono">${cached.data.mc}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">FDV:</span>
                    <span className="text-sm text-gray-200 font-mono">${cached.data.fdv}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">H24V:</span>
                    <span className="text-sm text-yellow-500 font-mono">${cached.data.h24Volume}</span>
                  </div>
                  {cached.timestamp && (
                    <div className="pt-1 border-t border-gray-800">
                      <div className="text-xs text-gray-500 text-center">
                        {((Date.now() - cached.timestamp) / 1000).toFixed(0)}s ago
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}