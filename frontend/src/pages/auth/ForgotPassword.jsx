import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import AuthSidePanel from './AuthSidePanel';

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);

  return (
    <div className="auth-split-layout">
      <AuthSidePanel />
      
      <div className="auth-form-panel animate-fade">
        <div className="auth-form-container">
          <div className="auth-header" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>
              Recuperar Contraseña
            </h1>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.95rem', margin: 0 }}>
              Ingresa tu correo corporativo y te enviaremos instrucciones seguras para restablecer tu acceso.
            </p>
          </div>

          {!sent ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <form className="auth-form" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
                <div className="form-group">
                  <label className="form-label">Correo Electrónico</label>
                  <div className="input-with-icon">
                    <Mail size={18} className="input-icon" />
                    <input type="email" className="input-field pl-icon" placeholder="tu@empresa.com" required />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', marginTop: '1rem', justifyContent: 'center', fontSize: '0.95rem' }}>
                  Enviar Instrucciones <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
                </button>
              </form>

              <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                <Link to="/login" style={{ color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontSize: '0.9rem', transition: 'color 0.2s ease' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>
                  <ArrowLeft size={16} style={{ marginRight: '0.4rem' }} /> Volver a Iniciar Sesión
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem 0 2rem' }} className="animate-slide-up">
              <div style={{ color: 'var(--success)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                <CheckCircle2 size={56} strokeWidth={1.5} />
              </div>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 800 }}>¡Instrucciones enviadas!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2.5rem', lineHeight: 1.5 }}>
                Hemos enviado un enlace seguro a tu bandeja de entrada. Por favor, revisa también la carpeta de spam.
              </p>
              
              <Link to="/login" className="btn btn-secondary" style={{ justifyContent: 'center', width: '100%', padding: '0.85rem' }}>
                Volver al Inicio de Sesión
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
