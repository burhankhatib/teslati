import NewsFeed from '@/components/NewsFeed';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

/**
 * WordPress News Page
 * Displays latest Tesla news from WordPress websites
 * Uses WordPress REST API instead of RSS feeds
 */
export default function WordPressNewsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <NewsFeed />
      </main>
      
      <Footer />
    </div>
  );
}

