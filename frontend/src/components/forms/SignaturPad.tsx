import { useRef, useState, useEffect } from 'react';
import { Eraser } from 'lucide-react';

interface Props {
  onSignature: (dataUrl: string | undefined) => void;
  value?: string;
}

export function SignaturPad({ onSignature, value }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas-Größe an Container anpassen
    const rect = canvas.parentElement!.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 150;

    // Weißer Hintergrund
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Zeichenstil
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Vorhandene Unterschrift laden
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        setHasSignature(true);
      };
      img.src = value;
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setHasSignature(true);

    const canvas = canvasRef.current;
    if (canvas) {
      onSignature(canvas.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignature(undefined);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="label mb-0">Digitale Unterschrift *</label>
        {hasSignature && (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-credo-400 hover:text-red-500 flex items-center gap-1"
          >
            <Eraser className="w-3.5 h-3.5" />
            Löschen
          </button>
        )}
      </div>
      <div className="border-2 border-credo-300 rounded-lg overflow-hidden bg-white relative">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none"
          style={{ height: 150 }}
          role="img"
          aria-label="Unterschrift zeichnen — mit Maus oder Finger auf dieser Fläche unterschreiben"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-credo-300">
              Mit der Maus hier unterschreiben
            </p>
          </div>
        )}
      </div>
      <p className="text-xs text-credo-400 mt-1">
        Zeichnen Sie Ihre Unterschrift mit der Maus (PC) oder dem Finger (Tablet/Handy).
      </p>
    </div>
  );
}
