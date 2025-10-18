import React, { useState, useEffect } from 'react';
import type { Message, Request } from './types';
import { MOCK_MESSAGES, MOCK_REQUESTS } from './constants';
import Header from './components/Header';
import MessageFeed from './components/MessageFeed';
import RequestStatus from './components/RequestStatus';
import MessageDetail from './components/MessageDetail';
import SafetyRecorder from './components/SafetyRecorder';

const API_BASE_URL = 'http://localhost:3001/api';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [useMockData, setUseMockData] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

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

  const handleCodewordDetected = () => {
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 10000); // Hide after 10 seconds
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Header />
      {showAlert && (
        <div className="bg-red-500/90 border-b border-red-600 px-4 py-3 text-center animate-pulse">
          <p className="text-lg font-bold text-white">
            🚨 PANIC CODEWORD DETECTED - EMERGENCY CALL TRIGGERED! 📞
          </p>
        </div>
      )}
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* Column 1: Safety Recorder */}
          <div className="lg:col-span-1">
            <SafetyRecorder onCodewordDetected={handleCodewordDetected} />
          </div>

          {/* Column 2 & 3: Message Feed & Status */}
          <div className="lg:col-span-2 space-y-6">
            <MessageFeed
              messages={messages}
              selectedMessage={selectedMessage}
              onSelectMessage={handleSelectMessage}
            />
            <MessageDetail message={selectedMessage} />
            <RequestStatus requests={requests} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
