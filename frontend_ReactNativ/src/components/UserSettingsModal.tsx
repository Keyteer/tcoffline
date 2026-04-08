import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Switch,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { User } from '../types';

interface UserSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => void | Promise<void>;
}

export function UserSettingsModal({ visible, onClose, user, onUserUpdated, onLogout }: UserSettingsModalProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
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
    if (visible) {
      setActiveTab('settings');
      setNombre(user.nombre || '');
      setFiltros(user.filtros || '');
      setError('');
      setSuccess('');
      setPassword('');
      setConfirmPassword('');
      api.getSystemSettings().then(settings => {
        setEnableReadOnlyMode(settings.enable_read_only_mode);
      }).catch(err => {
        console.error('Error loading system settings:', err);
      });
      if (user.is_admin) {
        loadUsers();
      }
    }
  }, [visible, user.is_admin]);

  const loadUsers = async () => {
    try {
      const usersList = await api.listUsers();
      setUsers(usersList);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const handleCreateUser = async () => {
    setError('');
    setSuccess('');

    if (!newUsername || !newPassword) {
      setError(t.userSettings.saveError || 'Usuario y contraseña son requeridos');
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

  const handleSubmit = async () => {
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

      if (password) { updateData.password = password; hasUserChanges = true; }
      if (nombre !== user.nombre) { updateData.nombre = nombre; hasUserChanges = true; }
      if (filtros !== user.filtros) { updateData.filtros = filtros; hasUserChanges = true; }

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

      setSuccess(t.userSettings.saveSuccess || 'Configuración actualizada correctamente');
      setPassword('');
      setConfirmPassword('');

      if (filtros !== user.filtros) {
        try {
          await api.syncFromCentral();
        } catch (syncErr) {
          console.error('Error triggering sync after filter update:', syncErr);
        }
      }

      setTimeout(() => {
        onClose();
        setSuccess('');
      }, 1500);
    } catch (err: any) {
      setError(err.message || t.userSettings.saveError || 'Error al actualizar');
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

  const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    modal: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logoutButton: {
      backgroundColor: colors.surfaceSecondary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
    },
    logoutText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    closeText: { fontSize: 22, color: colors.textSecondary },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
    tabTextActive: { color: colors.primary },
    content: { padding: 16 },
    label: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
      color: colors.text,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      marginBottom: 12,
    },
    inputDisabled: { backgroundColor: colors.surfaceSecondary, color: colors.textSecondary },
    hint: { fontSize: 11, color: colors.textTertiary, marginTop: -8, marginBottom: 12 },
    adminSection: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 16,
      marginTop: 8,
    },
    adminSectionTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 12 },
    readOnlyBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.warningBorder,
      backgroundColor: colors.warningLight,
      borderRadius: 10,
    },
    readOnlyLabel: { fontSize: 13, fontWeight: '500', color: colors.warning },
    readOnlyHint: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
    errorBox: {
      padding: 12,
      backgroundColor: colors.errorLight,
      borderWidth: 1,
      borderColor: colors.errorBorder,
      borderRadius: 8,
      marginBottom: 12,
    },
    errorText: { fontSize: 13, color: colors.error },
    successBox: {
      padding: 12,
      backgroundColor: colors.successLight,
      borderWidth: 1,
      borderColor: colors.successBorder,
      borderRadius: 8,
      marginBottom: 12,
    },
    successText: { fontSize: 13, color: colors.success },
    buttonRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    cancelButton: {
      flex: 1,
      padding: 14,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      alignItems: 'center',
    },
    cancelButtonText: { fontWeight: '600', color: colors.textSecondary },
    saveButton: {
      flex: 1,
      padding: 14,
      backgroundColor: colors.primary,
      borderRadius: 10,
      alignItems: 'center',
    },
    saveButtonText: { fontWeight: '600', color: '#FFF' },
    // Users tab
    userCard: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    userRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    userName: { fontWeight: '600', color: colors.text, fontSize: 14 },
    adminBadge: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    adminBadgeText: { fontSize: 11, fontWeight: '600', color: colors.primary },
    userNombre: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    userStatus: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
    createUserButton: {
      padding: 14,
      backgroundColor: colors.primary,
      borderRadius: 10,
      alignItems: 'center',
      marginTop: 16,
    },
    createUserButtonText: { fontWeight: '600', color: '#FFF', fontSize: 15 },
    createUserForm: {
      padding: 16,
      backgroundColor: colors.infoLight,
      borderWidth: 1,
      borderColor: colors.infoBorder,
      borderRadius: 12,
      marginTop: 16,
    },
    createUserHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    createUserTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      backgroundColor: colors.primaryLight,
      borderRadius: 10,
      marginBottom: 12,
    },
    switchLabel: { fontSize: 13, fontWeight: '500', color: colors.text },
    switchHint: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <View style={styles.modal} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t.userSettings.title}</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
                <Text style={styles.logoutText}>{t.header.logout}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tabs (admin only) */}
          {user.is_admin && (
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
                onPress={() => setActiveTab('settings')}
              >
                <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
                  Configuración
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'users' && styles.tabActive]}
                onPress={() => setActiveTab('users')}
              >
                <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
                  Gestión de Usuarios
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView style={styles.content}>
            {activeTab === 'settings' && (
              <>
                <Text style={styles.label}>Usuario</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={user.username}
                  editable={false}
                />

                <Text style={styles.label}>Nombre Completo</Text>
                <TextInput
                  style={styles.input}
                  value={nombre}
                  onChangeText={setNombre}
                  placeholder="Tu nombre completo"
                  placeholderTextColor={colors.textTertiary}
                  editable={!isSubmitting}
                />
                <Text style={styles.hint}>Este nombre se registrará cuando crees notas clínicas</Text>

                <Text style={styles.label}>Nueva Contraseña</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Dejar en blanco para no cambiar"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                  editable={!isSubmitting}
                />

                <Text style={styles.label}>Confirmar Contraseña</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repetir nueva contraseña"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                  editable={!isSubmitting}
                />

                <Text style={styles.label}>Filtros API</Text>
                <TextInput
                  style={styles.input}
                  value={filtros}
                  onChangeText={setFiltros}
                  placeholder="ej: filtro1=valor1&filtro2=valor2"
                  placeholderTextColor={colors.textTertiary}
                  editable={!isSubmitting}
                />
                <Text style={styles.hint}>Parámetros de consulta para el endpoint obtenerDatos</Text>

                {user.is_admin && (
                  <View style={styles.adminSection}>
                    <Text style={styles.adminSectionTitle}>Configuración del Sistema</Text>
                    <View style={styles.readOnlyBox}>
                      <Switch
                        value={enableReadOnlyMode}
                        onValueChange={setEnableReadOnlyMode}
                        disabled={isSubmitting}
                        trackColor={{ false: colors.border, true: colors.warning }}
                        thumbColor="#FFF"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.readOnlyLabel}>
                          Habilitar Modo Solo Lectura (Todo el Sistema)
                        </Text>
                        <Text style={styles.readOnlyHint}>
                          Cuando está habilitado, TODOS los usuarios no podrán crear episodios ni notas cuando el sistema central esté en línea
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {error !== '' && (
                  <View style={[styles.errorBox, { marginTop: 12 }]}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
                {success !== '' && (
                  <View style={[styles.successBox, { marginTop: 12 }]}>
                    <Text style={styles.successText}>{success}</Text>
                  </View>
                )}

                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.cancelButton} onPress={handleClose} disabled={isSubmitting}>
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveButton, isSubmitting && { opacity: 0.6 }]}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.saveButtonText}>Guardar</Text>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={{ height: 30 }} />
              </>
            )}

            {activeTab === 'users' && user.is_admin && (
              <>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 }}>
                  Usuarios del Sistema
                </Text>

                <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                  {users.map((u) => (
                    <View key={u.id} style={styles.userCard}>
                      <View style={styles.userRow}>
                        <Text style={styles.userName}>{u.username}</Text>
                        {u.is_admin && (
                          <View style={styles.adminBadge}>
                            <Text style={styles.adminBadgeText}>Administrador</Text>
                          </View>
                        )}
                      </View>
                      {u.nombre && <Text style={styles.userNombre}>{u.nombre}</Text>}
                      <Text style={styles.userStatus}>Estado: {u.active ? 'Activo' : 'Inactivo'}</Text>
                    </View>
                  ))}
                </View>

                {!showCreateUser ? (
                  <TouchableOpacity style={styles.createUserButton} onPress={() => setShowCreateUser(true)}>
                    <Text style={styles.createUserButtonText}>Crear Nuevo Usuario</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.createUserForm}>
                    <View style={styles.createUserHeader}>
                      <Text style={styles.createUserTitle}>Nuevo Usuario</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setShowCreateUser(false);
                          setNewUsername('');
                          setNewPassword('');
                          setNewNombre('');
                          setNewIsAdmin(false);
                          setError('');
                        }}
                      >
                        <Text style={styles.closeText}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>Usuario</Text>
                    <TextInput
                      style={styles.input}
                      value={newUsername}
                      onChangeText={setNewUsername}
                      placeholder="Nombre de usuario"
                      placeholderTextColor={colors.textTertiary}
                      editable={!isSubmitting}
                    />

                    <Text style={styles.label}>Contraseña</Text>
                    <TextInput
                      style={styles.input}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Contraseña"
                      placeholderTextColor={colors.textTertiary}
                      secureTextEntry
                      editable={!isSubmitting}
                    />

                    <Text style={styles.label}>Nombre Completo</Text>
                    <TextInput
                      style={styles.input}
                      value={newNombre}
                      onChangeText={setNewNombre}
                      placeholder="Nombre completo (opcional)"
                      placeholderTextColor={colors.textTertiary}
                      editable={!isSubmitting}
                    />

                    <View style={styles.switchRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.switchLabel}>Es administrador</Text>
                        <Text style={styles.switchHint}>
                          Los administradores pueden gestionar usuarios y configuración del sistema
                        </Text>
                      </View>
                      <Switch
                        value={newIsAdmin}
                        onValueChange={setNewIsAdmin}
                        disabled={isSubmitting}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor="#FFF"
                      />
                    </View>

                    {error !== '' && (
                      <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                      </View>
                    )}
                    {success !== '' && (
                      <View style={styles.successBox}>
                        <Text style={styles.successText}>{success}</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.createUserButton, { marginTop: 0 }, isSubmitting && { opacity: 0.6 }]}
                      onPress={handleCreateUser}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.createUserButtonText}>Crear Usuario</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                <View style={{ height: 30 }} />
              </>
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
