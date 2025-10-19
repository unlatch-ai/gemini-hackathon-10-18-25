import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import DesktopMonitor from './components/DesktopMonitor';
import MobileProtection from './components/MobileProtection';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/desktop" element={<DesktopMonitor />} />
        <Route path="/mobile" element={<MobileProtection />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
