import React from 'react';

const Controls = ({
  cctvId, setCctvId,
  availableCameras = [],
  startTime, setStartTime,
  endTime, setEndTime
}) => {
  return (
    <div className="glass-panel controls-container">

      <div className="control-group" style={{ position: 'relative' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CAMERA</label>
        <select value={cctvId} onChange={(e) => setCctvId(e.target.value)} disabled={availableCameras.length === 0}>
          {availableCameras.length === 0 ? (
            <option value="">Waiting for data...</option>
          ) : (
            <>
              <option value="ALL">All Cameras</option>
              {availableCameras.map((cam) => (
                <option key={cam.id} value={cam.id}>{cam.id}</option>
              ))}
            </>
          )}
        </select>
      </div>

      <div className="control-group large">
        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>START TIME</label>
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
      </div>

      <div className="control-group large">
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