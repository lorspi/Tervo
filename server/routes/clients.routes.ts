import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth';
import { getDb, persistDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/clients
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const result = db.exec(`SELECT id, name, document, phone, email, address FROM clients ORDER BY name`);
  if (result.length === 0) {
    res.json([]);
    return;
  }
  const clients = result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    document: row[2] || undefined,
    phone: row[3] || undefined,
    email: row[4] || undefined,
    address: row[5] || undefined,
  }));
  res.json(clients);
});

// POST /api/clients
router.post('/', authMiddleware, (req: Request, res: Response) => {
  const { name, document, phone, email, address } = req.body;
  if (!name) {
    res.status(400).json({ error: 'El nombre del cliente es requerido.' });
    return;
  }

  const db = getDb();
  const id = 'c_' + uuidv4().split('-')[0];
  db.run(
    `INSERT INTO clients (id, name, document, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, document || null, phone || null, email || null, address || null]
  );
  persistDatabase();

  res.status(201).json({ id, name, document, phone, email, address });
});

// PUT /api/clients/:id
router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, document, phone, email, address } = req.body;

  const db = getDb();
  db.run(
    `UPDATE clients SET name = ?, document = ?, phone = ?, email = ?, address = ? WHERE id = ?`,
    [name, document || null, phone || null, email || null, address || null, id]
  );
  persistDatabase();

  res.json({ id, name, document, phone, email, address });
});

// DELETE /api/clients/:id
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  if (id === 'c_generic') {
    res.status(400).json({ error: 'No se puede eliminar el cliente genérico.' });
    return;
  }

  const db = getDb();
  db.run(`DELETE FROM clients WHERE id = ?`, [id]);
  persistDatabase();
  res.json({ message: 'Cliente eliminado.' });
});

export default router;
