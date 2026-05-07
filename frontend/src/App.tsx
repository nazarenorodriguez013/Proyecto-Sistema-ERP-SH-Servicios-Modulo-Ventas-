import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Layout from './components/Layout';
import PuntoDeVenta from './pages/PuntoDeVenta';
import Articulos from './pages/Articulos';
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

  const renderPage = () => {
    switch (currentPage) {
      case 'punto-de-venta': return <PuntoDeVenta />;
      case 'articulos':      return <Articulos />;
      default: return (
        <div className="flex-1 flex items-center justify-center text-gray-400 p-8">
          Módulo en desarrollo...
        </div>
      );
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
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
