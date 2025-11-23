'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Moon, Sun, Menu, X, Home } from 'lucide-react';
import SearchBox from './SearchBox';
import Logo from './Logo';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle theme mount
  useEffect(() => {
    setTimeout(() => {
      setMounted(true);
    }, 100);
  }, []);

  const isDark = mounted && theme === 'dark';

  const menuItems = [
    {
      label: 'الرئيسية',
      href: '/',
      icon: <Home />,
    },

  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${scrolled
        ? isDark
          ? 'bg-slate-950/70 border-slate-800 backdrop-blur-md'
          : 'bg-white/70 border-slate-200 backdrop-blur-md'
        : 'bg-transparent border-transparent py-4'
        }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center h-16 gap-4">
        {/* Logo */}
        <Link href="/" className="group flex items-center shrink-0 overflow-visible">
          <Logo
            scrolled={scrolled}
            className="h-8 w-auto md:h-10"
          />
        </Link>

        {/* Centered Search Box */}
        <div className="hidden md:flex flex-1 justify-center items-center">
          <div className="w-full max-w-2xl">
            <SearchBox />
          </div>
        </div>

        {/* Right Side Menu */}
        <div
          className={`hidden md:flex items-center gap-6 font-medium shrink-0 ${scrolled
            ? mounted && isDark
              ? 'text-slate-300'
              : 'text-slate-600'
            : 'text-white/90'
            }`}
        >
          {menuItems.map((item) => (
            <Link href={item.href} key={item.href} className="text-lg font-medium flex items-center gap-2">
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}

          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`p-2 rounded-full transition-colors ${scrolled
                ? mounted && isDark
                  ? 'hover:bg-slate-800'
                  : 'hover:bg-slate-200'
                : 'hover:bg-white/20'
                }`}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          )}
        </div>

        {/* Mobile Toggle */}
        <div className="md:hidden flex items-center gap-4">
          {mounted && (
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`p-2 rounded-full ${scrolled ? 'text-current' : 'text-white'}`}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={scrolled ? 'text-current' : 'text-white'}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div
          className={`md:hidden absolute top-16 left-0 w-full p-6 flex flex-col gap-4 border-b ${mounted && isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
            }`}
        >
          {menuItems.map((item) => (
            <Link href={item.href} key={item.href} className="text-lg font-medium flex items-center gap-2">
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

