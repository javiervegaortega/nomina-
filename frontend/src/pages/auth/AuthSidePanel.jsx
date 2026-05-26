import React from 'react';
import { Hexagon, CheckCircle2 } from 'lucide-react';

export default function AuthSidePanel() {
  return (
    <div className="auth-brand-panel animate-fade">
      <div className="auth-brand-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div className="nav-brand-icon" style={{ width: 40, height: 40 }}>
            <Hexagon size={24} strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.03em' }}>NóminaPro</span>
        </div>
        
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>
          Gestión de nómina <br />
          <span style={{ color: 'var(--accent-light)' }}>sin complicaciones.</span>
        </h1>
        
        <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.7)', maxWidth: '400px', lineHeight: 1.6 }}>
          Automatiza pagos y obtén reportes financieros precisos en una sola plataforma.
        </p>
      </div>

    </div>
  );
}
