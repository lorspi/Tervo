import React, { useState } from 'react';
import { SystemState, User, UserRole } from '../types';
import { Plus, Edit2, Check, UserPlus, Shield, UserX, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../store';
import { useUI } from './UIProvider';

interface UsersViewProps {
  state: SystemState;
  onUpdateState: (newState: SystemState) => void;
}

export default function UsersView({ state, onUpdateState }: UsersViewProps) {
  const { toast, confirm } = useUI();
  const { createUser, updateUser, deleteUser, addAuditLog: storeAuditLog } = useAppStore();
  // Create / Edit states
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('vendedor');
  const [formActive, setFormActive] = useState(true);

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormUsername(user.username);
    setFormPassword(user.password || '123'); // plain-text mock
    setFormRole(user.role);
    setFormActive(user.active);
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setFormRole('vendedor');
    setFormActive(true);
    setIsCreateOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formUsername || !formPassword) {
      toast("Por favor completa todos los campos obligatorios.", 'warning');
      return;
    }

    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          name: formName,
          username: formUsername,
          password: formPassword,
          role: formRole,
          active: formActive,
        });
        await storeAuditLog('user', `Usuario "${formName}" (ID: ${editingUser.id}) editado por ${state.currentUser?.name}. Rol: ${formRole}, Activo: ${formActive ? 'Sí' : 'No'}`);
      } else {
        await createUser({
          name: formName,
          username: formUsername,
          password: formPassword,
          role: formRole,
          active: formActive,
        });
        await storeAuditLog('user', `Nuevo usuario "${formName}" (Rol: ${formRole}) registrado por ${state.currentUser?.name}.`);
      }

      setEditingUser(null);
      setIsCreateOpen(false);
    } catch (err: any) {
      toast(err.message || 'Error al guardar usuario.', 'error');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === state.currentUser?.id) {
      toast("No puedes desactivar o eliminar a tu propio usuario activo actualmente.", 'error');
      return;
    }

    const confirmed = await confirm({ title: 'Eliminar Usuario', message: `¿Estás seguro de que deseas eliminar al usuario "${userName}" del sistema?`, variant: 'danger' });
    if (!confirmed) return;

    try {
      await deleteUser(userId);
      await storeAuditLog('user', `Usuario "${userName}" (ID: ${userId}) eliminado del sistema por ${state.currentUser?.name}.`);
    } catch (err: any) {
      toast(err.message || 'Error al eliminar usuario.', 'error');
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="flex items-center gap-1.5 text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full font-bold">
            <ShieldCheck className="h-3.5 w-3.5" />
            ADMINISTRADOR
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 text-[10px] bg-bento-blue-light text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold">
            <Shield className="h-3.5 w-3.5" />
            VENDEDOR
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title & Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground">Agrega o configura los privilegios de los cajeros, vendedores y administradores.</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center px-4 py-2 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="h-4 w-4 mr-1.5" />
          Registrar Usuario
        </button>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.users.map((user) => {
          const isMe = user.id === state.currentUser?.id;
          return (
            <div 
              key={user.id} 
              className={`bg-card border border-border rounded-xl p-6 shadow-xs relative flex flex-col justify-between group hover:border-slate-300 transition-colors ${
                !user.active ? 'opacity-50' : ''
              }`}
            >
              <div className="space-y-4">
                {/* Header Card info */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-foreground leading-snug flex items-center gap-1.5">
                      {user.name}
                      {isMe && <span className="text-[9px] bg-secondary text-muted-foreground px-1.5 py-0.2 rounded-sm font-bold">TÚ</span>}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">@username: {user.username}</p>
                  </div>
                  
                  {getRoleBadge(user.role)}
                </div>

                {/* Password / login simulator indicator */}
                <div className="text-xs text-muted-foreground bg-secondary p-3 rounded-xl flex items-center justify-between border border-border">
                  <span>Clave de acceso:</span>
                  <span className="font-mono font-bold text-foreground bg-card px-1.5 py-0.5 border border-border rounded-sm">
                    {user.password || '123'}
                  </span>
                </div>
              </div>

              {/* Card actions */}
              <div className="flex items-center justify-between mt-6 pt-3 border-t border-border">
                <span className={`text-[10px] font-bold ${user.active ? 'text-bento-green' : 'text-muted-foreground'}`}>
                  {user.active ? '● ACCESO PERMITIDO' : '○ ACCESO BLOQUEADO'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(user)}
                    className="p-1.5 hover:bg-secondary text-muted-foreground rounded-xl transition-colors cursor-pointer"
                    title="Editar datos de acceso y privilegios"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteUser(user.id, user.name)}
                    className="p-1.5 hover:bg-destructive/10 text-destructive rounded-xl transition-colors cursor-pointer"
                    title="Eliminar usuario del sistema"
                  >
                    <UserX className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE OR EDIT MODAL */}
      {(editingUser || isCreateOpen) && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <form 
            onSubmit={handleSaveUser}
            className="bg-card rounded-xl shadow-card-hover border border-border max-w-sm w-full overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-border bg-secondary flex items-center justify-between">
              <h3 className="font-bold text-foreground">
                {editingUser ? `Editar Usuario: ${editingUser.name}` : 'Registrar Nuevo Usuario'}
              </h3>
              <button 
                type="button" 
                onClick={() => { setEditingUser(null); setIsCreateOpen(false); }} 
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
                  placeholder="Ej: Marcelo Alarcón Cid"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Nombre de Usuario (@login) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: marcelo.alarcon"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Clave de Acceso *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 12345"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
              </div>

              {/* Role Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Rol / Permisos del Sistema</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="vendedor">Vendedor (Cajero / Inventario)</option>
                  <option value="admin">Administrador (Configuraciones + Ventas)</option>
                </select>
              </div>

              {/* Active check */}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Acceso Habilitado</label>
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="h-4 w-4 text-foreground focus:ring-ring rounded border-border"
                />
              </div>

            </div>

            <div className="p-4 border-t border-border bg-secondary flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setEditingUser(null); setIsCreateOpen(false); }}
                className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-xs font-semibold transition-colors flex items-center cursor-pointer"
              >
                <Check className="h-3.5 w-3.5 mr-1.5" />
                {editingUser ? 'Actualizar Usuario' : 'Registrar Usuario'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
