'use client';

import React, { useEffect, useState, useRef } from 'react';
import ComponentCard from '@/components/common/ComponentCard';
import Badge from '@/components/ui/badge/Badge';
import { FaFile, FaGithub } from 'react-icons/fa6';
import Link from 'next/link';
import { useSocketContext } from '@/context/SocketContext';

interface QueueItem {
  id: number;
  app_name: string;
  type: string;
  status: string;
  logs?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}


export default function DeploymentQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [streamingLogs, setStreamingLogs] = useState<Set<number>>(new Set());
  const logsEndRef = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const { socket } = useSocketContext();

  const fetchQueue = async () => {
    if (!socket) return;
    
    try {
      const response = await socket.emitWithAck("deploy:queue-status", {});
      
      if (response.success) {
        const newQueue = response.data;
        setQueue(newQueue);
        
        // Auto-expand logs for building deployments
        setExpandedLogs(prev => {
          const newSet = new Set(prev);
          newQueue.forEach((item: QueueItem) => {
            if (item.status === 'building' && item.logs) {
              newSet.add(item.id);
            }
          });
          return newSet;
        });
        
        // Start streaming logs for building deployments
        newQueue.forEach((item: QueueItem) => {
          if (item.status === 'building' && !streamingLogs.has(item.id)) {
            startLogStreaming(item.id);
          }
        });
        
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch queue');
      }
    } catch (err) {
      setError('Failed to fetch deployment queue');
      console.error('Error fetching queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const startLogStreaming = async (queueId: number) => {
    if (!socket || streamingLogs.has(queueId)) return;
    
    try {
      const response = await socket.emitWithAck("deploy:stream-logs", { queueId });
      if (response.success) {
        setStreamingLogs(prev => new Set(prev).add(queueId));
      }
    } catch (err) {
      console.error('Error starting log stream:', err);
    }
  };

  const stopLogStreaming = async (queueId: number) => {
    if (!socket || !streamingLogs.has(queueId)) return;
    
    try {
      const response = await socket.emitWithAck("deploy:stop-stream", { queueId });
      if (response.success) {
        setStreamingLogs(prev => {
          const newSet = new Set(prev);
          newSet.delete(queueId);
          return newSet;
        });
      }
    } catch (err) {
      console.error('Error stopping log stream:', err);
    }
  };

  useEffect(() => {
    if (!socket) return;

    fetchQueue();
    
    // Set up socket event listeners
    socket.on("deploy:log-stream", (data: { queueId: number; status: string; logs: string; timestamp: string }) => {
      setQueue(prev => 
        prev.map(item => 
          item.id === data.queueId 
            ? { ...item, logs: data.logs, status: data.status }
            : item
        )
      );
    });

    socket.on("deploy:log-stream-end", (data: { queueId: number; finalStatus: string }) => {
      setQueue(prev => 
        prev.map(item => 
          item.id === data.queueId 
            ? { ...item, status: data.finalStatus }
            : item
        )
      );
      
      // Stop streaming for completed deployments
      setStreamingLogs(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.queueId);
        return newSet;
      });
    });
    
    
    return () => {

      // Clean up socket listeners
      socket.off("deploy:log-stream");
      socket.off("deploy:log-stream-end");
      
      // Stop all active log streams - use current state
      setStreamingLogs(currentStreaming => {
        currentStreaming.forEach(queueId => {
          socket.emitWithAck("deploy:stop-stream", { queueId }).catch(err => 
            console.error('Error stopping log stream during cleanup:', err)
          );
        });
        return new Set();
      });
    };
  }, [socket]);

  // Auto-scroll to bottom of logs when they update
  useEffect(() => {
    queue.forEach((item) => {
      if (expandedLogs.has(item.id) && logsEndRef.current[item.id] && item.status === 'building') {
        // logsEndRef.current[item.id]?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }, [queue, expandedLogs]);

  const toggleLogs = async (id: number) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
        // Stop streaming when logs are collapsed
        stopLogStreaming(id);
      } else {
        newSet.add(id);
        // Start streaming when logs are expanded for building deployments
        const item = queue.find(q => q.id === id);
        if (item && item.status === 'building') {
          startLogStreaming(id);
        }
      }
      return newSet;
    });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'building':
        return 'warning';
      case 'queued':
        return 'light';
      default:
        return 'light';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <ComponentCard title="Deployment Queue" desc="Current deployment queue status">
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500 dark:text-gray-400">Loading queue...</div>
        </div>
      </ComponentCard>
    );
  }

  if (error) {
    return (
      <ComponentCard title="Deployment Queue" desc="Current deployment queue status">
        <div className="flex items-center justify-center py-8">
          <div className="text-red-500 dark:text-red-400">Error: {error}</div>
        </div>
      </ComponentCard>
    );
  }

  if (queue.length === 0) {
    return (
      <ComponentCard title="Deployment Queue" desc="Current deployment queue status">
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500 dark:text-gray-400">No deployments in queue</div>
        </div>
      </ComponentCard>
    );
  }

  return (
    <ComponentCard title="Deployment Queue" desc="Current deployment queue status">
      <div className="space-y-4">
        {queue.map((item) => (
          <div 
            key={item.id}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <Link href={`/apps/${item.app_name}`}>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {item.app_name}
                  </span>
                </Link>
                <Badge color={getStatusBadgeColor(item.status)} size="sm">
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Badge>
                <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                  {item.type == "git"? <FaGithub/> : <FaFile/>}
                </span>
                {/* Show logs toggle button for building or failed deployments with logs */}
                {(item.status === 'building' || item.status === 'failed') && item.logs && (
                  <button
                    onClick={() => toggleLogs(item.id)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {expandedLogs.has(item.id) ? 'Hide Logs' : 'Show Logs'}
                    {streamingLogs.has(item.id) && (
                      <div className="animate-pulse h-2 w-2 bg-green-400 rounded-full"></div>
                    )}
                  </button>
                )}
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Queue ID: {item.id}
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Created:</span>
                <div className="text-gray-900 dark:text-white">{formatDate(item.created_at)}</div>
              </div>
              
              {item.started_at && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Started:</span>
                  <div className="text-gray-900 dark:text-white">{formatDate(item.started_at)}</div>
                </div>
              )}
              
              {item.completed_at && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Completed:</span>
                  <div className="text-gray-900 dark:text-white">{formatDate(item.completed_at)}</div>
                </div>
              )}
            </div>
            
            {/* Build Logs Display */}
            {expandedLogs.has(item.id) && item.logs && (
              <div className="mt-3 bg-gray-900 dark:bg-gray-950 rounded border border-gray-600 dark:border-gray-700">
                <div className={`px-3 py-2 ${item.status == "failed" ? "bg-red-600" : "bg-gray-800 dark:bg-gray-900"} border-b border-gray-600 dark:border-gray-700 rounded-t`}>
                  <div className={`flex items-center justify-between`}>
                    <span className="text-sm font-medium text-gray-200 dark:text-gray-300">
                      Build Logs {(item.status === 'building' && streamingLogs.has(item.id)) && (
                        <span className="ml-2 inline-flex items-center">
                          <div className="animate-pulse h-2 w-2 bg-green-400 rounded-full mr-1"></div>
                          <span className="text-xs text-green-400">Streaming</span>
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => toggleLogs(item.id)}
                      className="text-xs text-gray-400 hover:text-gray-200"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div 
                  className="deployment-logs p-3 text-sm text-gray-100 dark:text-gray-200 font-mono overflow-y-auto max-h-80 whitespace-pre-wrap"
                >
                  {item.logs}
                  <div 
                    ref={(el) => {
                      if (logsEndRef.current) {
                        logsEndRef.current[item.id] = el;
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </ComponentCard>
  );
}
