'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';

interface SearchArticle {
  id: string;
  slug: string;
  title: string;
  description: string;
  urlToImage: string | null;
  publishedAt: string;
}

interface SearchResults {
  articles: SearchArticle[];
  totalResults: number;
}

export default function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchArticle[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();
  const router = useRouter();

  // Prevent hydration mismatch by only using theme after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === 'dark';

  // Close search when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
        setResults([]);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/news?search=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data: SearchResults = await response.json();
      setResults(data.articles || []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle input change with debouncing
  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (query.trim()) {
      setIsOpen(true);
      const timer = setTimeout(() => {
        performSearch(query);
      }, 300); // 300ms debounce
      setDebounceTimer(timer);
    } else {
      setResults([]);
      setIsSearching(false);
    }

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [query, performSearch]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const handleArticleClick = (slug: string) => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    router.push(`/article/${slug}`);
  };

  return (
    <div ref={searchRef} className="relative w-full">
      {/* Search Input with Glass Effect */}
      <div className="relative">
        <Search
          className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 ${mounted && isDark ? 'text-white/70' : 'text-slate-600'
            }`}
          size={22}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim() && results.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder="ابحث عن الأخبار..."
          className={`w-full pr-12 pl-4 py-4 text-lg rounded-2xl border transition-all backdrop-blur-md ${mounted && isDark
            ? 'bg-white/10 border-white/20 text-white placeholder-white/60 focus:border-red-500/50 focus:bg-white/15'
            : 'bg-white/80 border-white/30 text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:bg-white/90'
            } focus:outline-none focus:ring-2 focus:ring-red-500/30 shadow-lg`}
          dir="rtl"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className={`absolute left-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors z-10 ${mounted && isDark
              ? 'text-white/70 hover:bg-white/20'
              : 'text-slate-600 hover:bg-slate-200/50'
              }`}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (query.trim() || results.length > 0) && (
        <div
          className={`absolute top-full mt-3 w-full rounded-2xl border shadow-2xl max-h-[500px] overflow-y-auto z-50 backdrop-blur-md ${mounted && isDark
            ? 'bg-white/10 border-white/20 backdrop-blur-md'
            : 'bg-white/90 border-white/30 backdrop-blur-md'
            }`}
        >
          {isSearching ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 size={24} className={`animate-spin ${mounted && isDark ? 'text-red-400' : 'text-red-600'}`} />
              <span className={`mr-3 ${mounted && isDark ? 'text-white/70' : 'text-slate-600'}`}>
                جاري البحث...
              </span>
            </div>
          ) : results.length > 0 ? (
            <div className="p-2">
              {results.map((article) => (
                <button
                  key={article.id}
                  onClick={() => handleArticleClick(article.slug)}
                  className={`w-full text-right p-4 rounded-xl transition-colors ${mounted && isDark
                    ? 'hover:bg-white/10 text-white'
                    : 'hover:bg-slate-100/80 text-slate-900'
                    }`}
                  dir="rtl"
                >
                  <div className="flex gap-4">
                    {article.urlToImage && (
                      <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-white/20">
                        <Image
                          src={article.urlToImage}
                          alt={article.title}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-semibold text-sm mb-1 line-clamp-2 ${mounted && isDark ? 'text-white' : 'text-slate-900'}`}>
                        {article.title}
                      </h4>
                      {article.description && (
                        <p
                          className={`text-xs line-clamp-2 mb-2 ${mounted && isDark ? 'text-white/70' : 'text-slate-600'
                            }`}
                        >
                          {article.description}
                        </p>
                      )}
                      {article.publishedAt && (
                        <p
                          className={`text-xs ${mounted && isDark ? 'text-white/50' : 'text-slate-500'
                            }`}
                        >
                          {formatDate(article.publishedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="p-8 text-center">
              <p className={mounted && isDark ? 'text-white/70' : 'text-slate-600'}>
                لم يتم العثور على نتائج
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

