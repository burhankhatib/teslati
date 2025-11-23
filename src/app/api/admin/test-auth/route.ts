import { NextResponse } from 'next/server';

/**
 * Test endpoint to check if environment variables are loaded correctly
 * This helps debug authentication issues
 */
export async function GET() {
  const cronSecret = process.env.CRON_SECRET;
  const youtubePasswordEnv = process.env.YOUTUBE_ADMIN_PASSWORD;
  const youtubePassword = youtubePasswordEnv || cronSecret;

  return NextResponse.json({
    hasCronSecret: !!cronSecret,
    hasYoutubePasswordEnv: !!youtubePasswordEnv,
    hasYoutubePassword: !!youtubePassword,
    cronSecretLength: cronSecret?.length || 0,
    youtubePasswordEnvLength: youtubePasswordEnv?.length || 0,
    youtubePasswordLength: youtubePassword?.length || 0,
    // Don't expose actual passwords, just show first and last character
    cronSecretPreview: cronSecret ? `${cronSecret[0]}...${cronSecret[cronSecret.length - 1]}` : 'not set',
    youtubePasswordEnvPreview: youtubePasswordEnv ? `${youtubePasswordEnv[0]}...${youtubePasswordEnv[youtubePasswordEnv.length - 1]}` : 'not set',
    nodeEnv: process.env.NODE_ENV,
  });
}

