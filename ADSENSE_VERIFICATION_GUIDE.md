# Google AdSense Verification Guide

## Current Implementation ✅

### 1. AdSense Script
- ✅ Added to `src/app/layout.tsx` using Next.js Script component
- ✅ Loads with `strategy="afterInteractive"` for optimal performance
- ✅ Includes `crossOrigin="anonymous"` for security
- ✅ Publisher ID: `ca-pub-9438547878744657`

### 2. ads.txt File
- ✅ Created at `public/ads.txt`
- ✅ Route handler created at `src/app/ads.txt/route.ts` (backup)
- ✅ Accessible at: `https://yourdomain.com/ads.txt`
- ✅ Content: `google.com, pub-9438547878744657, DIRECT, f08c47fec0942fa0`

## Verification Methods

### Method 1: Meta Tag Verification (Recommended)

If Google AdSense provides a meta tag verification code:

1. **Get the verification code from Google AdSense:**
   - Go to your AdSense account
   - Navigate to Sites → Add site
   - Choose "Add a meta tag to your homepage" option
   - Copy the verification code (looks like: `google-adsense-verification=...`)

2. **Add it to the layout:**
   - Open `src/app/layout.tsx`
   - Find the `verification` section in metadata (around line 96)
   - Uncomment and add your code:
   ```typescript
   verification: {
     other: {
       'google-adsense-verification': 'your-verification-code-here',
     },
   },
   ```

3. **Deploy and verify:**
   - Deploy your changes to production
   - Go back to AdSense and click "Verify"

### Method 2: HTML File Upload

1. **Download the verification file:**
   - In AdSense, choose "Upload HTML file" option
   - Download the file (usually named like `google1234567890.html`)

2. **Add to public folder:**
   - Place the file in `public/` folder
   - It will be accessible at `https://yourdomain.com/google1234567890.html`

3. **Verify in AdSense:**
   - Go back to AdSense and click "Verify"

### Method 3: DNS Verification

1. **Get DNS record from AdSense:**
   - Choose "Add a TXT record to your domain" option
   - Copy the TXT record value

2. **Add to your domain DNS:**
   - Go to your domain registrar (e.g., Namecheap, GoDaddy)
   - Add a TXT record:
     - Name: `@` or your domain name
     - Value: (paste the value from AdSense)
     - TTL: 3600 (or default)

3. **Wait for DNS propagation:**
   - Can take up to 48 hours
   - Use `dig TXT yourdomain.com` to check

## Troubleshooting

### Issue: "Couldn't verify your site"

**Common Causes:**

1. **Site not deployed:**
   - ✅ Make sure your site is deployed to production
   - ✅ Check that changes are live (not just local)

2. **ads.txt not accessible:**
   - ✅ Verify: Visit `https://yourdomain.com/ads.txt` in browser
   - ✅ Should show: `google.com, pub-9438547878744657, DIRECT, f08c47fec0942fa0`
   - ✅ Check browser console for errors

3. **AdSense script not loading:**
   - ✅ Open browser DevTools → Network tab
   - ✅ Filter for "adsbygoogle"
   - ✅ Should see request to `pagead2.googlesyndication.com`
   - ✅ Check for CORS or blocking errors

4. **robots.txt blocking:**
   - ✅ Check `src/app/robots.ts`
   - ✅ Should allow Googlebot (already configured ✅)

5. **Site not publicly accessible:**
   - ✅ Remove any password protection
   - ✅ Remove any IP restrictions
   - ✅ Ensure site is not behind a VPN requirement

### Verification Checklist

- [ ] Site is deployed to production
- [ ] `ads.txt` is accessible at `/ads.txt`
- [ ] AdSense script loads without errors (check browser console)
- [ ] No ad blockers active during verification
- [ ] Site is publicly accessible (no login required)
- [ ] robots.txt allows Googlebot (already configured ✅)
- [ ] Wait 24-48 hours after deployment before verifying

## Testing

### Test ads.txt:
```bash
curl https://yourdomain.com/ads.txt
```

Should return:
```
google.com, pub-9438547878744657, DIRECT, f08c47fec0942fa0
```

### Test AdSense Script:
1. Open your site in browser
2. Open DevTools → Network tab
3. Filter for "adsbygoogle"
4. Should see successful request to `pagead2.googlesyndication.com`

## Next Steps After Verification

Once verified, you can:
1. Create ad units in AdSense dashboard
2. Add ad components to your pages
3. Monitor performance in AdSense reports

## Support

If verification still fails after trying all methods:
1. Check Google AdSense Help Center
2. Use AdSense Troubleshooter
3. Contact AdSense Support with:
   - Your domain URL
   - Verification method used
   - Screenshots of errors
   - Browser console logs

