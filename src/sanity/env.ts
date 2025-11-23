// API version for Sanity - use 'v' prefix format as shown in documentation
// Format: vYYYY-MM-DD (e.g., v2021-03-25)
export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION || 'v2021-03-25'

// Graceful fallbacks to prevent build crashes when env vars are missing
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'fallback-id'
