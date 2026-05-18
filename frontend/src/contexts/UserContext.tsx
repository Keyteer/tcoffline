import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import type { User } from '../types';

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  updateUser: (user: User | null) => void;
  isReadOnlyMode: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReadOnlyMode, setIsReadOnlyMode] = useState(false);

  const checkReadOnlyMode = async () => {
    try {
      const settings = await api.getSystemSettings();

      if (!settings.enable_read_only_mode) {
        setIsReadOnlyMode(false);
        return;
      }

      const centralHealth = await api.getCentralHealth();
      setIsReadOnlyMode(centralHealth.status === 'online');
    } catch (error) {
      setIsReadOnlyMode(false);
    }
  };

  const refreshUser = async () => {
    const storedUser = auth.getUser();
    if (!storedUser) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await api.getCurrentUser();
      setUser(currentUser);
      await checkReadOnlyMode();
    } catch (error) {
      console.error('Error loading user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (updatedUser: User | null) => {
    setUser(updatedUser);
  };

  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(checkReadOnlyMode, 8000);

    return () => clearInterval(interval);
  }, [user]);

  return (
    <UserContext.Provider value={{ user, isLoading, refreshUser, updateUser, isReadOnlyMode }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
