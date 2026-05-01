import cron from 'node-cron';
import { handleAllotment } from '../scraper/handleAllotment.js';
import { IPOData } from '../utils/interface';

// Hardcoded array of bulk data as requested
const bulkData: IPOData[] = [
  { companyName: 'COMP102', panNumber: 'AAAP2574M', registrationNumber: 3 },
  { companyName: 'IDX', panNumber: 'BBBP1234N', registrationNumber: 2 },
  { companyName: 'Apsis', panNumber: 'CCCC2222R', registrationNumber: 1 },
];

async function processBulkData() {
  console.log('[Cron] Starting bulk data processing...');
  let successCount = 0;
  let failCount = 0;

  for (const item of bulkData) {
    console.log(`[Cron] Processing item: ${JSON.stringify(item)}`);
    try {
      await handleAllotment(item);
      console.log(`[Cron] Successfully processed ${item.panNumber}`);
      successCount++;
    } catch (error: any) {
      console.error(`[Cron] Failed to process ${item.panNumber}:`, error.message || error);
      failCount++;
    }

    // Optional: wait a couple of seconds between requests to be polite
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(`[Cron] Finished bulk processing. Success: ${successCount}, Failed: ${failCount}`);
}

export function startBulkScraperCron() {
  console.log('[Server] Initializing bulk scraper cron job (every 5 minutes)...');

  cron.schedule('*/2 * * * *', async () => {
    await processBulkData();
  });
}
