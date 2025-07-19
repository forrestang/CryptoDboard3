'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface TestingContextType {
  testingMessages: string[];
  addTestingMessage: (message: string) => void;
  clearTestingMessages: () => void;
}

const TestingContext = createContext<TestingContextType | undefined>(undefined);

export const useTestingContext = () => {
  const context = useContext(TestingContext);
  if (!context) {
    throw new Error('useTestingContext must be used within a TestingProvider');
  }
  return context;
};

interface TestingProviderProps {
  children: ReactNode;
}

export const TestingProvider: React.FC<TestingProviderProps> = ({ children }) => {
  const [testingMessages, setTestingMessages] = useState<string[]>(['Ready for testing...']);

  const addTestingMessage = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestingMessages(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const clearTestingMessages = useCallback(() => {
    setTestingMessages(['Ready for testing...']);
  }, []);

  return (
    <TestingContext.Provider value={{
      testingMessages,
      addTestingMessage,
      clearTestingMessages
    }}>
      {children}
    </TestingContext.Provider>
  );
};