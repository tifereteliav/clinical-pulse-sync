import React from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import AudienceView from './views/AudienceView';
import AdminDashboard from './views/AdminDashboard';
import LivePresentationView from './views/LivePresentationView';
import ProtectedWrapper from './components/ProtectedWrapper';
import QuizPlayer from './views/QuizPlayer';
import QuizHost from './views/QuizHost';

// מסגרת הסקר הישן (עם תפריט עליון)
function PollLayout() {
  return (
    <>
      <Navbar />
      <div className="container">
        <Outlet />
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* חידון תחרותי – מסך מלא */}
        <Route path="/" element={<QuizPlayer />} />
        <Route
          path="/host"
          element={
            <ProtectedWrapper title="כניסת מנחה לחידון">
              <QuizHost />
            </ProtectedWrapper>
          }
        />

        {/* הסקר הקודם – נשאר זמין */}
        <Route element={<PollLayout />}>
          <Route path="/poll" element={<AudienceView />} />
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
