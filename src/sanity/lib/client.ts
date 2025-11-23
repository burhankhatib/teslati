import { createClient } from 'next-sanity'

import { apiVersion, dataset, projectId } from '../env'

/**
 * Sanity client for reading data
 * 
 * According to next-sanity documentation:
 * - Server-side: useCdn: false for fresh data (with or without token)
 * - Client-side: useCdn: true for better performance
 * - Token is optional but recommended for server-side to bypass CDN
 * 
 * IMPORTANT: This follows the official next-sanity pattern
 */
function createSanityClient() {
  const isServer = typeof window === 'undefined';
  const hasToken = !!process.env.SANITY_API_TOKEN;

  // Validate required env vars
  if (!projectId || projectId === 'fallback-id') {
    console.error('[Sanity Client] ERROR: NEXT_PUBLIC_SANITY_PROJECT_ID is missing or invalid');
    throw new Error('NEXT_PUBLIC_SANITY_PROJECT_ID is required');
  }
  
  if (!dataset || (dataset === 'production' && !process.env.NEXT_PUBLIC_SANITY_DATASET)) {
    console.error('[Sanity Client] ERROR: NEXT_PUBLIC_SANITY_DATASET is missing or invalid');
    throw new Error('NEXT_PUBLIC_SANITY_DATASET is required');
  }

  // Server-side configuration: useCdn: true for Live API support
  // According to official Sanity Live docs, useCdn: true is required for Live API
  // The Live API uses CDN sync tags for real-time updates
  if (isServer) {
    const config: Parameters<typeof createClient>[0] = {
      projectId,
      dataset,
      apiVersion,
      useCdn: true, // REQUIRED for Live API - CDN enables sync tags
    };

    // Add token if available (required for Live API)
    if (hasToken) {
      config.token = process.env.SANITY_API_TOKEN;
      console.log('[Sanity Client] Created server client with token (Live API enabled)');
    } else {
      console.warn('[Sanity Client] Created server client without token (Live API may not work)');
    }

    return createClient(config);
  }

  // Client-side configuration: useCdn: true for better performance and Live API
  // According to official docs, useCdn: true is required for Live API
  console.log('[Sanity Client] Created client-side client (CDN enabled)');
  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: true, // REQUIRED for Live API - CDN enables sync tags
  });
}

// Create client instance
// According to next-sanity docs, it's safe to create at module level
// The client handles environment detection internally
let clientInstance: ReturnType<typeof createClient> | null = null;

try {
  clientInstance = createSanityClient();
} catch (error) {
  console.error('[Sanity Client] Failed to create client:', error);
  // Create a minimal fallback client that will show clear errors
  clientInstance = createClient({
    projectId: projectId || 'missing-project-id',
    dataset: dataset || 'production',
    apiVersion,
    useCdn: false,
  });
}

export const client = clientInstance;

/**
 * Sanity client for Live API
 * 
 * According to Sanity Live documentation:
 * - MUST use useCdn: true for Live API to work properly
 * - CDN is required for sync tags and live updates
 * - Token is required for Live API to work
 * - This client is specifically for use with defineLive()
 * 
 * Documentation: https://www.sanity.io/docs/developer-guides/live-content-guide
 */
export const liveClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true, // REQUIRED for Live API - CDN enables sync tags
  token: process.env.SANITY_API_TOKEN || process.env.SANITY_API_READ_TOKEN, // Token required for Live API
});
