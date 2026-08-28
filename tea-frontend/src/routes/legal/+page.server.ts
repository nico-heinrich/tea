import type { PageServerLoad } from './$types';
import { extractLocaleFromUrl } from '$lib/paraglide/runtime.js';
import { renderMarkdown } from '$lib/content/render.js';

export const load: PageServerLoad = async ({ url }) => {
	const locale = extractLocaleFromUrl(url) ?? 'en';
	const html = renderMarkdown(locale, 'legal');
	return { html };
};
