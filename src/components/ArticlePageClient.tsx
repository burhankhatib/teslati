'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Home } from 'lucide-react';
import { useTheme } from 'next-themes';
import Navbar from './Navbar';
import ArticleContent from './ArticleContent';
import YouTubeEmbed from './YouTubeEmbed';
import { extractYouTubeVideoId } from '@/lib/youtube-utils';

// Motion.dev imports - lazy loaded to prevent build errors
// Motion will be loaded dynamically only when needed on the client side
let motion: any;
let useScroll: any;
let useTransform: any;
let useSpring: any;
let useMotionValue: any;
let useMotion: any;
let motionLoaded = false;

// Lazy load Motion only on client side
const loadMotion = async () => {
  if (typeof window === 'undefined' || motionLoaded) return;

  try {
    // Use Function to create dynamic import that webpack can't statically analyze
    const importFn = new Function('specifier', 'return import(specifier)');
    const motionModule = await importFn('motion');
    motion = motionModule.motion;
    useScroll = motionModule.useScroll;
    useTransform = motionModule.useTransform;
    useSpring = motionModule.useSpring;
    useMotionValue = motionModule.useMotionValue;
    useMotion = motionModule.useMotion;
    motionLoaded = true;
  } catch (e) {
    // Motion not installed - will use fallback animations
    motionLoaded = true; // Mark as loaded to prevent retries
  }
};

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
  contentAr?: string;
  scrapedContent?: string;
  htmlContent?: string;
  htmlContentAr?: string;
  scrapedText?: string;
  youtubeUrl?: string;
  scrapingSuccess?: boolean;
  scrapingError?: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function ArticlePageClient({ article }: { article: Article }) {
  const direction = 'rtl';
  const lang = 'ar';
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const velocityTimeout = useRef<NodeJS.Timeout | null>(null);

  // Check if Motion is available
  const hasMotion = typeof motion !== 'undefined' && motion !== null && motionLoaded;

  useEffect(() => {
    setMounted(true);
    // Try to load Motion on client side (non-blocking)
    loadMotion().catch(() => {
      // Silently fail - fallback animations will be used
    });
  }, []);

  // Fallback scroll tracking (always active)
  useEffect(() => {
    let lastTime = Date.now();
    let lastScrollPosition = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const currentTime = Date.now();
      const timeDelta = Math.max(currentTime - lastTime, 1);
      const scrollDelta = Math.abs(currentScrollY - lastScrollPosition);
      const velocity = (scrollDelta / timeDelta) * 1000;

      setScrollY(currentScrollY);
      setScrollVelocity(velocity);
      setIsScrolling(true);

      if (velocityTimeout.current) {
        clearTimeout(velocityTimeout.current);
      }
      velocityTimeout.current = setTimeout(() => {
        setScrollVelocity(0);
      }, 150);

      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      scrollTimeout.current = setTimeout(() => {
        setIsScrolling(false);
      }, 100);

      lastScrollY.current = currentScrollY;
      lastScrollPosition = currentScrollY;
      lastTime = currentTime;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      if (velocityTimeout.current) clearTimeout(velocityTimeout.current);
    };
  }, []);

  const isDark = mounted && theme === 'dark';

  // Motion-based scroll tracking for back button ONLY
  // DISABLED: No scroll tracking on container to prevent page issues
  let buttonY: any = null;
  let buttonOpacity: any = null;
  let buttonScale: any = null;

  // Simplified: Only use scroll position for button visibility, no Motion scroll tracking
  // This prevents the page from getting stuck or images from disappearing

  // Simplified animation style - no scroll-based transforms that could cause issues
  const getAnimationStyle = () => {
    // Simple opacity fade-in based on scroll, no transforms
    const opacity = scrollY > 50 ? 1 : Math.max(0, scrollY / 50);

    return {
      opacity: opacity,
      transition: 'opacity 0.3s ease-out',
    };
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${mounted && isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
        }`}
      dir={direction}
      lang={lang}
      style={{
        // Prevent any scroll-based issues
        overflow: 'visible',
        position: 'relative',
      }}
    >
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-8 sm:px-6 lg:px-8">
        {/* Sticky Enhanced Back Button - Motion effects ONLY on button, not page */}
        {hasMotion && motion ? (
          <motion.div
            className="fixed top-20 right-4 md:right-6 z-40"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: scrollY > 50 ? 1 : Math.max(0, scrollY / 50) }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 25,
              delay: 0.2,
            }}
          >
            <Link href="/">
              <motion.div
                className={`group inline-flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-medium backdrop-blur-md shadow-2xl cursor-pointer ${mounted && isDark
                  ? 'bg-slate-800/90 border border-slate-700 text-slate-300'
                  : 'bg-white/90 border border-slate-200 text-slate-700'
                  }`}
                whileHover={{
                  scale: 1.05,
                  x: -5, // Slide left on hover (back button feel)
                  borderColor: mounted && isDark ? 'rgba(239, 68, 68, 0.5)' : 'rgba(239, 68, 68, 0.5)',
                  backgroundColor: mounted && isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                }}
                whileTap={{
                  scale: 0.98,
                  x: -3,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 20,
                }}
              >
                <motion.div
                  className={`flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full shrink-0 ${mounted && isDark
                    ? 'bg-slate-700'
                    : 'bg-slate-100'
                    }`}
                  whileHover={{
                    backgroundColor: '#dc2626', // red-600
                    rotate: -10, // Slight rotation for back arrow feel
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 15,
                  }}
                >
                  <motion.div
                    animate={{
                      x: [0, -2, 0], // Subtle back-and-forth animation
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: 'reverse',
                      ease: 'easeInOut',
                    }}
                  >
                    <ArrowRight
                      size={16}
                      className={`md:w-[18px] md:h-[18px] ${mounted && isDark ? 'text-slate-300 group-hover:text-white' : 'text-slate-600 group-hover:text-white'
                        }`}
                    />
                  </motion.div>
                </motion.div>
                <motion.span
                  className="font-semibold whitespace-nowrap text-sm md:text-base"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  العودة إلى الأخبار
                </motion.span>
              </motion.div>
            </Link>
          </motion.div>
        ) : (
          <div
            className="fixed top-20 right-4 md:right-6 z-40 transition-all duration-300"
            style={getAnimationStyle()}
          >
            <Link
              href="/"
              className={`group inline-flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${mounted && isDark
                ? 'bg-slate-800/90 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-red-500/50 shadow-2xl'
                : 'bg-white/90 border border-slate-200 text-slate-700 hover:bg-white hover:text-slate-900 hover:border-red-500/50 shadow-2xl'
                } backdrop-blur-md`}
            >
              <div
                className={`flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full transition-all duration-300 shrink-0 ${mounted && isDark
                  ? 'bg-slate-700 group-hover:bg-red-600'
                  : 'bg-slate-100 group-hover:bg-red-600'
                  }`}
              >
                <ArrowRight
                  size={16}
                  className={`md:w-[18px] md:h-[18px] transition-transform duration-300 group-hover:translate-x-[-2px] ${mounted && isDark ? 'text-slate-300 group-hover:text-white' : 'text-slate-600 group-hover:text-white'
                    }`}
                />
              </div>
              <span className="font-semibold whitespace-nowrap text-sm md:text-base">العودة إلى الأخبار</span>
            </Link>
          </div>
        )}

        {/* Article Header - NO motion effects */}
        <article
          className="mx-auto max-w-4xl"
          dir={direction}
          lang={lang}
          style={{
            // Prevent any scroll-based animations
            animation: 'none',
            transition: 'none',
            transform: 'none',
          }}
        >
          {/* YouTube Video Embed - Full width, outside article container for larger size */}
          {article.youtubeUrl && (() => {
            const videoId = extractYouTubeVideoId(article.youtubeUrl);
            return videoId ? (
              <div className="mb-8 -mx-4 sm:-mx-6 lg:-mx-8" style={{ width: 'calc(100% + 2rem)', maxWidth: 'calc(100vw - 2rem)' }}>
                <div className="mx-auto" style={{ maxWidth: '1200px', width: '100%' }}>
                  <YouTubeEmbed videoId={videoId} />
                </div>
              </div>
            ) : null;
          })()}

          <header className="mb-8">
            <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <time
                  dateTime={article.publishedAt}
                  className={`text-sm ${mounted && isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}
                >
                  {formatDate(article.publishedAt)}
                </time>
              </div>
            </div>

            {/* Articles from Sanity are already in Arabic */}
            <h1
              className={`mb-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl ${mounted && isDark ? 'text-white' : 'text-slate-900'
                }`}
            >
              {article.title}
            </h1>

            {/* Hide main image if this is a YouTube video post */}
            {article.urlToImage && !article.youtubeUrl && (
              <div
                className={`relative mb-8 aspect-video w-full overflow-hidden rounded-2xl shadow-2xl ${mounted && isDark ? 'bg-slate-800' : 'bg-slate-100'
                  }`}
              >
                <Image
                  src={article.urlToImage}
                  alt={article.title}
                  fill
                  className="object-cover transition-transform duration-700 hover:scale-105"
                  priority
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                />
                <div
                  className={`absolute inset-0 ${mounted && isDark
                    ? 'bg-gradient-to-t from-slate-950/60 via-transparent to-transparent'
                    : 'bg-gradient-to-t from-slate-900/40 via-transparent to-transparent'
                    }`}
                ></div>
              </div>
            )}
          </header>


          {/* Article Content - NO motion effects */}
          <div
            className="max-w-none"
            style={{
              // Prevent any scroll-based animations on article content
              animation: 'none',
              transition: 'none',
              transform: 'none',
              willChange: 'auto',
            }}
          >
            <div
              className={`mb-8 rounded-2xl border p-6 shadow-lg ${mounted && isDark
                ? 'border-slate-800 bg-slate-900/50 backdrop-blur-sm'
                : 'border-slate-200 bg-white/80 backdrop-blur-sm'
                }`}
              style={{
                // Prevent any scroll-based animations
                animation: 'none',
                transition: 'none',
                transform: 'none',
              }}
            >
              <ArticleContent
                htmlContent={article.htmlContentAr || article.scrapedContent || article.htmlContent}
                fallbackText={article.contentAr || article.scrapedText || article.description || article.content}
                direction={direction}
                lang={lang}
                isYouTubeVideo={!!article.youtubeUrl}
              />
            </div>

            {/* Scraping Status (only show if failed) */}
            {article.scrapingSuccess === false && article.scrapingError && (
              <div
                className={`mb-4 rounded-xl border p-4 ${mounted && isDark
                  ? 'border-yellow-800 bg-yellow-950/50'
                  : 'border-yellow-200 bg-yellow-50'
                  }`}
              >
                <p
                  className={`text-sm ${mounted && isDark ? 'text-yellow-200' : 'text-yellow-800'
                    }`}
                >
                  <strong>ملاحظة:</strong> تعذر تحميل المحتوى الكامل تلقائياً. يتم عرض الملخص بدلاً من ذلك.
                </p>
              </div>
            )}

            {/* Attribution - Small link at bottom */}
            <div
              className={`mt-12 pt-6 border-t ${mounted && isDark ? 'border-slate-800' : 'border-slate-200'
                }`}
            >
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 text-xs transition-colors ${mounted && isDark
                  ? 'text-slate-400 hover:text-red-400'
                  : 'text-slate-500 hover:text-red-600'
                  }`}
              >
                <span>المصدر</span>
                <svg
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}

