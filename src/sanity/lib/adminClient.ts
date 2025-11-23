import { createClient } from '@sanity/client'
import { apiVersion, dataset, projectId } from '../env'

/**
 * Admin client with write permissions
 * Uses token from environment variable for write operations
 * This client is used for creating/updating documents in Sanity
 * 
 * Note: This is only used in API routes, not in client components
 * Lazy initialization to avoid issues during build/compile time
 */
function createAdminClient() {
  if (!process.env.SANITY_API_TOKEN) {
    throw new Error('SANITY_API_TOKEN environment variable is not set. Please add it to your .env.local file.')
  }

  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false, // Always use fresh data for admin operations
    token: process.env.SANITY_API_TOKEN,
    perspective: 'published',
  })
}

// Lazy getter - only creates client when actually used
let _adminClient: ReturnType<typeof createClient> | undefined

export const adminClient = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    if (!_adminClient) {
      _adminClient = createAdminClient()
    }
    const value = _adminClient[prop as keyof typeof _adminClient]
    return typeof value === 'function' ? value.bind(_adminClient) : value
  },
})

