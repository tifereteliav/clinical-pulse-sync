import React, { useState } from 'react';

const CORRECT_PIN = '1234';

export default function ProtectedWrapper({ children, title = 'כניסה מוגנת' }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('clinical_pulse_auth') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState('');

  const handleUnlock = (e) => {
    e.preventDefault();
    if (pinInput.trim() === CORRECT_PIN) {
      sessionStorage.setItem('clinical_pulse_auth', 'true');
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('סיסמה שגויה. אנא נסה שוב.');
      setPinInput('');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="card" dir="rtl" style={{ maxWidth: '440px', margin: '3rem auto', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔒</div>
      <h2 style={{ marginBottom: '0.5rem' }}>{title}</h2>
      <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
        אזור זה מוגן בסיסמה. אנא הזן קוד גישה (PIN) כדי להמשיך.
      </p>

      <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input
          type="password"
          value={pinInput}
          onChange={(e) => {
            setPinInput(e.target.value);
            if (error) setError('');
          }}
          placeholder="הזן קוד גישה (1234)"
          maxLength={10}
          autoFocus
          style={{
            padding: '0.85rem',
            fontSize: '1.1rem',
            borderRadius: '8px',
            border: error ? '2px solid #ef4444' : '1px solid #cbd5e1',
            textAlign: 'center',
            letterSpacing: '0.2rem',
            boxSizing: 'border-box',
            outline: 'none'
          }}
        />

        {error && (
          <div style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: '500' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!pinInput}
          style={{
            padding: '0.85rem',
            backgroundColor: pinInput ? '#0284c7' : '#94a3b8',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: pinInput ? 'pointer' : 'not-allowed',
            transition: 'background-color 0.2s'
          }}
        >
          אישור וכניסה
        </button>
      </form>
    </div>
  );
}
