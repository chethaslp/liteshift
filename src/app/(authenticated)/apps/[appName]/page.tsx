'use client';

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import Alert from "@/components/ui/alert/Alert";
import { FaBackward } from "react-icons/fa";
import { LuSendToBack } from "react-icons/lu";
import { IoMdArrowBack } from "react-icons/io";

interface AppDetails {
  pm_id: number;
  name: string;
  status: string;
  pid?: number;
  cpu: number;
  memory: number;
  uptime: number;
  restarts: number;
  unstable_restarts: number;
  created_at: number;
  pm2_env?: {
    PM2_HOME: string;
    status: string;
    restart_time: number;
    unstable_restarts: number;
    created_at: number;
    pm_uptime: number;
    axm_options?: any;
    instances?: number;
    exec_mode?: string;
    watch?: boolean;
    pm_exec_path?: string;
    pm_cwd?: string;
    exec_interpreter?: string;
    pm_out_log_path?: string;
    pm_err_log_path?: string;
    pm_log_path?: string;
    node_args?: string[];
    args?: string[];
    env?: Record<string, string>;
  };
}

interface AppDescription {
  pid: number;
  name: string;
  pm2_env: {
    status: string;
    restart_time: number;
    unstable_restarts: number;
    created_at: number;
    pm_uptime: number;
    pm_id: number;
    instances: number;
    exec_mode: string;
    watch: boolean;
    pm_exec_path: string;
    pm_cwd: string;
    exec_interpreter: string;
    pm_out_log_path: string;
    pm_err_log_path: string;
    pm_log_path: string;
    node_args: string[];
    args: string[];
    env: Record<string, string>;
  };
  monit: {
    memory: number;
    cpu: number;
  };
}

export default function AppDetailPage() {
  const router = useRouter();
  const params = useParams();
  const appName = decodeURIComponent(params.appName as string);

  const [appDetails, setAppDetails] = useState<AppDetails | null>(null);
  const [appDescription, setAppDescription] = useState<AppDescription | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchAppData = async () => {
    try {
      // Fetch basic app info
      const listResponse = await fetch('/api/pm2?action=list');
      const listData = await listResponse.json();
      
      if (listData.success) {
        const app = listData.data.find((app: AppDetails) => app.name === appName);
        if (app) {
          setAppDetails(app);
        } else {
          setError(`Application "${appName}" not found`);
          return;
        }
      }

      // Fetch logs
      const logsResponse = await fetch(`/api/pm2?action=logs&appName=${encodeURIComponent(appName)}&lines=100`);
      const logsData = await logsResponse.json();
      
      if (logsData.success) {
        setLogs(logsData.data.logs);
      }

      setError(null);
    } catch (err) {
      setError('Failed to fetch application data');
      console.error('Error fetching app data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppData();
  }, [appName]);

  const executeAction = async (action: string) => {
    try {
      setActionLoading(action);
      
      const response = await fetch('/api/pm2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          appName
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Refresh data after action
        setTimeout(fetchAppData, 1000);
      } else {
        setError(data.error || `Failed to ${action} application`);
      }
    } catch (err) {
      setError(`Failed to ${action} application`);
      console.error(`Error ${action}ing app:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteApp = async () => {
    if (!confirm(`Are you sure you want to delete "${appName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setActionLoading('delete');
      
      const response = await fetch(`/api/pm2?appName=${encodeURIComponent(appName)}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        router.push('/apps');
      } else {
        setError(data.error || 'Failed to delete application');
      }
    } catch (err) {
      setError('Failed to delete application');
      console.error('Error deleting app:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const redeployApp = async () => {
    if (!confirm(`Are you sure you want to redeploy "${appName}"? This will restart the application with the latest code.`)) {
      return;
    }

    try {
      setActionLoading('redeploy');
      
      const response = await fetch('/api/manager', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'redeploy',
          appName
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        const queueInfo = data.data;
        alert(`Redeploy queued successfully! Queue ID: ${queueInfo.queueId}\n\n${queueInfo.message}\n\nThe application will be redeployed shortly. You can monitor the status from the main apps page.`);
        // Don't refresh immediately, wait for deployment to complete
      } else {
        setError(data.error || 'Failed to queue redeploy');
      }
    } catch (err) {
      setError('Failed to redeploy application');
      console.error('Error redeploying app:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatMemory = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const formatUptime = (ms: number) => {
    if (!ms) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'success';
      case 'stopped':
        return 'error';
      case 'stopping':
      case 'starting':
        return 'warning';
      case 'errored':
        return 'error';
      default:
        return 'light';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => router.back()}
              variant="outline"
              size="sm"
            >
                <IoMdArrowBack size={15} />
                Back
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Loading...</h1>
          </div>
        </div>
        <div className="flex items-center flex-col justify-center h-64">
          <div className="animate-spin rounded-full mb-2 h-8 w-8 border-b-2 border-brand-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading application details...</span>
        </div>
      </div>
    );
  }

  if (error && !appDetails) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => router.back()}
              variant="outline"
              size="sm"
            >
              <IoMdArrowBack size={15} />
                Back
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Error</h1>
          </div>
        </div>
        <Alert
          variant="error"
          title="Error"
          message={error}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
          >
            <IoMdArrowBack size={15} />
                Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{appName}</h1>
            {appDetails && (
              <div className="flex items-center space-x-2 mt-1">
                <Badge 
                  color={getStatusBadgeColor(appDetails.status)}
                  variant="light"
                  size="sm"
                >
                  {appDetails.status}
                </Badge>
                <span className="text-sm text-gray-500 dark:text-gray-400">ID: {appDetails.pm_id}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">PID: {appDetails.pid}</span>
              </div>
            )}
          </div>
        </div>
        <Button
          onClick={fetchAppData}
          disabled={loading}
          variant="primary"
        >
          Refresh
        </Button>
      </div>

      {error && (
        <Alert
          variant="error"
          title="Error"
          message={error}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Application Info */}
        <ComponentCard title="Application Info" desc="Current status and performance metrics">
          {appDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">CPU Usage</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{appDetails.cpu.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Memory Usage</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{formatMemory(appDetails.memory)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Uptime</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{formatUptime(appDetails.uptime)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Restarts</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{appDetails.restarts}</div>
                </div>
              </div>
              
              {appDescription && (
                <div className="mt-6 space-y-3">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Execution Path</div>
                    <div className="text-sm font-mono text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
                      {appDescription.pm2_env.pm_exec_path}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Working Directory</div>
                    <div className="text-sm font-mono text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
                      {appDescription.pm2_env.pm_cwd}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Execution Mode</div>
                    <div className="text-sm text-gray-900 dark:text-white">{appDescription.pm2_env.exec_mode}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Instances</div>
                    <div className="text-sm text-gray-900 dark:text-white">{appDescription.pm2_env.instances}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Created At</div>
                    <div className="text-sm text-gray-900 dark:text-white">{formatDate(appDescription.pm2_env.created_at)}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ComponentCard>

        {/* Actions */}
        <ComponentCard title="Actions" desc="Manage your application">
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => executeAction('start')}
              disabled={actionLoading === 'start' || appDetails?.status === 'online'}
              variant="primary"
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-300"
            >
              {actionLoading === 'start' ? 'Starting...' : 'Start'}
            </Button>
            <Button
              onClick={() => executeAction('stop')}
              disabled={actionLoading === 'stop' || appDetails?.status === 'stopped'}
              variant="primary"
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-300"
            >
              {actionLoading === 'stop' ? 'Stopping...' : 'Stop'}
            </Button>
            <Button
              onClick={() => executeAction('restart')}
              disabled={actionLoading === 'restart'}
              variant="primary"
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300"
            >
              {actionLoading === 'restart' ? 'Restarting...' : 'Restart'}
            </Button>
            <Button
              onClick={() => executeAction('reload')}
              disabled={actionLoading === 'reload'}
              variant="primary"
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-300"
            >
              {actionLoading === 'reload' ? 'Reloading...' : 'Reload'}
            </Button>
            <Button
              onClick={() => executeAction('reset')}
              disabled={actionLoading === 'reset'}
              variant="primary"
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
            >
              {actionLoading === 'reset' ? 'Resetting...' : 'Reset Stats'}
            </Button>
            <Button
              onClick={() => executeAction('flush')}
              disabled={actionLoading === 'flush'}
              variant="primary"
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300"
            >
              {actionLoading === 'flush' ? 'Flushing...' : 'Flush Logs'}
            </Button>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <Button
              onClick={redeployApp}
              disabled={actionLoading === 'redeploy'}
              variant="primary"
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300"
            >
              {actionLoading === 'redeploy' ? 'Redeploying...' : 'Redeploy from Git'}
            </Button>
            <Button
              onClick={deleteApp}
              disabled={actionLoading === 'delete'}
              variant="primary"
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300"
            >
              {actionLoading === 'delete' ? 'Deleting...' : 'Delete Application'}
            </Button>
          </div>
        </ComponentCard>
      </div>

      {/* Logs */}
      <ComponentCard title="Application Logs" desc="Real-time application output">
        <div className="bg-black text-green-400 font-mono text-sm p-4 rounded-lg h-96 overflow-y-auto">
          {logs ? (
            <pre className="whitespace-pre-wrap">{logs}</pre>
          ) : (
            <div className="text-gray-500">No logs available</div>
          )}
        </div>
      </ComponentCard>
    </div>
  );
}
