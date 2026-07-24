import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { getDb, persistDatabase } from './database';

const JWT_SECRET = process.env.JWT_SECRET || 'tervo-pos-secret-key-change-in-production';
const TOKEN_EXPIRY = '12h';
const HEARTBEAT_TIMEOUT_MS = 120000; // 2 minutes without heartbeat = session expired

export interface AuthPayload {
  userId: string;
  username: string;
  name: string;
  role: string;
  terminalId: string;
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

// Middleware to verify authentication
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autorizado. Token no proporcionado.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Token inválido o expirado.' });
    return;
  }

  (req as any).user = payload;
  next();
}

// Middleware to verify admin role
export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as AuthPayload;
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
    return;
  }
  next();
}

// Login logic with exclusive session check
export function loginUser(username: string, password: string, terminalId: string): { token?: string; error?: string; user?: any } {
  const db = getDb();

  const result = db.exec(
    `SELECT id, username, name, role, password, active FROM users WHERE LOWER(username) = LOWER(?)`,
    [username.trim()]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return { error: 'Usuario o contraseña incorrectos.' };
  }

  const row = result[0].values[0];
  const user = {
    id: row[0] as string,
    username: row[1] as string,
    name: row[2] as string,
    role: row[3] as string,
    password: row[4] as string,
    active: row[5] as number,
  };

  if (user.password !== password) {
    return { error: 'Usuario o contraseña incorrectos.' };
  }

  if (!user.active) {
    return { error: 'Esta cuenta ha sido desactivada.' };
  }

  // Check exclusive session - clean stale sessions first
  cleanStaleSessions();

  const activeSessionResult = db.exec(
    `SELECT terminal_id FROM active_sessions WHERE user_id = ?`,
    [user.id]
  );

  if (activeSessionResult.length > 0 && activeSessionResult[0].values.length > 0) {
    const existingTerminal = activeSessionResult[0].values[0][0] as string;
    if (existingTerminal !== terminalId) {
      return { error: `Este usuario ya tiene una sesión activa en otra terminal (${existingTerminal}). Cierra sesión allí primero.` };
    }
  }

  // Register/update active session
  db.run(
    `INSERT OR REPLACE INTO active_sessions (user_id, terminal_id, login_time, last_heartbeat) VALUES (?, ?, ?, ?)`,
    [user.id, terminalId, new Date().toISOString(), new Date().toISOString()]
  );
  persistDatabase();

  const payload: AuthPayload = {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    terminalId,
  };

  const token = generateToken(payload);

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      active: !!user.active,
    },
  };
}

export function logoutUser(userId: string): void {
  const db = getDb();
  db.run(`DELETE FROM active_sessions WHERE user_id = ?`, [userId]);
  persistDatabase();
}

export function updateHeartbeat(userId: string, terminalId: string): void {
  const db = getDb();
  db.run(
    `UPDATE active_sessions SET last_heartbeat = ? WHERE user_id = ? AND terminal_id = ?`,
    [new Date().toISOString(), userId, terminalId]
  );
  persistDatabase();
}

function cleanStaleSessions(): void {
  const db = getDb();
  const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS).toISOString();
  db.run(`DELETE FROM active_sessions WHERE last_heartbeat < ?`, [cutoff]);
}

export function getActiveSessions(): Array<{ userId: string; terminalId: string; loginTime: string }> {
  const db = getDb();
  cleanStaleSessions();
  const result = db.exec(`SELECT user_id, terminal_id, login_time FROM active_sessions`);
  if (result.length === 0) return [];
  return result[0].values.map(row => ({
    userId: row[0] as string,
    terminalId: row[1] as string,
    loginTime: row[2] as string,
  }));
}
