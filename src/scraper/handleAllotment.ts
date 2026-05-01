import { integratedScraper } from './Integrated.js';
import { cameoScraper } from './cameo.js';
import { alankitScraper } from './alankit.js';
import { IPOData } from '../utils/interface';

export async function handleAllotment(data: IPOData) {
  switch (data.registrationNumber) {
    case 1: {
      await integratedScraper.initialize();
      return await integratedScraper.fillIPORegistry(data);
    }

    case 2: {
      await cameoScraper.initialize();
      return await cameoScraper.fillIPORegistry(data);
    }

    case 3: {
      await alankitScraper.initialize();
      return await alankitScraper.fillIPORegistry(data);
    }

    default:
      throw new Error(
        `Unknown registrationNumber: ${data.registrationNumber}. ` +
          `Supported values: 1 (Integrated Registry), 2 (Cameo), 3 (Alankit).`
      );
  }
}