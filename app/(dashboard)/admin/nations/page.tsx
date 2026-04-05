"use client";
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, orderBy, addDoc, updateDoc,
  doc, serverTimestamp, where,
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

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Nations & Cities</h1>
          <p className="text-sm text-slate-500">{nations.length} nations · {cities.length} cities</p>
        </div>
        <Button onClick={() => tab === "nations" ? openNationModal() : openCityModal()}>
          <Plus className="w-4 h-4" />
          Add {tab === "nations" ? "Nation" : "City"}
        </Button>
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
