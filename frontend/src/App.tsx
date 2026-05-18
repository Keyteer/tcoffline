import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Episodes } from './pages/Episodes';
import { NewEpisode } from './pages/NewEpisode';
import { ClinicalNote } from './pages/ClinicalNote';
import { ProtectedRoute } from './components/ProtectedRoute';
import { BackendCheck } from './components/BackendCheck';
import { UserProvider } from './contexts/UserContext';

function App() {
  return (
    <BackendCheck>
      
        <UserProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/episodes"
              element={
                <ProtectedRoute>
                  <Episodes />
                </ProtectedRoute>
              }
            />

            <Route
              path="/new"
              element={
                <ProtectedRoute>
                  <NewEpisode />
                </ProtectedRoute>
              }
            />

            <Route
              path="/episode/:id/note"
              element={
                <ProtectedRoute>
                  <ClinicalNote />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to="/episodes" replace />} />
          </Routes>
        </UserProvider>
      
    </BackendCheck>
  );
}

export default App;
