'use client';

import { useState, useRef, useEffect } from 'react';

interface YouTubeEmbedProps {
  videoId: string;
  className?: string;
}

/**
 * Minimalistic YouTube embed with play button only, no controls
 */
export default function YouTubeEmbed({ videoId, className = '' }: YouTubeEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePlay = () => {
    if (isPlaying) return;
    
    setIsPlaying(true);
    
    // Update iframe src to autoplay
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;
      if (!currentSrc.includes('autoplay=1')) {
        iframeRef.current.src = currentSrc + (currentSrc.includes('?') ? '&' : '?') + 'autoplay=1';
      }
    }
  };

  // Generate session ID for si parameter (random 16-character string)
  const generateSessionId = () => {
    return Math.random().toString(36).substring(2, 18);
  };

  const [sessionId] = useState(() => generateSessionId());
  
  // YouTube embed URL using youtube-nocookie.com with controls=0 and si parameter
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?si=${sessionId}&controls=0`;

  return (
    <div 
      ref={containerRef}
      className={`youtube-embed-minimal ${className}`}
      style={{
        position: 'relative',
        paddingBottom: '56.25%', // 16:9 aspect ratio
        height: 0,
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        margin: '2rem 0',
        borderRadius: '12px',
        background: '#000',
        cursor: isPlaying ? 'default' : 'pointer',
      }}
      onClick={handlePlay}
    >
      <iframe
        ref={iframeRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 0,
        }}
        src={embedUrl}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        loading="lazy"
      />
      
      {!isPlaying && (
        <div
          className="youtube-play-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.3)',
            cursor: 'pointer',
            zIndex: 1,
            transition: 'background 0.3s',
            borderRadius: '12px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)';
            const playBtn = e.currentTarget.querySelector('.play-button') as HTMLElement;
            if (playBtn) playBtn.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
            const playBtn = e.currentTarget.querySelector('.play-button') as HTMLElement;
            if (playBtn) playBtn.style.transform = 'scale(1)';
          }}
        >
          <div
            className="play-button"
            style={{
              width: '80px',
              height: '80px',
              background: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              transition: 'transform 0.2s',
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="#000"
              style={{ marginLeft: '4px' }}
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

