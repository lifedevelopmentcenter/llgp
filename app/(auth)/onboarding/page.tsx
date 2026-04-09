"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ChevronRight, Check } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { PageLoader } from "@/components/ui/Spinner";
import { ImageUpload } from "@/components/ui/ImageUpload";
import toast from "react-hot-toast";
import type { Nation, City } from "@/lib/types";

const SPHERES = ["Business", "Government", "Education", "Media", "Church", "Arts & Entertainment", "Family", "Health", "Technology", "Sports", "Other"];
const STEPS = ["Photo", "Location", "About You", "Done"];

export default function OnboardingPage() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [nations, setNations] = useState<Nation[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [form, setForm] = useState({
    nationId: "",
    cityId: "",
    profession: "",
    sphereOfInfluence: "",
    passions: "",
    bio: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [nSnap, cSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.NATIONS), orderBy("name"))),
          getDocs(query(collection(db, COLLECTIONS.CITIES), orderBy("name"))),
        ]);
        setNations(nSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Nation)));
        setCities(cSnap.docs.map((d) => ({ id: d.id, ...d.data() } as City)));
      } catch (e) { console.error(e); }
      finally { setLoadingData(false); }
    };
    load();
  }, []);

  // Pre-fill from existing profile
  useEffect(() => {
    if (profile) {
      setForm((f) => ({
        ...f,
        nationId: profile.nationId || "",
        cityId: profile.cityId || "",
        profession: profile.profession || "",
        sphereOfInfluence: (Array.isArray(profile.sphereOfInfluence) ? profile.sphereOfInfluence[0] : profile.sphereOfInfluence) || "",
        passions: profile.passions || "",
        bio: profile.bio || "",
      }));
    }
  }, [profile]);

  const filteredCities = cities.filter((c) => !form.nationId || c.nationId === form.nationId);

  const saveAndContinue = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const nation = nations.find((n) => n.id === form.nationId);
      const city = cities.find((c) => c.id === form.cityId);
      await updateDoc(doc(db, COLLECTIONS.USERS, profile.id), {
        nationId: form.nationId || null,
        nationName: nation?.name || null,
        cityId: form.cityId || null,
        cityName: city?.name || null,
        profession: form.profession || null,
        sphereOfInfluence: form.sphereOfInfluence || null,
        passions: form.passions || null,
        bio: form.bio || null,
        hasOnboarded: true,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      setStep(3);
    } catch (e) {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingData || !profile) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Logo variant="dark" size="lg" className="mb-3" />
          <h1 className="text-2xl font-bold text-slate-900">Welcome to Leading Lights Global Network</h1>
          <p className="text-sm text-slate-500 mt-1">Let's set up your profile — takes 1 minute</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < step ? "bg-green-500 text-white" : i === step ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"
                }`}>
                  {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === step ? "text-slate-900" : "text-slate-400"}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px max-w-8 ${i < step ? "bg-green-400" : "bg-slate-200"}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          {/* Step 0: Photo */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-0.5">Add a profile photo</h2>
                <p className="text-sm text-slate-500">Help your community recognize you.</p>
              </div>
              <div className="flex justify-center">
                <ImageUpload
                  currentUrl={profile.photoURL || null}
                  storagePath={`avatars/${profile.id}`}
                  onUploadComplete={async (url) => {
                    await updateDoc(doc(db, COLLECTIONS.USERS, profile.id), { photoURL: url, updatedAt: serverTimestamp() });
                    await refreshProfile();
                    toast.success("Photo saved!");
                  }}
                  shape="circle"
                  size="lg"
                  cropAspect={1}
                  className="w-32 h-32"
                />
              </div>
              <p className="text-xs text-center text-slate-400">Tap the circle to upload · You can change this later</p>
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>Skip for now</Button>
                <Button className="flex-1" onClick={() => setStep(1)}>
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 1: Location */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-0.5">Where are you based?</h2>
                <p className="text-sm text-slate-500">This helps connect you with your local community.</p>
              </div>
              <Select
                label="Nation"
                value={form.nationId}
                onChange={(e) => setForm({ ...form, nationId: e.target.value, cityId: "" })}
              >
                <option value="">Select your nation…</option>
                {nations.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </Select>
              <Select
                label="City"
                value={form.cityId}
                onChange={(e) => setForm({ ...form, cityId: e.target.value })}
                disabled={!form.nationId}
              >
                <option value="">Select your city…</option>
                {filteredCities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              {nations.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  No nations have been added yet. An admin will assign your location.
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(0)}>Back</Button>
                <Button className="flex-1" onClick={() => setStep(2)}>
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: About You */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-0.5">Tell us about yourself</h2>
                <p className="text-sm text-slate-500">Help the community get to know you.</p>
              </div>
              <Input
                label="Profession"
                placeholder="e.g. Teacher, Engineer, Pastor"
                value={form.profession}
                onChange={(e) => setForm({ ...form, profession: e.target.value })}
              />
              <Select
                label="Sphere of Influence"
                value={form.sphereOfInfluence}
                onChange={(e) => setForm({ ...form, sphereOfInfluence: e.target.value })}
              >
                <option value="">Select your sphere…</option>
                {SPHERES.map((s) => <option key={s}>{s}</option>)}
              </Select>
              <Textarea
                label="Bio"
                placeholder="A short intro about who you are and what drives you…"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={3}
              />
              <Textarea
                label="Passions & Calling"
                placeholder="What is God calling you to? What are you passionate about?"
                value={form.passions}
                onChange={(e) => setForm({ ...form, passions: e.target.value })}
                rows={3}
              />
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                <Button className="flex-1" onClick={saveAndContinue} loading={saving}>
                  Save Profile <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">You're all set!</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Welcome to the Leading Lights global community, {(profile.displayName ?? "").split(" ")[0]}.
                </p>
              </div>
              <div className="space-y-2 text-left bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">What to do next:</p>
                {[
                  "Start your Venture 100 training",
                  "Explore the member directory",
                  "Join a group space",
                  "Share a testimony or prayer request",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={() => router.replace("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
