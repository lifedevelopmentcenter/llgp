"use client";
import React, { useRef, useState, useEffect } from "react";

interface CropModalProps {
  file: File;
  shape: "circle" | "rect";
  aspect: number; // width / height
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

export function CropModal({ file, shape, aspect, onConfirm, onCancel }: CropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [offsetY, setOffsetY] = useState(50);
  const [offsetX, setOffsetX] = useState(50);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => { imgRef.current = img; setLoaded(true); };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function drawToCanvas(canvas: HTMLCanvasElement, w: number, h: number, ox: number, oy: number) {
    const img = imgRef.current;
    if (!img) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);

    // Scale image to fill canvas (cover), then allow panning within overflow
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = w / h;
    let drawW: number, drawH: number;
    if (imgAspect > canvasAspect) {
      drawH = h; drawW = h * imgAspect;
    } else {
      drawW = w; drawH = w / imgAspect;
    }
    const dx = -((drawW - w) * ox) / 100;
    const dy = -((drawH - h) * oy) / 100;

    if (shape === "circle") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.drawImage(img, dx, dy, drawW, drawH);
    if (shape === "circle") ctx.restore();
  }

  const PREVIEW = 260;
  const previewH = Math.round(PREVIEW / aspect);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded) return;
    canvas.width = PREVIEW;
    canvas.height = previewH;
    drawToCanvas(canvas, PREVIEW, previewH, offsetX, offsetY);
  }, [loaded, offsetY, offsetX]);

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;
    const OUT = shape === "circle" ? 400 : 1200;
    const outH = Math.round(OUT / aspect);
    const c = document.createElement("canvas");
    c.width = OUT; c.height = outH;
    drawToCanvas(c, OUT, outH, offsetX, offsetY);
    c.toBlob(b => { if (b) onConfirm(b); }, "image/jpeg", 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm space-y-4 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <p className="font-bold text-slate-900">Adjust Photo</p>

        <div className="flex justify-center">
          {!loaded ? (
            <div className={`bg-slate-100 animate-pulse ${shape === "circle" ? "rounded-full" : "rounded-xl"}`}
              style={{ width: PREVIEW, height: previewH }} />
          ) : (
            <canvas ref={canvasRef}
              className={`border-2 border-indigo-100 ${shape === "circle" ? "rounded-full" : "rounded-xl"}`}
              style={{ width: PREVIEW, height: previewH }} />
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Up / Down</label>
            <input type="range" min={0} max={100} value={offsetY}
              onChange={e => setOffsetY(+e.target.value)}
              className="w-full accent-indigo-600" />
          </div>
          {shape === "rect" && (
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Left / Right</label>
              <input type="range" min={0} max={100} value={offsetX}
                onChange={e => setOffsetX(+e.target.value)}
                className="w-full accent-indigo-600" />
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={!loaded}
            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50">
            Use Photo
          </button>
        </div>
      </div>
    </div>
  );
}
