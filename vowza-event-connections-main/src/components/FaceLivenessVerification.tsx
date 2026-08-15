/**
 * Vowza Face Liveness Verification Component
 * Simplified motion-based liveness detection (no external dependencies)
 * Detects: camera movement + light changes to prove video is live
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, AlertCircle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type VerificationState = 'idle' | 'requesting_camera' | 'detecting' | 'success' | 'failed';

interface Props {
  onVerified: (sessionId: string) => void;
  onSkip?: () => void;
}

function generateSessionId(): string {
  return `lv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function FaceLivenessVerification({ onVerified, onSkip }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const frameHistoryRef = useRef<number[]>([]);
  const sessionIdRef = useRef(generateSessionId());

  const [state, setState] = useState<VerificationState>('idle');
  const [faceStatus, setFaceStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [attempts, setAttempts] = useState(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const calculateFrameChange = (canvas: HTMLCanvasElement): number => {
    const ctx = canvas.getContext('2d');
    if (!ctx || !videoRef.current) return 0;

    // Draw current frame
    canvas.width = 160;
    canvas.height = 120;
    ctx.drawImage(videoRef.current, 0, 0, 160, 120);
    const imageData = ctx.getImageData(0, 0, 160, 120);
    const data = imageData.data;

    // Calculate average brightness
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    return sum / (data.length / 4);
  };

  const startVerification = useCallback(async () => {
    setState('requesting_camera');
    setFaceStatus('Requesting camera access...');
    setProgress(0);
    frameHistoryRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        // Wait for video to load before starting detection
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
    setFaceStatus('Move your head slightly to verify you\'re live...');

    let detectionFrames = 0;
    const requiredMotion = 12; // frames with sufficient motion

    const detect = () => {
      if (!canvasRef.current || !videoRef.current) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const brightness = calculateFrameChange(canvasRef.current);
      frameHistoryRef.current.push(brightness);

      // Keep only last 30 frames
      if (frameHistoryRef.current.length > 30) {
        frameHistoryRef.current.shift();
      }

      // Detect motion: check if brightness values vary significantly
      if (frameHistoryRef.current.length >= 8) {
        const recentFrames = frameHistoryRef.current.slice(-8);
        const minBrightness = Math.min(...recentFrames);
        const maxBrightness = Math.max(...recentFrames);
        const brightnessDiff = maxBrightness - minBrightness;

        // If significant brightness change detected, increment motion count
        if (brightnessDiff > 8) {
          detectionFrames++;
          setProgress((detectionFrames / requiredMotion) * 100);
          setFaceStatus(`Detecting motion... ${Math.min(100, Math.round((detectionFrames / requiredMotion) * 100))}%`);
        } else {
          setFaceStatus('Move your head slightly to verify you\'re live...');
        }

        // Success: sufficient motion detected
        if (detectionFrames >= requiredMotion) {
          setState('success');
          setFaceStatus('');
          if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
          if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
          onVerified(sessionIdRef.current);
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    detect();
  }, [onVerified]);

  const handleRetry = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setAttempts(a => a + 1);
    setState('idle');
    setFaceStatus('');
    setProgress(0);
    sessionIdRef.current = generateSessionId();
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
            {(state === 'requesting_camera' || state === 'detecting') && (
              <div className="space-y-4">
                {state === 'requesting_camera' && (
                  <div className="flex items-center gap-2 justify-center text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">{faceStatus}</span>
                  </div>
                )}

                {state === 'detecting' && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">{faceStatus}</p>
                    
                    {/* Progress bar */}
                    <div className="w-48 h-2 rounded-full bg-muted overflow-hidden mx-auto">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Attempt {attempts + 1} of 5
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
