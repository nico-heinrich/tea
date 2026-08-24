import { localizeHref } from '$lib/paraglide/runtime.js';
import * as m from '$lib/paraglide/messages.js';

export interface NavLink {
	label: string;
	href: string;
}

export function getNavLinks(): NavLink[] {
	return [
		{ label: m['footer.search'](), href: localizeHref('/') },
		{ label: m['footer.about'](), href: localizeHref('/about') },
		{ label: m['footer.contact'](), href: localizeHref('/contact') },
		{ label: m['footer.legal'](), href: localizeHref('/legal') },
		{ label: m['footer.privacy'](), href: localizeHref('/privacy') }
	];
}
