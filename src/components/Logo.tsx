'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

// Motion.dev imports - lazy loaded
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let motion: any;
let motionLoaded = false;

const loadMotion = async () => {
  if (typeof window === 'undefined' || motionLoaded) return;
  try {
    const importFn = new Function('specifier', 'return import(specifier)');
    const motionModule = await importFn('motion');
    motion = motionModule.motion;
    motionLoaded = true;
  } catch {
    motionLoaded = true;
  }
};

interface LogoProps {
  className?: string;
  scrolled?: boolean;
}

// SVG paths data - each path represents a letter/part of the logo
const logoPaths = [
  { d: "M424.71,75.24c5.82-.05,20.37-10.99,19.75-19.1h-105.74c-.37,1.87-.97,4.02-.98,5.58l-.06,44.64c0,2.77.33,5.37,1.26,7.69h86.68s-.11,20.08-.11,20.08l-69.59.62c-9.84.09-23.08,15.54-22.89,17.96.04.47,1.61,1.12,2.11,1.12l109.34-.03v-58.64s-84.93.07-84.93.07l-2.6-1.39c.27.14-1.03-15.42-.13-18.04l67.89-.57Z" },
  { d: "M19.03,75.18c10.95,1.5,21.78-.21,33.25.69l.08,77.1c7.03,1,12.71,1.23,18.78.43l.18-58.06c.01-3.67.84-6.95.04-11.05-.56-2.83-.32-6.13.81-8.3l32.28-.8c9.47-.24,16.92-10.01,19.29-19H0c2.66,8.86,9.47,17.7,19.03,19.01Z" },
  { d: "M1079.97,94.65l-.03-38.52c-8.66,2.66-18.96,9.92-19.02,19.63l-.26,18.88h-85.06l-.25-18.88c-.08-9.7-10.36-16.96-19.02-19.63l-.03,38.52h-.03s.02.08.03.11c2.67,8.83,9.48,17.59,19,18.9.16.02.33.04.5.06.02,0,.04.01.06.01,10.76,1.36,21.41-.28,32.69.61l.08,38.62c7.04.99,12.71,1.23,18.78.42l.18-19.58c.01-3.67.84-6.95.03-11.05-.55-2.83-.31-6.12.81-8.3l31.97-.79h.31c9.43-.25,16.85-9.94,19.26-18.9.01-.04.02-.08.03-.12h-.03Z" },
  { d: "M517.71,56.13l-18.79.03-.06,16.36.07,81.39,85.59-.62c9.24-.07,16.67-10.78,17.97-18.89l-84.72-.14-.07-78.12Z" },
  { points: "644.05 153.68 662.78 153.8 662.94 114.04 731.94 114.19 732.01 153.69 750.8 153.49 750.8 95.21 644.1 95.21 644.05 153.68" },
  { d: "M660.89,75.51l73.45.18c9.6-2.81,16.97-9.9,18.7-19.55h-111.78c.6,8.33,12.16,19.36,19.64,19.37Z" },
  { d: "M189.82,75.22l73.86.52c9.72-2.55,16.82-9.81,19.19-19.61l-112.68.07c2.67,8.66,9.93,18.95,19.64,19.02Z" },
  { d: "M189.27,113.54c25.12.84,49.81,1.04,75.25-.1,9.37-.42,15.68-10.39,18.38-18.7l-112.63-.06c2.68,8.26,9.68,18.55,19,18.86Z" },
  { d: "M191.23,153.84l71-.11c7.51-.01,19.97-11.16,20.38-19.44h-112.47c2.96,10.09,10.86,17.66,21.08,19.55Z" },
  { d: "M882.8,75.77l-.52,58.82c2.55,9.72,9.81,16.82,19.61,19.19l-.07-97.64c-8.66,2.67-18.95,9.93-19.02,19.64Z" },
  { d: "M844.48,75.22c-.84,25.12-1.04,34.76.1,60.21.42,9.37,10.39,15.68,18.7,18.38l.06-97.59c-8.26,2.68-18.55,9.68-18.86,19Z" },
  { d: "M804.18,77.18l.11,55.96c.01,7.51,11.16,19.97,19.44,20.38V56.1c-10.09,2.96-17.66,10.86-19.55,21.08Z" },
];

export default function Logo({ className = '', scrolled = false }: LogoProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hasMotion, setHasMotion] = useState(false);

  useEffect(() => {
    // Set mounted state - this is safe as it only runs once
    setTimeout(() => {
      setMounted(true);
    }, 100);

    // Load Motion library
    loadMotion().then(() => {
      setHasMotion(typeof motion !== 'undefined' && motion !== null);
    });
  }, []);

  const isDark = mounted && theme === 'dark';

  // Determine base logo color based on theme and scroll state
  const getBaseColor = () => {
    if (scrolled) {
      return isDark ? '#ffffff' : '#0f172a';
    }
    return '#ffffff';
  };

  const baseColor = getBaseColor();
  const hoverColor = '#ef4444'; // red-500

  // Render path with or without Motion
  const renderPath = (pathData: typeof logoPaths[0], index: number) => {
    const commonProps = {
      fill: isHovered ? hoverColor : baseColor,
      transition: {
        fill: { duration: 0.4, delay: index * 0.03 },
        scale: { duration: 0.3, delay: index * 0.02 },
        y: { duration: 0.3, delay: index * 0.02 },
      },
    };

    if (hasMotion && motion) {
      const MotionPath = pathData.points ? motion.polygon : motion.path;
      return (
        <MotionPath
          key={index}
          {...commonProps}
          {...(pathData.points ? { points: pathData.points } : { d: pathData.d })}
          animate={{
            fill: isHovered ? hoverColor : baseColor,
            scale: isHovered ? 1.05 : 1,
            y: isHovered ? -2 : 0,
          }}
          style={{
            transformOrigin: 'center',
          }}
        />
      );
    }

    // Fallback without Motion - CSS transitions with staggered delays
    const PathElement = pathData.points ? 'polygon' : 'path';
    const fillDelay = index * 0.03; // Stagger delay for color change
    const transformDelay = index * 0.02; // Stagger delay for scale/position

    return (
      <PathElement
        key={index}
        fill={isHovered ? hoverColor : baseColor}
        {...(pathData.points ? { points: pathData.points } : { d: pathData.d })}
        style={{
          fill: isHovered ? hoverColor : baseColor,
          transition: `fill 0.4s ease ${fillDelay}s, transform 0.3s ease ${transformDelay}s`,
          transform: isHovered ? 'scale(1.05) translateY(-2px)' : 'scale(1) translateY(0)',
          transformOrigin: 'center',
        }}
      />
    );
  };

  return (
    <div
      className="inline-flex items-center justify-center overflow-visible"
      style={{
        padding: '12px', // Add padding to prevent clipping when scaled (110% scale needs ~10% padding)
        margin: '-12px', // Negative margin to offset padding and maintain alignment
        minWidth: 'fit-content', // Ensure container doesn't shrink
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <svg
        id="a"
        data-name="Layer 1"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1080 210"
        className={`transition-all duration-300 ease-out ${isHovered ? 'scale-110 drop-shadow-lg' : 'scale-100'} ${className}`}
        style={{
          filter: isHovered ? 'drop-shadow(0 10px 15px rgba(239, 68, 68, 0.3))' : 'none',
          overflow: 'visible', // Prevent SVG clipping
          transformOrigin: 'center center', // Scale from center
          display: 'block', // Ensure proper rendering
        }}
      >
        {logoPaths.map((pathData, index) => renderPath(pathData, index))}
      </svg>
    </div>
  );
}

