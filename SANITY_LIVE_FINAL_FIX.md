# Sanity Live Final Fix - Complete Solution

## ✅ All Issues Fixed

### 1. Token Configuration
- ✅ Updated to use `SANITY_API_TOKEN` first (Developer role)
- ✅ Added token to `liveClient` configuration

### 2. Client Configuration
- ✅ `liveClient` uses `useCdn: true` (required for Live API)
- ✅ `liveClient` includes token for authentication

### 3. Component Structure
- ✅ `SanityLive` component rendered directly in server layout
- ✅ Server components use `sanityFetch` for data fetching
- ✅ Client components receive data as props

## Files Modified

1. **`src/sanity/lib/client.ts`**
   - Added token to `liveClient` configuration
   - `liveClient` now has: `useCdn: true` + `token`

2. **`src/sanity/lib/live.ts`**
   - Token priority: `SANITY_API_TOKEN` first
   - Exports `sanityFetch` and `SanityLive`

3. **`src/app/layout.tsx`**
   - Renders `<SanityLive />` directly (server component)

4. **`src/app/page.tsx`**
   - Server component using `sanityFetch` via `NewsSectionServer`

5. **`src/components/NewsSectionServer.tsx`**
   - Server component that uses `getArticles()` (which uses `sanityFetch`)

## How It Works Now

### Data Flow:
```
Sanity Studio (edit article)
    ↓
Sanity Live API (emits event with sync tags)
    ↓
SanityLive component (listens for events)
    ↓
sanityFetch (refetches data when tags match)
    ↓
Server Component (re-renders with new data)
    ↓
Client Component (updates UI automatically)
```

## Critical Configuration

### 1. Environment Variable
```env
SANITY_API_TOKEN=your-token-here
```
**Required:** Token must have Developer role (read/write access)

### 2. CORS Configuration
1. Go to [sanity.io/manage](https://sanity.io/manage)
2. Select your project
3. Go to **API** → **CORS origins**
4. Add these URLs:
   - `http://localhost:3000` (development)
   - `https://teslawy.com` (production)
   - `https://*.vercel.app` (Vercel previews)

### 3. Client Configuration
```typescript
// src/sanity/lib/client.ts
export const liveClient = createClient({
  projectId,
  dataset,
  apiVersion: 'v2021-03-25',
  useCdn: true, // REQUIRED
  token: process.env.SANITY_API_TOKEN, // REQUIRED
});
```

### 4. Live Configuration
```typescript
// src/sanity/lib/live.ts
export const { sanityFetch, SanityLive } = defineLive({
  client: liveClient,
  serverToken: process.env.SANITY_API_TOKEN,
  browserToken: process.env.SANITY_API_TOKEN,
});
```

## Testing Instructions

### Step 1: Verify Setup
```bash
# Check environment variable
echo $SANITY_API_TOKEN

# Build should succeed
npm run build
```

### Step 2: Test Live Updates

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Open website:**
   - `http://localhost:3000`

3. **Open browser DevTools:**
   - Console tab
   - Network tab (filter: WS for WebSocket)

4. **Open Sanity Studio:**
   - Edit an article title
   - Publish changes

5. **Watch website:**
   - Should update automatically!
   - Check console for Live API messages
   - Check Network for WebSocket connections

### Step 3: Verify Live Updates

**Expected Behavior:**
- ✅ Article title changes immediately
- ✅ No page refresh needed
- ✅ Console shows Live API activity
- ✅ Network shows WebSocket to `*.sanity.io`

**If Not Working:**
- ❌ Check `SANITY_API_TOKEN` is set
- ❌ Verify CORS origins include your URL
- ❌ Check browser console for errors
- ❌ Verify WebSocket connection in Network tab

## Troubleshooting

### Issue: Content Not Updating

**Check:**
1. ✅ `SANITY_API_TOKEN` environment variable is set
2. ✅ Token has Developer role (read/write)
3. ✅ CORS origins include your frontend URL
4. ✅ `liveClient` uses `useCdn: true`
5. ✅ `liveClient` includes token
6. ✅ `<SanityLive />` is in layout
7. ✅ Server components use `sanityFetch`

**Debug:**
```bash
# Check token
echo $SANITY_API_TOKEN

# Check build
npm run build

# Check browser console
# Look for WebSocket connections in Network tab
```

### Issue: Build Errors

**Error:** `defineLive can only be used in React Server Components`
- **Fix:** Ensure `defineLive` is called in server-side file (`src/sanity/lib/live.ts`)
- **Fix:** Import `SanityLive` in server component (layout.tsx)

**Error:** `Cannot find name 'SanityLive'`
- **Fix:** Import: `import { SanityLive } from "@/sanity/lib/live"`

### Issue: WebSocket Not Connecting

**Check:**
1. CORS origins configured correctly
2. Token has correct permissions
3. Network allows WebSocket connections
4. Browser supports WebSockets

## Summary

✅ **Fixed:** Token configuration
✅ **Fixed:** Client configuration (useCdn + token)
✅ **Fixed:** Component structure
✅ **Fixed:** Build errors
✅ **Verified:** Build successful

**Sanity Live should now work correctly!**

When you edit articles in Sanity Studio, changes will appear on your website automatically without page refresh.

## Next Steps

1. ✅ Set `SANITY_API_TOKEN` environment variable
2. ✅ Configure CORS origins in Sanity
3. ✅ Test live updates
4. ✅ Deploy to production
5. ✅ Add production URL to CORS origins

## Documentation References

- [Sanity Live Content Guide](https://www.sanity.io/docs/developer-guides/live-content-guide)
- [next-sanity Live API](https://github.com/sanity-io/next-sanity#live-content-api)

