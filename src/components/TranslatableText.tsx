'use client';

import { useState, useEffect } from 'react';
import { translationCache } from '@/lib/translation-cache';

interface TranslatableTextProps {
  text: string;
  language: 'en' | 'ar';
  className?: string;
  as?: 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export default function TranslatableText({ 
  text, 
  language, 
  className = '',
  as: Component = 'span'
}: TranslatableTextProps) {
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    if (language === 'ar' && text) {
      translateText();
    } else {
      setTranslatedText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, text]);

  const translateText = async () => {
    // Check cache first
    const cached = translationCache.get(text, 'en', 'ar');
    if (cached) {
      setTranslatedText(cached);
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang: 'ar', sourceLang: 'en' }),
      });
      const data = await response.json();
      if (data.success && data.translatedText) {
        setTranslatedText(data.translatedText);
      }
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const displayText = language === 'ar' && translatedText ? translatedText : text;

  return (
    <Component className={className}>
      {isTranslating ? `${text}...` : displayText}
    </Component>
  );
}

