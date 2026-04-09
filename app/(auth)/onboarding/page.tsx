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
import { Input, Textarea, Select } from "@/components/ui/Input";
import { PageLoader } from "@/components/ui/Spinner";
import { ImageUpload } from "@/components/ui/ImageUpload";
import toast from "react-hot-toast";
import type { Nation, City } from "@/lib/types";

const SPHERES = [
  "Business", "Government", "Education", "Media", "Church",
  "Arts & Entertainment", "Family", "Health", "Technology", "Sports", "Other",
];

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia",
  "Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Belarus","Belgium","Belize",
  "Benin","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria",
  "Burkina Faso","Burundi","Cambodia","Cameroon","Canada","Central African Republic",
  "Chad","Chile","China","Colombia","Congo","Costa Rica","Croatia","Cuba","Cyprus",
  "Czech Republic","Denmark","Dominican Republic","Ecuador","Egypt","El Salvador",
  "Eritrea","Estonia","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia",
  "Germany","Ghana","Greece","Guatemala","Guinea","Haiti","Honduras","Hungary","Iceland",
  "India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Ivory Coast","Jamaica",
  "Japan","Jordan","Kazakhstan","Kenya","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon",
  "Liberia","Libya","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Mali",
  "Malta","Mauritania","Mauritius","Mexico","Moldova","Mongolia","Morocco","Mozambique",
  "Myanmar","Namibia","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria",
  "North Korea","Norway","Oman","Pakistan","Palestine","Panama","Papua New Guinea",
  "Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda",
  "Saudi Arabia","Senegal","Serbia","Sierra Leone","Singapore","Slovakia","Slovenia",
  "Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan",
  "Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Togo",
  "Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Uganda","Ukraine",
  "United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan",
  "Venezuela","Vietnam","Yemen","Zambia","Zimbabwe",
];

const STEPS = ["Photo", "Personal", "Location", "Purpose", "Done"];

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
    // Personal
    firstName: "",
    lastName: "",
    gender: "",
    countryOfOrigin: "",
    // Location
    nationId: "",
    cityId: "",
    countryOfResidence: "",
    // Purpose & Background
    profession: "",
    education: "",
    languages: "",
    sphereOfInfluence: [] as string[],
    missionStatement: "",
    summary: "",
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
      const existingSpheres = profile.sphereOfInfluence
        ? (Array.isArray(profile.sphereOfInfluence) ? profile.sphereOfInfluence : [profile.sphereOfInfluence])
        : [];
      setForm((f) => ({
        ...f,
        firstName: profile.firstName || profile.displayName?.split(" ")[0] || "",
        lastName: profile.lastName || profile.displayName?.split(" ").slice(1).join(" ") || "",
        gender: profile.gender || "",
        countryOfOrigin: profile.countryOfOrigin || "",
        nationId: profile.nationId || "",
        cityId: profile.cityId || "",
        countryOfResidence: profile.countryOfResidence || "",
        profession: profile.profession || "",
        education: profile.education || "",
        languages: (profile.languages || []).join(", "),
        sphereOfInfluence: existingSpheres,
        missionStatement: profile.missionStatement || "",
        summary: profile.summary || "",
      }));
    }
  }, [profile]);

  const filteredCities = cities.filter((c) => !form.nationId || c.nationId === form.nationId);

  const toggleSphere = (s: string) => {
    setForm((f) => ({
      ...f,
      sphereOfInfluence: f.sphereOfInfluence.includes(s)
        ? f.sphereOfInfluence.filter((x) => x !== s)
        : [...f.sphereOfInfluence, s],
    }));
  };

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

      const parsedLanguages = form.languages.split(",").map((l) => l.trim()).filter(Boolean);

      await updateDoc(doc(db, COLLECTIONS.USERS, profile.id), {
        firstName: form.firstName || null,
        lastName: form.lastName || null,
        gender: form.gender || null,
        countryOfOrigin: form.countryOfOrigin || null,
        nationId: form.nationId || null,
        nationName: nation?.name || null,
        cityId: resolvedCityId,
        cityName: resolvedCityName,
        countryOfResidence: form.countryOfResidence || null,
        profession: form.profession || null,
        education: form.education || null,
        languages: parsedLanguages.length ? parsedLanguages : null,
        sphereOfInfluence: form.sphereOfInfluence.length ? form.sphereOfInfluence : null,
        missionStatement: form.missionStatement || null,
        summary: form.summary || null,
        hasOnboarded: true,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      setStep(4);
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
          <p className="text-sm text-slate-500 mt-2">Let's set up your profile — takes 2 minutes</p>
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

          {/* Step 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-0.5">Personal information</h2>
                <p className="text-sm text-slate-500">Tell us a bit about who you are.</p>
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
              <Select
                label="Gender"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">Select…</option>
                <option>Male</option>
                <option>Female</option>
                <option>Prefer not to say</option>
              </Select>
              <Select
                label="Country of Origin"
                value={form.countryOfOrigin}
                onChange={(e) => setForm({ ...form, countryOfOrigin: e.target.value })}
              >
                <option value="">Select your country of origin…</option>
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
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
                label="Country of Residence"
                value={form.countryOfResidence}
                onChange={(e) => setForm({ ...form, countryOfResidence: e.target.value })}
              >
                <option value="">Select your country of residence…</option>
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
              <Select
                label="Nation (LL Region)"
                value={form.nationId}
                onChange={(e) => setForm({ ...form, nationId: e.target.value, cityId: "" })}
              >
                <option value="">Select your LL nation…</option>
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
                <Button className="flex-1" onClick={() => setStep(3)}>
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Purpose & Background */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-0.5">Your purpose & background</h2>
                <p className="text-sm text-slate-500">Help the community understand who you are and what drives you.</p>
              </div>
              <Input
                label="Profession"
                placeholder="e.g. Teacher, Engineer, Pastor"
                value={form.profession}
                onChange={(e) => setForm({ ...form, profession: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Highest Education"
                  value={form.education}
                  onChange={(e) => setForm({ ...form, education: e.target.value })}
                >
                  <option value="">Select…</option>
                  <option>Secondary</option>
                  <option>Diploma</option>
                  <option>Bachelor&apos;s</option>
                  <option>Master&apos;s</option>
                  <option>Post Graduate</option>
                  <option>Doctorate</option>
                  <option>Other</option>
                </Select>
                <Input
                  label="Languages"
                  placeholder="English, French…"
                  value={form.languages}
                  onChange={(e) => setForm({ ...form, languages: e.target.value })}
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Sphere(s) of Influence</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {SPHERES.map((s) => {
                    const selected = form.sphereOfInfluence.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSphere(s)}
                        className={`text-left px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                          selected
                            ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 inline mr-1" />}{s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Textarea
                label="Mission Statement"
                placeholder="What is your personal mission or calling?"
                value={form.missionStatement}
                onChange={(e) => setForm({ ...form, missionStatement: e.target.value })}
                rows={2}
              />
              <Textarea
                label="Summary"
                placeholder="A short bio — who you are and what drives you…"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                rows={2}
              />
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>Back</Button>
                <Button className="flex-1" onClick={saveAndContinue} loading={saving}>
                  Save Profile <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
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
