import React, { useState, useEffect } from 'react';
import { getUsers, createUser, deleteUser, changePassword } from '../services/api';

const UserManagement = ({ onBack }) => {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  
  const [changePwdId, setChangePwdId] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const loadUsers = async () => {
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch (e) {
      setError('Fail load users. Admin only.');
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createUser(email, password, role);
      setMsg('User created');
      setEmail('');
      setPassword('');
      loadUsers();
    } catch (e) {
      setError('Fail create user');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteUser(id);
      setMsg('User deleted');
      loadUsers();
    } catch (e) {
      setError('Fail delete');
    }
  };

  const handleChangePassword = async (id) => {
    try {
      await changePassword(id, newPassword);
      setMsg('Password changed');
      setChangePwdId(null);
      setNewPassword('');
    } catch (e) {
      setError('Fail change password');
    }
  };

  return (
    <div className="dashboard-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 className="header-title">User Management</h1>
        <button onClick={onBack} style={{ background: 'var(--glass-bg)', color: 'white', border: '1px solid var(--glass-border)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Back to Dashboard</button>
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: '10px' }}>{error}</div>}
      {msg && <div style={{ color: '#10b981', marginBottom: '10px' }}>{msg}</div>}

      <div className="glass-panel" style={{ marginBottom: '30px' }}>
        <h3>Add User</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>EMAIL</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PASSWORD</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ROLE</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <button type="submit" style={{ padding: '10px 20px', background: 'var(--accent-blue)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Add</button>
        </form>
      </div>

      <div className="glass-panel">
        <h3>User List</h3>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <th style={{ padding: '10px' }}>Email</th>
              <th style={{ padding: '10px' }}>Role</th>
              <th style={{ padding: '10px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <td style={{ padding: '10px' }}>{u.email}</td>
                <td style={{ padding: '10px' }}>{u.role}</td>
                <td style={{ padding: '10px' }}>
                  {changePwdId === u.id ? (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                      <button onClick={() => handleChangePassword(u.id)} style={{ background: 'var(--accent-green)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setChangePwdId(null)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => setChangePwdId(u.id)} style={{ background: 'var(--accent-blue)', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Change Pwd</button>
                      <button onClick={() => handleDelete(u.id)} style={{ background: 'var(--accent-red)', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
