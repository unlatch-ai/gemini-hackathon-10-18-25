import React, { useState, useRef, useEffect } from 'react';

interface SafetyRecorderProps {
  onCodewordDetected?: () => void;
}

const SafetyRecorder: React.FC<SafetyRecorderProps> = ({ onCodewordDetected }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [codewordDetected, setCodewordDetected] = useState(false);
  const [callTriggered, setCallTriggered] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setStatus('connecting');

      // Connect to WebSocket
      const ws = new WebSocket('ws://localhost:3001/ws/live-session');
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('✅ WebSocket connected');
        setStatus('connected');

        // Start audio recording
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              sampleRate: 16000,
              echoCancellation: true,
              noiseSuppression: true,
            }
          });

          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
          });
          mediaRecorderRef.current = mediaRecorder;

          // Send audio chunks to backend
          mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
              // Convert to base64
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                ws.send(JSON.stringify({
                  type: 'audio_chunk',
                  audio: base64
                }));
              };
              reader.readAsDataURL(event.data);
            }
          };

          mediaRecorder.start(1000); // Send chunks every second
          setIsRecording(true);
          setStatus('recording');

          // Start timer
          timerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
          }, 1000);

          // Send start recording message
          ws.send(JSON.stringify({ type: 'start_recording' }));

        } catch (error) {
          console.error('Error accessing microphone:', error);
          setStatus('error');
          alert('Could not access microphone. Please allow microphone permissions.');
        }
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket message:', data);

        switch (data.type) {
          case 'connected':
            console.log('Session ID:', data.sessionId);
            break;

          case 'recording_started':
            console.log('✅ Recording started on server');
            break;

          case 'codeword_detected':
            console.log('🚨 CODEWORD DETECTED!', data);
            setCodewordDetected(true);
            setStatus('codeword_detected');
            if (onCodewordDetected) {
              onCodewordDetected();
            }
            break;

          case 'call_triggered':
            console.log('📞 Call triggered!', data);
            setCallTriggered(true);
            setStatus('call_triggered');
            break;

          case 'call_failed':
            console.error('❌ Call failed:', data.error);
            alert(`Failed to trigger call: ${data.error}`);
            break;

          case 'error':
            console.error('❌ Error:', data.message);
            setStatus('error');
            break;
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setStatus('error');
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setStatus('disconnected');
      };

    } catch (error) {
      console.error('Error starting recording:', error);
      setStatus('error');
      alert('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_recording' }));
      wsRef.current.close();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsRecording(false);
    setStatus('stopped');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    if (callTriggered) return 'bg-purple-600';
    if (codewordDetected) return 'bg-red-600 animate-pulse';
    if (isRecording) return 'bg-green-600 animate-pulse';
    return 'bg-gray-600';
  };

  const getStatusText = () => {
    if (callTriggered) return '📞 Emergency Call Triggered';
    if (codewordDetected) return '🚨 Codeword Detected!';
    if (status === 'recording') return '👂 Monitoring...';
    if (status === 'connecting') return 'Connecting...';
    if (status === 'connected') return 'Connected';
    if (status === 'error') return '❌ Error';
    return 'Not Recording';
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">
        🛡️ Safety Monitor
      </h2>

      {/* Status Indicator */}
      <div className="mb-6">
        <div className={`${getStatusColor()} text-white text-center py-3 px-4 rounded-lg font-semibold`}>
          {getStatusText()}
        </div>
      </div>

      {/* Recording Time */}
      {isRecording && (
        <div className="text-center mb-6">
          <div className="text-5xl font-mono text-white">
            {formatTime(recordingTime)}
          </div>
          <div className="text-sm text-gray-400 mt-2">Recording Duration</div>
        </div>
      )}

      {/* Alert Messages */}
      {codewordDetected && !callTriggered && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4">
          <p className="text-red-300 text-center">
            🚨 Panic codeword detected! Triggering emergency call...
          </p>
        </div>
      )}

      {callTriggered && (
        <div className="bg-purple-500/20 border border-purple-500 rounded-lg p-4 mb-4">
          <p className="text-purple-300 text-center font-semibold">
            📞 Emergency call initiated!
          </p>
          <p className="text-purple-200 text-sm text-center mt-2">
            Answer your phone to receive the fake call scenario.
          </p>
        </div>
      )}

      {/* Control Buttons */}
      <div className="space-y-3">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={status === 'connecting'}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg"
          >
            {status === 'connecting' ? 'Connecting...' : '🎙️ Start Safety Recording'}
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg"
          >
            ⏹️ Stop Recording
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-sm text-blue-300">
          <strong>How it works:</strong>
        </p>
        <ol className="text-sm text-blue-200 mt-2 space-y-1 list-decimal list-inside">
          <li>Click "Start Safety Recording"</li>
          <li>The AI monitors your audio for the panic codeword</li>
          <li>If detected, you'll receive an automated phone call</li>
          <li>Use the call as an excuse to leave the situation</li>
        </ol>
        <p className="text-xs text-gray-400 mt-3">
          Default codeword: "help me mom"
        </p>
      </div>
    </div>
  );
};

export default SafetyRecorder;
