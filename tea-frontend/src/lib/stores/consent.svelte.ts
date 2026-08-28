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

export function getConsent(): ConsentValue | null {
	return consent;
}

export function acceptConsent(): void {
	consent = 'accepted';
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(CONSENT_KEY, 'accepted');
		}
	} catch {
		// localStorage may be unavailable
	}
}

export function declineConsent(): void {
	consent = 'declined';
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(CONSENT_KEY, 'declined');
		}
	} catch {
		// localStorage may be unavailable
	}
}
