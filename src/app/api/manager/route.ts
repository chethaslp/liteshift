import { NextRequest, NextResponse } from 'next/server';
import DeploymentManager, { DeploymentOptions } from '@/lib/deployment';

// GET /api/manager - Get deployment information and logs
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const appName = url.searchParams.get('appName');

    switch (action) {
      case 'logs':
        if (!appName) {
          return NextResponse.json(
            { success: false, error: 'appName parameter is required' },
            { status: 400 }
          );
        }
        
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const logs = await DeploymentManager.getDeploymentLogs(appName, limit);
        
        return NextResponse.json({
          success: true,
          data: { logs }
        });

      case 'queue':
        const queueStatus = DeploymentManager.getQueueStatus();
        
        return NextResponse.json({
          success: true,
          data: { queue: queueStatus }
        });

      case 'status':
        const queueId = url.searchParams.get('queueId');
        if (!queueId) {
          return NextResponse.json(
            { success: false, error: 'queueId parameter is required' },
            { status: 400 }
          );
        }
        
        const status = DeploymentManager.getDeploymentStatus(parseInt(queueId));
        if (!status) {
          return NextResponse.json(
            { success: false, error: 'Deployment not found' },
            { status: 404 }
          );
        }
        
        return NextResponse.json({
          success: true,
          data: { status }
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Deployment GET error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

// POST /api/manager - Execute deployment operations
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    // Handle file upload deployment
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const appName = formData.get('appName') as string;
      const startCommand = formData.get('startCommand') as string;
      const buildCommand = formData.get('buildCommand') as string || undefined;
      const installCommand = formData.get('installCommand') as string || 'npm install';
      
      // Parse environment variables if provided
      const envVarsString = formData.get('envVars') as string;
      let envVars: Record<string, string> = {};
      if (envVarsString) {
        try {
          envVars = JSON.parse(envVarsString);
        } catch (error) {
          return NextResponse.json(
            { success: false, error: 'Invalid envVars JSON format' },
            { status: 400 }
          );
        }
      }

      if (!file || !appName || !startCommand) {
        return NextResponse.json(
          { success: false, error: 'file, appName, and startCommand are required' },
          { status: 400 }
        );
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());
      
      const options: DeploymentOptions = {
        appName,
        startCommand,
        buildCommand,
        installCommand,
        envVars
      };

      const result = await DeploymentManager.deployFromFile(options, fileBuffer);
      
      return NextResponse.json({
        success: true,
        data: result
      });
    }

    // Handle JSON requests (Git deployment, redeploy, etc.)
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'deploy-git':
        const { appName, repository, branch, buildCommand, installCommand, startCommand, envVars } = params;
        
        if (!appName || !repository || !startCommand) {
          return NextResponse.json(
            { success: false, error: 'appName, repository, and startCommand are required' },
            { status: 400 }
          );
        }

        const gitOptions: DeploymentOptions = {
          appName,
          repository,
          branch: branch || 'main',
          buildCommand,
          installCommand: installCommand || 'npm install',
          startCommand,
          envVars: envVars || {}
        };

        const gitResult = await DeploymentManager.deployFromGit(gitOptions);
        
        return NextResponse.json({
          success: true,
          data: gitResult
        });

      case 'redeploy':
        const { appName: redeployAppName } = params;
        
        if (!redeployAppName) {
          return NextResponse.json(
            { success: false, error: 'appName is required' },
            { status: 400 }
          );
        }

        const redeployResult = await DeploymentManager.redeploy(redeployAppName);
        
        return NextResponse.json({
          success: true,
          data: redeployResult
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Deployment POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

// PUT /api/manager - Update deployment configurations
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'redeploy':
        // Alternative endpoint for redeploy via PUT
        const { appName } = params;
        
        if (!appName) {
          return NextResponse.json(
            { success: false, error: 'appName is required' },
            { status: 400 }
          );
        }

        const result = await DeploymentManager.redeploy(appName);
        
        return NextResponse.json({
          success: true,
          data: result
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Deployment PUT error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

// DELETE /api/manager - Delete applications
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const appName = url.searchParams.get('appName');

    if (!appName) {
      return NextResponse.json(
        { success: false, error: 'appName parameter is required' },
        { status: 400 }
      );
    }

    await DeploymentManager.deleteApp(appName);
    
    return NextResponse.json({
      success: true,
      message: `App ${appName} deleted successfully`
    });
  } catch (error) {
    console.error('Deployment DELETE error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}
