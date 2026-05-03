import React, { useState } from 'react';
import { login } from '../services/api';

const Login = ({ setToken }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await login(email, password);
      const token = response.data.token;
      localStorage.setItem('token', token);
      setToken(token);
    } catch (err) {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 className="header-title" style={{ fontSize: '1.8rem', textAlign: 'center', marginBottom: '20px' }}>Sign In</h2>
        {error && <div style={{ color: '#ef4444', marginBottom: '15px', textAlign: 'center' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>EMAIL</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ marginTop: '5px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>PASSWORD</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ marginTop: '5px' }}
            />
          </div>
          <button 
            type="submit" 
            style={{ 
              marginTop: '10px', 
              padding: '12px', 
              backgroundColor: 'var(--accent-blue)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '1rem'
            }}
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
