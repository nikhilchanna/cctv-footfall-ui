import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
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

export const getCameras = () => axios.get('/edge-api/config');
export const updateCameras = (configData) => axios.post('/edge-api/config', configData);
export const connectDvr = (dvrData) => axios.post('/edge-api/dvr/connect', dvrData);

export const getDvrSession = () => axios.get('/edge-api/dvr/session');

export const startDvrPreview = (channelId) =>
  axios.post('/edge-api/dvr/preview/start', { channel_id: channelId });

export const stopDvrPreview = () =>
  axios.post('/edge-api/dvr/preview/stop');

export const getProcessorStatus = (cctvId) =>
  axios.get(`/edge-api/processor/${cctvId}/status`);

export const getMinutePeaks = (cctvId, limit = 15) =>
  axios.get(`/edge-api/processor/${cctvId}/minute-peaks`, { params: { limit } });

export const getCamerasStatus = () =>
  axios.get('/edge-api/cameras/status');

export const getProcessorThumbnailUrl = (cctvId) =>
  `/edge-api/processor/${cctvId}/thumbnail`;

export const getServerPeakImages = (cctvId, limit = 15) =>
  api.get('/peak-images', { params: { cctvId, limit } });

export const getServerPeakImageUrl = (relativePath) =>
  `/api/v1/peak-images/file?path=${encodeURIComponent(relativePath)}`;

// User Management
export const getUsers = () => api.get('/users');
export const createUser = (email, password, role) => api.post('/users', { email, password, role });
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const changePassword = (id, newPassword) => api.put(`/users/${id}/password`, { newPassword });