import { NextResponse } from 'next/server';
import { adminClient } from '@/sanity/lib/adminClient';

/**
 * DELETE ALL ARTICLES FROM SANITY
 * 
 * WARNING: This endpoint permanently deletes ALL articles from Sanity.
 * Use with extreme caution!
 * 
 * Authentication: Requires CRON_SECRET or root-admin authentication
 */
export async function DELETE(request: Request) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Allow if CRON_SECRET matches OR if it's a Vercel cron call
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    const isAuthorized = 
      isVercelCron || 
      (cronSecret && authHeader === `Bearer ${cronSecret}`);
    
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized. This is a destructive operation.' },
        { status: 401 }
      );
    }

    console.log('[Delete All Articles] Starting deletion of all articles...');

    // Fetch all article IDs
    const allArticles = await adminClient.fetch<Array<{ _id: string }>>(
      `*[_type == "article"]{ _id }`
    );

    const articleIds = allArticles.map(article => article._id);
    const totalCount = articleIds.length;

    console.log(`[Delete All Articles] Found ${totalCount} articles to delete`);

    if (totalCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No articles found to delete',
        deleted: 0,
      });
    }

    // Delete all articles in batches (Sanity has limits)
    const batchSize = 50;
    let deletedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < articleIds.length; i += batchSize) {
      const batch = articleIds.slice(i, i + batchSize);
      
      try {
        // Delete batch
        await Promise.all(
          batch.map(id => adminClient.delete(id))
        );
        
        deletedCount += batch.length;
        console.log(`[Delete All Articles] Deleted ${deletedCount}/${totalCount} articles...`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Batch ${i / batchSize + 1}: ${errorMsg}`);
        console.error(`[Delete All Articles] Error deleting batch:`, error);
      }
    }

    console.log(`[Delete All Articles] ✓ Completed: ${deletedCount}/${totalCount} articles deleted`);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} out of ${totalCount} articles`,
      deleted: deletedCount,
      total: totalCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Delete All Articles] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check article count (safety check)
 */
export async function GET() {
  try {
    const count = await adminClient.fetch<number>(
      `count(*[_type == "article"])`
    );

    return NextResponse.json({
      articleCount: count,
      message: `There are currently ${count} articles in Sanity`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

