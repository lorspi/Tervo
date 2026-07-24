import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware, updateHeartbeat } from '../auth';
import { getDb } from '../database';

const router = Router();

// GET /api/terminals/status - Get all active terminals with their cash session + sales stats
router.get('/status', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const user = (req as any).user;

  // Update heartbeat for the requesting admin so their session stays alive
  updateHeartbeat(user.userId, user.terminalId);

  // Get all active sessions (logged-in users)
  const sessionsResult = db.exec(
    `SELECT as2.user_id, as2.terminal_id, as2.login_time, as2.last_heartbeat, u.name, u.username, u.role
     FROM active_sessions as2
     JOIN users u ON u.id = as2.user_id
     ORDER BY as2.login_time DESC`
  );

  if (sessionsResult.length === 0 || sessionsResult[0].values.length === 0) {
    res.json([]);
    return;
  }

  const terminals = sessionsResult[0].values.map(row => {
    const userId = row[0] as string;
    const terminalId = row[1] as string;
    const loginTime = row[2] as string;
    const lastHeartbeat = row[3] as string;
    const userName = row[4] as string;
    const username = row[5] as string;
    const role = row[6] as string;

    // Get open cash session for this terminal
    const cashResult = db.exec(
      `SELECT id, open_date, initial_cash, expected_amounts, status
       FROM cash_sessions WHERE terminal_id = ? AND status = 'open' LIMIT 1`,
      [terminalId]
    );

    let cashSession: any = null;
    let salesStats: any = null;

    if (cashResult.length > 0 && cashResult[0].values.length > 0) {
      const cs = cashResult[0].values[0];
      const sessionId = cs[0] as string;
      cashSession = {
        id: sessionId,
        openDate: cs[1],
        initialCash: cs[2],
        expectedAmounts: JSON.parse(cs[3] as string),
        status: cs[4],
      };

      // Get sales stats for this cash session
      const salesResult = db.exec(
        `SELECT COUNT(*) as count, COALESCE(SUM(total_payable), 0) as total, COALESCE(SUM(subtotal), 0) as subtotal
         FROM sales WHERE cash_session_id = ?`,
        [sessionId]
      );

      if (salesResult.length > 0 && salesResult[0].values.length > 0) {
        const sr = salesResult[0].values[0];
        salesStats = {
          salesCount: sr[0] as number,
          totalCollected: sr[1] as number,
          subtotal: sr[2] as number,
        };
      }
    } else {
      // No open session - try to get the last closed one for this terminal
      const lastCashResult = db.exec(
        `SELECT id, open_date, close_date, initial_cash, expected_amounts, status
         FROM cash_sessions WHERE terminal_id = ? ORDER BY open_date DESC LIMIT 1`,
        [terminalId]
      );

      if (lastCashResult.length > 0 && lastCashResult[0].values.length > 0) {
        const cs = lastCashResult[0].values[0];
        const sessionId = cs[0] as string;
        cashSession = {
          id: sessionId,
          openDate: cs[1],
          closeDate: cs[2],
          initialCash: cs[3],
          expectedAmounts: JSON.parse(cs[4] as string),
          status: cs[5],
        };

        const salesResult = db.exec(
          `SELECT COUNT(*) as count, COALESCE(SUM(total_payable), 0) as total, COALESCE(SUM(subtotal), 0) as subtotal
           FROM sales WHERE cash_session_id = ?`,
          [sessionId]
        );

        if (salesResult.length > 0 && salesResult[0].values.length > 0) {
          const sr = salesResult[0].values[0];
          salesStats = {
            salesCount: sr[0] as number,
            totalCollected: sr[1] as number,
            subtotal: sr[2] as number,
          };
        }
      }
    }

    return {
      userId,
      terminalId,
      loginTime,
      lastHeartbeat,
      userName,
      username,
      role,
      cashSession,
      salesStats,
    };
  });

  res.json(terminals);
});

export default router;
