/**
 * UI translations for the website
 * These are pre-translated common UI strings
 */

export const uiTranslations = {
  en: {
    'tesla-news': 'Tesla News',
    'latest-news': 'Latest Tesla news, software updates, and tips',
    'back-to-news': 'Back to News',
    'read-more': 'Read more',
    'loading-news': 'Loading news...',
    'no-articles': 'No news articles found.',
    'source': 'Source',
    'read-full-article': 'Read full article',
    'translating': 'Translating...',
    'translation-error': 'Failed to translate content. Please try again.',
    'note': 'Note',
    'content-load-failed': 'Full content could not be automatically loaded. Showing summary instead.',
  },
  ar: {
    'tesla-news': 'أخبار تسلا',
    'latest-news': 'آخر أخبار تسلا وتحديثات البرمجيات والنصائح',
    'back-to-news': 'العودة إلى الأخبار',
    'read-more': 'اقرأ المزيد',
    'loading-news': 'جاري تحميل الأخبار...',
    'no-articles': 'لم يتم العثور على مقالات.',
    'source': 'المصدر',
    'read-full-article': 'اقرأ المقال الكامل',
    'translating': 'جاري الترجمة...',
    'translation-error': 'فشل في ترجمة المحتوى. يرجى المحاولة مرة أخرى.',
    'note': 'ملاحظة',
    'content-load-failed': 'تعذر تحميل المحتوى الكامل تلقائياً. يتم عرض الملخص بدلاً من ذلك.',
  },
};

export function getUITranslation(key: string, lang: 'en' | 'ar' = 'ar'): string {
  return uiTranslations[lang][key as keyof typeof uiTranslations.en] || key;
}

