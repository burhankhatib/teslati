/**
 * Translation cache using Map for in-memory storage
 * In production, you could use Redis or a database
 */

interface CacheEntry {
  translatedText: string;
  timestamp: number;
  expiresAt: number;
}

class TranslationCache {
  private cache: Map<string, CacheEntry>;
  private readonly TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  constructor() {
    this.cache = new Map();
    // Clean up expired entries every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Generate cache key from text and language pair
   */
  private getKey(text: string, sourceLang: string, targetLang: string): string {
    // Use a simple hash for the key
    const content = `${sourceLang}:${targetLang}:${text}`;
    return Buffer.from(content).toString('base64').substring(0, 100);
  }

  /**
   * Get cached translation
   */
  get(text: string, sourceLang: string, targetLang: string): string | null {
    const key = this.getKey(text, sourceLang, targetLang);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.translatedText;
  }

  /**
   * Store translation in cache
   */
  set(text: string, sourceLang: string, targetLang: string, translatedText: string): void {
    const key = this.getKey(text, sourceLang, targetLang);
    const entry: CacheEntry = {
      translatedText,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.TTL,
    };
    this.cache.set(key, entry);
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
export const translationCache = new TranslationCache();

