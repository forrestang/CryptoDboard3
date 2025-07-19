/**
 * Standalone console manager that operates outside React lifecycle
 * to prevent circular dependencies and infinite loops
 */

type ConsoleMethod = 'log' | 'error' | 'warn' | 'info';
type MessageCallback = (message: string) => void;

interface ConsoleOverride {
  method: ConsoleMethod;
  original: (...args: any[]) => void;
  emoji: string;
}

class ConsoleManager {
  private isActive = false;
  private messageCallback: MessageCallback | null = null;
  private overrides: ConsoleOverride[] = [];

  constructor() {
    // Store original console methods
    this.overrides = [
      { method: 'log', original: console.log, emoji: '📝' },
      { method: 'error', original: console.error, emoji: '❌' },
      { method: 'warn', original: console.warn, emoji: '⚠️' },
      { method: 'info', original: console.info, emoji: 'ℹ️' }
    ];
  }

  /**
   * Start console interception
   */
  start(callback: MessageCallback): void {
    if (this.isActive) {
      this.stop(); // Stop existing interception first
    }

    this.messageCallback = callback;
    this.isActive = true;

    // Override console methods
    this.overrides.forEach(({ method, original, emoji }) => {
      console[method] = (...args: any[]) => {
        // Call original console method for browser DevTools
        original(...args);
        
        // Send message to callback if available
        if (this.messageCallback) {
          try {
            const message = args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            
            // Use requestAnimationFrame to avoid blocking render
            requestAnimationFrame(() => {
              this.messageCallback?.(`${emoji} ${message}`);
            });
          } catch (error) {
            // Fallback in case of circular JSON or other issues
            original('Console manager error:', error);
          }
        }
      };
    });
  }

  /**
   * Stop console interception and restore original methods
   */
  stop(): void {
    if (!this.isActive) return;

    // Restore original console methods
    this.overrides.forEach(({ method, original }) => {
      console[method] = original;
    });

    this.isActive = false;
    this.messageCallback = null;
  }

  /**
   * Check if console interception is active
   */
  isActiveState(): boolean {
    return this.isActive;
  }

  /**
   * Update the message callback without restarting interception
   */
  updateCallback(callback: MessageCallback): void {
    this.messageCallback = callback;
  }
}

// Create singleton instance
const consoleManager = new ConsoleManager();

export default consoleManager;