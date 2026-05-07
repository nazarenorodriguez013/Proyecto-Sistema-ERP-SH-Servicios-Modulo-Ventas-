import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';

function AppContent() {
  const { user } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  if (!user) {
    return showRegister
      ? <Register onToggle={() => setShowRegister(false)} />
      : <Login onToggle={() => setShowRegister(true)} />;
  }

  return <div className="p-8 text-center text-gray-500">Bienvenido</div>;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
