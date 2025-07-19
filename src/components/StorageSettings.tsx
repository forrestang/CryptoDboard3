'use client';

import { useState, useEffect } from 'react';
import { Folder, Download, Upload, Settings, X, Check } from 'lucide-react';

interface StorageConfig {
  dataPath: string;
  tokensFile: string;
  ohlcvFile: string;
  settingsFile: string;
}

interface StorageStats {
  tokensCount: number;
  ohlcvCount: number;
  totalSize: string;
}

interface StorageSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onStoragePathChange?: (newPath: string) => void;
}

export default function StorageSettings({ isOpen, onClose, onStoragePathChange }: StorageSettingsProps) {
  const [config, setConfig] = useState<StorageConfig>({
    dataPath: './data',
    tokensFile: 'tokens.json',
    ohlcvFile: 'ohlcv.json',
    settingsFile: 'storage-settings.json'
  });
  const [stats, setStats] = useState<StorageStats>({
    tokensCount: 0,
    ohlcvCount: 0,
    totalSize: '0 KB'
  });
  const [customPath, setCustomPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load current configuration and stats
  useEffect(() => {
    if (isOpen) {
      loadStorageInfo();
    }
  }, [isOpen]);

  const loadStorageInfo = async () => {
    try {
      setIsLoading(true);
      
      // Load current config
      const configResponse = await fetch('/api/storage/config');
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setConfig(configData.config);
        setCustomPath(configData.config.dataPath);
      }

      // Load storage stats
      const statsResponse = await fetch('/api/storage/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      }
    } catch (error) {
      showMessage('error', 'Failed to load storage information');
    } finally {
      setIsLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUpdateStoragePath = async () => {
    if (!customPath.trim()) {
      showMessage('error', 'Please enter a valid path');
      return;
    }

    try {
      setIsLoading(true);
      
      const response = await fetch('/api/storage/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataPath: customPath.trim() })
      });

      if (response.ok) {
        const result = await response.json();
        setConfig(result.config);
        showMessage('success', 'Storage path updated successfully');
        
        if (onStoragePathChange) {
          onStoragePathChange(customPath.trim());
        }
        
        // Reload stats with new location
        await loadStorageInfo();
      } else {
        const error = await response.json();
        showMessage('error', error.error || 'Failed to update storage path');
      }
    } catch (error) {
      showMessage('error', 'Error updating storage path');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/storage/export');
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `crypto-dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showMessage('success', 'Data exported successfully');
      } else {
        showMessage('error', 'Failed to export data');
      }
    } catch (error) {
      showMessage('error', 'Error exporting data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/storage/import', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        showMessage('success', 'Data imported successfully');
        await loadStorageInfo(); // Refresh stats
      } else {
        const error = await response.json();
        showMessage('error', error.error || 'Failed to import data');
      }
    } catch (error) {
      showMessage('error', 'Error importing data');
    } finally {
      setIsLoading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-950 rounded-lg border border-gray-800 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-800">
          <div className="flex items-center space-x-2">
            <Settings className="text-gray-400" size={20} />
            <h2 className="text-lg font-semibold text-white">Storage Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-900 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Message */}
          {message && (
            <div className={`p-3 rounded-lg border ${
              message.type === 'success' 
                ? 'bg-green-900 border-green-700 text-green-200' 
                : 'bg-red-900 border-red-700 text-red-200'
            }`}>
              <div className="flex items-center space-x-2">
                {message.type === 'success' ? <Check size={16} /> : <X size={16} />}
                <span className="text-sm">{message.text}</span>
              </div>
            </div>
          )}

          {/* Current Storage Location */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Current Storage Location</h3>
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <Folder size={16} />
                <span className="font-mono">{config.dataPath}</span>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                Files: {config.tokensFile}, {config.ohlcvFile}
              </div>
            </div>
          </div>

          {/* Storage Statistics */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Storage Statistics</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">{stats.tokensCount}</div>
                <div className="text-xs text-gray-400">Tokens</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">{stats.ohlcvCount}</div>
                <div className="text-xs text-gray-400">OHLCV Records</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">{stats.totalSize}</div>
                <div className="text-xs text-gray-400">Total Size</div>
              </div>
            </div>
          </div>

          {/* Change Storage Location */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Change Storage Location</h3>
            <div className="flex space-x-2">
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="Enter custom storage path (e.g., D:\CryptoData)"
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleUpdateStoragePath}
                disabled={isLoading}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-800 text-white rounded-lg font-medium transition-colors"
              >
                Update
              </button>
            </div>
            <div className="text-xs text-gray-400">
              Note: Existing data will be moved to the new location
            </div>
          </div>

          {/* Data Management */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Data Management</h3>
            <div className="flex space-x-3">
              <button
                onClick={handleExportData}
                disabled={isLoading}
                className="flex items-center space-x-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-800 text-white rounded-lg font-medium transition-colors"
              >
                <Download size={16} />
                <span>Export Data</span>
              </button>
              
              <label className="flex items-center space-x-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors cursor-pointer">
                <Upload size={16} />
                <span>Import Data</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                  disabled={isLoading}
                />
              </label>
            </div>
            <div className="text-xs text-gray-400">
              Export: Creates a backup file. Import: Restores data from backup.
            </div>
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center justify-center space-x-2 text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
              <span className="text-sm">Processing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}