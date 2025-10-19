import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black text-white flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4">🛡️ SafeGuard</h1>
          <p className="text-2xl text-blue-200">
            Personal Safety AI Assistant
          </p>
          <p className="text-gray-400 mt-2">
            Real-time threat detection with intelligent emergency response
          </p>
        </div>

        {/* Main Selection */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Mobile Option */}
          <div
            onClick={() => navigate('/mobile')}
            className="bg-gradient-to-br from-green-600 to-green-800 rounded-xl p-8 cursor-pointer transform transition hover:scale-105 hover:shadow-2xl border-2 border-green-400"
          >
            <div className="text-center">
              <div className="text-6xl mb-4">📱</div>
              <h2 className="text-3xl font-bold mb-3">Mobile</h2>
              <p className="text-green-100 mb-4">
                Use this on your phone for real-time safety monitoring
              </p>
              <ul className="text-left text-sm space-y-2 text-green-100">
                <li>✓ Record audio/video</li>
                <li>✓ AI threat detection</li>
                <li>✓ Emergency call trigger</li>
                <li>✓ Say "gemini" for help</li>
              </ul>
              <button className="mt-6 bg-white text-green-800 font-bold py-3 px-6 rounded-full hover:bg-green-100 transition">
                Open Mobile View →
              </button>
            </div>
          </div>

          {/* Desktop Option */}
          <div
            onClick={() => navigate('/desktop')}
            className="bg-gradient-to-br from-blue-600 to-purple-800 rounded-xl p-8 cursor-pointer transform transition hover:scale-105 hover:shadow-2xl border-2 border-blue-400"
          >
            <div className="text-center">
              <div className="text-6xl mb-4">🖥️</div>
              <h2 className="text-3xl font-bold mb-3">Desktop</h2>
              <p className="text-blue-100 mb-4">
                Monitor and track safety status from your computer
              </p>
              <ul className="text-left text-sm space-y-2 text-blue-100">
                <li>✓ Real-time monitoring</li>
                <li>✓ Activity logs</li>
                <li>✓ Danger score tracking</li>
                <li>✓ Multi-session support</li>
              </ul>
              <button className="mt-6 bg-white text-blue-800 font-bold py-3 px-6 rounded-full hover:bg-blue-100 transition">
                Open Control Center →
              </button>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-12 bg-gray-800/50 rounded-xl p-8 border border-gray-700">
          <h3 className="text-2xl font-bold mb-4 text-center">How It Works</h3>
          <div className="grid md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-4xl mb-2">1️⃣</div>
              <p className="text-sm text-gray-300">Open mobile view on your phone</p>
            </div>
            <div>
              <div className="text-4xl mb-2">2️⃣</div>
              <p className="text-sm text-gray-300">Start recording to monitor surroundings</p>
            </div>
            <div>
              <div className="text-4xl mb-2">3️⃣</div>
              <p className="text-sm text-gray-300">Say "gemini" if you need help</p>
            </div>
            <div>
              <div className="text-4xl mb-2">4️⃣</div>
              <p className="text-sm text-gray-300">Fake call appears to help you escape</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Powered by Gemini AI & ElevenLabs Voice</p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
