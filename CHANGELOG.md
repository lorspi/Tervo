# Changelog

## [0.1.1] — 2026-07-26

### Changed

- **Sidebar: "Dashboard" renombrado a "Inicio"**
  El primer item del menú lateral ahora dice "Inicio" en lugar de "Dashboard".

- **Modales cerrables con clic en overlay y tecla ESC**
  Todos los modales del sistema ahora se pueden cerrar haciendo clic fuera o presionando Escape, siempre que no se hayan modificado campos del formulario.

- **Protección contra cierre accidental en modales con cambios**
  Si el usuario ha modificado campos dentro de un modal, el clic en el overlay y ESC quedan bloqueados. El modal vibra visualmente para indicar que hay cambios sin guardar. Solo es posible cerrar mediante los botones X o Cancelar, que descartan los cambios explícitamente.

## [0.1.0] — 2026-07-26

### Added

- **Arquitectura cliente-servidor con SQLite centralizado**
  Migración completa del sistema de archivos local (File System Access API) a un backend Express con base de datos SQLite (sql.js). Un solo servidor centraliza los datos de la tienda y las terminales se conectan por red local.

- **Autenticación JWT con sesiones exclusivas por terminal**
  Login con token JWT, heartbeat para detectar desconexiones y validación de sesión exclusiva: un usuario no puede estar logueado en dos terminales simultáneamente.

- **Apertura y cierre de caja independiente por terminal**
  Cada terminal abre y cierra su propia caja. El servidor registra el estado de cada una y las estadísticas se sincronizan en tiempo real.

- **Dashboard admin con terminales conectadas**
  El administrador puede ver en tiempo real qué vendedores están conectados, el estado de su caja (abierta/cerrada) y las estadísticas de ventas de su caja actual o última.

- **Selector de cliente con búsqueda y creación inline**
  El campo de cliente en la venta es opcional. Al escribir, muestra resultados filtrados con opción de crear un nuevo cliente sin salir del modal de venta.

- **Script de release para distribución sin código fuente**
  Comando `npm run release` que genera una carpeta distribuible con el servidor compilado (esbuild), el frontend minificado, y un `iniciar.bat` para Windows.

- **Detección de IP local real al iniciar el servidor**
  El servidor detecta y muestra la IP de la interfaz de red correcta (priorizando 192.168.x.x sobre interfaces virtuales) para que los vendedores sepan a qué URL conectarse.

- **Transacciones atómicas y persist debounced**
  Las operaciones multi-tabla (como registrar una venta) se ejecutan dentro de transacciones SQLite. La escritura a disco usa debounce y escritura atómica (tmp + rename) para evitar corrupción.

- **Atajo de teclado F2 para nueva venta**
  Acceso rápido al modal de venta desde cualquier vista.

- **Título dinámico de pestaña**
  El título del navegador muestra "Nombre de la tienda — Tervo" actualizándose automáticamente al cambiar la configuración.

### Changed

- **Comisiones de métodos de pago son costos internos**
  Las comisiones y cargos fijos ya no se cobran al cliente. Se registran solo para fines contables como gasto de la tienda.

- **Modales con Portal para cobertura completa**
  Todos los modales ahora se renderizan vía `createPortal` al body del documento, evitando que el overflow del layout los corte.

- **Eliminada la emisión automática de boleta**
  Al registrar una venta ya no se genera PDF ni se abre ventana de impresión. El botón solo dice "Emitir Venta".

- **Eliminado el cliente genérico predeterminado**
  Ya no existe "Cliente General" como registro obligatorio. Las ventas sin cliente simplemente no tienen uno asociado.
