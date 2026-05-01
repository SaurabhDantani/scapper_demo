import { chromium, Browser, Page } from 'playwright';
import { IPOData } from '../utils/interface';

export function evaluateMathCaptcha(text: string): number {
  const match = text.match(/(\d+)\s*([\+\-\*])\s*(\d+)/);
  if (!match) {
    throw new Error(`Failed to parse math captcha from text: ${text}`);
  }

  const num1 = parseInt(match[1]!, 10);
  const operator = match[2]!;
  const num2 = parseInt(match[3]!, 10);

  switch (operator) {
    case '+': return num1 + num2;
    case '-': return num1 - num2;
    case '*': return num1 * num2;
    default:
      throw new Error(`Unsupported math operator: ${operator}`);
  }
}

export class AlankitScraper {
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
        'http://ipo.alankit.com/', 
        { waitUntil: 'networkidle' }
      );

      // Select company
      await this.page.selectOption('#drpComp', { value: data.companyName });

      // Click "PAN" radio button
      await this.page.click('input[value="PANNO"]');

      // The PAN input field might need a moment to become visible
      await this.page.waitForSelector('#txtPAN', { state: 'visible' });
      await this.page.fill('#txtPAN', data.panNumber);

      // Solve Math Captcha
      console.log('[Alankit] Solving math captcha...');
      const captchaText = await this.page.innerText('#lblcaptcha');
      console.log(`[Alankit] Captcha text found: ${captchaText}`);
      
      const result = evaluateMathCaptcha(captchaText);
      await this.page.fill('#txtcaptcha', result.toString());
      console.log(`[Alankit] Filled captcha with: ${result}`);

      // Submit
      await this.page.click('#btnsearch');

      await this.page.waitForTimeout(3000);

      // Extract result and log it
      const resultText = await this.page.innerText('#lblmsg').catch(() => 'No result text found');
      console.log(`[Alankit] Result for ${data.panNumber}: ${resultText}`);

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

export const alankitScraper = new AlankitScraper();