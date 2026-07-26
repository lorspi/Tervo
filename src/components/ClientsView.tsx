import React, { useState, useMemo } from 'react';
import { SystemState, Client } from '../types';
import { Plus, Edit2, Search, Trash2, Check, UserPlus, Phone, Mail, MapPin, CreditCard } from 'lucide-react';
import { useAppStore } from '../store';
import { useUI } from './UIProvider';
import Portal from './Portal';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface ClientsViewProps {
  state: SystemState;
  onUpdateState: (newState: SystemState) => void;
}

export default function ClientsView({ state, onUpdateState }: ClientsViewProps) {
  const { toast, confirm } = useUI();
  const { createClient, updateClient, deleteClient, addAuditLog: storeAuditLog } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create / Edit states
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDocument, setFormDocument] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formDirty, setFormDirty] = useState(false);

  const isModalOpen = !!(editingClient || isCreateOpen);
  const closeModal = () => { setEditingClient(null); setIsCreateOpen(false); setFormDirty(false); };
  const { shaking, attemptClose } = useModalDismiss(isModalOpen, closeModal, formDirty);

  // Filter clients
  const filteredClients = useMemo(() => {
    return state.clients.filter(c => {
      const text = searchTerm.toLowerCase();
      const matchesSearch = 
        c.name.toLowerCase().includes(text) ||
        (c.document || '').toLowerCase().includes(text) ||
        (c.phone || '').toLowerCase().includes(text) ||
        (c.email || '').toLowerCase().includes(text);

      return matchesSearch;
    });
  }, [state.clients, searchTerm]);

  // Open edit
  const handleOpenEdit = (c: Client) => {
    setEditingClient(c);
    setFormName(c.name);
    setFormDocument(c.document || '');
    setFormPhone(c.phone || '');
    setFormEmail(c.email || '');
    setFormAddress(c.address || '');
  };

  // Open create
  const handleOpenCreate = () => {
    setEditingClient(null);
    setFormName('');
    setFormDocument('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setIsCreateOpen(true);
  };

  // Save / Update client
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) {
      toast("Por favor ingresa al menos el Nombre del Cliente.", 'warning');
      return;
    }

    try {
      if (editingClient) {
        await updateClient(editingClient.id, {
          name: formName,
          document: formDocument || undefined,
          phone: formPhone || undefined,
          email: formEmail || undefined,
          address: formAddress || undefined,
        });
        await storeAuditLog('client', `Cliente "${formName}" (ID: ${editingClient.id}) editado por ${state.currentUser?.name}.`);
      } else {
        await createClient({
          name: formName,
          document: formDocument || undefined,
          phone: formPhone || undefined,
          email: formEmail || undefined,
          address: formAddress || undefined,
        });
        await storeAuditLog('client', `Nuevo cliente "${formName}" registrado por ${state.currentUser?.name}.`);
      }

      setEditingClient(null);
      setIsCreateOpen(false);
    } catch (err: any) {
      toast(err.message || 'Error al guardar cliente.', 'error');
    }
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    const confirmed = await confirm({ title: 'Eliminar Cliente', message: `¿Estás seguro de que deseas eliminar al cliente "${clientName}" del sistema?`, variant: 'danger' });
    if (!confirmed) return;

    try {
      await deleteClient(clientId);
      await storeAuditLog('client', `Cliente "${clientName}" (ID: ${clientId}) eliminado del sistema por ${state.currentUser?.name}.`);
    } catch (err: any) {
      toast(err.message || 'Error al eliminar cliente.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title & Add Client Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Directorio de Clientes</h1>
          <p className="text-sm text-muted-foreground">Mantén un registro de tus clientes frecuentes para asociar a sus ventas.</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center px-4 py-2 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="h-4 w-4 mr-1.5" />
          Registrar Cliente
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nombre, documento identificador, teléfono, correo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 pr-4 py-2 border border-border rounded-xl text-sm bg-card placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full"
        />
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => {
          return (
            <div 
              key={client.id} 
              className="bg-card border border-border rounded-xl p-5 shadow-xs relative flex flex-col justify-between group hover:border-slate-300 transition-colors"
            >
              <div className="space-y-4">
                {/* Header Card */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-foreground leading-snug">{client.name}</h3>
                    {client.document && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">RUT/DNI: {client.document}</p>
                    )}
                  </div>
                </div>

                {/* Contact details */}
                <div className="space-y-2 text-xs text-muted-foreground border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{client.phone || <span className="text-slate-300 italic">Sin teléfono</span>}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{client.email || <span className="text-slate-300 italic">Sin correo electrónico</span>}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="line-clamp-1">{client.address || <span className="text-slate-300 italic">Sin dirección registrada</span>}</span>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="flex items-center justify-end gap-1.5 mt-5 pt-3 border-t border-border">
                <button
                  onClick={() => handleOpenEdit(client)}
                  className="p-1.5 hover:bg-secondary text-muted-foreground rounded-xl transition-colors cursor-pointer"
                  title="Editar datos del cliente"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                
                <button
                  onClick={() => handleDeleteClient(client.id, client.name)}
                  className="p-1.5 hover:bg-destructive/10 text-destructive rounded-xl transition-colors cursor-pointer"
                  title="Eliminar cliente"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredClients.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-secondary border border-dashed border-border rounded-xl">
            No se encontraron clientes registrados bajo esa búsqueda.
          </div>
        )}
      </div>

      {/* CREATE OR EDIT MODAL */}
      {(editingClient || isCreateOpen) && (
        <Portal>
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" onClick={attemptClose}>
          <form 
            onSubmit={handleSaveClient}
            onChange={() => setFormDirty(true)}
            onClick={(e) => e.stopPropagation()}
            className={`bg-card rounded-xl shadow-card-hover border border-border max-w-md w-full overflow-hidden flex flex-col ${shaking ? 'animate-shake' : ''}`}
          >
            <div className="p-4 border-b border-border bg-secondary flex items-center justify-between">
              <h3 className="font-bold text-foreground">
                {editingClient ? `Editar Cliente: ${editingClient.name}` : 'Registrar Nuevo Cliente'}
              </h3>
              <button 
                type="button" 
                onClick={closeModal} 
                className="text-muted-foreground hover:text-muted-foreground text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm">
              
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Carolina Lagos Fuentes"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Document DNI/RUT */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Documento Identificador (RUT/DNI/RFC)</label>
                <input
                  type="text"
                  placeholder="Ej: 18.456.789-k"
                  value={formDocument}
                  onChange={(e) => setFormDocument(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Teléfono de Contacto</label>
                  <input
                    type="text"
                    placeholder="Ej: +569 8888 7777"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="Ej: carola@gmail.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Dirección Particular</label>
                <input
                  type="text"
                  placeholder="Ej: Avenida Las Palmeras #589, Depto 102"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

            </div>

            <div className="p-4 border-t border-border bg-secondary flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-xs font-semibold transition-colors flex items-center cursor-pointer"
              >
                <Check className="h-3.5 w-3.5 mr-1.5" />
                {editingClient ? 'Actualizar Cliente' : 'Registrar Cliente'}
              </button>
            </div>
          </form>
        </div>
        </Portal>
      )}

    </div>
  );
}
