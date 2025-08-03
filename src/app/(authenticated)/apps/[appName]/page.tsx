'use client';

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import Alert from "@/components/ui/alert/Alert";
import { IoMdArrowBack } from "react-icons/io";
import { useSocketContext } from "@/context/SocketContext";
import { App as AppDetails, ServiceStatus } from "@/lib/models";
import { Modal } from "@/components/ui/modal";
import InputField from "@/components/form/input/InputField";
import Label from "@/components/form/Label";

interface EnvVar {
  id: number;
  app_id: number;
  key: string;
  value: string;
  created_at: string;
}

export default function AppDetailPage() {
  const router = useRouter();
  const params = useParams();
  const appName = decodeURIComponent(params.appName as string);
  const { socket } = useSocketContext();

  const [appDetails, setAppDetails] = useState<AppDetails | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Environment variables state
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [editingEnvVar, setEditingEnvVar] = useState<EnvVar | null>(null);
  const [envFormData, setEnvFormData] = useState({ key: '', value: '' });
  const [envLoading, setEnvLoading] = useState(false);

  const fetchAppData = async () => {
    if (!socket) return;

    try {
      setError(null);
      
      // Fetch app details from database
      const appResponse = await socket.emitWithAck('app:get', { appName });
      
      if (appResponse.success && appResponse.data.app) {
        setAppDetails(appResponse.data.app);
      } else {
        setError(`Application "${appName}" not found`);
        return;
      }

      // Fetch systemctl service status
      const statusResponse = await socket.emitWithAck('systemctl:status', { appName });
      
      if (statusResponse.success) {
        setServiceStatus(statusResponse.data.status);
      }

      // Fetch logs
      const logsResponse = await socket.emitWithAck('systemctl:logs', {
        appName,
        lines: 100
      });
      
      if (logsResponse.success) {
        setLogs(logsResponse.data.logs || '');
      }

      // Fetch environment variables
      const envResponse = await socket.emitWithAck('app:env:list', { appName });
      
      if (envResponse.success) {
        setEnvVars(envResponse.data.envVars || []);
      }

    } catch (err) {
      setError('Failed to fetch application data');
      console.error('Error fetching app data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (socket) {
      fetchAppData();
    }
  }, [socket, appName]);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const executeAction = async (action: string, eventName: string, successMessage: string) => {
    if (!socket) return;

    try {
      setActionLoading(action);
      setError(null);
      
      const response = await socket.emitWithAck(eventName, { appName });
      
      if (response.success) {
        setSuccess(successMessage);
        // Refresh data after action
        setTimeout(fetchAppData, 1000);
      } else {
        setError(response.error || `Failed to ${action} application`);
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

    if (!socket) return;

    try {
      setActionLoading('delete');
      setError(null);
      
      const response = await socket.emitWithAck('app:delete', { appName });
      
      if (response.success) {
        setSuccess('Application deleted successfully');
        router.push('/apps');
      } else {
        setError(response.error || 'Failed to delete application');
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

    if (!socket) return;

    try {
      setActionLoading('redeploy');
      setError(null);
      
      const response = await socket.emitWithAck('deploy:redeploy', { appName });
      
      if (response.success) {
        const queueInfo = response.data;
        setSuccess(`Redeploy queued successfully! Queue ID: ${queueInfo.queueId}. ${queueInfo.message}`);
      } else {
        setError(response.error || 'Failed to queue redeploy');
      }
    } catch (err) {
      setError('Failed to redeploy application');
      console.error('Error redeploying app:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'error';
      case 'failed':
        return 'error';
      case 'unknown':
        return 'light';
      default:
        return 'light';
    }
  };

  // Environment variable management functions
  const openEnvModal = (envVar?: EnvVar) => {
    if (envVar) {
      setEditingEnvVar(envVar);
      setEnvFormData({ key: envVar.key, value: envVar.value });
    } else {
      setEditingEnvVar(null);
      setEnvFormData({ key: '', value: '' });
    }
    setShowEnvModal(true);
  };

  const closeEnvModal = () => {
    setShowEnvModal(false);
    setEditingEnvVar(null);
    setEnvFormData({ key: '', value: '' });
  };

  const handleEnvFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEnvFormData(prev => ({ ...prev, [name]: value }));
  };

  const saveEnvVar = async () => {
    if (!socket || !envFormData.key.trim()) return;

    try {
      setEnvLoading(true);
      setError(null);

      const eventName = editingEnvVar ? 'app:env:set' : 'app:env:add';
      const response = await socket.emitWithAck(eventName, {
        appName,
        key: envFormData.key.trim(),
        value: envFormData.value
      });

      if (response.success) {
        setSuccess(editingEnvVar ? 'Environment variable updated successfully' : 'Environment variable added successfully');
        closeEnvModal();
        
        // Refresh environment variables
        const envResponse = await socket.emitWithAck('app:env:list', { appName });
        if (envResponse.success) {
          setEnvVars(envResponse.data.envVars || []);
        }
      } else {
        setError(response.error || `Failed to ${editingEnvVar ? 'update' : 'add'} environment variable`);
      }
    } catch (err) {
      setError(`Failed to ${editingEnvVar ? 'update' : 'add'} environment variable`);
      console.error('Error saving env var:', err);
    } finally {
      setEnvLoading(false);
    }
  };

  const deleteEnvVar = async (key: string) => {
    if (!confirm(`Are you sure you want to delete the environment variable "${key}"?`)) {
      return;
    }

    if (!socket) return;

    try {
      setEnvLoading(true);
      setError(null);

      const response = await socket.emitWithAck('app:env:delete', {
        appName,
        key
      });

      if (response.success) {
        setSuccess('Environment variable deleted successfully');
        
        // Refresh environment variables
        const envResponse = await socket.emitWithAck('app:env:list', { appName });
        if (envResponse.success) {
          setEnvVars(envResponse.data.envVars || []);
        }
      } else {
        setError(response.error || 'Failed to delete environment variable');
      }
    } catch (err) {
      setError('Failed to delete environment variable');
      console.error('Error deleting env var:', err);
    } finally {
      setEnvLoading(false);
    }
  };

  if (loading || !socket) {
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
          <span className="ml-2 text-gray-600 dark:text-gray-400">
            {!socket ? 'Connecting to server...' : 'Loading application details...'}
          </span>
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
                  color={getStatusBadgeColor(serviceStatus?.status || 'unknown')}
                  variant="light"
                  size="sm"
                >
                  {serviceStatus?.status || 'unknown'}
                </Badge>
                <span className="text-sm text-gray-500 dark:text-gray-400">ID: {appDetails.id}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">Runtime: {appDetails.runtime}</span>
                {serviceStatus?.enabled && (
                  <Badge color="info" variant="light" size="sm">
                    Auto-start
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
        <Button
          onClick={fetchAppData}
          disabled={!socket || loading}
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

      {success && (
        <Alert
          variant="success"
          title="Success"
          message={success}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Application Info */}
        <ComponentCard title="Application Info" desc="Current configuration and service details">
          {appDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Service Status</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {serviceStatus?.status || 'unknown'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Auto-start</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {serviceStatus?.enabled ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Runtime</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                    {appDetails.runtime}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Branch</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {appDetails.branch}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 space-y-3">
                {appDetails.repository_url && (
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Repository</div>
                    <div className="text-sm font-mono text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
                      {appDetails.repository_url}
                    </div>
                  </div>
                )}
                
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Start Command</div>
                  <div className="text-sm font-mono text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
                    {appDetails.start_command}
                  </div>
                </div>
                
                {appDetails.install_command && (
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Install Command</div>
                    <div className="text-sm font-mono text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
                      {appDetails.install_command}
                    </div>
                  </div>
                )}
                
                {appDetails.build_command && (
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Build Command</div>
                    <div className="text-sm font-mono text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
                      {appDetails.build_command}
                    </div>
                  </div>
                )}
                
                {serviceStatus?.cwd && (
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Working Directory</div>
                    <div className="text-sm font-mono text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
                      {serviceStatus.cwd}
                    </div>
                  </div>
                )}
                
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Created At</div>
                  <div className="text-sm text-gray-900 dark:text-white">{formatDate(appDetails.created_at)}</div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Last Updated</div>
                  <div className="text-sm text-gray-900 dark:text-white">{formatDate(appDetails.updated_at)}</div>
                </div>
              </div>
            </div>
          )}
        </ComponentCard>

        {/* Enhanced Service Status */}
        {serviceStatus && (
          <ComponentCard title="Service Details" desc="Detailed systemctl service information">
            <div className="space-y-4">
              {serviceStatus.loaded && (
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Service Configuration</div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">State:</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{serviceStatus.loaded.state}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Path:</span>
                      <span className="text-sm font-mono text-gray-900 dark:text-white">{serviceStatus.loaded.path}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Enabled:</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{serviceStatus.loaded.enabled}</span>
                    </div>
                  </div>
                </div>
              )}

              {serviceStatus.active && (
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Active Status</div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">State:</span>
                      <Badge color={serviceStatus.active.state === 'active' ? 'success' : 'error'} size="sm">
                        {serviceStatus.active.state}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Sub-state:</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{serviceStatus.active.subState}</span>
                    </div>
                    {serviceStatus.active.since && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Since:</span>
                        <span className="text-sm text-gray-900 dark:text-white">{serviceStatus.active.since}</span>
                      </div>
                    )}
                    {serviceStatus.active.duration && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Duration:</span>
                        <span className="text-sm text-gray-900 dark:text-white">{serviceStatus.active.duration}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {serviceStatus.mainPid && (
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Main Process</div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">PID:</span>
                      <span className="text-sm font-mono text-gray-900 dark:text-white">{serviceStatus.mainPid.pid}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Command:</span>
                      <span className="text-sm font-mono text-gray-900 dark:text-white truncate ml-2">{serviceStatus.mainPid.command}</span>
                    </div>
                  </div>
                </div>
              )}

              {(serviceStatus.memory || serviceStatus.cpu || serviceStatus.tasks) && (
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resource Usage</div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg space-y-2">
                    {serviceStatus.memory && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Memory (Current):</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{serviceStatus.memory.current}</span>
                        </div>
                        {serviceStatus.memory.peak && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Memory (Peak):</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{serviceStatus.memory.peak}</span>
                          </div>
                        )}
                      </>
                    )}
                    {serviceStatus.cpu && serviceStatus.cpu.usage && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">CPU Time:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{serviceStatus.cpu.usage}</span>
                      </div>
                    )}
                    {serviceStatus.tasks && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Tasks:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{serviceStatus.tasks.current} / {serviceStatus.tasks.limit}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {serviceStatus.cgroup && serviceStatus.cgroup.processes && serviceStatus.cgroup.processes.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Process Tree</div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {serviceStatus.cgroup.processes.map((process, index) => (
                        <div key={index} className="flex justify-between text-xs">
                          <span className="font-mono text-gray-600 dark:text-gray-400">{process.pid}</span>
                          <span className="font-mono text-gray-900 dark:text-white truncate ml-2">{process.command}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ComponentCard>
        )}

        {/* Environment Variables */}
        <ComponentCard title="Environment Variables" desc="Manage application environment variables">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Configure environment variables for your application
              </p>
              <Button
                onClick={() => openEnvModal()}
                disabled={envLoading}
                variant="primary"
                size="sm"
              >
                Add Variable
              </Button>
            </div>

            {envVars.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No environment variables configured</p>
                <Button
                  onClick={() => openEnvModal()}
                  disabled={envLoading}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  Add Your First Variable
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {envVars.map((envVar) => (
                  <div
                    key={envVar.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {envVar.key}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          =
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                          {envVar.value.length > 50 ? `${envVar.value.substring(0, 50)}...` : envVar.value}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-2">
                      <Button
                        onClick={() => openEnvModal(envVar)}
                        disabled={envLoading}
                        variant="outline"
                        size="sm"
                      >
                        Edit
                      </Button>
                      <Button
                        onClick={() => deleteEnvVar(envVar.key)}
                        disabled={envLoading}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ComponentCard>

        {/* Actions */}
        <ComponentCard title="Actions" desc="Manage your application">
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => executeAction('start', 'systemctl:start', 'Service started successfully')}
              disabled={!socket || actionLoading === 'start' || serviceStatus?.status === 'active'}
              variant="primary"
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-300"
            >
              {actionLoading === 'start' ? 'Starting...' : 'Start'}
            </Button>
            <Button
              onClick={() => executeAction('stop', 'systemctl:stop', 'Service stopped successfully')}
              disabled={!socket || actionLoading === 'stop' || serviceStatus?.status === 'inactive'}
              variant="primary"
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-300"
            >
              {actionLoading === 'stop' ? 'Stopping...' : 'Stop'}
            </Button>
            <Button
              onClick={() => executeAction('restart', 'systemctl:restart', 'Service restarted successfully')}
              disabled={!socket || actionLoading === 'restart'}
              variant="primary"
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300"
            >
              {actionLoading === 'restart' ? 'Restarting...' : 'Restart'}
            </Button>
            <Button
              onClick={() => executeAction('enable', 'systemctl:enable', 'Auto-start enabled successfully')}
              disabled={!socket || actionLoading === 'enable' || serviceStatus?.enabled}
              variant="primary"
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
            >
              {actionLoading === 'enable' ? 'Enabling...' : 'Enable Auto-start'}
            </Button>
            <Button
              onClick={() => executeAction('disable', 'systemctl:disable', 'Auto-start disabled successfully')}
              disabled={!socket || actionLoading === 'disable' || !serviceStatus?.enabled}
              variant="primary"
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-300"
            >
              {actionLoading === 'disable' ? 'Disabling...' : 'Disable Auto-start'}
            </Button>
            <Button
              onClick={fetchAppData}
              disabled={!socket || loading}
              variant="primary"
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300"
            >
              {loading ? 'Refreshing...' : 'Refresh Status'}
            </Button>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <Button
              onClick={redeployApp}
              disabled={!socket || actionLoading === 'redeploy'}
              variant="primary"
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300"
            >
              {actionLoading === 'redeploy' ? 'Redeploying...' : 'Redeploy from Git'}
            </Button>
            <Button
              onClick={deleteApp}
              disabled={!socket || actionLoading === 'delete'}
              variant="primary"
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300"
            >
              {actionLoading === 'delete' ? 'Deleting...' : 'Delete Application'}
            </Button>
          </div>
        </ComponentCard>
      </div>

      {/* Logs */}
      <ComponentCard title="Service Logs" desc="Real-time systemctl service output (journalctl)">
        <div ref={el => { if (el) el.scrollTop = el.scrollHeight; }} className="bg-black text-green-400 font-mono text-sm p-4 rounded-lg h-96 overflow-y-auto">
          {logs ? (
            <pre className="whitespace-pre-wrap">{logs}</pre>
          ) : (
            <div className="text-gray-500">No logs available</div>
          )}
        </div>
      </ComponentCard>

      {/* Environment Variable Modal */}
      <Modal
        isOpen={showEnvModal}
        onClose={closeEnvModal}
      >
        <div className="space-y-4">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingEnvVar ? 'Edit Environment Variable' : 'Add Environment Variable'}
            </h3>
          </div>

          <div>
            <Label htmlFor="env-key">Variable Name</Label>
            <input
              id="env-key"
              name="key"
              type="text"
              value={envFormData.key}
              onChange={handleEnvFormChange}
              placeholder="e.g., NODE_ENV, DATABASE_URL"
              disabled={envLoading || !!editingEnvVar}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
            />
            {editingEnvVar && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Variable name cannot be changed when editing
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="env-value">Variable Value</Label>
            <input
              id="env-value"
              name="value"
              type="text"
              value={envFormData.value}
              onChange={handleEnvFormChange}
              placeholder="Enter the value"
              disabled={envLoading}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              onClick={closeEnvModal}
              disabled={envLoading}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={saveEnvVar}
              disabled={envLoading || !envFormData.key.trim()}
              variant="primary"
            >
              {envLoading 
                ? (editingEnvVar ? 'Updating...' : 'Adding...') 
                : (editingEnvVar ? 'Update Variable' : 'Add Variable')
              }
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
