import { chromium } from 'playwright';

export async function scrapePage(url: string): Promise<string> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url);
    const content = await page.content();
    return content;
  } finally {
    await browser.close();
  }
}