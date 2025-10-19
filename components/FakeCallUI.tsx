import React, { useEffect, useRef, useState } from 'react';

// Add global animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.7);
      }
      50% {
        transform: scale(1.05);
        box-shadow: 0 0 0 20px rgba(255, 59, 48, 0);
      }
      100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(255, 59, 48, 0);
      }
    }
    @keyframes wave {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-10px);
      }
    }
  `;
  if (!document.head.querySelector('style[data-fake-call-animations]')) {
    style.setAttribute('data-fake-call-animations', 'true');
    document.head.appendChild(style);
  }
}

interface FakeCallUIProps {
  onAccept?: () => void;
  onDecline: () => void;
  persona?: 'rachel' | 'adam' | 'bella';
}

const FakeCallUI: React.FC<FakeCallUIProps> = ({ onAccept, onDecline, persona = 'adam' }) => {
  const ringtoneRef = useRef<HTMLAudioElement>(null);
  const agentAudioRef = useRef<HTMLAudioElement>(null);
  const [inCall, setInCall] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const fullTranscriptRef = useRef<string>('');
  const [greetingAudioUrl, setGreetingAudioUrl] = useState<string | null>(null);
  const [isLoadingGreeting, setIsLoadingGreeting] = useState(true);
  const greetingAudioUrlRef = useRef<string | null>(null); // Store URL for cleanup

  // Voice personas configuration
  const personas = {
    rachel: {
      name: "Mom",
      greeting: "Hey sweetie, it's mom. Something urgent came up with your dad and I really need you to come home right now. Can you leave and head over?",
      voice: "Rachel",
      callerInfo: "Mom • Mobile"
    },
    adam: {
      name: "Alex",
      greeting: "Hey! I'm almost at the ferry building. Can you come meet me right now? It's urgent!",
      voice: "Adam",
      callerInfo: "Alex • iPhone"
    },
    bella: {
      name: "Sarah",
      greeting: "Hey sis! Emergency with the apartment. Can you come help me right away? Please!",
      voice: "Bella",
      callerInfo: "Sarah • Mobile"
    }
  };

  const currentPersona = personas[persona];

  console.log('🎭🎭🎭 FakeCallUI COMPONENT RENDERED!');
  console.log('   Persona:', persona, '→', currentPersona.name);

  useEffect(() => {
    console.log('🔔 FakeCallUI mounted - starting ringtone and preloading greeting...');
    console.log('   Persona prop:', persona);

    // Start ringtone after a small delay to ensure ref is attached
    const playRingtone = () => {
      if (ringtoneRef.current) {
        console.log('   Ringtone element found, calling play()');
        ringtoneRef.current.play().catch(error => {
          console.error('❌ Error playing ringtone:', error);
        });
      } else {
        console.error('❌ Ringtone ref is null!');
      }
    };

    // Delay ringtone slightly to ensure DOM is ready
    const ringtoneTimeout = setTimeout(playRingtone, 100);

    // Preload greeting audio in background
    const preloadGreeting = async () => {
      try {
        const greeting = currentPersona.greeting;
        const voice = currentPersona.voice;
        const url = `/api/live/elevenlabs-audio?text=${encodeURIComponent(greeting)}&voice=${voice}`;

        console.log('📥 Preloading greeting audio...');
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        console.log('✅ Greeting audio preloaded and ready!');
        greetingAudioUrlRef.current = audioUrl; // Store in ref for cleanup
        setGreetingAudioUrl(audioUrl);
        setIsLoadingGreeting(false);
      } catch (error) {
        console.error('❌ Error preloading greeting:', error);
        setIsLoadingGreeting(false);
      }
    };

    preloadGreeting();

    return () => {
      clearTimeout(ringtoneTimeout);

      // Clean up audio on unmount
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }

      // Clean up blob URL to prevent memory leaks
      if (greetingAudioUrlRef.current) {
        URL.revokeObjectURL(greetingAudioUrlRef.current);
        greetingAudioUrlRef.current = null;
      }
    };
  }, [persona]); // FIXED: Only depend on persona prop, not currentPersona object

  const getInitialMessage = async () => {
    console.log('📞📞📞 getInitialMessage() CALLED');
    console.log('   greetingAudioUrlRef.current:', greetingAudioUrlRef.current);
    console.log('   greetingAudioUrl state:', greetingAudioUrl);
    setIsAgentSpeaking(true);

    // Use REF instead of state for more reliable checking
    const audioUrl = greetingAudioUrlRef.current || greetingAudioUrl;

    if (audioUrl && agentAudioRef.current) {
      console.log('🚀 Using preloaded greeting - INSTANT PLAYBACK!');
      agentAudioRef.current.src = audioUrl;

      const playPromise = agentAudioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('✅✅✅ Greeting audio PLAYING instantly!');
          })
          .catch(error => {
            console.error('❌ Play failed:', error);
            setIsAgentSpeaking(false);
          });
      }

      agentAudioRef.current.onended = () => {
        console.log('🎤 Agent finished speaking, auto-starting listening...');
        setIsAgentSpeaking(false);
        // Auto-start listening for user response
        setTimeout(() => startAutoListening(), 500);
      };
    } else {
      console.error('❌❌❌ NO PRELOADED AUDIO! This should not happen!');
      console.error('   audioUrl:', audioUrl);
      console.error('   agentAudioRef.current:', agentAudioRef.current);
      setIsAgentSpeaking(false);

      // Emergency fallback - show error to user
      alert('Audio not ready. Please wait a moment and try again.');
    }
  };

  const startAutoListening = async () => {
    console.log('🎧 START AUTO LISTENING');
    setIsListening(true);
    setInterimTranscript('');
    fullTranscriptRef.current = '';

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('❌ SpeechRecognition not supported');
      alert('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let speechEndTimeout: NodeJS.Timeout | null = null;
    let hasSpokenSomething = false;

    recognition.onstart = () => {
      console.log('🎤 Voice detection started');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let newFinalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinalTranscript += transcript + ' ';
          hasSpokenSomething = true;
          console.log('📝 Final transcript:', transcript);
        } else {
          interim += transcript;
        }
      }

      // Update full transcript
      if (newFinalTranscript) {
        fullTranscriptRef.current += newFinalTranscript;
      }

      // Show interim or accumulated final transcript
      setInterimTranscript(interim || fullTranscriptRef.current.trim());

      // Reset timeout - user is still speaking
      if (speechEndTimeout) {
        clearTimeout(speechEndTimeout);
      }

      // Wait 2 seconds after last speech to stop
      speechEndTimeout = setTimeout(() => {
        if (hasSpokenSomething && fullTranscriptRef.current.trim()) {
          console.log('🛑 2 seconds of silence detected - sending transcript');
          console.log('   Full transcript:', fullTranscriptRef.current.trim());
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
        }
      }, 2000);
    };

    recognition.onend = () => {
      console.log('🛑 Voice detection ended');
      const finalText = fullTranscriptRef.current.trim();
      setIsListening(false);
      setInterimTranscript('');

      if (finalText) {
        console.log('✅ Sending text to agent:', finalText);
        sendTextToAgent(finalText);
      } else {
        console.warn('⚠️ No speech detected, restarting listening');
        setTimeout(() => startAutoListening(), 500);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('❌ Speech recognition error:', event.error);
      setIsListening(false);

      // If no speech detected, restart after a moment
      if (event.error === 'no-speech') {
        console.log('   No speech detected, restarting...');
        setTimeout(() => startAutoListening(), 1000);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();

    // Failsafe: Auto-stop after 15 seconds regardless
    setTimeout(() => {
      if (recognitionRef.current) {
        console.log('⏱️ Failsafe: Auto-stopping after 15 seconds');
        recognitionRef.current.stop();
      }
    }, 15000);
  };

  const sendTextToAgent = async (text: string) => {
    console.log('📤📤📤 sendTextToAgent() CALLED');
    console.log('   Text:', text);
    setIsAgentSpeaking(true);
    try {
      const url = `/api/live/converse-text?persona=${persona}&text=${encodeURIComponent(text)}`;
      console.log('💬 Sending your text to agent...');
      console.log('   URL:', url);
      console.log('   Persona:', persona, '→', currentPersona.name);

      const response = await fetch(url);

      console.log('📥 Response from /api/live/converse-text:', response.status, response.statusText);
      console.log('   Content-Type:', response.headers.get('content-type'));
      console.log('   Content-Length:', response.headers.get('content-length'));

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseAudioBlob = await response.blob();
      console.log('🎵 Agent response audio blob:', responseAudioBlob.size, 'bytes, type:', responseAudioBlob.type);

      const audioUrl = URL.createObjectURL(responseAudioBlob);
      console.log('🔗 Audio URL created:', audioUrl);
      console.log('✅ Got agent response, playing...');

      if (agentAudioRef.current) {
        console.log('   Setting audio src and playing...');
        agentAudioRef.current.src = audioUrl;

        const playPromise = agentAudioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('✅✅✅ Agent response audio PLAYING!');
            })
            .catch(error => {
              console.error('❌ Play failed:', error);
              setIsAgentSpeaking(false);
            });
        }

        agentAudioRef.current.onended = () => {
          console.log('🎤 Agent finished response, auto-starting listening...');
          setIsAgentSpeaking(false);
          // Auto-start listening for next user input
          setTimeout(() => startAutoListening(), 500);
        };
      } else {
        console.error('❌ agentAudioRef.current is NULL!');
        setIsAgentSpeaking(false);
      }
    } catch (error: any) {
      console.error('❌❌❌ Error sending text to agent:', error);
      console.error('   Error details:', error.message, error.stack);
      setIsAgentSpeaking(false);
      // Restart listening if error
      setTimeout(() => startAutoListening(), 1000);
    }
  };

  const handleAccept = () => {
    console.log('📞📞📞 ACCEPT BUTTON CLICKED!');
    console.log('   Pausing ringtone...');
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      console.log('   ✅ Ringtone paused');
    } else {
      console.warn('   ⚠️ Ringtone ref is null');
    }
    console.log('   Setting inCall to TRUE');
    setInCall(true);

    // Call parent callback if provided
    if (onAccept) {
      console.log('   Calling onAccept callback...');
      onAccept();
    }

    console.log('   Calling getInitialMessage()...');
    getInitialMessage();
  };

  return (
    <div style={styles.container}>
      <audio ref={agentAudioRef} />
      {!inCall ? (
        <>
          <audio
            ref={ringtoneRef}
            src="/sounds/ringtone.mp3"
            loop
            preload="auto"
          />
          <div style={styles.callerInfo}>
            <h1 style={styles.callerName}>{currentPersona.name}</h1>
            <p style={styles.callStatus}>{currentPersona.callerInfo}</p>
          </div>
          <div style={styles.buttonContainer}>
            <button style={{...styles.button, ...styles.declineButton}} onClick={onDecline}>
              Decline
            </button>
            <button
              style={{
                ...styles.button,
                ...styles.acceptButton,
                opacity: isLoadingGreeting ? 0.5 : 1,
                cursor: isLoadingGreeting ? 'not-allowed' : 'pointer'
              }}
              onClick={handleAccept}
              disabled={isLoadingGreeting}
            >
              {isLoadingGreeting ? 'Loading...' : 'Accept'}
            </button>
          </div>
        </>
      ) : (
        <div style={styles.inCallContainer}>
          {/* Recording indicator - shows camera is still streaming to desktop */}
          <div style={styles.recordingIndicator}>
            <div style={styles.recordingDot}></div>
            <span style={styles.recordingText}>Guardian Active</span>
          </div>

          <h1 style={styles.callerName}>{currentPersona.name}</h1>
          <p style={styles.callStatus}>
            {isAgentSpeaking ? '🗣️ Speaking...' :
             isListening ? '🎧 Listening...' :
             '✅ Connected'}
          </p>

          {/* Live Transcript */}
          {isListening && interimTranscript && (
            <div style={styles.transcriptBox}>
              <p style={styles.transcriptText}>"{interimTranscript}"</p>
            </div>
          )}

          {/* Status Indicator */}
          <div style={styles.statusIndicator}>
            {isAgentSpeaking && (
              <div style={styles.speakingIndicator}>
                <div style={styles.waveform}>
                  <span style={{...styles.wave, animationDelay: '0s'}}>▁</span>
                  <span style={{...styles.wave, animationDelay: '0.1s'}}>▃</span>
                  <span style={{...styles.wave, animationDelay: '0.2s'}}>▅</span>
                  <span style={{...styles.wave, animationDelay: '0.3s'}}>▇</span>
                  <span style={{...styles.wave, animationDelay: '0.4s'}}>▅</span>
                  <span style={{...styles.wave, animationDelay: '0.5s'}}>▃</span>
                  <span style={{...styles.wave, animationDelay: '0.6s'}}>▁</span>
                </div>
              </div>
            )}
            {isListening && (
              <div style={styles.listeningIndicator}>
                <div style={styles.pulse}></div>
                <p style={styles.hint}>Speak naturally, I'll respond when you're done</p>
              </div>
            )}
          </div>

          <button style={{...styles.button, ...styles.declineButton, marginTop: 'auto'}} onClick={onDecline}>
            End Call
          </button>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '50px',
    zIndex: 9999,
  } as React.CSSProperties,
  callerInfo: {
    textAlign: 'center',
  } as React.CSSProperties,
  callerName: {
    fontSize: '3em',
    margin: 0,
  } as React.CSSProperties,
  callStatus: {
    fontSize: '1.5em',
    color: '#888',
  } as React.CSSProperties,
  buttonContainer: {
    display: 'flex',
    justifyContent: 'space-around',
    width: '100%',
  } as React.CSSProperties,
  button: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    border: 'none',
    color: '#fff',
    fontSize: '1.2em',
    cursor: 'pointer',
  } as React.CSSProperties,
  declineButton: {
    backgroundColor: '#ff3b30',
  } as React.CSSProperties,
  acceptButton: {
    backgroundColor: '#4cd964',
  } as React.CSSProperties,
  inCallContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
    justifyContent: 'space-between',
    padding: '20px',
    position: 'relative',
  } as React.CSSProperties,
  recordingIndicator: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    padding: '8px 12px',
    borderRadius: '20px',
    border: '1px solid rgba(255, 59, 48, 0.5)',
  } as React.CSSProperties,
  recordingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#ff3b30',
    animation: 'pulse 1.5s ease-in-out infinite',
  } as React.CSSProperties,
  recordingText: {
    fontSize: '0.9em',
    color: '#ff3b30',
    fontWeight: 'bold',
  } as React.CSSProperties,
  transcriptBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: '20px',
    borderRadius: '15px',
    marginTop: '20px',
    maxWidth: '80%',
  } as React.CSSProperties,
  transcriptText: {
    fontSize: '1.2em',
    fontStyle: 'italic',
    color: '#fff',
    margin: 0,
  } as React.CSSProperties,
  statusIndicator: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '150px',
    flex: 1,
  } as React.CSSProperties,
  speakingIndicator: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  } as React.CSSProperties,
  waveform: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    fontSize: '3em',
  } as React.CSSProperties,
  wave: {
    display: 'inline-block',
    animation: 'wave 1s ease-in-out infinite',
    color: '#007AFF',
  } as React.CSSProperties,
  listeningIndicator: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  } as React.CSSProperties,
  pulse: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    backgroundColor: '#ff3b30',
    animation: 'pulse 1.5s ease-in-out infinite',
    boxShadow: '0 0 0 0 rgba(255, 59, 48, 0.7)',
  } as React.CSSProperties,
  hint: {
    fontSize: '1em',
    color: '#888',
    textAlign: 'center',
    maxWidth: '80%',
  } as React.CSSProperties,
};

export default FakeCallUI;
