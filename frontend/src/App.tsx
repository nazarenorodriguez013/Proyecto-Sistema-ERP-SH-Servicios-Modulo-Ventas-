import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Layout from './components/Layout';
import { PageId } from './types';

function AppContent() {
  const { user } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageId>('punto-de-venta');

  if (!user) {
    return showRegister
      ? <Register onToggle={() => setShowRegister(false)} />
      : <Login onToggle={() => setShowRegister(true)} />;
  }

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      <div className="flex-1 flex items-center justify-center text-gray-400 p-8">
        Módulos en desarrollo...
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
