import React, { useState, useEffect, useRef } from 'react';
import FakeCallUI from './FakeCallUI';

const MobileProtection: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [showFakeCall, setShowFakeCall] = useState(false);
  const [dangerDetected, setDangerDetected] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoStreamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Generate session ID
    const newSessionId = `session_${Date.now()}`;
    setSessionId(newSessionId);

    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live-session`;
    console.log('📡 Connecting to WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📥 WebSocket message:', data);

      if (data.type === 'codeword_detected') {
        console.log('🚨 DANGER KEYWORD DETECTED FROM BACKEND!');
        console.log('📹 STARTING VIDEO STREAMING TO DESKTOP NOW!');

        // START VIDEO STREAMING when danger is detected
        startVideoStreaming();

        setDangerDetected(true);
        setShowFakeCall(true);
        // DON'T STOP RECORDING - keep camera and video streaming active during fake call!
        // Desktop can continue seeing live feed from Evangeline's phone
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const recognitionRef = useRef<any>(null);

  const startLocationTracking = () => {
    console.log('📍 Starting location tracking...');

    const sendLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            console.log(`📍 Location: ${latitude}, ${longitude}`);

            // Send location to desktop via WebSocket
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'location_update',
                sessionId,
                latitude,
                longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date().toISOString()
              }));
            }
          },
          (error) => {
            console.warn('⚠️ Geolocation error:', error.message);
            // Send fallback location (San Francisco Ferry Building)
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'location_update',
                sessionId,
                latitude: 37.7955,
                longitude: -122.3937,
                accuracy: 20,
                timestamp: new Date().toISOString(),
                fallback: true
              }));
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          }
        );
      }
    };

    // Send location immediately
    sendLocation();

    // Send location every 5 seconds
    locationIntervalRef.current = setInterval(sendLocation, 5000);
  };

  const stopLocationTracking = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
      console.log('📍 Location tracking stopped');
    }
  };

  const startVideoStreaming = () => {
    console.log('📹 Starting video streaming to desktop...');

    const captureAndSendFrame = () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {  // HAVE_ENOUGH_DATA = 4, but >= 2 (HAVE_CURRENT_DATA) works
        // Create canvas to capture frame
        const canvas = document.createElement('canvas');
        canvas.width = 320; // Smaller size for performance
        canvas.height = 240;
        const ctx = canvas.getContext('2d');

        if (ctx && videoRef.current) {
          // Draw current video frame
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

          // Convert to base64 JPEG (compressed)
          const frameData = canvas.toDataURL('image/jpeg', 0.7);

          console.log('📤 Sending video frame to desktop (frame size:', frameData.length, 'chars)');

          // Send to desktop via WebSocket
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'video_frame',
              sessionId,
              frame: frameData,
              timestamp: new Date().toISOString()
            }));
            console.log('✅ Video frame sent successfully');
          } else {
            console.warn('⚠️ WebSocket not open, cannot send frame');
          }
        } else {
          console.warn('⚠️ Cannot capture frame - canvas or video not ready');
        }
      } else {
        console.warn('⚠️ Video not ready for capture, readyState:', videoRef.current?.readyState);
      }
    };

    // Clear any existing interval first
    if (videoStreamIntervalRef.current) {
      clearInterval(videoStreamIntervalRef.current);
    }

    // Send first frame IMMEDIATELY
    captureAndSendFrame();

    // Then send more frames quickly at first (every 500ms for first 3 seconds)
    let frameCount = 0;
    videoStreamIntervalRef.current = setInterval(() => {
      captureAndSendFrame();
      frameCount++;
      if (frameCount >= 6) {  // After 6 fast frames (3 seconds)
        clearInterval(videoStreamIntervalRef.current!);
        // Switch to normal interval (every 1.5 seconds)
        videoStreamIntervalRef.current = setInterval(captureAndSendFrame, 1500);
        console.log('📹 Switched to normal streaming rate (1.5s intervals)');
      }
    }, 500);

    console.log('✅ Video streaming started (fast mode: 500ms intervals for first 3s)');
  };

  const stopVideoStreaming = () => {
    if (videoStreamIntervalRef.current) {
      clearInterval(videoStreamIntervalRef.current);
      videoStreamIntervalRef.current = null;
      console.log('📹 Video streaming stopped');
    }
  };

  const startRecording = async () => {
    try {
      console.log('🎥 Starting recording...');

      // Request permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });

      streamRef.current = stream;

      // Attach stream to video element for frame capture
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }

      // Start video recording
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Could store chunks if needed for evidence
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

      // Start location tracking
      startLocationTracking();

      // DON'T start video streaming yet - only when danger is detected
      // This saves bandwidth and privacy until actually needed

      // Notify backend that recording started
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'start_recording',
          sessionId
        }));
      }

      // Start continuous speech recognition for danger keyword
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.toLowerCase();
            console.log('🎤 Heard:', transcript);

            // Check for danger keyword
            if (transcript.includes('danger')) {
              console.log('🚨 DANGER KEYWORD DETECTED IN SPEECH!');
              console.log('📹 STARTING VIDEO STREAMING TO DESKTOP NOW!');

              // START VIDEO STREAMING when danger is detected
              startVideoStreaming();

              // Trigger fake call immediately
              setDangerDetected(true);
              setShowFakeCall(true);
              // DON'T STOP RECORDING - keep camera and video streaming active!
              // The camera will continue streaming to desktop during the fake call

              // Notify desktop
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: 'trigger_codeword',
                  text: transcript
                }));
              }

              // Stop speech recognition (we already detected danger)
              recognition.stop();
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          if (event.error === 'no-speech') {
            // Restart recognition
            setTimeout(() => {
              if (mediaRecorderRef.current?.state === 'recording') {
                recognition.start();
              }
            }, 1000);
          }
        };

        recognition.onend = () => {
          // Auto-restart recognition if still recording
          if (mediaRecorderRef.current?.state === 'recording') {
            setTimeout(() => recognition.start(), 100);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        console.log('👂 Listening for "danger" keyword...');
      }

      console.log('✅ Recording started');

    } catch (error) {
      console.error('❌ Error starting recording:', error);
      alert('Please allow camera and microphone access to use this app.');
    }
  };

  const stopRecording = () => {
    console.log('⏹️ Stopping recording...');

    // Stop location tracking
    stopLocationTracking();

    // Stop video streaming
    stopVideoStreaming();

    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Speech recognition already stopped');
      }
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // Stop all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsRecording(false);

    // Notify backend
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'stop_recording',
        sessionId
      }));
    }
  };

  const handleAcceptCall = () => {
    console.log('✅ User accepted fake call');
  };

  const handleDeclineCall = () => {
    console.log('❌ User declined fake call');
    setShowFakeCall(false);
    setDangerDetected(false);
  };

  const handleManualTrigger = () => {
    console.log('🧪 Manual trigger - simulating danger detection');
    console.log('📹 STARTING VIDEO STREAMING TO DESKTOP NOW!');

    // START VIDEO STREAMING when danger is detected
    startVideoStreaming();

    setDangerDetected(true);
    setShowFakeCall(true);
    // DON'T STOP RECORDING - keep camera and video streaming active during fake call!
  };

  // Main mobile interface
  return (
    <>
      {/* Hidden video element for frame capture - MUST remain mounted during fake call */}
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        playsInline
        muted
      />

      {/* If fake call is showing, render that full-screen over everything */}
      {showFakeCall ? (
        <FakeCallUI onAccept={handleAcceptCall} onDecline={handleDeclineCall} persona="adam" />
      ) : (
        <div className="min-h-screen bg-black text-white flex flex-col">
          {/* Status */}
          <div className="flex-1 flex flex-col items-center justify-between p-6">
        {!isRecording ? (
          <>
            {/* Header with settings icon */}
            <div className="w-full flex justify-end pt-4">
              <button className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center">
                <span className="text-2xl">+</span>
              </button>
            </div>

            {/* Title and Start Button - centered together */}
            <div className="flex-1 flex flex-col items-center justify-center space-y-12">
              <h1 className="text-4xl font-bold">Guardian Agent</h1>

              {/* Start Button - separated from title */}
              <button
                onClick={startRecording}
                className="w-full max-w-sm bg-orange-500 hover:bg-orange-600 text-black font-bold py-6 px-8 rounded-full text-3xl shadow-lg transform transition hover:scale-105"
              >
                Start
              </button>
            </div>

            {/* Emergency Contacts - pushed to bottom with spacing */}
            <div className="w-full space-y-4 mb-8 mt-auto">
              <button className="w-full border-2 border-white text-white font-semibold py-4 px-6 rounded-full text-lg flex items-center justify-center gap-3">
                <span className="text-xl">📞</span>
                Emergency Contact
              </button>

              <button className="w-full border-2 border-red-600 text-red-600 font-bold py-4 px-6 rounded-full text-xl">
                CALL 911
              </button>
            </div>

            {/* Bottom indicator */}
            <div className="w-32 h-1 bg-white rounded-full mb-2"></div>
          </>
        ) : (
          <>
            {/* Recording Active - Clean UI */}
            <div className="w-full flex justify-end pt-4">
              <div className="text-red-500 text-sm font-semibold flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                LIVE
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
              <div className="relative">
                <div className="w-40 h-40 bg-red-500 rounded-full mx-auto animate-pulse flex items-center justify-center shadow-2xl">
                  <span className="text-7xl">🎙️</span>
                </div>
                <div className="absolute inset-0 w-40 h-40 bg-red-500 rounded-full mx-auto animate-ping opacity-20"></div>
              </div>

              <div>
                <h2 className="text-3xl font-bold mb-3">Guardian Active</h2>
                <p className="text-gray-400 text-lg max-w-md">
                  Monitoring your surroundings
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Say <span className="text-red-400 font-bold">"danger"</span> if you need help
                </p>
              </div>

              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 max-w-sm w-full">
                <p className="text-xs text-gray-500 mb-1">Session ID</p>
                <p className="text-sm font-mono text-gray-300">{sessionId.slice(-12)}</p>
              </div>
            </div>

            <div className="w-full space-y-4 mb-8">
              <button
                onClick={handleManualTrigger}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 px-6 rounded-full text-lg shadow-lg"
              >
                🧪 Test Emergency Call
              </button>

              <button
                onClick={stopRecording}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-full text-lg shadow-lg"
              >
                Stop Recording
              </button>
            </div>

            {/* Bottom indicator */}
            <div className="w-32 h-1 bg-white rounded-full mb-2"></div>
          </>
        )}

        {dangerDetected && !showFakeCall && (
          <div className="mt-6 bg-red-500/20 border border-red-500 rounded-lg p-4 max-w-md animate-pulse">
            <p className="text-red-400 font-bold text-center">
              🚨 Danger detected! Triggering emergency call...
            </p>
          </div>
        )}
      </div>
    </div>
      )}
    </>
  );
};

export default MobileProtection;
