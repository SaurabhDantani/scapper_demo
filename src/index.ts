import express, { Request, Response } from 'express';
import { handleAllotment } from './scraper/handleAllotment.js';
import { integratedScraper } from './scraper/Integrated.js';
import { startBulkScraperCron } from './cron/bulkScraper';

const app = express();
const PORT = process.env['PORT'] ?? 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

// ── IPO / Allotment route ─────────────────────────────────────────────────────
app.get('/ipo', async (req: Request, res: Response) => {
  // const { companyName, panNumber, registrationNumber } = req.body as IPOData;

  const companyName = "Apsis"
  const panNumber = "AAACU2414K"
  const registrationNumber = 1

  if (!companyName || !panNumber || !registrationNumber) {
    res.status(400).json({ error: 'companyName and panNumber and registrationNumber are required' });
    return;
  }

  try {
    const result = await handleAllotment({ companyName, panNumber, registrationNumber });
    res.json(result);
  } catch (error) {
    console.error('[POST /ipo] Error:', error);
    res.status(500).json({ error: 'Failed to submit IPO registration' });
  }
});

// ── Initialize Cron Jobs ──────────────────────────────────────────────────────
startBulkScraperCron();

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] Listening on http://localhost:${PORT}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down...');
  await integratedScraper.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received. Shutting down...');
  await integratedScraper.close();
  process.exit(0);
});