import { getTokenStates } from './localStorage';
import { type ChartListItem } from './types';

// Color palette for token assignment
export const COLOR_PALETTE = [
  '#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff',
  '#8000ff', '#ff00ff', '#ff0080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080',
  '#808080', '#c0c0c0', '#ff4444', '#ff8844', '#ffff44', '#88ff44', '#44ff44', '#44ff88', '#44ffff',
  '#4488ff', '#4444ff', '#8844ff', '#ff44ff', '#ff4488', '#ffffff', '#ffaaaa', '#ffddaa', '#ffffaa',
  '#aaffaa', '#aaffff', '#aaaaff', '#ddaaff', '#ffaaff', '#dddddd', '#ff6666', '#ffaa66', '#ffff66',
  '#66ff66', '#66ffff', '#6666ff', '#aa66ff', '#ff66aa', '#555555', '#ff9999', '#ffcc99', '#00cc99'
];

// Get the next available color that maximizes distance from existing colors
export function getNextAvailableColor(existingColors: string[]): string {
  // Filter out black (#000000) from auto-selection
  const availableColors = COLOR_PALETTE.filter(color => color !== '#000000');
  
  if (existingColors.length === 0) return availableColors[0];
  
  let maxDistance = 0;
  let bestColor = availableColors[0];
  
  for (const color of availableColors) {
    if (existingColors.includes(color)) continue;
    
    let minDistance = Infinity;
    for (const existingColor of existingColors) {
      const distance = getColorDistance(color, existingColor);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    
    if (minDistance > maxDistance) {
      maxDistance = minDistance;
      bestColor = color;
    }
  }
  
  return bestColor;
}

// Calculate color distance (simplified RGB distance)
function getColorDistance(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return 0;
  
  const dr = rgb1.r - rgb2.r;
  const dg = rgb1.g - rgb2.g;
  const db = rgb1.b - rgb2.b;
  
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Client-side token to chart list conversion with localStorage integration
export function tokensToChartListItems(tokens: any[], existingChartList: ChartListItem[] = []): ChartListItem[] {
  // Get saved token states from localStorage (client-side only)
  const savedStates = typeof window !== 'undefined' ? getTokenStates() : {};
  
  // Start with existing chart list to preserve order and colors
  const result = [...existingChartList];
  
  // Get existing CAs to check for new tokens
  const existingCAs = new Set(existingChartList.map(item => item.CA));
  
  // Find truly new tokens that aren't in the chart list yet
  const newTokens = tokens.filter(token => !existingCAs.has(token.CA));
  
  if (newTokens.length === 0) {
    // No new tokens, but apply localStorage states to existing tokens
    return result.map(token => {
      const savedState = savedStates[token.CA];
      if (savedState) {
        return {
          ...token,
          visible: savedState.visible,
          color: savedState.color,
          order: savedState.order
        };
      }
      return token;
    }).sort((a, b) => {
      const stateA = savedStates[a.CA];
      const stateB = savedStates[b.CA];
      if (stateA && stateB) {
        return stateA.order - stateB.order;
      }
      return 0;
    });
  }
  
  // Get existing colors to avoid conflicts (including colors from localStorage)
  const existingColors = [
    ...existingChartList.map(item => item.color),
    ...Object.values(savedStates).map(state => state.color)
  ];
  let nextOrder = Math.max(
    ...existingChartList.map(item => item.order),
    ...Object.values(savedStates).map(state => state.order || 0),
    -1
  ) + 1;
  
  // Add only the new tokens with new colors
  newTokens.forEach(token => {
    const savedState = savedStates[token.CA];
    
    // If token has saved state, use it; otherwise assign new color
    const color = savedState?.color || getNextAvailableColor(existingColors);
    const visible = savedState?.visible !== undefined ? savedState.visible : true;
    const order = savedState?.order !== undefined ? savedState.order : nextOrder++;
    
    if (!savedState) {
      existingColors.push(color); // Add to array for next iteration only if it's a new color
    }
    
    result.push({
      ...token,
      visible,
      color,
      order
    });
  });
  
  // Apply localStorage states to all tokens and sort by order
  return result.map(token => {
    const savedState = savedStates[token.CA];
    if (savedState) {
      return {
        ...token,
        visible: savedState.visible,
        color: savedState.color,
        order: savedState.order
      };
    }
    return token;
  }).sort((a, b) => {
    const stateA = savedStates[a.CA];
    const stateB = savedStates[b.CA];
    if (stateA && stateB) {
      return stateA.order - stateB.order;
    }
    return a.order - b.order; // Fallback to default order
  });
}