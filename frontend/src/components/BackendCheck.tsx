import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface BackendCheckProps {
  children: React.ReactNode;
}

export function BackendCheck({ children }: BackendCheckProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const checkBackend = async () => {
    try {
      await api.getHealth();
      setBackendAvailable(true);
      setError(null);
    } catch (err) {
      setBackendAvailable(false);
      setError(err instanceof Error ? err.message : 'Backend no disponible');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkBackend();
  }, [retryCount]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Conectando con el servidor...</p>
        </div>
      </div>
    );
  }

  if (!backendAvailable) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <svg
              className="mx-auto h-16 w-16 text-red-500 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Backend No Disponible
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              No se puede conectar con el servidor en http://localhost:8000
            </p>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              ¿Por qué veo esto?
            </h2>
            <p className="text-yellow-700 dark:text-yellow-300 text-sm mb-3">
              La aplicación Electron requiere que el backend Python esté corriendo en segundo plano.
            </p>
            <div className="text-sm text-yellow-700 dark:text-yellow-300">
              <strong>Para solucionar:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1 ml-2">
                <li>Abre una terminal/cmd</li>
                <li>Ve al directorio raíz del proyecto</li>
                <li>Ejecuta: <code className="bg-yellow-100 dark:bg-yellow-800 px-2 py-1 rounded">python -m uvicorn app.main:app --host 0.0.0.0 --port 8000</code></li>
                <li>Espera el mensaje "Application startup complete"</li>
                <li>Haz clic en "Reintentar" abajo</li>
              </ol>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
              Opción rápida (Windows):
            </h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              Ejecuta el archivo <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">setup-backend.bat</code> en el directorio raíz del proyecto
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-6">
              <p className="text-red-700 dark:text-red-300 text-sm">
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setIsChecking(true);
                setRetryCount(prev => prev + 1);
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Reintentar Conexión
            </button>
            <button
              onClick={() => {
                window.open('http://localhost:8000/health', '_blank');
              }}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Verificar Backend
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-700 dark:text-gray-300 font-medium mb-2">
                Más información
              </summary>
              <div className="text-gray-600 dark:text-gray-400 space-y-2 mt-2">
                <p>
                  <strong>¿Qué es el backend?</strong><br />
                  Es el servidor Python que procesa los datos clínicos y se comunica con la base de datos.
                </p>
                <p>
                  <strong>¿Por qué no está incluido en el .exe?</strong><br />
                  Para mantener la aplicación modular y actualizable. El backend puede ejecutarse como servicio de Windows.
                </p>
                <p>
                  <strong>Documentación:</strong><br />
                  Ver <code>frontend/INICIO_RAPIDO_ELECTRON.md</code> para más detalles.
                </p>
              </div>
            </details>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
