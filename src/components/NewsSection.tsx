'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Clock, Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import HorizontalAd from './ads/HorizontalAd';

interface Article {
  id: string;
  slug: string;
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string;
}

interface NewsResponse {
  status: string;
  totalResults: number;
  articles: Article[];
}

interface NewsSectionProps {
  initialArticles?: Article[];
}

export default function NewsSection({ initialArticles }: NewsSectionProps = {}) {
  const [news, setNews] = useState<Article[]>([]);
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(!initialArticles);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === 'dark';

  // Initial load: 14 articles (skip first one for hero, space reserved for AdSense)
  const INITIAL_COUNT = 14;
  const LOAD_MORE_COUNT = 12;

  useEffect(() => {
    // If initialArticles provided (from server component), use them
    if (initialArticles && initialArticles.length > 0) {
      // Skip the first article (index 0) since it's already displayed in the hero banner
      const articlesWithoutFirst = initialArticles.slice(1);
      setAllArticles(articlesWithoutFirst);
      setNews(articlesWithoutFirst.slice(0, INITIAL_COUNT));
      setHasMore(articlesWithoutFirst.length > INITIAL_COUNT);
      setLoading(false);
      return;
    }

    // Fallback: fetch from API if no initialArticles
    async function fetchNews() {
      try {
        const response = await fetch('/api/news');
        if (!response.ok) {
          throw new Error('Failed to fetch news');
        }
        const data: NewsResponse = await response.json();
        if (data.status === 'ok' && data.articles) {
          // Skip the first article (index 0) since it's already displayed in the hero banner
          const articlesWithoutFirst = data.articles.slice(1);
          setAllArticles(articlesWithoutFirst);

          // Show first 11 articles
          setNews(articlesWithoutFirst.slice(0, INITIAL_COUNT));
          setHasMore(articlesWithoutFirst.length > INITIAL_COUNT);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, [initialArticles]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);

    // Simulate slight delay for smooth UX
    setTimeout(() => {
      const currentCount = news.length;
      const nextArticles = allArticles.slice(0, currentCount + LOAD_MORE_COUNT);
      setNews(nextArticles);
      setHasMore(nextArticles.length < allArticles.length);
      setLoadingMore(false);
    }, 300);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };


  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className={mounted && isDark ? 'text-slate-400' : 'text-slate-600'}>جاري تحميل الأخبار...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div
          className={`rounded-lg border p-6 ${mounted && isDark ? 'border-red-900 bg-red-950' : 'border-red-200 bg-red-50'
            }`}
        >
          <p className={mounted && isDark ? 'text-red-200' : 'text-red-800'}>
            حدث خطأ أثناء تحميل الأخبار. يرجى المحاولة مجدداً.
          </p>
        </div>
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className={mounted && isDark ? 'text-slate-400' : 'text-slate-600'}>لم يتم العثور على مقالات.</p>
      </div>
    );
  }

  // Group articles into rows with ads
  const renderArticlesWithAds = () => {
    const rows: React.ReactNode[] = [];
    
    if (news.length === 0) return rows;
    
    // Helper function to create an article card
    const createArticleCard = (article: Article, index: number, isLarge: boolean = false) => (
      <Link
        key={article.id || index}
        href={`/article/${article.slug}`}
        className={`group relative overflow-hidden rounded-2xl border transition-all duration-500 hover:shadow-2xl ${isLarge ? 'md:col-span-2' : 'md:col-span-1'
          } ${mounted && isDark
            ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-slate-200'
          }`}
      >
        {/* Image Background with Zoom Effect */}
        {article.urlToImage && (
          <div className="absolute inset-0 w-full h-full overflow-hidden">
            <Image
              src={article.urlToImage}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              sizes={isLarge ? '(max-width: 768px) 100vw, 66vw' : '(max-width: 768px) 100vw, 33vw'}
            />
            <div
              className={`absolute inset-0 transition-opacity duration-500 ${mounted && isDark
                  ? 'bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent'
                  : 'bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent'
                }`}
            ></div>
          </div>
        )}

        {/* Content Overlay */}
        <div className="absolute bottom-0 left-0 w-full p-8 flex flex-col justify-end h-full transform translate-y-4 transition-transform duration-500 group-hover:translate-y-0">
          <div className="space-y-3">
            {article.publishedAt && (
              <div className="flex items-center gap-1 text-xs font-medium text-slate-300">
                <Clock size={14} /> {formatDate(article.publishedAt)}
              </div>
            )}

            <h3 className="text-2xl font-bold text-white leading-tight group-hover:text-red-200 transition-colors">
              {article.title}
            </h3>

            {article.description && (
              <p className="text-slate-300 line-clamp-2 text-sm opacity-0 h-0 group-hover:opacity-100 group-hover:h-auto transition-all duration-300">
                {article.description}
              </p>
            )}
          </div>
        </div>
      </Link>
    );
    
    // First row: Article 0 (large, 2/3) + Article 1 (small, 1/3)
    if (news.length >= 2) {
      rows.push(
        <div key="row-0" className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[350px]" dir="rtl" lang="ar">
          {createArticleCard(news[0], 0, true)}
          {createArticleCard(news[1], 1, false)}
        </div>
      );
    } else if (news.length === 1) {
      // If only one article, show it as large
      rows.push(
        <div key="row-0" className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[350px]" dir="rtl" lang="ar">
          {createArticleCard(news[0], 0, true)}
        </div>
      );
      return rows;
    }
    
    // Remaining articles: group in rows of 3 (each 1/3)
    const remainingArticles = news.slice(2);
    let rowIndex = 1;
    
    for (let i = 0; i < remainingArticles.length; i += 3) {
      const rowArticles = remainingArticles.slice(i, i + 3);
      
      rows.push(
        <div key={`row-${rowIndex}`} className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[350px]" dir="rtl" lang="ar">
          {rowArticles.map((article, idx) => createArticleCard(article, i + idx + 2, false))}
        </div>
      );
      
      // Add ad after every 3 articles (not after the last row)
      if (i + 3 < remainingArticles.length) {
        rows.push(
          <div key={`ad-${rowIndex}`} className="mt-6">
            <HorizontalAd />
          </div>
        );
      }
      
      rowIndex++;
    }
    
    return rows;
  };

  return (
    <>
      {renderArticlesWithAds()}

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center mt-12">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className={`px-8 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white ${loadingMore ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loadingMore ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                جاري التحميل...
              </>
            ) : (
              'تحميل المزيد من الأخبار'
            )}
          </button>
        </div>
      )}
    </>
  );
}

