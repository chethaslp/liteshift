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
    domain: '',
    sslEnabled: true
  });

  const [apps, setApps] = useState<App[]>([]);
  const { socket, systemInfo } = useSocketContext();

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
        domain: newDomain.domain,
        sslEnabled: newDomain.sslEnabled
      });
      
      if (response.success) {
        setSuccess('Domain added successfully');
        setShowAddDomainModal(false);
        setNewDomain({ appName: '', domain: '', sslEnabled: true });
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
                        {domain.ssl_enabled 
                          ? (domain.domain.startsWith(':') ? 'https://'+ systemInfo?.host + domain.domain : domain.domain)
                          : (domain.domain.startsWith(':') ? 'http://'+ systemInfo?.host + domain.domain : `http://${domain.domain}`)
                        }
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
                        {domain.is_primary === true && (
                          <Badge color="info" variant="light" size="sm">
                            Primary
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 gap-2">
                    <a
                      href={domain.ssl_enabled 
                        ? (domain.domain.startsWith(':') ? 'https://'+ systemInfo?.host + domain.domain : `https://${domain.domain}`)
                        : (domain.domain.startsWith(':') ? 'http://'+ systemInfo?.host + domain.domain : `http://${domain.domain}`)
                      }
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
          setNewDomain({ appName: '', domain: '', sslEnabled: true });
          setError(null);
        }}
        isFullscreen={true}
        showCloseButton={false}
        className="flex items-center justify-center backdrop-blur-sm"
      >
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg mx-4">
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600">
                <FaPlus className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add New Domain</h2>
              </div>
            </div>
            <button
              onClick={() => {
                setShowAddDomainModal(false);
                setNewDomain({ appName: '', domain: '', sslEnabled: true });
                setError(null);
              }}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="space-y-6">
              <div>
                <Label htmlFor="app-select">Application *</Label>
                <div className="mt-2 relative">
                  <select
                    id="app-select"
                    value={newDomain.appName}
                    onChange={(e) => setNewDomain(prev => ({ ...prev, appName: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none pr-10"
                  >
                    <option value="">Choose an application</option>
                    {apps.map((app) => (
                      <option key={app.name} value={app.name}>
                        {app.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Select the application this domain will point to
                </p>
              </div>

              <div>
                <Label htmlFor="domain-input">Domain *</Label>
                <div className="mt-2">
                  <InputField
                    id="domain-input"
                    type="text"
                    defaultValue={newDomain.domain}
                    onChange={(e) => setNewDomain(prev => ({ ...prev, domain: e.target.value }))}
                    placeholder="example.com or subdomain.example.com"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter the full domain name {newDomain.sslEnabled ? '(SSL will be automatically configured)' : '(HTTP only)'}
                </p>
              </div>

              {/* SSL Toggle */}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>SSL Configuration</Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {newDomain.sslEnabled ? 'HTTPS with automatic SSL certificates' : 'HTTP only (not recommended for production)'}
                    </p>
                  </div>
                  <button
                    onClick={() => setNewDomain(prev => ({ ...prev, sslEnabled: !prev.sslEnabled }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      newDomain.sslEnabled 
                        ? 'bg-blue-600' 
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        newDomain.sslEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Feature Preview */}
              <div className={`p-4 rounded-xl border transition-all duration-200 ${
                newDomain.sslEnabled 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
              }`}>
                <div className="flex items-start space-x-3">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 mt-0.5 ${
                    newDomain.sslEnabled 
                      ? 'bg-blue-500'
                      : 'bg-orange-500'
                  }`}>
                    {newDomain.sslEnabled ? (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h4 className={`text-sm font-medium ${
                      newDomain.sslEnabled 
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-orange-900 dark:text-orange-100'
                    }`}>
                      {newDomain.sslEnabled ? 'Automatic SSL' : 'HTTP Only'}
                    </h4>
                    <p className={`text-xs mt-1 ${
                      newDomain.sslEnabled 
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-orange-700 dark:text-orange-300'
                    }`}>
                      {newDomain.sslEnabled 
                        ? 'Caddy will automatically provision and renew SSL certificates for your domain'
                        : 'Domain will be accessible via HTTP only. SSL can be enabled later.'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 pt-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 rounded-b-3xl">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {newDomain.sslEnabled 
                ? 'Domain will be added with HTTPS and SSL certificates'
                : 'Domain will be added with HTTP only'
              }
            </div>
            <div className="flex space-x-3">
              <Button
                onClick={() => {
                  setShowAddDomainModal(false);
                  setNewDomain({ appName: '', domain: '', sslEnabled: true });
                  setError(null);
                }}
                variant="outline"
                disabled={actionLoading === 'add-domain'}
                size="md"
              >
                Cancel
              </Button>
              <Button
                onClick={addDomain}
                variant="primary"
                disabled={!socket || actionLoading === 'add-domain' || !newDomain.appName || !newDomain.domain}
                size="md"
                className="min-w-[100px]"
              >
                {actionLoading === 'add-domain' ? 
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Adding...</span>
                  </div>
                  : 'Add Domain'
                }
              </Button>
            </div>
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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="flex flex-col h-screen">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-blue-600">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                        Caddy Configuration
                      </h1>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Current Caddyfile configuration
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {configValid !== null && (
                      <div className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center space-x-2 ${
                        configValid 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {configValid ? (
                          <>
                            <FaCheck className="w-3 h-3" />
                            <span>Valid Configuration</span>
                          </>
                        ) : (
                          <>
                            <FaTimes className="w-3 h-3" />
                            <span>Invalid Configuration</span>
                          </>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => setShowConfigModal(false)}
                      className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full">
                <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 h-full overflow-hidden">
                  <div className="p-6 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Caddyfile Content</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Auto-generated reverse proxy configuration</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(config);
                            setSuccess('Configuration copied to clipboard');
                          }}
                          className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>Copy</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex-1 bg-gray-900 dark:bg-gray-950 rounded-2xl border border-gray-300 dark:border-gray-700 overflow-hidden">
                      <div className="h-full overflow-y-auto">
                        <pre className="p-6 text-sm text-gray-100 dark:text-gray-200 font-mono whitespace-pre-wrap leading-relaxed">
                          {config || (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <p className="text-lg font-medium">No configuration available</p>
                              <p className="text-sm text-gray-400 mt-1">Configuration will appear here once Caddy is configured</p>
                            </div>
                          )}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Logs Modal */}
      <Modal 
        isOpen={showLogsModal} 
        showCloseButton={false}
        onClose={() => setShowLogsModal(false)}
        isFullscreen={true}
      >
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="flex flex-col h-screen">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-600">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                        Caddy Logs
                      </h1>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Real-time server logs and events
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={fetchLogs}
                      disabled={!socket}
                      className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <FaSyncAlt className="w-3 h-3" />
                      <span>Refresh</span>
                    </button>
                    <button
                      onClick={() => setShowLogsModal(false)}
                      className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full">
                <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 h-full overflow-hidden">
                  <div className="p-6 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Server Logs</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Live output from Caddy server</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(logs);
                            setSuccess('Logs copied to clipboard');
                          }}
                          className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-green-100 hover:bg-green-200 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-green-700 dark:text-green-400 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>Copy</span>
                        </button>
                        <button
                          onClick={() => {
                            const element = document.querySelector('#logs-container');
                            if (element) {
                              element.scrollTop = element.scrollHeight;
                            }
                          }}
                          className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-400 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                          <span>Scroll to Bottom</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex-1 bg-gray-900 dark:bg-gray-950 rounded-2xl border border-gray-300 dark:border-gray-700 overflow-hidden">
                      <div 
                        id="logs-container"
                        className="h-full overflow-y-auto"
                        ref={el => { if (el) el.scrollTop = el.scrollHeight; }}
                      >
                        <pre className="p-6 text-sm text-gray-100 dark:text-gray-200 font-mono whitespace-pre-wrap leading-relaxed">
                          {logs || (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <p className="text-lg font-medium">No logs available</p>
                              <p className="text-sm text-gray-400 mt-1">Logs will appear here when Caddy is running</p>
                            </div>
                          )}
                        </pre>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-4">
                          <span>Last updated: {new Date().toLocaleTimeString()}</span>
                          <span className="flex items-center space-x-1">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span>Live logs</span>
                          </span>
                        </div>
                        <div>
                          Press Ctrl+F to search logs
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}