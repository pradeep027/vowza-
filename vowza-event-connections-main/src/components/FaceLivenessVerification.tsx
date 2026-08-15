/**
 * Vowza Face Liveness Verification Component
 * FIXED SEQUENCE: LOOK_UP → TURN_RIGHT → TURN_LEFT
 * Uses baseline-relative head pose estimation with improved motion detection
 * No external ML libraries - canvas-based face center tracking
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, AlertCircle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

type ChallengeAction = 'LOOK_UP' | 'TURN_RIGHT' | 'TURN_LEFT';
type VerificationState = 'idle' | 'requesting_camera' | 'detecting' | 'look_up_required' | 'look_up_completed' | 'turn_right_required' | 'turn_right_completed' | 'turn_left_required' | 'turn_left_completed' | 'success' | 'failed';

interface Props {
  onVerified: (sessionId: string) => void;
  onSkip?: () => void;
}

const CHALLENGE_LABELS: Record<ChallengeAction, string> = {
  LOOK_UP: 'Look UP',
  TURN_LEFT: 'Turn your head LEFT',
  TURN_RIGHT: 'Turn your head RIGHT',
};

// FIXED SEQUENCE - DO NOT RANDOMIZE
const REQUIRED_SEQUENCE: ChallengeAction[] = ['LOOK_UP', 'TURN_RIGHT', 'TURN_LEFT'];

function generateSessionId(): string {
  return `lv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function FaceLivenessVerification({ onVerified, onSkip }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  
  const [state, setState] = useState<VerificationState>('idle');
  const [faceStatus, setFaceStatus] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(0);
  const [stepComplete, setStepComplete] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [sessionId] = useState(generateSessionId);

  // Baseline for head pose (established during LOOK_UP)
  const baselineRef = useRef<{x: number, y: number} | null>(null);
  const holdFrames = useRef(0);
  const HOLD_THRESHOLD = 10;
  const frameHistoryRef = useRef<Array<{x: number, y: number}>>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Analyze frame to get face center position
  const analyzeFaceCenter = (canvas: HTMLCanvasElement): {x: number, y: number, valid: boolean} => {
    const ctx = canvas.getContext('2d');
    if (!ctx || !videoRef.current) return {x: 0.5, y: 0.5, valid: false};

    canvas.width = 160;
    canvas.height = 120;
    ctx.drawImage(videoRef.current, 0, 0, 160, 120);
    const imageData = ctx.getImageData(0, 0, 160, 120);
    const data = imageData.data;

    // Find darker pixels (face region)
    let darkSum = {x: 0, y: 0, count: 0};
    for (let i = 0; i < 160; i++) {
      for (let j = 0; j < 120; j++) {
        const idx = (j * 160 + i) * 4;
        const brightness = (data[idx] + data[idx+1] + data[idx+2]) / 3;
        if (brightness < 120) {
          darkSum.x += i;
          darkSum.y += j;
          darkSum.count++;
        }
      }
    }

    // Check if valid face detected (enough dark pixels)
    const valid = darkSum.count > 800; // ~5% of canvas
    const x = valid ? darkSum.x / darkSum.count / 160 : 0.5;
    const y = valid ? darkSum.y / darkSum.count / 120 : 0.5;

    return {x, y, valid};
  };

  const startVerification = useCallback(async () => {
    setState('requesting_camera');
    setFaceStatus('Requesting camera access...');
    setCurrentStep(0);
    setStepComplete(false);
    holdFrames.current = 0;
    frameHistoryRef.current = [];
    baselineRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        await new Promise(resolve => {
          const checkReady = () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              resolve(true);
            } else {
              setTimeout(checkReady, 100);
            }
          };
          checkReady();
        });
      }
    } catch (err: any) {
      setState('failed');
      setFaceStatus('Camera access denied. Please enable camera permissions.');
      return;
    }

    setState('detecting');
    setFaceStatus('Position your face inside the circle');

    const detect = () => {
      if (!canvasRef.current || !videoRef.current) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const faceCenter = analyzeFaceCenter(canvasRef.current);

      // Check if face is valid and centered
      if (!faceCenter.valid) {
        setFaceStatus('Position your face inside the circle');
        holdFrames.current = 0;
        baselineRef.current = null;
        frameHistoryRef.current = [];
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      // Face detected - initialize baseline and move to first challenge
      if (state === 'detecting') {
        setState('look_up_required');
        setFaceStatus('');
      }

      frameHistoryRef.current.push({x: faceCenter.x, y: faceCenter.y});
      if (frameHistoryRef.current.length > 20) {
        frameHistoryRef.current.shift();
      }

      // Handle state-specific logic
      if (state === 'look_up_required' || state === 'detecting') {
        // STEP 1: LOOK UP
        // Establish baseline on first frame
        if (!baselineRef.current) {
          baselineRef.current = {x: faceCenter.x, y: faceCenter.y};
          setFaceStatus('Establish face position...');
        } else {
          // Look UP: face moves up (y decreases)
          const recentFrames = frameHistoryRef.current.slice(-8);
          if (recentFrames.length >= 8) {
            const avgY = recentFrames.reduce((sum, f) => sum + f.y, 0) / recentFrames.length;
            const yDelta = baselineRef.current.y - avgY;
            
            // User moved up significantly enough
            if (yDelta > 0.08) {
              holdFrames.current++;
              setFaceStatus('Hold...');
              
              if (holdFrames.current >= HOLD_THRESHOLD) {
                holdFrames.current = 0;
                setState('look_up_completed');
                setStepComplete(true);
                
                setTimeout(() => {
                  setStepComplete(false);
                  // Reset baseline for next challenge
                  baselineRef.current = {x: faceCenter.x, y: faceCenter.y};
                  setState('turn_right_required');
                  setFaceStatus('');
                }, 800);
              }
            } else {
              if (holdFrames.current > 0 && holdFrames.current < 2) {
                holdFrames.current = 0;
              }
              setFaceStatus('Look UP');
            }
          }
        }
      } else if (state === 'turn_right_required' || state === 'turn_right_completed') {
        // STEP 2: TURN RIGHT
        // Camera is mirrored (scale-x-[-1]), so physical RIGHT appears as LEFT in canvas
        // Therefore: Turn RIGHT = face center moves LEFT in canvas (x decreases)
        const recentFrames = frameHistoryRef.current.slice(-8);
        if (recentFrames.length >= 8 && baselineRef.current) {
          const avgX = recentFrames.reduce((sum, f) => sum + f.x, 0) / recentFrames.length;
          const xDelta = baselineRef.current.x - avgX;
          
          // User turned right (x moved left in mirrored view)
          if (xDelta > 0.1) {
            holdFrames.current++;
            setFaceStatus('Hold...');
            
            if (holdFrames.current >= HOLD_THRESHOLD) {
              holdFrames.current = 0;
              setState('turn_right_completed');
              setStepComplete(true);
              
              setTimeout(() => {
                setStepComplete(false);
                // Reset baseline for final challenge
                baselineRef.current = {x: faceCenter.x, y: faceCenter.y};
                setState('turn_left_required');
                setFaceStatus('');
              }, 800);
            }
          } else {
            if (holdFrames.current > 0 && holdFrames.current < 2) {
              holdFrames.current = 0;
            }
            setFaceStatus('Turn your head RIGHT');
          }
        }
      } else if (state === 'turn_left_required') {
        // STEP 3: TURN LEFT
        // Camera is mirrored, so physical LEFT appears as RIGHT in canvas
        // Therefore: Turn LEFT = face center moves RIGHT in canvas (x increases)
        const recentFrames = frameHistoryRef.current.slice(-8);
        if (recentFrames.length >= 8 && baselineRef.current) {
          const avgX = recentFrames.reduce((sum, f) => sum + f.x, 0) / recentFrames.length;
          const xDelta = avgX - baselineRef.current.x;
          
          // User turned left (x moved right in mirrored view)
          if (xDelta > 0.1) {
            holdFrames.current++;
            setFaceStatus('Hold...');
            
            if (holdFrames.current >= HOLD_THRESHOLD) {
              holdFrames.current = 0;
              setState('success');
              setFaceStatus('');
              if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
              if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
              onVerified(sessionId);
              return;
            }
          } else {
            if (holdFrames.current > 0 && holdFrames.current < 2) {
              holdFrames.current = 0;
            }
            setFaceStatus('Turn your head LEFT');
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    detect();
  }, [state, sessionId, onVerified]);

  const handleRetry = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setAttempts(a => a + 1);
    setState('idle');
    setFaceStatus('');
    setCurrentStep(0);
    setStepComplete(false);
    holdFrames.current = 0;
    frameHistoryRef.current = [];
    baselineRef.current = null;
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

  // Map state to step number
  const getStepNumber = () => {
    switch(state) {
      case 'look_up_required':
      case 'look_up_completed':
        return 0;
      case 'turn_right_required':
      case 'turn_right_completed':
        return 1;
      case 'turn_left_required':
        return 2;
      default:
        return 0;
    }
  };

  const isStepCompleted = (step: number) => {
    if (step === 0) return state === 'look_up_completed' || state === 'turn_right_required' || state === 'turn_right_completed' || state === 'turn_left_required';
    if (step === 1) return state === 'turn_right_completed' || state === 'turn_left_required';
    if (step === 2) return state === 'success';
    return false;
  };

  const isStepCurrent = (step: number) => getStepNumber() === step;

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
          <h3 className="text-lg font-bold text-emerald-700">You're Verified!</h3>
          <p className="text-sm text-muted-foreground">Liveness verification successful. You can continue.</p>
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
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-0" width={320} height={320} />
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 0 4px rgba(16,185,129,0.4)' }} />
          </div>

          {/* Status/instruction */}
          <div className="mt-5 text-center min-h-[80px]">
            {(state === 'requesting_camera') && (
              <div className="flex items-center gap-2 justify-center text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{faceStatus}</span>
              </div>
            )}

            {(state === 'detecting') && (
              <p className="text-sm text-muted-foreground">{faceStatus}</p>
            )}

            {(state === 'look_up_required' || state === 'look_up_completed' || state === 'turn_right_required' || state === 'turn_right_completed' || state === 'turn_left_required') && (
              <div className="space-y-3">
                {/* Progress dots */}
                <div className="flex items-center justify-center gap-2">
                  {REQUIRED_SEQUENCE.map((_, i) => (
                    <div key={i} className={`w-3 h-3 rounded-full transition-colors ${isStepCompleted(i) ? 'bg-emerald-500' : isStepCurrent(i) ? 'bg-[#8B1538]' : 'bg-border'}`} />
                  ))}
                </div>

                {/* Current instruction */}
                <div className="rounded-xl bg-[#8B1538]/5 border border-[#8B1538]/20 px-5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Step {getStepNumber() + 1} of {REQUIRED_SEQUENCE.length}
                  </p>
                  {stepComplete ? (
                    <p className="text-emerald-600 font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Great!
                    </p>
                  ) : (
                    <p className="text-[#8B1538] font-bold text-lg">
                      {CHALLENGE_LABELS[REQUIRED_SEQUENCE[getStepNumber()]]}
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
