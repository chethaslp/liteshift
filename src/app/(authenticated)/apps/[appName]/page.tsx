'use client';

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import Alert from "@/components/ui/alert/Alert";
import { IoMdArrowBack } from "react-icons/io";
import { useSocketContext } from "@/context/SocketContext";
import { App as AppDetails, ServiceStatus, AppDomain } from "@/lib/models";
import { Modal } from "@/components/ui/modal";
import InputField from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs/Tabs";
import { FaTrash, FaPlus, FaExternalLinkAlt, FaGithub, FaCog, FaCheck, FaTimes, FaRedo, FaDownload } from "react-icons/fa";
import DeploymentQueue from "@/components/dashboard/DeploymentQueue";

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
  const { socket, systemInfo } = useSocketContext();

  const [appDetails, setAppDetails] = useState<AppDetails | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [domains, setDomains] = useState<AppDomain[]>([]);
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

  // Domains State
  const [showAddDomainModal, setShowAddDomainModal] = useState(false);
  const [newDomain, setNewDomain] = useState({ domain: '', sslEnabled: true });

  const [redeployTrigger, setRedeployTrigger] = useState(0);

  // App Config State
  const [appConfigForm, setAppConfigForm] = useState({
    branch: '',
    installCommand: '',
    buildCommand: '',
    startCommand: ''
  });

  useEffect(() => {
    if (appDetails) {
      setAppConfigForm({
        branch: appDetails.branch || '',
        installCommand: appDetails.install_command || '',
        buildCommand: appDetails.build_command || '',
        startCommand: appDetails.start_command || ''
      });
    }
  }, [appDetails]);

  const fetchAppData = async () => {
    if (!socket) return;

    try {
      setError(null);
      
      // Fetch app details
      const appResponse = await socket.emitWithAck('app:get', { appName });
      if (appResponse.success && appResponse.data.app) {
        setAppDetails(appResponse.data.app);
      } else {
        setError(`Application "${appName}" not found`);
        return;
      }

      // Fetch process status
      const statusResponse = await socket.emitWithAck('pm:status', { appName });
      if (statusResponse.success) {
        setServiceStatus(statusResponse.data.status);
      }

      // Fetch logs
      const logsResponse = await socket.emitWithAck('pm:logs', { appName, lines: 100 });
      if (logsResponse.success) {
        setLogs(logsResponse.data.logs || '');
      }

      // Fetch environment variables
      const envResponse = await socket.emitWithAck('app:env:list', { appName });
      if (envResponse.success) {
        setEnvVars(envResponse.data.envVars || []);
      }

      // Fetch domains
      const domainsResponse = await socket.emitWithAck('app:domains:list', { appName });
      if (domainsResponse.success) {
        setDomains(domainsResponse.data.domains || []);
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
        setTimeout(fetchAppData, 1000);
      } else {
        setError(response.error || `Failed to ${action} application`);
      }
    } catch (err) {
      setError(`Failed to ${action} application`);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteApp = async () => {
    if (!confirm(`Are you sure you want to delete "${appName}"? This action cannot be undone.`)) return;
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
    } finally {
      setActionLoading(null);
    }
  };

  const updateAppConfig = async () => {
    if (!socket) return;
    try {
      setActionLoading('update-config');
      setError(null);
      const response = await socket.emitWithAck('app:update', {
        appName,
        branch: appConfigForm.branch,
        installCommand: appConfigForm.installCommand,
        buildCommand: appConfigForm.buildCommand,
        startCommand: appConfigForm.startCommand
      });
      if (response.success) {
        setSuccess('Application settings updated successfully');
        fetchAppData();
      } else {
        setError(response.error || 'Failed to update application settings');
      }
    } catch (err) {
      setError('Failed to update application settings');
    } finally {
      setActionLoading(null);
    }
  };

  const redeployApp = async () => {
    if (!confirm(`Are you sure you want to redeploy "${appName}"? This will restart the application with the latest code.`)) return;
    if (!socket) return;
    try {
      setActionLoading('redeploy');
      setError(null);
      const response = await socket.emitWithAck('deploy:redeploy', { appName });
      if (response.success) {
        setSuccess(`Redeploy queued successfully!`);
        setRedeployTrigger(prev => prev + 1);
      } else {
        setError(response.error || 'Failed to queue redeploy');
      }
    } catch (err) {
      setError('Failed to redeploy application');
    } finally {
      setActionLoading(null);
    }
  };

  const clearDeployHistory = async () => {
    if (!confirm(`Are you sure you want to clear deployment history for "${appName}"?`)) return;
    if (!socket) return;
    try {
      setActionLoading('clear-history');
      setError(null);
      const response = await socket.emitWithAck('deploy:clear-history', { appName });
      if (response.success) {
        setSuccess('Deployment history cleared successfully');
        // A refresh is handled by the DeploymentQueue auto-refresh mostly, or we could trigger a local refresh
      } else {
        setError(response.error || 'Failed to clear history');
      }
    } catch (err) {
      setError('Failed to clear history');
    } finally {
      setActionLoading(null);
    }
  };

  // Webhooks
  const generateWebhook = async () => {
    if (!socket) return;
    try {
      setActionLoading('webhook-generate');
      setError(null);
      const response = await socket.emitWithAck('app:webhook:generate', { appName });
      if (response.success) {
        setSuccess('Webhook generated successfully');
        fetchAppData();
      } else {
        setError(response.error || 'Failed to generate webhook');
      }
    } catch (err) {
      setError('Failed to generate webhook');
    } finally {
      setActionLoading(null);
    }
  };

  const removeWebhook = async () => {
    if (!confirm('Are you sure you want to remove the webhook token? GitHub Push-to-Deploy will stop working.')) return;
    if (!socket) return;
    try {
      setActionLoading('webhook-remove');
      setError(null);
      const response = await socket.emitWithAck('app:webhook:remove', { appName });
      if (response.success) {
        setSuccess('Webhook removed successfully');
        fetchAppData();
      } else {
        setError(response.error || 'Failed to remove webhook');
      }
    } catch (err) {
      setError('Failed to remove webhook');
    } finally {
      setActionLoading(null);
    }
  };

  // Export
  const exportAppConfig = () => {
    if (!appDetails) return;
    
    const exportData = {
      name: appDetails.name,
      repository_url: appDetails.repository_url,
      branch: appDetails.branch,
      runtime: appDetails.runtime,
      install_command: appDetails.install_command,
      build_command: appDetails.build_command,
      start_command: appDetails.start_command,
      port: appDetails.port,
      env_vars: envVars.map(env => ({ key: env.key, value: env.value })),
      domains: domains.map(d => ({ domain: d.domain, ssl_enabled: d.ssl_enabled }))
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${appDetails.name}-config.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    setSuccess('Application configuration exported successfully');
  };

  // Domains
  const addDomain = async () => {
    if (!newDomain.domain) {
      setError('Domain is required');
      return;
    }
    if (!socket) return;
    try {
      setActionLoading('add-domain');
      setError(null);
      const response = await socket.emitWithAck('caddy:add-domain', {
        appName,
        domain: newDomain.domain,
        sslEnabled: newDomain.sslEnabled
      });
      if (response.success) {
        setSuccess('Domain added successfully');
        setShowAddDomainModal(false);
        setNewDomain({ domain: '', sslEnabled: true });
        fetchAppData();
      } else {
        setError(response.error || 'Failed to add domain');
      }
    } catch (err) {
      setError('Failed to add domain');
    } finally {
      setActionLoading(null);
    }
  };

  const removeDomain = async (domainId: number, domainName: string) => {
    if (!confirm(`Are you sure you want to remove domain "${domainName}"?`)) return;
    if (!socket) return;
    try {
      setActionLoading(`remove-${domainId}`);
      setError(null);
      const response = await socket.emitWithAck('caddy:remove-domain', { domainId });
      if (response.success) {
        setSuccess('Domain removed successfully');
        fetchAppData();
      } else {
        setError(response.error || 'Failed to remove domain');
      }
    } catch (err) {
      setError('Failed to remove domain');
    } finally {
      setActionLoading(null);
    }
  };

  // Environment Variables
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
        setSuccess(editingEnvVar ? 'Environment variable updated' : 'Environment variable added');
        closeEnvModal();
        fetchAppData();
      } else {
        setError(response.error || 'Failed to save environment variable');
      }
    } catch (err) {
      setError('Failed to save environment variable');
    } finally {
      setEnvLoading(false);
    }
  };
  const deleteEnvVar = async (key: string) => {
    if (!confirm(`Are you sure you want to delete "${key}"?`)) return;
    if (!socket) return;
    try {
      setEnvLoading(true);
      setError(null);
      const response = await socket.emitWithAck('app:env:delete', { appName, key });
      if (response.success) {
        setSuccess('Environment variable deleted');
        fetchAppData();
      } else {
        setError(response.error || 'Failed to delete env var');
      }
    } catch (err) {
      setError('Failed to delete env var');
    } finally {
      setEnvLoading(false);
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': 
      case 'online': return 'success';
      case 'inactive': 
      case 'stopped': return 'error';
      case 'failed': return 'error';
      default: return 'light';
    }
  };

  if (loading || !socket) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <Button onClick={() => router.back()} variant="outline" size="sm">
            <IoMdArrowBack size={15} /> Back
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center h-64">
          <div className="animate-spin rounded-full mb-2 h-8 w-8 border-b-2 border-brand-600"></div>
          <span className="text-gray-600 dark:text-gray-400">Loading application details...</span>
        </div>
      </div>
    );
  }

  if (error && !appDetails) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <Button onClick={() => router.back()} variant="outline" size="sm" className="w-fit">
          <IoMdArrowBack size={15} /> Back
        </Button>
        <Alert variant="error" title="Error" message={error} />
      </div>
    );
  }

  const webhookUrl = systemInfo && appDetails?.webhook_token 
    ? `http://${systemInfo.host}:8008/webhook/github/${encodeURIComponent(appDetails.name)}`
    : '';

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button onClick={() => router.back()} variant="outline" size="sm">
            <IoMdArrowBack size={15} /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{appName}</h1>
            {appDetails && (
              <div className="flex items-center space-x-2 mt-1">
                <Badge color={getStatusBadgeColor(serviceStatus?.status || 'unknown')} variant="light" size="sm">
                  {serviceStatus?.status || 'unknown'}
                </Badge>
                <span className="text-sm text-gray-500 dark:text-gray-400">Runtime: {appDetails.runtime}</span>
              </div>
            )}
          </div>
        </div>
        <Button onClick={fetchAppData} disabled={!socket || loading} variant="primary">
          Refresh
        </Button>
      </div>

      {error && <Alert variant="error" title="Error" message={error} />}
      {success && <Alert variant="success" title="Success" message={success} />}

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ComponentCard title="Performance" desc="Resource usage details">
               <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                   <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Memory</div>
                   <div className="text-xl font-bold text-gray-900 dark:text-white">
                     {serviceStatus?.memory?.current || 'N/A'}
                   </div>
                   <div className="text-xs text-gray-400 mt-1">Peak: {serviceStatus?.memory?.peak || 'N/A'}</div>
                 </div>
                 <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                   <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">CPU Time</div>
                   <div className="text-xl font-bold text-gray-900 dark:text-white">
                     {serviceStatus?.cpu?.usage || '0%'}
                   </div>
                 </div>
                 <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                   <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Uptime</div>
                   <div className="text-xl font-bold text-gray-900 dark:text-white">
                     {serviceStatus?.uptime || serviceStatus?.active?.duration || '0s'}
                   </div>
                 </div>
                 <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                   <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Restarts</div>
                   <div className="text-xl font-bold text-gray-900 dark:text-white">
                     {serviceStatus?.restarts !== undefined ? serviceStatus.restarts : 'N/A'}
                   </div>
                 </div>
               </div>
            </ComponentCard>
            
            <ComponentCard title="Deployment Details" desc="Latest deployment information">
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Deployed URL</span>
                  <a href={domains[0] ? `http${domains[0].ssl_enabled ? 's' : ''}://${domains[0].domain}` : '#'} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-600 flex items-center hover:underline">
                    {domains[0] ? domains[0].domain : 'No domains mapped'} <FaExternalLinkAlt className="ml-1 text-xs" />
                  </a>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Local URL</span>
                  <a href={`http://${systemInfo?.host || 'localhost'}:${appDetails?.port}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-600 flex items-center hover:underline">
                    http://{systemInfo?.host || 'localhost'}:{appDetails?.port} <FaExternalLinkAlt className="ml-1 text-xs" />
                  </a>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Last Deployed</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{appDetails?.updated_at ? formatDate(appDetails.updated_at) : 'N/A'}</span>
                </div>
                <div className="flex flex-col pt-1">
                  <span className="text-sm text-gray-500 dark:text-gray-400 mb-1">Latest Commit</span>
                  <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-sm">
                     <div className="font-mono text-xs text-gray-500 mb-1">{appDetails?.latest_commit_hash?.substring(0,7) || 'N/A'}</div>
                     <div className="text-gray-900 dark:text-gray-200">{appDetails?.latest_commit_message || 'No commit history available.'}</div>
                  </div>
                </div>
              </div>
            </ComponentCard>
          </div>

          <ComponentCard title="Service Logs" desc="Real-time process manager output">
            <div ref={el => { if (el) el.scrollTop = el.scrollHeight; }} className="bg-black text-green-400 font-mono text-sm p-4 rounded-lg h-96 overflow-y-auto">
              {logs ? <pre className="whitespace-pre-wrap">{logs}</pre> : <div className="text-gray-500">No logs available</div>}
            </div>
          </ComponentCard>
        </TabsContent>

        <TabsContent value="deployments" className="space-y-6 mt-0">
           <div className="flex justify-between items-center mb-4">
             <div>
               <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Deployment History</h2>
               <p className="text-sm text-gray-500">View and manage deployments for this app</p>
             </div>
             <div className="flex items-center space-x-3">
               <Button onClick={redeployApp} disabled={!socket || actionLoading === 'redeploy'} variant="primary" className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300">
                 Redeploy from Git
               </Button>
               <Button onClick={clearDeployHistory} variant="outline" disabled={actionLoading === 'clear-history'} className="text-red-600 border-red-300 hover:bg-red-50">
                 <FaTrash className="mr-2"/> Clear History
               </Button>
             </div>
           </div>
           <DeploymentQueue appName={appName} refreshTrigger={redeployTrigger} />
        </TabsContent>

        <TabsContent value="domains" className="space-y-6 mt-0">
          <ComponentCard title="Domains" desc={systemInfo?.reverse_proxy === 'cloudflare' ? "Domains managed via Cloudflare Zero Trust" : "Manage custom domains"}>
            {systemInfo?.reverse_proxy === 'cloudflare' ? (
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center mb-4">
                  <FaExternalLinkAlt className="text-xl" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Cloudflare Tunnel Active</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-4">
                  Your server is configured to use Cloudflare Tunnel. Domains and SSL are managed directly from the Cloudflare Zero Trust dashboard.
                </p>
                <div className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded text-left w-full max-w-md">
                  <span className="font-semibold block mb-1">Local Address for this app:</span>
                  <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">http://localhost:{appDetails?.port}</code>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <Button onClick={() => setShowAddDomainModal(true)} variant="primary" size="sm">
                    <FaPlus className="mr-2" /> Add Domain
                  </Button>
                </div>
                
                {domains.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500 dark:text-gray-400">No domains configured</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {domains.map((domain) => (
                      <div key={domain.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {domain.ssl_enabled ? (domain.domain.startsWith(':') ? 'https://'+ systemInfo?.host + domain.domain : domain.domain) : (domain.domain.startsWith(':') ? 'http://'+ systemInfo?.host + domain.domain : `http://${domain.domain}`)}
                          </h3>
                          <div className="flex items-center space-x-2 mt-1">
                            {domain.ssl_enabled && <Badge color="success" variant="light" size="sm">SSL Enabled</Badge>}
                            {domain.is_primary && <Badge color="info" variant="light" size="sm">Primary</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button onClick={() => removeDomain(domain.id, domain.domain)} disabled={actionLoading === `remove-${domain.id}`} variant="outline" size="sm">
                             <FaTrash className="text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </ComponentCard>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 mt-0">
          
          {/* Application Settings */}
          <ComponentCard title="Application Settings" desc="Update repository and build configuration">
            <div className="space-y-4">
              <div>
                <Label>Git Branch</Label>
                <input 
                  type="text" 
                  value={appConfigForm.branch} 
                  onChange={(e) => setAppConfigForm(prev => ({ ...prev, branch: e.target.value }))} 
                  placeholder="e.g., main or master" 
                  className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-none focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700 mt-1"
                />
              </div>
              <div>
                <Label>Install Command</Label>
                <input 
                  type="text" 
                  value={appConfigForm.installCommand} 
                  onChange={(e) => setAppConfigForm(prev => ({ ...prev, installCommand: e.target.value }))} 
                  placeholder="e.g., npm install" 
                  className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-none focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700 mt-1"
                />
              </div>
              <div>
                <Label>Build Command</Label>
                <input 
                  type="text" 
                  value={appConfigForm.buildCommand} 
                  onChange={(e) => setAppConfigForm(prev => ({ ...prev, buildCommand: e.target.value }))} 
                  placeholder="e.g., npm run build" 
                  className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-none focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700 mt-1"
                />
              </div>
              <div>
                <Label>Start Command</Label>
                <input 
                  type="text" 
                  value={appConfigForm.startCommand} 
                  onChange={(e) => setAppConfigForm(prev => ({ ...prev, startCommand: e.target.value }))} 
                  placeholder="e.g., npm start" 
                  className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-none focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700 mt-1"
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button 
                  onClick={updateAppConfig} 
                  disabled={actionLoading === 'update-config'} 
                  variant="primary"
                >
                  {actionLoading === 'update-config' ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </ComponentCard>

          {/* Continuous Deployment */}
          <ComponentCard title="Continuous Deployment" desc="Set up GitHub Push-to-Deploy">
             <div className="space-y-4">
               {appDetails?.webhook_token ? (
                 <div>
                   <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                     Your webhook URL is active. Add this URL and secret to your GitHub repository settings under "Webhooks". Ensure the Content type is set to <code>application/json</code>.
                   </p>
                   <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
                     <div>
                       <Label>Payload URL</Label>
                       <div className="flex mt-1">
                         <input type="text" readOnly value={webhookUrl} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                         <Button onClick={() => navigator.clipboard.writeText(webhookUrl)} variant="outline" className="rounded-l-none border-l-0">Copy</Button>
                       </div>
                     </div>
                     <div>
                       <Label>Secret</Label>
                       <div className="flex mt-1">
                         <input type="text" readOnly value={appDetails.webhook_token} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm" />
                         <Button onClick={() => navigator.clipboard.writeText(appDetails.webhook_token as string)} variant="outline" className="rounded-l-none border-l-0">Copy</Button>
                       </div>
                     </div>
                   </div>
                   <div className="mt-4 flex gap-3">
                     <Button onClick={generateWebhook} disabled={actionLoading === 'webhook-generate'} variant="outline" size="sm">Regenerate Secret</Button>
                     <Button onClick={removeWebhook} disabled={actionLoading === 'webhook-remove'} variant="outline" size="sm" className="text-red-600">Remove Webhook</Button>
                   </div>
                 </div>
               ) : (
                 <div>
                   <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                     Enable push-to-deploy to automatically rebuild your app when you push to the configured branch.
                   </p>
                   <Button onClick={generateWebhook} disabled={actionLoading === 'webhook-generate'} variant="primary">
                     <FaGithub className="mr-2" /> Enable GitHub Webhooks
                   </Button>
                 </div>
               )}
             </div>
          </ComponentCard>

          {/* Environment Variables */}
          <ComponentCard title="Environment Variables" desc="Manage application environment variables">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Button onClick={() => openEnvModal()} disabled={envLoading} variant="primary" size="sm">Add Variable</Button>
              </div>

              {envVars.length === 0 ? (
                <div className="text-center py-4 text-gray-500">No environment variables configured</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {envVars.map((envVar) => (
                    <div key={envVar.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{envVar.key}</span>
                        <span className="text-xs text-gray-500">=</span>
                        <span className="text-sm text-gray-600 dark:text-gray-300 truncate">{envVar.value}</span>
                      </div>
                      <div className="flex space-x-2 ml-2">
                        <Button onClick={() => openEnvModal(envVar)} disabled={envLoading} variant="outline" size="sm">Edit</Button>
                        <Button onClick={() => deleteEnvVar(envVar.key)} disabled={envLoading} variant="outline" size="sm" className="text-red-600">Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ComponentCard>

          {/* Actions */}
          <ComponentCard title="Actions" desc="Manage your application state">
            <div className="grid grid-cols-3 gap-3">
              <Button onClick={() => executeAction('start', 'pm:start', 'Service started successfully')} disabled={!socket || actionLoading === 'start' || serviceStatus?.status === 'active' || serviceStatus?.status === 'online'} variant="primary" className="bg-green-600 hover:bg-green-700 disabled:bg-green-300">Start</Button>
              <Button onClick={() => executeAction('stop', 'pm:stop', 'Service stopped successfully')} disabled={!socket || actionLoading === 'stop' || serviceStatus?.status === 'inactive' || serviceStatus?.status === 'stopped'} variant="primary" className="bg-red-600 hover:bg-red-700 disabled:bg-red-300">Stop</Button>
              <Button onClick={() => executeAction('restart', 'pm:restart', 'Service restarted successfully')} disabled={!socket || actionLoading === 'restart'} variant="primary" className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300">Restart</Button>
            </div>
          </ComponentCard>

          {/* Export Settings */}
          <ComponentCard title="Export Configuration" desc="Export app configuration for backup or migration">
             <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
               <div>
                 <h3 className="text-sm font-medium text-gray-900 dark:text-white">Export App Data</h3>
                 <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Download a JSON file containing all settings, environment variables, and domains for this app.</p>
               </div>
               <Button onClick={exportAppConfig} variant="outline" className="flex items-center space-x-2 whitespace-nowrap ml-4">
                 <FaDownload className="text-gray-500" />
                 <span>Export JSON</span>
               </Button>
             </div>
          </ComponentCard>

          {/* Danger Zone */}
          <ComponentCard title="Danger Zone" desc="Destructive actions for this application">
             <div className="p-4 border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-semibold text-red-800 dark:text-red-400">Delete Application</h3>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-1">Permanently remove this application and all associated data.</p>
                  </div>
                  <Button onClick={deleteApp} disabled={!socket || actionLoading === 'delete'} variant="primary" className="bg-red-600 hover:bg-red-700 text-white border-0">
                    {actionLoading === 'delete' ? 'Deleting...' : 'Delete Application'}
                  </Button>
                </div>
             </div>
          </ComponentCard>

        </TabsContent>
      </Tabs>

      {/* Add Domain Modal */}
      <Modal isOpen={showAddDomainModal} onClose={() => { setShowAddDomainModal(false); setNewDomain({ domain: '', sslEnabled: true }); setError(null); }}>
        <div className="space-y-4">
          <div className="mb-6"><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Domain</h3></div>
          <div>
            <Label htmlFor="domain-input">Domain *</Label>
            <InputField id="domain-input" type="text" defaultValue={newDomain.domain} onChange={(e) => setNewDomain(prev => ({ ...prev, domain: e.target.value }))} placeholder="example.com" />
          </div>
          <div className="flex items-center justify-between">
            <Label>Automatic SSL Configuration</Label>
            <button onClick={() => setNewDomain(prev => ({ ...prev, sslEnabled: !prev.sslEnabled }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${newDomain.sslEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${newDomain.sslEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <Button onClick={() => setShowAddDomainModal(false)} variant="outline">Cancel</Button>
            <Button onClick={addDomain} disabled={actionLoading === 'add-domain' || !newDomain.domain} variant="primary">Add Domain</Button>
          </div>
        </div>
      </Modal>

      {/* Environment Variable Modal */}
      <Modal isOpen={showEnvModal} onClose={closeEnvModal}>
        <div className="space-y-4">
          <div className="mb-6"><h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editingEnvVar ? 'Edit Environment Variable' : 'Add Environment Variable'}</h3></div>
          <div>
            <Label htmlFor="env-key">Variable Name</Label>
            <input id="env-key" name="key" type="text" value={envFormData.key} onChange={handleEnvFormChange} disabled={envLoading || !!editingEnvVar} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
          </div>
          <div>
            <Label htmlFor="env-value">Variable Value</Label>
            <input id="env-value" name="value" type="text" value={envFormData.value} onChange={handleEnvFormChange} disabled={envLoading} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <Button onClick={closeEnvModal} disabled={envLoading} variant="outline">Cancel</Button>
            <Button onClick={saveEnvVar} disabled={envLoading || !envFormData.key.trim()} variant="primary">{envLoading ? (editingEnvVar ? 'Updating...' : 'Adding...') : (editingEnvVar ? 'Update Variable' : 'Add Variable')}</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
