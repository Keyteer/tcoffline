import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';

export function Login() {
  const { t, language } = useLanguage();
  const { refreshUser } = useUser();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await api.verifyCredentials({ username, password });

      // Tokens are already stored by verifyCredentials via auth.setTokens
      auth.setUser({
        username: user.username,
        role: user.role,
      });

      await refreshUser();

      const centralHealth = await api.getCentralHealth();
      if (centralHealth.status === 'online') {
        alert(t.readOnlyMode.loginAlert);
      }

      navigate('/episodes');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t.login.loginError
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-950">
      <div
        className={`bg-white dark:bg-gray-900 shadow-2xl transition-all duration-300 ease-in-out border-r border-gray-200 dark:border-gray-800 ${
          sidebarOpen ? 'w-80' : 'w-0'
        } overflow-hidden`}
      >
        <div className="h-full p-8 flex flex-col">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">TrakCare Offline</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Sistema de Contingencia Clínica</p>
          </div>

          <div className="flex-1 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-3">Características</h3>
              <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-2">✓</span>
                  <span>Gestión de episodios en modo offline</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-2">✓</span>
                  <span>Sincronización automática con servidor central</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-2">✓</span>
                  <span>Registro de notas clínicas</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-2">✓</span>
                  <span>Control de pacientes y episodios</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-3">Tipos de Episodio</h3>
              <div className="space-y-2 text-sm">
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 px-3 py-2 rounded">
                  <span className="font-medium text-red-800 dark:text-red-200">Urgencia</span>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-900 px-3 py-2 rounded">
                  <span className="font-medium text-purple-800 dark:text-purple-200">Hospitalizado</span>
                </div>
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 px-3 py-2 rounded">
                  <span className="font-medium text-green-800 dark:text-green-200">Ambulatorio</span>
                </div>
                <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-900 px-3 py-2 rounded">
                  <span className="font-medium text-orange-800 dark:text-orange-200">Pabellón</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Sistema diseñado para garantizar la continuidad operativa en caso de pérdida de conexión con el servidor central.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-900 rounded-lg shadow-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
        aria-label={sidebarOpen ? 'Cerrar panel' : 'Abrir panel'}
      >
        <svg
          className={`w-6 h-6 text-gray-700 dark:text-gray-300 transition-transform duration-300 ${
            sidebarOpen ? 'rotate-0' : 'rotate-180'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          )}
        </svg>
      </button>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-8 border border-gray-200 dark:border-gray-800">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50 mb-2">{t.login.title}</h1>
              <p className="text-gray-600 dark:text-gray-400">
                {language === 'es' ? 'Ingrese sus credenciales para continuar' : 'Enter your credentials to continue'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="username" className="label">
                  {t.login.username}
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field"
                  placeholder={language === 'es' ? 'Ingrese su usuario' : 'Enter your username'}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="password" className="label">
                  {t.login.password}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder={language === 'es' ? 'Ingrese su contraseña' : 'Enter your password'}
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 rounded-lg p-3 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary py-3 text-base"
              >
                {isLoading ? (language === 'es' ? 'Iniciando sesión...' : 'Logging in...') : t.login.loginButton}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Credenciales de prueba:</p>
              <p>Usuario: <span className="font-mono font-semibold">admin</span></p>
              <p>Contraseña: <span className="font-mono font-semibold">admin</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
