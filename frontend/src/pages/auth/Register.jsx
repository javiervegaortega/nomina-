import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Building, ArrowRight } from 'lucide-react';
import AuthSidePanel from './AuthSidePanel';
import { AuthContext } from '../../context/AuthContext';
import { AppContext } from '../../App';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register } = useContext(AuthContext);
  const { showToast } = useContext(AppContext);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    const result = await register(name, email, password);
    if (result.success) {
      showToast('Cuenta creada exitosamente. Por favor, inicia sesión.', 'success');
      navigate('/login');
    } else {
      showToast(result.error, 'error');
    }
  };
  return (
    <div className="auth-split-layout">
      <AuthSidePanel />
      
      <div className="auth-form-panel animate-fade">
        <div className="auth-form-container" style={{ maxWidth: '440px' }}>
          <div className="auth-header" style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>
              Crea tu cuenta
            </h1>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.95rem', margin: 0 }}>
              Comienza a gestionar tu nómina de manera inteligente
            </p>
          </div>

          <form className="auth-form" onSubmit={handleRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre Completo</label>
                <div className="input-with-icon">
                  <User size={18} className="input-icon" />
                  <input type="text" className="input-field pl-icon" placeholder="Juan Pérez" required value={name} onChange={e => setName(e.target.value)} />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Empresa</label>
                <div className="input-with-icon">
                  <Building size={18} className="input-icon" />
                  <input type="text" className="input-field pl-icon" placeholder="Mi Empresa S.A." required />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input type="email" className="input-field pl-icon" placeholder="tu@empresa.com" required value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input type="password" className="input-field pl-icon" placeholder="Crea una contraseña segura" required value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', marginTop: '0.5rem', justifyContent: 'center', fontSize: '0.95rem' }}>
              Crear Cuenta <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
            </button>
          </form>

          <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
              ¿Ya tienes una cuenta? <Link to="/login" style={{ color: 'var(--accent-light)', fontWeight: 600, textDecoration: 'none' }}>Inicia sesión</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
