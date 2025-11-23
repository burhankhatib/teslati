import { NextResponse } from 'next/server';

/**
 * Route handler for ads.txt file
 * This ensures ads.txt is accessible at /ads.txt
 * Also accessible via public/ads.txt (Next.js serves public folder automatically)
 */
export async function GET() {
  const adsTxtContent = `google.com, pub-9438547878744657, DIRECT, f08c47fec0942fa0`;

  return new NextResponse(adsTxtContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

