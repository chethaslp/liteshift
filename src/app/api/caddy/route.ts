import { NextRequest, NextResponse } from 'next/server';
import CaddyManager from '@/lib/caddy';

// GET /api/caddy - Get Caddy status and information
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'status':
        const isRunning = await CaddyManager.isCaddyRunning();
        const status = await CaddyManager.getCaddyStatus();
        const version = await CaddyManager.getCaddyVersion();
        
        return NextResponse.json({
          success: true,
          data: {
            running: isRunning,
            version,
            status
          }
        });

      case 'logs':
        const logs = await CaddyManager.getLogs();
        return NextResponse.json({
          success: true,
          data: { logs }
        });

      case 'config':
        const config = await CaddyManager.generateCaddyfile();
        return NextResponse.json({
          success: true,
          data: { config }
        });

      case 'validate':
        const isValid = await CaddyManager.validateConfig();
        return NextResponse.json({
          success: true,
          data: { valid: isValid }
        });

      case 'domains':
        const { dbHelpers } = await import('@/lib/db');
        const domains = dbHelpers.getAllDomains();
        return NextResponse.json({
          success: true,
          data: { domains }
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Caddy GET error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

// POST /api/caddy - Execute Caddy operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'start':
        await CaddyManager.startCaddy();
        return NextResponse.json({
          success: true,
          message: 'Caddy started successfully'
        });

      case 'stop':
        await CaddyManager.stopCaddy();
        return NextResponse.json({
          success: true,
          message: 'Caddy stopped successfully'
        });

      case 'reload':
        await CaddyManager.reloadCaddy();
        return NextResponse.json({
          success: true,
          message: 'Caddy reloaded successfully'
        });

      case 'regenerate':
        await CaddyManager.writeCaddyfile();
        return NextResponse.json({
          success: true,
          message: 'Caddyfile regenerated successfully'
        });

      case 'add-domain':
        const { appName, domain } = params;
        if (!appName || !domain) {
          return NextResponse.json(
            { success: false, error: 'appName and domain are required' },
            { status: 400 }
          );
        }
        
        await CaddyManager.addDomain(appName, domain);
        return NextResponse.json({
          success: true,
          message: `Domain ${domain} added to app ${appName} successfully`
        });

      case 'remove-domain':
        const { domainId } = params;
        if (!domainId) {
          return NextResponse.json(
            { success: false, error: 'domainId is required' },
            { status: 400 }
          );
        }
        
        await CaddyManager.removeDomain(domainId);
        return NextResponse.json({
          success: true,
          message: 'Domain removed successfully'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Caddy POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

// PUT /api/caddy - Update Caddy configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'update-config':
        // Regenerate and reload Caddyfile
        await CaddyManager.writeCaddyfile();
        
        // Validate before reloading
        const isValid = await CaddyManager.validateConfig();
        if (!isValid) {
          return NextResponse.json(
            { success: false, error: 'Generated configuration is invalid' },
            { status: 400 }
          );
        }
        
        await CaddyManager.reloadCaddy();
        return NextResponse.json({
          success: true,
          message: 'Caddy configuration updated and reloaded successfully'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Caddy PUT error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

// DELETE /api/caddy - Delete operations (domains, etc.)
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const domainId = url.searchParams.get('domainId');

    if (!domainId) {
      return NextResponse.json(
        { success: false, error: 'domainId parameter is required' },
        { status: 400 }
      );
    }

    await CaddyManager.removeDomain(parseInt(domainId));
    return NextResponse.json({
      success: true,
      message: 'Domain removed successfully'
    });
  } catch (error) {
    console.error('Caddy DELETE error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}
