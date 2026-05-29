import React, { useState, useEffect } from 'react';
import './App.css';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import UserManagement from './pages/UserManagement';
import DvrConfiguration from './pages/DvrConfiguration';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [view, setView] = useState('dashboard'); // 'dashboard', 'users', or 'dvr'

  if (!token) {
    return (
      <div className="App">
        <Login setToken={setToken} />
      </div>
    );
  }

  const getRoleFromToken = (t) => {
    try {
      const payload = JSON.parse(atob(t.split('.')[1]));
      return payload.role;
    } catch (e) {
      return null;
    }
  };

  const role = token ? getRoleFromToken(token) : null;
  const isAdmin = role === 'ROLE_ADMIN' || role === 'ADMIN';

  if (view === 'users' && isAdmin) {
    return (
      <div className="App">
        <UserManagement onBack={() => setView('dashboard')} />
      </div>
    );
  }

  if (view === 'dvr') {
    return (
      <div className="App">
        <DvrConfiguration onBack={() => setView('dashboard')} />
      </div>
    );
  }

  return (
    <div className="App">
      <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button 
          onClick={() => setView('dvr')}
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'white', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', transition: '0.3s' }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.target.style.background = 'var(--glass-bg)'}
        >
          DVR Portal
        </button>
        {isAdmin && (
          <button 
            onClick={() => setView('users')}
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'white', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', transition: '0.3s' }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.target.style.background = 'var(--glass-bg)'}
          >
            Manage Users
          </button>
        )}
        <button 
          onClick={() => { localStorage.removeItem('token'); setToken(null); }}
          style={{ background: 'transparent', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', transition: '0.3s' }}
          onMouseEnter={(e) => { e.target.style.background = 'rgba(239,68,68,0.1)' }}
          onMouseLeave={(e) => { e.target.style.background = 'transparent' }}
        >
          Logout
        </button>
      </div>
      <Dashboard />
    </div>
  );
}

export default App;
