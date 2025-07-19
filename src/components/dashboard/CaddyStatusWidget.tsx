'use client';

import React, { useEffect, useState } from 'react';
import ComponentCard from '@/components/common/ComponentCard';
import Badge from '@/components/ui/badge/Badge';
import Button from '@/components/ui/button/Button';
import { FaPlay, FaStop, FaRedo, FaCog } from 'react-icons/fa';
import Link from 'next/link';

interface CaddyStatus {
  running: boolean;
  version: string;
  status: any;
}

interface CaddyStatusWidgetProps {
  showActions?: boolean;
  refreshInterval?: number;
}

export default function CaddyStatusWidget({ 
  showActions = true, 
  refreshInterval = 10000 
}: CaddyStatusWidgetProps) {
  const [status, setStatus] = useState<CaddyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/caddy?action=status');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch Caddy status');
      }
    } catch (err) {
      setError('Failed to fetch Caddy status');
      console.error('Error fetching Caddy status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    const interval = setInterval(fetchStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

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
        setTimeout(fetchStatus, 1000);
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

  const getStatusBadgeColor = (running: boolean) => {
    return running ? 'success' : 'error';
  };

  if (loading) {
    return (
      <ComponentCard title="Caddy Status" desc="Web server and reverse proxy status">
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </ComponentCard>
    );
  }

  if (error) {
    return (
      <ComponentCard title="Caddy Status" desc="Web server and reverse proxy status">
        <div className="space-y-4">
          <div className="text-red-500 dark:text-red-400">{error}</div>
          <Button
            onClick={fetchStatus}
            variant="outline"
            size="sm"
          >
            Retry
          </Button>
        </div>
      </ComponentCard>
    );
  }

  return (
    <ComponentCard title="Caddy Status" desc="Web server and reverse proxy status">
      <div className="space-y-4">
        {status && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Badge 
                  color={getStatusBadgeColor(status.running)} 
                  size="sm"
                >
                  {status.running ? 'Running' : 'Stopped'}
                </Badge>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  v{status.version || 'Unknown'}
                </span>
              </div>
              <Link href="/caddy">
                <Button variant="outline" size="sm">
                  <FaCog className="mr-1" />
                  Manage
                </Button>
              </Link>
            </div>
            
            {showActions && (
              <div className="grid grid-cols-3 gap-2">
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
            )}
          </>
        )}
      </div>
    </ComponentCard>
  );
}
