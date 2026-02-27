import { BrowserContext } from '@playwright/test';
import config from '../../sharedUtils/config.js';

/**
 * Sets up authentication in localStorage and cookies for a given context.
 * Call before creating a new page.
 * Usage in UI Tests
 */
export async function setupAuth(context: BrowserContext, url: string) {
	// Build the storage object as your app expects
	const storageKey = config.auth.key;
	const storageValue = config.auth.state;
	const localStorageObj: Record<string, any> = {};
	localStorageObj[storageKey] = storageValue;

	// Set localStorage before any page loads
	await context.addInitScript((data) => {
		for (const key in data) {
			window.localStorage.setItem(key, JSON.stringify(data[key]));
		}
	}, localStorageObj);

	// Set the access_token cookie
	await context.addCookies([
		{
			name: "access_token",
			value: String(config.auth.state.token),
			domain: String(config.dashboard_domain),
			httpOnly: true,
			secure: true,
			path: '/',
			sameSite: "Lax"
		}
	]);
}
