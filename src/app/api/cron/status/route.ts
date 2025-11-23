import { NextResponse } from 'next/server';
import { adminClient } from '@/sanity/lib/adminClient';
import { fetchRSSFeed } from '@/lib/rss-parser';
import { fetchWordPressArticles } from '@/lib/wordpress-fetcher';

/**
 * Status endpoint for cron-job.org monitoring
 * Provides system health, article counts, and sync status
 * 
 * Usage: https://www.teslawy.com/api/cron/status
 * 
 * This endpoint is designed to be monitored by cron-job.org
 * to verify the system is running correctly
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Check if client wants HTML format
  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'json';
  
  try {
    // Check Sanity connection
    let sanityStatus = 'unknown';
    let articleCount = 0;
    let sanityError: string | null = null;
    
    try {
      // Get total article count
      articleCount = await adminClient.fetch<number>(
        `count(*[_type == "article"])`
      );
      sanityStatus = 'connected';
    } catch (error) {
      sanityStatus = 'error';
      sanityError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    // Check RSS feeds availability
    let rssStatus = 'unknown';
    let rssError: string | null = null;
    
    try {
      await fetchRSSFeed();
      rssStatus = 'connected';
    } catch (error) {
      rssStatus = 'error';
      rssError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    // Check WordPress APIs availability
    let wpStatus = 'unknown';
    let wpError: string | null = null;
    
    try {
      await fetchWordPressArticles();
      wpStatus = 'connected';
    } catch (error) {
      wpStatus = 'error';
      wpError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    // Calculate overall system health
    const isHealthy = 
      sanityStatus === 'connected' && 
      (rssStatus === 'connected' || wpStatus === 'connected');
    
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Prepare simple response
    const status = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp,
      responseTime: `${responseTime}ms`,
      articles: articleCount,
      health: {
        sanity: sanityStatus,
        rss: rssStatus,
        wordpress: wpStatus,
      },
    };
    
    // Return appropriate HTTP status based on health
    const httpStatus = isHealthy ? 200 : 503;
    
    // Return HTML format if requested
    if (format === 'html') {
      const html = generateStatusHTML(status, httpStatus);
      return new NextResponse(html, {
        status: httpStatus,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }
    
    return NextResponse.json(status, { status: httpStatus });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json(
      {
        status: 'error',
        timestamp,
        responseTime: `${responseTime}ms`,
        error: 'Failed to check system status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate simple HTML status page
 */
function generateStatusHTML(status: any, httpStatus: number): string {
  const statusColor = status.status === 'healthy' ? '#10b981' : '#ef4444';
  const statusIcon = status.status === 'healthy' ? '✅' : '⚠️';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>System Status</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      width: 100%;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 2rem;
      margin-bottom: 10px;
    }
    .status-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      background: ${statusColor};
      color: white;
      font-weight: bold;
      margin-top: 10px;
      font-size: 0.875rem;
    }
    .content {
      padding: 30px;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .stat-row:last-child {
      border-bottom: none;
    }
    .stat-label {
      color: #6b7280;
      font-size: 0.875rem;
    }
    .stat-value {
      font-weight: bold;
      color: #1e3a8a;
    }
    .health-status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: bold;
      text-transform: uppercase;
    }
    .health-status.connected {
      background: #d1fae5;
      color: #065f46;
    }
    .health-status.error {
      background: #fee2e2;
      color: #991b1b;
    }
    .health-status.unknown {
      background: #fef3c7;
      color: #92400e;
    }
    .footer {
      background: #f9fafb;
      padding: 20px;
      text-align: center;
      color: #6b7280;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${statusIcon} System Status</h1>
      <div class="status-badge">${status.status.toUpperCase()}</div>
    </div>
    
    <div class="content">
      <div class="stat-row">
        <span class="stat-label">Articles</span>
        <span class="stat-value">${status.articles}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Sanity CMS</span>
        <span class="health-status ${status.health.sanity}">${status.health.sanity}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">RSS Feeds</span>
        <span class="health-status ${status.health.rss}">${status.health.rss}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">WordPress APIs</span>
        <span class="health-status ${status.health.wordpress}">${status.health.wordpress}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Response Time</span>
        <span class="stat-value">${status.responseTime}</span>
      </div>
    </div>
    
    <div class="footer">
      <p>Last checked: ${new Date(status.timestamp).toLocaleString()}</p>
      <p>HTTP Status: ${httpStatus}</p>
    </div>
  </div>
</body>
</html>`;
}

