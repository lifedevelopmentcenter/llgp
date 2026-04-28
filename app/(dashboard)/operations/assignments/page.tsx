"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  ListChecks,
  Plane,
  WalletCards,
} from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Badge } from "@/components/ui/Badge";
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

type AssignmentTone = "danger" | "warning" | "normal" | "success";

interface AssignmentItem {
  id: string;
  type: "operation" | "task" | "procedure" | "travel" | "finance" | "meeting";
  title: string;
  operation: GlobalOperationRecord;
  meta: string;
  dueDate?: Timestamp | null;
  tone: AssignmentTone;
}

const formatDate = (value?: Timestamp | null) => {
  if (!value) return "No date";
  try {
    return value.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "No date";
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

const itemIcon = (type: AssignmentItem["type"]) => {
  if (type === "operation") return <ClipboardList className="h-4 w-4" />;
  if (type === "task") return <CheckCircle2 className="h-4 w-4" />;
  if (type === "procedure") return <FileCheck2 className="h-4 w-4" />;
  if (type === "travel") return <Plane className="h-4 w-4" />;
  if (type === "finance") return <WalletCards className="h-4 w-4" />;
  return <CalendarDays className="h-4 w-4" />;
};

const toneClass = (tone: AssignmentTone) => {
  if (tone === "danger") return "border-red-100 bg-red-50 text-red-800";
  if (tone === "warning") return "border-amber-100 bg-amber-50 text-amber-800";
  if (tone === "success") return "border-green-100 bg-green-50 text-green-800";
  return "border-slate-100 bg-slate-50 text-slate-700";
};

export default function OperationAssignmentsPage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<GlobalOperationRecord[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
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

        const nested = await Promise.all(
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

        const uid = profile.id;
        const role = profile.role;
        const nextAssignments: AssignmentItem[] = [];

        activeRecords.forEach((record) => {
          if (record.ownerId === uid && record.status !== "completed") {
            nextAssignments.push({
              id: `operation-${record.id}`,
              type: "operation",
              title: record.title,
              operation: record,
              meta: `Operation owner · ${record.nationName || "Global"} · due ${formatDate(record.dueDate)}`,
              dueDate: record.dueDate,
              tone: record.status === "blocked" || isPast(record.dueDate) ? "danger" : "normal",
            });
          }
        });

        nested.forEach(({ record, tasks, procedures, travel, finance, meetings }) => {
          tasks.forEach((task) => {
            const assignedToMe = task.assignedToId === uid;
            const inMissionQueue = role === "missions_coordinator" && !task.isComplete;
            if ((assignedToMe || inMissionQueue) && !task.isComplete) {
              nextAssignments.push({
                id: `task-${record.id}-${task.id}`,
                type: "task",
                title: task.title,
                operation: record,
                meta: `${assignedToMe ? "Assigned to you" : "Mission queue"} · ${task.assignedToName || "Unassigned"} · due ${formatDate(task.dueDate)}`,
                dueDate: task.dueDate,
                tone: isPast(task.dueDate) ? "danger" : "normal",
              });
            }
          });

          procedures.forEach((procedure) => {
            const ownedByMe = procedure.ownerId === uid;
            const inMissionQueue = role === "missions_coordinator" && procedure.status !== "complete";
            if ((ownedByMe || inMissionQueue) && procedure.status !== "complete") {
              nextAssignments.push({
                id: `procedure-${record.id}-${procedure.id}`,
                type: "procedure",
                title: procedure.title,
                operation: record,
                meta: `${ownedByMe ? "Procedure owner" : "Mission gate"} · ${procedure.status.replaceAll("_", " ")} · due ${formatDate(procedure.dueDate)}`,
                dueDate: procedure.dueDate,
                tone: procedure.status === "blocked" || isPast(procedure.dueDate) ? "danger" : procedure.requiredBeforeMission ? "warning" : "normal",
              });
            }
          });

          travel.forEach((item) => {
            const travelerIsMe = item.travelerUserId === uid;
            const inTravelQueue = role === "travel_coordinator" && item.status !== "completed";
            if ((travelerIsMe || inTravelQueue) && item.status !== "completed") {
              nextAssignments.push({
                id: `travel-${record.id}-${item.id}`,
                type: "travel",
                title: item.travelerName,
                operation: record,
                meta: `${travelerIsMe ? "Your travel" : "Travel queue"} · ${item.origin || "Origin TBD"} to ${item.destination || "Destination TBD"} · arrival ${formatDate(item.arrivalDate)}`,
                dueDate: item.arrivalDate,
                tone: item.status === "issue" ? "danger" : item.status === "planning" ? "warning" : "normal",
              });
            }
          });

          finance.forEach((item) => {
            const createdByMe = item.createdBy === uid;
            const inFinanceQueue = role === "finance_coordinator" && item.status !== "reconciled";
            if ((createdByMe || inFinanceQueue) && item.status !== "reconciled") {
              nextAssignments.push({
                id: `finance-${record.id}-${item.id}`,
                type: "finance",
                title: item.description,
                operation: record,
                meta: `${createdByMe ? "Created by you" : "Finance queue"} · ${item.currency} ${Number(item.amount || 0).toLocaleString()} · ${item.status}`,
                dueDate: item.transactionDate,
                tone: item.status === "requested" || item.status === "planned" ? "warning" : "normal",
              });
            }
          });

          meetings.forEach((meeting) => {
            const inMissionQueue = role === "missions_coordinator" && meeting.status === "scheduled";
            if (inMissionQueue) {
              nextAssignments.push({
                id: `meeting-${record.id}-${meeting.id}`,
                type: "meeting",
                title: meeting.title,
                operation: record,
                meta: `Scheduled meeting · ${formatDate(meeting.meetingDate)} · ${meeting.attendees || "No attendees recorded"}`,
                dueDate: meeting.meetingDate,
                tone: isPast(meeting.meetingDate) ? "danger" : "normal",
              });
            }
          });
        });

        nextAssignments.sort((a, b) => (a.dueDate?.toMillis() || Number.MAX_SAFE_INTEGER) - (b.dueDate?.toMillis() || Number.MAX_SAFE_INTEGER));
        setRecords(activeRecords);
        setAssignments(nextAssignments);
      } catch (error) {
        console.error(error);
        toast.error("Could not load assignments.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile]);

  const stats = useMemo(() => {
    return {
      total: assignments.length,
      overdue: assignments.filter((item) => item.tone === "danger").length,
      warning: assignments.filter((item) => item.tone === "warning").length,
      ownedOperations: records.filter((record) => record.ownerId === profile?.id && record.status !== "completed").length,
    };
  }, [assignments, profile?.id, records]);

  if (loading) return <PageLoader />;

  if (!canAccess) {
    return (
      <EmptyState
        icon={<ListChecks className="w-6 h-6" />}
        title="Assignments are restricted"
        description="Only assigned global operations roles can view operations accountability."
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
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-200">My Assignments</p>
        <h1 className="mt-2 text-2xl font-black">Personal and role-based operations accountability.</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          See what you personally own and what your coordinator role must monitor across missions, meetings, travel, finance, procedures, and operation records.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <AssignmentStat label="Open Assignments" value={stats.total} />
        <AssignmentStat label="Overdue / Blocked" value={stats.overdue} tone="danger" />
        <AssignmentStat label="Needs Attention" value={stats.warning} tone="warning" />
        <AssignmentStat label="Owned Operations" value={stats.ownedOperations} />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-slate-900">Accountability Queue</h2>
            <p className="text-sm text-slate-500">{assignments.length} open item{assignments.length !== 1 ? "s" : ""}</p>
          </div>
          <Badge className="bg-slate-100 text-slate-700">{profile?.role.replaceAll("_", " ")}</Badge>
        </div>

        {assignments.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-8 text-center">
            <ListChecks className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 font-black text-slate-900">No open assignments</p>
            <p className="mt-1 text-sm text-slate-500">Assigned tasks, owned procedures, travel movement, finance queue items, and owned operations will appear here.</p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {assignments.map((item) => (
              <Link key={item.id} href={`/operations/${item.operation.id}`} className="block py-3 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-3 rounded-2xl border border-transparent p-3 transition-colors hover:border-indigo-100 hover:bg-indigo-50/40 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${toneClass(item.tone)}`}>
                        {itemIcon(item.type)}
                        {item.type}
                      </span>
                      <Badge variant={item.operation.status === "blocked" ? "danger" : "default"}>{item.operation.status.replaceAll("_", " ")}</Badge>
                    </div>
                    <p className="mt-2 font-black text-slate-950">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.operation.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.meta}</p>
                  </div>
                  <div className="shrink-0 text-sm font-bold text-slate-500">
                    {formatDate(item.dueDate)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AssignmentStat({ label, value, tone = "normal" }: { label: string; value: number; tone?: "normal" | "warning" | "danger" }) {
  const valueClass = tone === "danger" ? "text-red-700" : tone === "warning" ? "text-amber-700" : "text-slate-950";
  return (
    <Card className="p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-black ${valueClass}`}>{value}</p>
    </Card>
  );
}
