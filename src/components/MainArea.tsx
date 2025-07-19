'use client';

import PricePanel from '@/components/PricePanel';
import TrendingTokensPanel from '@/components/TrendingTokensPanel';
import { type ChartListItem } from '@/lib/types';

type TimeFrame = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'H12' | 'D1';

interface MainAreaProps {
  leftPanelCollapsed: boolean;
  selectedTokens: ChartListItem[];
  currentTimeFrame: TimeFrame;
  onTimeFrameChange: (timeFrame: TimeFrame) => void;
  refreshTrigger: number;
  chartType: 'candles' | 'ohlc' | 'line';
  decimals: number;
  onChartTypeChange: (type: 'candles' | 'ohlc' | 'line') => void;
  onDecimalsChange: (decimals: number) => void;
  onAddToken?: (ca: string, network: 'base' | 'solana', timeframe: TimeFrame) => void;
}

export default function MainArea({ 
  leftPanelCollapsed, 
  selectedTokens, 
  currentTimeFrame, 
  onTimeFrameChange,
  refreshTrigger,
  chartType,
  decimals,
  onChartTypeChange,
  onDecimalsChange,
  onAddToken
}: MainAreaProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Price Panel */}
      <div className="flex-shrink-0 p-3">
        <PricePanel 
          selectedTokens={selectedTokens} 
          currentTimeFrame={currentTimeFrame}
          onTimeFrameChange={onTimeFrameChange}
          refreshTrigger={refreshTrigger}
          chartType={chartType}
          decimals={decimals}
          onChartTypeChange={onChartTypeChange}
          onDecimalsChange={onDecimalsChange}
        />
      </div>

      {/* Trending Tokens Panel */}
      <div className="flex-1 min-h-48 overflow-hidden p-3">
        <TrendingTokensPanel 
          onAddToken={onAddToken}
          currentTimeFrame={currentTimeFrame}
        />
      </div>
    </div>
  );
}