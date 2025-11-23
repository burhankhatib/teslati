import { NextResponse } from 'next/server';

/**
 * Health check endpoint to verify deployment and configuration
 */
export async function GET() {
  const envCheck = {
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasSanityProjectId: !!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    hasSanityDataset: !!process.env.NEXT_PUBLIC_SANITY_DATASET,
    hasSanityToken: !!process.env.SANITY_API_TOKEN,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json({
    status: 'ok',
    message: 'Teslati API is running',
    environment: envCheck,
  });
}

