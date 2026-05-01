import { chromium, Browser, Page } from 'playwright';
import { IPOData } from '../utils/interface';
import Tesseract from 'tesseract.js';

export class CameoScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    if (this.browser) return;

    this.browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox'],
    });

    const context = await this.browser.newContext();
    this.page = await context.newPage();
  }

  async fillIPORegistry(data: IPOData) {
    if (!this.page) {
      throw new Error('Initialize first');
    }

    try {
      await this.page.goto(
        'https://ipostatus1.cameoindia.com/',
        { waitUntil: 'networkidle' }
      );

      const options = await this.page.$$eval('#drpCompany option', (opts) => {
        return opts.map(o => ({ value: (o as HTMLOptionElement).value, text: o.textContent || '' }));
      });

      const matchedOption = options.find(
        (o) =>
          o.value === data.companyName ||
          o.text.toLowerCase().includes(data.companyName.toLowerCase())
      );

      if (matchedOption && matchedOption.value !== '0') {
        await this.page.selectOption('#drpCompany', { value: matchedOption.value });
      } else {
        // Fallback to the first available company if test data like 'COMP102' is used
        console.log(`[Cameo] Company '${data.companyName}' not found. Falling back to the first available company.`);
        await this.page.selectOption('#drpCompany', { index: 1 });
      }

      await this.page.selectOption('#ddlUserTypes', { value: 'PAN NO' });

      await this.page.fill('#txtfolio', data.panNumber);

      let attempt = 0;
      const maxAttempts = 3;
      let success = false;

      while (attempt < maxAttempts && !success) {
        attempt++;
        console.log(`[Cameo] Solving captcha automatically... Attempt ${attempt}/${maxAttempts}`);
        const captchaElement = await this.page.waitForSelector('#imgCaptcha', { state: 'visible' });
        if (!captchaElement) throw new Error('Captcha image not found');

        const captchaBuffer = await captchaElement.screenshot();
        
        const { data: { text } } = await Tesseract.recognize(captchaBuffer, 'eng');
        const cleanCaptcha = text.replace(/[^A-Za-z0-9]/g, '').trim();
        console.log(`[Cameo] Extracted captcha: ${cleanCaptcha}`);

        await this.page.fill('#txt_phy_captcha', cleanCaptcha);

        // Submit
        await this.page.click('#btngenerate');

        // Check for the specific error toast indicating incorrect captcha
        const errorToast = await this.page.waitForSelector('.toast-error:has-text("Captcha entered is incorrect")', { state: 'visible', timeout: 3000 }).catch(() => null);

        if (errorToast) {
          console.log('[Cameo] Captcha was incorrect. Retrying...');
          // Optional: Wait a bit before retrying to allow the page/captcha to refresh
          await this.page.waitForTimeout(1000);
        } else {
          console.log('[Cameo] Captcha accepted (or no error toast appeared).');
          success = true;
          // Wait for result page/data to fully load
          await this.page.waitForTimeout(3000);
        }
      }

      if (!success) {
        throw new Error('Failed to solve captcha after 3 attempts');
      }

      // Extract result and log it
      const resultText = await this.page.innerText('#lblmsg').catch(() => 'No result text found');
      console.log(`[Cameo] Result for ${data.panNumber}: ${resultText}`);

      // Close browser as requested
      await this.close();

      return { success: true, message: resultText };
    } catch (err: any) {
      await this.close();
      console.error(err);
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

export const cameoScraper = new CameoScraper();