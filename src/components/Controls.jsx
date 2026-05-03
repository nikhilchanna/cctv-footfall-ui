import React from 'react';

const Controls = ({
  cctvId, setCctvId,
  availableCameras = [],
  interval, setInterval: setIntervalValue,
  startTime, setStartTime,
  endTime, setEndTime
}) => {
  return (
    <div className="glass-panel" style={{ display: 'flex', gap: '24px', margin: '20px 0', alignItems: 'flex-end', flexWrap: 'wrap' }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '150px' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CAMERA</label>
        <select value={cctvId} onChange={(e) => setCctvId(e.target.value)} disabled={availableCameras.length === 0}>
          {availableCameras.length === 0 ? (
            <option value="">Waiting for data...</option>
          ) : (
            availableCameras.map((cam) => (
              <option key={cam} value={cam}>{cam}</option>
            ))
          )}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '150px' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>INTERVAL</label>
        <select value={interval} onChange={(e) => setIntervalValue(e.target.value)}>
          <option value="5m">5 Minutes</option>
          <option value="15m">15 Minutes</option>
          <option value="30m">30 Minutes</option>
          <option value="1h">1 Hour</option>
          <option value="2h">2 Hours</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '200px' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>START TIME</label>
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '200px' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>END TIME</label>
        <input
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
        />
      </div>

    </div>
  );
};

export default Controls;