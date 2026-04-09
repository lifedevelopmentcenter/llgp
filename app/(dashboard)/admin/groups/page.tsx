"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, serverTimestamp, query, orderBy, doc } from "firebase/firestore";
import { Users, Trash2, Plus } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageLoader } from "@/components/ui/Spinner";
import toast from "react-hot-toast";
import type { Nation, Group } from "@/lib/types";

export default function AdminGroupsPage() {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [nations, setNations] = useState<Nation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [gSnap, nSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.GROUPS), orderBy("name"))),
          getDocs(query(collection(db, COLLECTIONS.NATIONS), orderBy("name"))),
        ]);
        setGroups(gSnap.docs.map(d => ({ id: d.id, ...d.data() } as Group)));
        setNations(nSnap.docs.map(d => ({ id: d.id, ...d.data() } as Nation)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <PageLoader />;
  if (profile?.role !== "global_admin") return <div className="p-8 text-center text-slate-500">Admin only</div>;

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const selectAll = () => setSelected(new Set(nations.map(n => n.id)));
  const clearAll = () => setSelected(new Set());

  const handleCreate = async () => {
    if (selected.size === 0) { toast.error("Select at least one nation"); return; }
    setCreating(true);
    const existingNames = new Set(groups.map(g => g.name));
    let added = 0;
    for (const nationId of selected) {
      const nation = nations.find(n => n.id === nationId);
      if (!nation) continue;
      const name = `${nation.name} National Group`;
      if (existingNames.has(name)) continue;
      try {
        const ref = await addDoc(collection(db, COLLECTIONS.GROUPS), {
          name,
          description: `Official group for Leading Lights members in ${nation.name}`,
          nationId: nation.id,
          nationName: nation.name,
          type: "nation",
          leaderId: profile.id,
          memberCount: 0,
          isPrivate: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setGroups(prev => [...prev, { id: ref.id, name, nationId: nation.id, nationName: nation.name, type: "nation", leaderId: profile.id, memberCount: 0, isPrivate: false } as unknown as Group].sort((a, b) => a.name.localeCompare(b.name)));
        added++;
      } catch {}
    }
    toast.success(`Created ${added} group(s)`);
    setCreating(false);
    setSelected(new Set());
  };

  const deleteGroup = async (group: Group) => {
    if (!confirm(`Delete "${group.name}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.GROUPS, group.id));
      setGroups(prev => prev.filter(g => g.id !== group.id));
      toast.success("Group deleted.");
    } catch { toast.error("Failed to delete."); }
  };

  const nationsWithoutGroup = nations.filter(n => !groups.some(g => g.nationId === n.id && g.type === "nation"));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Groups</h1>
        <p className="text-sm text-slate-500">{groups.length} groups</p>
      </div>

      {/* Existing Groups */}
      <div className="space-y-2">
        {groups.map(group => (
          <Card key={group.id} className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">{group.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {group.nationName && <span className="text-xs text-slate-400">{group.nationName}</span>}
                  {group.type && <Badge variant="default" className="text-[10px]">{group.type}</Badge>}
                  <span className="text-xs text-slate-400">{group.memberCount ?? 0} members</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => deleteGroup(group)} className="text-red-500 hover:text-red-700 flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        ))}
        {groups.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">No groups yet.</p>
        )}
      </div>

      {/* Bulk Create */}
      {nationsWithoutGroup.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Bulk Create National Groups</p>
              <p className="text-xs text-slate-500 mt-0.5">{nationsWithoutGroup.length} nations without a group</p>
            </div>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-indigo-600 font-semibold hover:underline">All</button>
              <span className="text-slate-300">|</span>
              <button onClick={clearAll} className="text-xs text-slate-500 font-semibold hover:underline">Clear</button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto">
            {nationsWithoutGroup.map(n => (
              <label key={n.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={selected.has(n.id)} onChange={() => toggle(n.id)} className="rounded accent-indigo-600" />
                <span className="text-sm text-slate-700 truncate">{n.name}</span>
              </label>
            ))}
          </div>
          <Button onClick={handleCreate} loading={creating} disabled={selected.size === 0} className="w-full">
            <Plus className="w-4 h-4" />
            Create {selected.size > 0 ? `${selected.size} Group${selected.size > 1 ? "s" : ""}` : "Groups"}
          </Button>
        </div>
      )}
    </div>
  );
}
