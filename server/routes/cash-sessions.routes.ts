import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth';
import { getDb, persistDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/cash-sessions
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const { terminalId } = req.query;

  let query = `SELECT id, open_date, close_date, opened_by, opened_by_name, closed_by, closed_by_name, initial_cash, expected_amounts, real_amounts, discrepancies, status, terminal_id FROM cash_sessions ORDER BY open_date DESC`;
  let params: any[] = [];

  if (terminalId) {
    query = `SELECT id, open_date, close_date, opened_by, opened_by_name, closed_by, closed_by_name, initial_cash, expected_amounts, real_amounts, discrepancies, status, terminal_id FROM cash_sessions WHERE terminal_id = ? ORDER BY open_date DESC`;
    params = [terminalId];
  }

  const result = db.exec(query, params);
  if (result.length === 0) {
    res.json([]);
    return;
  }

  const sessions = result[0].values.map(row => ({
    id: row[0],
    openDate: row[1],
    closeDate: row[2] || undefined,
    openedBy: row[3],
    openedByName: row[4],
    closedBy: row[5] || undefined,
    closedByName: row[6] || undefined,
    initialCash: row[7],
    expectedAmounts: JSON.parse(row[8] as string),
    realAmounts: row[9] ? JSON.parse(row[9] as string) : undefined,
    discrepancies: row[10] ? JSON.parse(row[10] as string) : undefined,
    status: row[11],
    terminalId: row[12],
  }));

  res.json(sessions);
});

// GET /api/cash-sessions/active - Get active session for current terminal
router.get('/active', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const db = getDb();

  const result = db.exec(
    `SELECT id, open_date, close_date, opened_by, opened_by_name, closed_by, closed_by_name, initial_cash, expected_amounts, real_amounts, discrepancies, status, terminal_id FROM cash_sessions WHERE terminal_id = ? AND status = 'open' LIMIT 1`,
    [user.terminalId]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    res.json(null);
    return;
  }

  const row = result[0].values[0];
  res.json({
    id: row[0],
    openDate: row[1],
    closeDate: row[2] || undefined,
    openedBy: row[3],
    openedByName: row[4],
    closedBy: row[5] || undefined,
    closedByName: row[6] || undefined,
    initialCash: row[7],
    expectedAmounts: JSON.parse(row[8] as string),
    realAmounts: row[9] ? JSON.parse(row[9] as string) : undefined,
    discrepancies: row[10] ? JSON.parse(row[10] as string) : undefined,
    status: row[11],
    terminalId: row[12],
  });
});

// POST /api/cash-sessions/open - Open a new cash session for the terminal
router.post('/open', authMiddleware, (req: Request, res: Response) => {
  const { initialCash, paymentMethodIds } = req.body;
  const user = (req as any).user;
  const db = getDb();

  // Check if there's already an open session for this terminal
  const existing = db.exec(
    `SELECT id FROM cash_sessions WHERE terminal_id = ? AND status = 'open'`,
    [user.terminalId]
  );
  if (existing.length > 0 && existing[0].values.length > 0) {
    res.status(409).json({ error: 'Ya existe una caja abierta para esta terminal.' });
    return;
  }

  const sessionId = 'caja_' + uuidv4().split('-')[0];
  const now = new Date().toISOString();

  // Build expected amounts (cash gets initial amount, rest 0)
  const expectedAmounts: Record<string, number> = {};
  if (Array.isArray(paymentMethodIds)) {
    for (const pmId of paymentMethodIds) {
      expectedAmounts[pmId] = 0;
    }
  }
  // Set initial cash for 'Efectivo' method (pm1 by convention, or first one)
  const cashMethodResult = db.exec(`SELECT id FROM payment_methods WHERE LOWER(name) LIKE '%efectivo%' LIMIT 1`);
  const cashMethodId = cashMethodResult.length > 0 ? cashMethodResult[0].values[0][0] as string : 'pm1';
  expectedAmounts[cashMethodId] = initialCash || 0;

  db.run(
    `INSERT INTO cash_sessions (id, open_date, opened_by, opened_by_name, initial_cash, expected_amounts, status, terminal_id) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
    [sessionId, now, user.userId, user.name, initialCash || 0, JSON.stringify(expectedAmounts), user.terminalId]
  );
  persistDatabase();

  res.status(201).json({
    id: sessionId,
    openDate: now,
    openedBy: user.userId,
    openedByName: user.name,
    initialCash: initialCash || 0,
    expectedAmounts,
    status: 'open',
    terminalId: user.terminalId,
  });
});

// POST /api/cash-sessions/:id/close - Close a cash session
router.post('/:id/close', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const { realAmounts } = req.body;
  const user = (req as any).user;
  const db = getDb();

  // Get session
  const sessionResult = db.exec(
    `SELECT expected_amounts, status, terminal_id FROM cash_sessions WHERE id = ?`, [id]
  );
  if (sessionResult.length === 0 || sessionResult[0].values.length === 0) {
    res.status(404).json({ error: 'Sesión de caja no encontrada.' });
    return;
  }

  const row = sessionResult[0].values[0];
  if (row[1] !== 'open') {
    res.status(400).json({ error: 'Esta sesión de caja ya está cerrada.' });
    return;
  }

  const expectedAmounts = JSON.parse(row[0] as string);
  const now = new Date().toISOString();

  // Calculate discrepancies
  const discrepancies: Record<string, number> = {};
  for (const key of Object.keys(expectedAmounts)) {
    const expected = expectedAmounts[key] || 0;
    const real = (realAmounts && realAmounts[key]) || 0;
    discrepancies[key] = real - expected;
  }

  db.run(
    `UPDATE cash_sessions SET close_date = ?, closed_by = ?, closed_by_name = ?, real_amounts = ?, discrepancies = ?, status = 'closed' WHERE id = ?`,
    [now, user.userId, user.name, JSON.stringify(realAmounts || {}), JSON.stringify(discrepancies), id]
  );
  persistDatabase();

  res.json({
    id,
    closeDate: now,
    closedBy: user.userId,
    closedByName: user.name,
    realAmounts,
    discrepancies,
    status: 'closed',
  });
});

export default router;
