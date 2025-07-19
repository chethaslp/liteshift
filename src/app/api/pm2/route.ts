import { NextRequest, NextResponse } from 'next/server';
import PM2Manager from '@/lib/pm2';

// GET /api/pm2 - Get PM2 information and logs
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const appName = url.searchParams.get('appName');

    switch (action) {
      case 'list':
        const processes = await PM2Manager.list();
        return NextResponse.json({
          success: true,
          data: processes 
        });

      case 'logs':
        if (!appName) {
          return NextResponse.json(
            { success: false, error: 'appName parameter is required' },
            { status: 400 }
          );
        }
        
        const lines = parseInt(url.searchParams.get('lines') || '100');
        const logs = await PM2Manager.logs(appName, lines);
        
        return NextResponse.json({
          success: true,
          data: { logs }
        });

      case 'info':
        if (!appName) {
          return NextResponse.json(
            { success: false, error: 'appName parameter is required' },
            { status: 400 }
          );
        }
        
        const processInfo = await PM2Manager.getProcessInfo(appName);
        
        return NextResponse.json({
          success: true,
          data: { process: processInfo }
        });

      case 'log-paths':
        if (!appName) {
          return NextResponse.json(
            { success: false, error: 'appName parameter is required' },
            { status: 400 }
          );
        }
        
        const logPaths = await PM2Manager.getLogPaths(appName);
        
        return NextResponse.json({
          success: true,
          data: { logPaths }
        });

      case 'startup':
        const startupCommand = await PM2Manager.startup();
        
        return NextResponse.json({
          success: true,
          data: { command: startupCommand }
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('PM2 GET error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

// POST /api/pm2 - Execute PM2 operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, appName, ...params } = body;

    switch (action) {
      case 'start':
        const { scriptPath, options = {} } = params;
        
        if (!appName || !scriptPath) {
          return NextResponse.json(
            { success: false, error: 'appName and scriptPath are required' },
            { status: 400 }
          );
        }

        await PM2Manager.start(appName, scriptPath, options);
        
        return NextResponse.json({
          success: true,
          message: `Application ${appName} started successfully`
        });

      case 'stop':
        if (!appName) {
          return NextResponse.json(
            { success: false, error: 'appName is required' },
            { status: 400 }
          );
        }

        await PM2Manager.stop(appName);
        
        return NextResponse.json({
          success: true,
          message: `Application ${appName} stopped successfully`
        });

      case 'restart':
        if (!appName) {
          return NextResponse.json(
            { success: false, error: 'appName is required' },
            { status: 400 }
          );
        }

        await PM2Manager.restart(appName);
        
        return NextResponse.json({
          success: true,
          message: `Application ${appName} restarted successfully`
        });

      case 'reload':
        if (!appName) {
          return NextResponse.json(
            { success: false, error: 'appName is required' },
            { status: 400 }
          );
        }

        await PM2Manager.reload(appName);
        
        return NextResponse.json({
          success: true,
          message: `Application ${appName} reloaded successfully`
        });

      case 'delete':
        if (!appName) {
          return NextResponse.json(
            { success: false, error: 'appName is required' },
            { status: 400 }
          );
        }

        await PM2Manager.delete(appName);
        
        return NextResponse.json({
          success: true,
          message: `Application ${appName} deleted successfully`
        });

      case 'flush':
        await PM2Manager.flush(appName);
        
        return NextResponse.json({
          success: true,
          message: appName ? `Logs flushed for ${appName}` : 'All logs flushed successfully'
        });

      case 'save':
        await PM2Manager.save();
        
        return NextResponse.json({
          success: true,
          message: 'PM2 configuration saved successfully'
        });

      case 'reset':
        if (!appName) {
          return NextResponse.json(
            { success: false, error: 'appName is required' },
            { status: 400 }
          );
        }

        await PM2Manager.reset(appName);
        
        return NextResponse.json({
          success: true,
          message: `Application ${appName} counters reset successfully`
        });

      case 'signal':
        const { signal } = params;
        
        if (!appName || !signal) {
          return NextResponse.json(
            { success: false, error: 'appName and signal are required' },
            { status: 400 }
          );
        }

        await PM2Manager.sendSignal(signal, appName);
        
        return NextResponse.json({
          success: true,
          message: `Signal ${signal} sent to ${appName} successfully`
        });

      case 'monit':
        await PM2Manager.monit();
        
        return NextResponse.json({
          success: true,
          message: 'PM2 monitoring started'
        });

      case 'unstartup':
        await PM2Manager.unstartup();
        
        return NextResponse.json({
          success: true,
          message: 'PM2 startup script removed successfully'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('PM2 POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

// PUT /api/pm2 - Update PM2 processes
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, appName, ...params } = body;

    switch (action) {
      case 'update-env':
        const { env } = params;
        
        if (!appName || !env) {
          return NextResponse.json(
            { success: false, error: 'appName and env are required' },
            { status: 400 }
          );
        }

        await PM2Manager.updateEnv(appName, env);
        
        return NextResponse.json({
          success: true,
          message: `Environment variables updated for ${appName}`
        });

      case 'restart':
        // Alternative endpoint for restart via PUT
        if (!appName) {
          return NextResponse.json(
            { success: false, error: 'appName is required' },
            { status: 400 }
          );
        }

        await PM2Manager.restart(appName);
        
        return NextResponse.json({
          success: true,
          message: `Application ${appName} restarted successfully`
        });

      case 'reload':
        // Alternative endpoint for reload via PUT
        if (!appName) {
          return NextResponse.json(
            { success: false, error: 'appName is required' },
            { status: 400 }
          );
        }

        await PM2Manager.reload(appName);
        
        return NextResponse.json({
          success: true,
          message: `Application ${appName} reloaded successfully`
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('PM2 PUT error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

// DELETE /api/pm2 - Delete PM2 processes
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

    await PM2Manager.delete(appName);
    
    return NextResponse.json({
      success: true,
      message: `Application ${appName} deleted successfully`
    });
  } catch (error) {
    console.error('PM2 DELETE error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}
