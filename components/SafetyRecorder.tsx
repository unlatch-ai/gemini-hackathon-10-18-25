import React, { useState, useRef, useEffect } from 'react';
import FakeCallUI from './FakeCallUI';

interface SafetyRecorderProps {
  onCodewordDetected?: () => void;
}

interface AgentScores {
  transcript: number;
  emotional: number;
  context: number;
  final: number;
}

const SafetyRecorder: React.FC<SafetyRecorderProps> = ({ onCodewordDetected }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [dangerDetected, setDangerDetected] = useState(false);
  const [callTriggered, setCallTriggered] = useState(false);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [dangerScore, setDangerScore] = useState<number | null>(null);
  const [agentScores, setAgentScores] = useState<AgentScores | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showFakeCall, setShowFakeCall] = useState(false);
  const [testPersona, setTestPersona] = useState<'rachel' | 'adam' | 'bella'>('adam');

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleAcceptCall = () => {
    console.log('✅ SafetyRecorder: handleAcceptCall called - keeping FakeCallUI visible');
    // Don't hide the FakeCallUI - let it handle the internal state transition
    // The FakeCallUI component will switch from ringing to in-call state
  };

  const handleDeclineCall = () => {
    console.log('❌ SafetyRecorder: handleDeclineCall called - hiding FakeCallUI');
    setShowFakeCall(false);
  };

  const startRecording = async () => {
    try {
      console.log('🚀 START RECORDING BUTTON CLICKED');
      setStatus('connecting');

      // Connect to WebSocket (works with ngrok via Vite proxy)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host; // includes port
      const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${host}/ws/live-session`;

      console.log('🔌 Attempting WebSocket connection to:', wsUrl);
      console.log('   Protocol:', protocol);
      console.log('   Host:', host);
      console.log('   Full URL:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('✅ WebSocket CONNECTED successfully!');
        console.log('   ReadyState:', ws.readyState);
        setStatus('connected');

        // Start video + audio recording
        console.log('📹 Requesting camera and microphone permissions...');
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              sampleRate: 16000,
              echoCancellation: true,
              noiseSuppression: true,
            },
            video: {
              facingMode: 'user', // Use 'environment' for rear camera
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });

          streamRef.current = stream;
          console.log('✅ Camera/Mic permissions GRANTED!');
          console.log('   Video tracks:', stream.getVideoTracks().length);
          console.log('   Audio tracks:', stream.getAudioTracks().length);

          // Display video feed
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            console.log('📺 Video feed attached to video element');
          }

          // Create audio-only MediaRecorder for Gemini (simpler than extracting from video)
          const audioStream = new MediaStream(stream.getAudioTracks());
          const mediaRecorder = new MediaRecorder(audioStream, {
            mimeType: 'audio/webm;codecs=opus'
          });
          mediaRecorderRef.current = mediaRecorder;
          console.log('🎙️ MediaRecorder created with codec:', mediaRecorder.mimeType);

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
          console.log('🔴 MediaRecorder STARTED - sending chunks every 1 second');
          setIsRecording(true);
          setStatus('recording');

          // Start timer
          timerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
          }, 1000);
          console.log('⏱️ Recording timer started');

          // Send start recording message
          console.log('📤 Sending start_recording message to backend...');
          ws.send(JSON.stringify({ type: 'start_recording' }));
          console.log('✅ start_recording message sent!');

          // Start Web Speech API for continuous speech recognition
          if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
              const transcript = event.results[event.results.length - 1][0].transcript.trim();
              console.log('🎙️  Heard:', transcript);

              // Add to transcript display
              setTranscripts(prev => [...prev.slice(-10), transcript]); // Keep last 10

              // Send to backend
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'trigger_codeword',
                  text: transcript
                }));
              }
            };

            recognition.onerror = (event: any) => {
              console.error('Speech recognition error:', event.error);
            };

            recognition.start();
            recognitionRef.current = recognition;
            console.log('✅ Speech recognition started');
          } else {
            console.warn('Speech recognition not supported - use button instead');
          }

        } catch (error) {
          console.error('Error accessing camera/microphone:', error);
          setStatus('error');
          alert('Could not access camera/microphone. Please allow permissions.');
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

          case 'analysis_started':
            console.log('🤖 Multi-agent analysis started...');
            setAnalyzing(true);
            break;

          case 'analysis_complete':
            console.log('📊 Multi-agent analysis complete:', data);
            setAnalyzing(false);
            if (data.agentScores) {
              setAgentScores(data.agentScores);
            }
            // Don't set danger detected unless score >= 70
            if (data.dangerScore < 70) {
              setDangerDetected(false);
            }
            break;

          case 'codeword_detected':
            console.log('🚨🚨🚨 DANGER DETECTED! 🚨🚨🚨');
            console.log('   Full data:', data);
            console.log('   Phrase:', data.phrase);
            console.log('   Confidence:', data.confidence);
            console.log('   Agent Scores:', data.agentScores);

            setAnalyzing(false);
            setDangerDetected(true);

            console.log('🎭 Setting showFakeCall to TRUE - ringtone should play now!');
            setShowFakeCall(true);

            setDangerScore(data.confidence ? Math.round(data.confidence * 100) : null);
            // Extract agent scores if available
            if (data.agentScores) {
              setAgentScores(data.agentScores);
            }
            setStatus('danger_detected');
            if (onCodewordDetected) {
              console.log('📞 Calling onCodewordDetected callback');
              onCodewordDetected();
            }
            console.log('✅ Fake call UI should be visible now. showFakeCall =', true);
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
        console.error('❌❌❌ WebSocket ERROR:', error);
        console.error('   Error type:', error.type);
        console.error('   Current readyState:', ws.readyState);
        setStatus('error');
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket CLOSED');
        console.log('   Code:', event.code);
        console.log('   Reason:', event.reason);
        console.log('   Was clean:', event.wasClean);
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

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
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

  const testDangerPhrase = async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('🧪 Testing instant danger keyword detection...');
      wsRef.current.send(JSON.stringify({
        type: 'trigger_codeword',
        text: "danger danger - I'm feeling really unsafe and uncomfortable right now. I want to leave but I can't."
      }));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    if (callTriggered) return 'bg-purple-600';
    if (dangerDetected) return 'bg-red-600 animate-pulse';
    if (isRecording) return 'bg-green-600 animate-pulse';
    return 'bg-gray-600';
  };

  const getStatusText = () => {
    if (callTriggered) return '📞 Emergency Call Triggered';
    if (dangerDetected) return `🚨 Dangerous Situation Detected! (${dangerScore}%)`;
    if (status === 'recording') return '👂 AI Monitoring Active...';
    if (status === 'connecting') return 'Connecting...';
    if (status === 'connected') return 'Connected';
    if (status === 'error') return '❌ Error';
    return 'Not Recording';
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      {showFakeCall && <FakeCallUI onAccept={handleAcceptCall} onDecline={handleDeclineCall} persona={testPersona} />}
      <h2 className="text-2xl font-bold text-white mb-6 text-center">
        🛡️ Safety Monitor
      </h2>

      {/* Video Feed */}
      <div className="mb-6 relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {!isRecording && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <p className="text-gray-400 text-lg">📹 Camera feed will appear here</p>
          </div>
        )}
        {isRecording && (
          <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            REC
          </div>
        )}
      </div>

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

      {/* Live Transcript Display */}
      {isRecording && transcripts.length > 0 && (
        <div className="mb-4 bg-gray-900/50 border border-gray-700 rounded-lg p-4 max-h-32 overflow-y-auto">
          <p className="text-xs text-gray-400 mb-2">Live Transcript (Multi-Agent AI Analysis Every 10s):</p>
          {transcripts.map((text, idx) => (
            <p key={idx} className="text-sm text-gray-300 mb-1">
              • {text}
            </p>
          ))}
        </div>
      )}

      {/* Analyzing Indicator */}
      {analyzing && (
        <div className="mb-4 bg-blue-900/30 border border-blue-500 rounded-lg p-4 animate-pulse">
          <p className="text-center text-blue-300 font-semibold">
            🤖 4 Gemini Agents Analyzing...
          </p>
          <p className="text-center text-xs text-blue-400 mt-1">
            Transcript • Emotional • Context • Threat Assessment
          </p>
        </div>
      )}

      {/* Multi-Agent Analysis Display */}
      {agentScores && !analyzing && (
        <div className="mb-4 bg-gray-900/50 border border-blue-500 rounded-lg p-4">
          <p className="text-sm text-blue-300 font-semibold mb-3">🤝 Multi-Agent Analysis Results:</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">📝 Transcript Agent</div>
              <div className="text-lg font-bold text-white">{agentScores.transcript}%</div>
              <div className="text-xs text-gray-500">Literal content analysis</div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">😰 Emotional Agent</div>
              <div className="text-lg font-bold text-white">{agentScores.emotional}%</div>
              <div className="text-xs text-gray-500">Emotional distress detection</div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">🔍 Context Agent</div>
              <div className="text-lg font-bold text-white">{agentScores.context}%</div>
              <div className="text-xs text-gray-500">Situational dynamics</div>
            </div>
            <div className="bg-gradient-to-br from-red-900 to-orange-900 p-3 rounded border-2 border-red-500">
              <div className="text-xs text-gray-200">⚖️  Threat Assessor</div>
              <div className="text-2xl font-bold text-white">{agentScores.final}%</div>
              <div className="text-xs text-gray-300">Final consensus score</div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Messages */}
      {dangerDetected && !callTriggered && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4">
          <p className="text-red-300 text-center font-semibold">
            🚨 Dangerous situation detected by AI! (Score: {dangerScore}%)
          </p>
          <p className="text-red-200 text-sm text-center mt-1">
            Triggering emergency call...
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
          <>
            <button
              onClick={startRecording}
              disabled={status === 'connecting'}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg"
            >
              {status === 'connecting' ? 'Connecting...' : '🎙️ Start Safety Recording'}
            </button>
            {/* Direct test button with persona selector */}
            <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-3">
              <label className="block text-sm text-purple-300 mb-2">
                Choose Voice Persona:
              </label>
              <select
                value={testPersona}
                onChange={(e) => setTestPersona(e.target.value as 'rachel' | 'adam' | 'bella')}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 mb-3"
              >
                <option value="rachel">👩 Rachel (Mom) - Warm, maternal</option>
                <option value="adam">👨 Adam (Friend) - Casual, friendly</option>
                <option value="bella">👧 Bella (Sister) - Sibling energy</option>
              </select>
              <button
                onClick={() => {
                  console.log(`🧪 TEST BUTTON: Triggering fake call with ${testPersona} persona!`);
                  setShowFakeCall(true);
                }}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                📞 Test Fake Call (Direct)
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={testDangerPhrase}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg"
            >
              🧪 Test Multi-Agent Detection
            </button>
            <button
              onClick={stopRecording}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg"
            >
              ⏹️ Stop Recording
            </button>
          </>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-sm text-blue-300">
          <strong>How it works:</strong>
        </p>
        <ol className="text-sm text-blue-200 mt-2 space-y-1 list-decimal list-inside">
          <li>Click "Start Safety Recording"</li>
          <li>4 specialized Gemini AI agents analyze your conversation every 10 seconds</li>
          <li>If dangerous/uncomfortable situation detected (70%+ confidence)</li>
          <li>You'll automatically receive a fake phone call</li>
          <li>Use the call as an excuse to leave safely</li>
        </ol>
        <p className="text-xs text-gray-400 mt-3">
          Powered by Gemini 2.0 Flash Multi-Agent System
        </p>
      </div>
    </div>
  );
};

export default SafetyRecorder;
