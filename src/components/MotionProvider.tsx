'use client';

/**
 * Motion Provider - Wrapper for Motion.dev
 * Motion.dev automatically reads MOTION_API_KEY from environment variables
 * For Next.js, use NEXT_PUBLIC_MOTION_API_KEY for client-side access
 */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
    // Motion.dev will automatically use the API key from environment variables
    // No initialization needed - Motion reads from process.env automatically
    return <>{children}</>;
}

