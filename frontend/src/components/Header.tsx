import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/auth';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { UserSettingsModal } from './UserSettingsModal';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

export function Header() {
  const navigate = useNavigate();
  const { isOnline } = useConnectionStatus();
  const [showModal, setShowModal] = useState(false);
  const { user: currentUser, updateUser } = useUser();
  const storedUser = auth.getUser();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const handleLogout = () => {
    auth.logout();
    updateUser(null);
    navigate('/login');
  };

  const handleUserUpdated = (user: any) => {
    updateUser(user);
  };

  const handleLanguageChange = (lang: 'es' | 'en') => {
    setLanguage(lang);
    setShowLanguageMenu(false);
  };

  return (
    <>
      <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">TrakCare Offline</h1>
              <span className={isOnline ? 'badge-online' : 'badge-offline'}>
                {isOnline ? (
                  <>
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
                    ONLINE
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></span>
                    OFFLINE
                  </>
                )}
              </span>
            </div>

            {storedUser && (
              <div className="flex items-center gap-4">
                <div className="relative">
                  <button
                    onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                    className="px-3 py-2 text-sm font-bold text-gray-900 dark:text-gray-50 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-300 dark:border-gray-600"
                    title={t.header.language}
                  >
                    {language.toUpperCase()}
                  </button>
                  {showLanguageMenu && (
                    <div className="absolute right-0 mt-2 w-20 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black dark:ring-white ring-opacity-5 dark:ring-opacity-20 border border-gray-200 dark:border-gray-700">
                      <div className="py-1">
                        <button
                          onClick={() => handleLanguageChange('es')}
                          className={`block w-full text-center px-3 py-2 text-sm font-bold ${
                            language === 'es'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
                              : 'text-gray-900 dark:text-gray-50 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          ES
                        </button>
                        <button
                          onClick={() => handleLanguageChange('en')}
                          className={`block w-full text-center px-3 py-2 text-sm font-bold ${
                            language === 'en'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
                              : 'text-gray-900 dark:text-gray-50 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          EN
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={toggleTheme}
                  className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title={theme === 'dark' ? t.header.lightMode : t.header.darkMode}
                >
                  {theme === 'dark' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={() => setShowModal(true)}
                  className="text-right hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                    {storedUser.username}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{storedUser.role}</p>
                </button>
                <button
                  onClick={handleLogout}
                  className="btn-secondary text-sm"
                >
                  {t.header.logout}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {currentUser && (
        <UserSettingsModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          user={currentUser}
          onUserUpdated={handleUserUpdated}
        />
      )}
    </>
  );
}
