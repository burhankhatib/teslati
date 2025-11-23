import Navbar from '@/components/Navbar';
import HeroSectionServer from '@/components/HeroSectionServer';
import NewsSectionServer from '@/components/NewsSectionServer';
import Footer from '@/components/Footer';
import HomeClient from '@/components/HomeClient';

// Force dynamic rendering for this route to enable Live updates
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return (
    <HomeClient>
      <Navbar />
      {/* Server component that uses sanityFetch with Live support */}
      <HeroSectionServer />
      
      {/* Articles Section (Bento Grid Style) */}
      <section id="articles" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold">
                آخر الأخبار
              </h2>
              <p className="mt-2">
                آخر أخبار تسلا وتحديثات البرمجيات والنصائح
              </p>
            </div>
          </div>

          {/* Server component that uses sanityFetch with Live support */}
          <NewsSectionServer />
        </div>
      </section>

      <Footer />
    </HomeClient>
  );
}
