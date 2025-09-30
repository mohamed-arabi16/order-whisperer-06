import React from 'react';
import { useAuth } from '@/hooks/useAuth';

export function DebugPanel() {
  const { user, profile, tenantId, loading, session } = useAuth();

  // Only render in development environment
  if (import.meta.env.MODE !== 'development') {
    return null;
  }

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '10px',
    right: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    color: 'white',
    padding: '15px',
    borderRadius: '8px',
    zIndex: 9999,
    maxWidth: '400px',
    fontSize: '12px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    overflowY: 'auto',
    maxHeight: '50vh',
    border: '1px solid #444',
  };

  const headerStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '10px',
    borderBottom: '1px solid #555',
    paddingBottom: '5px',
    color: '#ffc107',
  };

  const keyStyle: React.CSSProperties = {
    color: '#87dffc',
    fontWeight: 'bold',
  };

  const valueStyle: React.CSSProperties = {
    color: '#a1e8a1',
  };

  const renderValue = (value: any) => {
    if (value === null) return <span style={{...valueStyle, color: '#ff8a80'}}>null</span>;
    if (value === undefined) return <span style={{...valueStyle, color: '#ff8a80'}}>undefined</span>;
    if (typeof value === 'boolean') return <span style={valueStyle}>{value.toString()}</span>;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return value;
  };

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>Auth Debug Panel</div>
      <div><span style={keyStyle}>Loading:</span> {renderValue(loading)}</div>
      <div><span style={keyStyle}>User ID:</span> {renderValue(user?.id)}</div>
      <div><span style={keyStyle}>User Role:</span> {renderValue(profile?.role)}</div>
      <div><span style={keyStyle}>Tenant ID:</span> {renderValue(tenantId)}</div>
      <hr style={{ borderColor: '#444', margin: '8px 0' }} />
      <details>
        <summary style={{ cursor: 'pointer' }}>Profile</summary>
        <pre style={{ ...valueStyle, marginTop: '5px' }}>{renderValue(profile)}</pre>
      </details>
      <hr style={{ borderColor: '#444', margin: '8px 0' }} />
      <details>
        <summary style={{ cursor: 'pointer' }}>Session</summary>
        <pre style={{ ...valueStyle, marginTop: '5px' }}>{renderValue(session)}</pre>
      </details>
    </div>
  );
}