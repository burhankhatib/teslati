import { NextResponse } from 'next/server';
import { translateText, translateHtml } from '@/lib/translator';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, html, targetLang = 'ar', sourceLang = 'en' } = body;

    if (!text && !html) {
      return NextResponse.json(
        { error: 'Text or HTML content is required' },
        { status: 400 }
      );
    }

    console.log(`[Translation API] Translating ${html ? 'HTML' : 'text'} from ${sourceLang} to ${targetLang}`);

    let result;
    if (html) {
      result = await translateHtml(html, targetLang, sourceLang);
    } else {
      result = await translateText(text, targetLang, sourceLang);
    }

    console.log(`[Translation API] Translation ${result.success ? 'succeeded' : 'failed'}:`, {
      success: result.success,
      error: result.error,
      textLength: result.translatedText?.length || 0,
    });

    if (!result.success) {
      return NextResponse.json(
        { 
          ...result,
          error: result.error || 'Translation failed',
        },
        { status: 200 } // Return 200 but with success: false so client can handle it
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Translation API] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to translate content',
        message: error instanceof Error ? error.message : 'Unknown error',
        translatedText: '',
      },
      { status: 500 }
    );
  }
}

