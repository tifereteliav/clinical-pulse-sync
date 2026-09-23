import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import AudienceView from './views/AudienceView';
import AdminDashboard from './views/AdminDashboard';
import LivePresentationView from './views/LivePresentationView';
import ProtectedWrapper from './components/ProtectedWrapper';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<AudienceView />} />
          <Route 
            path="/admin" 
            element={
              <ProtectedWrapper title="כניסת מנהל">
                <AdminDashboard />
              </ProtectedWrapper>
            } 
          />
          <Route 
            path="/live" 
            element={
              <ProtectedWrapper title="כניסת מצגת בלייב">
                <LivePresentationView />
              </ProtectedWrapper>
            } 
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
