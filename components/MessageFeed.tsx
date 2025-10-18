import React from 'react';
import type { Message } from '../types';

interface MessageFeedProps {
  messages: Message[];
  selectedMessage: Message | null;
  onSelectMessage: (message: Message) => void;
}

const MessageFeed: React.FC<MessageFeedProps> = ({ messages, selectedMessage, onSelectMessage }) => {
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg h-full">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Incoming Messages</h2>
        <p className="text-sm text-gray-400">From Twilio Sandbox</p>
      </div>
      <div className="overflow-y-auto h-[calc(100vh-200px)]">
        <ul>
          {messages.map((message) => (
            <li
              key={message.id}
              className={`cursor-pointer p-4 border-b border-gray-700 hover:bg-gray-700 transition-colors duration-200 ${
                selectedMessage?.id === message.id ? 'bg-blue-900/50' : ''
              }`}
              onClick={() => onSelectMessage(message)}
              aria-selected={selectedMessage?.id === message.id}
            >
              <div className="flex justify-between items-center mb-1">
                <p className="font-semibold text-sm text-blue-400">{message.from}</p>
                <p className="text-xs text-gray-500">{new Date(message.timestamp).toLocaleTimeString()}</p>
              </div>
              <p className="text-sm text-gray-300 truncate">
                {message.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default MessageFeed;
