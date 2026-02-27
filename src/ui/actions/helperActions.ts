import { Page, BrowserContext, Response } from '@playwright/test';

export class HelperActions {
	page: Page;
	context: BrowserContext;

	constructor(page: Page, context: BrowserContext) {
		this.page = page;
		this.context = context;
	}

	/**
	 * Intercepts matching requests and handles them with a custom handler.
	 * @param url - The URL pattern or regex to match requests.
	 * @param handler - The handler function for the route.
	 * @returns Promise<void>
	 */
	async interceptRequests(url: string | RegExp, handler: Parameters<Page['route']>[1]): Promise<void> {
		await this.page.route(url, handler);
	}

	/**
	 * Fulfills a route with custom response data.
	 * @param route - The route object from Playwright.
	 * @param body - The response body to send.
	 * @param status - Optional HTTP status code (default 200).
	 * @param contentType - Optional content type (default 'application/json').
	 * @returns Promise<void>
	 */
	async fulfillRoute(route: any, body: any, status = 200, contentType = 'application/json'): Promise<void> {
		await route.fulfill({
			status,
			contentType,
			body: typeof body === 'string' ? body : JSON.stringify(body)
		});
	}

	/**
	 * Continues a route without modification.
	 * @param route - The route object from Playwright.
	 * @returns Promise<void>
	 */
	async continueRoute(route: any): Promise<void> {
		await route.continue();
	}

	/**
	 * Aborts a route, blocking the request entirely.
	 * @param route - The route object from Playwright.
	 * @returns Promise<void>
	 */
	async abortRoute(route: any): Promise<void> {
		await route.abort();
	}

	/**
	 * Waits for a specific response matching the URL or regex.
	 * @param url - The URL pattern or regex to match the response.
	 * @returns Promise<Response>
	 */
	async waitForResponse(url: string | RegExp) {
		return await this.page.waitForResponse(url);
	}

	/**
	 * Waits for a specific request matching the URL or regex.
	 * @param url - The URL pattern or regex to match the request.
	 * @returns response of the api , Promise<Request>
	 */
	async waitForRequest(url: string | RegExp) {
		const response =  await this.page.waitForRequest(url);
		return response;
	}

	/**
	 * Adds a listener for all responses.
	 * @param callback - The callback function to execute on each response.
	 */
	/**
	 * Adds a listener for all responses.
	 * @param callback - The callback function to execute on each response.
	 */
	onResponse(callback: (response: Response) => void) {
		this.page.on('response', callback);
	}

	/**
	 * Removes a route handler for the specified URL or regex.
	 * @param url - The URL pattern or regex to unroute.
	 * @returns Promise<void>
	 */
	async unroute(url: string | RegExp): Promise<void> {
		await this.page.unroute(url);
	}

	/**
	 * Uploads a file to the specified input selector.
	 */
	async uploadFile(selector: string, filePath: string) {
		await this.page.setInputFiles(selector, filePath);
	}

	/**
	 * Generic action: take screenshot
	 */
	async takeScreenshot(path: string) {
		await this.page.screenshot({ path });
	}

    /**
	 * Listener: Detects a dialog and performs action(ok/cancel)
	 */
	async takeDialogAction(action:'accept' | 'dismiss' = 'accept' ) {
		this.page.once('dialog', async dialog => {
            console.log(`Handling dialog: ${dialog.message()}`);
            
            if (action === 'accept') {
                await dialog.accept();
            } else {
                await dialog.dismiss();
            }
        });
	}
}
