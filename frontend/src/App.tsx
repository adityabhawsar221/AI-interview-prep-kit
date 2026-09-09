import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { KitWorkspace } from './pages/KitWorkspace';
import { CandidatePortal } from './pages/CandidatePortal';
import { GenerateKitModal } from './components/GenerateKitModal';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FCFAF6]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAF6] text-neutral-900 selection:bg-orange-500/20 selection:text-orange-950 font-sans">
      <Navbar onOpenGenerate={() => setModalOpen(true)} />
      <main className="flex-1">
        <Routes>
          {/* If candidate is logged in, show CandidatePortal; if guest, show Home landing page */}
          <Route path="/" element={user ? <CandidatePortal /> : <Home />} />

          {/* Public Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Unified Kit Workspace */}
          <Route
            path="/kits/:id"
            element={
              <ProtectedRoute>
                <KitWorkspace />
              </ProtectedRoute>
            }
          />

          {/* Redirect any legacy routes to Home / Portal */}
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/portal" element={<Navigate to="/" replace />} />
          <Route path="/kits/new" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Global Quick Kit Generator Modal */}
      <GenerateKitModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
