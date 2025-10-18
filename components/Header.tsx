import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-gray-800 shadow-md">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              SF 311 WhatsApp Bot Dashboard
            </h1>
            <p className="text-sm text-gray-400">
              Live monitoring of AI-driven civic service requests
            </p>
          </div>
          <div className="bg-yellow-500/20 text-yellow-300 text-xs font-bold uppercase px-3 py-1 rounded-full">
            Simulation Mode
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;