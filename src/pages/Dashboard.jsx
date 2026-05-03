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
  const [cctvId, setCctvId] = useState('ALL');

  // Default start time is 7 days ago
  const [startTime, setStartTime] = useState(getSevenDaysAgo());
  const [endTime, setEndTime] = useState(getNow());
  const [error, setError] = useState('');

  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      if (!cctvId) {
        setLoading(false);
        return;
      }

      let summaryResData = { totalCtrIn: 0, totalCtrOut: 0, currentOccupancy: 0 };
      let combinedTrendData = {};

      const camerasToFetch = cctvId === 'ALL' ? availableCameras.map(c => c.id) : [cctvId];

      if (camerasToFetch.length === 0) {
        setLoading(false);
        return;
      }

      const summaryPromises = camerasToFetch.map(cam => getSummary(cam));
      const trendPromises = camerasToFetch.map(cam => getTrend(
        cam, '5m', startTime ? startTime + ':00' : undefined, endTime ? endTime + ':00' : undefined
      ));

      const summaries = await Promise.all(summaryPromises);
      summaries.forEach(res => {
        summaryResData.totalCtrIn += res.data.totalCtrIn || 0;
        summaryResData.totalCtrOut += res.data.totalCtrOut || 0;
        summaryResData.currentOccupancy += res.data.currentOccupancy || 0;
      });

      const trends = await Promise.all(trendPromises);
      trends.forEach(res => {
        res.data.forEach(item => {
          const time = item.bucketTime;
          if (!combinedTrendData[time]) {
            combinedTrendData[time] = { bucketTime: time, ctrIn: 0, ctrOut: 0 };
          }
          combinedTrendData[time].ctrIn += item.ctrIn;
          combinedTrendData[time].ctrOut += item.ctrOut;
        });
      });

      setSummary(summaryResData);
      setTrendData(Object.values(combinedTrendData));
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error?.message || 'Failed to fetch dashboard data');
      setTrendData([]);
    } finally {
      setLoading(false);
    }
  }, [cctvId, availableCameras, startTime, endTime]);

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
          const cams = res.data.config_data.cameras;
          setAvailableCameras(cams);
          // Only auto-select if no cctvId is set and there are cameras
          if (cams.length > 0 && !cctvId) {
            setCctvId('ALL');
          }
        }
      } catch (e) {
        console.error('Failed to fetch cameras', e);
      }
    };
    fetchCameras();
  }, []);

  const renderVideoFeed = (className) => {
    if (cctvId === 'ALL' || cctvId === '') return null;
    return (
      <div className={className} style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border)', background: '#000', width: '100%', maxWidth: '200px', aspectRatio: '16/9' }}>
        {(() => {
          const cam = availableCameras.find(c => c.id === cctvId);
          if (!cam || !cam.rtsp_url) return <div style={{ color:'var(--text-secondary)', display:'flex', alignItems:'center', justifyContent:'center', height:'100%', fontSize:'0.8rem' }}>No Feed Configured</div>;
          
          let videoUrl = cam.rtsp_url;
          if (videoUrl.includes(':\\') || videoUrl.includes(':/') || videoUrl.startsWith('/')) {
            // Absolute local file path (Windows or Linux)
            videoUrl = `http://${window.location.hostname}:8000/stream_video?path=${encodeURIComponent(videoUrl)}`;
          } else if (!videoUrl.startsWith('http') && !videoUrl.startsWith('rtsp')) {
            // Relative path in edge folder
            videoUrl = `http://${window.location.hostname}:8000/media/${videoUrl}`;
          }
          
          return (
            <video 
              src={videoUrl} 
              autoPlay 
              loop 
              muted 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div style="color:var(--text-secondary);display:flex;align-items:center;justify-content:center;height:100%;font-size:0.8rem;">Feed Unavailable</div>';
              }}
            />
          );
        })()}
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="header-title">Footfall Analytics</h1>
          <p className="header-subtitle">Real-time CCTV Edge Processing Dashboard</p>
        </div>
        
        {renderVideoFeed("desktop-video")}
      </header>

      <Controls
        cctvId={cctvId}
        setCctvId={setCctvId}
        availableCameras={availableCameras}
        startTime={startTime}
        setStartTime={setStartTime}
        endTime={endTime}
        setEndTime={setEndTime}
      />

      {renderVideoFeed("mobile-video")}

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