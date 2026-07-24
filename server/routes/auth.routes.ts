import { Router, Request, Response } from 'express';
import { loginUser, logoutUser, updateHeartbeat, getActiveSessions, authMiddleware } from '../auth';

const router = Router();

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { username, password, terminalId } = req.body;

  if (!username || !password || !terminalId) {
    res.status(400).json({ error: 'Se requiere usuario, contraseña y terminal ID.' });
    return;
  }

  const result = loginUser(username, password, terminalId);
  if (result.error) {
    res.status(401).json({ error: result.error });
    return;
  }

  res.json({ token: result.token, user: result.user });
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  logoutUser(user.userId);
  res.json({ message: 'Sesión cerrada exitosamente.' });
});

// POST /api/auth/heartbeat
router.post('/heartbeat', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  updateHeartbeat(user.userId, user.terminalId);
  res.json({ ok: true });
});

// GET /api/auth/sessions (admin only - view all active sessions)
router.get('/sessions', authMiddleware, (req: Request, res: Response) => {
  const sessions = getActiveSessions();
  res.json(sessions);
});

// GET /api/auth/me - verify current token
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({
    id: user.userId,
    username: user.username,
    name: user.name,
    role: user.role,
    terminalId: user.terminalId,
  });
});

export default router;
