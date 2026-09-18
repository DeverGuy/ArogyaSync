import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppNav } from './components/common/AppNav';
import AshaDashboard from './pages/AshaDashboard';
import DoctorDashboard from './pages/DoctorDashboard';

/**
 * Root application component.
 *
 * Routing:
 *   /       → redirect to /asha (ASHA Worker Dashboard)
 *   /asha   → ASHA Worker Dashboard (offline-first, Dexie/IndexedDB)
 *   /doctor → Doctor Dashboard (realtime, Supabase)
 *
 * AppNav sits above both dashboards for role switching.
 * Each dashboard has its own self-contained header.
 */
export function App() {
  return (
    <Router>
      {/* Top-level role switcher – always visible */}
      <AppNav />

      <Routes>
        {/* Default: redirect to ASHA dashboard */}
        <Route path="/" element={<Navigate to="/asha" replace />} />

        {/* ASHA Worker Dashboard */}
        <Route path="/asha" element={<AshaDashboard />} />

        {/* Doctor Dashboard */}
        <Route path="/doctor" element={<DoctorDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
