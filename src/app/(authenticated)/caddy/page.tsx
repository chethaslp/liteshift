'use client';

import React, { useEffect, useState } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import Alert from "@/components/ui/alert/Alert";
import { Modal } from "@/components/ui/modal";
import InputField from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { FaPlay, FaStop, FaRedo, FaPlus, FaTrash, FaCheck, FaTimes, FaExternalLinkAlt } from "react-icons/fa";

interface CaddyStatus {
  running: boolean;
  version: string;
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

export default function CaddyPage() {
  const [status, setStatus] = useState<CaddyStatus | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [config, setConfig] = useState<string>('');
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddDomainModal, setShowAddDomainModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configValid, setConfigValid] = useState<boolean | null>(null);

  // Form state for adding domain
  const [newDomain, setNewDomain] = useState({
    appName: '',
    domain: '',
    isPrimary: false
  });

  const [apps, setApps] = useState<Array<{ name: string }>>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch Caddy status
      const statusResponse = await fetch('/api/caddy?action=status');
      const statusData = await statusResponse.json();
      
      if (statusData.success) {
        setStatus(statusData.data);
      }

      // Fetch domains
      const domainsResponse = await fetch('/api/caddy?action=domains');
      const domainsData = await domainsResponse.json();
      
      if (domainsData.success) {
        setDomains(domainsData.data.domains);
      }

      // Fetch apps for dropdown
      const appsResponse = await fetch('/api/pm2?action=list');
      const appsData = await appsResponse.json();
      
      if (appsData.success) {
        setApps(appsData.data.list.map((app: any) => ({ name: app.name })));
      }

    } catch (err) {
      setError('Failed to fetch Caddy data');
      console.error('Error fetching Caddy data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/caddy?action=config');
      const data = await response.json();
      
      if (data.success) {
        setConfig(data.data.config);
        await validateConfig();
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/caddy?action=logs');
      const data = await response.json();
      
      if (data.success) {
        setLogs(data.data.logs);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  const validateConfig = async () => {
    try {
      const response = await fetch('/api/caddy?action=validate');
      const data = await response.json();
      
      if (data.success) {
        setConfigValid(data.data.valid);
      }
    } catch (err) {
      console.error('Error validating config:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const executeAction = async (action: string) => {
    try {
      setActionLoading(action);
      
      const response = await fetch('/api/caddy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Refresh status after action
        setTimeout(fetchData, 1000);
      } else {
        setError(data.error || `Failed to ${action} Caddy`);
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

    try {
      setActionLoading('add-domain');
      
      const response = await fetch('/api/caddy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'add-domain',
          appName: newDomain.appName,
          domain: newDomain.domain,
          isPrimary: newDomain.isPrimary
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setShowAddDomainModal(false);
        setNewDomain({ appName: '', domain: '', isPrimary: false });
        fetchData();
      } else {
        setError(data.error || 'Failed to add domain');
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

    try {
      setActionLoading(`remove-${domainId}`);
      
      const response = await fetch(`/api/caddy?domainId=${domainId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        fetchData();
      } else {
        setError(data.error || 'Failed to remove domain');
      }
    } catch (err) {
      setError('Failed to remove domain');
      console.error('Error removing domain:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const regenerateConfig = async () => {
    try {
      setActionLoading('regenerate');
      
      const response = await fetch('/api/caddy', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'update-config' }),
      });

      const data = await response.json();
      
      if (data.success) {
        fetchData();
        fetchConfig();
      } else {
        setError(data.error || 'Failed to regenerate config');
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

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Caddy Management</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading Caddy data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Caddy Management</h1>
          <Button 
            onClick={fetchData}
            variant="primary"
          >
            Retry
          </Button>
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Caddy Management</h1>
        <div className="flex items-center space-x-3">
          <Button 
            onClick={() => setShowAddDomainModal(true)}
            variant="primary"
            disabled={!status?.running}
          >
            <FaPlus className="mr-2" />
            Add Domain
          </Button>
          <Button 
            onClick={fetchData}
            disabled={loading}
            variant="outline"
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Caddy Status */}
        <ComponentCard title="Caddy Status" desc="Current Caddy server status and information">
          {status && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
                  <Badge 
                    color={getStatusBadgeColor(status.running)} 
                    size="sm"
                  >
                    {status.running ? 'Running' : 'Stopped'}
                  </Badge>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Version: {status.version || 'Unknown'}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <Button
                  onClick={() => executeAction('start')}
                  disabled={actionLoading === 'start' || status.running}
                  variant="primary"
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-300"
                  size="sm"
                >
                  <FaPlay className="mr-1" />
                  {actionLoading === 'start' ? 'Starting...' : 'Start'}
                </Button>
                <Button
                  onClick={() => executeAction('stop')}
                  disabled={actionLoading === 'stop' || !status.running}
                  variant="primary"
                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-300"
                  size="sm"
                >
                  <FaStop className="mr-1" />
                  {actionLoading === 'stop' ? 'Stopping...' : 'Stop'}
                </Button>
                <Button
                  onClick={() => executeAction('reload')}
                  disabled={actionLoading === 'reload' || !status.running}
                  variant="primary"
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300"
                  size="sm"
                >
                  <FaRedo className="mr-1" />
                  {actionLoading === 'reload' ? 'Reloading...' : 'Reload'}
                </Button>
              </div>
            </div>
          )}
        </ComponentCard>

        {/* Configuration Status */}
        <ComponentCard title="Configuration" desc="Caddy configuration management">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">Config Status:</span>
                {configValid !== null && (
                  <Badge 
                    color={configValid ? 'success' : 'error'} 
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
            </div>
            
            <div className="space-y-2">
              <Button
                onClick={() => {
                  fetchConfig();
                  setShowConfigModal(true);
                }}
                variant="outline"
                size="sm"
                className="w-full"
              >
                View Configuration
              </Button>
              <Button
                onClick={regenerateConfig}
                disabled={actionLoading === 'regenerate'}
                variant="primary"
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 w-full"
                size="sm"
              >
                <FaRedo className="mr-1" />
                {actionLoading === 'regenerate' ? 'Regenerating...' : 'Regenerate & Reload'}
              </Button>
            </div>
          </div>
        </ComponentCard>
      </div>

      {/* Domains */}
      <ComponentCard title="Configured Domains" desc="Manage domains and SSL certificates">
        {domains.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 dark:text-gray-400 text-lg mb-2">No domains configured</div>
            <div className="text-gray-400 dark:text-gray-500 text-sm mb-4">Add domains to enable HTTPS for your applications</div>
            <Button 
              onClick={() => setShowAddDomainModal(true)}
              variant="primary"
              disabled={!status?.running}
            >
              <FaPlus className="mr-2" />
              Add Your First Domain
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {domains.map((domain) => (
              <div
                key={domain.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {domain.domain}
                        </h3>
                        <a
                          href={`https://${domain.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          <FaExternalLinkAlt className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>App: {domain.app_name}</span>
                        {domain.is_primary && (
                          <Badge color="primary" size="sm">Primary</Badge>
                        )}
                        {domain.ssl_enabled && (
                          <Badge color="success" size="sm">SSL</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => removeDomain(domain.id, domain.domain)}
                      disabled={actionLoading === `remove-${domain.id}`}
                      variant="primary"
                      className="bg-red-600 hover:bg-red-700 disabled:bg-red-300"
                      size="sm"
                    >
                      <FaTrash className="mr-1" />
                      {actionLoading === `remove-${domain.id}` ? 'Removing...' : 'Remove'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ComponentCard>

      {/* Logs */}
      <ComponentCard title="Caddy Logs" desc="Recent Caddy server logs">
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={fetchLogs}
              variant="outline"
              size="sm"
            >
              Refresh Logs
            </Button>
          </div>
          <div className="bg-black text-green-400 font-mono text-sm p-4 rounded-lg h-64 overflow-y-auto">
            {logs ? (
              <pre className="whitespace-pre-wrap">{logs}</pre>
            ) : (
              <div className="text-gray-500">No logs available</div>
            )}
          </div>
        </div>
      </ComponentCard>

      {/* Add Domain Modal */}
      <Modal 
        isOpen={showAddDomainModal} 
        onClose={() => {
          setShowAddDomainModal(false);
          setNewDomain({ appName: '', domain: '', isPrimary: false });
        }}
      >
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Add New Domain</h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="appName">Application</Label>
              <select
                id="appName"
                value={newDomain.appName}
                onChange={(e) => setNewDomain(prev => ({
                  ...prev,
                  appName: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                required
              >
                <option value="">Select an application...</option>
                {apps.map((app) => (
                  <option key={app.name} value={app.name}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="domain">Domain</Label>
              <InputField
                id="domain"
                type="text"
                placeholder="example.com"
                defaultValue={newDomain.domain}
                onChange={(e) => setNewDomain(prev => ({
                  ...prev,
                  domain: e.target.value
                }))}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="isPrimary"
                type="checkbox"
                checked={newDomain.isPrimary}
                onChange={(e) => setNewDomain(prev => ({
                  ...prev,
                  isPrimary: e.target.checked
                }))}
                className="w-4 h-4 text-brand-600 bg-gray-100 border-gray-300 rounded focus:ring-brand-500 dark:focus:ring-brand-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <Label htmlFor="isPrimary">Primary domain for this app</Label>
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-6">
            <Button
              onClick={() => {
                setShowAddDomainModal(false);
                setNewDomain({ appName: '', domain: '', isPrimary: false });
              }}
              variant="outline"
              disabled={actionLoading === 'add-domain'}
            >
              Cancel
            </Button>
            <Button
              onClick={addDomain}
              disabled={actionLoading === 'add-domain' || !newDomain.appName || !newDomain.domain}
              variant="primary"
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
      >
        <div className="min-h-screen bg-white dark:bg-gray-900 p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Caddy Configuration</h2>
              <div className="flex items-center space-x-4">
                {configValid !== null && (
                  <Badge 
                    color={configValid ? 'success' : 'error'} 
                    size="md"
                  >
                    {configValid ? (
                      <>
                        <FaCheck className="mr-1" />
                        Valid Configuration
                      </>
                    ) : (
                      <>
                        <FaTimes className="mr-1" />
                        Invalid Configuration
                      </>
                    )}
                  </Badge>
                )}
                <Button
                  onClick={() => setShowConfigModal(false)}
                  variant="outline"
                >
                  Close
                </Button>
              </div>
            </div>
            
            <div className="bg-black text-gray-300 font-mono text-sm p-6 rounded-lg h-[calc(100vh-200px)] overflow-y-auto">
              <pre className="whitespace-pre-wrap">{config || 'Loading configuration...'}</pre>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
