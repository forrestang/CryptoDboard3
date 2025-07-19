'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  createChart, 
  IChartApi, 
  ISeriesApi,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  HistogramSeries
} from 'lightweight-charts';
import { 
  Lock, 
  Scaling, 
  RotateCcw,
  BarChart3, 
  CandlestickChart, 
  TrendingUp,
  GripHorizontal,
  PanelBottomDashed
} from 'lucide-react';
import { type ChartListItem } from '../lib/types';
import { 
  getModeSettings, 
  setModeSettings, 
  getGlobalSettings,
  setGlobalSettings,
  type Mode as StorageMode,
  type ModeSettings 
} from '../lib/localStorage';

type ChartType = 'candles' | 'ohlc' | 'line';
type TimeFrame = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'H12' | 'D1';
type Mode = 'absolute' | 'percentage';

interface PricePanelProps {
  selectedTokens?: ChartListItem[];
  currentTimeFrame: TimeFrame;
  onTimeFrameChange: (timeFrame: TimeFrame) => void;
  refreshTrigger: number;
  chartType: ChartType;
  decimals: number;
  onChartTypeChange: (type: ChartType) => void;
  onDecimalsChange: (decimals: number) => void;
}

export default function PricePanel({ 
  selectedTokens = [], 
  currentTimeFrame, 
  onTimeFrameChange,
  refreshTrigger,
  chartType,
  decimals,
  onChartTypeChange,
  onDecimalsChange
}: PricePanelProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
  
  const [mode, setMode] = useState<Mode>('absolute');
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showVolumePane, setShowVolumePane] = useState(true);
  
  // Scale state storage for lock functionality
  const [lockedLogicalRange, setLockedLogicalRange] = useState<{from: number, to: number} | null>(null);
  const [lockedPriceRange, setLockedPriceRange] = useState<{from: number, to: number} | null>(null);
  
  
  // Right margin state
  const [rightMargin, setRightMargin] = useState(50);
  const [showMarginSlider, setShowMarginSlider] = useState(false);
  
  // Chart height state
  const [chartHeight, setChartHeight] = useState(400);
  const [isDragging, setIsDragging] = useState(false);
  
  // Use refs for drag values to avoid useCallback dependency issues
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const isDraggingRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);
  
  // Store drag functions in refs for stable event listener attachment
  const handleResizeDragRef = useRef<((e: MouseEvent) => void) | null>(null);
  const handleResizeEndRef = useRef<(() => void) | null>(null);
  
  // Rebase slider state
  const [rebaseTimestamp, setRebaseTimestamp] = useState<number>(0);
  const [dataTimeRange, setDataTimeRange] = useState<{min: number, max: number}>({min: 0, max: 0});
  const [allTokensData, setAllTokensData] = useState<Map<string, any[]>>(new Map());
  
  // Timezone state
  const [chartTimezone, setChartTimezone] = useState<string>('UTC');
  
  // Tooltip state for percentage mode price levels
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipData, setTooltipData] = useState<Array<{ symbol: string; color: string; price: number }>>([]);
  const [tooltipDecimals, setTooltipDecimals] = useState(2);
  
  // Initialize settings from localStorage on client mount (prevents hydration issues)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const globalSettings = getGlobalSettings();
      const settings = getModeSettings(globalSettings.currentMode as StorageMode);
      
      setMode(globalSettings.currentMode);
      setIsLocked(settings.isLocked);
      setRightMargin(settings.rightMargin);
      setChartHeight(settings.chartHeight || 400);
      setShowVolumePane(settings.showVolumePane ?? true);
      
      onChartTypeChange(settings.chartType);
      onDecimalsChange(settings.decimals);
      
      if (globalSettings.currentMode === 'percentage' && settings.rebasePoint) {
        setRebaseTimestamp(settings.rebasePoint);
      }
    }
  }, []);
  
  // Load mode-specific settings on mount and mode change
  useEffect(() => {
    const settings = getModeSettings(mode as StorageMode);
    
    // Update local state with saved settings
    onChartTypeChange(settings.chartType);
    onDecimalsChange(settings.decimals);
    setRightMargin(settings.rightMargin);
    setIsLocked(settings.isLocked);
    setShowVolumePane(settings.showVolumePane ?? true);
    
    // Load chart height if available, otherwise use default
    setChartHeight(settings.chartHeight || 400);
    
    // Load rebase point for percentage mode
    if (mode === 'percentage' && settings.rebasePoint) {
      setRebaseTimestamp(settings.rebasePoint);
    }
  }, [mode]);
  
  // Save current mode to global settings when it changes
  useEffect(() => {
    const globalSettings = getGlobalSettings();
    setGlobalSettings({
      ...globalSettings,
      currentMode: mode as StorageMode,
    });
  }, [mode]);

  // Save mode-specific settings when they change
  useEffect(() => {
    const settings: ModeSettings = {
      chartType,
      decimals,
      rightMargin,
      isLocked,
      chartHeight,
      showVolumePane,
    };
    
    // Include rebase point for percentage mode
    if (mode === 'percentage') {
      settings.rebasePoint = rebaseTimestamp;
    }
    
    setModeSettings(mode as StorageMode, settings);
  }, [mode, chartType, decimals, rightMargin, isLocked, rebaseTimestamp, chartHeight, showVolumePane]);

  // Find the rightmost (latest) timestamp across all visible tokens
  const findRightmostTimestamp = useCallback((): number => {
    let rightmostTime = 0;
    
    // Check all visible tokens to find the latest timestamp
    for (const token of selectedTokens) {
      if (!token.visible) continue;
      
      const tokenData = allTokensData.get(token.CA);
      if (!tokenData || tokenData.length === 0) continue;
      
      // Get the last timestamp from this token's data
      const lastTimestamp = tokenData[tokenData.length - 1].time;
      if (lastTimestamp > rightmostTime) {
        rightmostTime = lastTimestamp;
      }
    }
    
    return rightmostTime;
  }, [selectedTokens, allTokensData]);

  // Convert percentage value back to actual price using rebase baseline
  const convertPercentageToPrice = (percentageValue: number, baseline: number): number => {
    if (!baseline || baseline === 0) return 0;
    
    // Formula: actualPrice = baseline * (1 + percentageValue / 100)
    // This is the reverse of: percentageValue = ((actualPrice - baseline) / baseline) * 100
    return baseline * (1 + percentageValue / 100);
  };

  // Handle tooltip display at given position
  const handleTooltipDisplay = useCallback((x: number, y: number) => {
    
    if (!chartRef.current || mode !== 'percentage') {
      return;
    }
    
    // Get decimal precision from absolute mode settings
    const absoluteSettings = getModeSettings('absolute');
    const absoluteDecimals = absoluteSettings.decimals;
    
    const tooltipItems: Array<{ symbol: string; color: string; price: number }> = [];
    
    
    // Get the price at the cursor Y position for each visible token
    for (const token of selectedTokens) {
      if (!token.visible) {
        continue;
      }
      
      const tokenData = allTokensData.get(token.CA);
      if (!tokenData || tokenData.length === 0) {
        continue;
      }
      
      // Get the baseline price for this token
      const baseline = findRebaseBaseline(tokenData, rebaseTimestamp);
      if (!baseline) {
        continue;
      }
      
      // Get the series for this token
      const series = seriesRef.current.get(token.CA);
      if (!series) {
        continue;
      }
      
      try {
        // Apply the same data transformation as the chart
        let processedData = tokenData;
        
        // Apply percentage transformation FIRST (if in percentage mode)
        // This ensures baseline is calculated from original OHLC data (using OPEN price)
        if (mode === 'percentage' && rebaseTimestamp > 0) {
          processedData = transformToPercentageWithRebase(processedData, rebaseTimestamp);
        }
        
        // Transform to line format AFTER percentage calculation (if chart type is line)
        // This preserves the OPEN-based baseline for consistency across all chart types
        if (chartType === 'line') {
          processedData = transformToLineData(processedData);
        }
        
        // Get price range from the series (this represents the transformed data)
        const priceRange = series.priceScale().getVisibleRange();
        if (!priceRange) {
          continue;
        }
        
        // Calculate price value based on Y position relative to chart height
        const chartHeight = chartContainerRef.current?.clientHeight || 400;
        const relativeY = y / chartHeight; // 0 = top, 1 = bottom
        
        // Use the visible range to calculate the price value at the Y position
        // This gives us the percentage value that's actually displayed on the chart
        const priceValue = priceRange.from + (priceRange.to - priceRange.from) * (1 - relativeY);
        
        // Convert percentage back to actual price
        const actualPrice = convertPercentageToPrice(priceValue, baseline);
        
        // Temporary debug logging
        console.log(`🔍 Debug ${token.symbol}:`, {
          baseline,
          priceValue: `${priceValue.toFixed(2)}%`,
          actualPrice: actualPrice.toFixed(6),
          relativeY: relativeY.toFixed(3),
          priceRange: {
            from: `${priceRange.from.toFixed(2)}%`,
            to: `${priceRange.to.toFixed(2)}%`
          },
          formula: `${baseline} * (1 + ${priceValue.toFixed(2)}/100) = ${actualPrice.toFixed(6)}`,
          chartType: chartType
        });
        
        tooltipItems.push({
          symbol: token.symbol,
          color: token.color,
          price: actualPrice
        });
      } catch (error) {
        continue;
      }
    }
    
    
    // Show tooltip if we have data
    if (tooltipItems.length > 0) {
      // Adjust tooltip position to avoid going off-screen
      const chartRect = chartContainerRef.current?.getBoundingClientRect();
      const tooltipWidth = 150; // Approximate tooltip width
      const tooltipHeight = tooltipItems.length * 20 + 20; // Approximate height
      
      let adjustedX = x;
      let adjustedY = y;
      
      if (chartRect) {
        // Adjust X position if tooltip would go off right edge
        if (x + tooltipWidth / 2 > chartRect.width) {
          adjustedX = chartRect.width - tooltipWidth / 2;
        }
        if (x - tooltipWidth / 2 < 0) {
          adjustedX = tooltipWidth / 2;
        }
        
        // Adjust Y position if tooltip would go off top edge
        if (y - tooltipHeight < 0) {
          adjustedY = tooltipHeight;
        }
      }
      
      setTooltipData(tooltipItems);
      setTooltipPosition({ x: adjustedX, y: adjustedY });
      setTooltipDecimals(absoluteDecimals);
      setShowTooltip(true);
    } else {
    }
  }, [mode, selectedTokens, allTokensData, rebaseTimestamp]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartHeight,
      layout: {
        background: { color: '#000000' },
        textColor: '#ffffff',
      },
      grid: {
        vertLines: { color: '#333333' },
        horzLines: { color: '#333333' },
      },
      crosshair: {
        mode: 1,
      },
      timeScale: {
        borderColor: '#485c7b',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 10, // Minimal offset, margin handled by logical range extension
      },
      rightPriceScale: {
        borderColor: '#485c7b',
        scaleMargins: {
          top: 0.3,
          bottom: 0.25,
        },
      },
    });

    chartRef.current = chart;


    // Handle resize
    const handleResize = () => {
      if (chart && chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chart) {
        chart.remove();
      }
    };
  }, []);

  // Handle mouse events for tooltip functionality
  useEffect(() => {
    const chartContainer = chartContainerRef.current;
    if (!chartContainer || !chartRef.current) return;


    const handleMouseDown = (e: MouseEvent) => {
      
      // Prevent default middle mouse behavior (like opening links in new tab)
      if (e.button === 1) {
        e.preventDefault();
      }
      
      // Only handle in percentage mode and for middle mouse button
      if (mode !== 'percentage' || e.button !== 1) {
        return;
      }
      
      
      // Get chart container bounds
      const chartRect = chartContainer.getBoundingClientRect();
      if (!chartRect) {
        return;
      }
      
      // Calculate relative position within chart
      const relativeX = e.clientX - chartRect.left;
      const relativeY = e.clientY - chartRect.top;
      
      
      // Check if click is in the margin (to the right of rightmost data point)
      const rightmostTime = findRightmostTimestamp();
      if (rightmostTime === 0) {
        return;
      }
      
      // Get chart dimensions and visible range for debugging
      const timeScale = chartRef.current?.timeScale();
      if (!timeScale) {
        return;
      }
      
      const visibleRange = timeScale.getVisibleLogicalRange();
      
      // Convert chart coordinates to time
      const clickTime = timeScale.coordinateToTime(relativeX);
      
      // Calculate actual position of rightmost data point in current view
      const rightmostDataPointX = timeScale.timeToCoordinate(rightmostTime);
      
      // If coordinateToTime returns null, let's try a different approach
      if (!clickTime) {
        
        // Use rightmost data point position if available
        if (rightmostDataPointX !== null) {
          
          if (relativeX > rightmostDataPointX) {
            handleTooltipDisplay(relativeX, relativeY);
            return;
          } else {
            return;
          }
        }
        
        // Fallback to generic margin detection
        const rightOffset = chartRef.current?.options()?.timeScale?.rightOffset || 50;
        let marginStartX = chartRect.width * 0.75; // Default to 75% of chart width
        
        
        if (relativeX > marginStartX) {
          handleTooltipDisplay(relativeX, relativeY);
          return;
        } else {
          return;
        }
      }
      
      // Also check using pixel position for more accurate detection
      if (rightmostDataPointX !== null && relativeX <= rightmostDataPointX) {
        return;
      }
      
      if (Number(clickTime) <= rightmostTime) {
        return;
      }
      
      // Show tooltip at click position
      handleTooltipDisplay(relativeX, relativeY);
    };

    const handleMouseUp = (e: MouseEvent) => {
      // Hide tooltip on middle mouse release
      if (e.button === 1) {
        setShowTooltip(false);
      }
    };

    // Add mouse event listeners to chart container
    chartContainer.addEventListener('mousedown', handleMouseDown);
    chartContainer.addEventListener('mouseup', handleMouseUp);
    
    // Add general mouse event listener for debugging
    const handleAllMouseEvents = (e: MouseEvent) => {
    };
    
    chartContainer.addEventListener('click', handleAllMouseEvents);
    chartContainer.addEventListener('auxclick', handleAllMouseEvents);

    // Cleanup
    return () => {
      chartContainer.removeEventListener('mousedown', handleMouseDown);
      chartContainer.removeEventListener('mouseup', handleMouseUp);
      chartContainer.removeEventListener('click', handleAllMouseEvents);
      chartContainer.removeEventListener('auxclick', handleAllMouseEvents);
    };
  }, [mode, handleTooltipDisplay, findRightmostTimestamp]);

  // Update chart height when chartHeight changes
  useEffect(() => {
    if (chartRef.current && chartContainerRef.current) {
      try {
        chartRef.current.applyOptions({
          height: chartHeight,
          width: chartContainerRef.current.clientWidth,
        });
      } catch (error) {
      }
    }
  }, [chartHeight]);

  // Update right margin when rightMargin changes (real-time effect)
  useEffect(() => {
    if (chartRef.current && !isLocked) {
      try {
        // Use rightOffset for true margin without scaling issues
        // Convert percentage to reasonable pixel offset
        const rightOffsetValue = Math.max(10, rightMargin * 3);
        
        chartRef.current.applyOptions({
          timeScale: {
            rightOffset: rightOffsetValue,
          },
        });
      } catch (error) {
      }
    }
  }, [rightMargin, isLocked]);


  // Fetch chart data from API
  const fetchChartData = async (CA: string, timeframe: string) => {
    try {
      const response = await fetch(`/api/chart-data?CA=${CA}&timeframe=${timeframe}`);
      if (!response.ok) {
        throw new Error('Failed to fetch chart data');
      }
      const result = await response.json();
      return result.data;
    } catch (error) {
      return [];
    }
  };

  // Calculate data time range across all visible tokens
  const calculateDataTimeRange = (tokensData: Map<string, any[]>) => {
    let minTime = Infinity;
    let maxTime = -Infinity;
    
    tokensData.forEach((data) => {
      if (data.length > 0) {
        const firstTime = data[0].time;
        const lastTime = data[data.length - 1].time;
        minTime = Math.min(minTime, firstTime);
        maxTime = Math.max(maxTime, lastTime);
      }
    });
    
    return { min: minTime === Infinity ? 0 : minTime, max: maxTime === -Infinity ? 0 : maxTime };
  };

  // Format timestamp according to chart timezone and timeframe precision
  const formatTimestampForChart = (timestamp: number) => {
    if (timestamp <= 0) return 'No data';
    
    const date = new Date(timestamp * 1000);
    
    // Format based on timeframe precision
    switch (currentTimeFrame) {
      case 'M1':
      case 'M5':
      case 'M15':
        // Show minutes precision: "2024-01-01 15:05 UTC"
        return `${date.toISOString().slice(0, 16).replace('T', ' ')} ${chartTimezone}`;
      
      case 'H1':
      case 'H4':
      case 'H12':
        // Show hour precision: "2024-01-01 15:00 UTC"
        return `${date.toISOString().slice(0, 13).replace('T', ' ')}:00 ${chartTimezone}`;
      
      case 'D1':
        // Show day precision: "2024-01-01 00:00 UTC"
        return `${date.toISOString().slice(0, 10)} 00:00 ${chartTimezone}`;
      
      default:
        return `${date.toISOString().slice(0, 16).replace('T', ' ')} ${chartTimezone}`;
    }
  };

  // Get timeframe interval in seconds
  const getTimeframeIntervalSeconds = (timeframe: TimeFrame): number => {
    switch (timeframe) {
      case 'M1': return 60;        // 1 minute
      case 'M5': return 300;       // 5 minutes
      case 'M15': return 900;      // 15 minutes
      case 'H1': return 3600;      // 1 hour
      case 'H4': return 14400;     // 4 hours
      case 'H12': return 43200;    // 12 hours
      case 'D1': return 86400;     // 1 day
      default: return 300;         // Default to 5 minutes
    }
  };

  // Align timestamp to timeframe boundary
  const alignTimestampToTimeframe = (timestamp: number, timeframe: TimeFrame): number => {
    const intervalSeconds = getTimeframeIntervalSeconds(timeframe);
    return Math.floor(timestamp / intervalSeconds) * intervalSeconds;
  };

  // Get aligned slider range for timeframe
  const getAlignedSliderRange = (minTime: number, maxTime: number, timeframe: TimeFrame) => {
    if (minTime === 0 || maxTime === 0) return { min: 0, max: 0, step: 1 };
    
    const intervalSeconds = getTimeframeIntervalSeconds(timeframe);
    const alignedMin = alignTimestampToTimeframe(minTime, timeframe);
    const alignedMax = alignTimestampToTimeframe(maxTime, timeframe);
    
    return {
      min: alignedMin,
      max: alignedMax,
      step: intervalSeconds
    };
  };

  // Transform price data to percentage changes from baseline
  const transformToPercentage = (data: any[], baseline: number) => {
    if (!data || data.length === 0 || !baseline || baseline === 0) {
      return data;
    }

    const transformed = data.map((item, index) => {
      try {
        const newItem = { ...item };
        
        // Convert all price values to percentages
        if (typeof item.open === 'number') {
          newItem.open = ((item.open - baseline) / baseline) * 100;
        }
        if (typeof item.high === 'number') {
          newItem.high = ((item.high - baseline) / baseline) * 100;
        }
        if (typeof item.low === 'number') {
          newItem.low = ((item.low - baseline) / baseline) * 100;
        }
        if (typeof item.close === 'number') {
          newItem.close = ((item.close - baseline) / baseline) * 100;
        }
        // For line charts, handle 'value' property
        if (typeof item.value === 'number') {
          newItem.value = ((item.value - baseline) / baseline) * 100;
        }
        
        
        return newItem;
      } catch (error) {
        return item; // Return original item if transformation fails
      }
    });

    return transformed;
  };

  // Find baseline price at specific timestamp for rebase calculation
  const findRebaseBaseline = (data: any[], targetTimestamp: number) => {
    if (!data || data.length === 0) return null;
    
    // Find the data point closest to the target timestamp
    let closestPoint = data[0];
    let closestDiff = Math.abs(data[0].time - targetTimestamp);
    
    for (let i = 1; i < data.length; i++) {
      const diff = Math.abs(data[i].time - targetTimestamp);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestPoint = data[i];
      }
    }
    
    // Return the open price of the closest point
    return closestPoint.open || closestPoint.value || closestPoint.close;
  };

  // Transform data based on rebase timestamp
  const transformToPercentageWithRebase = (data: any[], rebaseTimestamp: number) => {
    const baseline = findRebaseBaseline(data, rebaseTimestamp);
    if (!baseline) return data;
    
    return transformToPercentage(data, baseline);
  };

  // Transform OHLC data to line chart format
  const transformToLineData = (data: any[]) => {
    if (!data || data.length === 0) return data;
    
    return data.map(item => ({
      time: item.time,
      value: item.close // Use closing price as the line value
    }));
  };

  // Fetch and cache all token data
  const fetchAllTokensData = async () => {
    setLoading(true);
    
    if (selectedTokens.length === 0) {
      setAllTokensData(new Map());
      setDataTimeRange({min: 0, max: 0});
      // Clear existing series when no tokens selected
      if (chartRef.current) {
        seriesRef.current.forEach((series) => {
          try {
            if (series && chartRef.current) {
              chartRef.current.removeSeries(series);
            }
          } catch (error) {
              }
        });
        seriesRef.current.clear();
      }
      setLoading(false);
      return;
    }

    const newTokensData = new Map<string, any[]>();
    let tokensWithData = 0;
    let tokensWithoutData = 0;
    
    for (const token of selectedTokens) {
      if (!token.visible) continue;
      
      const rawData = await fetchChartData(token.CA, currentTimeFrame);
      if (rawData.length > 0) {
        newTokensData.set(token.CA, rawData);
        tokensWithData++;
      } else {
        tokensWithoutData++;
      }
    }
    
    // Always update allTokensData, even if it's empty
    setAllTokensData(newTokensData);
    
    // Calculate time range and set initial rebase timestamp
    const timeRange = calculateDataTimeRange(newTokensData);
    setDataTimeRange(timeRange);
    
    if (rebaseTimestamp === 0 && timeRange.min > 0) {
      // Align initial rebase timestamp to timeframe boundary
      const alignedTimestamp = alignTimestampToTimeframe(timeRange.min, currentTimeFrame);
      setRebaseTimestamp(alignedTimestamp);
    }
    
    setLoading(false);
    
    // Data fetching complete
  };

  // Create or update chart series (called once when tokens change)
  const createChartSeries = () => {
    if (!chartRef.current) return;
    
    // Clear existing series with proper error handling
    seriesRef.current.forEach((series) => {
      try {
        if (series && chartRef.current) {
          chartRef.current.removeSeries(series);
        }
      } catch (error) {
      }
    });
    seriesRef.current.clear();
    
    // Clear volume series
    if (volumeSeriesRef.current && chartRef.current) {
      try {
        chartRef.current.removeSeries(volumeSeriesRef.current);
      } catch (error) {
      }
      volumeSeriesRef.current = null;
    }

    // Only create series for tokens that have actual data
    let seriesCreated = 0;
    for (const token of selectedTokens) {
      if (!token.visible) continue;
      
      // Only create series if token has data in the current timeframe
      if (!allTokensData.has(token.CA)) {
        continue;
      }

      const tokenData = allTokensData.get(token.CA);
      if (!tokenData || tokenData.length === 0) {
        continue;
      }

      let series: ISeriesApi<any>;

      if (chartType === 'candles') {
        series = chartRef.current.addSeries(CandlestickSeries, {
          upColor: token.color,
          downColor: token.color,
          borderVisible: false,
          wickUpColor: token.color,
          wickDownColor: token.color,
          priceScaleId: 'right',
          priceFormat: {
            type: 'price',
            precision: decimals,
            minMove: Math.pow(10, -decimals),
          },
          lastValueVisible: false,
          priceLineVisible: false,
        });
      } else if (chartType === 'ohlc') {
        series = chartRef.current.addSeries(BarSeries, {
          upColor: token.color,
          downColor: token.color,
          priceScaleId: 'right',
          priceFormat: {
            type: 'price',
            precision: decimals,
            minMove: Math.pow(10, -decimals),
          },
          lastValueVisible: false,
          priceLineVisible: false,
        });
      } else {
        series = chartRef.current.addSeries(LineSeries, {
          color: token.color,
          lineWidth: 2,
          priceScaleId: 'right',
          priceFormat: {
            type: 'price',
            precision: decimals,
            minMove: Math.pow(10, -decimals),
          },
          lastValueVisible: false,
          priceLineVisible: false,
        });
      }

      seriesRef.current.set(token.CA, series);
      seriesCreated++;
    }
    
    // Create volume series in separate pane if we have tokens and volume pane is enabled
    if (seriesCreated > 0 && showVolumePane) {
      const volumeSeries = chartRef.current.addSeries(
        HistogramSeries,
        {
          priceFormat: {
            type: 'volume',
          },
        },
        1 // Pane index
      );
      volumeSeriesRef.current = volumeSeries;
      
      // Apply pane configuration
      chartRef.current.applyOptions({
        layout: {
          panes: {
            separatorColor: '#888888',
            separatorHoverColor: '#ffffff',
            enableResize: true,
          },
        },
      });
    }
    
    // Chart series creation complete
  };

  // Update chart data (called when mode or rebase changes)
  const updateChartData = () => {
    if (!chartRef.current) return;
    
    // Check if there's any data available
    if (allTokensData.size === 0) {
      return;
    }
    
    let seriesUpdated = 0;
    seriesRef.current.forEach((series, tokenCA) => {
      const rawData = allTokensData.get(tokenCA);
      if (!rawData || rawData.length === 0) {
        return;
      }
      
      let processedData = rawData;
      
      // Apply percentage transformation FIRST (if in percentage mode)
      // This ensures baseline is calculated from original OHLC data (using OPEN price)
      if (mode === 'percentage' && rebaseTimestamp > 0) {
        processedData = transformToPercentageWithRebase(processedData, rebaseTimestamp);
      }
      
      // Transform to line format AFTER percentage calculation (if chart type is line)
      // This preserves the OPEN-based baseline for consistency across all chart types
      if (chartType === 'line') {
        processedData = transformToLineData(processedData);
      }
      
      series.setData(processedData);
      seriesUpdated++;
    });
    
    // Update volume series with data from first visible token (only if volume pane is enabled)
    if (volumeSeriesRef.current && selectedTokens.length > 0 && showVolumePane) {
      const firstVisibleToken = selectedTokens.find(token => token.visible);
      if (firstVisibleToken) {
        const tokenData = allTokensData.get(firstVisibleToken.CA);
        if (tokenData && tokenData.length > 0) {
          const volumeData = tokenData.map(item => ({
            time: item.time,
            value: item.volume || 0
          }));
          volumeSeriesRef.current.setData(volumeData);
        }
      }
    }
    
    // Chart data update complete
    
    // Auto-scale after updating data (only if we have data and not locked)
    if (seriesUpdated > 0) {
      setTimeout(() => {
        if (chartRef.current) {
          if (isLocked) {
            // Restore locked scaling instead of auto-scaling
            applyLockedScaling();
          } else {
            // Normal auto-scaling when not locked
            chartRef.current.timeScale().fitContent();
          }
        }
      }, 100);
    }
  };

  // Effect for handling timeframe changes - clear chart immediately
  useEffect(() => {
    // Clear chart series immediately when timeframe changes
    if (chartRef.current) {
      seriesRef.current.forEach((series) => {
        try {
          if (series && chartRef.current) {
            chartRef.current.removeSeries(series);
          }
        } catch (error) {
        }
      });
      seriesRef.current.clear();
    }
    
    // Realign rebase timestamp for new timeframe
    if (rebaseTimestamp > 0) {
      const alignedTimestamp = alignTimestampToTimeframe(rebaseTimestamp, currentTimeFrame);
      if (alignedTimestamp !== rebaseTimestamp) {
        setRebaseTimestamp(alignedTimestamp);
      }
    }
    
    // Fetch data for new timeframe
    fetchAllTokensData();
  }, [currentTimeFrame]);

  // Effect for fetching data when tokens change or refresh is triggered
  useEffect(() => {
    fetchAllTokensData();
  }, [selectedTokens, refreshTrigger]);

  // Effect for creating series when tokens, chart type, or decimals change
  useEffect(() => {
    if (allTokensData.size > 0 && !loading) {
      createChartSeries();
      updateChartData();
    }
  }, [selectedTokens, chartType, decimals, allTokensData, loading, showVolumePane]);

  // Effect for updating data when mode or rebase changes
  useEffect(() => {
    if (allTokensData.size > 0 && !loading) {
      updateChartData();
    }
  }, [mode, rebaseTimestamp, loading, showVolumePane]);

  // Effect for updating price scale precision when decimals change
  useEffect(() => {
    if (chartRef.current) {
      // Note: Price precision is set when creating series
    }
  }, [decimals]);

  // Helper function to restore locked scaling ranges
  const applyLockedScaling = useCallback(() => {
    if (!chartRef.current || !isLocked) return;
    
    try {
      // Validate and restore logical range if locked - apply multiple times for persistence
      if (lockedLogicalRange && lockedLogicalRange.from < lockedLogicalRange.to) {
        chartRef.current.timeScale().setVisibleLogicalRange(lockedLogicalRange);
        
        // Additional aggressive reapplication after a small delay
        setTimeout(() => {
          if (chartRef.current && isLocked) {
            chartRef.current.timeScale().setVisibleLogicalRange(lockedLogicalRange);
          }
        }, 50);
      }
      
      // Validate and restore price range if locked
      if (lockedPriceRange && lockedPriceRange.from < lockedPriceRange.to && seriesRef.current.size > 0) {
        seriesRef.current.forEach((series) => {
          try {
            series.priceScale().setVisibleRange(lockedPriceRange);
          } catch (error) {
            // Silent error handling to prevent infinite loops
          }
        });
      }
    } catch (error) {
      // Silent error handling to prevent infinite loops
    }
  }, [isLocked, lockedLogicalRange, lockedPriceRange]);

  // Effect to apply locked scaling when lock state changes or data updates
  useEffect(() => {
    if (isLocked && chartRef.current && seriesRef.current.size > 0) {
      // Apply locked scaling with multiple attempts to ensure it sticks
      const timeoutId1 = setTimeout(() => {
        applyLockedScaling();
      }, 200);
      
      const timeoutId2 = setTimeout(() => {
        applyLockedScaling();
      }, 400);
      
      const timeoutId3 = setTimeout(() => {
        applyLockedScaling();
      }, 600);
      
      return () => {
        clearTimeout(timeoutId1);
        clearTimeout(timeoutId2);
        clearTimeout(timeoutId3);
      };
    }
  }, [isLocked, applyLockedScaling, allTokensData, loading]);

  const timeFrames: TimeFrame[] = ['M1', 'M5', 'M15', 'H1', 'H4', 'H12', 'D1'];

  const handleAutoScale = () => {
    if (isLocked) {
      return;
    }
    
    if (chartRef.current) {
      // Apply auto-scale to all series
      seriesRef.current.forEach((series) => {
        series.priceScale().applyOptions({ autoScale: true });
      });
    }
  };

  const handleToggleLock = () => {
    if (!isLocked) {
      // Locking: capture current ranges and maintain rightOffset
      try {
        if (chartRef.current) {
          // Get current logical range
          const visibleRange = chartRef.current.timeScale().getVisibleLogicalRange();
          if (visibleRange) {
            // Store the current rightOffset value to maintain when locked
            const currentRightOffset = Math.max(10, rightMargin * 3);
            
            // Lock the current range and maintain the rightOffset
            const lockedRange = {
              from: visibleRange.from,
              to: visibleRange.to
            };
            setLockedLogicalRange(lockedRange);
            
            // Apply the locked rightOffset
            chartRef.current.applyOptions({
              timeScale: {
                rightOffset: currentRightOffset,
              },
            });
          }
          
          // Capture price range from first series (they should all have similar ranges)
          if (seriesRef.current.size > 0) {
            const firstSeries = seriesRef.current.values().next().value;
            if (firstSeries) {
              try {
                const priceRange = firstSeries.priceScale().getVisibleRange();
                if (priceRange) {
                  setLockedPriceRange(priceRange);
                }
              } catch (error) {
                // Silent error handling to prevent infinite loops
              }
            }
          }
        }
      } catch (error) {
        // Silent error handling to prevent infinite loops
      }
    } else {
      // Unlocking: clear ranges
      setLockedLogicalRange(null);
      setLockedPriceRange(null);
    }
    
    setIsLocked(!isLocked);
  };

  // Handle resize drag start
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    isDraggingRef.current = true;
    dragStartY.current = e.clientY;
    
    // Get current height from DOM for accuracy
    const currentHeight = chartContainerRef.current?.parentElement?.clientHeight || chartHeight;
    dragStartHeight.current = currentHeight;
    
    
    document.body.style.cursor = 'ns-resize';
    
    // Attach event listeners using ref functions for stable references
    if (handleResizeDragRef.current && handleResizeEndRef.current) {
      document.addEventListener('mousemove', handleResizeDragRef.current, { passive: false });
      document.addEventListener('mouseup', handleResizeEndRef.current, { passive: false });
    }
    
    
    e.preventDefault();
  };

  // Initialize drag functions in refs for stable event listener attachment
  useEffect(() => {
    handleResizeDragRef.current = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      const deltaY = e.clientY - dragStartY.current;
      const newHeight = Math.max(300, Math.min(800, dragStartHeight.current + deltaY));
      
      
      // Throttle updates to 60fps (16ms) for smooth performance
      const now = Date.now();
      if (now - lastUpdateTimeRef.current >= 16) {
        lastUpdateTimeRef.current = now;
        setChartHeight(newHeight);
      }
    };
    
    handleResizeEndRef.current = () => {
      setIsDragging(false);
      isDraggingRef.current = false;
      document.body.style.cursor = 'default';
      
      // Remove event listeners immediately
      if (handleResizeDragRef.current) {
        document.removeEventListener('mousemove', handleResizeDragRef.current);
      }
      if (handleResizeEndRef.current) {
        document.removeEventListener('mouseup', handleResizeEndRef.current);
      }
      
    };
  }, [chartHeight]);

  // Old useCallback functions removed - now using ref-based approach

  // Event listeners are now managed directly in handleResizeStart/End
  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clean up any remaining event listeners on unmount
      if (handleResizeDragRef.current) {
        document.removeEventListener('mousemove', handleResizeDragRef.current);
      }
      if (handleResizeEndRef.current) {
        document.removeEventListener('mouseup', handleResizeEndRef.current);
      }
    };
  }, []);

  return (
    <div className="h-full flex flex-col rounded border-l-[4px] border-r-[4px]" style={{backgroundColor: '#0a0a0a', borderColor: '#111111'}}>
      {/* Price Panel Header */}
      <div className="border-b border-gray-800 px-3 py-2" style={{backgroundColor: '#111111'}}>
        {/* Header layout with left and right sections */}
        <div className="flex items-center justify-between gap-4">
          {/* LEFT SECTION: Sub-panel controls */}
          <div className="flex items-center flex-shrink-0">
            {/* Volume Pane Toggle */}
            <button
              onClick={() => setShowVolumePane(!showVolumePane)}
              className={`px-2 py-1 rounded transition-colors ${
                showVolumePane 
                  ? 'bg-green-600 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              style={!showVolumePane ? {backgroundColor: '#2a2a2a'} : {}}
              title={showVolumePane ? 'Hide Volume Pane' : 'Show Volume Pane'}
            >
              <PanelBottomDashed size={14} />
            </button>
          </div>

          {/* RIGHT SECTION: Price panel controls */}
          <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
            {/* Chart Type Group */}
            <div className="flex items-center rounded-lg p-1" style={{backgroundColor: '#1a1a1a', gap: '2px'}}>
              <button
                onClick={() => onChartTypeChange('candles')}
                className={`px-2 py-1 rounded transition-colors ${
                  chartType === 'candles' 
                    ? 'bg-green-600 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                style={chartType !== 'candles' ? {backgroundColor: '#2a2a2a'} : {}}
                title="Candlestick Chart"
              >
                <CandlestickChart size={14} />
              </button>
              <button
                onClick={() => onChartTypeChange('ohlc')}
                className={`px-2 py-1 rounded transition-colors ${
                  chartType === 'ohlc' 
                    ? 'bg-green-600 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                style={chartType !== 'ohlc' ? {backgroundColor: '#2a2a2a'} : {}}
                title="OHLC Chart"
              >
                <BarChart3 size={14} />
              </button>
              <button
                onClick={() => onChartTypeChange('line')}
                className={`px-2 py-1 rounded transition-colors ${
                  chartType === 'line' 
                    ? 'bg-green-600 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                style={chartType !== 'line' ? {backgroundColor: '#2a2a2a'} : {}}
                title="Line Chart"
              >
                <TrendingUp size={14} />
              </button>
            </div>

            {/* Decimals Group */}
            <div className="flex items-center space-x-2">
              <label className="text-xs text-gray-400">Decimals:</label>
              <select
                value={decimals}
                onChange={(e) => onDecimalsChange(Number(e.target.value))}
                className="text-white border border-gray-800 rounded px-2 py-1 text-xs focus:outline-none focus:border-green-500"
                style={{backgroundColor: '#2a2a2a'}}
              >
                {[0, 1, 2, 3, 4, 5].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>

            {/* Right Margin Group */}
            <div className="flex items-center space-x-2 relative">
              <button
                onClick={() => setShowMarginSlider(!showMarginSlider)}
                className="text-white border border-gray-800 rounded px-2 py-1 text-xs hover:bg-gray-800 focus:outline-none focus:border-green-500"
                style={{backgroundColor: '#2a2a2a'}}
              >
                rM:{rightMargin}
              </button>
              
              {showMarginSlider && (
                <div className="absolute top-full left-0 mt-1 p-3 bg-gray-950 border border-gray-800 rounded-lg shadow-lg z-10 min-w-[200px]">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400">0%</span>
                    <input
                      type="range"
                      min="0"
                      max="75"
                      value={rightMargin}
                      onChange={(e) => setRightMargin(Number(e.target.value))}
                      className="flex-1 h-1 bg-gray-900 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <span className="text-xs text-gray-400">75%</span>
                  </div>
                  <div className="text-center text-xs text-gray-300 mt-1">
                    {rightMargin}%
                  </div>
                </div>
              )}
            </div>

            {/* Timeframe Group */}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg p-1" style={{backgroundColor: '#1a1a1a', gap: '2px'}}>
                {timeFrames.map(tf => (
                  <button
                    key={tf}
                    onClick={() => {
                      onTimeFrameChange(tf);
                    }}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      currentTimeFrame === tf
                        ? 'bg-green-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-600'
                    }`}
                    style={currentTimeFrame !== tf ? {backgroundColor: '#2a2a2a'} : {}}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode Group */}
            <div className="flex items-center rounded-lg" style={{backgroundColor: '#1a1a1a'}}>
              <button
                onClick={() => {
                  setMode('absolute');
                }}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  mode === 'absolute'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                }`}
                style={mode !== 'absolute' ? {backgroundColor: '#2a2a2a'} : {}}
              >
                Absolute
              </button>
              <button
                onClick={() => {
                  setMode('percentage');
                }}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  mode === 'percentage'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                }`}
                style={mode !== 'percentage' ? {backgroundColor: '#2a2a2a'} : {}}
              >
                Percentage
              </button>
            </div>

            {/* Scale Controls Group */}
            <div className="flex items-center space-x-1">
              <button
                onClick={handleAutoScale}
                className="px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                style={{backgroundColor: '#2a2a2a'}}
                title="Auto Scale"
              >
                <Scaling size={14} />
              </button>
              <button
                onClick={handleToggleLock}
                className={`px-2 py-1 rounded transition-colors ${
                  isLocked
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
                style={!isLocked ? {backgroundColor: '#2a2a2a'} : {}}
                title={isLocked ? 'Unlock Scale' : 'Lock Scale'}
              >
                <Lock size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative" style={{ height: chartHeight }}>
        <div 
          ref={chartContainerRef} 
          className="w-full h-full" 
          style={{ height: chartHeight }}
        />
        {loading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-white">Loading chart data...</div>
          </div>
        )}
        
        {/* Price Level Tooltip for Percentage Mode */}
        {mode === 'percentage' && showTooltip && (
          <div
            className="absolute z-10 bg-gray-900 border border-gray-700 rounded-lg p-2 shadow-lg pointer-events-none"
            style={{
              left: tooltipPosition.x,
              top: tooltipPosition.y,
              transform: 'translate(-50%, -100%)',
              minWidth: '150px'
            }}
          >
            {tooltipData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-xs text-white mb-1 last:mb-0">
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-mono">{item.symbol}</span>
                </div>
                <span className="font-mono ml-2">${item.price.toFixed(tooltipDecimals)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resize Handle - Only shown in absolute mode */}
      {mode === 'absolute' && (
        <div
          className={`h-2 cursor-ns-resize transition-colors flex items-center justify-center border ${
            isDragging ? 'bg-gray-600' : ''
          }`}
          style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}
          onMouseDown={handleResizeStart}
        >
          <GripHorizontal size={12} className="text-gray-400" />
        </div>
      )}

      {/* Percentage Mode Slider (only visible in percentage mode) */}
      {mode === 'percentage' && (() => {
        const sliderRange = getAlignedSliderRange(dataTimeRange.min, dataTimeRange.max, currentTimeFrame);
        return (
          <div className="border-t border-gray-800 px-3 py-2" style={{backgroundColor: '#111111'}}>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min={sliderRange.min}
                max={sliderRange.max}
                step={sliderRange.step}
                value={rebaseTimestamp}
                onChange={(e) => {
                  const newTimestamp = parseInt(e.target.value);
                  const alignedTimestamp = alignTimestampToTimeframe(newTimestamp, currentTimeFrame);
                  setRebaseTimestamp(alignedTimestamp);
                }}
                className="flex-1 h-2 rounded-lg cursor-pointer"
                style={{
                  background: '#666666',
                  outline: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none'
                }}
                disabled={sliderRange.min === 0 || sliderRange.max === 0}
              />
              <span className="text-sm font-mono" style={{color: '#10b981'}}>
                {formatTimestampForChart(rebaseTimestamp)}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Resize Handle - Only shown in percentage mode (below slider) */}
      {mode === 'percentage' && (
        <div
          className={`h-2 cursor-ns-resize transition-colors flex items-center justify-center border ${
            isDragging ? 'bg-gray-600' : ''
          }`}
          style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}
          onMouseDown={handleResizeStart}
        >
          <GripHorizontal size={12} className="text-gray-400" />
        </div>
      )}
      
      {/* Click outside to close margin slider */}
      {showMarginSlider && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setShowMarginSlider(false)}
        />
      )}
    </div>
  );
}