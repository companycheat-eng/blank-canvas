import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check, X } from "lucide-react";

interface CameraCaptureProps {
  mode: "selfie" | "document";
  onCapture: (file: File) => void;
  onCancel: () => void;
  label?: string;
}

export function CameraCapture({ mode, onCapture, onCancel, label }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setCaptured(null);
      setError(null);
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode === "selfie" ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  }, [mode]);

  useEffect(() => {
    startCamera();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror for selfie
    if (mode === "selfie") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCaptured(dataUrl);
    stopCamera();
  };

  const confirmPhoto = () => {
    if (!captured) return;
    // Convert data URL to File
    const arr = captured.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
    const file = new File([u8arr], `${mode}-${Date.now()}.jpg`, { type: mime });
    onCapture(file);
  };

  const retake = () => {
    setCaptured(null);
    startCamera();
  };

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={onCancel}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {label && <p className="text-sm font-medium text-center">{label}</p>}

      <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
        {/* Video preview */}
        {!captured && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${mode === "selfie" ? "scale-x-[-1]" : ""}`}
          />
        )}

        {/* Captured preview */}
        {captured && (
          <img src={captured} alt="Captura" className="w-full h-full object-cover" />
        )}

        {/* Frame guide overlay */}
        {!captured && (
          <div className="absolute inset-0 pointer-events-none">
            {mode === "selfie" ? (
              /* Oval face guide */
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-64 border-[3px] border-dashed border-primary/70 rounded-[50%]" />
              </div>
            ) : (
              /* Document rectangle guide */
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[85%] h-[60%] border-[3px] border-dashed border-primary/70 rounded-lg" />
              </div>
            )}
            <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-primary-foreground font-medium drop-shadow-lg">
              {mode === "selfie"
                ? "Enquadre seu rosto no oval"
                : "Enquadre o documento no retângulo"}
            </p>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      {!captured ? (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="icon" onClick={onCancel}>
            <X className="h-5 w-5" />
          </Button>
          <Button size="lg" className="h-16 w-16 rounded-full" onClick={takePhoto}>
            <Camera className="h-7 w-7" />
          </Button>
          <div className="w-10" /> {/* spacer */}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" onClick={retake}>
            <RotateCcw className="h-4 w-4 mr-2" /> Tirar outra
          </Button>
          <Button onClick={confirmPhoto}>
            <Check className="h-4 w-4 mr-2" /> Confirmar
          </Button>
        </div>
      )}
    </div>
  );
}
