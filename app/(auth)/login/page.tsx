"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.code === "auth/invalid-credential" ? "Invalid email or password." : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 30% 40%, white 1.5px, transparent 1.5px), radial-gradient(circle at 70% 80%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-white font-black text-sm">LL</span>
            </div>
            <span className="font-black text-lg tracking-tight">Leading Lights</span>
          </div>
          <h1 className="text-4xl font-black leading-tight mb-4">
            Global Leadership<br />& Discipleship
          </h1>
          <p className="text-indigo-200 text-lg leading-relaxed max-w-sm">
            Train leaders. Build movements. Transform nations.
          </p>
        </div>
        <div className="relative space-y-4">
          {["Venture 100 Training", "LLGLI Leadership Incubator", "Global Community Network", "Movement Tracking"].map(item => (
            <div key={item} className="flex items-center gap-3 text-sm text-indigo-200">
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs">✓</span>
              </div>
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#F5F4FF]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-sm">LL</span>
            </div>
            <span className="font-black text-lg text-slate-900">Leading Lights</span>
          </div>

          <h2 className="text-2xl font-black text-slate-900 mb-1">Sign in</h2>
          <p className="text-sm text-slate-500 mb-8">Welcome back to LLGP</p>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Email address" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              <div>
                <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
                <div className="flex justify-end mt-1.5">
                  <Link href="/forgot-password" className="text-xs text-indigo-600 font-semibold hover:text-indigo-700">Forgot password?</Link>
                </div>
              </div>
              {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 font-medium">{error}</div>}
              <Button type="submit" className="w-full" size="lg" loading={loading}>Sign in</Button>
            </form>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-indigo-600 font-bold hover:text-indigo-700">Create one →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
