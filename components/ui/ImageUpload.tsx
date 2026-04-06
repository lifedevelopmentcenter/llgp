"use client";
import React, { useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/config";
import { Camera, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { CropModal } from "./CropModal";

interface ImageUploadProps {
  currentUrl?: string | null;
  storagePath: string;
  onUploadComplete: (url: string) => void;
  shape?: "circle" | "rect";
  size?: "sm" | "md" | "lg";
  placeholder?: React.ReactNode;
  className?: string;
  /** Pass a width/height aspect ratio to enable the crop modal before upload */
  cropAspect?: number;
}

export function ImageUpload({
  currentUrl,
  storagePath,
  onUploadComplete,
  shape = "rect",
  size = "md",
  placeholder,
  className,
  cropAspect,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  const sizeClasses = {
    sm: shape === "circle" ? "w-16 h-16" : "w-full h-20",
    md: shape === "circle" ? "w-24 h-24" : "w-full h-32",
    lg: shape === "circle" ? "w-32 h-32" : "w-full h-48",
  };

  const uploadBlob = async (blob: Blob | File) => {
    setUploading(true);
    const timeoutId = setTimeout(() => {
      setUploading(false);
      setPreview(null);
      toast.error("Upload timed out. Check your connection and try again.");
    }, 30_000);

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(blob);

    try {
      const storageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(snapshot.ref);
      onUploadComplete(url);
    } catch (err: any) {
      console.error("Upload error:", err);
      setPreview(null);
      const code = err?.code ?? "";
      if (code === "storage/unauthorized") {
        toast.error("Upload blocked — run: firebase deploy --only storage");
      } else if (code === "storage/unknown" || err?.message?.includes("CORS") || code === "storage/cors") {
        toast.error("CORS error — run: gsutil cors set cors.json gs://YOUR_BUCKET");
      } else {
        toast.error(`Upload failed: ${err?.message || "Unknown error"}`);
      }
    } finally {
      clearTimeout(timeoutId);
      setUploading(false);
    }
  };

  const handleFileSelected = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB."); return; }

    if (cropAspect !== undefined) {
      setCropFile(file); // open crop modal first
    } else {
      uploadBlob(file);
    }
  };

  const displayUrl = preview || currentUrl;

  return (
    <>
      <div
        className={`relative group ${sizeClasses[size]} ${shape === "circle" ? "rounded-full" : "rounded-2xl"} overflow-hidden cursor-pointer flex-shrink-0 ${className || ""}`}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {displayUrl ? (
          <img src={displayUrl} alt="Upload" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full flex flex-col items-center justify-center gap-1 ${placeholder ? "" : "bg-slate-100"}`}>
            {placeholder || <Camera className="w-6 h-6 text-slate-400" />}
          </div>
        )}

        {/* Hover overlay */}
        {!uploading && (
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-5 h-5 text-white" />
            <span className="text-white text-[10px] font-bold">Change</span>
          </div>
        )}

        {/* Uploading overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
            <span className="text-white text-[10px] font-bold">Uploading…</span>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFileSelected(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Crop modal */}
      {cropFile && cropAspect !== undefined && (
        <CropModal
          file={cropFile}
          shape={shape}
          aspect={cropAspect}
          onConfirm={blob => { setCropFile(null); uploadBlob(blob); }}
          onCancel={() => setCropFile(null)}
        />
      )}
    </>
  );
}
