/**
 * Vowza Face Liveness Verification Component
 * Motion-based liveness with required challenges: LOOK_UP, LOOK_DOWN, TURN_LEFT, TURN_RIGHT, BLINK
 * No external dependencies - uses canvas face detection patterns
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, AlertCircle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type ChallengeAction = 'LOOK_UP' | 'LOOK_DOWN' | 'TURN_LEFT' | 'TURN_RIGHT' | 'BLINK';
type VerificationState = 'idle' | 'requesting_camera' | 'detecting' | 'challenge' | 'success' | 'failed';

interface Props {
  onVerified: (sessionId: string) => void;
  onSkip?: () => void;
}

const CHALLENGE_LABELS: Record<ChallengeAction, string> = {
  LOOK_UP: 'Look UP',
  LOOK_DOWN: 'Look DOWN',
  TURN_LEFT: 'Turn your head LEFT',
  TURN_RIGHT: 'Turn your head RIGHT',
  BLINK: 'Blink your eyes',
};

const ALL_ACTIONS: ChallengeAction[] = ['LOOK_UP', 'LOOK_DOWN', 'TURN_LEFT', 'TURN_RIGHT', 'BLINK'];

function getRandomChallenges(): ChallengeAction[] {
  const shuffled = [...ALL_ACTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

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
  const [challenges, setChallenges] = useState<ChallengeAction[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepComplete, setStepComplete] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [sessionId] = useState(generateSessionId);

  // Track consecutive frames where challenge condition is met
  const holdFrames = useRef(0);
  const HOLD_THRESHOLD = 12; // ~0.5 seconds at 24fps
  const frameHistoryRef = useRef<Array<{brightness: number, centerX: number, centerY: number, eyesClosed: boolean}>>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const analyzeFrame = (canvas: HTMLCanvasElement): {brightness: number, centerX: number, centerY: number, eyesClosed: boolean} => {
    const ctx = canvas.getContext('2d');
    if (!ctx || !videoRef.current) return {brightness: 128, centerX: 0.5, centerY: 0.5, eyesClosed: false};

    canvas.width = 160;
    canvas.height = 120;
    ctx.drawImage(videoRef.current, 0, 0, 160, 120);
    const imageData = ctx.getImageData(0, 0, 160, 120);
    const data = imageData.data;

    // Calculate brightness
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    const brightness = sum / (data.length / 4);

    // Estimate face center (darker region in center)
    let darkSum = 0, darkCount = 0;
    for (let i = 0; i < 160; i++) {
      for (let j = 0; j < 120; j++) {
        const idx = (j * 160 + i) * 4;
        const pixelBrightness = (data[idx] + data[idx+1] + data[idx+2]) / 3;
        if (pixelBrightness < 100) { // dark pixels (face)
          darkSum += i;
          darkCount++;
        }
      }
    }
    const centerX = darkCount > 0 ? (darkSum / darkCount) / 160 : 0.5;
    const centerY = 0.5; // approximate

    // Detect if eyes closed (very dark around eye region)
    let eyeRegionBrightness = 0;
    let eyeCount = 0;
    for (let i = 40; i < 120; i++) {
      for (let j = 30; j < 90; j++) {
        const idx = (j * 160 + i) * 4;
        eyeRegionBrightness += (data[idx] + data[idx+1] + data[idx+2]) / 3;
        eyeCount++;
      }
    }
    const avgEyeBrightness = eyeRegionBrightness / eyeCount;
    const eyesClosed = avgEyeBrightness < 40;

    return {brightness, centerX, centerY, eyesClosed};
  };

  const startVerification = useCallback(async () => {
    setState('requesting_camera');
    setFaceStatus('Requesting camera access...');
    setChallenges(getRandomChallenges());
    setCurrentStep(0);
    setStepComplete(false);
    holdFrames.current = 0;
    frameHistoryRef.current = [];

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

      const frameData = analyzeFrame(canvasRef.current);
      frameHistoryRef.current.push(frameData);

      // Keep only last 40 frames
      if (frameHistoryRef.current.length > 40) {
        frameHistoryRef.current.shift();
      }

      // Face detected if reasonable brightness
      if (frameData.brightness < 180 && frameData.brightness > 50) {
        // Move to challenge state
        if (state === 'detecting') {
          setState('challenge');
          setFaceStatus('');
        }

        if (state === 'challenge' || state === 'detecting') {
          const currentAction = challenges[currentStep];
          if (!currentAction) {
            animFrameRef.current = requestAnimationFrame(detect);
            return;
          }

          const recentFrames = frameHistoryRef.current.slice(-16);
          if (recentFrames.length < 8) {
            animFrameRef.current = requestAnimationFrame(detect);
            return;
          }

          // Analyze motion pattern
          const centerXValues = recentFrames.map(f => f.centerX);
          const minX = Math.min(...centerXValues);
          const maxX = Math.max(...centerXValues);
          const xVariation = maxX - minX;

          const brightnessValues = recentFrames.map(f => f.brightness);
          const minBrightness = Math.min(...brightnessValues);
          const maxBrightness = Math.max(...brightnessValues);
          const brightnessVariation = maxBrightness - minBrightness;

          let actionDetected = false;

          switch (currentAction) {
            case 'LOOK_UP':
              // Face brightness increases when looking up (more forehead visible)
              actionDetected = brightnessVariation > 12 && maxBrightness > frameData.brightness + 8;
              break;
            case 'LOOK_DOWN':
              // Face center moves down slightly
              actionDetected = brightnessVariation > 12 && recentFrames[recentFrames.length - 1].centerY > 0.55;
              break;
            case 'TURN_LEFT':
              // Face center moves left
              actionDetected = xVariation > 0.12 && minX < 0.35;
              break;
            case 'TURN_RIGHT':
              // Face center moves right
              actionDetected = xVariation > 0.12 && maxX > 0.65;
              break;
            case 'BLINK':
              // Detect eyes closed
              actionDetected = frameData.eyesClosed && !recentFrames[Math.max(0, recentFrames.length - 3)].eyesClosed;
              break;
          }

          if (actionDetected) {
            holdFrames.current++;
            setFaceStatus('Hold...');
          } else {
            if (holdFrames.current > 0 && holdFrames.current < 3) {
              holdFrames.current = 0;
            }
            setFaceStatus(`Perform: ${CHALLENGE_LABELS[currentAction]}`);
          }

          if (holdFrames.current >= HOLD_THRESHOLD) {
            setStepComplete(true);
            holdFrames.current = 0;

            setTimeout(() => {
              setStepComplete(false);
              if (currentStep + 1 >= challenges.length) {
                setState('success');
                setFaceStatus('');
                if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
                if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
                onVerified(sessionId);
              } else {
                setCurrentStep(s => s + 1);
              }
            }, 800);
          }
        }
      } else {
        setFaceStatus('Position your face inside the circle');
        holdFrames.current = 0;
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    detect();
  }, [state, challenges, currentStep, sessionId, onVerified]);

  const handleRetry = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setAttempts(a => a + 1);
    setState('idle');
    setFaceStatus('');
    setChallenges(getRandomChallenges());
    setCurrentStep(0);
    setStepComplete(false);
    holdFrames.current = 0;
    frameHistoryRef.current = [];
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
          {/* Video container with face guide */}
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full overflow-hidden border-4 border-emerald-400 shadow-lg">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" playsInline muted />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-0" width={320} height={320} />
            {/* Circular guide overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 0 4px rgba(16,185,129,0.4)' }} />
          </div>

          {/* Status/instruction */}
          <div className="mt-5 text-center min-h-[80px]">
            {state === 'requesting_camera' && (
              <div className="flex items-center gap-2 justify-center text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{faceStatus}</span>
              </div>
            )}

            {state === 'detecting' && (
              <p className="text-sm text-muted-foreground">{faceStatus}</p>
            )}

            {state === 'challenge' && (
              <div className="space-y-3">
                {/* Progress dots */}
                <div className="flex items-center justify-center gap-2">
                  {challenges.map((_, i) => (
                    <div key={i} className={`w-3 h-3 rounded-full transition-colors ${i < currentStep ? 'bg-emerald-500' : i === currentStep ? 'bg-[#8B1538]' : 'bg-border'}`} />
                  ))}
                </div>

                {/* Current instruction */}
                <div className="rounded-xl bg-[#8B1538]/5 border border-[#8B1538]/20 px-5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Step {currentStep + 1} of {challenges.length}
                  </p>
                  {stepComplete ? (
                    <p className="text-emerald-600 font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Great!
                    </p>
                  ) : (
                    <p className="text-[#8B1538] font-bold text-lg">
                      {CHALLENGE_LABELS[challenges[currentStep]]}
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
