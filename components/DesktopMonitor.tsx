import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
  timestamp: string;
  type: 'info' | 'warning' | 'danger';
  message: string;
}

interface SessionInfo {
  sessionId: string;
  connected: boolean;
  recording: boolean;
  dangerScore: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    accuracy: number;
    timestamp: string;
    fallback?: boolean;
  };
  agentScores?: {
    transcript: number;
    emotional: number;
    context: number;
    threat: number;
  };
  videoFrame?: string; // Base64 JPEG frame
  lastFrameTime?: string;
}

const DesktopMonitor: React.FC = () => {
  const [sessions, setSessions] = useState<Map<string, SessionInfo>>(new Map());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dangerTriggered, setDangerTriggered] = useState(false);
  const [visionAnalysis, setVisionAnalysis] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);

  const addLog = (type: 'info' | 'warning' | 'danger', message: string) => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    };
    setLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100 logs
  };

  // Reverse geocode coordinates to address
  const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
    try {
      // Use OpenStreetMap Nominatim (free, no API key needed)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
      );
      const data = await response.json();
      return data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    } catch (error) {
      console.warn('Geocoding failed, using coordinates');
      return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
  };

  useEffect(() => {
    // Connect to WebSocket for monitoring
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live-session`;

    addLog('info', `Connecting to monitoring system: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      addLog('info', '✅ Connected to monitoring system');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📥 Desktop received:', data);

      switch (data.type) {
        case 'connected':
          addLog('info', `Session ${data.sessionId} initialized`);
          break;

        case 'recording_started':
          addLog('info', `📱 Phone started recording - Session: ${data.sessionId}`);
          setSessions(prev => {
            const newMap = new Map(prev);
            newMap.set(data.sessionId, {
              sessionId: data.sessionId,
              connected: true,
              recording: true,
              dangerScore: 0
            });
            return newMap;
          });
          break;

        case 'analysis_started':
          addLog('info', `🤖 AI analysis in progress for ${data.sessionId}`);
          break;

        case 'analysis_complete':
          const score = data.dangerScore || 0;
          const logType = score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'info';
          addLog(
            logType,
            `📊 Analysis complete: Danger score ${score}% - Transcript: ${data.agentScores?.transcript || 0}%, Emotional: ${data.agentScores?.emotional || 0}%, Context: ${data.agentScores?.context || 0}%, Threat: ${data.agentScores?.threat || 0}%`
          );

          setSessions(prev => {
            const newMap = new Map(prev);
            const session = newMap.get(data.sessionId);
            if (session) {
              session.dangerScore = score;
              session.agentScores = data.agentScores;
              newMap.set(data.sessionId, session);
            }
            return newMap;
          });
          break;

        case 'codeword_detected':
          addLog('danger', `🚨 DANGER KEYWORD DETECTED! Triggering fake call on phone...`);
          addLog('danger', `   Phrase: "${data.phrase}"`);
          addLog('danger', `   Confidence: ${data.confidence}`);
          addLog('info', `📹 Camera and video streaming remain ACTIVE - monitoring situation`);
          setDangerTriggered(true);
          setTimeout(() => setDangerTriggered(false), 10000);
          break;

        case 'location_update':
          const { latitude, longitude, accuracy, timestamp, fallback } = data;
          addLog('info', `📍 Location update: ${latitude.toFixed(4)}, ${longitude.toFixed(4)} (±${Math.round(accuracy)}m)`);

          // Update session with location and get address
          (async () => {
            const address = await reverseGeocode(latitude, longitude);
            setSessions(prev => {
              const newMap = new Map(prev);
              const session = newMap.get(data.sessionId);
              if (session) {
                session.location = {
                  latitude,
                  longitude,
                  address,
                  accuracy,
                  timestamp,
                  fallback
                };
                newMap.set(data.sessionId, session);
              }
              return newMap;
            });
            if (!fallback) {
              addLog('info', `📍 Address: ${address}`);
            }
          })();
          break;

        case 'video_frame':
          // Update session with latest video frame
          console.log('📹 Video frame received for session:', data.sessionId);
          setSessions(prev => {
            const newMap = new Map(prev);
            let session = newMap.get(data.sessionId);

            // Create session if it doesn't exist yet
            if (!session) {
              console.warn('⚠️ Session not found, creating it now');
              session = {
                sessionId: data.sessionId,
                connected: true,
                recording: true,
                dangerScore: 0
              };
            }

            session.videoFrame = data.frame;
            session.lastFrameTime = data.timestamp;
            newMap.set(data.sessionId, session);

            console.log('✅ Updated session with video frame, total sessions:', newMap.size);
            return newMap;
          });
          break;

        case 'vision_analysis':
          // AI safety analysis from Gemini Vision
          console.log('🤖 Vision analysis received:', data.analysis);
          setVisionAnalysis(data.analysis);
          addLog('info', `🤖 AI Analysis: ${data.analysis.substring(0, 60)}...`);
          break;

        case 'error':
          addLog('warning', `⚠️ Error: ${data.message}`);
          break;
      }
    };

    ws.onerror = (error) => {
      addLog('danger', '❌ WebSocket connection error');
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      addLog('warning', '🔌 Disconnected from monitoring system');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const activeSessions = Array.from(sessions.values()).filter(s => s.connected);

  // Only log on significant changes to avoid spam
  if (activeSessions.length > 0 && activeSessions[0].videoFrame) {
    const frameSize = activeSessions[0].videoFrame.length;
    if (Math.random() < 0.1) {  // Log 10% of the time
      console.log('🖥️ Desktop showing video - Frame size:', frameSize, 'chars, Last update:', activeSessions[0].lastFrameTime);
    }
  } else if (activeSessions.length > 0) {
    console.log('⚠️ Desktop has session but no video frame yet');
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-purple-900 border-b border-blue-500/30 p-6">
        <h1 className="text-3xl font-bold">🖥️ SafeGuard Control Center</h1>
        <p className="text-blue-200 mt-2">Real-time monitoring and threat detection dashboard</p>
      </div>

      {/* Danger Alert Banner */}
      {dangerTriggered && (
        <div className="bg-red-600 border-b-4 border-red-800 px-6 py-4 animate-pulse">
          <p className="text-2xl font-bold text-white text-center">
            🚨 DANGER DETECTED - EMERGENCY CALL TRIGGERED ON PHONE 📞
          </p>
          <p className="text-lg text-white text-center mt-2">
            📹 Camera and video streaming remain ACTIVE - monitoring situation
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        {/* Live Video Feed - Large Display */}
        <div className="lg:col-span-7 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>📹</span>
            <span>Live Camera Feed</span>
            {activeSessions.length > 0 && activeSessions[0].videoFrame && (
              <span className="ml-auto text-sm bg-red-500 px-2 py-1 rounded-full animate-pulse">
                🔴 LIVE
              </span>
            )}
          </h2>

          {/* AI Safety Analysis Banner */}
          {visionAnalysis && (
            <div className="mb-4 p-4 bg-blue-900/40 border border-blue-500/50 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🤖</span>
                <div className="flex-1">
                  <h3 className="font-bold text-blue-300 mb-1">Gemini AI Safety Analysis</h3>
                  <p className="text-sm text-gray-200">{visionAnalysis}</p>
                </div>
              </div>
            </div>
          )}

          {activeSessions.length > 0 && activeSessions[0].videoFrame ? (
            <div className="relative">
              <img
                src={activeSessions[0].videoFrame}
                alt="Live feed from mobile camera"
                className="w-full rounded-lg border-2 border-purple-500"
                style={{ minHeight: '400px', maxHeight: '600px', objectFit: 'contain', backgroundColor: '#000' }}
              />
              <div className="absolute bottom-4 left-4 bg-black/80 px-3 py-2 rounded-lg text-sm">
                <span className="text-purple-400">📱 Mobile Camera</span>
                {activeSessions[0].lastFrameTime && (
                  <span className="text-gray-400 ml-3">
                    {new Date(activeSessions[0].lastFrameTime).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center" style={{ minHeight: '400px' }}>
              <div className="text-6xl mb-4">📷</div>
              <p className="text-xl text-gray-400 mb-2">No Video Feed</p>
              <p className="text-sm text-gray-500">
                {activeSessions.length === 0
                  ? 'Waiting for mobile to connect and start recording...'
                  : 'Camera not active. Say "gemini" to activate emergency mode.'}
              </p>
            </div>
          )}
        </div>

        {/* Active Sessions Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>📱</span>
            <span>Active Sessions</span>
            <span className="ml-auto text-sm bg-blue-500 px-2 py-1 rounded-full">
              {activeSessions.length}
            </span>
          </h2>

          {activeSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-4xl mb-2">📵</p>
              <p>No active sessions</p>
              <p className="text-sm mt-2">Waiting for phone to connect...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSessions.map(session => (
                <div
                  key={session.sessionId}
                  className={`p-4 rounded-lg border ${
                    session.dangerScore >= 70
                      ? 'bg-red-900/30 border-red-500'
                      : session.dangerScore >= 40
                      ? 'bg-yellow-900/30 border-yellow-500'
                      : 'bg-green-900/30 border-green-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-mono text-gray-400">
                      {session.sessionId.slice(-8)}
                    </span>
                    {session.recording && (
                      <span className="text-xs bg-red-500 px-2 py-1 rounded-full animate-pulse">
                        🔴 REC
                      </span>
                    )}
                  </div>

                  <div className="mt-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Danger Score</span>
                      <span className="font-bold">{session.dangerScore}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          session.dangerScore >= 70
                            ? 'bg-red-500'
                            : session.dangerScore >= 40
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${session.dangerScore}%` }}
                      ></div>
                    </div>
                  </div>

                  {session.location && (
                    <div className="mt-3 p-2 bg-blue-900/30 border border-blue-500/30 rounded text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-blue-400">📍</span>
                        <span className="font-bold text-blue-300">Location</span>
                        {session.location.fallback && (
                          <span className="text-xs text-yellow-400">(Simulated)</span>
                        )}
                      </div>
                      <div className="text-gray-300">
                        {session.location.address || 'Fetching address...'}
                      </div>
                      <div className="text-gray-500 text-xs mt-1">
                        {session.location.latitude.toFixed(5)}, {session.location.longitude.toFixed(5)}
                        <span className="ml-2">±{Math.round(session.location.accuracy)}m</span>
                      </div>
                    </div>
                  )}

                  {session.agentScores && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-400">Transcript:</span>
                        <span className="ml-1 font-bold">{session.agentScores.transcript}%</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Emotional:</span>
                        <span className="ml-1 font-bold">{session.agentScores.emotional}%</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Context:</span>
                        <span className="ml-1 font-bold">{session.agentScores.context}%</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Threat:</span>
                        <span className="ml-1 font-bold">{session.agentScores.threat}%</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <h3 className="font-bold text-sm mb-2">📲 Mobile Setup</h3>
            <p className="text-xs text-gray-400">
              Open this URL on your phone:<br/>
              <code className="bg-gray-800 px-2 py-1 rounded text-blue-400 mt-1 inline-block">
                {window.location.origin}/mobile
              </code>
            </p>
          </div>
          </div>

          {/* Activity Log */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>📋</span>
            <span>Activity Log</span>
            <span className="ml-auto text-sm bg-gray-700 px-2 py-1 rounded-full">
              {logs.length} events
            </span>
          </h2>

          <div className="bg-black rounded-lg p-4 h-[400px] overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-center text-gray-600 py-8">
                <p>Waiting for activity...</p>
              </div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`mb-2 pb-2 border-b border-gray-800 ${
                    log.type === 'danger'
                      ? 'text-red-400'
                      : log.type === 'warning'
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  }`}
                >
                  <span className="text-gray-600">[{log.timestamp}]</span>{' '}
                  <span>{log.message}</span>
                </div>
              ))
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-800 border-t border-gray-700 p-4 text-center text-sm text-gray-500">
        SafeGuard Control Center v1.0 | Monitoring System Active
      </div>
    </div>
  );
};

export default DesktopMonitor;
