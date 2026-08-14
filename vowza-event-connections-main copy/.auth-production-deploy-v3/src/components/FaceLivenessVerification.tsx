/**
 * Vowza Face Liveness Verification Component
 * Uses MediaPipe Face Mesh for real-time face detection + head pose estimation.
 * Random 3-step challenge: LOOK_UP, LOOK_DOWN, TURN_LEFT, TURN_RIGHT, BLINK
 * Anti-spoofing: randomized sequence + movement validation + single-face check
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, AlertCircle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type ChallengeAction = 'LOOK_UP' | 'LOOK_DOWN' | 'TURN_LEFT' | 'TURN_RIGHT' | 'BLINK';
type VerificationState = 'idle' | 'requesting_camera' | 'loading_model' | 'detecting' | 'challenge' | 'success' | 'failed';

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

// Head pose estimation from face landmarks (simplified but effective)
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

// Eye Aspect Ratio for blink detection
function getEAR(landmarks: any[], eyeIndices: number[]): number {
  const p1 = landmarks[eyeIndices[0]];
  const p2 = landmarks[eyeIndices[1]];
  const p3 = landmarks[eyeIndices[2]];
  const p4 = landmarks[eyeIndices[3]];
  const p5 = landmarks[eyeIndices[4]];
  const p6 = landmarks[eyeIndices[5]];

  const vertical1 = Math.abs(p2.y - p6.y);
  const vertical2 = Math.abs(p3.y - p5.y);
  const horizontal = Math.abs(p1.x - p4.x);

  return (vertical1 + vertical2) / (2 * horizontal);
}

// Left and right eye landmark indices for EAR
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 380, 373];

export default function FaceLivenessVerification({ onVerified, onSkip }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceMeshRef = useRef<any>(null);
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
  const prevEAR = useRef(1);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const startVerification = useCallback(async () => {
    setState('requesting_camera');
    setFaceStatus('Requesting camera access...');
    setChallenges(getRandomChallenges());
    setCurrentStep(0);
    setStepComplete(false);
    holdFrames.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      setState('failed');
      setFaceStatus('Camera access denied. Please enable camera permissions.');
      return;
    }

    setState('loading_model');
    setFaceStatus('Loading face detection model...');

    try {
      // Dynamic import to avoid bundling issues
      const { FaceMesh } = await import('@mediapipe/face_mesh');

      const faceMesh = new FaceMesh({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 2, // detect up to 2 to catch multi-face
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults(onResults);
      faceMeshRef.current = faceMesh;

      setState('detecting');
      setFaceStatus('Position your face inside the circle');

      // Start detection loop
      const detect = async () => {
        if (videoRef.current && faceMeshRef.current && videoRef.current.readyState >= 2) {
          await faceMeshRef.current.send({ image: videoRef.current });
        }
        animFrameRef.current = requestAnimationFrame(detect);
      };
      detect();
    } catch (err) {
      setState('failed');
      setFaceStatus('Failed to load face detection. Please try again.');
    }
  }, []);

  const onResults = useCallback((results: any) => {
    if (!results.multiFaceLandmarks) return;

    const faces = results.multiFaceLandmarks;

    if (faces.length === 0) {
      setFaceStatus('No face detected. Position your face inside the circle.');
      holdFrames.current = 0;
      return;
    }

    if (faces.length > 1) {
      setFaceStatus('Multiple faces detected. Only one person should be visible.');
      holdFrames.current = 0;
      return;
    }

    const landmarks = faces[0];

    // Check face is centered and properly sized
    const noseTip = landmarks[1];
    if (noseTip.x < 0.2 || noseTip.x > 0.8 || noseTip.y < 0.15 || noseTip.y > 0.85) {
      setFaceStatus('Move your face to the center');
      holdFrames.current = 0;
      return;
    }

    // Face detected, now check if in challenge mode
    if (state === 'detecting') {
      setState('challenge');
      setFaceStatus('');
    }

    if (state !== 'challenge' && state !== 'detecting') return;

    const currentAction = challenges[currentStep];
    if (!currentAction) return;

    const { pitch, yaw } = estimateHeadPose(landmarks);
    const leftEAR = getEAR(landmarks, LEFT_EYE);
    const rightEAR = getEAR(landmarks, RIGHT_EYE);
    const avgEAR = (leftEAR + rightEAR) / 2;

    let actionDetected = false;

    switch (currentAction) {
      case 'LOOK_UP':
        actionDetected = pitch < -0.15;
        break;
      case 'LOOK_DOWN':
        actionDetected = pitch > 0.2;
        break;
      case 'TURN_LEFT':
        actionDetected = yaw < -0.18;
        break;
      case 'TURN_RIGHT':
        actionDetected = yaw > 0.18;
        break;
      case 'BLINK':
        actionDetected = avgEAR < 0.15 && prevEAR.current > 0.2;
        break;
    }

    prevEAR.current = avgEAR;

    if (actionDetected) {
      holdFrames.current++;
      setFaceStatus('Hold...');
    } else {
      if (holdFrames.current > 0 && holdFrames.current < 3) holdFrames.current = 0;
    }

    // For blink, immediate detection (no hold needed)
    if (currentAction === 'BLINK' && actionDetected) {
      holdFrames.current = HOLD_THRESHOLD;
    }

    if (holdFrames.current >= HOLD_THRESHOLD) {
      // Step completed
      setStepComplete(true);
      holdFrames.current = 0;

      setTimeout(() => {
        setStepComplete(false);
        if (currentStep + 1 >= challenges.length) {
          // All challenges completed!
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
          <p className="text-sm text-muted-foreground">Human verification successful. You can continue.</p>
        </div>
      ) : state === 'failed' ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <p className="text-sm text-red-600 text-center">{faceStatus}</p>
          <button onClick={handleRetry} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-sm font-semibold hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      ) : (
        <div className="relative flex flex-col items-center">
          {/* Video container with face guide */}
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full overflow-hidden border-4 border-emerald-400 shadow-lg">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" playsInline muted />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" width={320} height={320} />
            {/* Circular guide overlay */}
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
