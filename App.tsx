import React, { useState } from 'react';
import type { Message } from './types';
import { MOCK_MESSAGES, MOCK_REQUESTS } from './constants';
import Header from './components/Header';
import MessageFeed from './components/MessageFeed';
import RequestStatus from './components/RequestStatus';
import MessageDetail from './components/MessageDetail';

const App: React.FC = () => {
  const [messages] = useState<Message[]>(MOCK_MESSAGES);
  const [requests] = useState(MOCK_REQUESTS);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(messages[0] || null);

  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Header />
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* Column 1: Message Feed */}
          <div className="lg:col-span-1">
            <MessageFeed
              messages={messages}
              selectedMessage={selectedMessage}
              onSelectMessage={handleSelectMessage}
            />
          </div>
          
          {/* Column 2 & 3: Details & Status */}
          <div className="lg:col-span-2 grid grid-cols-1 gap-6">
            <MessageDetail message={selectedMessage} />
            <RequestStatus requests={requests} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
