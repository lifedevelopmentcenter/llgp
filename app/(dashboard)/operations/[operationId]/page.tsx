"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Edit3,
  FileCheck2,
  MessageSquare,
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
import type {
  GlobalOperationCategory,
  GlobalOperationNote,
  GlobalOperationRecord,
  GlobalOperationStatus,
  GlobalOperationTask,
  Nation,
  UserProfile,
} from "@/lib/types";
import toast from "react-hot-toast";

const CATEGORY_META: Record<GlobalOperationCategory, { label: string; icon: React.ReactNode; accent: string }> = {
  team: { label: "Team", icon: <Users className="w-4 h-4" />, accent: "bg-sky-50 text-sky-700" },
  meeting: { label: "Meetings", icon: <CalendarDays className="w-4 h-4" />, accent: "bg-indigo-50 text-indigo-700" },
  mission_event: { label: "Mission Events", icon: <ClipboardList className="w-4 h-4" />, accent: "bg-emerald-50 text-emerald-700" },
  funding: { label: "Funds & Budgets", icon: <WalletCards className="w-4 h-4" />, accent: "bg-amber-50 text-amber-700" },
  travel: { label: "Travel", icon: <Plane className="w-4 h-4" />, accent: "bg-rose-50 text-rose-700" },
  procedure: { label: "Procedures", icon: <FileCheck2 className="w-4 h-4" />, accent: "bg-violet-50 text-violet-700" },
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

const toDateInput = (value?: Timestamp | null) => {
  if (!value) return "";
  try {
    return value.toDate().toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const formatDate = (value?: Timestamp | null) => {
  if (!value) return "No date";
  try {
    return value.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "No date";
  }
};

const operationFormFrom = (record: GlobalOperationRecord) => ({
  category: record.category,
  title: record.title || "",
  summary: record.summary || "",
  status: record.status,
  priority: record.priority,
  nationId: record.nationId || "",
  ownerId: record.ownerId || "",
  dueDate: toDateInput(record.dueDate),
  budgetAmount: record.budgetAmount?.toString() || "",
  fundsSent: record.fundsSent?.toString() || "",
  currency: record.currency || "USD",
  travelRoute: record.travelRoute || "",
  meetingLink: record.meetingLink || "",
  documentUrl: record.documentUrl || "",
  nextAction: record.nextAction || "",
});

export default function OperationDetailPage() {
  const { profile } = useAuth();
  const params = useParams<{ operationId: string }>();
  const router = useRouter();
  const operationId = Array.isArray(params.operationId) ? params.operationId[0] : params.operationId;

  const [record, setRecord] = useState<GlobalOperationRecord | null>(null);
  const [tasks, setTasks] = useState<GlobalOperationTask[]>([]);
  const [notes, setNotes] = useState<GlobalOperationNote[]>([]);
  const [nations, setNations] = useState<Nation[]>([]);
  const [leaders, setLeaders] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [operationForm, setOperationForm] = useState<any>(null);
  const [taskForm, setTaskForm] = useState({ title: "", assignedToId: "", dueDate: "" });
  const [noteBody, setNoteBody] = useState("");

  useEffect(() => {
    if (!profile || !operationId) return;

    const load = async () => {
      try {
        const operationRef = doc(db, COLLECTIONS.GLOBAL_OPERATIONS, operationId);
        const [operationSnap, tasksSnap, notesSnap, nationsSnap, usersSnap] = await Promise.all([
          getDoc(operationRef),
          getDocs(query(collection(operationRef, "tasks"), orderBy("createdAt", "asc"))),
          getDocs(query(collection(operationRef, "notes"), orderBy("createdAt", "desc"))),
          getDocs(query(collection(db, COLLECTIONS.NATIONS), orderBy("name"))),
          getDocs(query(collection(db, COLLECTIONS.USERS), orderBy("displayName"))),
        ]);

        if (!operationSnap.exists()) {
          setRecord(null);
          return;
        }

        const operation = { id: operationSnap.id, ...operationSnap.data() } as GlobalOperationRecord;
        setRecord(operation);
        setOperationForm(operationFormFrom(operation));
        setTasks(tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GlobalOperationTask)));
        setNotes(notesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GlobalOperationNote)));
        setNations(nationsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Nation)));
        setLeaders(
          usersSnap.docs
            .map((d) => ({ id: d.id, ...d.data() } as UserProfile))
            .filter((user) => user.role !== "participant" && user.isActive !== false)
        );
      } catch (error) {
        console.error(error);
        toast.error("Could not load operation.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [operationId, profile]);

  const progress = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter((task) => task.isComplete).length / tasks.length) * 100);
  }, [tasks]);

  const updateOperation = async () => {
    if (!record || !operationForm?.title?.trim()) return;

    setSaving(true);
    try {
      const nation = nations.find((item) => item.id === operationForm.nationId);
      const owner = leaders.find((item) => item.id === operationForm.ownerId);
      const data = {
        category: operationForm.category,
        title: operationForm.title.trim(),
        summary: operationForm.summary.trim(),
        status: operationForm.status,
        priority: operationForm.priority,
        nationId: nation?.id || null,
        nationName: nation?.name || null,
        ownerId: owner?.id || null,
        ownerName: owner?.displayName || null,
        dueDate: operationForm.dueDate ? Timestamp.fromDate(new Date(operationForm.dueDate)) : null,
        budgetAmount: operationForm.budgetAmount ? Number(operationForm.budgetAmount) : null,
        fundsSent: operationForm.fundsSent ? Number(operationForm.fundsSent) : null,
        currency: operationForm.currency || "USD",
        travelRoute: operationForm.travelRoute.trim() || null,
        meetingLink: operationForm.meetingLink.trim() || null,
        documentUrl: operationForm.documentUrl.trim() || null,
        nextAction: operationForm.nextAction.trim() || null,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, COLLECTIONS.GLOBAL_OPERATIONS, record.id), data);
      setRecord({ ...record, ...data, updatedAt: Timestamp.now() } as GlobalOperationRecord);
      setEditOpen(false);
      toast.success("Operation updated.");
    } catch (error) {
      console.error(error);
      toast.error("Could not update operation.");
    } finally {
      setSaving(false);
    }
  };

  const addTask = async () => {
    if (!record || !profile || !taskForm.title.trim()) return;
    try {
      const assignee = leaders.find((leader) => leader.id === taskForm.assignedToId);
      const data = {
        title: taskForm.title.trim(),
        assignedToId: assignee?.id || null,
        assignedToName: assignee?.displayName || null,
        dueDate: taskForm.dueDate ? Timestamp.fromDate(new Date(taskForm.dueDate)) : null,
        isComplete: false,
        completedAt: null,
        createdBy: profile.id,
        createdByName: profile.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, COLLECTIONS.GLOBAL_OPERATIONS, record.id, "tasks"), data);
      setTasks((prev) => [...prev, { id: ref.id, ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() } as GlobalOperationTask]);
      setTaskForm({ title: "", assignedToId: "", dueDate: "" });
    } catch (error) {
      console.error(error);
      toast.error("Could not add task.");
    }
  };

  const toggleTask = async (task: GlobalOperationTask) => {
    if (!record) return;
    const nextComplete = !task.isComplete;
    try {
      await updateDoc(doc(db, COLLECTIONS.GLOBAL_OPERATIONS, record.id, "tasks", task.id), {
        isComplete: nextComplete,
        completedAt: nextComplete ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });
      setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, isComplete: nextComplete, completedAt: nextComplete ? Timestamp.now() : null } : item)));
    } catch (error) {
      console.error(error);
      toast.error("Could not update task.");
    }
  };

  const addNote = async () => {
    if (!record || !profile || !noteBody.trim()) return;
    try {
      const data = {
        body: noteBody.trim(),
        authorId: profile.id,
        authorName: profile.displayName,
        createdAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, COLLECTIONS.GLOBAL_OPERATIONS, record.id, "notes"), data);
      setNotes((prev) => [{ id: ref.id, ...data, createdAt: Timestamp.now() } as GlobalOperationNote, ...prev]);
      setNoteBody("");
    } catch (error) {
      console.error(error);
      toast.error("Could not add note.");
    }
  };

  const archiveOperation = async () => {
    if (!record) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.GLOBAL_OPERATIONS, record.id), {
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Operation archived.");
      router.push("/operations");
    } catch (error) {
      console.error(error);
      toast.error("Could not archive operation.");
    }
  };

  if (loading) return <PageLoader />;

  if (profile?.role !== "global_admin") {
    return (
      <EmptyState
        icon={<ClipboardList className="w-6 h-6" />}
        title="Global operations is restricted"
        description="Only global admins can administer mission operations, funds, travel, and procedures."
      />
    );
  }

  if (!record) {
    return (
      <EmptyState
        icon={<ClipboardList className="w-6 h-6" />}
        title="Operation not found"
        description="This operation record does not exist or has been removed."
        action={<Button onClick={() => router.push("/operations")}>Back to Operations</Button>}
      />
    );
  }

  const meta = CATEGORY_META[record.category];

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href="/operations" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-700">
        <ArrowLeft className="w-4 h-4" />
        Back to Global Operations
      </Link>

      <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.accent}`}>
                {meta.icon}
                {meta.label}
              </span>
              <Badge variant={statusVariant(record.status) as any}>{STATUS_LABELS[record.status]}</Badge>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-500">{record.priority}</span>
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-950">{record.title}</h1>
            {record.summary && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{record.summary}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Edit3 className="w-4 h-4" />
              Edit
            </Button>
            <Button variant="danger" onClick={archiveOperation}>
              <Archive className="w-4 h-4" />
              Archive
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <InfoTile label="Nation" value={record.nationName || "Global"} />
          <InfoTile label="Owner" value={record.ownerName || "Unassigned"} />
          <InfoTile label="Due Date" value={formatDate(record.dueDate)} />
          <InfoTile label="Task Progress" value={`${progress}%`} />
        </div>

        <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 md:grid-cols-2">
          <p><strong>Funds:</strong> {record.currency || "USD"} {(record.fundsSent || 0).toLocaleString()} sent / {(record.budgetAmount || 0).toLocaleString()} budgeted</p>
          <p><strong>Next action:</strong> {record.nextAction || "Not set"}</p>
          <p><strong>Travel:</strong> {record.travelRoute || "Not set"}</p>
          <div className="flex flex-wrap gap-3">
            {record.meetingLink && <a className="font-semibold text-indigo-600 hover:text-indigo-700" href={record.meetingLink} target="_blank" rel="noreferrer">Meeting link</a>}
            {record.documentUrl && <a className="font-semibold text-indigo-600 hover:text-indigo-700" href={record.documentUrl} target="_blank" rel="noreferrer">Playbook / form / procedure</a>}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-slate-900">Tasks & Checklist</h2>
              <p className="text-sm text-slate-500">{tasks.filter((task) => task.isComplete).length} of {tasks.length} complete</p>
            </div>
            <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_180px_140px_auto]">
            <Input aria-label="Task title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Add a task or checklist item" />
            <Select aria-label="Assign task" value={taskForm.assignedToId} onChange={(e) => setTaskForm({ ...taskForm, assignedToId: e.target.value })}>
              <option value="">Unassigned</option>
              {leaders.map((leader) => <option key={leader.id} value={leader.id}>{leader.displayName}</option>)}
            </Select>
            <Input aria-label="Task due date" type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
            <Button onClick={addTask} disabled={!taskForm.title.trim()}>
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Add tasks for approvals, travel bookings, meeting follow-up, receipts, forms, or field procedures.
              </div>
            ) : (
              tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left transition-colors hover:bg-slate-50"
                >
                  <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${task.isComplete ? "border-green-500 bg-green-500 text-white" : "border-slate-300"}`}>
                    {task.isComplete && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-semibold ${task.isComplete ? "text-slate-400 line-through" : "text-slate-900"}`}>{task.title}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {task.assignedToName || "Unassigned"} · due {formatDate(task.dueDate)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            <h2 className="font-black text-slate-900">Notes & Decisions</h2>
          </div>
          <Textarea
            className="mt-4"
            rows={3}
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Add meeting notes, decisions, finance updates, travel changes, or mission instructions..."
          />
          <div className="mt-2 flex justify-end">
            <Button onClick={addNote} disabled={!noteBody.trim()}>Add Note</Button>
          </div>

          <div className="mt-4 space-y-3">
            {notes.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No notes yet.</p>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="rounded-2xl bg-slate-50 p-3">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.body}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">{note.authorName} · {formatDate(note.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Operation" size="xl">
        {operationForm && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Select label="Category" value={operationForm.category} onChange={(e) => setOperationForm({ ...operationForm, category: e.target.value as GlobalOperationCategory })}>
                {(Object.keys(CATEGORY_META) as GlobalOperationCategory[]).map((category) => (
                  <option key={category} value={category}>{CATEGORY_META[category].label}</option>
                ))}
              </Select>
              <Select label="Status" value={operationForm.status} onChange={(e) => setOperationForm({ ...operationForm, status: e.target.value as GlobalOperationStatus })}>
                {(Object.keys(STATUS_LABELS) as GlobalOperationStatus[]).map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                ))}
              </Select>
            </div>

            <Input label="Title" value={operationForm.title} onChange={(e) => setOperationForm({ ...operationForm, title: e.target.value })} />
            <Textarea label="Summary" value={operationForm.summary} onChange={(e) => setOperationForm({ ...operationForm, summary: e.target.value })} rows={3} />

            <div className="grid gap-3 md:grid-cols-3">
              <Select label="Priority" value={operationForm.priority} onChange={(e) => setOperationForm({ ...operationForm, priority: e.target.value as GlobalOperationRecord["priority"] })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
              <Select label="Nation" value={operationForm.nationId} onChange={(e) => setOperationForm({ ...operationForm, nationId: e.target.value })}>
                <option value="">Global / Multiple nations</option>
                {nations.map((nation) => <option key={nation.id} value={nation.id}>{nation.name}</option>)}
              </Select>
              <Input label="Due Date" type="date" value={operationForm.dueDate} onChange={(e) => setOperationForm({ ...operationForm, dueDate: e.target.value })} />
            </div>

            <Select label="Owner / Coordinator" value={operationForm.ownerId} onChange={(e) => setOperationForm({ ...operationForm, ownerId: e.target.value })}>
              <option value="">Unassigned</option>
              {leaders.map((leader) => <option key={leader.id} value={leader.id}>{leader.displayName} ({leader.role.replaceAll("_", " ")})</option>)}
            </Select>

            <div className="grid gap-3 md:grid-cols-3">
              <Input label="Budget Amount" type="number" min={0} value={operationForm.budgetAmount} onChange={(e) => setOperationForm({ ...operationForm, budgetAmount: e.target.value })} />
              <Input label="Funds Sent" type="number" min={0} value={operationForm.fundsSent} onChange={(e) => setOperationForm({ ...operationForm, fundsSent: e.target.value })} />
              <Input label="Currency" value={operationForm.currency} onChange={(e) => setOperationForm({ ...operationForm, currency: e.target.value.toUpperCase() })} />
            </div>

            <Input label="Travel / Accommodation Route" value={operationForm.travelRoute} onChange={(e) => setOperationForm({ ...operationForm, travelRoute: e.target.value })} />
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Meeting Link" value={operationForm.meetingLink} onChange={(e) => setOperationForm({ ...operationForm, meetingLink: e.target.value })} />
              <Input label="Playbook / Form / Procedure URL" value={operationForm.documentUrl} onChange={(e) => setOperationForm({ ...operationForm, documentUrl: e.target.value })} />
            </div>
            <Textarea label="Next Action" value={operationForm.nextAction} onChange={(e) => setOperationForm({ ...operationForm, nextAction: e.target.value })} rows={2} />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={updateOperation} loading={saving} disabled={!operationForm.title.trim()}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}
