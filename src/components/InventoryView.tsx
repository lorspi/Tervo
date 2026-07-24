import React, { useState, useMemo, useRef } from 'react';
import { SystemState, Product } from '../types';
import { 
  Plus, Edit2, Download, Upload, Search, Package, Trash2, Check, AlertCircle, HelpCircle
} from 'lucide-react';
import { addAuditLog } from '../utils/db';

interface InventoryViewProps {
  state: SystemState;
  onUpdateState: (newState: SystemState) => void;
  userRole: string;
}

export default function InventoryView({ state, onUpdateState, userRole }: InventoryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Create / Edit states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  // Form fields
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formStock, setFormStock] = useState<number>(0);
  const [formCost, setFormCost] = useState<number>(0);
  const [formPrice, setFormPrice] = useState<number>(0);

  // CSV file ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract unique categories for filter
  const categories = useMemo(() => {
    const list = state.products.map(p => p.category);
    return Array.from(new Set(list));
  }, [state.products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return state.products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode.includes(searchTerm) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [state.products, searchTerm, categoryFilter]);

  // Open Edit Product Modal
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormSku(p.sku || '');
    setFormBarcode(p.barcode);
    setFormCategory(p.category);
    setFormStock(p.stock);
    setFormCost(p.cost);
    setFormPrice(p.price);
  };

  // Open Create Product Modal
  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormName('');
    setFormSku('');
    setFormBarcode('');
    setFormCategory('');
    setFormStock(0);
    setFormCost(0);
    setFormPrice(0);
    setIsCreateOpen(true);
  };

  // Save / Update Product
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formBarcode || formPrice <= 0) {
      alert("Por favor completa los campos obligatorios: Nombre, Código de Barras y un Precio mayor a 0.");
      return;
    }

    let updatedProducts: Product[] = [];
    let logDetail = '';

    if (editingProduct) {
      // Edit mode
      updatedProducts = state.products.map(p => {
        if (p.id === editingProduct.id) {
          return {
            ...p,
            name: formName,
            sku: formSku || undefined,
            barcode: formBarcode,
            category: formCategory || 'General',
            stock: formStock,
            cost: formCost,
            price: formPrice
          };
        }
        return p;
      });
      logDetail = `Producto "${formName}" (ID: ${editingProduct.id}) actualizado por ${state.currentUser?.name}. Stock: ${formStock}, Costo: ${formCost}, Precio: ${formPrice}`;
    } else {
      // Check duplicate barcode
      const duplicate = state.products.find(p => p.barcode === formBarcode);
      if (duplicate) {
        alert(`Ya existe un producto registrado con el código de barras "${formBarcode}" (${duplicate.name}).`);
        return;
      }

      // Create Mode
      const newProduct: Product = {
        id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        name: formName,
        sku: formSku || undefined,
        barcode: formBarcode,
        category: formCategory || 'General',
        stock: formStock,
        cost: formCost,
        price: formPrice
      };
      updatedProducts = [...state.products, newProduct];
      logDetail = `Nuevo producto "${formName}" agregado por ${state.currentUser?.name}. Código barras: ${formBarcode}, Stock inicial: ${formStock}`;
    }

    let newState: SystemState = {
      ...state,
      products: updatedProducts
    };

    newState = addAuditLog(newState, 'inventory', logDetail);
    onUpdateState(newState);

    setEditingProduct(null);
    setIsCreateOpen(false);
  };

  // Delete product (Optional but handy for layout completeness)
  const handleDeleteProduct = (productId: string, productName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el producto "${productName}" del inventario?`)) {
      return;
    }

    const updatedProducts = state.products.filter(p => p.id !== productId);
    let newState: SystemState = {
      ...state,
      products: updatedProducts
    };

    newState = addAuditLog(newState, 'inventory', `Producto "${productName}" (ID: ${productId}) eliminado del inventario por ${state.currentUser?.name}.`);
    onUpdateState(newState);
  };

  // Export inventory to CSV
  const exportToCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    // Header
    csvContent += 'Nombre,SKU,CodigoBarras,Categoria,Stock,Costo,Precio\r\n';

    state.products.forEach(p => {
      // Escape commas inside name and category
      const name = `"${p.name.replace(/"/g, '""')}"`;
      const cat = `"${p.category.replace(/"/g, '""')}"`;
      csvContent += `${name},${p.sku || ''},${p.barcode},${cat},${p.stock},${p.cost},${p.price}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventario_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download template CSV
  const downloadTemplateCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Nombre,SKU,CodigoBarras,Categoria,Stock,Costo,Precio\r\n';
    csvContent += '"Galletas de Avena Integrales","GAL-AV","7791234567812","Snacks",20,350,700\r\n';
    csvContent += '"Yogurt de Frutilla Soprole","YOG-FRU","7791234567825","Lácteos",15,180,350\r\n';

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'plantilla_inventario.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import inventory from CSV
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      if (lines.length <= 1) {
        alert("El archivo CSV está vacío o no contiene filas válidas.");
        return;
      }

      const updatedProducts = [...state.products];
      let importedCount = 0;
      let updatedCount = 0;

      // Header index: Nombre, SKU, CodigoBarras, Categoria, Stock, Costo, Precio
      // We skip index 0 (header)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV columns allowing quoted strings with commas
        // High-fidelity regex for CSV cell splitting
        const cols = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
        
        if (cols.length < 5) continue; // skip rows with insufficient columns

        const name = cols[0].replace(/^"|"$/g, '').trim();
        const sku = cols[1]?.replace(/^"|"$/g, '').trim() || undefined;
        const barcode = cols[2]?.replace(/^"|"$/g, '').trim();
        const category = cols[3]?.replace(/^"|"$/g, '').trim() || 'General';
        const stock = parseInt(cols[4]?.replace(/^"|"$/g, '')) || 0;
        const cost = parseFloat(cols[5]?.replace(/^"|"$/g, '')) || 0;
        const price = parseFloat(cols[6]?.replace(/^"|"$/g, '')) || 0;

        if (!name || !barcode) continue;

        // Check if barcode already exists. If yes, update it. If not, insert it!
        const existingIdx = updatedProducts.findIndex(p => p.barcode === barcode);
        if (existingIdx !== -1) {
          // Update existing
          updatedProducts[existingIdx] = {
            ...updatedProducts[existingIdx],
            name,
            sku,
            category,
            stock,
            cost,
            price
          };
          updatedCount++;
        } else {
          // Create new product
          updatedProducts.push({
            id: 'p_csv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            name,
            sku,
            barcode,
            category,
            stock,
            cost,
            price
          });
          importedCount++;
        }
      }

      let newState: SystemState = {
        ...state,
        products: updatedProducts
      };

      newState = addAuditLog(
        newState, 
        'inventory', 
        `Importación de inventario CSV por ${state.currentUser?.name}. Agregados: ${importedCount} productos, Actualizados: ${updatedCount} productos.`
      );

      onUpdateState(newState);
      alert(`CSV Procesado con éxito!\n- Productos Nuevos: ${importedCount}\n- Productos Actualizados: ${updatedCount}`);
      
      // Reset input value to allow uploading same file again
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Catálogo de Inventario</h1>
          <p className="text-sm text-muted-foreground">Agrega, edita e importa tus productos de manera masiva.</p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* CSV file import hidden input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleCSVImport}
            accept=".csv"
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-3 py-2 border border-border hover:bg-secondary text-foreground rounded-xl text-xs font-semibold transition-colors bg-card cursor-pointer"
            title="Importar lista de productos desde un archivo CSV"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Importar CSV
          </button>

          <button
            onClick={exportToCSV}
            className="flex items-center px-3 py-2 border border-border hover:bg-secondary text-foreground rounded-xl text-xs font-semibold transition-colors bg-card"
            title="Exportar inventario actual a formato CSV"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exportar CSV
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center px-3 py-2 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Templates / Help segment */}
      <div className="bg-secondary rounded-xl p-4 border border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <HelpCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-foreground">¿Cómo importar productos por CSV?</h4>
            <p className="text-[11px] text-muted-foreground leading-normal">
              Utiliza un archivo separado por comas (.csv) respetando las columnas en orden: Nombre, SKU, Código de barras, Categoría, Stock, Costo, Precio. 
              Si el código de barras ya existe, se actualizará el stock y precios automáticamente.
            </p>
          </div>
        </div>
        <button
          onClick={downloadTemplateCSV}
          className="text-muted-foreground hover:text-foreground border-b border-dashed border-slate-400 hover:border-slate-800 text-xs font-bold shrink-0 self-end sm:self-auto"
        >
          Descargar plantilla CSV
        </button>
      </div>

      {/* Search and Category Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU, código de barra o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 border border-border rounded-xl text-sm bg-card placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full"
          />
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-xl text-sm bg-card text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full sm:w-auto"
        >
          <option value="all">Todas las Categorías</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Products Table Card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-secondary text-muted-foreground text-xs font-semibold uppercase border-b border-border">
                <th className="p-4">Código / SKU</th>
                <th className="p-4">Nombre del Producto</th>
                <th className="p-4">Categoría</th>
                <th className="p-4 text-center">Stock</th>
                <th className="p-4 text-right">Costo Neto</th>
                <th className="p-4 text-right">Precio de Venta</th>
                <th className="p-4 text-right">Margen</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {filteredProducts.map((p) => {
                const marginPercent = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
                const isLowStock = p.stock <= state.config.lowStockAlert;
                
                return (
                  <tr key={p.id} className="hover:bg-secondary/40">
                    <td className="p-4">
                      <div className="space-y-0.5">
                        <p className="font-mono text-xs font-bold text-foreground">{p.barcode}</p>
                        {p.sku && <p className="font-mono text-[10px] text-muted-foreground">SKU: {p.sku}</p>}
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-foreground">{p.name}</td>
                    <td className="p-4">
                      <span className="inline-block px-2 py-0.5 bg-secondary text-muted-foreground text-xs rounded-sm">
                        {p.category}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-sm ${
                        isLowStock ? 'bg-destructive/10 text-red-700 border border-red-100' : 'text-foreground'
                      }`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono font-medium">{formatMoney(p.cost)}</td>
                    <td className="p-4 text-right font-mono font-bold text-foreground">{formatMoney(p.price)}</td>
                    <td className="p-4 text-right">
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs font-semibold text-bento-green">{formatMoney(p.price - p.cost)}</span>
                        <p className="text-[10px] text-muted-foreground">({marginPercent.toFixed(0)}%)</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 hover:bg-secondary text-muted-foreground rounded-xl transition-colors cursor-pointer"
                          title="Editar Producto"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id, p.name)}
                          className="p-1.5 hover:bg-destructive/10 text-destructive rounded-xl transition-colors cursor-pointer"
                          title="Eliminar de inventario"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center p-12 text-muted-foreground italic">
                    No se encontraron productos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE OR EDIT MODAL */}
      {(editingProduct || isCreateOpen) && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <form 
            onSubmit={handleSaveProduct}
            className="bg-card rounded-xl shadow-card-hover border border-border max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-4 border-b border-border bg-secondary flex items-center justify-between">
              <h3 className="font-bold text-foreground">
                {editingProduct ? `Editar Producto: ${editingProduct.name}` : 'Registrar Nuevo Producto'}
              </h3>
              <button 
                type="button" 
                onClick={() => { setEditingProduct(null); setIsCreateOpen(false); }} 
                className="text-muted-foreground hover:text-muted-foreground text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-sm">
              
              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Aceite de Oliva Extra Virgen 500ml"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* SKU & Barcode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Código de Barras (Obligatorio) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 7790895000011"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">SKU (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: ACO-OLIV-500"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>
              </div>

              {/* Category & Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Categoría</label>
                  <input
                    type="text"
                    placeholder="Ej: Almacén, Bebidas, Lácteos..."
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Stock Inicial *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="Ej: 24"
                    value={formStock}
                    onChange={(e) => setFormStock(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>
              </div>

              {/* Costs & Prices */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Costo Neto Unitario ($) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="Ej: 1500"
                    value={formCost}
                    onChange={(e) => setFormCost(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Precio de Venta ($) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="Ej: 2990"
                    value={formPrice}
                    onChange={(e) => setFormPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>
              </div>

              {/* Estimated profitability calculations */}
              <div className="bg-secondary p-4 rounded-xl flex items-center justify-between text-xs text-muted-foreground border border-border">
                <span>Margen estimado de ganancia:</span>
                <span className="font-semibold text-bento-green font-mono text-sm">
                  {formPrice > 0 ? `${formPrice - formCost} (${(((formPrice - formCost) / formPrice) * 100).toFixed(0)}%)` : '$0 (0%)'}
                </span>
              </div>

            </div>

            <div className="p-4 border-t border-border bg-secondary flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setEditingProduct(null); setIsCreateOpen(false); }}
                className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-xs font-semibold transition-colors flex items-center cursor-pointer"
              >
                <Check className="h-3.5 w-3.5 mr-1.5" />
                {editingProduct ? 'Actualizar Producto' : 'Registrar Producto'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
