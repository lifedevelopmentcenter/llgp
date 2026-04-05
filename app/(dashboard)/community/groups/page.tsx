"use client";
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, orderBy, addDoc, serverTimestamp,
  where, doc, setDoc, updateDoc, increment,
} from "firebase/firestore";
import { Users, Plus, Lock, Globe } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import toast from "react-hot-toast";
import type { Group } from "@/lib/types";

const GROUP_TYPES = [
  { value: "nation",     label: "Nation Group" },
  { value: "city",       label: "City Group" },
  { value: "hub",        label: "Hub Group" },
  { value: "llgli_cohort", label: "LLGLI Cohort" },
  { value: "venture100", label: "Venture 100 Cohort" },
];

const COVER_GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-teal-500 to-emerald-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-500",
  "from-blue-500 to-cyan-600",
  "from-violet-500 to-purple-600",
];

function getGroupGradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h += name.charCodeAt(i);
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length];
}

export default function GroupsPage() {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", type: "hub" as Group["type"], isPrivate: false });

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      try {
        const [groupsSnap, mySnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.GROUPS), orderBy("name"))),
          getDocs(query(collection(db, COLLECTIONS.GROUP_MEMBERS), where("userId", "==", profile.id))),
        ]);
        setGroups(groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Group)));
        setMyGroupIds(new Set(mySnap.docs.map((d) => (d.data() as any).groupId)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [profile]);

  const createGroup = async () => {
    if (!profile || !form.name) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        leaderId: profile.id,
        leaderName: profile.displayName,
        nationId: profile.nationId || null,
        nationName: profile.nationName || null,
        cityId: profile.cityId || null,
        memberCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, COLLECTIONS.GROUPS), data);
      await setDoc(doc(db, COLLECTIONS.GROUP_MEMBERS, `${ref.id}_${profile.id}`), {
        groupId: ref.id,
        userId: profile.id,
        userName: profile.displayName,
        userPhoto: profile.photoURL || null,
        role: "leader",
        joinedAt: serverTimestamp(),
      });
      setGroups((prev) => [...prev, { id: ref.id, ...data } as any]);
      setMyGroupIds((prev) => new Set([...prev, ref.id]));
      setModalOpen(false);
      setForm({ name: "", description: "", type: "hub", isPrivate: false });
      toast.success("Group created.");
    } catch (e) {
      toast.error("Failed to create group.");
    } finally {
      setSaving(false);
    }
  };

  const joinGroup = async (groupId: string) => {
    if (!profile) return;
    try {
      await setDoc(doc(db, COLLECTIONS.GROUP_MEMBERS, `${groupId}_${profile.id}`), {
        groupId,
        userId: profile.id,
        userName: profile.displayName,
        userPhoto: profile.photoURL || null,
        role: "member",
        joinedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, COLLECTIONS.GROUPS, groupId), { memberCount: increment(1) });
      setMyGroupIds((prev) => new Set([...prev, groupId]));
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, memberCount: (g.memberCount || 0) + 1 } : g));
      toast.success("Joined group!");
    } catch (e) {
      toast.error("Failed to join group.");
    }
  };

  const canCreate = ["global_admin", "national_leader", "city_leader", "hub_leader"].includes(profile?.role || "");

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Group Spaces</h1>
          <p className="text-sm text-slate-400 mt-0.5">{groups.length} group{groups.length !== 1 ? "s" : ""} · Stay connected</p>
        </div>
        {canCreate && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Create
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title="No groups yet"
          description="Create a group for your hub, city, or cohort."
          action={canCreate ? <Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" />Create Group</Button> : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            const isMember = myGroupIds.has(group.id);
            const gradient = getGroupGradient(group.name);
            const typeLabel = GROUP_TYPES.find(t => t.value === group.type)?.label || group.type;
            return (
              <div key={group.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
                {/* Cover banner */}
                <div className={`h-20 bg-gradient-to-r ${gradient} relative flex items-center justify-center`}>
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, white 1px, transparent 1px), radial-gradient(circle at 70% 30%, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
                  <div className="relative w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    {group.isPrivate
                      ? <Lock className="w-5 h-5 text-white" />
                      : <Users className="w-5 h-5 text-white" />
                    }
                  </div>
                  {/* Status badge */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/20 backdrop-blur-sm rounded-full px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-semibold text-white">Active</span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-slate-900 text-sm leading-tight">{group.name}</h3>
                    {isMember && (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full flex-shrink-0">Joined</span>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{typeLabel}</span>

                  {group.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mt-2 leading-relaxed">{group.description}</p>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-medium">{group.memberCount || 0}</span>
                      <span className="text-slate-400">member{group.memberCount !== 1 ? "s" : ""}</span>
                    </div>
                    {isMember ? (
                      <Link href={`/community/groups/${group.id}`}>
                        <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                          Open →
                        </button>
                      </Link>
                    ) : (
                      <button
                        onClick={() => joinGroup(group.id)}
                        className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Join
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal — logic unchanged */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Group" size="md">
        <div className="space-y-3">
          <Input label="Group Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          <Select label="Group Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
            {GROUP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPrivate}
              onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600"
            />
            Private group (invite only)
          </label>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={createGroup} loading={saving}>Create Group</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
