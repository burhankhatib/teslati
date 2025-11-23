/**
 * YouTube utility functions for extracting video information
 */

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  transcript: string;
  description?: string;
}

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  // Remove any whitespace
  url = url.trim();

  // Patterns for different YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Get YouTube video thumbnail URL
 * Quality options: default, mqdefault, hqdefault, sddefault, maxresdefault
 */
export function getYouTubeThumbnail(videoId: string, quality: 'default' | 'mqdefault' | 'hqdefault' | 'sddefault' | 'maxresdefault' = 'maxresdefault'): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

/**
 * Get YouTube video embed URL using youtube-nocookie.com
 * Generates a session ID for the si parameter
 */
export function getYouTubeEmbedUrl(videoId: string, sessionId?: string): string {
  const si = sessionId || Math.random().toString(36).substring(2, 18);
  return `https://www.youtube-nocookie.com/embed/${videoId}?si=${si}&controls=0`;
}

/**
 * Get YouTube video watch URL
 */
export function getYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Fetch YouTube video transcript using YouTube's internal API
 * This is a workaround since YouTube doesn't provide a public transcript API
 */
export async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  try {
    // Try to fetch transcript from YouTube's internal API
    // This endpoint is used by YouTube's own player
    const transcriptUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`;
    
    const response = await fetch(transcriptUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      // If transcript not available, try to get video description as fallback
      console.warn(`[YouTube] Transcript not available for video ${videoId}, trying description...`);
      return await fetchVideoDescription(videoId);
    }

    const xmlText = await response.text();
    
    // Parse XML transcript and extract text
    const textMatches = xmlText.match(/<text[^>]*>([^<]+)<\/text>/g);
    if (!textMatches || textMatches.length === 0) {
      return await fetchVideoDescription(videoId);
    }

    // Extract text content from XML tags
    const transcript = textMatches
      .map(match => {
        const textMatch = match.match(/<text[^>]*>([^<]+)<\/text>/);
        return textMatch ? textMatch[1].trim() : '';
      })
      .filter(text => text.length > 0)
      .join(' ');

    return transcript || await fetchVideoDescription(videoId);
  } catch (error) {
    console.error(`[YouTube] Failed to fetch transcript for ${videoId}:`, error);
    // Fallback to description
    return await fetchVideoDescription(videoId);
  }
}

/**
 * Fetch video description as fallback when transcript is not available
 */
async function fetchVideoDescription(videoId: string): Promise<string> {
  try {
    // Use oEmbed API to get basic video info
    const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    
    const response = await fetch(oEmbedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch video info: ${response.status}`);
    }

    const data = await response.json();
    
    // Return title and description if available
    return `${data.title || ''} ${data.author_name || ''}`.trim();
  } catch (error) {
    console.error(`[YouTube] Failed to fetch description for ${videoId}:`, error);
    return `YouTube video content about Tesla and electric vehicles.`;
  }
}

/**
 * Fetch complete YouTube video information
 */
export async function getYouTubeVideoInfo(url: string): Promise<YouTubeVideoInfo | null> {
  const videoId = extractYouTubeVideoId(url);
  
  if (!videoId) {
    throw new Error('Invalid YouTube URL. Please provide a valid YouTube video URL.');
  }

  try {
    // Fetch video info using oEmbed
    const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const oEmbedResponse = await fetch(oEmbedUrl);
    
    if (!oEmbedResponse.ok) {
      throw new Error(`Failed to fetch video info: ${oEmbedResponse.status}`);
    }

    const oEmbedData = await oEmbedResponse.json();
    
    // Get transcript
    const transcript = await fetchYouTubeTranscript(videoId);
    
    // Get thumbnail URL
    const thumbnailUrl = getYouTubeThumbnail(videoId, 'maxresdefault');

    return {
      videoId,
      title: oEmbedData.title || 'Untitled Video',
      thumbnailUrl,
      transcript: transcript || oEmbedData.title || 'No transcript available',
      description: oEmbedData.author_name || undefined,
    };
  } catch (error) {
    console.error(`[YouTube] Error fetching video info:`, error);
    throw error;
  }
}

/**
 * Generate YouTube embed HTML
 * Creates a minimalistic YouTube video embed placeholder
 * The actual embed will be rendered by YouTubeEmbed React component
 */
export function generateYouTubeEmbedHtml(videoId: string): string {
  // Create a simple placeholder div that will be replaced by YouTubeEmbed component
  // The component will handle the minimalistic design with play button only
  return `<div class="youtube-embed-minimal" data-video-id="${videoId}" style="margin: 2rem 0;"></div>`;
}

