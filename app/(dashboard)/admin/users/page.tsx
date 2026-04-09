"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Users, Search, Shield, Globe, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageLoader } from "@/components/ui/Spinner";
import { ROLE_LABELS } from "@/lib/types";
import { getRoleColor } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import type { UserProfile, Nation, City, Hub, UserRole } from "@/lib/types";

export default function AdminUsersPage() {
  return (
    <AuthGuard requiredRoles={["global_admin"]}>
      <UsersContent />
    </AuthGuard>
  );
}

function UsersContent() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [nations, setNations] = useState<Nation[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ role: "participant" as UserRole, nationId: "", cityId: "", hubId: "", isActive: true });

  useEffect(() => {
    const load = async () => {
      try {
        const [usersSnap, nationsSnap, citiesSnap, hubsSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.USERS), orderBy("displayName"))),
          getDocs(query(collection(db, COLLECTIONS.NATIONS), orderBy("name"))),
          getDocs(query(collection(db, COLLECTIONS.CITIES), orderBy("name"))),
          getDocs(query(collection(db, COLLECTIONS.HUBS), orderBy("name"))),
        ]);
        setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile)));
        setNations(nationsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Nation)));
        setCities(citiesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as City)));
        setHubs(hubsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Hub)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const openEdit = (user: UserProfile) => {
    setEditing(user);
    setEditForm({
      role: user.role,
      nationId: user.nationId || "",
      cityId: user.cityId || "",
      hubId: user.hubId || "",
      isActive: user.isActive,
    });
  };

  const saveUser = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const nation = nations.find((n) => n.id === editForm.nationId);
      const city = cities.find((c) => c.id === editForm.cityId);
      const hub = hubs.find((h) => h.id === editForm.hubId);
      const data = {
        role: editForm.role,
        nationId: editForm.nationId || null,
        nationName: nation?.name || null,
        cityId: editForm.cityId || null,
        cityName: city?.name || null,
        hubId: editForm.hubId || null,
        hubName: hub?.name || null,
        isActive: editForm.isActive,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, COLLECTIONS.USERS, editing.id), data);
      setUsers((prev) => prev.map((u) => u.id === editing.id ? { ...u, ...data } as UserProfile : u));
      setEditing(null);
      toast.success("User updated.");
    } catch (e) {
      toast.error("Failed to update user.");
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (user: UserProfile) => {
    if (!confirm(`Delete ${user.displayName}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.USERS, user.id));
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success("User deleted.");
    } catch {
      toast.error("Failed to delete user.");
    }
  };

  const filtered = users.filter((u) => {
    if (search && !u.displayName.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole && u.role !== filterRole) return false;
    return true;
  });

  const filteredCities = cities.filter((c) => !editForm.nationId || c.nationId === editForm.nationId);
  const filteredHubs = hubs.filter((h) => !editForm.cityId || h.cityId === editForm.cityId);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">User Management</h1>
        <p className="text-sm text-slate-500">{filtered.length} of {users.length} users</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <Card key={role} className="p-3 text-center">
            <p className="text-xl font-bold text-slate-900">{users.filter((u) => u.role === role).length}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      {/* User List */}
      <div className="space-y-2">
        {filtered.map((user) => (
          <Card key={user.id} className="p-3">
            <div className="flex items-center gap-3">
              <Avatar name={user.displayName} photoURL={user.photoURL} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-slate-900 text-sm">{user.displayName}</p>
                  <Badge className={getRoleColor(user.role)}>{ROLE_LABELS[user.role]}</Badge>
                  {!user.isActive && <Badge variant="danger">Inactive</Badge>}
                </div>
                <p className="text-xs text-slate-500">{user.email}</p>
                {user.nationName && (
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {[user.nationName, user.cityName, user.hubName].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                <Shield className="w-3.5 h-3.5" />
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => deleteUser(user)} className="text-red-500 hover:text-red-700">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit User" size="md">
        {editing && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-2">
              <Avatar name={editing.displayName} photoURL={editing.photoURL} size="sm" />
              <div>
                <p className="font-semibold text-slate-900 text-sm">{editing.displayName}</p>
                <p className="text-xs text-slate-500">{editing.email}</p>
              </div>
            </div>

            <Select label="Role" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}>
              {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>

            <Select label="Nation" value={editForm.nationId} onChange={(e) => setEditForm({ ...editForm, nationId: e.target.value, cityId: "", hubId: "" })}>
              <option value="">No nation assigned</option>
              {nations.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </Select>

            <Select label="City" value={editForm.cityId} onChange={(e) => setEditForm({ ...editForm, cityId: e.target.value, hubId: "" })} disabled={!editForm.nationId}>
              <option value="">No city assigned</option>
              {filteredCities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>

            <Select label="Hub" value={editForm.hubId} onChange={(e) => setEditForm({ ...editForm, hubId: e.target.value })} disabled={!editForm.cityId}>
              <option value="">No hub assigned</option>
              {filteredHubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </Select>

            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600"
              />
              Account is active
            </label>

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="flex-1" onClick={saveUser} loading={saving}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
