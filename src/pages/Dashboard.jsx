import React, { useState, useEffect, useCallback } from 'react';
import { getSummary, getTrend, getCameras } from '../services/api';
import Controls from '../components/Controls';
import SummaryCards from '../components/SummaryCards';
import TrendChart from '../components/TrendChart';

const getSevenDaysAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const getNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const Dashboard = () => {
  const [summary, setSummary] = useState({});
  const [trendData, setTrendData] = useState([]);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [cctvId, setCctvId] = useState('');
  const [interval, setIntervalValue] = useState('1h');

  // Default start time is 7 days ago
  const [startTime, setStartTime] = useState(getSevenDaysAgo());
  const [endTime, setEndTime] = useState(getNow());
  const [error, setError] = useState('');

  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const summaryRes = await getSummary(cctvId);
      setSummary(summaryRes.data);

      if (!cctvId) {
        setLoading(false);
        return; // Don't fetch if no camera is selected
      }

      const trendRes = await getTrend(
        cctvId,
        interval,
        startTime ? startTime + ':00' : undefined,
        endTime ? endTime + ':00' : undefined
      );

      setTrendData(trendRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error?.message || 'Failed to fetch dashboard data');
      setTrendData([]);
    } finally {
      setLoading(false);
    }
  }, [cctvId, interval, startTime, endTime]);

  useEffect(() => {
    fetchData();
    const id = window.setInterval(fetchData, 30000);
    return () => window.clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const res = await getCameras();
        if (res.data && res.data.config_data && res.data.config_data.cameras) {
          const camIds = res.data.config_data.cameras.map(c => c.id);
          setAvailableCameras(camIds);
          if (camIds.length > 0 && !camIds.includes(cctvId)) {
            setCctvId(camIds[0]);
          }
        }
      } catch (e) {
        console.error('Failed to fetch cameras', e);
      }
    };
    fetchCameras();
  }, []);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      <header style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(to right, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Surveillance Analytics
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Real-time dashboard for foot traffic and occupancy</p>
      </header>

      <Controls
        cctvId={cctvId}
        setCctvId={setCctvId}
        availableCameras={availableCameras}
        interval={interval}
        setInterval={setIntervalValue}
        startTime={startTime}
        setStartTime={setStartTime}
        endTime={endTime}
        setEndTime={setEndTime}
      />

      <SummaryCards
        totalCtrIn={summary?.totalCtrIn}
        totalCtrOut={summary?.totalCtrOut}
        currentOccupancy={summary?.currentOccupancy}
        loading={loading}
      />

      {error && (
        <div className="glass-panel" style={{ color: '#fca5a5', textAlign: 'center', border: '1px solid #ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
          {error}
        </div>
      )}

      <TrendChart data={trendData} loading={loading} />
    </div>
  );
};

export default Dashboard;