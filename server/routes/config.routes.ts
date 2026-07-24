import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware } from '../auth';
import { getDb, persistDatabase } from '../database';

const router = Router();

// GET /api/config
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const result = db.exec(`SELECT key, value FROM config`);
  if (result.length === 0) {
    res.json({});
    return;
  }

  const config: Record<string, string> = {};
  for (const row of result[0].values) {
    config[row[0] as string] = row[1] as string;
  }

  res.json({
    storeName: config.storeName || 'Mi Tienda POS',
    storeInfo: config.storeInfo || '',
    lowStockAlert: parseInt(config.lowStockAlert || '5'),
  });
});

// PUT /api/config
router.put('/', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const { storeName, storeInfo, lowStockAlert } = req.body;
  const db = getDb();

  if (storeName !== undefined) {
    db.run(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`, ['storeName', storeName]);
  }
  if (storeInfo !== undefined) {
    db.run(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`, ['storeInfo', storeInfo]);
  }
  if (lowStockAlert !== undefined) {
    db.run(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`, ['lowStockAlert', String(lowStockAlert)]);
  }

  persistDatabase();
  res.json({ storeName, storeInfo, lowStockAlert });
});

export default router;
