import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
});

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

export const getCameras = () => axios.get('http://localhost:8000/config');