import React from 'react';

const SummaryCards = ({ totalCtrIn, totalCtrOut, currentOccupancy, loading }) => {
  const Card = ({ title, value, colorClass }) => (
    <div className={`glass-panel summary-card-wrapper`} style={{ textAlign: 'center', transition: 'transform 0.2s', cursor: 'default' }}
         onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
         onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>{title}</h3>
      <p className={colorClass} style={{ margin: 0, fontSize: '2.5rem', fontWeight: '800' }}>
        {loading ? '...' : (value ?? 'N/A')}
      </p>
    </div>
  );

  return (
    <div className="summary-cards-container">
      <Card title="Total In" value={totalCtrIn} colorClass="text-blue" />
      <Card title="Total Out" value={totalCtrOut} colorClass="text-red" />
      <Card title="Occupancy" value={currentOccupancy} colorClass="text-green" />
    </div>
  );
};

export default SummaryCards;