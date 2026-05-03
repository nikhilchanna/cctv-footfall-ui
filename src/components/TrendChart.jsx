import React, { useState } from 'react';
import {
  AreaChart, Area, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';

const TrendChart = ({ data, loading }) => {

  const [interval, setInterval] = useState('1h');

  if (loading && (!data || data.length === 0)) {
    return <div className="glass-panel" style={{ textAlign: 'center', padding: '50px' }}>Loading chart...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="glass-panel" style={{ textAlign: 'center', padding: '50px', color: 'var(--text-secondary)' }}>No data available for this range.</div>;
  }

  const getGroupedTime = (dateStr, intervalStr) => {
    const d = new Date(dateStr);
    const minutes = d.getMinutes();
    const hours = d.getHours();
    d.setSeconds(0, 0);

    if (intervalStr === '5m') {
      d.setMinutes(Math.floor(minutes / 5) * 5);
    } else if (intervalStr === '15m') {
      d.setMinutes(Math.floor(minutes / 15) * 15);
    } else if (intervalStr === '30m') {
      d.setMinutes(Math.floor(minutes / 30) * 30);
    } else if (intervalStr === '1h') {
      d.setMinutes(0);
    } else if (intervalStr === '2h') {
      d.setHours(Math.floor(hours / 2) * 2);
      d.setMinutes(0);
    }
    return d.toISOString();
  };

  const groupedDataMap = {};
  data.forEach(item => {
    const timeKey = getGroupedTime(item.bucketTime, interval);
    if (!groupedDataMap[timeKey]) {
      groupedDataMap[timeKey] = { bucketTime: timeKey, ctrIn: 0, ctrOut: 0 };
    }
    groupedDataMap[timeKey].ctrIn += item.ctrIn;
    groupedDataMap[timeKey].ctrOut += item.ctrOut;
  });

  const processedData = Object.values(groupedDataMap)
    .sort((a, b) => new Date(a.bucketTime) - new Date(b.bucketTime))
    .map(item => ({
      ...item,
      net: item.ctrIn - item.ctrOut
    }));

  const dayBoundaries = [];
  let currentDay = '';
  processedData.forEach((item) => {
    const d = new Date(item.bucketTime);
    const dayString = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    if (dayString !== currentDay) {
      currentDay = dayString;
      dayBoundaries.push({
        bucketTime: item.bucketTime,
        label: dayString
      });
    }
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-panel" style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.2)' }}>
          <p style={{ margin: '0 0 8px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {new Date(label).toLocaleString()}
          </p>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color, margin: '4px 0', fontWeight: 'bold' }}>
              {p.name}: {p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-panel" style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>People Flow Trend</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>AGGREGATION:</label>
          <select 
            value={interval} 
            onChange={(e) => setInterval(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', minWidth: '120px' }}
          >
            <option value="5m">5 Minutes</option>
            <option value="15m">15 Minutes</option>
            <option value="30m">30 Minutes</option>
            <option value="1h">1 Hour</option>
            <option value="2h">2 Hours</option>
          </select>
        </div>
      </div>

      <div className="chart-scroll-container">
        <div style={{ minWidth: `max(100%, ${Math.max(800, processedData.length * 20)}px)`, height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={processedData} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />

              {dayBoundaries.map((boundary, i) => (
                <ReferenceLine 
                  key={i} 
                  x={boundary.bucketTime} 
                  stroke="rgba(255,255,255,0.3)" 
                  strokeDasharray="3 3"
                  label={{ 
                    position: 'top', 
                    value: boundary.label, 
                    fill: 'var(--text-primary)',
                    fontSize: 14,
                    fontWeight: 'bold'
                  }} 
                />
              ))}

              <XAxis
                dataKey="bucketTime"
                stroke="var(--text-secondary)"
                tick={{ fill: 'var(--text-secondary)' }}
                tickLine={false}
                tickFormatter={(value) =>
                  new Date(value).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                }
              />

              <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />

              <Tooltip content={<CustomTooltip />} />

              <Legend wrapperStyle={{ paddingTop: '20px' }} />

              <Area type="monotone" name="Inflow" dataKey="ctrIn" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" />
              <Area type="monotone" name="Outflow" dataKey="ctrOut" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" />

              <Line type="monotone" name="Net (In - Out)" dataKey="net" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#10b981', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default TrendChart;