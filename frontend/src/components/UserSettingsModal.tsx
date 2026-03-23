import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import type { User } from '../types';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUserUpdated: (user: User) => void;
}

export function UserSettingsModal({ isOpen, onClose, user, onUserUpdated }: UserSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'users'>('settings');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nombre, setNombre] = useState(user.nombre || '');
  const [filtros, setFiltros] = useState(user.filtros || '');
  const [enableReadOnlyMode, setEnableReadOnlyMode] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('settings');
      api.getSystemSettings().then(settings => {
        setEnableReadOnlyMode(settings.enable_read_only_mode);
      }).catch(err => {
        console.error('Error loading system settings:', err);
      });

      if (user.is_admin) {
        loadUsers();
      }
    }
  }, [isOpen, user.is_admin]);

  const loadUsers = async () => {
    try {
      const usersList = await api.listUsers();
      setUsers(usersList);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newUsername || !newPassword) {
      setError('Usuario y contraseña son requeridos');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.createUser({
        username: newUsername,
        password: newPassword,
        nombre: newNombre || undefined,
        is_admin: newIsAdmin,
      });

      setSuccess('Usuario creado correctamente');
      setNewUsername('');
      setNewPassword('');
      setNewNombre('');
      setNewIsAdmin(false);
      setShowCreateUser(false);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Error al crear usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password && password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setIsSubmitting(true);

    try {
      const updateData: { password?: string; nombre?: string; filtros?: string } = {};
      let hasUserChanges = false;
      let hasSystemChanges = false;

      if (password) {
        updateData.password = password;
        hasUserChanges = true;
      }

      if (nombre !== user.nombre) {
        updateData.nombre = nombre;
        hasUserChanges = true;
      }

      if (filtros !== user.filtros) {
        updateData.filtros = filtros;
        hasUserChanges = true;
      }

      if (user.is_admin) {
        const currentSettings = await api.getSystemSettings();
        if (enableReadOnlyMode !== currentSettings.enable_read_only_mode) {
          hasSystemChanges = true;
        }
      }

      if (!hasUserChanges && !hasSystemChanges) {
        setError('No hay cambios para guardar');
        setIsSubmitting(false);
        return;
      }

      if (hasUserChanges) {
        const updatedUser = await api.updateCurrentUser(updateData);
        auth.updateUser(updatedUser);
        onUserUpdated(updatedUser);
      }

      if (hasSystemChanges) {
        await api.updateSystemSettings({ enable_read_only_mode: enableReadOnlyMode });
      }

      setSuccess('Configuración actualizada correctamente');
      setPassword('');
      setConfirmPassword('');

      if (filtros !== user.filtros) {
        try {
          await api.syncFromCentral();
          window.dispatchEvent(new CustomEvent('sync-completed'));
        } catch (syncErr) {
          console.error('Error triggering sync after filter update:', syncErr);
        }
      }

      setTimeout(() => {
        onClose();
        setSuccess('');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la configuración');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    setNombre(user.nombre || '');
    setFiltros(user.filtros || '');
    setError('');
    setSuccess('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 border border-gray-200 dark:border-gray-800">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Configuración</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              disabled={isSubmitting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {user.is_admin && (
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  activeTab === 'settings'
                    ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Configuración
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  activeTab === 'users'
                    ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Gestión de Usuarios
              </button>
            </div>
          )}

          {activeTab === 'settings' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Usuario
              </label>
              <input
                type="text"
                value={user.username}
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre Completo
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="Tu nombre completo"
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Este nombre se registrará cuando crees notas clínicas
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nueva Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="Dejar en blanco para no cambiar"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirmar Contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="Repetir nueva contraseña"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filtros API
              </label>
              <input
                type="text"
                value={filtros}
                onChange={(e) => setFiltros(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="ej: filtro1=valor1&filtro2=valor2"
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Parámetros de consulta para el endpoint obtenerDatos
              </p>
            </div>

            {user.is_admin && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Configuración del Sistema
                </h3>
                <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-900">
                  <input
                    type="checkbox"
                    id="enableReadOnlyMode"
                    checked={enableReadOnlyMode}
                    onChange={(e) => setEnableReadOnlyMode(e.target.checked)}
                    className="w-4 h-4 text-amber-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-amber-500 dark:focus:ring-amber-600"
                    disabled={isSubmitting}
                  />
                  <label htmlFor="enableReadOnlyMode" className="flex-1 cursor-pointer">
                    <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Habilitar Modo Solo Lectura (Todo el Sistema)
                    </div>
                    <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Cuando está habilitado, TODOS los usuarios no podrán crear episodios ni notas cuando el sistema central esté en línea
                    </div>
                  </label>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-md">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-md">
                <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
          )}

          {activeTab === 'users' && user.is_admin && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">Usuarios del Sistema</h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map((u) => (
                      <div key={u.id} className="p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-gray-100">{u.username}</span>
                              {u.is_admin && (
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
                                  Administrador
                                </span>
                              )}
                            </div>
                            {u.nombre && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{u.nombre}</p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              Estado: {u.active ? 'Activo' : 'Inactivo'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {!showCreateUser ? (
                <button
                  type="button"
                  onClick={() => setShowCreateUser(true)}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Crear Nuevo Usuario
                </button>
              ) : (
                <div className="p-6 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-900">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Nuevo Usuario</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateUser(false);
                        setNewUsername('');
                        setNewPassword('');
                        setNewNombre('');
                        setNewIsAdmin(false);
                        setError('');
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                        Usuario
                      </label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Nombre de usuario"
                        className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                        Contraseña
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Contraseña"
                        className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        value={newNombre}
                        onChange={(e) => setNewNombre(e.target.value)}
                        placeholder="Nombre completo (opcional)"
                        className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-blue-100 dark:bg-blue-900 rounded-md">
                      <input
                        type="checkbox"
                        id="newIsAdmin"
                        checked={newIsAdmin}
                        onChange={(e) => setNewIsAdmin(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                      <label htmlFor="newIsAdmin" className="flex-1 cursor-pointer">
                        <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Es administrador
                        </div>
                        <div className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                          Los administradores pueden gestionar usuarios y configuración del sistema
                        </div>
                      </label>
                    </div>

                    {error && (
                      <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-md">
                        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                      </div>
                    )}

                    {success && (
                      <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-md">
                        <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Creando...' : 'Crear Usuario'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
