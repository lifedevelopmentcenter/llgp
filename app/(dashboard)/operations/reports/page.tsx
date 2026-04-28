"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import { ArrowLeft, BarChart3, Download, FileText, Plane, WalletCards } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { OPS_ACCESS_ROLES, hasRole } from "@/lib/operations/roles";
import type {
  GlobalOperationFinanceItem,
  GlobalOperationMeetingItem,
  GlobalOperationProcedureItem,
  GlobalOperationRecord,
  GlobalOperationTask,
  GlobalOperationTravelItem,
} from "@/lib/types";
import toast from "react-hot-toast";

interface OperationReportBundle {
  record: GlobalOperationRecord;
  tasks: GlobalOperationTask[];
  procedures: GlobalOperationProcedureItem[];
  travel: GlobalOperationTravelItem[];
  finance: GlobalOperationFinanceItem[];
  meetings: GlobalOperationMeetingItem[];
}

const formatDate = (value?: Timestamp | null) => {
  if (!value) return "";
  try {
    return value.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
};

const isPast = (value?: Timestamp | null) => {
  if (!value) return false;
  try {
    return value.toDate() < new Date();
  } catch {
    return false;
  }
};

const csvEscape = (value: string | number | null | undefined) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function OperationReportsPage() {
  const { profile } = useAuth();
  const [bundles, setBundles] = useState<OperationReportBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const canAccess = hasRole(profile?.role, OPS_ACCESS_ROLES);

  useEffect(() => {
    if (!profile) return;

    const load = async () => {
      try {
        const recordsSnap = await getDocs(query(collection(db, COLLECTIONS.GLOBAL_OPERATIONS), orderBy("createdAt", "desc")));
        const activeRecords = recordsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as GlobalOperationRecord))
          .filter((record) => !record.archivedAt);

        const nextBundles = await Promise.all(
          activeRecords.map(async (record) => {
            const operationRef = doc(db, COLLECTIONS.GLOBAL_OPERATIONS, record.id);
            const [tasksSnap, proceduresSnap, travelSnap, financeSnap, meetingsSnap] = await Promise.all([
              getDocs(query(collection(operationRef, "tasks"), orderBy("createdAt", "asc"))),
              getDocs(query(collection(operationRef, "procedures"), orderBy("createdAt", "desc"))),
              getDocs(query(collection(operationRef, "travel"), orderBy("createdAt", "desc"))),
              getDocs(query(collection(operationRef, "finance"), orderBy("createdAt", "desc"))),
              getDocs(query(collection(operationRef, "meetings"), orderBy("meetingDate", "asc"))),
            ]);
            return {
              record,
              tasks: tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GlobalOperationTask)),
              procedures: proceduresSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GlobalOperationProcedureItem)),
              travel: travelSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GlobalOperationTravelItem)),
              finance: financeSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GlobalOperationFinanceItem)),
              meetings: meetingsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GlobalOperationMeetingItem)),
            };
          })
        );
        setBundles(nextBundles);
      } catch (error) {
        console.error(error);
        toast.error("Could not load operations reports.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile]);

  const report = useMemo(() => {
    const finance = bundles.flatMap((bundle) => bundle.finance.map((item) => ({ operation: bundle.record, item })));
    const travel = bundles.flatMap((bundle) => bundle.travel.map((item) => ({ operation: bundle.record, item })));
    const tasks = bundles.flatMap((bundle) => bundle.tasks.map((item) => ({ operation: bundle.record, item })));
    const procedures = bundles.flatMap((bundle) => bundle.procedures.map((item) => ({ operation: bundle.record, item })));
    const meetings = bundles.flatMap((bundle) => bundle.meetings.map((item) => ({ operation: bundle.record, item })));

    return {
      activeOperations: bundles.filter((bundle) => bundle.record.status !== "completed").length,
      blockedOperations: bundles.filter((bundle) => bundle.record.status === "blocked").length,
      totalBudget: finance.filter(({ item }) => item.type === "budget").reduce((sum, { item }) => sum + Number(item.amount || 0), 0),
      totalSent: finance.filter(({ item }) => item.type === "disbursement").reduce((sum, { item }) => sum + Number(item.amount || 0), 0),
      totalSpent: finance.filter(({ item }) => item.type === "expense").reduce((sum, { item }) => sum + Number(item.amount || 0), 0),
      pendingFinanceApprovals: finance.filter(({ item }) => item.status === "requested" && !item.approvedAt).length,
      travelIssues: travel.filter(({ item }) => item.status === "issue").length,
      travelersOpen: travel.filter(({ item }) => item.status !== "completed").length,
      overdueTasks: tasks.filter(({ item }) => !item.isComplete && isPast(item.dueDate)).length,
      pendingGates: procedures.filter(({ item }) => item.requiredBeforeMission && item.status !== "complete").length,
      upcomingMeetings: meetings.filter(({ item }) => item.status === "scheduled" && !isPast(item.meetingDate)).length,
      finance,
      travel,
      tasks,
      procedures,
      meetings,
    };
  }, [bundles]);

  const exportCsv = () => {
    const rows = [
      ["Operation", "Nation", "Status", "Owner", "Due Date", "Budget", "Funds Sent", "Travelers", "Travel Issues", "Overdue Tasks", "Pending Gates", "Upcoming Meetings"],
      ...bundles.map((bundle) => [
        bundle.record.title,
        bundle.record.nationName || "Global",
        bundle.record.status,
        bundle.record.ownerName || "Unassigned",
        formatDate(bundle.record.dueDate),
        bundle.finance.filter((item) => item.type === "budget").reduce((sum, item) => sum + Number(item.amount || 0), 0),
        bundle.finance.filter((item) => item.type === "disbursement").reduce((sum, item) => sum + Number(item.amount || 0), 0),
        bundle.travel.length,
        bundle.travel.filter((item) => item.status === "issue").length,
        bundle.tasks.filter((item) => !item.isComplete && isPast(item.dueDate)).length,
        bundle.procedures.filter((item) => item.requiredBeforeMission && item.status !== "complete").length,
        bundle.meetings.filter((item) => item.status === "scheduled" && !isPast(item.meetingDate)).length,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `global-operations-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <PageLoader />;

  if (!canAccess) {
    return (
      <EmptyState
        icon={<BarChart3 className="w-6 h-6" />}
        title="Reports are restricted"
        description="Only assigned global operations roles can view global operations reports."
      />
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href="/operations" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-700">
        <ArrowLeft className="w-4 h-4" />
        Back to Global Operations
      </Link>

      <div className="rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200">Operations Reports</p>
            <h1 className="mt-2 text-2xl font-black">Executive snapshot for missions, money, movement, and meetings.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Use this page for monthly national meeting reviews, finance tracking, travel risk, open mission gates, and operational export.
            </p>
          </div>
          <Button onClick={exportCsv} className="bg-white text-slate-950 hover:bg-slate-100">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <ReportStat label="Active Operations" value={report.activeOperations} />
        <ReportStat label="Blocked" value={report.blockedOperations} tone={report.blockedOperations ? "danger" : "normal"} />
        <ReportStat label="Overdue Tasks" value={report.overdueTasks} tone={report.overdueTasks ? "danger" : "normal"} />
        <ReportStat label="Pending Gates" value={report.pendingGates} tone={report.pendingGates ? "warning" : "normal"} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <ReportStat label="Budgeted" value={`$${report.totalBudget.toLocaleString()}`} />
        <ReportStat label="Sent" value={`$${report.totalSent.toLocaleString()}`} />
        <ReportStat label="Spent" value={`$${report.totalSpent.toLocaleString()}`} />
        <ReportStat label="Finance Approvals" value={report.pendingFinanceApprovals} tone={report.pendingFinanceApprovals ? "warning" : "normal"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ReportPanel title="Finance Risk" icon={<WalletCards className="w-4 h-4 text-amber-600" />} empty="No requested finance approvals.">
          {report.finance
            .filter(({ item }) => item.status === "requested" && !item.approvedAt)
            .slice(0, 8)
            .map(({ operation, item }) => (
              <ReportRow key={`${operation.id}-${item.id}`} href={`/operations/${operation.id}`} title={item.description} meta={`${operation.title} · ${item.currency} ${Number(item.amount || 0).toLocaleString()} · ${item.recipient || "No recipient"}`} tone="warning" />
            ))}
        </ReportPanel>

        <ReportPanel title="Travel Risk" icon={<Plane className="w-4 h-4 text-rose-600" />} empty="No travel issues recorded.">
          {report.travel
            .filter(({ item }) => item.status === "issue")
            .slice(0, 8)
            .map(({ operation, item }) => (
              <ReportRow key={`${operation.id}-${item.id}`} href={`/operations/${operation.id}`} title={item.travelerName} meta={`${operation.title} · ${item.origin || "Origin TBD"} to ${item.destination || "Destination TBD"}`} tone="danger" />
            ))}
        </ReportPanel>

        <ReportPanel title="Mission Gates" icon={<FileText className="w-4 h-4 text-violet-600" />} empty="No pending mission gates.">
          {report.procedures
            .filter(({ item }) => item.requiredBeforeMission && item.status !== "complete")
            .slice(0, 8)
            .map(({ operation, item }) => (
              <ReportRow key={`${operation.id}-${item.id}`} href={`/operations/${operation.id}`} title={item.title} meta={`${operation.title} · ${item.status.replaceAll("_", " ")} · due ${formatDate(item.dueDate) || "No date"}`} tone={item.status === "blocked" ? "danger" : "warning"} />
            ))}
        </ReportPanel>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-slate-900">Operation Summary</h2>
            <p className="text-sm text-slate-500">{bundles.length} active operation record{bundles.length !== 1 ? "s" : ""}</p>
          </div>
          <Badge className="bg-slate-100 text-slate-700">{report.travelersOpen} open travelers</Badge>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
          {bundles.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No active operation records yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {bundles.map((bundle) => (
                <Link key={bundle.record.id} href={`/operations/${bundle.record.id}`} className="grid gap-3 p-4 text-sm transition-colors hover:bg-slate-50 lg:grid-cols-[1fr_120px_120px_120px_120px] lg:items-center">
                  <div>
                    <p className="font-black text-slate-900">{bundle.record.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{bundle.record.nationName || "Global"} · {bundle.record.ownerName || "Unassigned"} · due {formatDate(bundle.record.dueDate) || "No date"}</p>
                  </div>
                  <Badge variant={bundle.record.status === "blocked" ? "danger" : "default"}>{bundle.record.status.replaceAll("_", " ")}</Badge>
                  <p className="font-bold text-slate-700">${bundle.finance.filter((item) => item.type === "disbursement").reduce((sum, item) => sum + Number(item.amount || 0), 0).toLocaleString()} sent</p>
                  <p className="font-bold text-slate-700">{bundle.travel.length} traveler{bundle.travel.length !== 1 ? "s" : ""}</p>
                  <p className="font-bold text-slate-700">{bundle.procedures.filter((item) => item.requiredBeforeMission && item.status !== "complete").length} gate{bundle.procedures.filter((item) => item.requiredBeforeMission && item.status !== "complete").length !== 1 ? "s" : ""}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function ReportStat({ label, value, tone = "normal" }: { label: string; value: number | string; tone?: "normal" | "warning" | "danger" }) {
  const valueClass = tone === "danger" ? "text-red-700" : tone === "warning" ? "text-amber-700" : "text-slate-950";
  return (
    <Card className="p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-black ${valueClass}`}>{value}</p>
    </Card>
  );
}

function ReportPanel({ title, icon, empty, children }: { title: string; icon: React.ReactNode; empty: string; children: React.ReactNode[] }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-black text-slate-900">{title}</h2>
      </div>
      <div className="mt-4 space-y-2">
        {children.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{empty}</p> : children}
      </div>
    </Card>
  );
}

function ReportRow({ href, title, meta, tone }: { href: string; title: string; meta: string; tone: "warning" | "danger" }) {
  return (
    <Link href={href} className={`block rounded-2xl border p-3 transition-colors hover:bg-white ${tone === "danger" ? "border-red-100 bg-red-50" : "border-amber-100 bg-amber-50"}`}>
      <p className="font-black text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-600">{meta}</p>
    </Link>
  );
}
