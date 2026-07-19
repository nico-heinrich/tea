/**
 * Lightweight state for whether a search is active (results visible).
 * Separate from the search store — controls layout switching only.
 */

let searchActive = $state<boolean>(false);

/** Whether the user has performed a search (hero → top-bar transition) */
export function getSearchActive(): boolean {
	return searchActive;
}

/** Set the search-active state */
export function setSearchActive(value: boolean): void {
	searchActive = value;
}
