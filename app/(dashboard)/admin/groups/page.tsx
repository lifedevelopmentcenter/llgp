"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import type { Nation } from "@/lib/types";

export default function BulkGroupsPage() {
  const { profile } = useAuth();
  const [nations, setNations] = useState<Nation[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    getDocs(query(collection(db, COLLECTIONS.NATIONS), orderBy("name")))
      .then(snap => setNations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Nation))))
      .catch(console.error);
  }, []);

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
    const results: string[] = [];
    for (const nationId of selected) {
      const nation = nations.find(n => n.id === nationId);
      if (!nation) continue;
      try {
        await addDoc(collection(db, COLLECTIONS.GROUPS), {
          name: `${nation.name} National Group`,
          description: `Official group for Leading Lights members in ${nation.name}`,
          nationId: nation.id,
          nationName: nation.name,
          type: "national",
          leaderId: profile.id,
          memberCount: 0,
          isPublic: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        results.push(`✓ ${nation.name}`);
      } catch (e) {
        results.push(`✗ ${nation.name} (failed)`);
      }
    }
    setDone(results);
    toast.success(`Created ${results.filter(r => r.startsWith("✓")).length} group(s)`);
    setCreating(false);
    setSelected(new Set());
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900">Bulk Create National Groups</h1>
        <p className="text-sm text-slate-500 mt-0.5">Create a group for each selected nation in one click</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">{nations.length} nations available · {selected.size} selected</p>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-xs text-indigo-600 font-semibold hover:underline">Select all</button>
            <span className="text-slate-300">|</span>
            <button onClick={clearAll} className="text-xs text-slate-500 font-semibold hover:underline">Clear</button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
          {nations.map(n => (
            <label key={n.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={selected.has(n.id)} onChange={() => toggle(n.id)}
                className="rounded accent-indigo-600" />
              <span className="text-sm text-slate-700 truncate">{n.name}</span>
            </label>
          ))}
        </div>

        <Button onClick={handleCreate} loading={creating} disabled={selected.size === 0} className="w-full">
          Create {selected.size > 0 ? `${selected.size} Group${selected.size > 1 ? "s" : ""}` : "Groups"}
        </Button>
      </div>

      {done.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-sm font-bold text-slate-700 mb-2">Results</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {done.map((r, i) => (
              <p key={i} className={`text-xs font-medium ${r.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>{r}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
