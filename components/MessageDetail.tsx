import React from 'react';
import type { Message } from '../types';

interface MessageDetailProps {
  message: Message | null;
}

const MessageDetail: React.FC<MessageDetailProps> = ({ message }) => {
  if (!message) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 flex items-center justify-center h-full">
        <p className="text-gray-400">Select a message to see details</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Message Details</h2>
        <p className="text-sm text-gray-400">ID: {message.id}</p>
      </div>
      <div className="p-4 space-y-6">
        {/* Original Message */}
        <div>
          <h3 className="font-semibold text-blue-400 mb-2">Original Message</h3>
          <div className="bg-gray-900/50 p-3 rounded-md">
            <p className="text-gray-300 whitespace-pre-wrap">{message.text}</p>
            <p className="text-xs text-gray-500 mt-2 text-right">{new Date(message.timestamp).toLocaleString()}</p>
          </div>
        </div>

        {/* Gemini Analysis */}
        <div>
          <h3 className="font-semibold text-purple-400 mb-2">Gemini Analysis</h3>
          <div className="bg-gray-900/50 p-3 rounded-md grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Request Type</p>
              <p className="text-gray-200">{message.analysis.requestType}</p>
            </div>
            <div>
              <p className="text-gray-500">Confidence</p>
              <p className="text-gray-200">{(message.analysis.confidence * 100).toFixed(0)}%</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">Location</p>
              <p className="text-gray-200">{message.analysis.location}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">Details</p>
              <p className="text-gray-200">{message.analysis.details}</p>
            </div>
          </div>
        </div>

        {/* Automation Log */}
        <div>
          <h3 className="font-semibold text-green-400 mb-2">Automation Log</h3>
          <div className="bg-black p-3 rounded-md font-mono text-xs text-gray-400 max-h-60 overflow-y-auto">
            {message.automationLog.map((log, index) => {
              const isSkipped = log.includes('SKIPPED');
              return (
                <p key={index} className={`whitespace-pre-wrap ${isSkipped ? 'text-yellow-400 font-bold' : ''}`}>
                  <span className="text-gray-600 mr-2">{'>'}</span>{log}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageDetail;