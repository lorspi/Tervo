/**
 * Script para generar un paquete distribuible del servidor Tervo POS.
 * 
 * Uso: node scripts/package-release.js
 * 
 * Genera una carpeta `release/` con todo lo necesario para ejecutar
 * el sistema sin código fuente TypeScript.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const RELEASE = path.join(ROOT, 'release');

console.log('🔨 Construyendo Tervo POS para distribución...\n');

// 1. Build frontend
console.log('1/4 Compilando frontend...');
execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });

// 2. Build server
console.log('\n2/4 Compilando servidor...');
execSync('npm run build:server', { cwd: ROOT, stdio: 'inherit' });

// 3. Create release folder
console.log('\n3/4 Creando paquete de distribución...');
if (fs.existsSync(RELEASE)) {
  fs.rmSync(RELEASE, { recursive: true });
}
fs.mkdirSync(RELEASE, { recursive: true });

// Copy dist (frontend)
fs.cpSync(path.join(ROOT, 'dist'), path.join(RELEASE, 'dist'), { recursive: true });

// Copy server bundle
fs.mkdirSync(path.join(RELEASE, 'dist-server'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'dist-server', 'index.mjs'), path.join(RELEASE, 'dist-server', 'index.mjs'));

// Copy public assets
fs.cpSync(path.join(ROOT, 'public'), path.join(RELEASE, 'public'), { recursive: true });

// Create minimal package.json for production
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  type: 'module',
  scripts: {
    start: 'node dist-server/index.mjs',
  },
  dependencies: {
    'sql.js': pkg.dependencies['sql.js'],
    'express': pkg.dependencies['express'],
    'cors': pkg.dependencies['cors'],
    'jsonwebtoken': pkg.dependencies['jsonwebtoken'],
    'uuid': pkg.dependencies['uuid'],
  },
};
fs.writeFileSync(path.join(RELEASE, 'package.json'), JSON.stringify(prodPkg, null, 2));

// Create start script for Windows
fs.writeFileSync(path.join(RELEASE, 'iniciar.bat'), `@echo off
title Tervo POS - Servidor
echo ====================================
echo   TERVO POS - Servidor Local
echo ====================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js no esta instalado.
    echo Descargalo en: https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo Instalando dependencias por primera vez...
    call npm install --production
    echo.
)

echo Iniciando servidor...
echo.
echo Presiona Ctrl+C para detener el servidor.
echo.
node dist-server/index.mjs
echo.
echo El servidor se detuvo.
pause
`);

// Create README
fs.writeFileSync(path.join(RELEASE, 'LEEME.txt'), `TERVO POS - Sistema Punto de Venta
====================================

REQUISITOS:
- Node.js v18 o superior (https://nodejs.org)

INSTALACIÓN:
1. Abrir una terminal/CMD en esta carpeta
2. Ejecutar: npm install --production
3. Ejecutar: npm start

O simplemente hacer doble clic en "iniciar.bat" (Windows).

ACCESO:
- Desde este computador: http://localhost:3001
- Desde otras máquinas en la red: http://<IP-DE-ESTE-PC>:3001

CREDENCIALES POR DEFECTO:
- Admin: usuario "admin", contraseña "123"
- Vendedor: usuario "vendedor", contraseña "123"

DATOS:
- La base de datos se crea automáticamente en la carpeta "data/"
- Para respaldar, copiar el archivo "data/tervo.db"
`);

// 4. Done
console.log(`\n✅ Paquete generado en: ${RELEASE}`);
console.log('\nContenido:');
const files = fs.readdirSync(RELEASE);
files.forEach(f => {
  const stat = fs.statSync(path.join(RELEASE, f));
  console.log(`  ${stat.isDirectory() ? '📁' : '📄'} ${f}`);
});
console.log('\nPara ejecutar: cd release && npm install --production && npm start');
