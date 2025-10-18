/**
 * In-memory storage for messages and requests
 * In production, replace this with a real database (PostgreSQL, MongoDB, etc.)
 */

export const storage = {
  messages: [],
  requests: [],
};

/**
 * Add a new message to storage
 */
export function addMessage(message) {
  storage.messages.push(message);
  return message;
}

/**
 * Add a new request to storage
 */
export function addRequest(request) {
  storage.requests.push(request);
  return request;
}

/**
 * Get all messages
 */
export function getMessages() {
  return storage.messages;
}

/**
 * Get all requests
 */
export function getRequests() {
  return storage.requests;
}

/**
 * Get message by ID
 */
export function getMessageById(id) {
  return storage.messages.find(msg => msg.id === id);
}

/**
 * Update request status
 */
export function updateRequestStatus(id, status, sf311CaseId) {
  const request = storage.requests.find(req => req.id === id);
  if (request) {
    request.status = status;
    if (sf311CaseId) {
      request.sf311CaseId = sf311CaseId;
    }
  }
  return request;
}

/**
 * Clear all data (for testing)
 */
export function clearAll() {
  storage.messages = [];
  storage.requests = [];
}
