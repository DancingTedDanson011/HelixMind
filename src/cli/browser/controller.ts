/**
 * BrowserController — headless/headful Chrome via puppeteer-core.
 *
 * puppeteer-core is an optional dependency — if not installed, launch() throws
 * a clear error message telling the user to install it.
 */

import { findChrome } from './chrome-finder.js';

/** Minimal subset of puppeteer types we need (avoids hard dependency on types) */
interface PuppeteerBrowser {
  newPage(): Promise<PuppeteerPage>;
  close(): Promise<void>;
  connected: boolean;
}

interface PuppeteerPage {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  screenshot(options?: { encoding?: string; fullPage?: boolean; type?: string }): Promise<Buffer | string>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string, options?: { delay?: number }): Promise<void>;
  evaluate<T>(fn: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T>;
  title(): Promise<string>;
  url(): string;
  content(): Promise<string>;
  setViewport(viewport: { width: number; height: number }): Promise<void>;
  close(): Promise<void>;
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<unknown>;
  $eval(selector: string, fn: (el: any) => string): Promise<string>;
}

export interface BrowserState {
  isOpen: boolean;
  currentUrl: string | null;
  pageTitle: string | null;
}

export class BrowserController {
  private browser: PuppeteerBrowser | null = null;
  private page: PuppeteerPage | null = null;
  private _lastScreenshot: Buffer | null = null;

  /** Get the last screenshot taken (for vision processing) */
  get lastScreenshot(): Buffer | null {
    return this._lastScreenshot;
  }

  /** Current browser state */
  get state(): BrowserState {
    return {
      isOpen: this.browser !== null && this.browser.connected,
      currentUrl: this.page?.url() ?? null,
      pageTitle: null, // set async via getTitle()
    };
  }

  /**
   * Launch Chrome browser.
   * @param executablePath — override Chrome path (auto-detected if omitted)
   * @param headless — run headless (default: false for visibility)
   */
  async launch(executablePath?: string, headless: boolean = false): Promise<void> {
    if (this.browser?.connected) {
      throw new Error('Browser already open. Close it first or navigate to a new URL.');
    }

    // Dynamic import — puppeteer-core is optional
    let puppeteer: any;
    try {
      puppeteer = await import('puppeteer-core');
    } catch {
      throw new Error(
        'puppeteer-core is not installed. Run: npm install puppeteer-core\n' +
        'Note: This uses your existing Chrome — no extra download needed.'
      );
    }

    // Find Chrome
    const chromePath = executablePath ?? findChrome();
    if (!chromePath) {
      throw new Error(
        'Chrome not found. Install Google Chrome or provide the path:\n' +
        '  helixmind config set browser.chromePath "/path/to/chrome"'
      );
    }

    // Launch
    const launchFn = puppeteer.default?.launch ?? puppeteer.launch;
    this.browser = await launchFn({
      executablePath: chromePath,
      headless: headless ? 'shell' : false,
      defaultViewport: { width: 1280, height: 720 },
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-popup-blocking',
      ],
    }) as PuppeteerBrowser;

    this.page = await this.browser.newPage();
  }

  /** Navigate to a URL */
  async navigate(url: string): Promise<{ title: string; url: string }> {
    this.ensureOpen();

    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    await this.page!.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const title = await this.page!.title();
    return { title, url: this.page!.url() };
  }

  /** Take a screenshot, returns PNG buffer */
  async screenshot(): Promise<Buffer> {
    this.ensureOpen();
    const buffer = await this.page!.screenshot({
      type: 'png',
      fullPage: false,
      encoding: 'binary',
    }) as Buffer;
    this._lastScreenshot = buffer;
    return buffer;
  }

  /** Click an element by CSS selector */
  async click(selector: string): Promise<void> {
    this.ensureOpen();
    try {
      await this.page!.waitForSelector(selector, { timeout: 5000 });
    } catch {
      throw new Error(`Element not found: ${selector}`);
    }
    await this.page!.click(selector);
  }

  /** Type text into an element */
  async type(selector: string, text: string): Promise<void> {
    this.ensureOpen();
    try {
      await this.page!.waitForSelector(selector, { timeout: 5000 });
    } catch {
      throw new Error(`Element not found: ${selector}`);
    }
    await this.page!.type(selector, text, { delay: 30 });
  }

  /** Execute JavaScript in the page context */
  async evaluate<T = unknown>(script: string): Promise<T> {
    this.ensureOpen();
    return this.page!.evaluate(script) as Promise<T>;
  }

  /** Get visible text content of the page */
  async getPageText(): Promise<string> {
    this.ensureOpen();
    const text = await this.page!.evaluate(
      `document.body.innerText`
    ) as string;
    // Limit to 5000 chars to avoid token explosion
    return text.length > 5000 ? text.slice(0, 5000) + '\n...(truncated)' : text;
  }

  /** Get page title */
  async getTitle(): Promise<string> {
    this.ensureOpen();
    return this.page!.title();
  }

  /** Get current URL */
  getUrl(): string | null {
    return this.page?.url() ?? null;
  }

  /** Close the browser */
  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Already closed
      }
      this.browser = null;
      this.page = null;
      this._lastScreenshot = null;
    }
  }

  /** Check if browser is open */
  isOpen(): boolean {
    return this.browser !== null && this.browser.connected;
  }

  private ensureOpen(): void {
    if (!this.browser || !this.browser.connected || !this.page) {
      throw new Error('Browser is not open. Use browser_open first.');
    }
  }
}
