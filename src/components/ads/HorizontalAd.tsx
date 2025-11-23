'use client';

import { useEffect, useRef } from 'react';

/**
 * Horizontal AdSense ad unit for homepage
 * Displays between news articles
 */
export default function HorizontalAd() {
  const adRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent double initialization
    if (initializedRef.current) return;
    
    // Wait for element to be in DOM and have width
    const checkAndInit = () => {
      if (!adRef.current) return;
      
      // Check if element has width (is visible)
      const rect = adRef.current.getBoundingClientRect();
      if (rect.width === 0) {
        // Retry after a short delay
        setTimeout(checkAndInit, 100);
        return;
      }
      
      // Check if ad is already initialized
      const insElement = adRef.current.querySelector('ins.adsbygoogle');
      if (insElement && (insElement as any).hasAttribute('data-adsbygoogle-status')) {
        // Already initialized
        initializedRef.current = true;
        return;
      }
      
      try {
        // Initialize AdSense ad
        if (typeof window !== 'undefined' && (window as any).adsbygoogle) {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
          initializedRef.current = true;
        }
      } catch (error) {
        console.error('[AdSense] Error initializing horizontal ad:', error);
      }
    };
    
    // Initial check
    checkAndInit();
    
    // Also check after a delay to ensure element is rendered
    const timeout = setTimeout(checkAndInit, 200);
    
    return () => {
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div ref={adRef} className="w-full my-8 flex justify-center" dir="ltr" style={{ minHeight: '100px' }}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', minWidth: '320px', width: '100%' }}
        data-ad-client="ca-pub-9438547878744657"
        data-ad-slot="3259092884"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

