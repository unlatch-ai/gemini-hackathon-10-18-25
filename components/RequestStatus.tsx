import React from 'react';
import type { Request } from '../types';
import { RequestStatus as RequestStatusEnum } from '../types';

interface RequestStatusProps {
  requests: Request[];
}

const getStatusColor = (status: RequestStatusEnum) => {
  switch (status) {
    case RequestStatusEnum.SUBMITTED:
      return 'bg-green-500/80 text-green-50';
    case RequestStatusEnum.PROCESSING:
      return 'bg-yellow-500/80 text-yellow-50';
    case RequestStatusEnum.FAILED:
      return 'bg-red-500/80 text-red-50';
    case RequestStatusEnum.PENDING:
    default:
      return 'bg-gray-500/80 text-gray-50';
  }
};

const RequestStatus: React.FC<RequestStatusProps> = ({ requests }) => {
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">311 Request Status</h2>
      </div>
      <div className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
              <tr>
                <th scope="col" className="px-4 py-3">Request Type</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">SF 311 Case ID</th>
                <th scope="col" className="px-4 py-3">Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium text-gray-200">{request.requestType}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 font-mono">{request.sf311CaseId || 'N/A'}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(request.submittedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RequestStatus;
