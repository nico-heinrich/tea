// ──────────────────────────────────────────────
// Consent state (ePrivacy: optional localStorage)
// ──────────────────────────────────────────────

const CONSENT_KEY = 'tea-consent';

type ConsentValue = 'accepted' | 'declined';

function readConsentFromStorage(): ConsentValue | null {
	try {
		if (typeof localStorage === 'undefined') return null;
		const stored = localStorage.getItem(CONSENT_KEY);
		if (stored === 'accepted' || stored === 'declined') {
			return stored;
		}
	} catch {
		return null;
	}
	return null;
}

let consent = $state<ConsentValue | null>(readConsentFromStorage());

// Forced open by the footer "Consent settings" control, independent of `consent`
// so an already-decided user can review/change their choice.
let bannerOpen = $state(false);

export function getConsent(): ConsentValue | null {
	return consent;
}

export function isBannerOpen(): boolean {
	return bannerOpen;
}

export function openConsent(): void {
	bannerOpen = true;
}

export function closeConsent(): void {
	bannerOpen = false;
}

function setConsent(value: ConsentValue): void {
	consent = value;
	bannerOpen = false;
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(CONSENT_KEY, value);
		}
	} catch {
		// localStorage may be unavailable
	}
}

export function acceptConsent(): void {
	setConsent('accepted');
}

export function declineConsent(): void {
	setConsent('declined');
}
