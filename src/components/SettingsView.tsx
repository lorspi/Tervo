import React, { useState, useRef } from 'react';
import { SystemState } from '../types';
import { 
  Check, Save, Database, ShieldAlert, ShoppingBag, Eye, RefreshCw, 
  Settings, AlertCircle, FileSpreadsheet, Download, Upload 
} from 'lucide-react';
import { addAuditLog, saveState } from '../utils/db';

interface SettingsViewProps {
  state: SystemState;
  onUpdateState: (newState: SystemState) => void;
  userRole: string;
}

export default function SettingsView({ state, onUpdateState, userRole }: SettingsViewProps) {
  // Input states
  const [formLowStock, setFormLowStock] = useState<number>(state.config.lowStockAlert);
  const [formStoreName, setFormStoreName] = useState(state.config.storeName);
  const [formStoreInfo, setFormStoreInfo] = useState(state.config.storeInfo);
  const [formSystemEnabled, setFormSystemEnabled] = useState(state.config.systemEnabled);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Save Configurations
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();

    let updatedConfig = {
      ...state.config,
      lowStockAlert: formLowStock,
      storeName: formStoreName,
      storeInfo: formStoreInfo,
      systemEnabled: formSystemEnabled
    };

    let newState: SystemState = {
      ...state,
      config: updatedConfig
    };

    newState = addAuditLog(
      newState, 
      'config', 
      `Configuraciones del sistema actualizadas por ${state.currentUser?.name}. Stock mínimo: ${formLowStock}, Nombre de tienda: "${formStoreName}", Sistema Activo: ${formSystemEnabled ? 'Sí' : 'No'}`
    );

    onUpdateState(newState);
    alert("Configuración del sistema guardada con éxito.");
  };

  // Generate and download full JSON backup
  const handleExportBackup = () => {
    const backupData = JSON.stringify(state, null, 2);
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_pos_sistema_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import JSON backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("⚠️ ¡ADVERTENCIA! Al restaurar este respaldo, se sobrescribirá toda la base de datos actual (inventario, ventas, cajas, clientes y usuarios). ¿Estás seguro de continuar?")) {
      // Clear input so user can choose again
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Simple schema validation
        if (
          parsed &&
          Array.isArray(parsed.products) &&
          Array.isArray(parsed.users) &&
          Array.isArray(parsed.clients) &&
          Array.isArray(parsed.paymentMethods) &&
          Array.isArray(parsed.sales) &&
          Array.isArray(parsed.cashSessions) &&
          parsed.config
        ) {
          // Success! Keep the current logged in user to avoid sudden logout
          const restoredState: SystemState = {
            ...parsed,
            currentUser: state.currentUser // preserve active session user
          };

          saveState(restoredState);
          onUpdateState(restoredState);
          alert("✅ Respaldo del sistema restaurado con éxito. El sistema ha actualizado todos los registros.");
          window.location.reload(); // reload to clear cached memories/logs cleanly
        } else {
          alert("❌ El archivo cargado no posee el formato de respaldo de base de datos válido para este sistema.");
        }
      } catch (err) {
        alert("❌ Error al leer o deserializar el archivo de respaldo. Asegúrese de cargar un archivo JSON válido.");
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Configuración del POS</h1>
        <p className="text-sm text-muted-foreground">Ajusta los parámetros generales, la boleta de venta y la seguridad de tus datos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CONFIG FORM */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border bg-secondary/50">
            <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Parámetros Generales de Operación
            </h2>
          </div>

          <form onSubmit={handleSaveConfig} className="p-6 space-y-6 text-sm text-muted-foreground">
            {/* Low stock selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Mínimo de Alerta de Stock Bajo (Unidades)</label>
              <input
                type="number"
                min="1"
                required
                value={formLowStock}
                onChange={(e) => setFormLowStock(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full sm:max-w-[120px] px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring font-mono text-foreground font-bold"
              />
              <p className="text-[11px] text-muted-foreground">Los productos que tengan existencias inferiores o iguales a este número aparecerán listados como Stock Crítico en el panel principal.</p>
            </div>

            {/* Store details for PDF Ticket */}
            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="font-bold text-foreground text-xs uppercase tracking-wider">Identidad de la Tienda (Encabezado de Recibo PDF)</h3>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Nombre Comercial de la Tienda *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Almacén Express"
                  value={formStoreName}
                  onChange={(e) => setFormStoreName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring text-foreground font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Información / Parágrafo Descriptivo (Sub-Encabezado) *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Av. Providencia #1542, Providencia&#10;Teléfono: +56 9 8765 4321 - contacto@almacen.cl&#10;¡Gracias por preferir nuestro comercio local!"
                  value={formStoreInfo}
                  onChange={(e) => setFormStoreInfo(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring text-foreground font-mono text-xs whitespace-pre"
                />
                <p className="text-[11px] text-muted-foreground">Este párrafo con dirección, datos fiscales o de agradecimiento se renderizará en la parte superior e inferior de la boleta de venta PDF.</p>
              </div>
            </div>

            {/* SYSTEM TOGGLE - ONLY FOR SUPER ADMIN */}
            {userRole === 'super-admin' && (
              <div className="border-t border-border pt-5 space-y-3">
                <h3 className="font-bold text-red-700 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" />
                  Control de Estado del Sistema (Super Admin Only)
                </h3>
                
                <div className="bg-destructive/10/40 border border-red-100 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">Inhabilitar / Habilitar Operación General</p>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      Si inhabilitas el sistema, los vendedores y administradores normales no podrán acceder al POS, bloquearás la realización de ventas y se les mostrará un mensaje de mantención.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold ${formSystemEnabled ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formSystemEnabled ? 'HABILITADO' : 'DESHABILITADO'}
                    </span>
                    <input
                      type="checkbox"
                      checked={formSystemEnabled}
                      onChange={(e) => setFormSystemEnabled(e.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 text-destructive focus:ring-red-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-border pt-4 flex items-center justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                Guardar Configuración
              </button>
            </div>
          </form>
        </div>

        {/* BACKUP & RESTORE UTILITIES */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs h-fit space-y-6">
          
          {/* BACKUP PANEL */}
          <div className="p-5 space-y-4">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              Respaldo de Base de Datos
            </h3>
            <p className="text-xs text-muted-foreground leading-normal">
              Como el sistema opera de forma local, es altamente recomendado exportar periódicamente una copia de seguridad para evitar pérdida de datos si el navegador se borra o se limpia la caché.
            </p>

            <button
              onClick={handleExportBackup}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-border hover:bg-secondary rounded-xl text-xs font-semibold text-foreground transition-colors bg-card cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Descargar Backup JSON
            </button>
          </div>

          {/* RESTORE PANEL */}
          <div className="p-5 border-t border-border bg-secondary/50 space-y-4">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              Restaurar Base de Datos
            </h3>
            <p className="text-xs text-muted-foreground leading-normal">
              Carga una copia de seguridad guardada anteriormente en formato JSON para restaurar todos tus productos, clientes, transacciones y usuarios al momento del respaldo.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportBackup}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              Cargar Archivo de Respaldo
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
