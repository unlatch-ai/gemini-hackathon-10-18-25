import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-gray-800 shadow-md border-b-2 border-red-600">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              🛡️ Live Safety Monitor
            </h1>
            <p className="text-sm text-gray-400">
              AI-powered panic detection with emergency call trigger
            </p>
          </div>
          <div className="bg-red-500/20 text-red-300 text-xs font-bold uppercase px-3 py-1 rounded-full border border-red-500">
            🚨 Safety Mode Active
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;