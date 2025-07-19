'use client';

import React, { useEffect, useState, useRef } from 'react';
import ComponentCard from '@/components/common/ComponentCard';
import Badge from '@/components/ui/badge/Badge';
import { FaFile, FaGithub } from 'react-icons/fa6';
import Link from 'next/link';

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

interface DeploymentQueueProps {
  refreshInterval?: number;
}

export default function DeploymentQueue({ refreshInterval = 1000 }: DeploymentQueueProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const logsEndRef = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const fetchQueue = async () => {
    try {
      const response = await fetch('/api/deployment-queue');
      const data = await response.json();
      
      if (data.success) {
        const newQueue = data.data.queue;
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
        
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch queue');
      }
    } catch (err) {
      setError('Failed to fetch deployment queue');
      console.error('Error fetching queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    
    const interval = setInterval(fetchQueue, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Auto-scroll to bottom of logs when they update
  useEffect(() => {
    queue.forEach((item) => {
      if (expandedLogs.has(item.id) && logsEndRef.current[item.id] && item.status === 'building') {
        logsEndRef.current[item.id]?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }, [queue, expandedLogs]);

  const toggleLogs = (id: number) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
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
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {expandedLogs.has(item.id) ? 'Hide Logs' : 'Show Logs'}
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
                      Build Logs {item.status === 'building' && (
                        <span className="ml-2 inline-flex items-center">
                          <div className="animate-pulse h-2 w-2 bg-green-400 rounded-full mr-1"></div>
                          <span className="text-xs text-green-400">Live</span>
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
