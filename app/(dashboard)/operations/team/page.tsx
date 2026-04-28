"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowLeft, CheckCircle2, Globe, Search, ShieldCheck, UserCog, Users } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageLoader } from "@/components/ui/Spinner";
import { OPS_ACCESS_ROLES, OPS_ASSIGNABLE_ROLES, OPS_TEAM_ADMIN_ROLES, hasRole } from "@/lib/operations/roles";
import { getRoleColor } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/types";
import type { City, Hub, Nation, UserProfile, UserRole } from "@/lib/types";
import toast from "react-hot-toast";

const RESPONSIBILITY_OPTIONS = [
  "National leader meetings",
  "Mission event coordination",
  "Finance and budgets",
  "Travel and accommodation",
  "Playbooks and forms",
  "Volunteer movement",
  "Mission procedures",
  "Communications",
];

export default function GlobalTeamPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [nations, setNations] = useState<Nation[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    role: "participant" as UserRole,
    nationId: "",
    cityId: "",
    hubId: "",
    isActive: true,
    globalResponsibilities: [] as string[],
    globalOpsNotes: "",
  });

  const canAccess = hasRole(profile?.role, OPS_ACCESS_ROLES);
  const canManageTeam = hasRole(profile?.role, OPS_TEAM_ADMIN_ROLES);

  useEffect(() => {
    if (!profile) return;

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
      } catch (error) {
        console.error(error);
        toast.error("Could not load global team.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile]);

  const globalTeam = useMemo(() => {
    return users.filter((user) => {
      const isGlobalOpsRole = OPS_ACCESS_ROLES.includes(user.role);
      const hasOpsAssignment = Boolean(user.globalResponsibilities?.length || user.globalOpsNotes?.trim());
      return isGlobalOpsRole || hasOpsAssignment;
    });
  }, [users]);

  const filtered = useMemo(() => {
    return globalTeam.filter((user) => {
      const queryValue = search.trim().toLowerCase();
      if (queryValue && !`${user.displayName} ${user.email} ${user.nationName || ""}`.toLowerCase().includes(queryValue)) return false;
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      return true;
    });
  }, [globalTeam, roleFilter, search]);

  const stats = useMemo(() => {
    return {
      total: globalTeam.length,
      active: globalTeam.filter((user) => user.isActive !== false).length,
      finance: globalTeam.filter((user) => user.role === "finance_coordinator").length,
      travel: globalTeam.filter((user) => user.role === "travel_coordinator").length,
      missions: globalTeam.filter((user) => user.role === "missions_coordinator").length,
    };
  }, [globalTeam]);

  const openEdit = (user: UserProfile) => {
    setEditing(user);
    setEditForm({
      role: user.role,
      nationId: user.nationId || "",
      cityId: user.cityId || "",
      hubId: user.hubId || "",
      isActive: user.isActive !== false,
      globalResponsibilities: user.globalResponsibilities || [],
      globalOpsNotes: user.globalOpsNotes || "",
    });
  };

  const saveUser = async () => {
    if (!editing || !canManageTeam) return;

    setSaving(true);
    try {
      const nation = nations.find((item) => item.id === editForm.nationId);
      const city = cities.find((item) => item.id === editForm.cityId);
      const hub = hubs.find((item) => item.id === editForm.hubId);
      const data = {
        role: editForm.role,
        nationId: editForm.nationId || null,
        nationName: nation?.name || null,
        cityId: editForm.cityId || null,
        cityName: city?.name || null,
        hubId: editForm.hubId || null,
        hubName: hub?.name || null,
        isActive: editForm.isActive,
        globalResponsibilities: editForm.globalResponsibilities,
        globalOpsNotes: editForm.globalOpsNotes.trim() || null,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, COLLECTIONS.USERS, editing.id), data);
      setUsers((prev) => prev.map((user) => (user.id === editing.id ? ({ ...user, ...data } as UserProfile) : user)));
      setEditing(null);
      toast.success("Global team member updated.");
    } catch (error) {
      console.error(error);
      toast.error("Could not update team member.");
    } finally {
      setSaving(false);
    }
  };

  const toggleResponsibility = (responsibility: string) => {
    setEditForm((prev) => ({
      ...prev,
      globalResponsibilities: prev.globalResponsibilities.includes(responsibility)
        ? prev.globalResponsibilities.filter((item) => item !== responsibility)
        : [...prev.globalResponsibilities, responsibility],
    }));
  };

  if (loading) return <PageLoader />;

  if (!canAccess) {
    return (
      <EmptyState
        icon={<Users className="w-6 h-6" />}
        title="Global team is restricted"
        description="Only assigned global operations roles can view the global team directory."
      />
    );
  }

  const filteredCities = cities.filter((city) => !editForm.nationId || city.nationId === editForm.nationId);
  const filteredHubs = hubs.filter((hub) => !editForm.cityId || hub.cityId === editForm.cityId);

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href="/operations" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-700">
        <ArrowLeft className="w-4 h-4" />
        Back to Global Operations
      </Link>

      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-500">Global Team</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">Administer global operations members and responsibilities.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Assign operations roles, regions, active status, and responsibility areas for people coordinating meetings, missions, finance, travel, playbooks, and procedures.
            </p>
          </div>
          {!canManageTeam && (
            <Badge className="bg-slate-100 text-slate-700">Read only</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <TeamStat label="Team Members" value={stats.total} />
        <TeamStat label="Active" value={stats.active} />
        <TeamStat label="Finance" value={stats.finance} />
        <TeamStat label="Travel" value={stats.travel} />
        <TeamStat label="Missions" value={stats.missions} />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Search name, email, or nation..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "all" | UserRole)} aria-label="Filter role" className="lg:w-64">
            <option value="all">All roles</option>
            {OPS_ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
            ))}
          </Select>
        </div>

        <div className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              No global team members match this view.
            </div>
          ) : (
            filtered.map((user) => (
              <div key={user.id} className="rounded-2xl border border-slate-100 bg-white p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <Avatar name={user.displayName} photoURL={user.photoURL} size="md" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-slate-900">{user.displayName}</p>
                        <Badge className={getRoleColor(user.role)}>{ROLE_LABELS[user.role]}</Badge>
                        {user.isActive === false ? <Badge variant="danger">Inactive</Badge> : <Badge variant="success">Active</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <Globe className="h-3.5 w-3.5" />
                        {[user.nationName, user.cityName, user.hubName].filter(Boolean).join(" · ") || "Global / unassigned"}
                      </p>
                    </div>
                  </div>
                  {canManageTeam && (
                    <Button variant="secondary" size="sm" onClick={() => openEdit(user)}>
                      <UserCog className="w-3.5 h-3.5" />
                      Manage
                    </Button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(user.globalResponsibilities || []).length > 0 ? (
                    user.globalResponsibilities?.map((responsibility) => (
                      <span key={responsibility} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                        {responsibility}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">No responsibilities recorded</span>
                  )}
                </div>
                {user.globalOpsNotes && <p className="mt-2 text-sm leading-6 text-slate-600">{user.globalOpsNotes}</p>}
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Manage Global Team Member" size="lg">
        {editing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <Avatar name={editing.displayName} photoURL={editing.photoURL} size="md" />
              <div>
                <p className="font-black text-slate-900">{editing.displayName}</p>
                <p className="text-sm text-slate-500">{editing.email}</p>
              </div>
            </div>

            <Select label="Operations Role" value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value as UserRole })}>
              {OPS_ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </Select>

            <div className="grid gap-3 md:grid-cols-3">
              <Select label="Nation" value={editForm.nationId} onChange={(event) => setEditForm({ ...editForm, nationId: event.target.value, cityId: "", hubId: "" })}>
                <option value="">Global / no nation</option>
                {nations.map((nation) => <option key={nation.id} value={nation.id}>{nation.name}</option>)}
              </Select>
              <Select label="City" value={editForm.cityId} disabled={!editForm.nationId} onChange={(event) => setEditForm({ ...editForm, cityId: event.target.value, hubId: "" })}>
                <option value="">No city</option>
                {filteredCities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
              </Select>
              <Select label="Hub" value={editForm.hubId} disabled={!editForm.cityId} onChange={(event) => setEditForm({ ...editForm, hubId: event.target.value })}>
                <option value="">No hub</option>
                {filteredHubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
              </Select>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Responsibility Areas</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {RESPONSIBILITY_OPTIONS.map((responsibility) => (
                  <button
                    key={responsibility}
                    type="button"
                    onClick={() => toggleResponsibility(responsibility)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                      editForm.globalResponsibilities.includes(responsibility)
                        ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CheckCircle2 className={`h-4 w-4 ${editForm.globalResponsibilities.includes(responsibility) ? "text-indigo-600" : "text-slate-300"}`} />
                    {responsibility}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              label="Operations Notes"
              rows={4}
              value={editForm.globalOpsNotes}
              onChange={(event) => setEditForm({ ...editForm, globalOpsNotes: event.target.value })}
              placeholder="Responsibilities, availability, reporting line, travel limits, approvals needed..."
            />

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(event) => setEditForm({ ...editForm, isActive: event.target.checked })}
                className="h-4 w-4 rounded border-slate-300"
              />
              Account is active
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={saveUser} loading={saving}>
                <ShieldCheck className="w-4 h-4" />
                Save Team Assignment
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TeamStat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </Card>
  );
}
