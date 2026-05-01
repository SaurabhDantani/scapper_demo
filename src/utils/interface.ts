// ---------------------------------------------------------------------------
// Shared input/output types used by all scrapers
// ---------------------------------------------------------------------------

/** Generic result returned by every scraper's run() method */
export interface ScraperResult {
  success: boolean;
  message: string;
  data?: unknown;
}

// ---------------------------------------------------------------------------
// integratedregistry.in
// ---------------------------------------------------------------------------
export interface IPOData {
  companyName: string;
  panNumber: string;
  registrationNumber: number; // 1 = Integrated Registry, 2 = Cameo, …
}

// ---------------------------------------------------------------------------
// Add new site interfaces below as you add more scrapers
// ---------------------------------------------------------------------------

/** Example: allotment site input (fill in real fields when ready) */
export interface AllotmentData {
  applicationNumber: string;
  panNumber: string;
}