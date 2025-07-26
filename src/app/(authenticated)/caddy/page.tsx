'use client';

import React, { useEffect, useState } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import Alert from "@/components/ui/alert/Alert";
import { Modal } from "@/components/ui/modal";
import InputField from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { FaPlay, FaStop, FaRedo, FaPlus, FaTrash, FaCheck, FaTimes, FaExternalLinkAlt, FaSyncAlt } from "react-icons/fa";
import { useSocketContext } from "@/context/SocketContext";

interface CaddyStatus {
  running: boolean;
  status: any;
}

interface Domain {
  id: number;
  app_id: number;
  app_name: string;
  domain: string;
  is_primary: boolean;
  ssl_enabled: boolean;
  created_at: string;
}

interface App {
  name: string;
}

export default function CaddyPage() {
  const [status, setStatus] = useState<CaddyStatus | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [config, setConfig] = useState<string>('');
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddDomainModal, setShowAddDomainModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [configValid, setConfigValid] = useState<boolean | null>(null);

  // Form state for adding domain
  const [newDomain, setNewDomain] = useState({
    appName: '',
    domain: ''
  });

  const [apps, setApps] = useState<App[]>([]);
  const { socket } = useSocketContext();

  const fetchStatus = async () => {
    if (!socket) return;
    
    try {
      const response = await socket.emitWithAck('caddy:status', {});
      if (response.success) {
        setStatus(response.data);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch Caddy status');
      }
    } catch (err) {
      console.error('Error fetching Caddy status:', err);
    }
  };

  const fetchDomains = async () => {
    if (!socket) return;
    
    try {
      const response = await socket.emitWithAck('caddy:domains', {});
      if (response.success) {
        setDomains(response.data.domains || []);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch domains');
      }
    } catch (err) {
      console.error('Error fetching domains:', err);
    }
  };

  const fetchApps = async () => {
    if (!socket) return;
    
    try {
      const response = await socket.emitWithAck('app:list', {});
      if (response.success) {
        setApps(response.data.map((app: any) => ({ name: app.name })) || []);
      }
    } catch (err) {
      console.error('Error fetching apps:', err);
    }
  };

  const fetchConfig = async () => {
    if (!socket) return;
    
    try {
      const response = await socket.emitWithAck('caddy:config', {});
      if (response.success) {
        setConfig(response.data.config || '');
        await validateConfig();
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  const fetchLogs = async () => {
    if (!socket) return;
    
    try {
      const response = await socket.emitWithAck('caddy:logs', {});
      if (response.success) {
        setLogs(response.data.logs || '');
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  const validateConfig = async () => {
    if (!socket) return;
    
    try {
      const response = await socket.emitWithAck('caddy:validate', {});
      if (response.success) {
        setConfigValid(response.data.valid);
      }
    } catch (err) {
      console.error('Error validating config:', err);
    }
  };

  const fetchData = async () => {
    if (!socket) return;
    
    try {
      setLoading(true);
      setError(null);
      
      await Promise.all([
        fetchStatus(),
        fetchDomains(),
        fetchApps()
      ]);
    } catch (err) {
      setError('Failed to fetch Caddy data');
      console.error('Error fetching Caddy data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (socket) {
      fetchData();
    }
  }, [socket]);

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
      
      const response = await socket.emitWithAck(eventName, {});
      
      if (response.success) {
        setSuccess(successMessage);
        // Refresh data after action
        setTimeout(fetchData, 1000);
      } else {
        setError(response.error || `Failed to ${action} Caddy`);
      }
    } catch (err) {
      setError(`Failed to ${action} Caddy`);
      console.error(`Error ${action}ing Caddy:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const addDomain = async () => {
    if (!newDomain.appName || !newDomain.domain) {
      setError('App name and domain are required');
      return;
    }

    if (!socket) return;

    try {
      setActionLoading('add-domain');
      setError(null);
      
      const response = await socket.emitWithAck('caddy:add-domain', {
        appName: newDomain.appName,
        domain: newDomain.domain
      });
      
      if (response.success) {
        setSuccess('Domain added successfully');
        setShowAddDomainModal(false);
        setNewDomain({ appName: '', domain: '' });
        fetchData();
      } else {
        setError(response.error || 'Failed to add domain');
      }
    } catch (err) {
      setError('Failed to add domain');
      console.error('Error adding domain:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const removeDomain = async (domainId: number, domainName: string) => {
    if (!confirm(`Are you sure you want to remove domain "${domainName}"?`)) {
      return;
    }

    if (!socket) return;

    try {
      setActionLoading(`remove-${domainId}`);
      setError(null);
      
      const response = await socket.emitWithAck('caddy:remove-domain', {
        domainId
      });
      
      if (response.success) {
        setSuccess('Domain removed successfully');
        fetchData();
      } else {
        setError(response.error || 'Failed to remove domain');
      }
    } catch (err) {
      setError('Failed to remove domain');
      console.error('Error removing domain:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const regenerateConfig = async () => {
    if (!socket) return;
    
    try {
      setActionLoading('regenerate');
      setError(null);
      
      const response = await socket.emitWithAck('caddy:regenerate', {});
      
      if (response.success) {
        setSuccess('Configuration regenerated successfully');
        fetchData();
        fetchConfig();
      } else {
        setError(response.error || 'Failed to regenerate config');
      }
    } catch (err) {
      setError('Failed to regenerate config');
      console.error('Error regenerating config:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadgeColor = (running: boolean) => {
    return running ? 'success' : 'error';
  };

  if (loading || !socket) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Caddy Management</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">
            {!socket ? 'Connecting to server...' : 'Loading Caddy data...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Caddy Management</h1>
        <div className="flex items-center space-x-3">
          <Button 
            onClick={() => setShowAddDomainModal(true)}
            variant="primary"
            disabled={!socket || !status?.running}
            size="sm"
          >
            <FaPlus className="mr-2" />
            Add Domain
          </Button>
          <Button 
            onClick={fetchData}
            disabled={!socket}
            variant="outline"
            size="sm"
          >
            <FaSyncAlt className="mr-2" />
            Refresh
          </Button>
        </div>
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

      {/* Caddy Status Card */}
      <ComponentCard title="Caddy Status" desc="Manage Caddy reverse proxy server">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Badge 
              color={getStatusBadgeColor(status?.running || false)}
              variant="light"
            >
              {status?.running ? 'Running' : 'Stopped'}
            </Badge>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Reverse Proxy Server
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => executeAction('start', 'caddy:start', 'Caddy started successfully')}
              disabled={!socket || status?.running || actionLoading === 'start'}
              variant="outline"
              size="sm"
            >
              {actionLoading === 'start' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
              ) : (
                <FaPlay className="text-green-600" />
              )}
            </Button>
            
            <Button
              onClick={() => executeAction('stop', 'caddy:stop', 'Caddy stopped successfully')}
              disabled={!socket || !status?.running || actionLoading === 'stop'}
              variant="outline"
              size="sm"
            >
              {actionLoading === 'stop' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
              ) : (
                <FaStop className="text-red-600" />
              )}
            </Button>
            
            <Button
              onClick={() => executeAction('reload', 'caddy:reload', 'Caddy reloaded successfully')}
              disabled={!socket || !status?.running || actionLoading === 'reload'}
              variant="outline"
              size="sm"
            >
              {actionLoading === 'reload' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              ) : (
                <FaRedo className="text-blue-600" />
              )}
            </Button>
          </div>
        </div>
      </ComponentCard>

      {/* Configuration Management */}
      <ComponentCard title="Configuration" desc="Manage Caddy configuration">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Caddyfile Configuration
            </span>
            {configValid !== null && (
              <Badge 
                color={configValid ? 'success' : 'error'}
                variant="light"
                size="sm"
              >
                {configValid ? (
                  <>
                    <FaCheck className="mr-1" />
                    Valid
                  </>
                ) : (
                  <>
                    <FaTimes className="mr-1" />
                    Invalid
                  </>
                )}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => {
                setShowConfigModal(true);
                fetchConfig();
              }}
              disabled={!socket}
              variant="outline"
              size="sm"
            >
              View Config
            </Button>
            
            <Button
              onClick={() => {
                setShowLogsModal(true);
                fetchLogs();
              }}
              disabled={!socket}
              variant="outline"
              size="sm"
            >
              View Logs
            </Button>
            
            <Button
              onClick={regenerateConfig}
              disabled={!socket || actionLoading === 'regenerate'}
              variant="outline"
              size="sm"
            >
              {actionLoading === 'regenerate' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-600"></div>
              ) : (
                'Regenerate'
              )}
            </Button>
          </div>
        </div>
      </ComponentCard>

      {/* Domains */}
      <ComponentCard title="Domains" desc="Manage domain configurations">
        {domains.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 dark:text-gray-400 text-lg mb-2">No domains configured</div>
            <div className="text-gray-400 dark:text-gray-500 text-sm mb-4">Add your first domain to get started</div>
            <Button 
              onClick={() => setShowAddDomainModal(true)}
              disabled={!socket || !status?.running}
              variant="primary"
              size="sm"
            >
              Add Domain
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {domains.map((domain) => (
              <div
                key={domain.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {domain.domain}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          App: {domain.app_name}
                        </span>
                        {domain.ssl_enabled && (
                          <Badge color="success" variant="light" size="sm">
                            SSL Enabled
                          </Badge>
                        )}
                        {domain.is_primary && (
                          <Badge color="info" variant="light" size="sm">
                            Primary
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <a
                      href={`https://${domain.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <FaExternalLinkAlt />
                    </a>
                    
                    <Button
                      onClick={() => removeDomain(domain.id, domain.domain)}
                      disabled={!socket || actionLoading === `remove-${domain.id}`}
                      variant="outline"
                      size="sm"
                    >
                      {actionLoading === `remove-${domain.id}` ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      ) : (
                        <FaTrash className="text-red-600" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ComponentCard>

      {/* Add Domain Modal */}
      <Modal 
        isOpen={showAddDomainModal} 
        onClose={() => {
          setShowAddDomainModal(false);
          setNewDomain({ appName: '', domain: '' });
          setError(null);
        }}
      >
        <div className="bg-white dark:bg-gray-900 p-6 rounded-lg max-w-md w-full">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Add Domain</h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="app-select">Application</Label>
              <select
                id="app-select"
                value={newDomain.appName}
                onChange={(e) => setNewDomain(prev => ({ ...prev, appName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Select an application</option>
                {apps.map((app) => (
                  <option key={app.name} value={app.name}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="domain-input">Domain</Label>
              <InputField
                id="domain-input"
                type="text"
                defaultValue={newDomain.domain}
                onChange={(e) => setNewDomain(prev => ({ ...prev, domain: e.target.value }))}
                placeholder="example.com"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <Button
              onClick={() => {
                setShowAddDomainModal(false);
                setNewDomain({ appName: '', domain: '' });
                setError(null);
              }}
              variant="outline"
              disabled={actionLoading === 'add-domain'}
            >
              Cancel
            </Button>
            <Button
              onClick={addDomain}
              variant="primary"
              disabled={!socket || actionLoading === 'add-domain' || !newDomain.appName || !newDomain.domain}
            >
              {actionLoading === 'add-domain' ? 'Adding...' : 'Add Domain'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Config Modal */}
      <Modal 
        isOpen={showConfigModal} 
        onClose={() => setShowConfigModal(false)}
        isFullscreen={true}
        showCloseButton={false}
      >
        <div className="bg-white dark:bg-gray-900 p-6 h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Caddy Configuration</h2>
            <div className="flex items-center space-x-3">
              {configValid !== null && (
                <Badge 
                  color={configValid ? 'success' : 'error'}
                  variant="light"
                >
                  {configValid ? 'Valid Configuration' : 'Invalid Configuration'}
                </Badge>
              )}
              <Button
                onClick={() => setShowConfigModal(false)}
                variant="outline"
                size="sm"
              >
                Close
              </Button>
            </div>
          </div>
          
          <div className="bg-gray-900 dark:bg-gray-950 rounded border border-gray-600 dark:border-gray-700 h-96 overflow-y-auto">
            <pre className="p-4 text-sm text-gray-100 dark:text-gray-200 font-mono whitespace-pre-wrap">
              {config || 'No configuration available'}
            </pre>
          </div>
        </div>
      </Modal>

      {/* Logs Modal */}
      <Modal 
        isOpen={showLogsModal} 
        showCloseButton={false}
        className="w-full h-full"
        onClose={() => setShowLogsModal(false)}
        isFullscreen={true}
      >
        <div className="bg-white dark:bg-gray-900 p-6 h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Caddy Logs</h2>
            <div className="flex items-center space-x-3">
              <Button
                onClick={fetchLogs}
                disabled={!socket}
                variant="outline"
                size="sm"
              >
                <FaSyncAlt className="mr-2" />
                Refresh
              </Button>
              <Button
                onClick={() => setShowLogsModal(false)}
                variant="outline"
                size="sm"
              >
                Close
              </Button>
            </div>
          </div>
          
          <div className="bg-gray-900 dark:bg-gray-950 rounded border border-gray-600 dark:border-gray-700 h-96 overflow-y-auto">
            <pre className="p-4 text-sm text-gray-100 dark:text-gray-200 font-mono whitespace-pre-wrap">
              {logs || 'No logs available'}
            </pre>
          </div>
        </div>
      </Modal>
    </div>
  );
}