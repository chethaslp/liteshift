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
  const [deploymentError, setDeploymentError] = useState<[string, string] | null>(null);
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
    installCommand: 'bun install',
    startCommand: '',
    envVars: ''
  });
  
  const [deploymentType, setDeploymentType] = useState<'git' | 'file'>('git');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [runtimeDetecting, setRuntimeDetecting] = useState(false);

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

    if(name === 'appName') {
      // check if the appName is already taken
      const existingApp = apps.find(app => app.name === value);
      if (existingApp) {
        setDeploymentError(["App name already exists!", 'Please choose a different name.']);
        return;
      } else {
        setDeploymentError(null);
      }

      // check if appName is valid
      if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
        setDeploymentError(["Invalid app name.", 'Only alphanumeric characters, hyphens, and underscores are allowed.']);
        return;
      }
    }


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

  const detectRuntimeFromRepo = async (owner: string, repo: string, branch: string) => {
    try {
      setRuntimeDetecting(true);
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents?ref=${branch}`);
      
      if (response.ok) {
        const files = await response.json();
        const fileNames = files.map((file: any) => file.name.toLowerCase());
        
        let detectedRuntime: 'node' | 'python' | 'bun' = 'node';
        let installCommand = 'bun install';
        let startCommand = '';
        let buildCommand = '';

        // Detect runtime based on files
        if (fileNames.includes('requirements.txt') || fileNames.includes('pyproject.toml') || fileNames.includes('setup.py')) {
          detectedRuntime = 'python';
          installCommand = 'pip install -r requirements.txt';
          startCommand = 'python app.py';
          buildCommand = '';
        } else if (fileNames.includes('bun.lockb')) {
          detectedRuntime = 'bun';
          installCommand = 'bun install';
          startCommand = 'bun start';
          buildCommand = 'bun run build';
        } else if (fileNames.includes('package.json')) {
          // Check if it's a Node.js project
          detectedRuntime = 'node';
          installCommand = 'bun install'; // Use bun for faster installs even for Node.js
          startCommand = 'npm start';
          buildCommand = 'npm run build';
        }

        // Update form data with detected values
        setFormData(prev => ({
          ...prev,
          runtime: detectedRuntime,
          installCommand,
          startCommand,
          buildCommand
        }));
      }
    } catch (error) {
      console.error('Error detecting runtime:', error);
    } finally {
      setRuntimeDetecting(false);
    }
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
          let selectedBranch = formData.branch;
          if (branchNames.includes('main')) {
            selectedBranch = 'main';
            setFormData(prev => ({ ...prev, branch: 'main' }));
          } else if (branchNames.includes('master')) {
            selectedBranch = 'master';
            setFormData(prev => ({ ...prev, branch: 'master' }));
          } else if (branchNames.length > 0) {
            selectedBranch = branchNames[0];
            setFormData(prev => ({ ...prev, branch: branchNames[0] }));
          }
          
          // Auto-detect runtime for the selected branch
          setFormData(prev => ({ ...prev, appName: ownerRepo.repo }));
          detectRuntimeFromRepo(ownerRepo.owner, ownerRepo.repo, selectedBranch);
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
    
    // Auto-detect runtime when branch changes
    if (formData.repository && repoValid) {
      const ownerRepo = extractOwnerAndRepo(formData.repository);
      if (ownerRepo) {
        detectRuntimeFromRepo(ownerRepo.owner, ownerRepo.repo, value);
      }
    }
  };

  const handleRuntimeChange = (value: string) => {
    const runtime = value as 'node' | 'python' | 'bun';
    
    // Update default commands based on runtime
    const defaultInstallCommand = 
      runtime === 'python' ? 'pip install -r requirements.txt' :
      '/root/.bun/bin/bun install';
    
    const defaultStartCommand = 
      runtime === 'python' ? 'python app.py' :
      runtime === 'bun' ? '/root/.bun/bin/bun start' :
      'npm start';
      
    const defaultBuildCommand = 
      runtime === 'python' ? '' : '/root/.bun/bin/bun run build';
    
    setFormData(prev => ({
      ...prev,
      runtime,
      installCommand: defaultInstallCommand,
      startCommand: defaultStartCommand,
      buildCommand: defaultBuildCommand
    }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('Selected file:', file);
    if (file && (file.type === 'application/zip' || file.type === 'application/x-zip-compressed')) {
      setSelectedFile(file);
    } else {
      setDeploymentError(["Invalid File!", 'Please select a valid ZIP file']);
      setSelectedFile(null);
    }
  };

  const handleDeploymentTypeChange = (value: string) => {
    setDeploymentType(value as 'git' | 'file');
    setDeploymentError(null);
    setDeploymentSuccess(null);
    
    // Reset form data when switching deployment types
    if (value === 'file') {
      setFormData(prev => ({
        ...prev,
        repository: '',
        branch: 'main'
      }));
      setRepoValid(false);
      setBranches([]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleCreateApp = async () => {
    // Validate required fields based on deployment type
    if (deploymentType === 'git') {
      if (!formData.appName || !formData.repository || !formData.startCommand) {
        setDeploymentError(['Fields Missing', 'App name, repository, and start command are required']);
        return;
      }
    } else {
      if (!formData.appName || !selectedFile || !formData.startCommand) {
        setDeploymentError(['Fields Missing', 'App name, file, and start command are required']);
        return;
      }
    }

    if (!socket) {
      setDeploymentError(['Socket Error', 'Socket connection not available']);
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

      let response;
      
      if (deploymentType === 'git') {
        response = await socket.emitWithAck('deploy:from-git', {
          appName: formData.appName,
          repository: formData.repository,
          branch: formData.branch || 'main',
          runtime: formData.runtime,
          buildCommand: formData.buildCommand || undefined,
          installCommand: formData.installCommand || 'bun install',
          startCommand: formData.startCommand,
          envVars
        });
      } else {
        // For file deployment, convert file to buffer
        response = await socket.emitWithAck('deploy:from-file', {
          appName: formData.appName,
          fileBuffer: selectedFile,
          runtime: formData.runtime,
          buildCommand: formData.buildCommand || undefined,
          installCommand: formData.installCommand || 'bun install',
          startCommand: formData.startCommand,
          envVars
        });
      }

      if (response.success) {
        const queueInfo = response.data;
        setQueueId(queueInfo.queueId);
        setDeploymentSuccess(`${queueInfo.message} - You can track the deployment progress below.`);

        router.push(`/deployments`);
      } else {
        setDeploymentError(response.error || 'Failed to queue deployment');
      }
    } catch (err) {
      setDeploymentError(['Failed to deploy application', (err as Error).message || 'An unknown error occurred']);
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
          setSelectedFile(null);
          setDeploymentType('git');
        }}
        showCloseButton={false}
      >
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="flex flex-col h-screen">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
              <div className="max-w-7xl mx-auto px-4 p-5 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                        Deploy New Application
                      </h1>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setDeploymentError(null);
                      setDeploymentSuccess(null);
                      setQueueId(null);
                      setRepoValid(false);
                      setBranches([]);
                      setSelectedFile(null);
                      setDeploymentType('git');
                    }}
                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Alerts */}
                {deploymentError && (
                  <div className="mb-6">
                    <Alert
                      variant="error"
                      title={deploymentError[0]}
                      message={deploymentError[1]}
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

                {/* Deployment Type Selection */}
                <div className="mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      onClick={() => handleDeploymentTypeChange('git')}
                      className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                        deploymentType === 'git'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                          deploymentType === 'git' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                        }`}>
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Deploy from Git</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Connect your GitHub repository</p>
                        </div>
                      </div>
                      {deploymentType === 'git' && (
                        <div className="absolute top-4 right-4">
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      onClick={() => handleDeploymentTypeChange('file')}
                      className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                        deploymentType === 'file'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow-md'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                          deploymentType === 'file' 
                            ? 'bg-green-500 text-white' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                        }`}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Upload ZIP File</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Upload your application code</p>
                        </div>
                      </div>
                      {deploymentType === 'file' && (
                        <div className="absolute top-4 right-4">
                          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Content */}
                <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-6 sm:p-8">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                      {/* Left Column - Basic Info */}
                      <div className="space-y-6">
                        <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                            Application Details
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Configure your application settings
                          </p>
                        </div>

                        <div className="space-y-5">
                          <div>
                            <Label htmlFor="appName">Application Name *</Label>
                            <InputField
                              id="appName"
                              name="appName"
                              type="text"
                              placeholder="my-awesome-app"
                              defaultValue={formData.appName}
                              onChange={handleInputChange}
                              className="mt-2"
                            />
                          </div>

                          {deploymentType === 'git' ? (
                            <>
                              <div>
                                <Label htmlFor="repository">GitHub Repository *</Label>
                                <div className="relative mt-2">
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
                                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
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
                                <Label htmlFor="branch">Branch *</Label>
                                <div className="mt-2">
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
                              </div>
                            </>
                          ) : (
                            <div>
                              <Label htmlFor="file">Upload ZIP File *</Label>
                              <div className="mt-2">
                                <div className={`relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 ${
                                  selectedFile 
                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                }`}>
                                  <input
                                    type="file"
                                    accept=".zip"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                  <div className="text-center">
                                    {selectedFile ? (
                                      <div className="flex items-center justify-center space-x-2">
                                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div>
                                          <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                            {selectedFile.name}
                                          </p>
                                          <p className="text-xs text-green-600 dark:text-green-500">
                                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                          </p>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <div className="mt-4">
                                          <p className="text-sm text-gray-600 dark:text-gray-400">
                                            <span className="font-medium text-blue-600 dark:text-blue-400">Click to upload</span> or drag and drop
                                          </p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ZIP files only</p>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          <div>
                            <div className="flex items-center space-x-2 mb-2">
                              <Label htmlFor="runtime">Runtime Environment *</Label>
                              {runtimeDetecting && (
                                <div className="flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400">
                                  <div className="animate-spin rounded-full h-3 w-3 border border-blue-600 border-t-transparent"></div>
                                  <span>Auto-detecting...</span>
                                </div>
                              )}
                            </div>
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
                            <Label htmlFor="startCommand">Start Command *</Label>
                            <InputField
                              id="startCommand"
                              name="startCommand"
                              type="text"
                              placeholder={
                                formData.runtime === 'python' ? 'python app.py' :
                                formData.runtime === 'bun' ? 'bun start' :
                                'npm start'
                              }
                              defaultValue={formData.startCommand}
                              onChange={handleInputChange}
                              className="mt-2"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right Column - Advanced Settings */}
                      <div className="space-y-6">
                        <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                            Build Configuration
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Optional build and environment settings
                          </p>
                        </div>

                        <div className="space-y-5">
                          <div>
                            <Label htmlFor="installCommand">Install Command</Label>
                            <InputField
                              id="installCommand"
                              name="installCommand"
                              type="text"
                              placeholder={
                                formData.runtime === 'python' ? 'pip install -r requirements.txt' :
                                'bun install'
                              }
                              defaultValue={formData.installCommand}
                              onChange={handleInputChange}
                              className="mt-2"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Command to install dependencies
                            </p>
                          </div>

                          <div>
                            <Label htmlFor="buildCommand">Build Command</Label>
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
                              className="mt-2"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Command to build your application
                            </p>
                          </div>

                          <div>
                            <Label htmlFor="envVars">Environment Variables</Label>
                            <div className="mt-2">
                              <TextArea
                                placeholder={`JSON format:
{"NODE_ENV": "production", "PORT": "3000"}

Or key=value format:
NODE_ENV=production
PORT=3000`}
                                value={formData.envVars}
                                onChange={handleTextAreaChange('envVars')}
                                rows={8}
                                className="font-mono text-sm"
                              />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Set environment variables for your application
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-6 sm:px-8 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {deploymentType === 'git' ? 
                          'Deploying from Git repository' : 
                          'Deploying from uploaded file'
                        }
                      </div>
                      <div className="flex space-x-3">
                        <Button
                          onClick={() => {
                            setShowCreateModal(false);
                            setDeploymentError(null);
                            setDeploymentSuccess(null);
                            setQueueId(null);
                            setRepoValid(false);
                            setBranches([]);
                            setSelectedFile(null);
                            setDeploymentType('git');
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
                          disabled={
                            deploymentLoading || 
                            !socket || 
                            !formData.appName || 
                            !formData.startCommand ||
                            (deploymentType === 'git' && !formData.repository) ||
                            (deploymentType === 'file' && !selectedFile)
                          }
                          size="md"
                          className="min-w-[140px]"
                        >
                          {deploymentLoading ? 
                            <div className="flex items-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                              <span>Deploying...</span>
                            </div>
                            : 'Deploy Application'
                          }
                        </Button>
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
