"use client";
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, orderBy, where, addDoc,
  updateDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { Building2, Plus, Users, BookOpen, TrendingUp, Globe, Search } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import toast from "react-hot-toast";
import type { Hub, Nation, City } from "@/lib/types";

const statusBadge = (s: Hub["status"]) => {
  if (s === "active") return <Badge variant="success">Active</Badge>;
  if (s === "forming") return <Badge variant="warning">Forming</Badge>;
  return <Badge variant="default">Inactive</Badge>;
};

export default function HubsPage() {
  const { profile } = useAuth();
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [nations, setNations] = useState<Nation[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterNation, setFilterNation] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Hub | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "", nationId: "", cityId: "", leaderName: "",
    memberCount: 0, venture100Count: 0, leadersInTraining: 0,
    smallGroups: 0, status: "active" as Hub["status"], description: "",
  });

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      try {
        let hubQ = query(collection(db, COLLECTIONS.HUBS), orderBy("name"));
        if (profile.role === "national_leader" && profile.nationId) {
          hubQ = query(collection(db, COLLECTIONS.HUBS), where("nationId", "==", profile.nationId), orderBy("name"));
        } else if (profile.role === "city_leader" && profile.cityId) {
          hubQ = query(collection(db, COLLECTIONS.HUBS), where("cityId", "==", profile.cityId), orderBy("name"));
        } else if (profile.role === "hub_leader" && profile.hubId) {
          hubQ = query(collection(db, COLLECTIONS.HUBS), where("__name__", "==", profile.hubId));
        }

        const [hubsSnap, nationsSnap, citiesSnap] = await Promise.all([
          getDocs(hubQ),
          getDocs(query(collection(db, COLLECTIONS.NATIONS), orderBy("name"))),
          getDocs(query(collection(db, COLLECTIONS.CITIES), orderBy("name"))),
        ]);

        setHubs(hubsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Hub)));
        setNations(nationsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Nation)));
        setCities(citiesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as City)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile]);

  const openModal = (hub?: Hub) => {
    if (hub) {
      setEditing(hub);
      setForm({
        name: hub.name,
        nationId: hub.nationId,
        cityId: hub.cityId,
        leaderName: hub.leaderName,
        memberCount: hub.memberCount,
        venture100Count: hub.venture100Count,
        leadersInTraining: hub.leadersInTraining,
        smallGroups: hub.smallGroups,
        status: hub.status,
        description: hub.description || "",
      });
    } else {
      setEditing(null);
      setForm({ name: "", nationId: "", cityId: "", leaderName: "", memberCount: 0, venture100Count: 0, leadersInTraining: 0, smallGroups: 0, status: "active", description: "" });
    }
    setModalOpen(true);
  };

  const saveHub = async () => {
    if (!form.name || !form.nationId) { toast.error("Hub name and nation are required."); return; }
    setSaving(true);
    try {
      const nation = nations.find((n) => n.id === form.nationId);
      const city = cities.find((c) => c.id === form.cityId);
      const data = {
        ...form,
        nationName: nation?.name || "",
        cityName: city?.name || "",
        leaderId: profile?.id || "",
        updatedAt: serverTimestamp(),
      };

      if (editing) {
        await updateDoc(doc(db, COLLECTIONS.HUBS, editing.id), data);
        setHubs((prev) => prev.map((h) => h.id === editing.id ? { ...h, ...data } as Hub : h));
        toast.success("Hub updated.");
      } else {
        const ref = await addDoc(collection(db, COLLECTIONS.HUBS), { ...data, createdAt: serverTimestamp() });
        setHubs((prev) => [...prev, { id: ref.id, ...data, createdAt: null, updatedAt: null } as any]);
        toast.success("Hub created.");
      }
      setModalOpen(false);
    } catch (e) {
      toast.error("Failed to save hub.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = hubs.filter((h) => {
    if (search && !h.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterNation && h.nationId !== filterNation) return false;
    return true;
  });

  const canEdit = ["global_admin", "national_leader", "city_leader"].includes(profile?.role || "");
  const filteredCities = cities.filter((c) => !form.nationId || c.nationId === form.nationId);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Hub Management</h1>
          <p className="text-sm text-slate-500">{filtered.length} hub{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        {canEdit && (
          <Button onClick={() => openModal()}>
            <Plus className="w-4 h-4" />
            Add Hub
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-36">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search hubs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {profile?.role === "global_admin" && (
          <select
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            value={filterNation}
            onChange={(e) => setFilterNation(e.target.value)}
          >
            <option value="">All nations</option>
            {nations.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Hubs", value: hubs.length, icon: <Building2 className="w-4 h-4" />, color: "text-indigo-600" },
          { label: "Total Members", value: hubs.reduce((a, h) => a + h.memberCount, 0), icon: <Users className="w-4 h-4" />, color: "text-teal-600" },
          { label: "Venture 100", value: hubs.reduce((a, h) => a + h.venture100Count, 0), icon: <BookOpen className="w-4 h-4" />, color: "text-purple-600" },
          { label: "In Training", value: hubs.reduce((a, h) => a + h.leadersInTraining, 0), icon: <TrendingUp className="w-4 h-4" />, color: "text-amber-600" },
        ].map((s) => (
          <Card key={s.label} className="p-3">
            <div className={`mb-1 ${s.color}`}>{s.icon}</div>
            <p className="text-xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Hub Cards */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title="No hubs found"
          description={canEdit ? "Create your first hub to get started." : "No hubs have been added yet."}
          action={canEdit ? <Button onClick={() => openModal()}><Plus className="w-4 h-4" />Add Hub</Button> : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((hub) => (
            <Card key={hub.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{hub.name}</h3>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                    <Globe className="w-3 h-3" />
                    {hub.nationName}{hub.cityName && ` · ${hub.cityName}`}
                  </div>
                </div>
                {statusBadge(hub.status)}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: "Members", value: hub.memberCount },
                  { label: "Venture 100", value: hub.venture100Count },
                  { label: "In Training", value: hub.leadersInTraining },
                  { label: "Small Groups", value: hub.smallGroups },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-slate-900">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Leader: {hub.leaderName || "Unassigned"}</p>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => openModal(hub)}>Edit</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Hub" : "Add Hub"} size="lg">
        <div className="space-y-3">
          <Input label="Hub Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Lagos North Hub" />
          <Select label="Nation *" value={form.nationId} onChange={(e) => setForm({ ...form, nationId: e.target.value, cityId: "" })}>
            <option value="">Select nation…</option>
            {nations.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </Select>
          <Select label="City" value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })} disabled={!form.nationId}>
            <option value="">Select city…</option>
            {filteredCities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Hub Leader Name" value={form.leaderName} onChange={(e) => setForm({ ...form, leaderName: e.target.value })} />
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Hub["status"] })}>
            <option value="active">Active</option>
            <option value="forming">Forming</option>
            <option value="inactive">Inactive</option>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Members" type="number" value={form.memberCount} onChange={(e) => setForm({ ...form, memberCount: +e.target.value })} min={0} />
            <Input label="Venture 100" type="number" value={form.venture100Count} onChange={(e) => setForm({ ...form, venture100Count: +e.target.value })} min={0} />
            <Input label="Leaders in Training" type="number" value={form.leadersInTraining} onChange={(e) => setForm({ ...form, leadersInTraining: +e.target.value })} min={0} />
            <Input label="Small Groups" type="number" value={form.smallGroups} onChange={(e) => setForm({ ...form, smallGroups: +e.target.value })} min={0} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={saveHub} loading={saving}>
              {editing ? "Update Hub" : "Create Hub"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
