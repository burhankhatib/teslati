/**
 * Upload images to Sanity from external URLs
 */

import { adminClient } from '@/sanity/lib/adminClient';

export interface UploadedImage {
  url: string;
  sanityAssetId: string | null;
  error?: string;
}

/**
 * Upload a single image from URL to Sanity
 */
export async function uploadImageToSanity(imageUrl: string): Promise<UploadedImage> {
  try {
    console.log(`[Image Upload] Uploading: ${imageUrl.substring(0, 80)}...`);

    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get content type from response headers
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Generate a filename from URL
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1].split('?')[0] || 'image.jpg';

    // Upload to Sanity
    const asset = await adminClient.assets.upload('image', buffer, {
      filename: filename,
      contentType: contentType,
    });

    console.log(`[Image Upload] ✓ Uploaded: ${asset._id}`);

    return {
      url: imageUrl,
      sanityAssetId: asset._id,
    };
  } catch (error) {
    console.error(`[Image Upload] ✗ Failed to upload ${imageUrl}:`, error);
    return {
      url: imageUrl,
      sanityAssetId: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Upload multiple images to Sanity
 * Returns a map of original URL -> Sanity asset ID
 */
export async function uploadImagesToSanity(imageUrls: string[]): Promise<Map<string, string>> {
  const uploadedMap = new Map<string, string>();
  
  // Upload images sequentially to avoid rate limiting
  for (const imageUrl of imageUrls) {
    const result = await uploadImageToSanity(imageUrl);
    if (result.sanityAssetId) {
      uploadedMap.set(imageUrl, result.sanityAssetId);
    }
    // Small delay between uploads
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return uploadedMap;
}

/**
 * Replace image URLs in HTML with Sanity CDN URLs
 */
/**
 * Replace image URLs in HTML with Sanity CDN URLs
 * Handles multiple URL formats: full URLs, relative URLs, and encoded URLs
 */
export async function replaceImageUrlsInHtml(html: string, imageMap: Map<string, string>): Promise<string> {
  if (!html || html.trim().length === 0) return html;
  
  let updatedHtml = html;
  
  // Import urlFor dynamically
  const { urlFor } = await import('@/sanity/lib/image');

  for (const [originalUrl, sanityAssetId] of imageMap.entries()) {
    if (!originalUrl || !sanityAssetId) continue;
    
    try {
      // Create Sanity image reference
      const sanityImage = {
        asset: {
          _ref: sanityAssetId,
          _type: 'reference' as const,
        },
      };
      
      // Generate actual Sanity CDN URL
      const sanityUrl = urlFor(sanityImage)
        .width(1200)
        .height(800)
        .fit('max')
        .auto('format')
        .url();
      
      if (!sanityUrl) {
        console.warn(`[Image Replace] ⚠️  Failed to generate Sanity URL for asset: ${sanityAssetId}`);
        continue;
      }
      
      // Replace all occurrences of the image URL in various formats
      // Escape special regex characters
      const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const encodedUrl = encodeURIComponent(originalUrl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Pattern 1: Full URL in src="..." or src='...'
      const srcPattern = new RegExp(`(src=["'])${escapedUrl}(["'])`, 'gi');
      if (srcPattern.test(updatedHtml)) {
        updatedHtml = updatedHtml.replace(srcPattern, `$1${sanityUrl}$2`);
        console.log(`[Image Replace] ✓ Replaced src: ${originalUrl.substring(0, 60)}...`);
      }
      
      // Pattern 2: URL-encoded version in src
      const srcEncodedPattern = new RegExp(`(src=["'])${encodedUrl}(["'])`, 'gi');
      if (srcEncodedPattern.test(updatedHtml)) {
        updatedHtml = updatedHtml.replace(srcEncodedPattern, `$1${sanityUrl}$2`);
        console.log(`[Image Replace] ✓ Replaced encoded src: ${originalUrl.substring(0, 60)}...`);
      }
      
      // Pattern 3: Full URL in href="..." (for linked images)
      const hrefPattern = new RegExp(`(href=["'])${escapedUrl}(["'])`, 'gi');
      if (hrefPattern.test(updatedHtml)) {
        updatedHtml = updatedHtml.replace(hrefPattern, `$1${sanityUrl}$2`);
        console.log(`[Image Replace] ✓ Replaced href: ${originalUrl.substring(0, 60)}...`);
      }
      
      // Pattern 4: Standalone URL (not in attributes)
      const standalonePattern = new RegExp(escapedUrl, 'g');
      if (standalonePattern.test(updatedHtml)) {
        updatedHtml = updatedHtml.replace(standalonePattern, sanityUrl);
        console.log(`[Image Replace] ✓ Replaced standalone: ${originalUrl.substring(0, 60)}...`);
      }
      
    } catch (error) {
      console.error(`[Image Replace] ✗ Failed to replace ${originalUrl.substring(0, 50)}...:`, error);
      // Keep original URL as fallback
    }
  }

  return updatedHtml;
}

/**
 * Convert Sanity asset ID to image URL format for HTML
 * Format: image-{assetId}-{width}x{height}-{format}
 */
export function getSanityImageUrl(assetId: string, width: number = 1200, height: number = 800, format: string = 'jpg'): string {
  return `image-${assetId}-${width}x${height}-${format}`;
}

