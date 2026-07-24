import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware } from '../auth';
import { getDb, persistDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/payment-methods
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const result = db.exec(`SELECT id, name, commission_percent, flat_fee, active FROM payment_methods ORDER BY name`);
  if (result.length === 0) {
    res.json([]);
    return;
  }
  const methods = result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    commissionPercent: row[2],
    flatFee: row[3],
    active: !!row[4],
  }));
  res.json(methods);
});

// POST /api/payment-methods
router.post('/', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const { name, commissionPercent, flatFee, active } = req.body;
  if (!name) {
    res.status(400).json({ error: 'El nombre del método de pago es requerido.' });
    return;
  }

  const db = getDb();
  const id = 'pm_' + uuidv4().split('-')[0];
  db.run(
    `INSERT INTO payment_methods (id, name, commission_percent, flat_fee, active) VALUES (?, ?, ?, ?, ?)`,
    [id, name, commissionPercent || 0, flatFee || 0, active !== false ? 1 : 0]
  );
  persistDatabase();

  res.status(201).json({ id, name, commissionPercent: commissionPercent || 0, flatFee: flatFee || 0, active: active !== false });
});

// PUT /api/payment-methods/:id
router.put('/:id', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, commissionPercent, flatFee, active } = req.body;

  const db = getDb();
  db.run(
    `UPDATE payment_methods SET name = ?, commission_percent = ?, flat_fee = ?, active = ? WHERE id = ?`,
    [name, commissionPercent || 0, flatFee || 0, active ? 1 : 0, id]
  );
  persistDatabase();

  res.json({ id, name, commissionPercent, flatFee, active });
});

// DELETE /api/payment-methods/:id
router.delete('/:id', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  db.run(`DELETE FROM payment_methods WHERE id = ?`, [id]);
  persistDatabase();
  res.json({ message: 'Método de pago eliminado.' });
});

export default router;
