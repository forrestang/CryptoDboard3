// Utility functions for formatting numbers and values

// Format large numbers with abbreviations (2 decimal places for MC/FDV)
export const formatNumber = (value: string | number | undefined): string => {
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
export const formatVolumeNumber = (value: string | number | undefined): string => {
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
export const formatPriceChange = (value: string | undefined): string => {
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