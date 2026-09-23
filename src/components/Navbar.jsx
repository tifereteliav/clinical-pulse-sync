import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '1.25rem', marginRight: '0.5rem' }}>
          Clinical Pulse Sync
        </div>
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

      {/* Logo image on the left side */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <img 
          src="/logo.png" 
          alt="Logo" 
          style={{ 
            height: '38px', 
            width: 'auto', 
            objectFit: 'contain', 
            borderRadius: '6px',
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2))'
          }} 
        />
      </div>
    </nav>
  );
}
