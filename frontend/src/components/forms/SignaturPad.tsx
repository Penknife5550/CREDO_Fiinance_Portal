import { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser } from 'lucide-react';

interface Props {
  onSignature: (dataUrl: string | undefined) => void;
  value?: string;
}

const CSS_HEIGHT = 150;

export function SignaturPad({ onSignature, value }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  // Aktuelle Unterschrift als DataURL — wird beim Resize neu in das Canvas
  // gemalt, damit ein Tablet-Rotation oder responsive Breakpoint nichts loescht.
  const lastSnapshotRef = useRef<string | null>(value ?? null);

  /**
   * Richtet das Canvas hochaufloesend ein (devicePixelRatio-aware) und stellt
   * eine vorhandene Unterschrift wieder her. Wird beim Mount und bei jedem
   * Container-Resize ausgefuehrt.
   *
   * Hintergrund: ohne DPR-Skalierung zeichnet der Browser auf einem 2x-Display
   * mit 0.5x-Aufloesung und skaliert dann hoch — Resultat ist eine matschige
   * Unterschrift, die im PDF nicht eindeutig lesbar ist (Audit-Risiko).
   */
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));

    // CSS-Groesse (was der User sieht) und Bitmap-Groesse (was gezeichnet wird)
    // entkoppeln. Das Canvas-Bitmap ist dpr-mal so gross wie die CSS-Flaeche.
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${CSS_HEIGHT}px`;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(CSS_HEIGHT * dpr);

    // Zeichenkoordinaten zurueck auf CSS-Pixel skalieren (setTransform statt
    // scale, damit kumulatives Skalieren bei Re-Setup ausgeschlossen ist).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Hintergrund + Stil neu setzen (Bitmap-Reset hat alles geloescht)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, CSS_HEIGHT);
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Vorhandene Unterschrift (initial value oder bisheriger Strich) wiederherstellen
    const snapshot = lastSnapshotRef.current;
    if (snapshot) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, cssWidth, CSS_HEIGHT);
        setHasSignature(true);
      };
      img.src = snapshot;
    }
  }, []);

  useEffect(() => {
    setupCanvas();

    const parent = canvasRef.current?.parentElement;
    if (!parent) return;

    const observer = new ResizeObserver(() => setupCanvas());
    observer.observe(parent);
    return () => observer.disconnect();
  }, [setupCanvas]);

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
      const dataUrl = canvas.toDataURL('image/png');
      lastSnapshotRef.current = dataUrl;
      onSignature(dataUrl);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.width / dpr;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, CSS_HEIGHT);
    lastSnapshotRef.current = null;
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
          className="w-full cursor-crosshair touch-none block"
          aria-label="Unterschrift-Zeichenfläche — mit Maus, Stift oder Finger unterschreiben"
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
              Hier unterschreiben
            </p>
          </div>
        )}
      </div>
      <p className="text-xs text-credo-400 mt-1">
        Mit Maus, Stift oder Finger zeichnen.
      </p>
    </div>
  );
}
