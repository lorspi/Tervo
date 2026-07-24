import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth';
import { getDb, persistDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/sales
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const { sessionId } = req.query;

  let salesQuery = `SELECT id, code, date, client_id, client_name, subtotal, total_commissions, total_fees, total_payable, cashier_id, cashier_name, cash_session_id, terminal_id FROM sales ORDER BY date DESC`;
  let params: any[] = [];

  if (sessionId) {
    salesQuery = `SELECT id, code, date, client_id, client_name, subtotal, total_commissions, total_fees, total_payable, cashier_id, cashier_name, cash_session_id, terminal_id FROM sales WHERE cash_session_id = ? ORDER BY date DESC`;
    params = [sessionId];
  }

  const salesResult = db.exec(salesQuery, params);
  if (salesResult.length === 0) {
    res.json([]);
    return;
  }

  const sales = salesResult[0].values.map(row => {
    const saleId = row[0] as string;

    // Get items for this sale
    const itemsResult = db.exec(
      `SELECT product_id, name, price, cost, quantity, subtotal FROM sale_items WHERE sale_id = ?`,
      [saleId]
    );
    const items = itemsResult.length > 0 ? itemsResult[0].values.map(ir => ({
      productId: ir[0],
      name: ir[1],
      price: ir[2],
      cost: ir[3],
      quantity: ir[4],
      subtotal: ir[5],
    })) : [];

    // Get payments for this sale
    const paymentsResult = db.exec(
      `SELECT method_id, method_name, amount FROM sale_payments WHERE sale_id = ?`,
      [saleId]
    );
    const payments = paymentsResult.length > 0 ? paymentsResult[0].values.map(pr => ({
      methodId: pr[0],
      methodName: pr[1],
      amount: pr[2],
    })) : [];

    return {
      id: row[0],
      code: row[1],
      date: row[2],
      clientId: row[3] || undefined,
      clientName: row[4],
      subtotal: row[5],
      totalCommissions: row[6],
      totalFees: row[7],
      totalPayable: row[8],
      cashierId: row[9],
      cashierName: row[10],
      cashSessionId: row[11],
      terminalId: row[12],
      items,
      payments,
    };
  });

  res.json(sales);
});

// POST /api/sales
router.post('/', authMiddleware, (req: Request, res: Response) => {
  const {
    clientId, clientName, items, subtotal, totalCommissions, totalFees,
    totalPayable, payments, cashSessionId
  } = req.body;

  if (!items || items.length === 0) {
    res.status(400).json({ error: 'La venta debe tener al menos un producto.' });
    return;
  }

  if (!cashSessionId) {
    res.status(400).json({ error: 'No hay una sesión de caja activa.' });
    return;
  }

  const user = (req as any).user;
  const db = getDb();

  // Generate sale code
  const countResult = db.exec(`SELECT COUNT(*) FROM sales`);
  const count = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0;
  const code = 'V-' + String(count + 1).padStart(4, '0');

  const saleId = 'sale_' + uuidv4().split('-')[0];
  const now = new Date().toISOString();

  // Insert sale
  db.run(
    `INSERT INTO sales (id, code, date, client_id, client_name, subtotal, total_commissions, total_fees, total_payable, cashier_id, cashier_name, cash_session_id, terminal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [saleId, code, now, clientId || null, clientName || 'Cliente General', subtotal, totalCommissions, totalFees, totalPayable, user.userId, user.name, cashSessionId, user.terminalId]
  );

  // Insert sale items and deduct stock
  for (const item of items) {
    db.run(
      `INSERT INTO sale_items (sale_id, product_id, name, price, cost, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [saleId, item.productId, item.name, item.price, item.cost, item.quantity, item.subtotal]
    );

    // Deduct stock
    db.run(
      `UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?`,
      [item.quantity, item.productId]
    );
  }

  // Insert payments
  for (const payment of payments) {
    db.run(
      `INSERT INTO sale_payments (sale_id, method_id, method_name, amount) VALUES (?, ?, ?, ?)`,
      [saleId, payment.methodId, payment.methodName, payment.amount]
    );
  }

  // Update cash session expected amounts
  const sessionResult = db.exec(`SELECT expected_amounts FROM cash_sessions WHERE id = ?`, [cashSessionId]);
  if (sessionResult.length > 0 && sessionResult[0].values.length > 0) {
    const expectedAmounts = JSON.parse(sessionResult[0].values[0][0] as string);
    for (const payment of payments) {
      expectedAmounts[payment.methodId] = (expectedAmounts[payment.methodId] || 0) + payment.amount;
    }
    db.run(`UPDATE cash_sessions SET expected_amounts = ? WHERE id = ?`, [JSON.stringify(expectedAmounts), cashSessionId]);
  }

  persistDatabase();

  res.status(201).json({
    id: saleId,
    code,
    date: now,
    clientId,
    clientName: clientName || 'Cliente General',
    items,
    subtotal,
    totalCommissions,
    totalFees,
    totalPayable,
    payments,
    cashierId: user.userId,
    cashierName: user.name,
    cashSessionId,
    terminalId: user.terminalId,
  });
});

// PUT /api/sales/:id - Edit a sale
router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const { clientId, clientName, items, subtotal, totalCommissions, totalFees, totalPayable, payments } = req.body;

  const db = getDb();

  // Get old sale data to restore stock
  const oldItemsResult = db.exec(`SELECT product_id, quantity FROM sale_items WHERE sale_id = ?`, [id]);
  if (oldItemsResult.length > 0) {
    for (const row of oldItemsResult[0].values) {
      // Restore old stock
      db.run(`UPDATE products SET stock = stock + ? WHERE id = ?`, [row[1], row[0]]);
    }
  }

  // Get old payments to adjust cash session
  const saleResult = db.exec(`SELECT cash_session_id FROM sales WHERE id = ?`, [id]);
  const cashSessionId = saleResult.length > 0 ? saleResult[0].values[0][0] as string : null;

  const oldPaymentsResult = db.exec(`SELECT method_id, amount FROM sale_payments WHERE sale_id = ?`, [id]);

  // Remove old cash session amounts
  if (cashSessionId) {
    const sessResult = db.exec(`SELECT expected_amounts FROM cash_sessions WHERE id = ?`, [cashSessionId]);
    if (sessResult.length > 0 && sessResult[0].values.length > 0) {
      const expectedAmounts = JSON.parse(sessResult[0].values[0][0] as string);
      if (oldPaymentsResult.length > 0) {
        for (const row of oldPaymentsResult[0].values) {
          expectedAmounts[row[0] as string] = (expectedAmounts[row[0] as string] || 0) - (row[1] as number);
        }
      }
      // Add new amounts
      for (const payment of payments) {
        expectedAmounts[payment.methodId] = (expectedAmounts[payment.methodId] || 0) + payment.amount;
      }
      db.run(`UPDATE cash_sessions SET expected_amounts = ? WHERE id = ?`, [JSON.stringify(expectedAmounts), cashSessionId]);
    }
  }

  // Delete old items and payments
  db.run(`DELETE FROM sale_items WHERE sale_id = ?`, [id]);
  db.run(`DELETE FROM sale_payments WHERE sale_id = ?`, [id]);

  // Update sale
  db.run(
    `UPDATE sales SET client_id = ?, client_name = ?, subtotal = ?, total_commissions = ?, total_fees = ?, total_payable = ? WHERE id = ?`,
    [clientId || null, clientName || 'Cliente General', subtotal, totalCommissions, totalFees, totalPayable, id]
  );

  // Insert new items and deduct stock
  for (const item of items) {
    db.run(
      `INSERT INTO sale_items (sale_id, product_id, name, price, cost, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, item.productId, item.name, item.price, item.cost, item.quantity, item.subtotal]
    );
    db.run(`UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?`, [item.quantity, item.productId]);
  }

  // Insert new payments
  for (const payment of payments) {
    db.run(
      `INSERT INTO sale_payments (sale_id, method_id, method_name, amount) VALUES (?, ?, ?, ?)`,
      [id, payment.methodId, payment.methodName, payment.amount]
    );
  }

  persistDatabase();
  res.json({ message: 'Venta actualizada.' });
});

export default router;
