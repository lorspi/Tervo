import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware } from '../auth';
import { getDb, persistDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/users
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const result = db.exec(`SELECT id, username, name, role, password, active FROM users ORDER BY name`);
  if (result.length === 0) {
    res.json([]);
    return;
  }
  const users = result[0].values.map(row => ({
    id: row[0],
    username: row[1],
    name: row[2],
    role: row[3],
    password: row[4],
    active: !!row[5],
  }));
  res.json(users);
});

// POST /api/users
router.post('/', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const { name, username, password, role, active } = req.body;
  if (!name || !username || !password) {
    res.status(400).json({ error: 'Nombre, usuario y contraseña son requeridos.' });
    return;
  }

  const db = getDb();

  // Check duplicate username
  const existing = db.exec(`SELECT id FROM users WHERE LOWER(username) = LOWER(?)`, [username]);
  if (existing.length > 0 && existing[0].values.length > 0) {
    res.status(409).json({ error: `El nombre de usuario "${username}" ya está en uso.` });
    return;
  }

  const id = 'u_' + uuidv4().split('-')[0];
  db.run(
    `INSERT INTO users (id, username, name, role, password, active) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, username, name, role || 'vendedor', password, active !== false ? 1 : 0]
  );
  persistDatabase();

  res.status(201).json({ id, username, name, role: role || 'vendedor', password, active: active !== false });
});

// PUT /api/users/:id
router.put('/:id', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, username, password, role, active } = req.body;

  const db = getDb();

  // Check duplicate username (excluding current user)
  if (username) {
    const existing = db.exec(`SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?`, [username, id]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      res.status(409).json({ error: `El nombre de usuario "${username}" ya está en uso.` });
      return;
    }
  }

  db.run(
    `UPDATE users SET name = ?, username = ?, password = ?, role = ?, active = ? WHERE id = ?`,
    [name, username, password, role || 'vendedor', active ? 1 : 0, id]
  );
  persistDatabase();

  res.json({ id, username, name, role, password, active });
});

// DELETE /api/users/:id
router.delete('/:id', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  if (id === user.userId) {
    res.status(400).json({ error: 'No puedes eliminar tu propio usuario activo.' });
    return;
  }

  const db = getDb();
  db.run(`DELETE FROM users WHERE id = ?`, [id]);
  db.run(`DELETE FROM active_sessions WHERE user_id = ?`, [id]);
  persistDatabase();

  res.json({ message: 'Usuario eliminado.' });
});

export default router;
