import axios from 'axios';

// Dynamically determine the host IP from the browser's address bar
const API_HOST = window.location.hostname;

const api = axios.create({
  baseURL: `http://${API_HOST}:8081/api/v1`,
});

// Add a request interceptor to inject the JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add a response interceptor to handle 401 and 403 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.removeItem('token');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export const login = (email, password) => api.post('/auth/login', { email, password });

export const getSummary = (cctvId) => api.get('/dashboard/summary', { params: { cctvId } });

export const getTrend = (cctvId, interval, startTime, endTime) =>
  api.get('/dashboard/trend', {
    params: {
      cctvId,
      interval,
      ...(startTime && { startTime }),
      ...(endTime && { endTime }),
    },
  });

export const getOccupancy = () => api.get('/dashboard/occupancy');

export const getCameras = () => axios.get(`http://${API_HOST}:8000/config`);
export const updateCameras = (configData) => axios.post(`http://${API_HOST}:8000/config`, configData);
export const connectDvr = (dvrData) => axios.post(`http://${API_HOST}:8000/dvr/connect`, dvrData);

// User Management
export const getUsers = () => api.get('/users');
export const createUser = (email, password, role) => api.post('/users', { email, password, role });
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const changePassword = (id, newPassword) => api.put(`/users/${id}/password`, { newPassword });