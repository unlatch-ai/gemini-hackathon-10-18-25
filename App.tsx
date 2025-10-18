import React, { useState, useEffect } from 'react';
import type { Message, Request } from './types';
import { MOCK_MESSAGES, MOCK_REQUESTS } from './constants';
import Header from './components/Header';
import MessageFeed from './components/MessageFeed';
import RequestStatus from './components/RequestStatus';
import MessageDetail from './components/MessageDetail';
import ModelSelector from './components/ModelSelector';

const API_BASE_URL = 'http://localhost:3001/api';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [useMockData, setUseMockData] = useState(false);

  // Fetch data from API
  const fetchData = async () => {
    try {
      const [messagesRes, requestsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/messages`),
        fetch(`${API_BASE_URL}/requests`),
      ]);

      const messagesData = await messagesRes.json();
      const requestsData = await requestsRes.json();

      // If no real data, use mock data
      if (messagesData.length === 0) {
        setMessages(MOCK_MESSAGES);
        setRequests(MOCK_REQUESTS);
        setUseMockData(true);
        if (MOCK_MESSAGES.length > 0) {
          setSelectedMessage(MOCK_MESSAGES[0]);
        }
      } else {
        setMessages(messagesData);
        setRequests(requestsData);
        setUseMockData(false);
        if (messagesData.length > 0 && !selectedMessage) {
          setSelectedMessage(messagesData[messagesData.length - 1]); // Select most recent
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // Fallback to mock data
      setMessages(MOCK_MESSAGES);
      setRequests(MOCK_REQUESTS);
      setUseMockData(true);
      if (MOCK_MESSAGES.length > 0) {
        setSelectedMessage(MOCK_MESSAGES[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Poll for updates every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedMessage]);

  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Header />
      {useMockData && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/50 px-4 py-2 text-center">
          <p className="text-sm text-yellow-300">
            📊 Showing mock data - Send a WhatsApp message to see live data!
          </p>
        </div>
      )}
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* Column 1: Message Feed & Model Selector */}
          <div className="lg:col-span-1 space-y-6">
            <ModelSelector />
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
