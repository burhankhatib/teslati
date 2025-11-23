/**
 * Generate a URL-friendly slug from a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate a unique ID from a URL
 */
export function generateIdFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    // Use the last meaningful part of the URL as ID
    return pathParts[pathParts.length - 1] || urlObj.pathname;
  } catch {
    // Fallback: create a simple hash from the URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 20);
  }
}

/**
 * Convert RSS date format (RFC 2822) to Sanity datetime format (ISO 8601)
 * Input: "Tue, 18 Nov 2025 20:53:38 +0000"
 * Output: "2025-11-18T20:53:38.000Z"
 */
export function convertRSSDateToSanityDateTime(rssDate: string): string {
  try {
    // Log original date string for debugging
    const originalDate = rssDate.trim();
    
    // Parse the RSS date string
    // JavaScript Date constructor can parse RFC 2822 format
    const date = new Date(originalDate);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn(`[Date Converter] ⚠️  Invalid date format: "${originalDate}", using current date`);
      return new Date().toISOString();
    }
    
    // Convert to ISO 8601 format that Sanity expects
    // Format: YYYY-MM-DDTHH:mm:ss.sssZ (always UTC)
    const isoString = date.toISOString();
    
    // Enhanced logging for debugging timezone issues
    // Only log for recent dates (last 7 days) to avoid spam
    const daysDiff = Math.abs((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 7) {
      console.log(`[Date Converter] 📅 Converting RSS date:`);
      console.log(`[Date Converter]   Input: "${originalDate}"`);
      console.log(`[Date Converter]   Parsed Date: ${date.toString()}`);
      console.log(`[Date Converter]   UTC: ${date.toUTCString()}`);
      console.log(`[Date Converter]   ISO Output: ${isoString}`);
      console.log(`[Date Converter]   Timezone offset: ${date.getTimezoneOffset()} minutes (${date.getTimezoneOffset() / 60} hours)`);
      
      // Check if timezone info is in the original string
      const timezoneMatch = originalDate.match(/([+-]\d{4})|UTC|GMT/i);
      if (timezoneMatch) {
        console.log(`[Date Converter]   Timezone in string: ${timezoneMatch[0]}`);
      } else {
        console.log(`[Date Converter]   ⚠️  No timezone info found in RSS date string`);
      }
    }
    
    return isoString;
  } catch (error) {
    console.error(`[Date Converter] ✗ Error parsing date: "${rssDate}"`, error);
    // Fallback to current date
    return new Date().toISOString();
  }
}

/**
 * Replace ALL Tesla referral links with custom referral link
 * Replaces any Tesla referral link (tesla.com/referral/* or ts.la/*)
 * With: https://ts.la/burhan628357
 */
export function replaceReferralLinks(content: string): string {
  if (!content) return content;
  
  const replacement = 'https://ts.la/burhan628357';
  
  // Match ALL Tesla referral links in various formats:
  // 1. https://www.tesla.com/referral/ANY_CODE
  // 2. https://ts.la/ANY_CODE
  // 3. http://www.tesla.com/referral/ANY_CODE
  // 4. In HTML attributes (href="...", src="...", etc.)
  // 5. In markdown links [text](url)
  
  // Pattern 1: Match www.tesla.com/referral/ links
  const teslaReferralPattern = /https?:\/\/(www\.)?tesla\.com\/referral\/[a-zA-Z0-9]+[^\s"<>'`]*/gi;
  
  // Pattern 2: Match ts.la/ links (but keep our own ts.la/burhan628357)
  const tslaPattern = /https?:\/\/ts\.la\/(?!burhan628357)[a-zA-Z0-9]+[^\s"<>'`]*/gi;
  
  // Replace all occurrences
  let result = content.replace(teslaReferralPattern, replacement);
  result = result.replace(tslaPattern, replacement);
  
  return result;
}

/**
 * Normalize GUID/URL for consistent duplicate detection
 * - Lowercase
 * - Remove trailing slashes
 * - Remove query parameters and hash fragments
 */
export function normalizeGuid(guid: string): string {
  if (!guid) return '';
  
  try {
    const url = new URL(guid);
    url.hash = '';
    url.search = '';
    let normalized = url.toString();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized.toLowerCase();
  } catch {
    // If not a valid URL, fallback to simple normalization
    return guid.trim().toLowerCase().replace(/\/+$/, '');
  }
}

