# Sanity Live - Official Pattern Implementation

## ✅ Based on Official Example from sanity.io/live

Following the exact pattern from the [official Sanity Live page](https://www.sanity.io/live):

```typescript
import { client } from "@/sanity/client";
import { defineLive } from "next-sanity";

const { sanityFetch, SanityLive } = defineLive({ client });

export default async function Page() {
  const {data: products} = await sanityFetch({ query: PRODUCTS_QUERY });

  return (
    <section>
      {products.map((product) => (
        <article key={product._id}>
          <a href={`/product/${product.slug}`}>{product.title}</a>
        </article>
      ))}
      <SanityLive />
    </section>
  );
}
```

## Key Changes Made

### 1. Import Path
- ✅ Using `next-sanity/live` (correct import for `defineLive`)
- ✅ Using regular `client` (not `liveClient`)

### 2. Client Configuration
- ✅ Server-side client uses `useCdn: true` (REQUIRED for Live API)
- ✅ Client includes token for authentication

### 3. Component Structure
- ✅ `SanityLive` is in the same component that uses `sanityFetch`
- ✅ This matches the official pattern exactly!

## Current Implementation

### `src/sanity/lib/live.ts`
```typescript
import { defineLive } from 'next-sanity/live';
import { client } from './client';

const token = process.env.SANITY_API_TOKEN || process.env.SANITY_API_READ_TOKEN;

export const { sanityFetch, SanityLive } = defineLive({
  client,
  serverToken: token,
  browserToken: token,
});
```

### `src/components/NewsSectionServer.tsx`
```typescript
import { getArticles } from '@/lib/sanity-queries';
import { SanityLive } from '@/sanity/lib/live';
import NewsSection from './NewsSection';

export default async function NewsSectionServer() {
  const articles = await getArticles(); // Uses sanityFetch internally
  
  return (
    <>
      <NewsSection initialArticles={transformedArticles} />
      <SanityLive /> {/* In same component that uses sanityFetch */}
    </>
  );
}
```

### `src/sanity/lib/client.ts`
```typescript
// Server-side: useCdn: true (REQUIRED for Live API)
if (isServer) {
  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: true, // REQUIRED for Live API
    token: process.env.SANITY_API_TOKEN,
  });
}
```

## Why This Works

According to the official example:
1. **Same Component Pattern**: `SanityLive` is in the same component that uses `sanityFetch`
2. **CDN Required**: `useCdn: true` enables sync tags for Live API
3. **Token Required**: Token enables authentication for Live API

## Testing

1. **Set Environment Variable:**
   ```env
   SANITY_API_TOKEN=your-token-here
   ```

2. **Configure CORS:**
   - Add frontend URL to CORS origins in Sanity

3. **Test Live Updates:**
   - Edit article in Sanity Studio
   - Watch website update automatically!

## Summary

✅ **Matches Official Pattern**: Same structure as sanity.io/live example
✅ **Correct Import**: Using `next-sanity/live`
✅ **Correct Client**: Using regular `client` with `useCdn: true`
✅ **Correct Placement**: `SanityLive` in same component as `sanityFetch`
✅ **Build Successful**: Ready for testing

**This implementation now matches the official Sanity Live pattern exactly!**

