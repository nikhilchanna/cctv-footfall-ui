import React, { useState, useEffect, useRef } from 'react';
import { getCameras, updateCameras, connectDvr, getDvrSession, startDvrPreview, stopDvrPreview, getProcessorStatus } from '../services/api';
import LineDrawViewer from '../components/LineDrawViewer';
import { buildMergedConfig } from '../utils/cameraConfig';

const API_HOST = window.location.hostname;
const DVR_SESSION_KEY = 'dvr_session';

const DvrConfiguration = ({ onBack, onConfigured }) => {
  // Connection details
  const [dvrIp, setDvrIp] = useState('demo');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');

  // Custom Direct RTSP URL support
  const [useCustomUrl, setUseCustomUrl] = useState(false);
  const [customUrl, setCustomUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentConfig, setCurrentConfig] = useState(null);

  // Setup state
  const [step, setStep] = useState(1); // 1: Credentials, 1.5: Channel Select, 2: Draw Line, 3: Live Preview
  const [discoveredCameras, setDiscoveredCameras] = useState([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);

  const [cameraId, setCameraId] = useState('demo');
  const [cameraName, setCameraName] = useState('Demo Camera');
  const [snapshotUrl, setSnapshotUrl] = useState('');
  const [useLegacySnapshot, setUseLegacySnapshot] = useState(false);

  // Line coords (natural resolution)
  const [lineCoords, setLineCoords] = useState({ x1: 50, y1: 200, x2: 590, y2: 200 });
  const [sessionRestored, setSessionRestored] = useState(false);
  const [processorStatus, setProcessorStatus] = useState(null);
  const lineDrawRef = useRef(null);

  const stopPreview = async () => {
    if (!useLegacySnapshot) {
      try {
        await stopDvrPreview();
      } catch (e) {
        console.warn('Failed to stop DVR preview', e);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopDvrPreview().catch(() => {});
    };
  }, []);

  const persistDvrSession = (ip, user, pass, cameras) => {
    try {
      localStorage.setItem(
        DVR_SESSION_KEY,
        JSON.stringify({ ip, username: user, password: pass, cameras })
      );
    } catch (e) {
      console.warn('Failed to persist DVR session', e);
    }
  };

  const applyDvrSession = (session, storedPassword) => {
    if (!session?.connected || !session.cameras?.length) {
      return false;
    }
    setDvrIp(session.ip || 'demo');
    setUsername(session.username || 'admin');
    if (storedPassword) {
      setPassword(storedPassword);
    }
    setDiscoveredCameras(session.cameras);
    setStep(1.5);
    return true;
  };

  // Load camera config + restore DVR login session on mount
  useEffect(() => {
    const init = async () => {
      try {
        const res = await getCameras();
        if (res.data?.config_data) {
          setCurrentConfig(res.data.config_data);
          const cameras = res.data.config_data.cameras || [];
          if (cameras.length > 0) {
            const cam = cameras[0];
            setCameraId(cam.id);
            setCameraName(cam.name);
            if (cam.line_coords) {
              setLineCoords(cam.line_coords);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load camera configuration:', err);
      }

      let stored = null;
      try {
        stored = JSON.parse(localStorage.getItem(DVR_SESSION_KEY) || 'null');
      } catch (e) {
        stored = null;
      }

      try {
        const sessionRes = await getDvrSession();
        const session = sessionRes.data;
        if (applyDvrSession(session, stored?.password)) {
          setSessionRestored(true);
          return;
        }
      } catch (err) {
        console.warn('DVR session check failed', err);
      }

      if (stored?.ip && stored?.username && stored?.password) {
        try {
          const res = await connectDvr({
            ip: stored.ip,
            username: stored.username,
            password: stored.password,
          });
          if (res.data?.success) {
            setDvrIp(stored.ip);
            setUsername(stored.username);
            setPassword(stored.password);
            setDiscoveredCameras(res.data.cameras);
            persistDvrSession(stored.ip, stored.username, stored.password, res.data.cameras);
            setStep(1.5);
            setSessionRestored(true);
          }
        } catch (err) {
          console.warn('DVR session restore failed', err);
        }
      }
    };
    init();
  }, []);

  // Handle Connect / Load Channels
  const handleConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (useCustomUrl) {
      setCameraId('custom');
      setCameraName(cameraName || 'Custom Camera');
      setUseLegacySnapshot(true);

      try {
        const newCam = {
          id: 'custom',
          name: cameraName || 'Custom Camera',
          rtsp_url: customUrl,
          source_type: 'rtsp',
          line_coords: lineCoords,
          window_size: 10,
        };
        const updatedConfig = buildMergedConfig(currentConfig, [newCam], undefined);

        await updateCameras(updatedConfig);
        setCurrentConfig(updatedConfig.config_data);
        setSuccessMsg('Initializing custom RTSP stream...');

        setTimeout(() => {
          setSnapshotUrl(`http://${API_HOST}:8000/media/snapshots/snapshot_custom.jpg?t=${Date.now()}`);
          setStep(2); // Go straight to Draw Line step
          setLoading(false);
          setSuccessMsg('');
        }, 2500);
      } catch (err) {
        setErrorMsg(err.message || 'Failed to initialize custom RTSP stream');
        setLoading(false);
      }
      return;
    }

    try {
      const res = await connectDvr({
        ip: dvrIp,
        username: username,
        password: password
      });

      if (res.data && res.data.success) {
        setDiscoveredCameras(res.data.cameras);
        persistDvrSession(dvrIp, username, password, res.data.cameras);
        setSuccessMsg(`Authenticated successfully! Auto-discovered ${res.data.cameras.length} camera channels.`);
        setSelectedCameraIndex(0);
        setTimeout(() => {
          setStep(1.5); // Go to Channel Select step
          setLoading(false);
          setSuccessMsg('');
        }, 1500);
      } else {
        setErrorMsg(res.data.detail || 'Failed to authenticate with Hikvision DVR. Check network / credentials.');
        setLoading(false);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to connect to DVR');
      setLoading(false);
    }
  };

  // Handle Camera Select — ISAPI preview only (no RTSP processor until line is saved)
  const handleSelectCamera = () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const cam = discoveredCameras[selectedCameraIndex];
    setCameraId(cam.channel_id);
    setCameraName(cam.camera_name);
    setUseLegacySnapshot(false);
    setStep(2);
    setLoading(false);
  };

  // Ensure backend preview is running when draw-line step is shown
  useEffect(() => {
    if (step !== 2 || useLegacySnapshot || !cameraId) return undefined;

    let cancelled = false;
    (async () => {
      try {
        await stopDvrPreview();
        if (!cancelled) {
          await startDvrPreview(cameraId);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to start preview for line drawing', err);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (!useLegacySnapshot) {
        stopDvrPreview().catch(() => {});
      }
    };
  }, [step, cameraId, useLegacySnapshot]);

  useEffect(() => {
    if (step !== 3 || !cameraId) return undefined;

    let cancelled = false;
    const pollStatus = async () => {
      try {
        const res = await getProcessorStatus(cameraId);
        if (!cancelled) {
          setProcessorStatus(res.data);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to load processor status', err);
        }
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [step, cameraId]);

  // Save the drawn line and start live stream
  const handleSaveLine = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await stopPreview();

      const cam = useCustomUrl 
        ? { rtsp: customUrl, channel_id: 'custom', camera_name: cameraName }
        : discoveredCameras[selectedCameraIndex] || { rtsp: 'demo', channel_id: cameraId, camera_name: cameraName };
      
      const coords = lineDrawRef.current?.getLineCoords() || lineCoords;
      const channelId = cam.channel_id || cameraId;
      const subChannelId = channelId.endsWith('01')
        ? `${channelId.slice(0, -2)}02`
        : channelId;

      const newCam = {
        id: channelId,
        name: cam.camera_name || cameraName,
        source_type: useCustomUrl ? 'rtsp' : (dvrIp === 'demo' ? 'demo' : 'isapi'),
        channel_id: subChannelId,
        channel: cam.channel || Math.floor(parseInt(channelId, 10) / 100) || 1,
        stream_type: 2,
        poll_fps: 7,
        rtsp_url: cam.rtsp,
        line_coords: coords,
        window_size: 10,
      };

      const dvrBlock =
        useCustomUrl || dvrIp === 'demo'
          ? undefined
          : { ip: dvrIp, username, password };

      const finalConfig = buildMergedConfig(currentConfig, [newCam], dvrBlock);

      await updateCameras(finalConfig);
      setCurrentConfig(finalConfig.config_data);
      setSuccessMsg('Line configuration saved and active!');
      setTimeout(() => {
        setLoading(false);
        if (onConfigured) {
          onConfigured(channelId);
        } else {
          setStep(3);
        }
      }, 800);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save configuration');
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: '1280px' }}>
      <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 className="header-title" style={{ fontSize: '2.2rem' }}>DVR HMI Portal</h1>
          <p className="header-subtitle" style={{ color: 'var(--text-secondary)' }}>Automated DVR Channel Discovery & Interactive Line Setup</p>
        </div>
        <button 
          onClick={onBack}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', transition: '0.3s' }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
        >
          &larr; Back to Dashboard
        </button>
      </header>

      {/* Progress Indicators */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '30px', flexWrap: 'wrap' }}>
        <div style={{ padding: '8px 16px', borderRadius: '20px', background: step === 1 ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)', color: step === 1 ? 'white' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', transition: '0.3s' }}>
          1. Connect DVR
        </div>
        <div style={{ padding: '8px 16px', borderRadius: '20px', background: step === 1.5 ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)', color: step === 1.5 ? 'white' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', transition: '0.3s' }}>
          2. Discovered Channels
        </div>
        <div style={{ padding: '8px 16px', borderRadius: '20px', background: step === 2 ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)', color: step === 2 ? 'white' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', transition: '0.3s' }}>
          3. Draw Virtual Line
        </div>
        <div style={{ padding: '8px 16px', borderRadius: '20px', background: step === 3 ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)', color: step === 3 ? 'white' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', transition: '0.3s' }}>
          4. Live AI Analytics
        </div>
      </div>

      {sessionRestored && step === 1.5 && (
        <div className="glass-panel" style={{ color: '#a7f3d0', border: '1px solid var(--accent-green)', background: 'rgba(16,185,129,0.1)', marginBottom: '20px', padding: '12px' }}>
          ✓ DVR session restored — no re-login required.
        </div>
      )}

      {errorMsg && (
        <div className="glass-panel" style={{ color: '#fca5a5', border: '1px solid var(--accent-red)', background: 'rgba(239,68,68,0.1)', marginBottom: '20px', padding: '12px' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="glass-panel" style={{ color: '#a7f3d0', border: '1px solid var(--accent-green)', background: 'rgba(16,185,129,0.1)', marginBottom: '20px', padding: '12px' }}>
          ✓ {successMsg}
        </div>
      )}

      {/* Step 1: DVR Credentials / Direct URL Form */}
      {step === 1 && (
        <div className="glass-panel" style={{ animation: 'fadeIn 0.5s ease' }}>
          {discoveredCameras.length > 0 && (
            <div style={{
              marginBottom: '20px',
              padding: '14px 16px',
              borderRadius: '10px',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid var(--accent-green)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ color: 'var(--accent-green)', fontWeight: 600, marginBottom: '4px' }}>
                  DVR session active ({dvrIp})
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {discoveredCameras.length} channel(s) available — continue without signing in again.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(1.5)}
                style={{ background: 'var(--accent-green)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Continue to Channels &rarr;
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', flex: 1 }}>DVR Connection Settings</h2>
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              <button
                type="button"
                onClick={() => setUseCustomUrl(false)}
                style={{
                  background: !useCustomUrl ? 'var(--accent-blue)' : 'transparent',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  transition: '0.3s'
                }}
              >
                Auto-Discover
              </button>
              <button
                type="button"
                onClick={() => setUseCustomUrl(true)}
                style={{
                  background: useCustomUrl ? 'var(--accent-blue)' : 'transparent',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  transition: '0.3s'
                }}
              >
                Direct RTSP Link
              </button>
            </div>
          </div>

          <form onSubmit={handleConnect} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
            {useCustomUrl ? (
              <>
                <div className="control-group">
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Camera Name/Location</label>
                  <input 
                    type="text" 
                    value={cameraName} 
                    onChange={(e) => setCameraName(e.target.value)} 
                    required 
                    placeholder="e.g. Front Gate Camera"
                  />
                </div>
                <div className="control-group">
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Direct RTSP Stream URL</label>
                  <input 
                    type="text" 
                    value={customUrl} 
                    onChange={(e) => setCustomUrl(e.target.value)} 
                    required 
                    placeholder="e.g. rtsp://username:password@ip:port/Streaming/tracks/102"
                  />
                  <small style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Paste your exact DVR stream URL directly here.</small>
                </div>
              </>
            ) : (
              <>
                <div className="control-group">
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>DVR IP or Host Address</label>
                  <input 
                    type="text" 
                    value={dvrIp} 
                    onChange={(e) => setDvrIp(e.target.value)} 
                    required 
                    placeholder="e.g. 192.168.1.34 or 'demo'"
                  />
                  <small style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Type <strong>demo</strong> to load simulated POC video.</small>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div className="control-group">
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>DVR Username</label>
                    <input 
                      type="text" 
                      value={username} 
                      disabled={dvrIp === 'demo'} 
                      onChange={(e) => setUsername(e.target.value)} 
                      required 
                    />
                  </div>

                  <div className="control-group">
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>DVR Password</label>
                    <input 
                      type="password" 
                      value={password} 
                      disabled={dvrIp === 'demo'} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                    />
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button 
                type="submit" 
                disabled={loading}
                style={{ background: 'var(--accent-blue)', color: 'white', border: 'none', padding: '12px 28px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: '0.3s' }}
              >
                {loading ? 'Processing...' : (useCustomUrl ? 'Connect & Load Stream' : 'Connect & Scan DVR')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 1.5: Discovered Camera Grid */}
      {step === 1.5 && (
        <div className="glass-panel" style={{ animation: 'fadeIn 0.5s ease' }}>
          <h2 style={{ marginTop: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', fontSize: '1.4rem' }}>Discovered Camera Channels</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
            DVR authenticated successfully! Select the camera channel you wish to configure for AI footfall analytics:
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px', marginBottom: '25px' }}>
            {discoveredCameras.map((cam, idx) => (
              <div 
                key={idx}
                onClick={() => setSelectedCameraIndex(idx)}
                style={{ 
                  padding: '16px', 
                  borderRadius: '12px', 
                  background: selectedCameraIndex === idx ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                  border: selectedCameraIndex === idx ? '2px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                  cursor: 'pointer',
                  transition: '0.2s',
                  textAlign: 'center',
                  boxShadow: selectedCameraIndex === idx ? '0 0 10px rgba(59,130,246,0.3)' : 'none'
                }}
                onMouseEnter={(e) => { if (selectedCameraIndex !== idx) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)' }}
                onMouseLeave={(e) => { if (selectedCameraIndex !== idx) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)' }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎥</div>
                <div style={{ fontWeight: 600, color: 'white' }}>{cam.camera_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Channel: {cam.channel_id}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button 
              onClick={() => setStep(1)}
              style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'white', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}
            >
              Back to Form
            </button>
            <button 
              onClick={handleSelectCamera}
              disabled={loading}
              style={{ background: 'var(--accent-blue)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              {loading ? 'Initializing Stream Frame...' : 'Proceed to Draw Line &rarr;'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Draw Line Canvas */}
      {step === 2 && (
        <div className="glass-panel" style={{ animation: 'fadeIn 0.5s ease', textAlign: 'center' }}>
          <h2 style={{ marginTop: 0, textAlign: 'left', fontSize: '1.4rem' }}>Draw Virtual Footfall Line</h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'left', fontSize: '0.9rem', marginBottom: '20px' }}>
            Click and drag directly on the frame snapshot below to draw the line where people are counted entering or exiting. 
          </p>

          <LineDrawViewer
            key={cameraId}
            ref={lineDrawRef}
            channelId={cameraId}
            snapshotUrl={snapshotUrl}
            useLegacySnapshot={useLegacySnapshot}
            initialLineCoords={lineCoords}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
            <button 
              onClick={() => setStep(1.5)}
              style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'white', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}
            >
              Back to Channels
            </button>
            
            <button 
              onClick={handleSaveLine}
              disabled={loading}
              style={{ background: 'var(--accent-green)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              {loading ? 'Saving...' : 'Apply Line & Start AI Stream'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Real-time Live Stream */}
      {step === 3 && (
        <div className="glass-panel" style={{ animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Live AI Processing Feed ({cameraName})</h2>
            <div style={{ background: 'rgba(16,185,129,0.2)', color: 'var(--accent-green)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
              ● ISAPI SNAPSHOT ANALYTICS
            </div>
          </div>
          
          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--glass-border)', background: '#000', marginBottom: '20px', position: 'relative', minHeight: '480px', maxHeight: '75vh', aspectRatio: '16/9' }}>
            <img 
              src={`http://${API_HOST}:8000/stream/${cameraId}?t=${Date.now()}`}
              alt="CCTV AI Processing Live Stream" 
              style={{ width: '100%', height: '100%', minHeight: '480px', objectFit: 'contain' }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div style="color:var(--text-secondary);display:flex;align-items:center;justify-content:center;height:100%;">AI stream loading/disconnected. Make sure Python service is running.</div>';
              }}
            />
          </div>

          {processorStatus && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginBottom: '20px',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              background: 'rgba(255,255,255,0.03)'
            }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Source</div>
                <div style={{ fontWeight: 600 }}>{processorStatus.source_type || '—'} @ {processorStatus.stream_fps ?? 7} FPS</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Frames this minute</div>
                <div style={{ fontWeight: 600 }}>{processorStatus.frames_this_minute ?? 0}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Peak people (current min)</div>
                <div style={{ fontWeight: 600 }}>{processorStatus.current_peak_people ?? 0}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Window IN / OUT</div>
                <div style={{ fontWeight: 600 }}>{processorStatus.window_in ?? 0} / {processorStatus.window_out ?? 0}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Snapshot latency</div>
                <div style={{ fontWeight: 600 }}>{processorStatus.last_snapshot_latency_ms ?? 0} ms</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Poll failures</div>
                <div style={{ fontWeight: 600, color: (processorStatus.consecutive_failures || 0) > 0 ? '#fca5a5' : 'inherit' }}>
                  {processorStatus.consecutive_failures ?? 0}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Watermark</div>
                <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  {processorStatus.cursor?.last_processed_at
                    ? new Date(processorStatus.cursor.last_processed_at).toLocaleTimeString()
                    : '—'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Mode</div>
                <div style={{ fontWeight: 600 }}>{processorStatus.cursor?.mode || 'live'}</div>
              </div>
              {processorStatus.last_saved_peak && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {processorStatus.last_saved_peak.image_path && (
                    <img
                      src={`http://${API_HOST}:8000/media/${processorStatus.last_saved_peak.image_path}?t=${Date.now()}`}
                      alt="Last minute peak"
                      style={{ width: '96px', height: '54px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--glass-border)' }}
                    />
                  )}
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Last saved minute peak</div>
                    <div style={{ fontWeight: 600 }}>
                      {processorStatus.last_saved_peak.people_count} people
                      {' · '}
                      {processorStatus.last_saved_peak.minute_bucket
                        ? new Date(processorStatus.last_saved_peak.minute_bucket).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button 
              onClick={() => setStep(2)}
              style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'white', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}
            >
              &larr; Redraw Line
            </button>

            <button 
              onClick={onBack}
              style={{ background: 'var(--accent-blue)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              Close & View Analytics
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DvrConfiguration;
