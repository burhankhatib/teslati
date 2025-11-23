import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-50 dark:from-black dark:via-zinc-950 dark:to-black" dir="rtl" lang="ar">
      <div className="text-center px-4">
        <h1 className="mb-4 text-4xl font-bold text-black dark:text-white">
          404 - الصفحة غير موجودة
        </h1>
        <p className="mb-8 text-lg text-zinc-600 dark:text-zinc-400">
          الصفحة التي تبحث عنها غير موجودة أو تم حذفها.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-black px-6 py-3 text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}

