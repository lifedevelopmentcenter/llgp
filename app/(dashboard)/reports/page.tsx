"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, where, orderBy, addDoc,
  updateDoc, doc, serverTimestamp, limit,
} from "firebase/firestore";
import { FileText, Plus, CheckCircle2, Clock, Filter } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { formatDate, getMonthName } from "@/lib/utils";
import toast from "react-hot-toast";
import type { MonthlyReport, Nation } from "@/lib/types";

export default function ReportsPage() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [nations, setNations] = useState<Nation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterNation, setFilterNation] = useState("");
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  const now = new Date();
  const [form, setForm] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    memberCount: 0, venture100Count: 0, leadersInTraining: 0,
    smallGroups: 0, outreachActivities: 0, newHubs: 0,
    testimonies: "", challenges: "", prayerRequests: "", goals: "",
  });

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      try {
        let q = query(collection(db, COLLECTIONS.MONTHLY_REPORTS), orderBy("year", "desc"), orderBy("month", "desc"), limit(50));
        if (profile.role === "national_leader" && profile.nationId) {
          q = query(collection(db, COLLECTIONS.MONTHLY_REPORTS), where("nationId", "==", profile.nationId), orderBy("year", "desc"), orderBy("month", "desc"));
        } else if (profile.role === "city_leader" && profile.cityId) {
          q = query(collection(db, COLLECTIONS.MONTHLY_REPORTS), where("cityId", "==", profile.cityId), orderBy("year", "desc"), orderBy("month", "desc"));
        } else if (profile.role === "hub_leader" && profile.hubId) {
          q = query(collection(db, COLLECTIONS.MONTHLY_REPORTS), where("submittedBy", "==", profile.id), orderBy("year", "desc"), orderBy("month", "desc"));
        }

        const [reportsSnap, nationsSnap] = await Promise.all([
          getDocs(q),
          getDocs(query(collection(db, COLLECTIONS.NATIONS), orderBy("name"))),
        ]);

        setReports(reportsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MonthlyReport)));
        setNations(nationsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Nation)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile]);

  const submitReport = async (status: "draft" | "submitted") => {
    if (!profile) return;
    setSaving(true);
    try {
      const data: Omit<MonthlyReport, "id"> = {
        submittedBy: profile.id,
        submitterName: profile.displayName,
        submitterRole: profile.role,
        nationId: profile.nationId || "",
        nationName: profile.nationName || "",
        cityId: profile.cityId,
        cityName: profile.cityName,
        hubId: profile.hubId,
        hubName: profile.hubName,
        ...form,
        status,
        ...(status === "submitted" ? { submittedAt: serverTimestamp() as any } : {}),
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      };

      const ref = await addDoc(collection(db, COLLECTIONS.MONTHLY_REPORTS), data);
      setReports((prev) => [{ id: ref.id, ...data } as MonthlyReport, ...prev]);
      setModalOpen(false);
      toast.success(status === "submitted" ? "Report submitted!" : "Draft saved.");
    } catch (e) {
      toast.error("Failed to save report.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = reports.filter((r) => {
    if (filterNation && r.nationId !== filterNation) return false;
    if (filterYear && r.year.toString() !== filterYear) return false;
    return true;
  });

  const isLeader = ["global_admin", "national_leader", "city_leader", "hub_leader"].includes(profile?.role || "");
  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Monthly Reports</h1>
          <p className="text-sm text-slate-500">{filtered.length} report{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        {isLeader && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" />
            New Report
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
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
        <select
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
        >
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Reports list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="No reports yet"
          description="Submit your first monthly report."
          action={isLeader ? <Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" />New Report</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {getMonthName(r.month)} {r.year}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {r.nationName}{r.cityName ? ` · ${r.cityName}` : ""}{r.hubName ? ` · ${r.hubName}` : ""}
                  </p>
                  <p className="text-xs text-slate-400">by {r.submitterName}</p>
                </div>
                {r.status === "submitted" ? (
                  <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />Submitted</Badge>
                ) : (
                  <Badge variant="warning"><Clock className="w-3 h-3 mr-1" />Draft</Badge>
                )}
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { label: "Members", value: r.memberCount },
                  { label: "V100", value: r.venture100Count },
                  { label: "Training", value: r.leadersInTraining },
                  { label: "Groups", value: r.smallGroups },
                  { label: "Outreach", value: r.outreachActivities },
                  { label: "New Hubs", value: r.newHubs },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-slate-900">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {(r.testimonies || r.challenges || r.prayerRequests) && (
                <div className="mt-3 space-y-1.5">
                  {r.testimonies && (
                    <details className="group">
                      <summary className="text-xs font-medium text-slate-600 cursor-pointer list-none flex items-center gap-1">
                        <span className="text-green-600">✦</span> Testimonies
                      </summary>
                      <p className="text-xs text-slate-500 mt-1 pl-4">{r.testimonies}</p>
                    </details>
                  )}
                  {r.challenges && (
                    <details className="group">
                      <summary className="text-xs font-medium text-slate-600 cursor-pointer list-none flex items-center gap-1">
                        <span className="text-amber-500">⚠</span> Challenges
                      </summary>
                      <p className="text-xs text-slate-500 mt-1 pl-4">{r.challenges}</p>
                    </details>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Submit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Submit Monthly Report" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Month" value={form.month} onChange={(e) => setForm({ ...form, month: +e.target.value })}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
              ))}
            </Select>
            <Select label="Year" value={form.year} onChange={(e) => setForm({ ...form, year: +e.target.value })}>
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>

          <h4 className="font-medium text-slate-900 text-sm">Statistics</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Member Count" type="number" value={form.memberCount} onChange={(e) => setForm({ ...form, memberCount: +e.target.value })} min={0} />
            <Input label="Venture 100" type="number" value={form.venture100Count} onChange={(e) => setForm({ ...form, venture100Count: +e.target.value })} min={0} />
            <Input label="Leaders in Training" type="number" value={form.leadersInTraining} onChange={(e) => setForm({ ...form, leadersInTraining: +e.target.value })} min={0} />
            <Input label="Small Groups" type="number" value={form.smallGroups} onChange={(e) => setForm({ ...form, smallGroups: +e.target.value })} min={0} />
            <Input label="Outreach Activities" type="number" value={form.outreachActivities} onChange={(e) => setForm({ ...form, outreachActivities: +e.target.value })} min={0} />
            <Input label="New Hubs" type="number" value={form.newHubs} onChange={(e) => setForm({ ...form, newHubs: +e.target.value })} min={0} />
          </div>

          <Textarea label="Testimonies" placeholder="Share testimonies from this month…" value={form.testimonies} onChange={(e) => setForm({ ...form, testimonies: e.target.value })} rows={3} />
          <Textarea label="Challenges" placeholder="Any challenges or obstacles…" value={form.challenges} onChange={(e) => setForm({ ...form, challenges: e.target.value })} rows={3} />
          <Textarea label="Prayer Requests" placeholder="Prayer needs for your hub/city…" value={form.prayerRequests} onChange={(e) => setForm({ ...form, prayerRequests: e.target.value })} rows={3} />
          <Textarea label="Goals for Next Month" placeholder="What are you believing for next month?…" value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} rows={3} />

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => submitReport("draft")} loading={saving}>
              Save Draft
            </Button>
            <Button className="flex-1" onClick={() => submitReport("submitted")} loading={saving}>
              Submit Report
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
