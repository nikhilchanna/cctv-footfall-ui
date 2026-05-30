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
      if (!err.response) {
        setError(
          `Cannot reach API at port 8081 (${err.message || 'network error'}). Is the Java server running?`
        );
      } else if (err.response.status === 401) {
        setError(
          'Invalid email or password. Users must exist in the server DB with a BCrypt password — register once via POST /api/v1/auth/register or use the default seed account after a fresh DB.'
        );
      } else if (!err.response?.data?.token) {
        setError(err.response?.data?.message || err.response?.data || `Login failed (${err.response?.status})`);
      } else {
        setError('Login failed — unexpected response from server');
      }
    }
  };

  return (
    <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 className="header-title" style={{ fontSize: '1.8rem', textAlign: 'center', marginBottom: '20px' }}>Sign In</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '16px' }}>
          First time on an empty DB: <strong>admin@footfall.local</strong> / <strong>admin123</strong> (after server restart), or register via <code>/api/v1/auth/register</code>.
        </p>
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
