import { chromium, Browser, Page } from 'playwright';
import { IPOData } from '../utils/interface.js';
import Tesseract from 'tesseract.js';

function solveMathCaptcha(text: string): string {
  try {
    // Extract only the math equation part before '=' or '?'
    let mathPart = (text.split('=')[0] || '').split('?')[0] || '';

    // Replace 'x' or 'X' with '*' for multiplication, then keep only numbers and math operators
    let cleanStr = mathPart.replace(/[xX]/g, '*').replace(/[^0-9\+\-\*\/]/g, '');
    
    // Remove any trailing math operators that might have been accidentally parsed
    cleanStr = cleanStr.replace(/[\+\-\*\/]+$/, '');

    if (!cleanStr) {
      // fallback if no math operators found or it's empty
      return text.replace(/[^A-Za-z0-9]/g, '').trim(); 
    }
    const result = new Function('return ' + cleanStr)();
    return Math.round(Number(result)).toString();
  } catch (e) {
    console.error(`[Integrated] Math captcha parsing failed for '${text}', falling back to clean text.`);
    return text.replace(/[^A-Za-z0-9]/g, '').trim();
  }
}

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
        console.log(`[Integrated] Selected Company: ${matchedOption.text} (Value: ${matchedOption.value})`);
        await this.page.selectOption('#CompDdl2', { value: matchedOption.value });
      } else {
        console.log(`[Integrated] Company '${data.companyName}' not found. Falling back to the first available company.`);
        console.log(`[Integrated] Selected Company: Index 1`);
        await this.page.selectOption('#CompDdl2', { index: 1 });
      }

      // Select PAN Number Choice (value "3")
      console.log(`[Integrated] Selected Pancard Type Choice: '3' (PAN Number)`);
      await this.page.selectOption('#ChoiceDdl2', { value: '3' });
      
      // Fill PAN Number
      console.log(`[Integrated] Filled PAN Number: ${data.panNumber}`);
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
        const rawCaptcha = text.trim();
        console.log(`[Integrated] Extracted raw captcha text: '${rawCaptcha}'`);
        
        const solvedCaptcha = solveMathCaptcha(rawCaptcha);
        console.log(`[Integrated] Filled solved captcha: ${solvedCaptcha}`);

        await this.page.fill('#Captcha_Txt', solvedCaptcha);

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
          await this.page.click('.CaptchaReloadImg').catch(() => { });
          await this.page.waitForTimeout(1000);
        } else if (alertMessage) {
          console.log(`[Integrated] Alert received: ${alertMessage}`);
          success = true; // Not a captcha error, but another alert (e.g. invalid PAN or record not found)
          resultMessage = alertMessage;
        } else {
          console.log('[Integrated] Captcha accepted (or no alert appeared).');
          success = true;

          // Extract result from page based on #inputdiv3
          const inputDiv3 = await this.page.$('#inputdiv3');
          if (inputDiv3) {
            const text = await inputDiv3.innerText();
            if (text.trim()) {
              resultMessage = text.trim();
            }
          }

          // Fallback check if it was a successful allotment with a different div
          if (resultMessage === 'Data submitted successfully') {
            const resultDiv = await this.page.$('#LinkID');
            if (resultDiv) {
              resultMessage = 'Allotment status retrieved successfully (check page for details).';
            }
          }

          console.log(`[Integrated] Result for ${data.panNumber}: ${resultMessage}`);
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
