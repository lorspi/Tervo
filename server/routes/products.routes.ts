import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth';
import { getDb, persistDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/products
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const result = db.exec(`SELECT id, name, sku, barcode, category, stock, cost, price FROM products ORDER BY name`);
  if (result.length === 0) {
    res.json([]);
    return;
  }
  const products = result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    sku: row[2] || undefined,
    barcode: row[3],
    category: row[4],
    stock: row[5],
    cost: row[6],
    price: row[7],
  }));
  res.json(products);
});

// POST /api/products
router.post('/', authMiddleware, (req: Request, res: Response) => {
  const { name, sku, barcode, category, stock, cost, price } = req.body;
  if (!name || !barcode || !price) {
    res.status(400).json({ error: 'Nombre, código de barras y precio son requeridos.' });
    return;
  }

  const db = getDb();

  // Check duplicate barcode
  const existing = db.exec(`SELECT id FROM products WHERE barcode = ?`, [barcode]);
  if (existing.length > 0 && existing[0].values.length > 0) {
    res.status(409).json({ error: `Ya existe un producto con el código de barras "${barcode}".` });
    return;
  }

  const id = 'p_' + uuidv4().split('-')[0];
  db.run(
    `INSERT INTO products (id, name, sku, barcode, category, stock, cost, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, sku || null, barcode, category || 'General', stock || 0, cost || 0, price]
  );
  persistDatabase();

  res.status(201).json({ id, name, sku, barcode, category: category || 'General', stock: stock || 0, cost: cost || 0, price });
});

// PUT /api/products/:id
router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, sku, barcode, category, stock, cost, price } = req.body;

  const db = getDb();

  // Check duplicate barcode (excluding current)
  if (barcode) {
    const existing = db.exec(`SELECT id FROM products WHERE barcode = ? AND id != ?`, [barcode, id]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      res.status(409).json({ error: `Ya existe otro producto con el código de barras "${barcode}".` });
      return;
    }
  }

  db.run(
    `UPDATE products SET name = ?, sku = ?, barcode = ?, category = ?, stock = ?, cost = ?, price = ? WHERE id = ?`,
    [name, sku || null, barcode, category || 'General', stock || 0, cost || 0, price || 0, id]
  );
  persistDatabase();

  res.json({ id, name, sku, barcode, category, stock, cost, price });
});

// DELETE /api/products/:id
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  db.run(`DELETE FROM products WHERE id = ?`, [id]);
  persistDatabase();
  res.json({ message: 'Producto eliminado.' });
});

// POST /api/products/bulk - Import CSV batch
router.post('/bulk', authMiddleware, (req: Request, res: Response) => {
  const { products } = req.body;
  if (!Array.isArray(products)) {
    res.status(400).json({ error: 'Se espera un array de productos.' });
    return;
  }

  const db = getDb();
  let imported = 0;
  let updated = 0;

  for (const p of products) {
    if (!p.name || !p.barcode) continue;

    const existing = db.exec(`SELECT id FROM products WHERE barcode = ?`, [p.barcode]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      const existingId = existing[0].values[0][0];
      db.run(
        `UPDATE products SET name = ?, sku = ?, category = ?, stock = ?, cost = ?, price = ? WHERE id = ?`,
        [p.name, p.sku || null, p.category || 'General', p.stock || 0, p.cost || 0, p.price || 0, existingId]
      );
      updated++;
    } else {
      const id = 'p_' + uuidv4().split('-')[0];
      db.run(
        `INSERT INTO products (id, name, sku, barcode, category, stock, cost, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, p.name, p.sku || null, p.barcode, p.category || 'General', p.stock || 0, p.cost || 0, p.price || 0]
      );
      imported++;
    }
  }

  persistDatabase();
  res.json({ imported, updated });
});

export default router;
