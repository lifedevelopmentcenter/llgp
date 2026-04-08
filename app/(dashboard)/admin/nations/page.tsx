"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, orderBy, addDoc, updateDoc,
  doc, serverTimestamp, where, writeBatch,
} from "firebase/firestore";
import { Globe, Plus, MapPin, Building2 } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { PageLoader } from "@/components/ui/Spinner";
import toast from "react-hot-toast";
import type { Nation, City } from "@/lib/types";

export default function AdminNationsPage() {
  return (
    <AuthGuard requiredRoles={["global_admin"]}>
      <NationsContent />
    </AuthGuard>
  );
}

function NationsContent() {
  const [nations, setNations] = useState<Nation[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"nations" | "cities">("nations");
  const [nationModal, setNationModal] = useState(false);
  const [cityModal, setCityModal] = useState(false);
  const [editNation, setEditNation] = useState<Nation | null>(null);
  const [editCity, setEditCity] = useState<City | null>(null);
  const [saving, setSaving] = useState(false);

  const [nationForm, setNationForm] = useState({ name: "", code: "", region: "" });
  const [cityForm, setCityForm] = useState({ name: "", nationId: "" });

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
      finally { setLoading(false); }
    };
    load();
  }, []);

  const openNationModal = (n?: Nation) => {
    setEditNation(n || null);
    setNationForm(n ? { name: n.name, code: n.code, region: n.region } : { name: "", code: "", region: "" });
    setNationModal(true);
  };

  const openCityModal = (c?: City) => {
    setEditCity(c || null);
    setCityForm(c ? { name: c.name, nationId: c.nationId } : { name: "", nationId: "" });
    setCityModal(true);
  };

  const saveNation = async () => {
    if (!nationForm.name) return;
    setSaving(true);
    try {
      if (editNation) {
        await updateDoc(doc(db, COLLECTIONS.NATIONS, editNation.id), { ...nationForm, updatedAt: serverTimestamp() });
        setNations((prev) => prev.map((n) => n.id === editNation.id ? { ...n, ...nationForm } : n));
        toast.success("Nation updated.");
      } else {
        const ref = await addDoc(collection(db, COLLECTIONS.NATIONS), { ...nationForm, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        setNations((prev) => [...prev, { id: ref.id, ...nationForm } as any].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Nation added.");
      }
      setNationModal(false);
    } catch (e) { toast.error("Failed to save."); }
    finally { setSaving(false); }
  };

  const saveCity = async () => {
    if (!cityForm.name || !cityForm.nationId) return;
    setSaving(true);
    try {
      const nation = nations.find((n) => n.id === cityForm.nationId);
      const data = { ...cityForm, nationName: nation?.name || "" };
      if (editCity) {
        await updateDoc(doc(db, COLLECTIONS.CITIES, editCity.id), { ...data, updatedAt: serverTimestamp() });
        setCities((prev) => prev.map((c) => c.id === editCity.id ? { ...c, ...data } : c));
        toast.success("City updated.");
      } else {
        const ref = await addDoc(collection(db, COLLECTIONS.CITIES), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        setCities((prev) => [...prev, { id: ref.id, ...data } as any].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("City added.");
      }
      setCityModal(false);
    } catch (e) { toast.error("Failed to save."); }
    finally { setSaving(false); }
  };

  const ALL_NATIONS: { name: string; code: string; region: string }[] = [
    // Africa
    {name:"Algeria",code:"DZ",region:"Africa"},{name:"Angola",code:"AO",region:"Africa"},{name:"Benin",code:"BJ",region:"Africa"},{name:"Botswana",code:"BW",region:"Africa"},{name:"Burkina Faso",code:"BF",region:"Africa"},{name:"Burundi",code:"BI",region:"Africa"},{name:"Cabo Verde",code:"CV",region:"Africa"},{name:"Cameroon",code:"CM",region:"Africa"},{name:"Central African Republic",code:"CF",region:"Africa"},{name:"Chad",code:"TD",region:"Africa"},{name:"Comoros",code:"KM",region:"Africa"},{name:"Congo",code:"CG",region:"Africa"},{name:"DR Congo",code:"CD",region:"Africa"},{name:"Djibouti",code:"DJ",region:"Africa"},{name:"Egypt",code:"EG",region:"Africa"},{name:"Equatorial Guinea",code:"GQ",region:"Africa"},{name:"Eritrea",code:"ER",region:"Africa"},{name:"Eswatini",code:"SZ",region:"Africa"},{name:"Ethiopia",code:"ET",region:"Africa"},{name:"Gabon",code:"GA",region:"Africa"},{name:"Gambia",code:"GM",region:"Africa"},{name:"Ghana",code:"GH",region:"Africa"},{name:"Guinea",code:"GN",region:"Africa"},{name:"Guinea-Bissau",code:"GW",region:"Africa"},{name:"Ivory Coast",code:"CI",region:"Africa"},{name:"Kenya",code:"KE",region:"Africa"},{name:"Lesotho",code:"LS",region:"Africa"},{name:"Liberia",code:"LR",region:"Africa"},{name:"Libya",code:"LY",region:"Africa"},{name:"Madagascar",code:"MG",region:"Africa"},{name:"Malawi",code:"MW",region:"Africa"},{name:"Mali",code:"ML",region:"Africa"},{name:"Mauritania",code:"MR",region:"Africa"},{name:"Mauritius",code:"MU",region:"Africa"},{name:"Morocco",code:"MA",region:"Africa"},{name:"Mozambique",code:"MZ",region:"Africa"},{name:"Namibia",code:"NA",region:"Africa"},{name:"Niger",code:"NE",region:"Africa"},{name:"Nigeria",code:"NG",region:"Africa"},{name:"Rwanda",code:"RW",region:"Africa"},{name:"São Tomé and Príncipe",code:"ST",region:"Africa"},{name:"Senegal",code:"SN",region:"Africa"},{name:"Seychelles",code:"SC",region:"Africa"},{name:"Sierra Leone",code:"SL",region:"Africa"},{name:"Somalia",code:"SO",region:"Africa"},{name:"South Africa",code:"ZA",region:"Africa"},{name:"South Sudan",code:"SS",region:"Africa"},{name:"Sudan",code:"SD",region:"Africa"},{name:"Tanzania",code:"TZ",region:"Africa"},{name:"Togo",code:"TG",region:"Africa"},{name:"Tunisia",code:"TN",region:"Africa"},{name:"Uganda",code:"UG",region:"Africa"},{name:"Zambia",code:"ZM",region:"Africa"},{name:"Zimbabwe",code:"ZW",region:"Africa"},
    // Americas
    {name:"Antigua and Barbuda",code:"AG",region:"Americas"},{name:"Argentina",code:"AR",region:"Americas"},{name:"Bahamas",code:"BS",region:"Americas"},{name:"Barbados",code:"BB",region:"Americas"},{name:"Belize",code:"BZ",region:"Americas"},{name:"Bolivia",code:"BO",region:"Americas"},{name:"Brazil",code:"BR",region:"Americas"},{name:"Canada",code:"CA",region:"Americas"},{name:"Chile",code:"CL",region:"Americas"},{name:"Colombia",code:"CO",region:"Americas"},{name:"Costa Rica",code:"CR",region:"Americas"},{name:"Cuba",code:"CU",region:"Americas"},{name:"Dominica",code:"DM",region:"Americas"},{name:"Dominican Republic",code:"DO",region:"Americas"},{name:"Ecuador",code:"EC",region:"Americas"},{name:"El Salvador",code:"SV",region:"Americas"},{name:"Grenada",code:"GD",region:"Americas"},{name:"Guatemala",code:"GT",region:"Americas"},{name:"Guyana",code:"GY",region:"Americas"},{name:"Haiti",code:"HT",region:"Americas"},{name:"Honduras",code:"HN",region:"Americas"},{name:"Jamaica",code:"JM",region:"Americas"},{name:"Mexico",code:"MX",region:"Americas"},{name:"Nicaragua",code:"NI",region:"Americas"},{name:"Panama",code:"PA",region:"Americas"},{name:"Paraguay",code:"PY",region:"Americas"},{name:"Peru",code:"PE",region:"Americas"},{name:"Saint Kitts and Nevis",code:"KN",region:"Americas"},{name:"Saint Lucia",code:"LC",region:"Americas"},{name:"Saint Vincent and the Grenadines",code:"VC",region:"Americas"},{name:"Suriname",code:"SR",region:"Americas"},{name:"Trinidad and Tobago",code:"TT",region:"Americas"},{name:"United States",code:"US",region:"Americas"},{name:"Uruguay",code:"UY",region:"Americas"},{name:"Venezuela",code:"VE",region:"Americas"},
    // Asia
    {name:"Afghanistan",code:"AF",region:"Asia"},{name:"Armenia",code:"AM",region:"Asia"},{name:"Azerbaijan",code:"AZ",region:"Asia"},{name:"Bahrain",code:"BH",region:"Asia"},{name:"Bangladesh",code:"BD",region:"Asia"},{name:"Bhutan",code:"BT",region:"Asia"},{name:"Brunei",code:"BN",region:"Asia"},{name:"Cambodia",code:"KH",region:"Asia"},{name:"China",code:"CN",region:"Asia"},{name:"Cyprus",code:"CY",region:"Asia"},{name:"Georgia",code:"GE",region:"Asia"},{name:"India",code:"IN",region:"Asia"},{name:"Indonesia",code:"ID",region:"Asia"},{name:"Iran",code:"IR",region:"Asia"},{name:"Iraq",code:"IQ",region:"Asia"},{name:"Israel",code:"IL",region:"Asia"},{name:"Japan",code:"JP",region:"Asia"},{name:"Jordan",code:"JO",region:"Asia"},{name:"Kazakhstan",code:"KZ",region:"Asia"},{name:"Kuwait",code:"KW",region:"Asia"},{name:"Kyrgyzstan",code:"KG",region:"Asia"},{name:"Laos",code:"LA",region:"Asia"},{name:"Lebanon",code:"LB",region:"Asia"},{name:"Malaysia",code:"MY",region:"Asia"},{name:"Maldives",code:"MV",region:"Asia"},{name:"Mongolia",code:"MN",region:"Asia"},{name:"Myanmar",code:"MM",region:"Asia"},{name:"Nepal",code:"NP",region:"Asia"},{name:"North Korea",code:"KP",region:"Asia"},{name:"Oman",code:"OM",region:"Asia"},{name:"Pakistan",code:"PK",region:"Asia"},{name:"Palestine",code:"PS",region:"Asia"},{name:"Philippines",code:"PH",region:"Asia"},{name:"Qatar",code:"QA",region:"Asia"},{name:"Saudi Arabia",code:"SA",region:"Asia"},{name:"Singapore",code:"SG",region:"Asia"},{name:"South Korea",code:"KR",region:"Asia"},{name:"Sri Lanka",code:"LK",region:"Asia"},{name:"Syria",code:"SY",region:"Asia"},{name:"Taiwan",code:"TW",region:"Asia"},{name:"Tajikistan",code:"TJ",region:"Asia"},{name:"Thailand",code:"TH",region:"Asia"},{name:"Timor-Leste",code:"TL",region:"Asia"},{name:"Turkmenistan",code:"TM",region:"Asia"},{name:"United Arab Emirates",code:"AE",region:"Asia"},{name:"Uzbekistan",code:"UZ",region:"Asia"},{name:"Vietnam",code:"VN",region:"Asia"},{name:"Yemen",code:"YE",region:"Asia"},
    // Europe
    {name:"Albania",code:"AL",region:"Europe"},{name:"Andorra",code:"AD",region:"Europe"},{name:"Austria",code:"AT",region:"Europe"},{name:"Belarus",code:"BY",region:"Europe"},{name:"Belgium",code:"BE",region:"Europe"},{name:"Bosnia and Herzegovina",code:"BA",region:"Europe"},{name:"Bulgaria",code:"BG",region:"Europe"},{name:"Croatia",code:"HR",region:"Europe"},{name:"Czech Republic",code:"CZ",region:"Europe"},{name:"Denmark",code:"DK",region:"Europe"},{name:"Estonia",code:"EE",region:"Europe"},{name:"Finland",code:"FI",region:"Europe"},{name:"France",code:"FR",region:"Europe"},{name:"Germany",code:"DE",region:"Europe"},{name:"Greece",code:"GR",region:"Europe"},{name:"Hungary",code:"HU",region:"Europe"},{name:"Iceland",code:"IS",region:"Europe"},{name:"Ireland",code:"IE",region:"Europe"},{name:"Italy",code:"IT",region:"Europe"},{name:"Kosovo",code:"XK",region:"Europe"},{name:"Latvia",code:"LV",region:"Europe"},{name:"Liechtenstein",code:"LI",region:"Europe"},{name:"Lithuania",code:"LT",region:"Europe"},{name:"Luxembourg",code:"LU",region:"Europe"},{name:"Malta",code:"MT",region:"Europe"},{name:"Moldova",code:"MD",region:"Europe"},{name:"Monaco",code:"MC",region:"Europe"},{name:"Montenegro",code:"ME",region:"Europe"},{name:"Netherlands",code:"NL",region:"Europe"},{name:"North Macedonia",code:"MK",region:"Europe"},{name:"Norway",code:"NO",region:"Europe"},{name:"Poland",code:"PL",region:"Europe"},{name:"Portugal",code:"PT",region:"Europe"},{name:"Romania",code:"RO",region:"Europe"},{name:"Russia",code:"RU",region:"Europe"},{name:"San Marino",code:"SM",region:"Europe"},{name:"Serbia",code:"RS",region:"Europe"},{name:"Slovakia",code:"SK",region:"Europe"},{name:"Slovenia",code:"SI",region:"Europe"},{name:"Spain",code:"ES",region:"Europe"},{name:"Sweden",code:"SE",region:"Europe"},{name:"Switzerland",code:"CH",region:"Europe"},{name:"Turkey",code:"TR",region:"Europe"},{name:"Ukraine",code:"UA",region:"Europe"},{name:"United Kingdom",code:"GB",region:"Europe"},{name:"Vatican City",code:"VA",region:"Europe"},
    // Oceania
    {name:"Australia",code:"AU",region:"Oceania"},{name:"Fiji",code:"FJ",region:"Oceania"},{name:"Kiribati",code:"KI",region:"Oceania"},{name:"Marshall Islands",code:"MH",region:"Oceania"},{name:"Micronesia",code:"FM",region:"Oceania"},{name:"Nauru",code:"NR",region:"Oceania"},{name:"New Zealand",code:"NZ",region:"Oceania"},{name:"Palau",code:"PW",region:"Oceania"},{name:"Papua New Guinea",code:"PG",region:"Oceania"},{name:"Samoa",code:"WS",region:"Oceania"},{name:"Solomon Islands",code:"SB",region:"Oceania"},{name:"Tonga",code:"TO",region:"Oceania"},{name:"Tuvalu",code:"TV",region:"Oceania"},{name:"Vanuatu",code:"VU",region:"Oceania"},
  ];

  const [seeding, setSeeding] = useState(false);

  const seedAllNations = async () => {
    if (!confirm(`This will add all ${ALL_NATIONS.length} nations to Firestore. Existing nations will be skipped. Continue?`)) return;
    setSeeding(true);
    try {
      const existingCodes = new Set(nations.map(n => n.code));
      const toAdd = ALL_NATIONS.filter(n => !existingCodes.has(n.code));
      if (toAdd.length === 0) { toast("All nations already exist!"); setSeeding(false); return; }

      // Firestore batch writes (max 500 per batch)
      const BATCH_SIZE = 499;
      let added = 0;
      for (let i = 0; i < toAdd.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        toAdd.slice(i, i + BATCH_SIZE).forEach(n => {
          const ref = doc(collection(db, COLLECTIONS.NATIONS));
          batch.set(ref, { ...n, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        });
        await batch.commit();
        added += Math.min(BATCH_SIZE, toAdd.length - i);
      }

      // Reload
      const snap = await getDocs(query(collection(db, COLLECTIONS.NATIONS), orderBy("name")));
      setNations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Nation)));
      toast.success(`Added ${added} nations!`);
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    } finally {
      setSeeding(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Nations & Cities</h1>
          <p className="text-sm text-slate-500">{nations.length} nations · {cities.length} cities</p>
        </div>
        <div className="flex gap-2">
          {nations.length === 0 && (
            <Button variant="secondary" onClick={seedAllNations} loading={seeding}>
              🌍 Seed All Nations
            </Button>
          )}
          <Button onClick={() => tab === "nations" ? openNationModal() : openCityModal()}>
            <Plus className="w-4 h-4" />
            Add {tab === "nations" ? "Nation" : "City"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[{ key: "nations", label: "Nations" }, { key: "cities", label: "Cities" }].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`py-1.5 px-4 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "nations" ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {nations.map((n) => {
            const citiesInNation = cities.filter((c) => c.nationId === n.id).length;
            return (
              <Card key={n.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="w-4 h-4 text-indigo-600" />
                      <h3 className="font-semibold text-slate-900">{n.name}</h3>
                    </div>
                    {n.code && <Badge variant="default" className="font-mono">{n.code}</Badge>}
                    {n.region && <p className="text-xs text-slate-500 mt-1">{n.region}</p>}
                    <p className="text-xs text-slate-400 mt-1">{citiesInNation} cit{citiesInNation !== 1 ? "ies" : "y"}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openNationModal(n)}>Edit</Button>
                </div>
              </Card>
            );
          })}
          {nations.length === 0 && (
            <div className="col-span-3 text-center py-12 text-slate-400 text-sm">No nations added yet.</div>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cities.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-teal-600" />
                    <h3 className="font-semibold text-slate-900">{c.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500">{c.nationName}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openCityModal(c)}>Edit</Button>
              </div>
            </Card>
          ))}
          {cities.length === 0 && (
            <div className="col-span-3 text-center py-12 text-slate-400 text-sm">No cities added yet.</div>
          )}
        </div>
      )}

      {/* Nation Modal */}
      <Modal open={nationModal} onClose={() => setNationModal(false)} title={editNation ? "Edit Nation" : "Add Nation"}>
        <div className="space-y-3">
          <Input label="Country Name *" value={nationForm.name} onChange={(e) => setNationForm({ ...nationForm, name: e.target.value })} placeholder="e.g. Nigeria" />
          <Input label="ISO Code" value={nationForm.code} onChange={(e) => setNationForm({ ...nationForm, code: e.target.value.toUpperCase() })} placeholder="e.g. NG" maxLength={3} />
          <Input label="Region" value={nationForm.region} onChange={(e) => setNationForm({ ...nationForm, region: e.target.value })} placeholder="e.g. West Africa" />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setNationModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={saveNation} loading={saving}>{editNation ? "Update" : "Add"} Nation</Button>
          </div>
        </div>
      </Modal>

      {/* City Modal */}
      <Modal open={cityModal} onClose={() => setCityModal(false)} title={editCity ? "Edit City" : "Add City"}>
        <div className="space-y-3">
          <Input label="City Name *" value={cityForm.name} onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })} placeholder="e.g. Lagos" />
          <Select label="Nation *" value={cityForm.nationId} onChange={(e) => setCityForm({ ...cityForm, nationId: e.target.value })}>
            <option value="">Select nation…</option>
            {nations.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </Select>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setCityModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={saveCity} loading={saving}>{editCity ? "Update" : "Add"} City</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
