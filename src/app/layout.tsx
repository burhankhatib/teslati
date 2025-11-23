import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import MotionProvider from "@/components/MotionProvider";
import { SanityLive } from "@/sanity/lib/live";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["latin", "arabic"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://teslawy.com'),
  title: {
    default: "تسلاوي - أخبار تسلا بالعربية | Tesla News in Arabic",
    template: "%s | تسلاوي",
  },
  description: "موقع متخصص في أخبار تسلا بالعربية. آخر التحديثات، الإعلانات، تحديثات البرمجيات، ونصائح لمالكي تسلا. Tesla news in Arabic, software updates, announcements, and tips for Tesla owners.",
  keywords: [
    "أخبار تسلا",
    "تسلا",
    "Tesla",
    "أخبار تسلا بالعربية",
    "Tesla news Arabic",
    "تحديثات تسلا",
    "Tesla updates",
    "نصائح تسلا",
    "Tesla tips",
    "سيارات كهربائية",
    "electric cars",
    "تسلا موديل 3",
    "Tesla Model 3",
    "تسلا موديل Y",
    "Tesla Model Y",
    "تسلا موديل S",
    "Tesla Model S",
    "تسلا موديل X",
    "Tesla Model X",
    "FSD",
    "Full Self Driving",
    "Supercharger",
    "شاحن تسلا",
  ],
  authors: [{ name: "تسلاوي" }],
  creator: "تسلاوي",
  publisher: "تسلاوي",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
    languages: {
      "ar": "/",
      "ar-SA": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "ar_SA",
    alternateLocale: ["en_US"],
    url: "/",
    siteName: "تسلاوي",
    title: "تسلاوي - أخبار تسلا بالعربية | Tesla News in Arabic",
    description: "موقع متخصص في أخبار تسلا بالعربية. آخر التحديثات، الإعلانات، تحديثات البرمجيات، ونصائح لمالكي تسلا.",
    images: [
      {
        url: "/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "تسلاوي - أخبار تسلا بالعربية",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "تسلاوي - أخبار تسلا بالعربية",
    description: "موقع متخصص في أخبار تسلا بالعربية. آخر التحديثات، الإعلانات، تحديثات البرمجيات، ونصائح لمالكي تسلا.",
    images: ["/og-default.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add your Google Search Console verification code here when available
    // google: "your-verification-code",
    // Add AdSense verification meta tag here if provided by Google
    // Example: other: { 'google-adsense-verification': 'your-code-here' },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${cairo.variable} antialiased`}>
        {/* Google tag (gtag.js) - Next.js Script component automatically moves to head */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-P6112Q0FJC"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-P6112Q0FJC', {
              page_path: window.location.pathname,
              send_page_view: true,
            });
          `}
        </Script>
        {/* Google AdSense - Loads in head */}
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9438547878744657"
          strategy="beforeInteractive"
          crossOrigin="anonymous"
        />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <MotionProvider>
            {children}
            {/* Sanity Live - enables real-time content updates */}
            <SanityLive />
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
