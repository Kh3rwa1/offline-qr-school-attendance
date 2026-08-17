import { Page, expect, Locator } from '@playwright/test';

export interface TouchTargetInspectionReport {
  contextName: string;
  totalChecked: number;
  elements: Array<{
    tag: string;
    text: string;
    ariaLabel: string | null;
    width: number;
    height: number;
  }>;
}

/**
 * Traverses all visible, non-disabled interactive elements on the page
 * and asserts that each element satisfies the minimum touch target dimensions (default 44x44px).
 * Fails if zero interactive elements are found on an expected active view.
 */
export async function assertAllInteractiveElementsTouchTarget(
  page: Page,
  options: {
    minSize?: number;
    contextName?: string;
    minExpectedCount?: number;
  } = {}
): Promise<TouchTargetInspectionReport> {
  const minSize = options.minSize ?? 44;
  const contextName = options.contextName ?? page.url();
  const minExpectedCount = options.minExpectedCount ?? 1;

  // Wait for network and DOM idle
  await page.waitForLoadState('domcontentloaded');

  const interactiveSelector = [
    'button:not([disabled])',
    'a[href]',
    'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'summary',
    '[role="button"]:not([aria-disabled="true"])',
    '[role="link"]:not([aria-disabled="true"])',
    '[role="checkbox"]:not([aria-disabled="true"])',
    '[role="radio"]:not([aria-disabled="true"])',
    '[role="switch"]:not([aria-disabled="true"])',
    '[role="tab"]:not([aria-disabled="true"])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])',
  ].join(', ');

  const locator = page.locator(interactiveSelector);
  const count = await locator.count();

  expect(
    count,
    `Expected at least ${minExpectedCount} interactive elements in context "${contextName}", but found 0.`
  ).toBeGreaterThanOrEqual(minExpectedCount);

  const inspected: TouchTargetInspectionReport = {
    contextName,
    totalChecked: 0,
    elements: [],
  };

  for (let i = 0; i < count; i++) {
    const el = locator.nth(i);

    // Only test elements that are visible and rendered in the layout
    const isVisible = await el.isVisible().catch(() => false);
    if (!isVisible) continue;

    const box = await el.boundingBox();
    if (!box || box.width === 0 || box.height === 0) continue;

    // Check if element is inside an aria-hidden or sr-only container
    const isAssistiveHidden = await el.evaluate((node) => {
      return Boolean(
        node.closest('[aria-hidden="true"]') ||
        node.closest('.sr-only') ||
        node.classList.contains('sr-only')
      );
    });
    if (isAssistiveHidden) continue;

    const metadata = await el.evaluate((node) => {
      const el = node as HTMLElement;
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || el.textContent || '').trim().slice(0, 40),
        ariaLabel: el.getAttribute('aria-label') || el.getAttribute('title'),
      };
    });

    const effectiveBox = await el.evaluate((node) => {
      const el = node as HTMLElement;
      if (el.tagName === 'INPUT' && (el.getAttribute('type') === 'checkbox' || el.getAttribute('type') === 'radio')) {
        const parentLabel = el.closest('label');
        if (parentLabel) {
          const rect = parentLabel.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }
      }
      return null;
    });

    const targetWidth = effectiveBox ? effectiveBox.width : box.width;
    const targetHeight = effectiveBox ? effectiveBox.height : box.height;

    // Touch targets must satisfy minSize in width and height
    // We provide clear diagnostic failures
    expect(
      targetWidth,
      `Touch target width violation for <${metadata.tag}> "${metadata.ariaLabel || metadata.text}" at ${contextName}: width ${targetWidth}px < ${minSize}px`
    ).toBeGreaterThanOrEqual(minSize - 0.5); // 0.5px rounding tolerance

    expect(
      targetHeight,
      `Touch target height violation for <${metadata.tag}> "${metadata.ariaLabel || metadata.text}" at ${contextName}: height ${targetHeight}px < ${minSize}px`
    ).toBeGreaterThanOrEqual(minSize - 0.5);

    inspected.totalChecked++;
    inspected.elements.push({
      tag: metadata.tag,
      text: metadata.text,
      ariaLabel: metadata.ariaLabel,
      width: Math.round(box.width),
      height: Math.round(box.height),
    });
  }

  expect(
    inspected.totalChecked,
    `Expected at least ${minExpectedCount} visible interactive elements tested in "${contextName}", but checked ${inspected.totalChecked}`
  ).toBeGreaterThanOrEqual(minExpectedCount);

  return inspected;
}
