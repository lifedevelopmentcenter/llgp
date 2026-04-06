"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setPrompt(e); setShow(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show || !prompt) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-80 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 flex items-center gap-3 animate-slide-up">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center flex-shrink-0">
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M12 2C10 5 8 6.5 8 9.5C8 12 9.5 14 12 14C9 14 7 16.5 7 19C7 21.2 8.8 23 12 23C15.2 23 17 21.2 17 19C17 16.5 15 14 12 14C14.5 14 16 12 16 9.5C16 6.5 14 5 12 2Z" /></svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900">Add to Home Screen</p>
        <p className="text-xs text-slate-500">Install LLGP for the best experience</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={async () => { prompt.prompt(); setShow(false); }}
          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-full hover:bg-indigo-700">
          Install
        </button>
        <button onClick={() => setShow(false)} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
