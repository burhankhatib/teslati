import { defineLive } from 'next-sanity/live';
import { client } from './client';

/**
 * Sanity Live configuration for real-time content updates
 * 
 * Based on official example from https://www.sanity.io/live
 * 
 * IMPORTANT: According to official docs, defineLive should use the regular client
 * The client should have useCdn: true for optimal performance
 * 
 * Note: Token needs viewer access rights to fetch draft content.
 * Using SANITY_API_TOKEN (Developer role) which has read/write access.
 */
const token = process.env.SANITY_API_TOKEN || process.env.SANITY_API_READ_TOKEN;

if (!token) {
  throw new Error('Missing SANITY_API_READ_TOKEN or SANITY_API_TOKEN. Live updates require a token with viewer access.');
}

// Export the sanityFetch helper and the SanityLive component
// Using regular client as shown in official example
export const { sanityFetch, SanityLive } = defineLive({
  client,
  serverToken: token,
  browserToken: token,
});
