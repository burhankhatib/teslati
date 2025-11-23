import { Metadata } from 'next';

export const homepageMetadata: Metadata = {
  title: "تسلاوي - أخبار تسلا بالعربية | Tesla News in Arabic",
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
  ],
  openGraph: {
    title: "تسلاوي - أخبار تسلا بالعربية",
    description: "موقع متخصص في أخبار تسلا بالعربية. آخر التحديثات، الإعلانات، تحديثات البرمجيات، ونصائح لمالكي تسلا.",
    url: "/",
    siteName: "تسلاوي",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "تسلاوي - أخبار تسلا بالعربية",
      },
    ],
    locale: "ar_SA",
    type: "website",
  },
};

