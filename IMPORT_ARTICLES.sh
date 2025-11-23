#!/bin/bash

# Tesla News Arabic - Import Articles Script
# This script helps you import articles from Not A Tesla App to your site

echo "🚀 Tesla News Arabic - Article Import"
echo "====================================="
echo ""

# Check if domain is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide your Vercel domain"
    echo ""
    echo "Usage:"
    echo "  ./IMPORT_ARTICLES.sh your-domain.vercel.app"
    echo ""
    echo "Example:"
    echo "  ./IMPORT_ARTICLES.sh teslati.vercel.app"
    echo ""
    exit 1
fi

DOMAIN=$1

# Remove https:// if user included it
DOMAIN=${DOMAIN#https://}
DOMAIN=${DOMAIN#http://}

echo "📍 Domain: $DOMAIN"
echo ""

# Step 1: Check health
echo "Step 1: Checking health endpoint..."
echo "curl https://$DOMAIN/api/health"
echo ""
curl -s "https://$DOMAIN/api/health" | python3 -m json.tool || echo "⚠️  Health check failed"
echo ""
echo ""

# Step 2: Check sync status (without syncing)
echo "Step 2: Checking sync status (this shows how many new articles are available)..."
echo "curl https://$DOMAIN/api/sync-articles"
echo ""
curl -s "https://$DOMAIN/api/sync-articles" | python3 -m json.tool || echo "⚠️  Status check failed"
echo ""
echo ""

# Step 3: Ask user if they want to proceed
read -p "Do you want to import articles now? This will start the sync process. (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Import cancelled"
    exit 0
fi

# Step 4: Run sync
echo ""
echo "Step 3: Starting article import (this may take 2-5 minutes)..."
echo "curl -X POST https://$DOMAIN/api/sync-articles"
echo ""
echo "⏳ Please wait..."
echo ""

START_TIME=$(date +%s)
curl -X POST "https://$DOMAIN/api/sync-articles" | python3 -m json.tool
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo ""
echo "✅ Import completed in ${DURATION} seconds"
echo ""
echo "🎉 Next steps:"
echo "  1. Visit https://$DOMAIN to see your articles"
echo "  2. Visit https://$DOMAIN/studio to manage content in Sanity Studio"
echo ""
echo "📝 Note: Articles are automatically synced daily at midnight (Vercel Cron)"

