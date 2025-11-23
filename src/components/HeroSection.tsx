'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';

interface Article {
  id: string;
  slug: string;
  title: string;
  description: string;
  urlToImage: string | null;
  publishedAt: string;
  source?: {
    id: string | null;
    name: string;
  };
}

interface HeroSectionProps {
  latestArticle?: Article | null;
}

export default function HeroSection({ latestArticle: initialLatestArticle }: HeroSectionProps = {}) {
  const [scrollY, setScrollY] = useState(0);
  const [latestArticle, setLatestArticle] = useState<Article | null>(initialLatestArticle || null);
  const [loading, setLoading] = useState(!initialLatestArticle);
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const rafId = useRef<number | null>(null);
  const isMobile = useRef(false);
  
  useEffect(() => {
    setMounted(true);
    // Detect mobile device
    isMobile.current = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
  }, []);
  
  const isDark = mounted && theme === 'dark';

  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        rafId.current = requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    
    // Use passive listener for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  useEffect(() => {
    // If initialLatestArticle provided (from server component), use it
    if (initialLatestArticle) {
      setLatestArticle(initialLatestArticle);
      setLoading(false);
      return;
    }

    // Fallback: fetch from API if no initialLatestArticle
    async function fetchLatestArticle() {
      try {
        const response = await fetch('/api/news');
        if (!response.ok) {
          throw new Error('Failed to fetch news');
        }
        interface NewsResponse {
          status: string;
          articles: Article[];
        }
        const data: NewsResponse = await response.json();
        if (data.status === 'ok' && data.articles && data.articles.length > 0) {
          // Prioritize articles NOT from "Not a Tesla App" or "TESLARATI"
          const excludedSources = ['Not a Tesla App', 'TESLARATI', 'TESLARATI - Model 3', 'TESLARATI - Model Y'];
          const preferredArticles = data.articles.filter(
            (article: Article) => !excludedSources.includes(article.source?.name || '')
          );
          
          const latest = preferredArticles.length > 0 
            ? preferredArticles[0] 
            : data.articles[0];
          
          setLatestArticle(latest);
        }
      } catch (err) {
        console.error('Error fetching latest article:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchLatestArticle();
  }, [initialLatestArticle]);

  const backgroundImage = latestArticle?.urlToImage || 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1600&q=80';

  // Reduce parallax intensity on mobile for better performance
  const parallaxMultiplier = isMobile.current ? 0.2 : 0.5;
  const contentParallaxMultiplier = isMobile.current ? -0.05 : -0.1;
  
  // Use translate3d for GPU acceleration
  const backgroundTransform = `translate3d(0, ${scrollY * parallaxMultiplier}px, 0)`;
  const contentTransform = `translate3d(0, ${scrollY * contentParallaxMultiplier}px, 0)`;
  const contentOpacity = Math.max(0, 1 - scrollY / 700);

  return (
    <header className="relative h-screen w-full overflow-hidden flex items-end justify-center pb-20 md:pb-32">
      {/* Background Image with Parallax Effect */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url("${backgroundImage}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: backgroundTransform,
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        {/* Dark gradient overlay at bottom for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
      </div>

      {/* Hero Content positioned at bottom */}
      <div
        className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-4"
        style={{
          transform: contentTransform,
          opacity: contentOpacity,
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600/30 border border-red-500/40 backdrop-blur-sm text-red-200 text-sm font-medium animate-fade-in-up shadow-lg">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          آخر الأخبار
        </div>

        {/* Title and Description - Clickable with nice motion */}
        <div className="space-y-3">
          {loading ? (
            <>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight animate-fade-in-up cursor-default" style={{ animationDelay: '0.1s', textShadow: '0 4px 12px rgba(0, 0, 0, 0.9), 0 2px 4px rgba(0, 0, 0, 0.8)' }}>
                أخبار تسلا
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-red-500 to-red-600" style={{ textShadow: 'none' }}>
                  والتحديثات
                </span>
              </h1>
              <p className="text-sm md:text-base text-white/90 max-w-2xl mx-auto leading-relaxed animate-fade-in-up font-medium cursor-default" style={{ animationDelay: '0.2s', textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)' }}>
                ابق على اطلاع بآخر أخبار تسلا وتحديثات البرمجيات والنصائح
              </p>
            </>
          ) : latestArticle ? (
            <Link
              href={`/article/${latestArticle.slug}`}
              className="block group space-y-3 transition-all duration-300 ease-out"
            >
              <h1 
                className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight animate-fade-in-up transition-all duration-300 ease-out group-hover:scale-[1.02] group-hover:text-red-100 group-hover:translate-y-[-2px]" 
                style={{ 
                  animationDelay: '0.1s', 
                  textShadow: '0 4px 12px rgba(0, 0, 0, 0.9), 0 2px 4px rgba(0, 0, 0, 0.8)',
                }}
              >
                {latestArticle.title}
              </h1>
              <p 
                className="text-sm md:text-base text-white/90 max-w-2xl mx-auto leading-relaxed animate-fade-in-up font-medium transition-all duration-300 ease-out group-hover:text-white group-hover:translate-y-[-2px]" 
                style={{ 
                  animationDelay: '0.2s', 
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
                }}
              >
                {latestArticle.description || 'ابق على اطلاع بآخر أخبار تسلا وتحديثات البرمجيات والنصائح'}
              </p>
            </Link>
          ) : (
            <Link
              href="#articles"
              className="block group space-y-3 transition-all duration-300 ease-out"
            >
              <h1 
                className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight animate-fade-in-up transition-all duration-300 ease-out group-hover:scale-[1.02] group-hover:text-red-100 group-hover:translate-y-[-2px]" 
                style={{ 
                  animationDelay: '0.1s', 
                  textShadow: '0 4px 12px rgba(0, 0, 0, 0.9), 0 2px 4px rgba(0, 0, 0, 0.8)',
                }}
              >
                أخبار تسلا
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-red-500 to-red-600 group-hover:from-red-300 group-hover:via-red-400 group-hover:to-red-500 transition-all duration-300" style={{ textShadow: 'none' }}>
                  والتحديثات
                </span>
              </h1>
              <p 
                className="text-sm md:text-base text-white/90 max-w-2xl mx-auto leading-relaxed animate-fade-in-up font-medium transition-all duration-300 ease-out group-hover:text-white group-hover:translate-y-[-2px]" 
                style={{ 
                  animationDelay: '0.2s', 
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
                }}
              >
                ابق على اطلاع بآخر أخبار تسلا وتحديثات البرمجيات والنصائح
              </p>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

