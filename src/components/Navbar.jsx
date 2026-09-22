import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav>
      <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '1.25rem', marginRight: '1.5rem' }}>
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
    </nav>
  );
}
