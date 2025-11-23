'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Clock, ExternalLink, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import { fetchLatestNews, NewsItem } from '@/app/actions/getNews';

/**
 * NewsFeed Component
 * Displays latest Tesla news from WordPress websites
 * Shows featured images, source badges, and article summaries
 */
export default function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function loadNews() {
      try {
        setLoading(true);
        setError(null);
        const newsItems = await fetchLatestNews();
        setNews(newsItems);
      } catch (err) {
        console.error('[NewsFeed] Error fetching news:', err);
        setError(err instanceof Error ? err.message : 'Failed to load news');
      } finally {
        setLoading(false);
      }
    }

    loadNews();
  }, []);

  const isDark = mounted && theme === 'dark';

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      Electrek: 'bg-blue-500',
      Teslarati: 'bg-red-500',
      'Tesla North': 'bg-green-500',
    };
    return colors[source] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
            جاري تحميل الأخبار...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div
          className={`rounded-lg border p-6 ${
            isDark ? 'border-red-900 bg-red-950' : 'border-red-200 bg-red-50'
          }`}
        >
          <p className={isDark ? 'text-red-200' : 'text-red-800'}>
            حدث خطأ أثناء تحميل الأخبار: {error}
          </p>
        </div>
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
          لم يتم العثور على أخبار.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2">أخبار تسلا من مصادر مختلفة</h2>
        <p className="text-slate-600 dark:text-slate-400">
          آخر الأخبار من Electrek و Teslarati و Tesla North
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" dir="rtl" lang="ar">
        {news.map((item) => (
          <article
            key={`${item.source}-${item.id}`}
            className={`group relative overflow-hidden rounded-2xl border transition-all duration-500 hover:shadow-2xl ${
              isDark
                ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            {/* Featured Image */}
            {item.imageUrl && (
              <div className="relative h-48 w-full overflow-hidden">
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
                <div
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    isDark
                      ? 'bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent'
                      : 'bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent'
                  }`}
                ></div>
                
                {/* Source Badge */}
                <div className="absolute top-4 left-4">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white ${getSourceColor(
                      item.source
                    )}`}
                  >
                    {item.source}
                  </span>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="p-6">
              {/* Title */}
              <h3 className="text-xl font-bold mb-3 line-clamp-2 group-hover:text-red-500 transition-colors">
                {item.title}
              </h3>

              {/* Summary */}
              {item.summary && (
                <p
                  className={`text-sm mb-4 line-clamp-3 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  {item.summary}
                </p>
              )}

              {/* Meta Information */}
              <div className="flex items-center justify-between text-xs mb-4">
                <div className="flex items-center gap-2">
                  <Clock size={14} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                    {formatDate(item.publishedAt)}
                  </span>
                </div>
                {item.author && item.author !== 'Unknown' && (
                  <div className="flex items-center gap-1">
                    <User size={14} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                    <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                      {item.author}
                    </span>
                  </div>
                )}
              </div>

              {/* Read More Link */}
              {item.url && (
                <Link
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    isDark
                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>اقرأ المزيد</span>
                  <ExternalLink size={16} />
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

