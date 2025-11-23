# Sanity + Next.js + Vercel 404 Fix Guide

## 🎯 Problem Summary

**Symptom:** Article pages return 404 on Vercel deployment, but work perfectly on local development server.

**Root Causes:**
1. Missing dynamic route configuration in Next.js App Router
2. Invalid Sanity client configuration (`perspective` option not valid for `next-sanity`)
3. Complex Proxy pattern causing client initialization issues
4. Missing error validation and logging

---

## ✅ Complete Fix Checklist

### Step 1: Fix Next.js Dynamic Route Configuration

**File:** `src/app/article/[slug]/page.tsx`

**Add these exports at the top of the file:**

```typescript
// Force dynamic rendering - critical for Vercel deployment
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

// Prevent static generation - all routes must be dynamic
export async function generateStaticParams() {
  return []; // Empty array means no static generation
}
```

**Why:**
- `force-dynamic` tells Next.js to render on-demand (not at build time)
- `dynamicParams = true` allows any slug, not just pre-generated ones
- `revalidate = 0` ensures no caching
- `generateStaticParams()` returning empty array prevents static generation attempts

---

### Step 2: Fix Sanity Client Configuration

**File:** `src/sanity/lib/client.ts`

**Replace the entire file with this correct configuration:**

```typescript
import { createClient } from 'next-sanity'
import { apiVersion, dataset, projectId } from '../env'

/**
 * Sanity client for reading data
 * 
 * According to next-sanity documentation:
 * - Server-side: useCdn: false for fresh data (with or without token)
 * - Client-side: useCdn: true for better performance
 * - Token is optional but recommended for server-side to bypass CDN
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

  // Server-side configuration: useCdn: false for fresh data
  if (isServer) {
    const config: Parameters<typeof createClient>[0] = {
      projectId,
      dataset,
      apiVersion,
      useCdn: false, // Always false on server for fresh data
    };

    // Add token if available (recommended for server-side)
    if (hasToken) {
      config.token = process.env.SANITY_API_TOKEN;
      console.log('[Sanity Client] Created server client with token (fresh data, no CDN)');
    } else {
      console.warn('[Sanity Client] Created server client without token (fresh data, but may hit rate limits)');
    }

    return createClient(config);
  }

  // Client-side configuration: useCdn: true for better performance
  console.log('[Sanity Client] Created client-side client (CDN enabled)');
  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: true, // Use CDN on client for better performance
  });
}

// Create client instance
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
```

**Key Points:**
- ❌ **DO NOT** use `perspective: 'published'` - this is NOT valid for `next-sanity`
- ✅ **DO** use `useCdn: false` on server-side for fresh data
- ✅ **DO** use `useCdn: true` on client-side for performance
- ✅ **DO** validate environment variables and throw clear errors
- ❌ **DO NOT** use Proxy pattern - use direct client creation

---

### Step 3: Fix Slug Decoding

**File:** `src/app/article/[slug]/page.tsx`

**In both `ArticlePage` and `generateMetadata` functions:**

```typescript
const { slug: rawSlug } = await params;

// Decode URL-encoded slug (critical for Arabic URLs)
// Handle case where slug might already be decoded
let slug: string;
try {
  slug = decodeURIComponent(rawSlug);
} catch {
  // If decode fails, slug is already decoded
  slug = rawSlug;
}
```

**Why:** Arabic URLs are URL-encoded, but Next.js params might already be decoded. Handle both cases.

---

### Step 4: Enhance Query Error Handling

**File:** `src/lib/sanity-queries.ts`

**Update `getArticleBySlug` function:**

```typescript
export async function getArticleBySlug(slug: string): Promise<SanityArticle | null> {
  // Safely decode slug
  let normalizedSlug: string;
  try {
    normalizedSlug = decodeURIComponent(slug);
  } catch {
    normalizedSlug = slug;
  }
  
  const query = `*[_type == "article" && slug.current == $slug && isPublished == true][0] {
    // ... your fields
  }`;

  try {
    console.log('[getArticleBySlug] Querying Sanity with slug:', normalizedSlug);
    const article = await client.fetch<SanityArticle | null>(query, { slug: normalizedSlug });
    
    if (article) {
      return article;
    }
    
    // Try with original slug if different
    if (normalizedSlug !== slug) {
      const retryArticle = await client.fetch<SanityArticle | null>(query, { slug });
      if (retryArticle) {
        return retryArticle;
      }
    }
    
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[getArticleBySlug] GROQ query failed');
    console.error('[getArticleBySlug] Slug:', normalizedSlug);
    console.error('[getArticleBySlug] Error:', errorMessage);
    
    // Check for common errors
    if (errorMessage.includes('projectId') || errorMessage.includes('dataset')) {
      console.error('[getArticleBySlug] Configuration error - check environment variables');
    }
    if (errorMessage.includes('CORS') || errorMessage.includes('origin')) {
      console.error('[getArticleBySlug] CORS error - check Sanity CORS settings');
    }
    if (errorMessage.includes('token') || errorMessage.includes('unauthorized')) {
      console.error('[getArticleBySlug] Authentication error - check SANITY_API_TOKEN');
    }
    
    throw error;
  }
}
```

---

### Step 5: Verify Environment Variables

**In Vercel Dashboard → Settings → Environment Variables:**

Required variables:
- ✅ `NEXT_PUBLIC_SANITY_PROJECT_ID` (your Sanity project ID)
- ✅ `NEXT_PUBLIC_SANITY_DATASET` (usually `production`)
- ✅ `SANITY_API_TOKEN` (recommended for server-side fresh data)

**Important:** After adding/updating env vars, you MUST redeploy for changes to take effect.

---

## 🚨 Common Mistakes to Avoid

### ❌ Mistake 1: Using `perspective` with `next-sanity`
```typescript
// ❌ WRONG
createClient({
  perspective: 'published', // NOT valid for next-sanity!
})

// ✅ CORRECT
createClient({
  useCdn: false, // Use this instead
  token: process.env.SANITY_API_TOKEN, // Optional but recommended
})
```

### ❌ Mistake 2: Missing Dynamic Route Configuration
```typescript
// ❌ WRONG - Next.js tries to statically generate
export default async function ArticlePage({ params }) {
  // ...
}

// ✅ CORRECT
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export async function generateStaticParams() {
  return [];
}

export default async function ArticlePage({ params }) {
  // ...
}
```

### ❌ Mistake 3: Using Proxy Pattern
```typescript
// ❌ WRONG - Complex and can cause issues
export const client = new Proxy({}, {
  get(_target, prop) {
    // Complex proxy logic
  },
});

// ✅ CORRECT - Simple and reliable
let clientInstance = createSanityClient();
export const client = clientInstance;
```

### ❌ Mistake 4: Not Decoding Slugs
```typescript
// ❌ WRONG - Arabic URLs will fail
const { slug } = await params;
const article = await getArticleBySlug(slug);

// ✅ CORRECT - Handle encoding
const { slug: rawSlug } = await params;
let slug: string;
try {
  slug = decodeURIComponent(rawSlug);
} catch {
  slug = rawSlug;
}
const article = await getArticleBySlug(slug);
```

### ❌ Mistake 5: Silent Error Handling
```typescript
// ❌ WRONG - No visibility into failures
try {
  return await client.fetch(query);
} catch (error) {
  return null; // Silent failure
}

// ✅ CORRECT - Log errors for debugging
try {
  return await client.fetch(query);
} catch (error) {
  console.error('[Function] Error details:', error);
  console.error('[Function] Query:', query);
  throw error; // Or return null with logging
}
```

---

## 📋 Verification Checklist

After applying fixes, verify:

- [ ] Build succeeds on Vercel
- [ ] Article pages load (not 404)
- [ ] Check Vercel Function Logs for:
  - `[Sanity Client] Created server client with token`
  - `[getArticleBySlug] Querying Sanity`
  - No `perspective` related errors
- [ ] Test with Arabic slugs (if applicable)
- [ ] Environment variables are set in Vercel
- [ ] Sanity CORS settings include Vercel domain

---

## 🔍 Debugging in Vercel

### Check Function Logs:
1. Vercel Dashboard → Your Project → Functions
2. Click on a function execution
3. Look for log messages starting with `[Sanity Client]` or `[getArticleBySlug]`

### Success Indicators:
```
[Sanity Client] Created server client with token (fresh data, no CDN)
[getArticleBySlug] Querying Sanity with slug: your-slug
[getArticleBySlug] Article found: article-id-123
```

### Error Indicators:
```
[Sanity Client] ERROR: NEXT_PUBLIC_SANITY_PROJECT_ID is missing
[getArticleBySlug] GROQ query failed
[getArticleBySlug] Configuration error - check environment variables
```

---

## 📚 Key Takeaways

1. **Always use `force-dynamic` for dynamic routes on Vercel**
2. **Never use `perspective` option with `next-sanity`** - it's not valid
3. **Server-side: `useCdn: false`** for fresh data
4. **Client-side: `useCdn: true`** for performance
5. **Always decode slugs** to handle URL encoding
6. **Validate environment variables** and throw clear errors
7. **Add comprehensive logging** for debugging in production

---

## 🎯 Quick Reference

### Correct Sanity Client Pattern:
```typescript
import { createClient } from 'next-sanity'

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2025-11-18',
  useCdn: typeof window === 'undefined' ? false : true, // false on server, true on client
  token: process.env.SANITY_API_TOKEN, // Optional but recommended for server
})
```

### Correct Dynamic Route Pattern:
```typescript
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export async function generateStaticParams() {
  return [];
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  // ... your code
}
```

---

## 📖 References

- [Next.js App Router Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [next-sanity Documentation](https://www.sanity.io/docs/js-client)
- [Sanity GROQ Queries](https://www.sanity.io/docs/groq)
- [Vercel Deployment Troubleshooting](https://vercel.com/docs/concepts/deployments/troubleshooting)

---

**Last Updated:** Based on successful fix for teslati project  
**Tested On:** Next.js 16.0.3, next-sanity 11.6.7, Vercel deployment

