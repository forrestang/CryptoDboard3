/**
 * Robust clipboard utility with error handling and fallback mechanisms
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    // Check if Clipboard API is available and we're in a secure context
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for older browsers or non-secure contexts
    return fallbackCopyToClipboard(text);
  } catch (error) {
    console.warn('Clipboard API failed, trying fallback:', error);
    return fallbackCopyToClipboard(text);
  }
};

/**
 * Fallback clipboard method using document.execCommand (deprecated but widely supported)
 */
const fallbackCopyToClipboard = (text: string): boolean => {
  try {
    // Create a temporary textarea element
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    // Try to copy using execCommand
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    return successful;
  } catch (error) {
    console.error('Fallback copy failed:', error);
    return false;
  }
};

/**
 * Check if clipboard functionality is available
 */
export const isClipboardAvailable = (): boolean => {
  return !!(navigator.clipboard && navigator.clipboard.writeText) || 
         !!(document.execCommand);
};