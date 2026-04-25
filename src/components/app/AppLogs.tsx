'use client';

import React, { useEffect, useState, useRef } from 'react';
import ComponentCard from '@/components/common/ComponentCard';
import Button from '@/components/ui/button/Button';
import { FaPlay, FaStop, FaDownload, FaArrowsRotate } from 'react-icons/fa6';
import { useSocketContext } from '@/context/SocketContext';

interface AppLogsProps {
  appName: string;
}

export default function AppLogs({ appName }: AppLogsProps) {
  const [logs, setLogs] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocketContext();

  const scrollToBottom = () => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 5;
      if (autoScroll && !isAtBottom) {
        setAutoScroll(false);
      } else if (!autoScroll && isAtBottom) {
        setAutoScroll(true);
      }
    }
  };

  const startLogStream = async () => {
    if (!socket || isStreaming) return;
    
    try {
      setLoading(true);
      const response = await socket.emitWithAck("systemctl:stream-logs", { appName });
      if (response.success) {
        setIsStreaming(true);
        setError(null);
      } else {
        setError(response.error || 'Failed to start log stream');
      }
    } catch (err) {
      setError('Failed to start log stream');
      console.error('Error starting log stream:', err);
    } finally {
      setLoading(false);
    }
  };

  const stopLogStream = async () => {
    if (!socket || !isStreaming) return;
    
    try {
      const response = await socket.emitWithAck("systemctl:stop-stream", { appName });
      if (response.success) {
        setIsStreaming(false);
        setError(null);
      } else {
        setError(response.error || 'Failed to stop log stream');
      }
    } catch (err) {
      setError('Failed to stop log stream');
      console.error('Error stopping log stream:', err);
    }
  };

  const fetchRecentLogs = async () => {
    if (!socket) return;
    
    try {
      setLoading(true);
      const response = await socket.emitWithAck("systemctl:logs", { appName, lines: 100 });
      if (response.success) {
        setLogs(response.data.logs);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch logs');
      }
    } catch (err) {
      setError('Failed to fetch logs');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadLogs = async () => {
    if (!socket) return;
    
    try {
      const response = await socket.emitWithAck("systemctl:logs", { appName, lines: 10000 });
      if (response.success) {
        const blob = new Blob([response.data.logs], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${appName}-logs-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError(response.error || 'Failed to download logs');
      }
    } catch (err) {
      setError('Failed to download logs');
      console.error('Error downloading logs:', err);
    }
  };

  const clearLogs = () => {
    setLogs('');
  };

  useEffect(() => {
    if (!socket) return;

    // Fetch recent logs on component mount
    fetchRecentLogs();
    
    // Set up socket event listeners
    socket.on("systemctl:log-stream", (data: { appName: string; data: string; timestamp: string }) => {
      if (data.appName === appName) {
        setLogs(prev => prev + data.data);
      }
    });

    socket.on("logs:stream-ended", (data: { appName: string }) => {
      if (data.appName === appName) {
        setIsStreaming(false);
      }
    });

    socket.on("logs:error", (data: { appName: string; error: string }) => {
      if (data.appName === appName) {
        setError(data.error);
        setIsStreaming(false);
      }
    });
    
    return () => {
      // Clean up socket listeners
      socket.off("systemctl:log-stream");
      socket.off("logs:stream-ended");
      socket.off("logs:error");
      
      // Stop streaming if active
      if (isStreaming) {
        socket.emitWithAck("systemctl:stop-stream", { appName }).catch(err => 
          console.error('Error stopping log stream during cleanup:', err)
        );
      }
    };
  }, [socket, appName]);

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Application Logs</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time logs for {appName}
            {isStreaming && (
              <span className="ml-2 inline-flex items-center">
                <div className="animate-pulse h-2 w-2 bg-green-400 rounded-full mr-1"></div>
                <span className="text-green-600 dark:text-green-400">Live</span>
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={fetchRecentLogs}
            disabled={loading || isStreaming}
            variant="outline"
            size="sm"
          >
            <FaArrowsRotate className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          
          <Button
            onClick={downloadLogs}
            disabled={loading || !logs}
            variant="outline"
            size="sm"
          >
            <FaDownload className="w-4 h-4 mr-2" />
            Download
          </Button>
          
          <Button
            onClick={clearLogs}
            disabled={loading || !logs}
            variant="outline"
            size="sm"
          >
            Clear
          </Button>
          
          {isStreaming ? (
            <Button
              onClick={stopLogStream}
              disabled={loading}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
            >
              <FaStop className="w-4 h-4 mr-2" />
              Stop Stream
            </Button>
          ) : (
            <Button
              onClick={startLogStream}
              disabled={loading}
              variant="primary"
              size="sm"
            >
              <FaPlay className="w-4 h-4 mr-2" />
              Start Stream
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-red-700 dark:text-red-400">Error: {error}</div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Console Output</span>
              {isStreaming && (
                <div className="flex items-center space-x-1">
                  <div className="animate-pulse h-2 w-2 bg-green-400 rounded-full"></div>
                  <span className="text-xs text-green-600 dark:text-green-400">Streaming</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <span>Auto-scroll</span>
              </label>
              
              {logs && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {logs.split('\n').length - 1} lines
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div 
          ref={logsContainerRef}
          onScroll={handleScroll}
          className="bg-gray-900 dark:bg-gray-950 text-gray-100 dark:text-gray-200 font-mono text-sm overflow-y-auto h-96 p-4"
        >
          {loading && !logs ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              <span className="ml-2 text-gray-400">Loading logs...</span>
            </div>
          ) : logs ? (
            <>
              <pre className="whitespace-pre-wrap leading-relaxed">
                {logs}
              </pre>
              <div ref={logsEndRef} />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <div className="text-gray-600 dark:text-gray-500 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No logs available</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Start the log stream or refresh to fetch recent logs
                </p>
                <Button onClick={startLogStream} disabled={loading} size="sm">
                  <FaPlay className="w-4 h-4 mr-2" />
                  Start Log Stream
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
