import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 2rem' }}>
      {/* Right side: Logo with white background badge + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ 
          backgroundColor: '#ffffff', 
          padding: '6px 12px', 
          borderRadius: '8px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)' 
        }}>
          <img 
            src="/logo.png" 
            alt="Logo" 
            style={{ 
              height: '36px', 
              width: 'auto', 
              objectFit: 'contain' 
            }} 
          />
        </div>

        <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '1.25rem' }}>
          Clinical Pulse Sync
        </div>
      </div>

      {/* Navigation Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
          Audience View
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>
          Admin Dashboard
        </NavLink>
        <NavLink to="/live" className={({ isActive }) => isActive ? 'active' : ''}>
          Presentation View
        </NavLink>
      </div>
    </nav>
  );
}
