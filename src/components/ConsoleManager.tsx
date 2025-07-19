'use client';

import { useEffect } from 'react';
import { useTestingContext } from '@/contexts/TestingContext';
import consoleManager from '@/lib/consoleManager';

/**
 * ConsoleManager component that initializes console interception
 * and connects it to the TestingContext
 */
export default function ConsoleManager() {
  const { addTestingMessage } = useTestingContext();

  useEffect(() => {
    // Start console interception with TestingContext callback
    consoleManager.start(addTestingMessage);

    // Cleanup on unmount
    return () => {
      consoleManager.stop();
    };
  }, [addTestingMessage]);

  // This component renders nothing
  return null;
}