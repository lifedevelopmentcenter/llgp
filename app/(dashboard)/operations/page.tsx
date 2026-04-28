"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileText,
  ListChecks,
  Plane,
  Plus,
  Users,
  WalletCards,
} from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageLoader } from "@/components/ui/Spinner";
import { OPS_ACCESS_ROLES, OPS_EDITOR_ROLES, OPS_TEAM_ADMIN_ROLES, hasRole } from "@/lib/operations/roles";
import type {
  GlobalOperationCategory,
  GlobalOperationFinanceItem,
  GlobalOperationMeetingItem,
  GlobalOperationProcedureItem,
  GlobalOperationRecord,
  GlobalOperationStatus,
  GlobalOperationTask,
  GlobalOperationTravelItem,
  Nation,
  UserProfile,
} from "@/lib/types";
import toast from "react-hot-toast";

const CATEGORY_META: Record<
  GlobalOperationCategory,
  { label: string; description: string; icon: React.ReactNode; accent: string }
> = {
  team: {
    label: "Team",
    description: "Global team roles, assignments, volunteer movement, and follow-up.",
    icon: <Users className="w-5 h-5" />,
    accent: "bg-sky-50 text-sky-700",
  },
  meeting: {
    label: "Meetings",
    description: "Monthly national meetings, agendas, leader follow-up, and action items.",
    icon: <CalendarDays className="w-5 h-5" />,
    accent: "bg-indigo-50 text-indigo-700",
  },
  mission_event: {
    label: "Mission Events",
    description: "Nation events, outreaches, playbooks, forms, and field requirements.",
    icon: <ClipboardList className="w-5 h-5" />,
    accent: "bg-emerald-50 text-emerald-700",
  },
  funding: {
    label: "Funds & Budgets",
    description: "Mission funds sent, approved budgets, receipts, and financial status.",
    icon: <WalletCards className="w-5 h-5" />,
    accent: "bg-amber-50 text-amber-700",
  },
  travel: {
    label: "Travel",
    description: "Flights, accommodation, itineraries, transport, and team movement.",
    icon: <Plane className="w-5 h-5" />,
    accent: "bg-rose-50 text-rose-700",
  },
  procedure: {
    label: "Procedures",
    description: "Mission procedures, playbooks, checklists, documents, and forms.",
    icon: <FileCheck2 className="w-5 h-5" />,
    accent: "bg-violet-50 text-violet-700",
  },
};

const STATUS_LABELS: Record<GlobalOperationStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  waiting: "Waiting",
  completed: "Completed",
  blocked: "Blocked",
};

const statusVariant = (status: GlobalOperationStatus) => {
  if (status === "completed") return "success";
  if (status === "blocked") return "danger";
  if (status === "waiting") return "warning";
  return "default";
};

function formatDate(value?: Timestamp | null) {
  if (!value) return "No date";
  try {
    return value.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "No date";
  }
}

const initialForm = {
  category: "mission_event" as GlobalOperationCategory,
  title: "",
  summary: "",
  status: "planned" as GlobalOperationStatus,
  priority: "medium" as GlobalOperationRecord["priority"],
  nationId: "",
  ownerId: "",
  dueDate: "",
  budgetAmount: "",
  fundsSent: "",
  currency: "USD",
  travelRoute: "",
  meetingLink: "",
  documentUrl: "",
  nextAction: "",
};

interface OperationSignals {
  overdueTasks: Array<{ operation: GlobalOperationRecord; task: GlobalOperationTask }>;
  upcomingMeetings: Array<{ operation: GlobalOperationRecord; meeting: GlobalOperationMeetingItem }>;
  pendingGates: Array<{ operation: GlobalOperationRecord; procedure: GlobalOperationProcedureItem }>;
  travelIssues: Array<{ operation: GlobalOperationRecord; travel: GlobalOperationTravelItem }>;
  financeThisMonth: number;
}

const emptySignals: OperationSignals = {
  overdueTasks: [],
  upcomingMeetings: [],
  pendingGates: [],
  travelIssues: [],
  financeThisMonth: 0,
};

export default function OperationsPage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<GlobalOperationRecord[]>([]);
  const [nations, setNations] = useState<Nation[]>([]);
  const [leaders, setLeaders] = useState<UserProfile[]>([]);
  const [signals, setSignals] = useState<OperationSignals>(emptySignals);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<"all" | GlobalOperationCategory>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | GlobalOperationStatus>("all");
  const [form, setForm] = useState(initialForm);
  const canAccessOperations = hasRole(profile?.role, OPS_ACCESS_ROLES);
  const canEditOperations = hasRole(profile?.role, OPS_EDITOR_ROLES);
  const canManageTeam = hasRole(profile?.role, OPS_TEAM_ADMIN_ROLES);

  useEffect(() => {
    if (!profile) return;

    const load = async () => {
      try {
        const [recordsSnap, nationsSnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.GLOBAL_OPERATIONS), orderBy("createdAt", "desc"))),
          getDocs(query(collection(db, COLLECTIONS.NATIONS), orderBy("name"))),
          getDocs(query(collection(db, COLLECTIONS.USERS), orderBy("displayName"))),
        ]);

        const activeRecords = recordsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as GlobalOperationRecord))
          .filter((record) => !record.archivedAt);

        setRecords(activeRecords);
        setNations(nationsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Nation)));
        setLeaders(
          usersSnap.docs
            .map((d) => ({ id: d.id, ...d.data() } as UserProfile))
            .filter((user) => user.role !== "participant" && user.isActive !== false)
        );

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextThirtyDays = new Date(now);
        nextThirtyDays.setDate(now.getDate() + 30);

        const nested = await Promise.all(
          activeRecords.map(async (record) => {
            const operationRef = doc(db, COLLECTIONS.GLOBAL_OPERATIONS, record.id);
            const [tasksSnap, meetingsSnap, proceduresSnap, travelSnap, financeSnap] = await Promise.all([
              getDocs(query(collection(operationRef, "tasks"), orderBy("createdAt", "asc"))),
              getDocs(query(collection(operationRef, "meetings"), orderBy("meetingDate", "asc"))),
              getDocs(query(collection(operationRef, "procedures"), orderBy("createdAt", "desc"))),
              getDocs(query(collection(operationRef, "travel"), orderBy("createdAt", "desc"))),
              getDocs(query(collection(operationRef, "finance"), orderBy("createdAt", "desc"))),
            ]);
            return {
              record,
              tasks: tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GlobalOperationTask)),
              meetings: meetingsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GlobalOperationMeetingItem)),
              procedures: proceduresSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GlobalOperationProcedureItem)),
              travel: travelSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GlobalOperationTravelItem)),
              finance: financeSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GlobalOperationFinanceItem)),
            };
          })
        );

        const nextSignals = nested.reduce<OperationSignals>((acc, item) => {
          item.tasks.forEach((task) => {
            const due = task.dueDate?.toDate();
            if (!task.isComplete && due && due < now) acc.overdueTasks.push({ operation: item.record, task });
          });
          item.meetings.forEach((meeting) => {
            const meetingDate = meeting.meetingDate?.toDate();
            if (meeting.status === "scheduled" && meetingDate && meetingDate >= now && meetingDate <= nextThirtyDays) {
              acc.upcomingMeetings.push({ operation: item.record, meeting });
            }
          });
          item.procedures.forEach((procedure) => {
            if (procedure.requiredBeforeMission && procedure.status !== "complete") {
              acc.pendingGates.push({ operation: item.record, procedure });
            }
          });
          item.travel.forEach((travel) => {
            if (travel.status === "issue") acc.travelIssues.push({ operation: item.record, travel });
          });
          item.finance.forEach((finance) => {
            const transactionDate = finance.transactionDate?.toDate();
            if (finance.type === "disbursement" && transactionDate && transactionDate >= monthStart) {
              acc.financeThisMonth += Number(finance.amount) || 0;
            }
          });
          return acc;
        }, { ...emptySignals, overdueTasks: [], upcomingMeetings: [], pendingGates: [], travelIssues: [] });

        nextSignals.overdueTasks.sort((a, b) => (a.task.dueDate?.toMillis() || 0) - (b.task.dueDate?.toMillis() || 0));
        nextSignals.upcomingMeetings.sort((a, b) => (a.meeting.meetingDate?.toMillis() || 0) - (b.meeting.meetingDate?.toMillis() || 0));
        setSignals(nextSignals);
      } catch (error) {
        console.error(error);
        toast.error("Could not load global operations.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile]);

  const filtered = useMemo(() => {
    return records.filter((record) => {
      if (categoryFilter !== "all" && record.category !== categoryFilter) return false;
      if (statusFilter !== "all" && record.status !== statusFilter) return false;
      return true;
    });
  }, [categoryFilter, records, statusFilter]);

  const stats = useMemo(() => {
    const active = records.filter((record) => record.status !== "completed").length;
    const blocked = records.filter((record) => record.status === "blocked").length;
    const fundsSent = records.reduce((sum, record) => sum + (Number(record.fundsSent) || 0), 0);
    const budget = records.reduce((sum, record) => sum + (Number(record.budgetAmount) || 0), 0);
    return { active, blocked, fundsSent, budget };
  }, [records]);

  const createRecord = async () => {
    if (!profile || !canEditOperations || !form.title.trim()) return;

    setSaving(true);
    try {
      const nation = nations.find((item) => item.id === form.nationId);
      const owner = leaders.find((item) => item.id === form.ownerId);
      const data = {
        category: form.category,
        title: form.title.trim(),
        summary: form.summary.trim(),
        status: form.status,
        priority: form.priority,
        nationId: nation?.id || null,
        nationName: nation?.name || null,
        ownerId: owner?.id || null,
        ownerName: owner?.displayName || null,
        dueDate: form.dueDate ? Timestamp.fromDate(new Date(form.dueDate)) : null,
        budgetAmount: form.budgetAmount ? Number(form.budgetAmount) : null,
        fundsSent: form.fundsSent ? Number(form.fundsSent) : null,
        currency: form.currency || "USD",
        travelRoute: form.travelRoute.trim() || null,
        meetingLink: form.meetingLink.trim() || null,
        documentUrl: form.documentUrl.trim() || null,
        nextAction: form.nextAction.trim() || null,
        createdBy: profile.id,
        createdByName: profile.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, COLLECTIONS.GLOBAL_OPERATIONS), data);
      setRecords((prev) => [{ id: ref.id, ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() } as GlobalOperationRecord, ...prev]);
      setForm(initialForm);
      setModalOpen(false);
      toast.success("Operation record created.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create operation record.");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (record: GlobalOperationRecord, status: GlobalOperationStatus) => {
    if (!canEditOperations) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.GLOBAL_OPERATIONS, record.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      setRecords((prev) => prev.map((item) => (item.id === record.id ? { ...item, status } : item)));
    } catch (error) {
      console.error(error);
      toast.error("Could not update status.");
    }
  };

  if (loading) return <PageLoader />;

  if (!canAccessOperations) {
    return (
      <EmptyState
        icon={<ClipboardList className="w-6 h-6" />}
        title="Global operations is restricted"
        description="Only assigned global operations roles can access mission operations, funds, travel, and procedures."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-200">Global Operations</p>
            <h1 className="mt-2 max-w-2xl text-3xl font-black leading-tight">Coordinate the people, missions, meetings, money, travel, and procedures behind the movement.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Use this workspace to administer the global team, national leader meetings, event playbooks, mission budgets, travel logistics, and field procedures.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageTeam && (
              <Link href="/operations/team">
                <Button variant="secondary" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                  <Users className="w-4 h-4" />
                  Global Team
                </Button>
              </Link>
            )}
            <Link href="/operations/assignments">
              <Button variant="secondary" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                <ListChecks className="w-4 h-4" />
                My Assignments
              </Button>
            </Link>
            <Link href="/operations/documents">
              <Button variant="secondary" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                <FileText className="w-4 h-4" />
                Playbooks
              </Button>
            </Link>
            {canEditOperations && (
              <Button onClick={() => setModalOpen(true)} className="bg-white text-slate-950 hover:bg-slate-100">
                <Plus className="w-4 h-4" />
                New Operations Record
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Active Items", value: stats.active, detail: "open records" },
          { label: "Blocked", value: stats.blocked, detail: "need intervention" },
          { label: "Budgeted", value: `$${stats.budget.toLocaleString()}`, detail: "tracked mission budget" },
          { label: "Funds Sent", value: `$${stats.fundsSent.toLocaleString()}`, detail: "recorded disbursements" },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{item.label}</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{item.value}</p>
            <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <SignalCard
          label="Overdue Tasks"
          value={signals.overdueTasks.length}
          tone={signals.overdueTasks.length ? "danger" : "normal"}
          detail="need follow-up"
        />
        <SignalCard
          label="Upcoming Meetings"
          value={signals.upcomingMeetings.length}
          detail="next 30 days"
        />
        <SignalCard
          label="Pending Gates"
          value={signals.pendingGates.length}
          tone={signals.pendingGates.length ? "warning" : "normal"}
          detail="required before mission"
        />
        <SignalCard
          label="Travel Issues"
          value={signals.travelIssues.length}
          tone={signals.travelIssues.length ? "danger" : "normal"}
          detail="movement blockers"
        />
        <SignalCard
          label="Sent This Month"
          value={`$${signals.financeThisMonth.toLocaleString()}`}
          detail="finance ledger"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CommandPanel
          title="Immediate Attention"
          icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
          empty="No overdue tasks, blocked gates, or travel issues."
          items={[
            ...signals.overdueTasks.slice(0, 4).map(({ operation, task }) => ({
              href: `/operations/${operation.id}`,
              title: task.title,
              meta: `${operation.title} · overdue ${formatDate(task.dueDate)}`,
              tone: "danger" as const,
            })),
            ...signals.pendingGates.slice(0, 4).map(({ operation, procedure }) => ({
              href: `/operations/${operation.id}`,
              title: procedure.title,
              meta: `${operation.title} · required gate · ${procedure.status.replaceAll("_", " ")}`,
              tone: "warning" as const,
            })),
            ...signals.travelIssues.slice(0, 4).map(({ operation, travel }) => ({
              href: `/operations/${operation.id}`,
              title: travel.travelerName,
              meta: `${operation.title} · ${travel.origin || "Origin TBD"} → ${travel.destination || "Destination TBD"}`,
              tone: "danger" as const,
            })),
          ].slice(0, 8)}
        />
        <CommandPanel
          title="Upcoming Meetings"
          icon={<CalendarDays className="w-4 h-4 text-indigo-600" />}
          empty="No scheduled meetings in the next 30 days."
          items={signals.upcomingMeetings.slice(0, 8).map(({ operation, meeting }) => ({
            href: `/operations/${operation.id}`,
            title: meeting.title,
            meta: `${operation.title} · ${formatDate(meeting.meetingDate)}`,
            tone: "normal" as const,
          }))}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {(Object.keys(CATEGORY_META) as GlobalOperationCategory[]).map((category) => {
          const meta = CATEGORY_META[category];
          const count = records.filter((record) => record.category === category && record.status !== "completed").length;
          return (
            <button
              key={category}
              onClick={() => setCategoryFilter(categoryFilter === category ? "all" : category)}
              className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                categoryFilter === category ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-100"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`rounded-2xl p-3 ${meta.accent}`}>{meta.icon}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-black text-slate-900">{meta.label}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{count}</span>
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{meta.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-black text-slate-900">Operations Tracker</h2>
            <p className="text-sm text-slate-500">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-2">
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)} aria-label="Filter category">
              <option value="all">All categories</option>
              {(Object.keys(CATEGORY_META) as GlobalOperationCategory[]).map((category) => (
                <option key={category} value={category}>{CATEGORY_META[category].label}</option>
              ))}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} aria-label="Filter status">
              <option value="all">All statuses</option>
              {(Object.keys(STATUS_LABELS) as GlobalOperationStatus[]).map((status) => (
                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
              ))}
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<ClipboardList className="w-6 h-6" />}
              title="No operation records yet"
              description={canEditOperations ? "Create the first record for a mission event, team assignment, meeting, funding item, travel plan, or procedure." : "No mission operations have been created yet."}
              action={canEditOperations ? <Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" />Create Record</Button> : undefined}
            />
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {filtered.map((record) => {
              const meta = CATEGORY_META[record.category];
              return (
                <div key={record.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.accent}`}>
                          {meta.icon}
                          {meta.label}
                        </span>
                        <Badge variant={statusVariant(record.status) as any}>{STATUS_LABELS[record.status]}</Badge>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-500">{record.priority}</span>
                      </div>
                      <Link href={`/operations/${record.id}`} className="mt-2 block text-base font-black text-slate-950 hover:text-indigo-700">
                        {record.title}
                      </Link>
                      {record.summary && <p className="mt-1 text-sm leading-6 text-slate-600">{record.summary}</p>}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>Nation: <strong className="text-slate-700">{record.nationName || "Global"}</strong></span>
                        <span>Owner: <strong className="text-slate-700">{record.ownerName || "Unassigned"}</strong></span>
                        <span>Due: <strong className="text-slate-700">{formatDate(record.dueDate)}</strong></span>
                        {(record.budgetAmount || record.fundsSent) && (
                          <span>
                            Funds: <strong className="text-slate-700">{record.currency || "USD"} {(record.fundsSent || 0).toLocaleString()} / {(record.budgetAmount || 0).toLocaleString()}</strong>
                          </span>
                        )}
                      </div>
                      {(record.travelRoute || record.meetingLink || record.documentUrl || record.nextAction) && (
                        <div className="mt-3 grid gap-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 md:grid-cols-2">
                          {record.travelRoute && <p><strong>Travel:</strong> {record.travelRoute}</p>}
                          {record.nextAction && <p><strong>Next:</strong> {record.nextAction}</p>}
                          {record.meetingLink && <a className="font-semibold text-indigo-600 hover:text-indigo-700" href={record.meetingLink} target="_blank" rel="noreferrer">Open meeting link</a>}
                          {record.documentUrl && <a className="font-semibold text-indigo-600 hover:text-indigo-700" href={record.documentUrl} target="_blank" rel="noreferrer">Open procedure/form</a>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button variant="secondary" size="sm" onClick={() => window.location.assign(`/operations/${record.id}`)}>
                        Open
                      </Button>
                      {canEditOperations && record.status !== "in_progress" && (
                        <Button variant="secondary" size="sm" onClick={() => updateStatus(record, "in_progress")}>Start</Button>
                      )}
                      {canEditOperations && record.status !== "completed" && (
                        <Button variant="secondary" size="sm" onClick={() => updateStatus(record, "completed")}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Operations Record" size="xl">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as GlobalOperationCategory })}>
              {(Object.keys(CATEGORY_META) as GlobalOperationCategory[]).map((category) => (
                <option key={category} value={category}>{CATEGORY_META[category].label}</option>
              ))}
            </Select>
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as GlobalOperationStatus })}>
              {(Object.keys(STATUS_LABELS) as GlobalOperationStatus[]).map((status) => (
                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
              ))}
            </Select>
          </div>

          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nigeria national leaders meeting, Kenya mission budget, UK volunteer flights..." />
          <Textarea label="Summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={3} placeholder="What needs to be coordinated, decided, tracked, or completed?" />

          <div className="grid gap-3 md:grid-cols-3">
            <Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as GlobalOperationRecord["priority"] })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
            <Select label="Nation" value={form.nationId} onChange={(e) => setForm({ ...form, nationId: e.target.value })}>
              <option value="">Global / Multiple nations</option>
              {nations.map((nation) => <option key={nation.id} value={nation.id}>{nation.name}</option>)}
            </Select>
            <Input label="Due Date" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>

          <Select label="Owner / Coordinator" value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
            <option value="">Unassigned</option>
            {leaders.map((leader) => <option key={leader.id} value={leader.id}>{leader.displayName} ({leader.role.replaceAll("_", " ")})</option>)}
          </Select>

          <div className="grid gap-3 md:grid-cols-3">
            <Input label="Budget Amount" type="number" min={0} value={form.budgetAmount} onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })} />
            <Input label="Funds Sent" type="number" min={0} value={form.fundsSent} onChange={(e) => setForm({ ...form, fundsSent: e.target.value })} />
            <Input label="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
          </div>

          <Input label="Travel / Accommodation Route" value={form.travelRoute} onChange={(e) => setForm({ ...form, travelRoute: e.target.value })} placeholder="Lagos → Nairobi, 4 volunteers, hotel pending..." />
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Meeting Link" value={form.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} placeholder="Zoom, Meet, Teams..." />
            <Input label="Playbook / Form / Procedure URL" value={form.documentUrl} onChange={(e) => setForm({ ...form, documentUrl: e.target.value })} placeholder="Google Doc, form, PDF..." />
          </div>
          <Textarea label="Next Action" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} rows={2} placeholder="Who must do what next?" />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={createRecord} loading={saving} disabled={!form.title.trim()}>Create Record</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SignalCard({
  label,
  value,
  detail,
  tone = "normal",
}: {
  label: string;
  value: number | string;
  detail: string;
  tone?: "normal" | "warning" | "danger";
}) {
  const color =
    tone === "danger"
      ? "bg-red-50 text-red-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-50 text-slate-700";

  return (
    <Card className="p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-2 inline-flex rounded-2xl px-3 py-1 text-2xl font-black ${color}`}>{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </Card>
  );
}

function CommandPanel({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<{ href: string; title: string; meta: string; tone: "normal" | "warning" | "danger" }>;
  empty: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-black text-slate-900">{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {items.map((item, idx) => (
            <Link key={`${item.href}-${idx}-${item.title}`} href={item.href} className="block py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1 h-2.5 w-2.5 rounded-full ${
                    item.tone === "danger" ? "bg-red-500" : item.tone === "warning" ? "bg-amber-500" : "bg-indigo-500"
                  }`}
                />
                <div>
                  <p className="text-sm font-black text-slate-900 hover:text-indigo-700">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.meta}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
