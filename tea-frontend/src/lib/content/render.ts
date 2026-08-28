import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

import privacyEn from '$lib/content/privacy/en.md?raw';
import privacyDe from '$lib/content/privacy/de.md?raw';
import legalEn from '$lib/content/legal/en.md?raw';
import legalDe from '$lib/content/legal/de.md?raw';

const content: Record<string, Record<string, string>> = {
	privacy: { en: privacyEn, de: privacyDe },
	legal: { en: legalEn, de: legalDe }
};

/**
 * Render a markdown content page for the given locale and slug.
 * The HTML is sanitized with DOMPurify before being returned.
 */
export function renderMarkdown(locale: string, slug: string): string {
	const lang = locale === 'de' ? 'de' : 'en';
	const markdown = content[slug]?.[lang];
	if (!markdown) return '';
	const rawHtml = marked.parse(markdown) as string;
	return DOMPurify.sanitize(rawHtml);
}
