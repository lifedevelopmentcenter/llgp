"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { ChevronRight, Check } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { PageLoader } from "@/components/ui/Spinner";
import { ImageUpload } from "@/components/ui/ImageUpload";
import toast from "react-hot-toast";
import type { Nation, City } from "@/lib/types";

const SPHERES = [
  "Arts, Entertainment & Sports",
  "Business & Finance",
  "Church & Religion",
  "Distribution & Media",
  "Education, Science & Technology",
  "Family & Home",
  "Government & Law",
];

const STEPS = ["Photo", "About You", "Location", "Done"];

export default function OnboardingPage() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [nations, setNations] = useState<Nation[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [customCity, setCustomCity] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    profession: "",
    sphereOfInfluence: [] as string[],
    participatingInTraining: false as boolean,
    nationId: "",
    cityId: "",
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
        firstName: profile.firstName || profile.displayName?.split(" ")[0] || "",
        lastName: profile.lastName || profile.displayName?.split(" ").slice(1).join(" ") || "",
        profession: profile.profession || "",
        sphereOfInfluence: profile.sphereOfInfluence
          ? (Array.isArray(profile.sphereOfInfluence) ? profile.sphereOfInfluence : [profile.sphereOfInfluence])
          : [],
        participatingInTraining: profile.participatingInTraining || false,
        nationId: profile.nationId || "",
        cityId: profile.cityId || "",
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
      const isOtherCity = form.cityId === "other";

      let resolvedCityId: string | null = isOtherCity ? null : (form.cityId || null);
      let resolvedCityName: string | null = isOtherCity ? (customCity.trim() || null) : (city?.name || null);
      if (isOtherCity && customCity.trim() && form.nationId) {
        const newCityRef = await addDoc(collection(db, COLLECTIONS.CITIES), {
          name: customCity.trim(),
          nationId: form.nationId,
          nationName: nation?.name || null,
          needsReview: true,
          submittedBy: profile.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        resolvedCityId = newCityRef.id;
        resolvedCityName = customCity.trim();
      }

      await updateDoc(doc(db, COLLECTIONS.USERS, profile.id), {
        firstName: form.firstName || null,
        lastName: form.lastName || null,
        profession: form.profession || null,
        sphereOfInfluence: form.sphereOfInfluence.length ? form.sphereOfInfluence : null,
        participatingInTraining: form.participatingInTraining,
        nationId: form.nationId || null,
        nationName: nation?.name || null,
        cityId: resolvedCityId,
        cityName: resolvedCityName,
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
          <Logo variant="dark" size="lg" className="mb-4" />
          <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-1">Welcome to</p>
          <h1 className="text-2xl font-black text-slate-900 text-center leading-tight">Leading Lights<br />Global Network</h1>
          <p className="text-sm text-slate-500 mt-2">Quick setup — takes less than a minute</p>
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

          {/* Step 1: About You */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-0.5">About you</h2>
                <p className="text-sm text-slate-500">Just the basics — you can fill in more on your profile later.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  placeholder="e.g. Sarah"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
                <Input
                  label="Last Name"
                  placeholder="e.g. Johnson"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
              <Input
                label="Profession"
                placeholder="e.g. Teacher, Engineer, Pastor"
                value={form.profession}
                onChange={(e) => setForm({ ...form, profession: e.target.value })}
              />
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Sphere(s) of Influence <span className="text-slate-400 font-normal">(select all that apply)</span></p>
                <div className="flex flex-col gap-1.5">
                  {SPHERES.map((s) => {
                    const selected = form.sphereOfInfluence.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm((f) => ({
                          ...f,
                          sphereOfInfluence: selected
                            ? f.sphereOfInfluence.filter((x) => x !== s)
                            : [...f.sphereOfInfluence, s],
                        }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium text-left transition-colors ${
                          selected
                            ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border ${selected ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`}>
                          {selected && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Have you completed the Leading Lights Experience training?</p>
                <div className="flex gap-3">
                  {[{ label: "Yes", value: true }, { label: "No", value: false }].map((opt) => (
                    <label
                      key={opt.label}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer text-sm font-semibold transition-colors ${
                        form.participatingInTraining === opt.value
                          ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="participatingInTraining"
                        checked={form.participatingInTraining === opt.value}
                        onChange={() => setForm({ ...form, participatingInTraining: opt.value })}
                        className="hidden"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(0)}>Back</Button>
                <Button className="flex-1" onClick={() => setStep(2)}>
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-0.5">Where are you based?</h2>
                <p className="text-sm text-slate-500">This helps connect you with your local Leading Lights community.</p>
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
                onChange={(e) => { setForm({ ...form, cityId: e.target.value }); setCustomCity(""); }}
                disabled={!form.nationId}
              >
                <option value="">Select your city…</option>
                {filteredCities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="other">My city isn't listed…</option>
              </Select>
              {form.cityId === "other" && (
                <Input
                  label="Enter your city"
                  placeholder="e.g. Abuja"
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  autoFocus
                />
              )}
              {nations.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  No nations have been added yet. An admin will assign your location.
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                <Button className="flex-1" onClick={saveAndContinue} loading={saving}>
                  Save & Finish <ChevronRight className="w-4 h-4" />
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
                  Welcome to the Leading Lights global community, {form.firstName || (profile.displayName ?? "").split(" ")[0]}.
                </p>
              </div>
              <div className="space-y-2 text-left bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">What to do next:</p>
                {[
                  "Complete your profile to help others find you",
                  "Start your Venture 100 training",
                  "Explore the member directory",
                  "Join a group space",
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
