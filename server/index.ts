import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Routes
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import productsRoutes from './routes/products.routes';
import clientsRoutes from './routes/clients.routes';
import paymentMethodsRoutes from './routes/payment-methods.routes';
import salesRoutes from './routes/sales.routes';
import cashSessionsRoutes from './routes/cash-sessions.routes';
import configRoutes from './routes/config.routes';
import auditRoutes from './routes/audit.routes';

const PORT = parseInt(process.env.PORT || '3001');

async function main() {
  // Initialize database
  await initDatabase();
  console.log('✓ Base de datos SQLite inicializada');

  const app = express();

  // Middleware
  app.use(cors({
    origin: true, // Allow all origins in local network
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/clients', clientsRoutes);
  app.use('/api/payment-methods', paymentMethodsRoutes);
  app.use('/api/sales', salesRoutes);
  app.use('/api/cash-sessions', cashSessionsRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/audit-logs', auditRoutes);

  // Serve static frontend in production
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('/{*splat}', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });

  // Start server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Servidor Tervo POS corriendo en:`);
    console.log(`   → Local:    http://localhost:${PORT}`);
    console.log(`   → Red:      http://0.0.0.0:${PORT}`);
    console.log(`\n   Las terminales de venta pueden conectarse usando la IP local de este computador.`);
    console.log(`   Ejemplo: http://192.168.1.100:${PORT}\n`);
  });
}

main().catch(err => {
  console.error('Error fatal al iniciar el servidor:', err);
  process.exit(1);
});
