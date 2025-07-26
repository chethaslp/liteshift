
export interface Credential {
    username: string;
    password: string;
    host: string;
}


/**
 * User model representing the users table
 */
export interface User {
    id: number;
    username: string;
    password_hash: string;
    email?: string;
    role: string;
    created_at: string; // ISO date string
    last_login?: string; // ISO date string
}

/**
 * App model representing the apps table
 */
export interface App {
    id: number;
    name: string;
    repository_url: string | null;
    branch: string;
    build_command: string | null;
    install_command: string;
    start_command: string;
    runtime: 'node' | 'python' | 'bun';
    created_at: string; // ISO date string
    updated_at: string; // ISO date string
}

/**
 * AppDomain model representing the app_domains table
 */
export interface AppDomain {
    id: number;
    app_id: number;
    domain: string;
    is_primary: boolean;
    ssl_enabled: boolean;
    created_at: string; // ISO date string
}

/**
 * AppEnvVar model representing the app_env_vars table
 */
export interface AppEnvVar {
    id: number;
    app_id: number;
    key: string;
    value: string;
    created_at: string; // ISO date string
}

/**
 * Deployment model representing the deployments table
 */
export interface Deployment {
    id: number;
    app_id: number;
    status: string;
    log?: string;
    deployed_at: string; // ISO date string
}

/**
 * DeploymentQueueItem model representing the deployment_queue table
 */
export interface DeploymentQueueItem {
    id: number;
    app_name: string;
    type: 'git' | 'file';
    status: 'queued' | 'building' | 'completed' | 'failed';
    options: string; // JSON string typically
    logs: string;
    created_at: string; // ISO date string
    started_at?: string; // ISO date string
    completed_at?: string; // ISO date string
    error_message?: string;
}

/**
 * Setting model representing the settings table
 */
export interface Setting {
    id: number;
    key: string;
    value: string;
    updated_at: string; // ISO date string
}

/**
 * Enhanced SystemD Service Status model from systemctl:status response
 */
export interface ServiceStatus {
    name: string;
    status: 'active' | 'inactive' | 'failed' | 'unknown';
    enabled: boolean;
    description: string;
    runtime: 'node' | 'python' | 'bun';
    cwd?: string;
    // Enhanced parsed systemctl status information
    loaded: {
        state: 'loaded' | 'not-found' | 'bad-setting' | 'error' | 'masked';
        path: string;
        enabled: 'enabled' | 'disabled' | 'static' | 'masked';
        preset: 'enabled' | 'disabled';
    };
    active: {
        state: 'active' | 'inactive' | 'failed' | 'activating' | 'deactivating';
        subState: string;
        since: string;
        duration: string;
    };
    mainPid?: {
        pid: number;
        command: string;
    };
    tasks?: {
        current: number;
        limit: number;
    };
    memory?: {
        current: string;
        peak?: string;
        currentBytes?: number;
        peakBytes?: number;
    };
    cpu?: {
        usage?: string;
        usageNSec?: number;
    };
    cgroup?: {
        path: string;
        processes: Array<{
            pid: number;
            command: string;
        }>;
    };
}