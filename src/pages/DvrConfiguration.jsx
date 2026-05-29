import React, { useState, useEffect, useRef } from 'react';
import { getCameras, updateCameras } from '../services/api';

const API_HOST = window.location.hostname;

const DvrConfiguration = ({ onBack }) => {
  // Connection details
  const [dvrIp, setDvrIp] = useState('demo');
  const [port, setPort] = useState('8000');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [cameraName, setCameraName] = useState('POC Entrance Camera');
  const [cameraId, setCameraId] = useState('demo');
  const [channel, setChannel] = useState('1');

  // Custom RTSP URL support
  const [useCustomRtsp, setUseCustomRtsp] = useState(false);
  const [customRtspUrl, setCustomRtspUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentConfig, setCurrentConfig] = useState(null);

  // Setup state
  const [step, setStep] = useState(1); // 1: Connect, 2: Draw Line, 3: Live Preview
  const [snapshotUrl, setSnapshotUrl] = useState('');
  
  // Line coords (natural resolution)
  const [lineCoords, setLineCoords] = useState({ x1: 50, y1: 200, x2: 590, y2: 200 });

  // Canvas refs and drawing state
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Load current config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await getCameras();
        if (res.data && res.data.config_data) {
          setCurrentConfig(res.data.config_data);
          const cameras = res.data.config_data.cameras || [];
          if (cameras.length > 0) {
            const cam = cameras[0];
            setCameraId(cam.id);
            setCameraName(cam.name);
            if (cam.rtsp_url && cam.rtsp_url !== 'demo') {
              if (cam.rtsp_url.includes('/Streaming/Channels/') || !cam.rtsp_url.includes('/h264/ch')) {
                setUseCustomRtsp(true);
                setCustomRtspUrl(cam.rtsp_url);
              }
              setDvrIp(cam.rtsp_url.split('/')[2]?.split(':')[0] || 'demo');
            }
            if (cam.line_coords) {
              setLineCoords(cam.line_coords);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load camera configuration:", err);
      }
    };
    fetchConfig();
  }, []);

  // Handle Connect / Load Frame
  const handleConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Formulate the RTSP stream URL
      let rtspUrl = 'demo';
      if (dvrIp !== 'demo') {
        rtspUrl = useCustomRtsp ? customRtspUrl : `rtsp://${username}:${password}@${dvrIp}:${port}/h264/ch${channel}/main`;
      }

      // Save initial config to trigger CCTVProcessor start and snapshot creation
      const updatedConfig = {
        config_data: {
          cameras: [
            {
              id: cameraId,
              name: cameraName,
              rtsp_url: rtspUrl,
              line_coords: lineCoords,
              window_size: 10
            }
          ]
        }
      };

      await updateCameras(updatedConfig);
      setCurrentConfig(updatedConfig.config_data);

      // Give the backend a brief moment to start the processor and save snapshot
      setTimeout(() => {
        setSnapshotUrl(`http://${API_HOST}:8000/media/snapshots/snapshot_${cameraId}.jpg?t=${Date.now()}`);
        setStep(2); // Go to Draw Line step
        setLoading(false);
      }, 2500);

    } catch (err) {
      setErrorMsg(err.message || 'Failed to connect to DVR');
      setLoading(false);
    }
  };

  // Draw the image and the line on canvas
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    
    // Clear and draw snapshot
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw the counting line (Neon Blue)
    ctx.beginPath();
    ctx.moveTo(lineCoords.x1, lineCoords.y1);
    ctx.lineTo(lineCoords.x2, lineCoords.y2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#00E5FF';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00E5FF';
    ctx.stroke();

    // Draw endpoint handles
    ctx.beginPath();
    ctx.arc(lineCoords.x1, lineCoords.y1, 8, 0, 2 * Math.PI);
    ctx.arc(lineCoords.x2, lineCoords.y2, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#ff0055';
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#ff0055';
    ctx.fill();
  };

  // Redraw when snapshot loads or coordinates change
  useEffect(() => {
    if (step === 2 && snapshotUrl) {
      const img = new Image();
      img.src = snapshotUrl;
      img.onload = () => {
        imageRef.current = img;
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = img.naturalWidth || 640;
          canvas.height = img.naturalHeight || 360;
          drawCanvas();
        }
      };
    }
  }, [step, snapshotUrl, lineCoords]);

  // Translate click to canvas coordinates
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY)
    };
  };

  const handleMouseDown = (e) => {
    if (step !== 2) return;
    const coords = getCanvasCoords(e);
    setLineCoords(prev => ({
      ...prev,
      x1: coords.x,
      y1: coords.y,
      x2: coords.x,
      y2: coords.y
    }));
    setIsDrawing(true);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || step !== 2) return;
    const coords = getCanvasCoords(e);
    setLineCoords(prev => ({
      ...prev,
      x2: coords.x,
      y2: coords.y
    }));
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  // Save the drawn line and start live stream
  const handleSaveLine = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      let rtspUrl = 'demo';
      if (dvrIp !== 'demo') {
        rtspUrl = useCustomRtsp ? customRtspUrl : `rtsp://${username}:${password}@${dvrIp}:${port}/h264/ch${channel}/main`;
      }

      const finalConfig = {
        config_data: {
          cameras: [
            {
              id: cameraId,
              name: cameraName,
              rtsp_url: rtspUrl,
              line_coords: lineCoords,
              window_size: 10
            }
          ]
        }
      };

      await updateCameras(finalConfig);
      setCurrentConfig(finalConfig.config_data);
      setSuccessMsg('Line configuration saved and active!');
      setTimeout(() => {
        setStep(3); // Go to Live Stream
        setLoading(false);
      }, 1000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save configuration');
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: '900px' }}>
      <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 className="header-title" style={{ fontSize: '2.2rem' }}>DVR HMI Portal</h1>
          <p className="header-subtitle" style={{ color: 'var(--text-secondary)' }}>Configure CCTV DVR Connection & Draw Counting Lines</p>
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
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '30px' }}>
        <div style={{ padding: '8px 16px', borderRadius: '20px', background: step === 1 ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)', color: step === 1 ? 'white' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', transition: '0.3s' }}>
          1. Connect DVR
        </div>
        <div style={{ padding: '8px 16px', borderRadius: '20px', background: step === 2 ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)', color: step === 2 ? 'white' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', transition: '0.3s' }}>
          2. Draw Virtual Line
        </div>
        <div style={{ padding: '8px 16px', borderRadius: '20px', background: step === 3 ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)', color: step === 3 ? 'white' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', transition: '0.3s' }}>
          3. Live Analytics Stream
        </div>
      </div>

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

      {/* Step 1: DVR Form */}
      {step === 1 && (
        <div className="glass-panel" style={{ animation: 'fadeIn 0.5s ease' }}>
          <h2 style={{ marginTop: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', fontSize: '1.4rem' }}>DVR Connection Settings</h2>
          <form onSubmit={handleConnect} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
            <div className="control-group" style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'white', marginBottom: '10px' }}>
                <input 
                  type="checkbox" 
                  checked={useCustomRtsp} 
                  onChange={(e) => {
                    setUseCustomRtsp(e.target.checked);
                    if (e.target.checked) setDvrIp('custom');
                    else setDvrIp('demo');
                  }} 
                  style={{ width: 'auto', cursor: 'pointer' }}
                />
                Use Custom RTSP Link (For Hikvision, Dahua, CP Plus)
              </label>
            </div>

            {useCustomRtsp ? (
              <div className="control-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Full RTSP Stream URL</label>
                <input 
                  type="text" 
                  value={customRtspUrl} 
                  onChange={(e) => setCustomRtspUrl(e.target.value)} 
                  required 
                  placeholder="e.g. rtsp://username:password@ip:port/Streaming/Channels/101"
                />
                <small style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Paste your exact DVR stream URL directly here.</small>
              </div>
            ) : (
              <>
                <div className="control-group">
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>DVR IP or Host Address</label>
                  <input 
                    type="text" 
                    value={dvrIp} 
                    onChange={(e) => setDvrIp(e.target.value)} 
                    required 
                    placeholder="e.g. 192.168.1.100 or 'demo'"
                  />
                  <small style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Type <strong>demo</strong> for sample video client presentation.</small>
                </div>
                
                <div className="control-group">
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Port</label>
                  <input 
                    type="text" 
                    value={port} 
                    disabled={dvrIp === 'demo'} 
                    onChange={(e) => setPort(e.target.value)} 
                    required 
                  />
                </div>

                <div className="control-group">
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Username</label>
                  <input 
                    type="text" 
                    value={username} 
                    disabled={dvrIp === 'demo'} 
                    onChange={(e) => setUsername(e.target.value)} 
                    required 
                  />
                </div>

                <div className="control-group">
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Password</label>
                  <input 
                    type="password" 
                    value={password} 
                    disabled={dvrIp === 'demo'} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                  />
                </div>

                <div className="control-group">
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>DVR Channel</label>
                  <select value={channel} disabled={dvrIp === 'demo'} onChange={(e) => setChannel(e.target.value)}>
                    <option value="1">Channel 1</option>
                    <option value="2">Channel 2</option>
                    <option value="3">Channel 3</option>
                    <option value="4">Channel 4</option>
                  </select>
                </div>
              </>
            )}

            <div className="control-group" style={{ gridColumn: useCustomRtsp ? 'span 2' : 'auto' }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Camera Name/Location</label>
              <input 
                type="text" 
                value={cameraName} 
                onChange={(e) => setCameraName(e.target.value)} 
                required 
              />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button 
                type="submit" 
                disabled={loading}
                style={{ background: 'var(--accent-blue)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: '0.3s' }}
              >
                {loading ? 'Connecting & Fetching Stream...' : 'Connect to DVR'}
              </button>
            </div>
          </form>
        </div>
      )}


      {/* Step 2: Draw Line Canvas */}
      {step === 2 && (
        <div className="glass-panel" style={{ animation: 'fadeIn 0.5s ease', textAlign: 'center' }}>
          <h2 style={{ marginTop: 0, textAlign: 'left', fontSize: '1.4rem' }}>Draw Virtual Footfall Line</h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'left', fontSize: '0.9rem', marginBottom: '20px' }}>
            Click and drag directly on the frame snapshot below to draw the line where people are counted entering or exiting. 
          </p>

          <div style={{ border: '2px dashed var(--glass-border)', borderRadius: '12px', overflow: 'hidden', display: 'inline-block', position: 'relative', background: '#000', cursor: 'crosshair', maxWidth: '100%' }}>
            <canvas 
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
            <button 
              onClick={() => setStep(1)}
              style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'white', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}
            >
              Back to Form
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
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Live AI Processing Feed</h2>
            <div style={{ background: 'rgba(16,185,129,0.2)', color: 'var(--accent-green)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
              ● LIVE STREAMING
            </div>
          </div>
          
          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--glass-border)', background: '#000', marginBottom: '20px', position: 'relative', aspectRatio: '16/9' }}>
            <img 
              src={`http://${API_HOST}:8000/stream/${cameraId}?t=${Date.now()}`}
              alt="CCTV AI Processing Live Stream" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div style="color:var(--text-secondary);display:flex;align-items:center;justify-content:center;height:100%;">AI stream loading/disconnected. Make sure Python service is running.</div>';
              }}
            />
          </div>

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
