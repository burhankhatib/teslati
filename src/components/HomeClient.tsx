'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState, ReactNode } from 'react';

interface HomeClientProps {
  children: ReactNode;
}

export default function HomeClient({ children }: HomeClientProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setMounted(true);
    }, 100);
  }, []);

  const isDark = mounted && theme === 'dark';

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        mounted && isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
      }`}
      dir="rtl"
      lang="ar"
    >
      {children}
    </div>
  );
}

