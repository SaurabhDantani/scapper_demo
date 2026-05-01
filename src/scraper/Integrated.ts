import { chromium, Browser, Page } from 'playwright';
import { IPOData } from '../utils/interface.js';
import Tesseract from 'tesseract.js';

export class IntegratedScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    this.browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
      ],
    });

    const context = await this.browser.newContext();
    this.page = await context.newPage();
  }

  async fillIPORegistry(data: IPOData) {
    if (!this.page) {
      throw new Error('IntegratedScraper is not initialized. Call initialize() first.');
    }

    try {
      await this.page.goto('https://www.integratedregistry.in/IRMS_V2/IPOlink_v2.aspx', {
        waitUntil: 'networkidle',
      });

      // Robust company selection
      const options = await this.page.$$eval('#CompDdl2 option', (opts) => {
        return opts.map(o => ({ value: (o as HTMLOptionElement).value, text: o.textContent || '' }));
      });

      const matchedOption = options.find(
        (o) =>
          o.value === data.companyName ||
          o.text.toLowerCase().includes(data.companyName.toLowerCase())
      );

      if (matchedOption && matchedOption.value !== '0') {
        await this.page.selectOption('#CompDdl2', { value: matchedOption.value });
      } else {
        console.log(`[Integrated] Company '${data.companyName}' not found. Falling back to the first available company.`);
        await this.page.selectOption('#CompDdl2', { index: 1 });
      }

      // Select PAN Number Choice (value "3")
      await this.page.selectOption('#ChoiceDdl2', { value: '3' });

      // Fill PAN Number
      await this.page.fill('#Pan_txt2', data.panNumber);

      let attempt = 0;
      const maxAttempts = 3;
      let success = false;
      let resultMessage = 'Data submitted successfully';

      while (attempt < maxAttempts && !success) {
        attempt++;
        console.log(`[Integrated] Solving captcha automatically... Attempt ${attempt}/${maxAttempts}`);
        const captchaElement = await this.page.waitForSelector('#imgCaptcha', { state: 'visible' });
        if (!captchaElement) throw new Error('Captcha image not found');

        const captchaBuffer = await captchaElement.screenshot();
        
        const { data: { text } } = await Tesseract.recognize(captchaBuffer, 'eng');
        const cleanCaptcha = text.replace(/[^A-Za-z0-9]/g, '').trim();
        console.log(`[Integrated] Extracted captcha: ${cleanCaptcha}`);

        await this.page.fill('#Captcha_Txt', cleanCaptcha);

        let alertMessage = '';
        const dialogHandler = async (dialog: any) => {
          alertMessage = dialog.message();
          await dialog.accept();
        };
        this.page.on('dialog', dialogHandler);

        // Submit
        await this.page.click('#NCD_sub_btn2');
        
        await this.page.waitForTimeout(2000); // Wait for alert or result page
        this.page.off('dialog', dialogHandler);

        if (alertMessage && alertMessage.toLowerCase().includes('captcha')) {
          console.log(`[Integrated] Captcha incorrect: ${alertMessage}. Retrying...`);
          // Click the refresh button
          await this.page.click('.CaptchaReloadImg').catch(() => {});
          await this.page.waitForTimeout(1000);
        } else if (alertMessage) {
          console.log(`[Integrated] Alert received: ${alertMessage}`);
          success = true; // Not a captcha error, but another alert (e.g. invalid PAN or record not found)
          resultMessage = alertMessage;
        } else {
          console.log('[Integrated] Captcha accepted (or no alert appeared).');
          success = true;
          
          // Optionally extract result from page if it navigates or shows a div
          const resultDiv = await this.page.$('#LinkID');
          if (resultDiv) {
             resultMessage = 'Allotment status retrieved successfully (check page for details).';
          }
        }
      }

      if (!success) {
        throw new Error('Failed to solve captcha after 3 attempts');
      }

      // Close browser
      await this.close();

      return { success: true, message: resultMessage };
    } catch (error: any) {
      console.error('Automation Error:', error.message || error);
      throw error;
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

export const integratedScraper = new IntegratedScraper();
