import React, { useState } from 'react';
import Header from './components/Header';
import SafetyRecorder from './components/SafetyRecorder';

const App: React.FC = () => {
  const [showAlert, setShowAlert] = useState(false);

  const handleDangerDetected = () => {
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 10000); // Hide after 10 seconds
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Header />
      {showAlert && (
        <div className="bg-red-500/90 border-b border-red-600 px-4 py-3 text-center animate-pulse">
          <p className="text-lg font-bold text-white">
            🚨 DANGEROUS SITUATION DETECTED - EMERGENCY CALL TRIGGERED! 📞
          </p>
        </div>
      )}
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="flex justify-center items-center min-h-[80vh]">
          <SafetyRecorder onCodewordDetected={handleDangerDetected} />
        </div>
      </main>
    </div>
  );
};

export default App;
