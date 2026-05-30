import React, { useState, useEffect } from 'react';
import {
  getCameras,
  getCamerasStatus,
  getMinutePeaks,
  getProcessorStatus,
  getProcessorThumbnailUrl,
  getServerPeakImages,
  getServerPeakImageUrl,
} from '../services/api';

const THUMB_INTERVAL_MS = 4000;
const POLL_STATUS_MS = 5000;

const STATUS_COLORS = {
  configured: 'var(--accent-green)',
  connected: 'var(--accent-green)',
  disconnected: '#fbbf24',
  no_data: '#fbbf24',
  auth_failed: 'var(--accent-red)',
  error: 'var(--accent-red)',
  unknown: 'var(--text-secondary)',
};

const statusLabel = (s) => {
  const map = {
    configured: 'Configured',
    connected: 'Connected',
    disconnected: 'Disconnected',
    no_data: 'No data',
    auth_failed: 'Auth failed',
    error: 'Error',
  };
  return map[s] || s;
};

const Analytics = ({ focusCamId, onBack }) => {
  const [section, setSection] = useState('cams'); // cams | watermarks
  const [cameras, setCameras] = useState([]);
  const [selectedId, setSelectedId] = useState(focusCamId || '');
  const [statuses, setStatuses] = useState([]);
  const [processorStatus, setProcessorStatus] = useState(null);
  const [peaks, setPeaks] = useState([]);
  const [serverPeaks, setServerPeaks] = useState([]);
  const [thumbTs, setThumbTs] = useState(Date.now());
  const [allCursors, setAllCursors] = useState([]);

  useEffect(() => {
    if (focusCamId) {
      setSelectedId(focusCamId);
    }
  }, [focusCamId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await getCameras();
        const cams = res.data?.config_data?.cameras || [];
        setCameras(cams);
        if (!focusCamId && cams.length > 0) {
          setSelectedId((prev) => prev || cams[0].id);
        }
      } catch (e) {
        console.error('Failed to load cameras', e);
      }
    })();
  }, [focusCamId]);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await getCamerasStatus();
        setStatuses(res.data || []);
      } catch (e) {
        console.warn('Status poll failed', e);
      }
    };
    poll();
    const id = setInterval(poll, POLL_STATUS_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedId) return undefined;
    const load = async () => {
      try {
        const [st, pk, sp] = await Promise.all([
          getProcessorStatus(selectedId).catch(() => ({ data: null })),
          getMinutePeaks(selectedId, 15).catch(() => ({ data: [] })),
          getServerPeakImages(selectedId, 15).catch(() => ({ data: [] })),
        ]);
        setProcessorStatus(st.data);
        setPeaks(pk.data || []);
        setServerPeaks(sp.data || []);
      } catch (e) {
        console.warn('Analytics detail load failed', e);
      }
    };
    load();
    const id = setInterval(load, POLL_STATUS_MS);
    return () => clearInterval(id);
  }, [selectedId]);

  useEffect(() => {
    if (section !== 'watermarks' || cameras.length === 0) return undefined;
    const loadAll = async () => {
      const rows = await Promise.all(
        cameras.map(async (cam) => {
          try {
            const res = await getProcessorStatus(cam.id);
            return { cam, cursor: res.data?.cursor, cctv_id: res.data?.cctv_id };
          } catch {
            return { cam, cursor: null, cctv_id: cam.id };
          }
        })
      );
      setAllCursors(rows);
    };
    loadAll();
    const id = setInterval(loadAll, POLL_STATUS_MS);
    return () => clearInterval(id);
  }, [section, cameras]);

  useEffect(() => {
    if (!selectedId || section !== 'cams') return undefined;
    const id = setInterval(() => setThumbTs(Date.now()), THUMB_INTERVAL_MS);
    return () => clearInterval(id);
  }, [selectedId, section]);

  const statusFor = (id) => statuses.find((s) => s.cctvid === id);
  const dvrAlert = statuses.find((s) => s.cctvid === '_dvr');

  const selectedCam = cameras.find((c) => c.id === selectedId);

  return (
    <div className="dashboard-container" style={{ maxWidth: '1400px' }}>
      <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="header-title">Analytics</h1>
          <p className="header-subtitle">Configured cameras, peaks, and processing watermarks</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--glass-border)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          &larr; Back to Dashboard
        </button>
      </header>

      {(dvrAlert || statuses.some((s) => s.status && !['connected', 'configured'].includes(s.status))) && (
        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {dvrAlert && (
            <div className="glass-panel" style={{ border: '1px solid var(--accent-red)', color: '#fca5a5', padding: '10px' }}>
              DVR: {statusLabel(dvrAlert.status)} — {dvrAlert.message}
            </div>
          )}
          {statuses
            .filter((s) => s.cctvid !== '_dvr' && s.status !== 'connected' && s.status !== 'configured')
            .map((s) => (
              <div
                key={s.cctvid}
                className="glass-panel"
                style={{
                  border: `1px solid ${STATUS_COLORS[s.status] || 'var(--glass-border)'}`,
                  padding: '10px',
                  fontSize: '0.9rem',
                }}
              >
                <strong>{s.cctvname || s.cctvid}</strong>: {statusLabel(s.status)} — {s.message}
                {s.detail ? ` (${s.detail})` : ''}
              </div>
            ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', minHeight: '520px' }}>
        <nav
          className="glass-panel"
          style={{
            width: '220px',
            flexShrink: 0,
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => setSection('cams')}
            style={{
              textAlign: 'left',
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: section === 'cams' ? 'var(--accent-blue)' : 'transparent',
              color: 'white',
            }}
          >
            View configured cams
          </button>
          <button
            type="button"
            onClick={() => setSection('watermarks')}
            style={{
              textAlign: 'left',
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: section === 'watermarks' ? 'var(--accent-blue)' : 'transparent',
              color: 'white',
            }}
          >
            Watermarks
          </button>

          {section === 'cams' && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {cameras.map((cam) => {
                const st = statusFor(cam.id);
                return (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => setSelectedId(cam.id)}
                    style={{
                      textAlign: 'left',
                      padding: '8px',
                      borderRadius: '6px',
                      border: selectedId === cam.id ? '1px solid var(--accent-blue)' : '1px solid transparent',
                      background: selectedId === cam.id ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.03)',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    {cam.name || cam.id}
                    {st && (
                      <span style={{ display: 'block', fontSize: '0.7rem', color: STATUS_COLORS[st.status] }}>
                        {statusLabel(st.status)}
                      </span>
                    )}
                  </button>
                );
              })}
              {cameras.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No cameras configured yet.</p>
              )}
            </div>
          )}
        </nav>

        <main style={{ flex: 1, minWidth: 0 }}>
          {section === 'watermarks' && (
            <div className="glass-panel">
              <h2 style={{ marginTop: 0 }}>Processing watermarks</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px' }}>Camera</th>
                    <th style={{ padding: '8px' }}>Mode</th>
                    <th style={{ padding: '8px' }}>Last processed</th>
                    <th style={{ padding: '8px' }}>Last minute bucket</th>
                  </tr>
                </thead>
                <tbody>
                  {allCursors.map(({ cam, cursor }) => (
                    <tr key={cam.id} style={{ borderTop: '1px solid var(--glass-border)' }}>
                      <td style={{ padding: '8px' }}>{cam.name || cam.id}</td>
                      <td style={{ padding: '8px' }}>{cursor?.mode || '—'}</td>
                      <td style={{ padding: '8px' }}>
                        {cursor?.last_processed_at
                          ? new Date(cursor.last_processed_at).toLocaleString()
                          : '—'}
                      </td>
                      <td style={{ padding: '8px' }}>
                        {cursor?.last_minute_bucket
                          ? new Date(cursor.last_minute_bucket).toLocaleString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {section === 'cams' && selectedCam && (
            <>
              <div className="glass-panel" style={{ marginBottom: '16px' }}>
                <h2 style={{ marginTop: 0 }}>{selectedCam.name || selectedCam.id}</h2>
                <div
                  style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid var(--glass-border)',
                    background: '#000',
                    aspectRatio: '16/9',
                    maxHeight: '420px',
                  }}
                >
                  <img
                    src={`${getProcessorThumbnailUrl(selectedId)}?t=${thumbTs}`}
                    alt="Live snapshot"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
                {processorStatus && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '10px',
                      marginTop: '12px',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>IN / OUT (window)</span>
                      <div>
                        {processorStatus.window_in} / {processorStatus.window_out}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Peak (this min)</span>
                      <div>{processorStatus.current_peak_people ?? 0}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Poll failures</span>
                      <div>{processorStatus.consecutive_failures ?? 0}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="glass-panel">
                <h3 style={{ marginTop: 0 }}>Peak images (last 15 on edge)</h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: '12px',
                  }}
                >
                  {peaks.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)' }}>No peak images yet.</p>
                  )}
                  {peaks.map((p) => (
                    <div key={`${p.minute_bucket}-${p.id}`} style={{ textAlign: 'center' }}>
                      {p.image_path && (
                        <img
                          src={`http://${window.location.hostname}:8000/media/${p.image_path}?t=${Date.now()}`}
                          alt="Peak"
                          style={{
                            width: '100%',
                            aspectRatio: '16/9',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            border: '1px solid var(--glass-border)',
                          }}
                        />
                      )}
                      <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                        {p.people_count} people
                        <br />
                        {p.uploaded_to_server === 'Successful' ? '✓ uploaded' : p.uploaded_to_server}
                      </div>
                    </div>
                  ))}
                </div>

                {serverPeaks.length > 0 && (
                  <>
                    <h3 style={{ marginTop: '24px' }}>On server (uploaded)</h3>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: '12px',
                      }}
                    >
                      {serverPeaks.map((p) => (
                        <div key={p.id} style={{ textAlign: 'center' }}>
                          {p.relativePath && (
                            <img
                              src={getServerPeakImageUrl(p.relativePath)}
                              alt="Server peak"
                              style={{
                                width: '100%',
                                aspectRatio: '16/9',
                                objectFit: 'cover',
                                borderRadius: '6px',
                              }}
                            />
                          )}
                          <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                            {p.peopleCount} people
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {section === 'cams' && !selectedCam && (
            <div className="glass-panel">
              <p style={{ color: 'var(--text-secondary)' }}>Select a camera or configure one in the DVR Portal.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Analytics;
