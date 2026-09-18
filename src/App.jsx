import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import RegisterPHC from './pages/RegisterPHC';
import AshaDashboard from './pages/AshaDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import LoRaReceiver from './pages/LoRaReceiver';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { seedInitialData } from './lib/db';

export function App() {
  useEffect(() => {
    seedInitialData();
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register-phc" element={<RegisterPHC />} />
          <Route path="/gateway" element={<LoRaReceiver />} />

          <Route
            path="/asha"
            element={
              <ProtectedRoute requiredRole="asha">
                <AshaDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor"
            element={
              <ProtectedRoute requiredRole="doctor">
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
