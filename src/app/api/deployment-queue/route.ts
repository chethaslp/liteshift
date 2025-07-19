import { NextRequest, NextResponse } from 'next/server';
import DeploymentManager from '@/lib/deployment';

// GET /api/deployment-queue - Get queue status
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const queueId = url.searchParams.get('queueId');

    switch (action) {
      case 'status':
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

      case 'all':
      default:
        const queueStatus = DeploymentManager.getQueueStatus();
        
        return NextResponse.json({
          success: true,
          data: { queue: queueStatus }
        });
    }
  } catch (error) {
    console.error('Deployment queue GET error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}
