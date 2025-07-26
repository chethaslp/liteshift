'use client';

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import Alert from "@/components/ui/alert/Alert";
import { Modal } from "@/components/ui/modal";
import InputField from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import TextArea from "@/components/form/input/TextArea";
import Select from "@/components/form/Select";
import DeploymentQueue from "@/components/dashboard/DeploymentQueue";
import { useSocketContext } from "@/context/SocketContext";
import { App } from "@/lib/models";

export default function AppsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deploymentLoading, setDeploymentLoading] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [deploymentSuccess, setDeploymentSuccess] = useState<string | null>(null);
  const [queueId, setQueueId] = useState<number | null>(null);
  const [repoValidating, setRepoValidating] = useState(false);
  const [repoValid, setRepoValid] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const router = useRouter();
  const { socket } = useSocketContext();

  // Form state for deployment
  const [formData, setFormData] = useState({
    appName: '',
    repository: '',
    branch: 'main',
    runtime: 'node' as 'node' | 'python' | 'bun',
    buildCommand: '',
    installCommand: 'npm install',
    startCommand: '',
    envVars: ''
  });

  const fetchApps = async () => {
    if (!socket) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch apps from database
      const appsResponse = await socket.emitWithAck('app:list', {});
      
      if (appsResponse.success) {
        const appList = appsResponse.data || [];
        setApps(appList);
      } else {
        setError(appsResponse.error || 'Failed to fetch apps');
      }
    } catch (err) {
      setError('Failed to fetch apps');
      console.error('Error fetching apps:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (socket) {
      fetchApps();
    }
  }, [socket]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTextAreaChange = (name: string) => (value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const extractOwnerAndRepo = (url: string) => {
    // Handle various GitHub URL formats
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/,
      /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return { owner: match[1], repo: match[2] };
      }
    }
    return null;
  };

  const validateRepository = async (repoUrl: string) => {
    if (!repoUrl.trim()) {
      setRepoValid(false);
      setBranches([]);
      return;
    }

    const ownerRepo = extractOwnerAndRepo(repoUrl);
    if (!ownerRepo) {
      setRepoValid(false);
      setBranches([]);
      return;
    }

    try {
      setRepoValidating(true);
      setBranchesLoading(true);
      
      // Fetch repository info to validate it exists
      const branchesResponse = await fetch(`https://api.github.com/repos/${ownerRepo.owner}/${ownerRepo.repo}/branches`);
      
      if (branchesResponse.ok) {
        setRepoValid(true);
        
        // Fetch branches
        
        if (branchesResponse.ok) {
          const branchesData = await branchesResponse.json();
          const branchNames = branchesData.map((branch: any) => branch.name);
          setBranches(branchNames);
          
          // Set default branch to main or master if available
          if (branchNames.includes('main')) {
            setFormData(prev => ({ ...prev, branch: 'main' }));
          } else if (branchNames.includes('master')) {
            setFormData(prev => ({ ...prev, branch: 'master' }));
          } else if (branchNames.length > 0) {
            setFormData(prev => ({ ...prev, branch: branchNames[0] }));
          }
        } else {
          setBranches([]);
        }
      } else {
        setRepoValid(false);
        setBranches([]);
      }
    } catch (error) {
      setRepoValid(false);
      setBranches([]);
      console.error('Error validating repository:', error);
    } finally {
      setRepoValidating(false);
      setBranchesLoading(false);
    }
  };

  const handleRepositoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (name === 'repository') {
      // Debounce the validation
      const timeoutId = setTimeout(() => {
        validateRepository(value);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  };

  const handleBranchChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      branch: value
    }));
  };

  const handleRuntimeChange = (value: string) => {
    const runtime = value as 'node' | 'python' | 'bun';
    
    // Update default install command based on runtime
    const defaultInstallCommand = 
      runtime === 'python' ? 'pip install -r requirements.txt' :
      runtime === 'bun' ? 'bun install' :
      'npm install';
    
    setFormData(prev => ({
      ...prev,
      runtime,
      installCommand: defaultInstallCommand
    }));
  };

  const handleCreateApp = async () => {
    if (!formData.appName || !formData.repository || !formData.startCommand) {
      setDeploymentError('App name, repository, and start command are required');
      return;
    }

    if (!socket) {
      setDeploymentError('Socket connection not available');
      return;
    }

    try {
      setDeploymentLoading(true);
      setDeploymentError(null);

      // Parse environment variables
      let envVars: Record<string, string> = {};
      if (formData.envVars.trim()) {
        try {
          envVars = JSON.parse(formData.envVars);
        } catch {
          // Try to parse as key=value pairs
          const lines = formData.envVars.split('\n');
          for (const line of lines) {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
              envVars[key.trim()] = valueParts.join('=').trim();
            }
          }
        }
      }

      const response = await socket.emitWithAck('deploy:from-git', {
        appName: formData.appName,
        repository: formData.repository,
        branch: formData.branch || 'main',
        runtime: formData.runtime,
        buildCommand: formData.buildCommand || undefined,
        installCommand: formData.installCommand || 'npm install',
        startCommand: formData.startCommand,
        envVars
      });

      if (response.success) {
        const queueInfo = response.data;
        setQueueId(queueInfo.queueId);
        setDeploymentSuccess(`${queueInfo.message} - You can track the deployment progress below.`);

        router.push(`/deployments`);
      } else {
        setDeploymentError(response.error || 'Failed to queue deployment');
      }
    } catch (err) {
      setDeploymentError('Failed to deploy application');
      console.error('Error deploying app:', err);
    } finally {
      setDeploymentLoading(false);
    }
  };

  const handleAppClick = (appName: string) => {
    router.push(`/apps/${encodeURIComponent(appName)}`);
  };

  if (loading || !socket) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Applications</h1>
          <Button 
            onClick={fetchApps}
            disabled={loading || !socket}
            variant="primary"
          >
            Refresh
          </Button>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">
            {!socket ? 'Connecting to server...' : 'Loading applications...'}
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Applications</h1>
          <Button 
            onClick={fetchApps}
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Applications</h1>
        <div className="flex items-center space-x-3">
          <Button 
            onClick={() => setShowCreateModal(true)}
            disabled={!socket}
            variant="primary"
          >
            + Create App
          </Button>
          <Button 
            onClick={fetchApps}
            disabled={loading || !socket}
            variant="outline"
          >
            Refresh
          </Button>
        </div>
      </div>
      {apps.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400 text-lg mb-2">No applications found</div>
          <div className="text-gray-400 dark:text-gray-500 text-sm mb-4">Deploy your first application to get started</div>
          <Button 
            onClick={() => setShowCreateModal(true)}
            disabled={!socket}
            variant="primary"
          >
            Create Your First App
          </Button>
        </div>
      ) : (
        <ComponentCard title="Running Applications" desc="Manage your deployed applications">
          <div className="space-y-4">
            {apps.map((app) => {
              return (
                <div
                  key={app.id}
                  onClick={() => handleAppClick(app.name)}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors duration-150 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-lg bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center">
                          <span className="text-brand-600 dark:text-brand-400 font-semibold text-sm">
                            {app.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{app.name}</h3>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <span>ID: {app.id}</span>
                          {app.repository_url && (
                            <span>Repository: {app.repository_url.replace("https://","")}:<span className="font-bold">{app.branch}</span></span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Runtime</div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white uppercase">
                          {app.runtime}
                        </div>
                      </div>
                      <div className="text-gray-400 dark:text-gray-500">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ComponentCard>
      )}

      {/* Create App Modal */}
      <Modal 
        isFullscreen={true}
        isOpen={showCreateModal} 
        onClose={() => {
          setShowCreateModal(false);
          setDeploymentError(null);
          setDeploymentSuccess(null);
          setQueueId(null);
          setRepoValid(false);
          setBranches([]);
        }}
      >
        <div className="bg-white dark:bg-gray-900 p-8">
          <div className="max-w-6xl mx-auto ">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Deploy New Application</h2>
            
            {deploymentError && (
              <div className="mb-6">
                <Alert
                  variant="error"
                  title="Deployment Error"
                  message={deploymentError}
                />
              </div>
            )}

            {deploymentSuccess && (
              <div className="mb-6">
                <Alert
                  variant="success"
                  title="Deployment Queued"
                  message={deploymentSuccess}
                />
              </div>
            )}

            <div className="grid h-full grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                <div>
                  <Label htmlFor="appName">Application Name</Label>
                  <InputField
                    id="appName"
                    name="appName"
                    type="text"
                    placeholder="my-awesome-app"
                    defaultValue={formData.appName}
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <Label htmlFor="repository">GitHub Repository</Label>
                  <div className="relative">
                    <InputField
                      id="repository"
                      name="repository"
                      type="text"
                      placeholder="https://github.com/username/repo.git"
                      defaultValue={formData.repository}
                      onChange={handleRepositoryChange}
                      className={repoValid ? "pr-12" : ""}
                    />
                    {repoValidating && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600"></div>
                      </div>
                    )}
                    {repoValid && !repoValidating && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="branch">Branch</Label>
                  {branches.length > 0 ? (
                    <Select
                      options={branches.map(branch => ({ value: branch, label: branch }))}
                      placeholder={branchesLoading ? "Loading branches..." : "Select a branch"}
                      onChange={handleBranchChange}
                      defaultValue={formData.branch}
                    />
                  ) : (
                    <InputField
                      id="branch"
                      name="branch"
                      type="text"
                      placeholder="main"
                      defaultValue={formData.branch}
                      onChange={handleInputChange}
                      disabled={branchesLoading}
                    />
                  )}
                </div>

                <div>
                  <Label htmlFor="runtime">Runtime Environment</Label>
                  <Select
                    options={[
                      { value: 'node', label: 'Node.js' },
                      { value: 'python', label: 'Python' },
                      { value: 'bun', label: 'Bun' }
                    ]}
                    placeholder="Select runtime"
                    onChange={handleRuntimeChange}
                    defaultValue={formData.runtime}
                  />
                </div>

                <div>
                  <Label htmlFor="startCommand">Start Command</Label>
                  <InputField
                    id="startCommand"
                    name="startCommand"
                    type="text"
                    defaultValue={
                      formData.runtime === 'python' ? 'python app.py' :
                      formData.runtime === 'bun' ? 'bun start' :
                      'npm start'
                    }
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div>
                  <Label htmlFor="installCommand">Install Command (optional)</Label>
                  <InputField
                    id="installCommand"
                    name="installCommand"
                    type="text"
                    placeholder={
                      formData.runtime === 'python' ? 'pip install -r requirements.txt' :
                      "/root/.bun/bin/bun install"
                    }
                    defaultValue={
                      formData.runtime === 'python' ? 'pip install -r requirements.txt' :
                      "/root/.bun/bin/bun install"
                    }
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <Label htmlFor="buildCommand">Build Command (optional)</Label>
                  <InputField
                    id="buildCommand"
                    name="buildCommand"
                    type="text"
                    placeholder={
                      formData.runtime === 'python' ? 'python -m build' :
                      formData.runtime === 'bun' ? 'bun run build' :
                      'npm run build'
                    }
                    defaultValue={formData.buildCommand}
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <Label htmlFor="envVars">Environment Variables (optional)</Label>
                  <TextArea
                    placeholder={`JSON format:
{"NODE_ENV": "production", "PORT": "3000"}

Or key=value format:
NODE_ENV=production
PORT=3000`}
                    value={formData.envVars}
                    onChange={handleTextAreaChange('envVars')}
                    className="h-full"
                    rows={8}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={() => {
                  setShowCreateModal(false);
                  setDeploymentError(null);
                  setDeploymentSuccess(null);
                  setQueueId(null);
                  setRepoValid(false);
                  setBranches([]);
                }}
                variant="outline"
                disabled={deploymentLoading}
                size="md"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateApp}
                variant="primary"
                disabled={deploymentLoading || !socket || !formData.appName || !formData.repository || !formData.startCommand}
                size="md"
              >
                {deploymentLoading ? 'Deploying...' : 'Deploy Application'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
