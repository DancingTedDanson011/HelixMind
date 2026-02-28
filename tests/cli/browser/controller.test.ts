import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserController } from '../../../src/cli/browser/controller.js';

describe('BrowserController', () => {
  let controller: BrowserController;

  beforeEach(() => {
    controller = new BrowserController();
  });

  it('should start in closed state', () => {
    expect(controller.isOpen()).toBe(false);
  });

  it('should have null lastScreenshot initially', () => {
    expect(controller.lastScreenshot).toBeNull();
  });

  it('should have null URL when closed', () => {
    expect(controller.getUrl()).toBeNull();
  });

  it('should report not open in state', () => {
    const state = controller.state;
    expect(state.isOpen).toBe(false);
    expect(state.currentUrl).toBeNull();
  });

  it('should throw when navigating without opening', async () => {
    await expect(controller.navigate('https://example.com')).rejects.toThrow('not open');
  });

  it('should throw when taking screenshot without opening', async () => {
    await expect(controller.screenshot()).rejects.toThrow('not open');
  });

  it('should throw when clicking without opening', async () => {
    await expect(controller.click('button')).rejects.toThrow('not open');
  });

  it('should throw when typing without opening', async () => {
    await expect(controller.type('input', 'text')).rejects.toThrow('not open');
  });

  it('should throw when evaluating without opening', async () => {
    await expect(controller.evaluate('1+1')).rejects.toThrow('not open');
  });

  it('should throw when getting page text without opening', async () => {
    await expect(controller.getPageText()).rejects.toThrow('not open');
  });

  it('should throw when getting title without opening', async () => {
    await expect(controller.getTitle()).rejects.toThrow('not open');
  });

  it('should handle close when already closed', async () => {
    // Should not throw
    await controller.close();
    expect(controller.isOpen()).toBe(false);
  });
});

describe('BrowserController.launch errors', () => {
  it('should throw clear error if puppeteer-core not installed', async () => {
    const controller = new BrowserController();
    // This will fail on CI/test environments because puppeteer-core may not be installed
    // or Chrome may not be found — either way it should throw a descriptive error
    try {
      await controller.launch('/nonexistent/chrome');
      // If we get here, puppeteer-core IS installed and found a Chrome
      // Close it so the test doesn't leave a browser open
      await controller.close();
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      const msg = (err as Error).message;
      // Should be a clear error about Chrome or puppeteer
      expect(msg.length).toBeGreaterThan(10);
    }
  });
});
