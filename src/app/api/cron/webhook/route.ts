import { NextResponse } from 'next/server';

/**
 * Webhook endpoint for external cron services
 * This endpoint can be called by:
 * - cron-job.org
 * - EasyCron
 * - UptimeRobot
 * - Any external cron service
 * 
 * Usage:
 * 1. Set up a cron job on an external service (e.g., cron-job.org)
 * 2. Point it to: https://your-domain.com/api/cron/webhook?secret=YOUR_SECRET
 * 3. Set schedule to run every 3 hours (cron format: 0 [star]/3 [star] [star] [star])
 * 
 * The webhook will call the main sync endpoint internally
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  // Verify secret
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid secret' },
      { status: 401 }
    );
  }

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://teslawy.com';
    const syncUrl = `${siteUrl}/api/cron/sync-articles`;
    
    console.log('[Cron Webhook] Triggering sync via internal API call...');
    
    // Call the sync endpoint internally
    const response = await fetch(syncUrl, {
      method: 'GET',
      headers: {
        'Authorization': cronSecret ? `Bearer ${cronSecret}` : '',
        'Content-Type': 'application/json',
      },
      // Use absolute URL for internal fetch
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Cron Webhook] Sync failed:', errorText);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Sync failed',
          details: errorText 
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('[Cron Webhook] Sync completed successfully:', result);

    return NextResponse.json({
      success: true,
      message: 'Sync triggered successfully',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron Webhook] Error triggering sync:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to trigger sync',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

