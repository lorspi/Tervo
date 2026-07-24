import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth';
import { getDb, persistDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/audit-logs
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const { limit } = req.query;
  const queryLimit = parseInt(limit as string) || 200;

  const result = db.exec(
    `SELECT id, date, user_id, username, action_type, details FROM audit_logs ORDER BY date DESC LIMIT ?`,
    [queryLimit]
  );

  if (result.length === 0) {
    res.json([]);
    return;
  }

  const logs = result[0].values.map(row => ({
    id: row[0],
    date: row[1],
    userId: row[2],
    username: row[3],
    actionType: row[4],
    details: row[5],
  }));

  res.json(logs);
});

// POST /api/audit-logs
router.post('/', authMiddleware, (req: Request, res: Response) => {
  const { actionType, details } = req.body;
  const user = (req as any).user;
  const db = getDb();

  const id = 'log_' + uuidv4().split('-')[0];
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO audit_logs (id, date, user_id, username, action_type, details) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, now, user.userId, user.username, actionType, details]
  );
  persistDatabase();

  res.status(201).json({ id, date: now, userId: user.userId, username: user.username, actionType, details });
});

export default router;
