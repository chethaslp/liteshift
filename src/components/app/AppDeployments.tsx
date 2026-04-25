'use client';

import React, { useEffect, useState, useRef } from 'react';
import ComponentCard from '@/components/common/ComponentCard';
import Badge from '@/components/ui/badge/Badge';
import Button from '@/components/ui/button/Button';
import { FaFile, FaGithub, FaPlay, FaStop, FaEye, FaEyeSlash } from 'react-icons/fa6';
import { useSocketContext } from '@/context/SocketContext';

interface Deployment {
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

interface AppDeploymentsProps {
  appName: string;
}

export default function AppDeployments({ appName }: AppDeploymentsProps) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [streamingLogs, setStreamingLogs] = useState<Set<number>>(new Set());
  const logsEndRef = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const { socket } = useSocketContext();

  const fetchDeployments = async () => {
    if (!socket) return;
    
    try {
      setLoading(true);
      // Use existing deploy:logs API to get deployment logs for this app
      const response = await socket.emitWithAck("deploy:logs", { appName, limit: 50 });
      
      if (response.success) {
        const deploymentLogs = response.data.logs;
        // Transform the logs into deployment objects
        const newDeployments = deploymentLogs.map((log: any) => ({
          id: log.id,
          app_name: appName,
          type: 'git', // We'll need to store this in the backend
          status: log.status,
          logs: log.logs,
          created_at: log.created_at,
          // These fields may need to be added to the backend
          started_at: log.started_at,
          completed_at: log.completed_at,
          error_message: log.error_message
        }));
        
        setDeployments(newDeployments);
        
        // Auto-expand logs for building deployments
        setExpandedLogs(prev => {
          const newSet = new Set(prev);
          newDeployments.forEach((deployment: Deployment) => {
            if (deployment.status === 'building' && deployment.logs) {
              newSet.add(deployment.id);
            }
          });
          return newSet;
        });
        
        // Start streaming logs for building deployments
        newDeployments.forEach((deployment: Deployment) => {
          if (deployment.status === 'building' && !streamingLogs.has(deployment.id)) {
            startLogStreaming(deployment.id);
          }
        });
        
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch deployments');
      }
    } catch (err) {
      setError('Failed to fetch deployments');
      console.error('Error fetching deployments:', err);
    } finally {
      setLoading(false);
    }
  };

  const startLogStreaming = async (deploymentId: number) => {
    if (!socket || streamingLogs.has(deploymentId)) return;
    
    try {
      const response = await socket.emitWithAck("deploy:stream-logs", { queueId: deploymentId });
      if (response.success) {
        setStreamingLogs(prev => new Set(prev).add(deploymentId));
      }
    } catch (err) {
      console.error('Error starting log stream:', err);
    }
  };

  const stopLogStreaming = async (deploymentId: number) => {
    if (!socket || !streamingLogs.has(deploymentId)) return;
    
    try {
      const response = await socket.emitWithAck("deploy:stop-stream", { queueId: deploymentId });
      if (response.success) {
        setStreamingLogs(prev => {
          const newSet = new Set(prev);
          newSet.delete(deploymentId);
          return newSet;
        });
      }
    } catch (err) {
      console.error('Error stopping log stream:', err);
    }
  };

  useEffect(() => {
    if (!socket) return;

    fetchDeployments();
    
    // Set up socket event listeners
    socket.on("deploy:log-stream", (data: { queueId: number; status: string; logs: string; timestamp: string }) => {
      setDeployments(prev => 
        prev.map(deployment => 
          deployment.id === data.queueId 
            ? { ...deployment, logs: data.logs, status: data.status }
            : deployment
        )
      );
    });

    socket.on("deploy:log-stream-end", (data: { queueId: number; finalStatus: string }) => {
      setDeployments(prev => 
        prev.map(deployment => 
          deployment.id === data.queueId 
            ? { ...deployment, status: data.finalStatus }
            : deployment
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
      
      // Stop all active log streams
      streamingLogs.forEach(deploymentId => {
        socket.emitWithAck("deploy:stop-stream", { queueId: deploymentId }).catch(err => 
          console.error('Error stopping log stream during cleanup:', err)
        );
      });
    };
  }, [socket, appName]);

  const toggleLogs = async (id: number) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
        stopLogStreaming(id);
      } else {
        newSet.add(id);
        const deployment = deployments.find(d => d.id === id);
        if (deployment && deployment.status === 'building') {
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Deployments</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Deployment history for {appName}</p>
          </div>
          <Button onClick={fetchDeployments} disabled={loading} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading deployments...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Deployments</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Deployment history for {appName}</p>
          </div>
          <Button onClick={fetchDeployments} variant="outline" size="sm">
            Retry
          </Button>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-red-700 dark:text-red-400">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Deployments</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Deployment history for {appName} ({deployments.length} total)
          </p>
        </div>
        <Button onClick={fetchDeployments} disabled={loading} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {deployments.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-12">
          <div className="text-center">
            <div className="text-gray-400 dark:text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No deployments yet</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Deployments will appear here when you deploy your application
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {deployments.map((deployment) => (
            <div 
              key={deployment.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800">
                    {deployment.type === "git" ? <FaGithub className="w-5 h-5" /> : <FaFile className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Deployment #{deployment.id}
                      </h3>
                      <Badge color={getStatusBadgeColor(deployment.status)} size="sm">
                        {deployment.status.charAt(0).toUpperCase() + deployment.status.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {deployment.type === 'git' ? 'Git Repository' : 'File Upload'} • Created {formatDate(deployment.created_at)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {(deployment.status === 'building' || deployment.status === 'failed') && deployment.logs && (
                    <Button
                      onClick={() => toggleLogs(deployment.id)}
                      variant="outline"
                      size="sm"
                    >
                      {expandedLogs.has(deployment.id) ? (
                        <>
                          <FaEyeSlash className="w-4 h-4 mr-2" />
                          Hide Logs
                        </>
                      ) : (
                        <>
                          <FaEye className="w-4 h-4 mr-2" />
                          Show Logs
                        </>
                      )}
                      {streamingLogs.has(deployment.id) && (
                        <div className="ml-2 animate-pulse h-2 w-2 bg-green-400 rounded-full"></div>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <span className="text-gray-500 dark:text-gray-400 block">Created</span>
                  <div className="text-gray-900 dark:text-white font-medium">{formatDate(deployment.created_at)}</div>
                </div>
                
                {deployment.started_at && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <span className="text-gray-500 dark:text-gray-400 block">Started</span>
                    <div className="text-gray-900 dark:text-white font-medium">{formatDate(deployment.started_at)}</div>
                  </div>
                )}
                
                {deployment.completed_at && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <span className="text-gray-500 dark:text-gray-400 block">Completed</span>
                    <div className="text-gray-900 dark:text-white font-medium">{formatDate(deployment.completed_at)}</div>
                  </div>
                )}
              </div>
              
              {/* Build Logs Display */}
              {expandedLogs.has(deployment.id) && deployment.logs && (
                <div className="mt-4 bg-gray-900 dark:bg-gray-950 rounded-xl border border-gray-600 dark:border-gray-700 overflow-hidden">
                  <div className={`px-4 py-3 ${deployment.status === "failed" ? "bg-red-600" : "bg-gray-800 dark:bg-gray-900"} border-b border-gray-600 dark:border-gray-700`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-200 dark:text-gray-300">
                        Build Logs {(deployment.status === 'building' && streamingLogs.has(deployment.id)) && (
                          <span className="ml-2 inline-flex items-center">
                            <div className="animate-pulse h-2 w-2 bg-green-400 rounded-full mr-1"></div>
                            <span className="text-xs text-green-400">Live</span>
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => toggleLogs(deployment.id)}
                        className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div 
                    ref={el => { if (el) el.scrollTop = el.scrollHeight; }}
                    className="p-4 text-sm text-gray-100 dark:text-gray-200 font-mono overflow-y-auto max-h-80 whitespace-pre-wrap leading-relaxed"
                  >
                    {deployment.logs}
                    <div 
                      ref={(el) => {
                        if (logsEndRef.current) {
                          logsEndRef.current[deployment.id] = el;
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
