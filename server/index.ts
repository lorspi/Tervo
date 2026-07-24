import express from 'express';
import cors from 'cors';
import path from 'path';
import os from 'os';
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
import terminalsRoutes from './routes/terminals.routes';

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
  app.use('/api/terminals', terminalsRoutes);

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
    const localIp = getLocalIp();
    console.log(`\n🚀 Servidor Tervo POS corriendo en:`);
    console.log(`   → Local:    http://localhost:${PORT}`);
    console.log(`   → Red:      http://${localIp}:${PORT}`);
    console.log(`\n   Las terminales de venta pueden conectarse usando:`);
    console.log(`   http://${localIp}:${PORT}\n`);
  });
}

main().catch(err => {
  console.error('Error fatal al iniciar el servidor:', err);
  process.exit(1);
});

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  const candidates: { address: string; name: string; priority: number }[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family !== 'IPv4' || iface.internal) continue;

      let priority = 0;
      const addr = iface.address;

      // Prioritize common LAN ranges
      if (addr.startsWith('192.168.')) priority = 100;
      else if (addr.startsWith('172.') && parseInt(addr.split('.')[1]) >= 16 && parseInt(addr.split('.')[1]) <= 31) priority = 80;
      else if (addr.startsWith('10.')) priority = 50;
      else priority = 10;

      // Boost real adapter names (Wi-Fi, Ethernet, eth, wlan)
      const lowerName = name.toLowerCase();
      if (lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('wlan')) priority += 20;
      if (lowerName.includes('ethernet') || lowerName.includes('eth')) priority += 15;

      // Penalize virtual/docker/vEthernet adapters
      if (lowerName.includes('vethernet') || lowerName.includes('docker') || lowerName.includes('vbox') || lowerName.includes('vmware') || lowerName.includes('wsl') || lowerName.includes('hyper-v')) priority -= 60;

      candidates.push({ address: addr, name, priority });
    }
  }

  // Sort by priority descending
  candidates.sort((a, b) => b.priority - a.priority);

  // Print all found for visibility
  if (candidates.length > 1) {
    console.log(`   Interfaces de red detectadas:`);
    candidates.forEach(c => {
      console.log(`     • ${c.address} (${c.name})`);
    });
  }

  return candidates.length > 0 ? candidates[0].address : '127.0.0.1';
}
