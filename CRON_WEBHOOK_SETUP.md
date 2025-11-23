# Cron Job Webhook Setup Guide

## Problem
Vercel Cron Jobs can be unreliable and may not run automatically as scheduled. This guide provides a smart alternative using external cron services.

## Solution
We've created a webhook endpoint (`/api/cron/webhook`) that can be called by external cron services. This provides:
- ✅ Reliable scheduling (external services are more reliable than Vercel Cron)
- ✅ Better monitoring and logging
- ✅ Email notifications on failures
- ✅ Multiple backup options

## Setup Instructions

### Option 1: cron-job.org (Recommended - Free)

1. **Sign up** at [https://cron-job.org](https://cron-job.org) (free account)

2. **Create a new cron job**:
   - **Title**: `Teslawy Article Sync`
   - **URL**: `https://teslawy.com/api/cron/webhook?secret=YOUR_SECRET`
   - **Schedule**: `0 */3 * * *` (every 3 hours)
   - **Request Method**: `GET`
   - **Status**: `Active`

3. **Get your secret**:
   - Add `CRON_SECRET` to your Vercel environment variables
   - Use a strong random string (e.g., generate with: `openssl rand -hex 32`)

4. **Test the webhook**:
   - Click "Run now" in cron-job.org
   - Check Vercel logs to verify it's working

### Option 2: EasyCron (Free tier available)

1. **Sign up** at [https://www.easycron.com](https://www.easycron.com)

2. **Create a new cron job**:
   - **Cron Job Name**: `Teslawy Article Sync`
   - **URL**: `https://teslawy.com/api/cron/webhook?secret=YOUR_SECRET`
   - **Schedule**: `0 */3 * * *` (every 3 hours)
   - **HTTP Method**: `GET`

3. **Configure notifications**:
   - Enable email notifications for failures
   - Set up monitoring alerts

### Option 3: UptimeRobot (Free - 50 monitors)

1. **Sign up** at [https://uptimerobot.com](https://uptimerobot.com)

2. **Create a new HTTP(S) Monitor**:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `Teslawy Article Sync`
   - **URL**: `https://teslawy.com/api/cron/webhook?secret=YOUR_SECRET`
   - **Monitoring Interval**: `Every 3 hours` (180 minutes)

3. **Set up alerts**:
   - Configure email/SMS alerts for failures

### Option 4: GitHub Actions (Free for public repos)

Create `.github/workflows/sync-articles.yml`:

```yaml
name: Sync Articles

on:
  schedule:
    - cron: '0 */3 * * *'  # Every 3 hours
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X GET "https://teslawy.com/api/cron/webhook?secret=${{ secrets.CRON_SECRET }}"
```

## Environment Variables

Add to Vercel:
- `CRON_SECRET`: A strong random secret string (required for security)

## Security

The webhook endpoint requires a secret parameter:
- ✅ Prevents unauthorized access
- ✅ Protects against DDoS attacks
- ✅ Ensures only authorized services can trigger syncs

## Monitoring

### Check Sync Status

1. **Vercel Logs**:
   - Go to Vercel Dashboard → Your Project → Logs
   - Filter by `/api/cron/webhook` or `/api/cron/sync-articles`
   - Look for success/error messages

2. **External Service Logs**:
   - Check your cron service dashboard
   - Review execution history
   - Check for failures

### Success Indicators

- ✅ `"success": true` in response
- ✅ `"imported": X` shows articles imported
- ✅ No errors in logs

### Failure Indicators

- ❌ `"success": false` in response
- ❌ HTTP 401 (Unauthorized - check secret)
- ❌ HTTP 500 (Server error - check logs)

## Troubleshooting

### Webhook returns 401 Unauthorized
- Check that `CRON_SECRET` is set in Vercel
- Verify the secret in the webhook URL matches the environment variable

### Webhook returns 500 Error
- Check Vercel logs for detailed error messages
- Verify Sanity credentials are correct
- Check RSS feed URLs are accessible

### Sync not running automatically
- Verify cron schedule is correct (`0 */3 * * *` = every 3 hours)
- Check cron service status (some services pause free accounts)
- Verify webhook URL is correct

## Manual Trigger

You can also trigger the sync manually:

```bash
curl "https://teslawy.com/api/cron/webhook?secret=YOUR_SECRET"
```

Or use the direct sync endpoint (requires authentication):

```bash
curl -H "Authorization: Bearer YOUR_SECRET" \
  "https://teslawy.com/api/cron/sync-articles"
```

## Recommended Schedule

- **Every 3 hours**: `0 */3 * * *` (current setting)
- **Every 6 hours**: `0 */6 * * *` (less frequent)
- **Every hour**: `0 * * * *` (more frequent, may hit rate limits)

## Backup Strategy

For maximum reliability, set up **multiple cron services**:
1. Primary: cron-job.org (every 3 hours)
2. Backup: EasyCron (every 3 hours, offset by 1 hour)
3. Fallback: UptimeRobot (monitors every 3 hours)

This ensures if one service fails, others will still trigger the sync.

