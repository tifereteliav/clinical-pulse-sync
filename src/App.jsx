import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import AudienceView from './views/AudienceView';
import AdminDashboard from './views/AdminDashboard';
import LivePresentationView from './views/LivePresentationView';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<AudienceView />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/live" element={<LivePresentationView />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
