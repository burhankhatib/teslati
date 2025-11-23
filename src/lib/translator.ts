import OpenAI from 'openai';

// Get OpenAI client instance
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('[OpenAI] API key not configured');
    return null;
  }

  return new OpenAI({
    apiKey,
  });
}

interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  success: boolean;
  error?: string;
}

// Simple in-memory cache for translations
const translationCache = new Map<string, Map<string, Map<string, string>>>();

function getFromCache(text: string, sourceLang: string, targetLang: string): string | undefined {
  return translationCache.get(text)?.get(sourceLang)?.get(targetLang);
}

function setToCache(text: string, sourceLang: string, targetLang: string, translatedText: string) {
  if (!translationCache.has(text)) {
    translationCache.set(text, new Map());
  }
  if (!translationCache.get(text)!.has(sourceLang)) {
    translationCache.get(text)!.set(sourceLang, new Map());
  }
  translationCache.get(text)!.get(sourceLang)!.set(targetLang, translatedText);
}

/**
 * Translate plain text using OpenAI
 */
export async function translateText(
  text: string,
  targetLang: string = 'ar',
  sourceLang: string = 'en'
): Promise<TranslationResult> {
  const cached = getFromCache(text, sourceLang, targetLang);
  if (cached) {
    console.log('[Translation] Cache hit for text');
    return {
      translatedText: cached,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      success: true,
    };
  }

  const client = getOpenAIClient();
  if (!client) {
    return {
      translatedText: '',
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      success: false,
      error: 'OpenAI API key not configured',
    };
  }

  try {
    const languageNames: Record<string, string> = {
      ar: 'Arabic',
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
    };

    const targetLanguageName = languageNames[targetLang] || targetLang;
    const sourceLanguageName = languageNames[sourceLang] || sourceLang;

    const estimatedTokens = Math.ceil(text.length / 4);
    const maxTokens = Math.min(Math.max(estimatedTokens * 2, 500), 4000);

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following text from ${sourceLanguageName} to ${targetLanguageName}. 

IMPORTANT: When translating "Tesla" to Arabic, always use "تسلا" (NOT "تيسلا"). The correct Arabic spelling is "تسلا" without the ي.

Return ONLY the translated text, nothing else.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
      max_completion_tokens: maxTokens,
    });

    const translatedText = response.choices[0]?.message?.content?.trim() || '';

    if (!translatedText) {
      throw new Error('Empty response from OpenAI');
    }

    setToCache(text, sourceLang, targetLang, translatedText);

    return {
      translatedText: translatedText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      success: true,
    };
  } catch (error) {
    console.error('Text translation error:', error);
    return {
      translatedText: '',
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      success: false,
      error: error instanceof Error ? error.message : 'Translation failed',
    };
  }
}

/**
 * Generate CLEAN semantic HTML for Arabic content
 * NO inline styles - styling handled by globals.css
 */
export async function generateStyledHtmlFromRSS(
  title: string,
  description: string,
  textContent: string,
  images: string[] = []
): Promise<TranslationResult> {
  const client = getOpenAIClient();
  if (!client) {
    return {
      translatedText: '',
      sourceLanguage: 'en',
      targetLanguage: 'ar',
      success: false,
      error: 'OpenAI API key not configured',
    };
  }

  try {
    const imagesList = images.length > 0
      ? `\n\nAvailable Images:\n${images.map((img, idx) => `${idx + 1}. ${img}`).join('\n')}`
      : '';

    const contentLength = title.length + description.length + textContent.length;
    const estimatedTokens = Math.ceil(contentLength / 4);
    const maxTokens = Math.min(Math.max(estimatedTokens * 3, 4000), 16000);

    const systemPrompt = `You are a content writer for Teslawy website. Generate clean HTML in Arabic.

ABSOLUTE REQUIREMENTS:
1. Each paragraph = separate <p> tag (minimum 10 <p> tags)
2. Each section = separate <h2> tag (minimum 3 <h2> tags)
3. NO classes allowed (example: <p class="..."> is FORBIDDEN)
4. NO styles allowed (example: <p style="..."> is FORBIDDEN)
5. Remove ALL source mentions: "Teslarati", "TESLARATI", "Not a Tesla App", "teslarati.com", "notateslaapp.com"
6. Remove ALL author information (names, bios, pictures)
7. Remove "Related News" or "More News" sections
8. Rewrite content in fresh, original way (don't just translate)
9. CRITICAL: Always write "Tesla" in Arabic as "تسلا" (NOT "تيسلا" - the ي is WRONG). Use "تسلا" consistently throughout.

CORRECT FORMAT:
<p>First paragraph here.</p>
<p>Second paragraph here.</p>
<h2>Section heading here</h2>
<p>Third paragraph here.</p>
<p>Fourth paragraph here.</p>
<img src="URL" alt="description">
<h2>Another section</h2>
<p>Fifth paragraph here.</p>

FORBIDDEN FORMATS:
❌ <p class="mb-4">text</p>
❌ <p class="anything">text</p>
❌ <p style="anything">text</p>
❌ One <p> with all content

Return ONLY the HTML with NO classes, NO styles.`;

    const userPrompt = `Title: ${title}
Description: ${description}

Article Content:
${textContent}
${imagesList}

REQUIREMENTS:
1. Create 10+ separate <p> tags (each paragraph separate)
2. Create 3+ <h2> tags for sections
3. NO class attributes (NO class="anything")
4. NO style attributes (NO style="anything")
5. Rewrite in Arabic (don't translate directly)
6. Remove ALL author names and source mentions:
   - Remove "Teslarati", "TESLARATI", "teslarati.com"
   - Remove "Not a Tesla App", "notateslaapp.com"
   - Remove any references to original source websites
   - Make content appear as original Teslawy content
7. Remove "Related News" or "More News" sections if present
8. CRITICAL: Always write "Tesla" in Arabic as "تسلا" (NOT "تيسلا"). The correct spelling is "تسلا" without the ي. Use "تسلا" consistently everywhere.

EXAMPLE OUTPUT FORMAT:
<p>مقدمة المقال هنا.</p>
<p>فقرة ثانية منفصلة.</p>
<h2>عنوان القسم الأول</h2>
<p>فقرة عن القسم الأول.</p>
<p>المزيد عن القسم الأول.</p>
<img src="${images[0] || 'IMAGE_URL'}" alt="وصف الصورة">
<h2>عنوان القسم الثاني</h2>
<p>فقرة عن القسم الثاني.</p>

Generate HTML with NO classes, NO styles, multiple separate paragraphs.`;

    const response = await client.chat.completions.create({
      model: 'gpt-5-2025-08-07',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      // Note: gpt-5-2025-08-07 only supports default temperature (1), cannot set custom values
      max_completion_tokens: maxTokens,
    });

    const generatedHtml = response.choices[0]?.message?.content?.trim() || '';

    if (!generatedHtml) {
      throw new Error('Empty response from OpenAI');
    }

    // Clean up markdown
    let cleanedHtml = generatedHtml;
    cleanedHtml = cleanedHtml.replace(/^```html\n?/i, '');
    cleanedHtml = cleanedHtml.replace(/^```\n?/i, '');
    cleanedHtml = cleanedHtml.replace(/\n?```$/i, '');
    cleanedHtml = cleanedHtml.trim();
    
    // FORCE REMOVE all class and style attributes (safety measure)
    cleanedHtml = cleanedHtml.replace(/\s+class=["'][^"']*["']/gi, '');
    cleanedHtml = cleanedHtml.replace(/\s+style=["'][^"']*["']/gi, '');
    
    console.log('[AI Generation] Removed all class and style attributes');

    // STRICT VALIDATION
    const paragraphCount = (cleanedHtml.match(/<p[^>]*>/gi) || []).length;
    const headingCount = (cleanedHtml.match(/<h[2-3][^>]*>/gi) || []).length;
    
    // Check for class attributes (should already be removed, but check anyway)
    const hasClasses = /<[^>]+class=["'][^"']*["']/i.test(cleanedHtml);
    
    // Check for style attributes (should already be removed, but check anyway)
    const hasStyles = /<[^>]+style=["'][^"']*["']/i.test(cleanedHtml);
    
    console.log(`[AI Generation] ✓ Validation: ${paragraphCount} <p>, ${headingCount} headings`);
    
    // Log warnings but don't reject (we already removed classes/styles)
    if (hasClasses) {
      console.warn('[AI Generation] ⚠️  Warning: Found class attributes after cleanup');
    }
    
    if (hasStyles) {
      console.warn('[AI Generation] ⚠️  Warning: Found style attributes after cleanup');
    }
    
    // REJECT if too few paragraphs
    if (paragraphCount < 5) {
      console.error(`[AI Generation] ✗ REJECTED: Only ${paragraphCount} paragraphs found`);
      console.error(`[AI Generation] ✗ First 500 chars: ${cleanedHtml.substring(0, 500)}`);
      throw new Error(`REJECTED: Only ${paragraphCount} paragraphs (minimum 5 required). AI did not follow instructions.`);
    }
    
    // REJECT if too few headings
    if (headingCount < 2) {
      console.error(`[AI Generation] ✗ REJECTED: Only ${headingCount} headings found`);
      throw new Error(`REJECTED: Only ${headingCount} headings (minimum 2 required). AI did not follow instructions.`);
    }
    
    // Check for single giant paragraph
    const firstPTag = cleanedHtml.match(/<p[^>]*>[\s\S]*?<\/p>/i)?.[0] || '';
    if (firstPTag.length > 1000 && paragraphCount < 3) {
      console.error('[AI Generation] ✗ REJECTED: Single giant paragraph detected');
      console.error(`[AI Generation] ✗ Paragraph length: ${firstPTag.length} chars`);
      throw new Error('REJECTED: Content wrapped in single giant paragraph. AI did not follow instructions.');
    }
    
    console.log(`[AI Generation] ✓✓✓ Validation PASSED - ${paragraphCount} paragraphs, ${headingCount} headings, clean HTML`);

    // Referral box removed - will be added statically on the website

    return {
      translatedText: cleanedHtml.trim(),
      sourceLanguage: 'en',
      targetLanguage: 'ar',
      success: true,
    };
  } catch (error) {
    console.error('[AI Generation] ERROR:', error);
    return {
      translatedText: '',
      sourceLanguage: 'en',
      targetLanguage: 'ar',
      success: false,
      error: error instanceof Error ? error.message : 'HTML generation failed',
    };
  }
}

/**
 * Translate HTML (legacy - use generateStyledHtmlFromRSS for new articles)
 */
export async function translateHtml(
  html: string,
  targetLang: string = 'ar',
  sourceLang: string = 'en'
): Promise<TranslationResult> {
  const cached = getFromCache(html, sourceLang, targetLang);
  if (cached) {
    return {
      translatedText: cached,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      success: true,
    };
  }

  const client = getOpenAIClient();
  if (!client) {
    const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return await translateText(textContent, targetLang, sourceLang);
  }

  try {
    const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    if (textContent.length === 0) {
      return {
        translatedText: html,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        success: false,
        error: 'No text content found in HTML',
      };
    }

    const languageNames: Record<string, string> = {
      ar: 'Arabic',
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
    };

    const targetLanguageName = languageNames[targetLang] || targetLang;
    const sourceLanguageName = languageNames[sourceLang] || sourceLang;

    const estimatedTokens = Math.ceil(html.length / 4);
    const maxTokens = Math.min(Math.max(estimatedTokens * 2, 2000), 16000);

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the HTML content from ${sourceLanguageName} to ${targetLanguageName}. Preserve ALL HTML tags exactly. Only translate text content. Return ONLY the translated HTML.`,
        },
        {
          role: 'user',
          content: html,
        },
      ],
      temperature: 0.3,
      max_completion_tokens: maxTokens,
    });

    const translatedHtml = response.choices[0]?.message?.content?.trim() || '';

    if (!translatedHtml) {
      throw new Error('Empty response from OpenAI');
    }

    setToCache(html, sourceLang, targetLang, translatedHtml);

    return {
      translatedText: translatedHtml,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      success: true,
    };
  } catch (error) {
    console.error('HTML translation error:', error);
    return {
      translatedText: '',
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      success: false,
      error: error instanceof Error ? error.message : 'HTML translation failed',
    };
  }
}
