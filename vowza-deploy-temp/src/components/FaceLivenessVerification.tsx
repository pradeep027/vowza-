/**
 * Vowza Human Verification Component
 * Uses MediaPipe Face Mesh for real-time face detection + head pose estimation
 * FIXED SEQUENCE: TURN LEFT → TURN RIGHT → LOOK UP
 * No BLINK, No LOOK_DOWN - only actual head movement detection
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, AlertCircle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

type ChallengeAction = 'TURN_LEFT' | 'TURN_RIGHT' | 'LOOK_UP';
type VerificationState = 'idle' | 'requesting_camera' | 'loading_model' | 'detecting' | 'left_required' | 'left_completed' | 'right_required' | 'right_completed' | 'up_required' | 'success' | 'failed';

interface Props {
  onVerified: (sessionId: string) => void;
  onSkip?: () => void;
}

const CHALLENGE_LABELS: Record<ChallengeAction, string> = {
  TURN_LEFT: 'Turn your head LEFT',
  TURN_RIGHT: 'Turn your head RIGHT',
  LOOK_UP: 'Look UP',
};

// FIXED SEQUENCE - NO RANDOMIZATION
const REQUIRED_SEQUENCE: ChallengeAction[] = ['TURN_LEFT', 'TURN_RIGHT', 'LOOK_UP'];

function generateSessionId(): string {
  return `lv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Head pose estimation from face landmarks
function estimateHeadPose(landmarks: any[]) {
  // Key landmarks: nose tip (1), chin (152), left eye corner (33), right eye corner (263), forehead (10)
  const noseTip = landmarks[1];
  const chin = landmarks[152];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const forehead = landmarks[10];

  // Pitch (up/down): angle between forehead-nose-chin
  const pitch = (noseTip.y - forehead.y) / (chin.y - forehead.y) - 0.5;

  // Yaw (left/right): horizontal asymmetry
  const faceCenter = (leftEye.x + rightEye.x) / 2;
  const yaw = (noseTip.x - faceCenter) * 3;

  return { pitch, yaw };
}

export default function FaceLivenessVerification({ onVerified, onSkip }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceMeshRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const stateRef = useRef<VerificationState>('idle');

  const [state, setState] = useState<VerificationState>('idle');
  const [faceStatus, setFaceStatus] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(0);
  const [stepComplete, setStepComplete] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [sessionId] = useState(generateSessionId);

  // Track consecutive frames where challenge condition is met
  const holdFrames = useRef(0);
  const HOLD_THRESHOLD = 12; // ~0.5 seconds at 24fps

  // Keep stateRef in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (faceMeshRef.current) faceMeshRef.current = null;
    };
  }, []);

  // Define onResults WITHOUT state in dependencies - use stateRef instead
  const onResults = useCallback((results: any) => {
    if (!results.multiFaceLandmarks) return;

    const faces = results.multiFaceLandmarks;
    const currentState = stateRef.current;

    console.log('[HumanCheck] Result received. Face count:', faces.length, 'State:', currentState);

    if (faces.length === 0) {
      setFaceStatus('Face not detected. Please position your face inside the circle.');
      holdFrames.current = 0;
      return;
    }

    if (faces.length > 1) {
      setFaceStatus('Only one person should be visible.');
      holdFrames.current = 0;
      return;
    }

    const landmarks = faces[0];
    const noseTip = landmarks[1];

    // Check face is centered
    const isCentered = noseTip.x > 0.1 && noseTip.x < 0.9 && noseTip.y > 0.05 && noseTip.y < 0.95;
    
    if (!isCentered) {
      console.log('[HumanCheck] Face not centered. Position:', { x: noseTip.x, y: noseTip.y });
      setFaceStatus('Move your face to the center');
      holdFrames.current = 0;
      return;
    }

    console.log('[HumanCheck] Face centered');

    // Face detected and centered - transition from detecting state
    if (currentState === 'detecting') {
      console.log('[HumanCheck] Transitioning from detecting to left_required');
      setState('left_required');
      setFaceStatus('');
      return;
    }

    // Only process pose if we're in an active liveness state
    if (!['left_required', 'left_completed', 'right_required', 'right_completed', 'up_required'].includes(currentState)) {
      return;
    }

    const { pitch, yaw } = estimateHeadPose(landmarks);
    let actionDetected = false;

    console.log('[HumanCheck] Head pose - Yaw:', yaw.toFixed(2), 'Pitch:', pitch.toFixed(2), 'State:', currentState);

    // Detect movement based on current step
    switch (currentState) {
      case 'left_required':
        // TURN LEFT: yaw should be negative (< -0.18)
        actionDetected = yaw < -0.18;
        if (actionDetected) {
          console.log('[HumanCheck] LEFT movement detected');
          setFaceStatus('Hold...');
        } else {
          setFaceStatus('Turn your head LEFT');
        }
        break;

      case 'right_required':
        // TURN RIGHT: yaw should be positive (> 0.18)
        actionDetected = yaw > 0.18;
        if (actionDetected) {
          console.log('[HumanCheck] RIGHT movement detected');
          setFaceStatus('Hold...');
        } else {
          setFaceStatus('Turn your head RIGHT');
        }
        break;

      case 'up_required':
        // LOOK UP: pitch should be negative (< -0.15)
        actionDetected = pitch < -0.15;
        if (actionDetected) {
          console.log('[HumanCheck] UP movement detected');
          setFaceStatus('Hold...');
        } else {
          setFaceStatus('Look UP');
        }
        break;
    }

    if (actionDetected) {
      holdFrames.current++;
      console.log('[HumanCheck] Hold frames:', holdFrames.current);
    } else {
      if (holdFrames.current > 0 && holdFrames.current < 3) {
        holdFrames.current = 0;
        console.log('[HumanCheck] Hold reset (< 3 frames)');
      }
    }

    if (holdFrames.current >= HOLD_THRESHOLD) {
      console.log('[HumanCheck] Action complete! Current state:', currentState);
      holdFrames.current = 0;
      setStepComplete(true);

      setTimeout(() => {
        setStepComplete(false);

        // Progress through sequence
        if (currentState === 'left_required') {
          console.log('[HumanCheck] Transitioning: left_required → left_completed → right_required');
          setState('left_completed');
          setTimeout(() => setState('right_required'), 400);
        } else if (currentState === 'right_required') {
          console.log('[HumanCheck] Transitioning: right_required → right_completed → up_required');
          setState('right_completed');
          setTimeout(() => setState('up_required'), 400);
        } else if (currentState === 'up_required') {
          console.log('[HumanCheck] Transitioning: up_required → success');
          setState('success');
          setFaceStatus('');
          if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
          if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
          console.log('[HumanCheck] Verification complete! Session ID:', sessionId);
          onVerified(sessionId);
        }
      }, 800);
    }
  }, [onVerified, sessionId]);

  const startVerification = useCallback(async () => {
    console.log('[HumanCheck] Starting verification...');
    setState('requesting_camera');
    setFaceStatus('Requesting camera access...');
    setCurrentStep(0);
    setStepComplete(false);
    holdFrames.current = 0;

    try {
      console.log('[HumanCheck] Requesting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      console.log('[HumanCheck] Camera stream obtained');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('[HumanCheck] Video srcObject set, playing...');
        await new Promise<void>((resolve, reject) => {
          const playPromise = videoRef.current?.play();
          if (playPromise) {
            playPromise.then(() => {
              console.log('[HumanCheck] Video playing');
              resolve();
            }).catch(err => {
              console.error('[HumanCheck] Video play error:', err);
              reject(err);
            });
          } else {
            resolve();
          }
        });

        await new Promise<void>((resolve) => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            console.log('[HumanCheck] Video ready immediately');
            resolve();
          } else {
            const onCanPlay = () => {
              console.log('[HumanCheck] Video canplay event');
              videoRef.current?.removeEventListener('canplay', onCanPlay);
              resolve();
            };
            videoRef.current?.addEventListener('canplay', onCanPlay);
            setTimeout(() => {
              console.log('[HumanCheck] Video ready timeout');
              videoRef.current?.removeEventListener('canplay', onCanPlay);
              resolve();
            }, 3000);
          }
        });
      }
    } catch (err: any) {
      console.error('[HumanCheck] Camera error:', err);
      setState('failed');
      setFaceStatus('Camera access denied. Please enable camera permissions.');
      return;
    }

    setState('loading_model');
    setFaceStatus('Loading face detection model...');

    try {
      console.log('[HumanCheck] Loading MediaPipe FaceMesh from CDN...');
      
      // Load FaceMesh script from CDN directly
      const scriptPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
        script.onload = () => {
          console.log('[HumanCheck] Script loaded, waiting for window.FaceMesh...');
          // Small delay to ensure window.FaceMesh is available
          setTimeout(() => resolve(), 100);
        };
        script.onerror = () => reject(new Error('Failed to load FaceMesh script'));
        document.head.appendChild(script);
      });

      await scriptPromise;

      const FaceMesh = (window as any).FaceMesh;
      console.log('[HumanCheck] FaceMesh from window:', typeof FaceMesh);

      if (!FaceMesh) {
        throw new Error('FaceMesh not found on window object after script load');
      }

      const locateFile = (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`;
      };

      console.log('[HumanCheck] Creating FaceMesh instance...');
      const faceMesh = new FaceMesh({
        locateFile,
      });
      console.log('[HumanCheck] FaceMesh instance created successfully');

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      console.log('[HumanCheck] FaceMesh configured');

      faceMesh.onResults(onResults);
      faceMeshRef.current = faceMesh;

      setState('detecting');
      setFaceStatus('Position your face inside the circle');

      const detect = async () => {
        if (videoRef.current && faceMeshRef.current && videoRef.current.readyState >= 2) {
          try {
            await faceMeshRef.current.send({ image: videoRef.current });
          } catch (err) {
            console.error('[HumanCheck] Detection error:', err);
          }
        }
        animFrameRef.current = requestAnimationFrame(detect);
      };
      console.log('[HumanCheck] Starting detection loop');
      detect();
    } catch (err: any) {
      console.error('[HumanCheck] Model loading error:', err);
      console.error('[HumanCheck] Error details:', {
        message: err?.message,
        stack: err?.stack,
        name: err?.name,
      });
      setState('failed');
      setFaceStatus('Failed to load face detection. Please try again.');
    }
  }, [onResults]);

  const handleRetry = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setAttempts(a => a + 1);
    setState('idle');
    setFaceStatus('');
    setCurrentStep(0);
    setStepComplete(false);
    holdFrames.current = 0;
  };

  // Max 5 attempts
  if (attempts >= 5) {
    return (
      <div className="text-center p-8 space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-foreground">Verification Limit Reached</h3>
        <p className="text-sm text-muted-foreground">You've exceeded the maximum number of attempts. Please contact Vowza support.</p>
      </div>
    );
  }

  const getProgressIndex = () => {
    switch(state) {
      case 'left_required':
      case 'left_completed':
        return 0;
      case 'right_required':
      case 'right_completed':
        return 1;
      case 'up_required':
        return 2;
      default:
        return 0;
    }
  };

  const isStepDone = (index: number) => {
    if (index === 0) return ['left_completed', 'right_required', 'right_completed', 'up_required', 'success'].includes(state);
    if (index === 1) return ['right_completed', 'up_required', 'success'].includes(state);
    if (index === 2) return state === 'success';
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-7 h-7 text-emerald-600" />
        </div>
        <h2 className="text-xl font-display font-bold text-foreground">Verify You're Human</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          To keep Vowza safe, complete a quick face verification. Follow the on-screen instructions.
        </p>
      </div>

      {/* Camera area */}
      {state === 'idle' ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-64 h-64 rounded-full bg-muted/50 border-2 border-dashed border-border flex items-center justify-center">
            <Camera className="w-12 h-12 text-muted-foreground" />
          </div>
          <button onClick={startVerification} className="px-6 py-3 rounded-xl bg-[#8B1538] text-white font-semibold text-sm hover:bg-[#70102d] transition-colors">
            Start Verification
          </button>
        </div>
      ) : state === 'success' ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold text-emerald-700">Human verification successful ✓</h3>
          <p className="text-sm text-muted-foreground">You can now submit your application.</p>
        </div>
      ) : state === 'failed' ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <p className="text-sm text-red-600 text-center max-w-sm">{faceStatus}</p>
          <div className="flex gap-3">
            <button onClick={handleRetry} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-sm font-semibold hover:bg-muted transition-colors">
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
            {onSkip && (
              <button onClick={onSkip} className="px-5 py-2.5 rounded-xl bg-muted text-sm font-semibold hover:bg-muted/80 transition-colors">
                Skip
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="relative flex flex-col items-center">
          {/* Video container */}
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full overflow-hidden border-4 border-emerald-400 shadow-lg">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" playsInline muted />
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 0 4px rgba(16,185,129,0.4)' }} />
          </div>

          {/* Status/instruction */}
          <div className="mt-5 text-center min-h-[80px]">
            {(state === 'requesting_camera' || state === 'loading_model') && (
              <div className="flex items-center gap-2 justify-center text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{faceStatus}</span>
              </div>
            )}

            {state === 'detecting' && (
              <p className="text-sm text-muted-foreground">{faceStatus}</p>
            )}

            {['left_required', 'left_completed', 'right_required', 'right_completed', 'up_required'].includes(state) && (
              <div className="space-y-3">
                {/* Progress dots */}
                <div className="flex items-center justify-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={`w-3 h-3 rounded-full transition-colors ${isStepDone(i) ? 'bg-emerald-500' : getProgressIndex() === i ? 'bg-[#8B1538]' : 'bg-border'}`} />
                  ))}
                </div>

                {/* Current instruction */}
                <div className="rounded-xl bg-[#8B1538]/5 border border-[#8B1538]/20 px-5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Step {getProgressIndex() + 1} of 3
                  </p>
                  {stepComplete ? (
                    <p className="text-emerald-600 font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Great!
                    </p>
                  ) : (
                    <p className="text-[#8B1538] font-bold text-lg">
                      {state === 'left_required' && CHALLENGE_LABELS['TURN_LEFT']}
                      {state === 'right_required' && CHALLENGE_LABELS['TURN_RIGHT']}
                      {state === 'up_required' && CHALLENGE_LABELS['LOOK_UP']}
                    </p>
                  )}
                </div>

                {faceStatus && !stepComplete && (
                  <p className="text-xs text-muted-foreground">{faceStatus}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
