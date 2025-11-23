'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function Footer() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setMounted(true);
    }, 100);
  }, []);

  const isDark = mounted && theme === 'dark';

  return (
    <footer
      className={`py-12 border-t ${mounted && isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
        }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          © 2025 تسلا.وي. جميع الحقوق محفوظة.
        </div>
        {/* <div className={`flex gap-6 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          <a href="#" className="hover:text-red-500 transition-colors">
            تويتر
          </a>
          <a href="#" className="hover:text-red-500 transition-colors">
            لينكد إن
          </a>
          <a href="#" className="hover:text-red-500 transition-colors">
            جيت هاب
          </a>
        </div> */}
      </div>
    </footer>
  );
}

