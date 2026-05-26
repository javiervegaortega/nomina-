import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import AuthSidePanel from './AuthSidePanel';
import { AuthContext } from '../../context/AuthContext';
import { AppContext } from '../../App';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useContext(AuthContext);
  const { showToast } = useContext(AppContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      showToast('Sesión iniciada correctamente', 'success');
      navigate('/dashboard');
    } else {
      showToast(result.error, 'error');
    }
  };
  return (
    <div className="auth-split-layout">
      <AuthSidePanel />
      
      <div className="auth-form-panel animate-fade">
        <div className="auth-form-container">
          <div className="auth-header" style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>
              Iniciar Sesión
            </h1>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.95rem', margin: 0 }}>
              Bienvenido de nuevo, por favor ingresa tus credenciales.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input type="email" className="input-field pl-icon" placeholder="tu@empresa.com" required value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Contraseña</label>
                <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 600 }}>
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input type="password" className="input-field pl-icon" placeholder="••••••••" required value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', marginTop: '0.5rem', justifyContent: 'center', fontSize: '0.95rem' }}>
              Iniciar Sesión <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
            </button>
          </form>

          <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
              ¿No tienes cuenta? <Link to="/register" style={{ color: 'var(--accent-light)', fontWeight: 600, textDecoration: 'none' }}>Crea una gratis</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
