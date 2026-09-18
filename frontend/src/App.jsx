import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import AshaDashboard from './pages/AshaDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <header className="header">
          <h1>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            Project Lakshya Core
          </h1>
          <nav style={{ display: 'flex', gap: '1rem' }}>
            <Link to="/asha" className="btn btn-warning">ASHA Node (PHC)</Link>
            <Link to="/doctor" className="btn btn-success">Doctor Node (Urban Gateway)</Link>
          </nav>
          <div className="header-status">
            <span className="status-dot online"></span>
            System Online | Secure Link Active
          </div>
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/asha" element={<AshaDashboard />} />
            <Route path="/doctor" element={<DoctorDashboard />} />
            <Route path="/" element={<AshaDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
