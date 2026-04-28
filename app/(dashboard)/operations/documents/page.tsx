"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, Timestamp } from "firebase/firestore";
import { ArrowLeft, BookOpenCheck, ExternalLink, FileText, Plus, Search } from "lucide-react";
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
import { OPS_ACCESS_ROLES, OPS_EDITOR_ROLES, hasRole } from "@/lib/operations/roles";
import type { GlobalOperationCategory, GlobalOperationDocument, GlobalOperationDocumentType, Nation } from "@/lib/types";
import toast from "react-hot-toast";

const DOCUMENT_TYPE_LABELS: Record<GlobalOperationDocumentType, string> = {
  playbook: "Playbook",
  form: "Form",
  template: "Template",
  procedure: "Procedure",
  policy: "Policy",
  meeting_notes: "Meeting Notes",
  budget: "Budget",
  travel: "Travel",
};

const CATEGORY_LABELS: Record<GlobalOperationCategory, string> = {
  team: "Team",
  meeting: "Meetings",
  mission_event: "Mission Event",
  funding: "Funds & Budgets",
  travel: "Travel",
  procedure: "Procedures",
};

const initialForm = {
  title: "",
  type: "playbook" as GlobalOperationDocumentType,
  summary: "",
  documentUrl: "",
  nationId: "",
  category: "" as "" | GlobalOperationCategory,
  tags: "",
  isRequiredTemplate: false,
};

const formatDate = (value?: Timestamp | null) => {
  if (!value) return "No date";
  try {
    return value.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "No date";
  }
};

export default function OperationDocumentsPage() {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<GlobalOperationDocument[]>([]);
  const [nations, setNations] = useState<Nation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | GlobalOperationDocumentType>("all");
  const [form, setForm] = useState(initialForm);

  const canAccess = hasRole(profile?.role, OPS_ACCESS_ROLES);
  const canEdit = hasRole(profile?.role, OPS_EDITOR_ROLES);

  useEffect(() => {
    if (!profile) return;

    const load = async () => {
      try {
        const [documentsSnap, nationsSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.GLOBAL_OPERATION_DOCUMENTS), orderBy("createdAt", "desc"))),
          getDocs(query(collection(db, COLLECTIONS.NATIONS), orderBy("name"))),
        ]);
        setDocuments(documentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GlobalOperationDocument)));
        setNations(nationsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Nation)));
      } catch (error) {
        console.error(error);
        toast.error("Could not load operations documents.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile]);

  const filtered = useMemo(() => {
    return documents.filter((document) => {
      const text = `${document.title} ${document.summary || ""} ${document.nationName || ""} ${(document.tags || []).join(" ")}`.toLowerCase();
      if (search.trim() && !text.includes(search.trim().toLowerCase())) return false;
      if (typeFilter !== "all" && document.type !== typeFilter) return false;
      return true;
    });
  }, [documents, search, typeFilter]);

  const stats = useMemo(() => ({
    total: documents.length,
    required: documents.filter((document) => document.isRequiredTemplate).length,
    playbooks: documents.filter((document) => document.type === "playbook").length,
    forms: documents.filter((document) => document.type === "form").length,
  }), [documents]);

  const createDocument = async () => {
    if (!profile || !canEdit || !form.title.trim() || !form.documentUrl.trim()) return;

    setSaving(true);
    try {
      const nation = nations.find((item) => item.id === form.nationId);
      const data = {
        title: form.title.trim(),
        type: form.type,
        summary: form.summary.trim() || null,
        documentUrl: form.documentUrl.trim(),
        nationId: nation?.id || null,
        nationName: nation?.name || null,
        category: form.category || null,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        isRequiredTemplate: form.isRequiredTemplate,
        createdBy: profile.id,
        createdByName: profile.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, COLLECTIONS.GLOBAL_OPERATION_DOCUMENTS), data);
      setDocuments((prev) => [{ id: ref.id, ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() } as GlobalOperationDocument, ...prev]);
      setForm(initialForm);
      setModalOpen(false);
      toast.success("Document added.");
    } catch (error) {
      console.error(error);
      toast.error("Could not add document.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  if (!canAccess) {
    return (
      <EmptyState
        icon={<FileText className="w-6 h-6" />}
        title="Documents are restricted"
        description="Only assigned global operations roles can view mission playbooks, forms, and procedures."
      />
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href="/operations" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-700">
        <ArrowLeft className="w-4 h-4" />
        Back to Global Operations
      </Link>

      <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-500">Document Library</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">Mission playbooks, forms, procedures, and templates.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Keep the global team aligned around the latest meeting templates, mission procedures, travel forms, budget docs, and field playbooks.
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4" />
              Add Document
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <LibraryStat label="Documents" value={stats.total} />
        <LibraryStat label="Required" value={stats.required} />
        <LibraryStat label="Playbooks" value={stats.playbooks} />
        <LibraryStat label="Forms" value={stats.forms} />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Search documents, nation, tags..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | GlobalOperationDocumentType)} aria-label="Filter type" className="lg:w-56">
            <option value="all">All types</option>
            {(Object.keys(DOCUMENT_TYPE_LABELS) as GlobalOperationDocumentType[]).map((type) => (
              <option key={type} value={type}>{DOCUMENT_TYPE_LABELS[type]}</option>
            ))}
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-8 text-center">
            <BookOpenCheck className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 font-black text-slate-900">No documents found</p>
            <p className="mt-1 text-sm text-slate-500">Add mission playbooks, procedures, forms, meeting templates, or budget documents.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {filtered.map((document) => (
              <a key={document.id} href={document.documentUrl} target="_blank" rel="noreferrer" className="group rounded-2xl border border-slate-100 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-indigo-50 text-indigo-700">{DOCUMENT_TYPE_LABELS[document.type]}</Badge>
                      {document.isRequiredTemplate && <Badge className="bg-amber-50 text-amber-700">Required template</Badge>}
                    </div>
                    <p className="mt-2 font-black text-slate-950 group-hover:text-indigo-700">{document.title}</p>
                    {document.summary && <p className="mt-1 text-sm leading-6 text-slate-600">{document.summary}</p>}
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-indigo-600" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-400">
                  <span>{document.nationName || "Global"}</span>
                  {document.category && <span>{CATEGORY_LABELS[document.category]}</span>}
                  <span>Added {formatDate(document.createdAt)}</span>
                </div>
                {(document.tags || []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {document.tags?.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{tag}</span>
                    ))}
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Operations Document" size="lg">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ghana mission playbook" />
            <Select label="Type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as GlobalOperationDocumentType })}>
              {(Object.keys(DOCUMENT_TYPE_LABELS) as GlobalOperationDocumentType[]).map((type) => (
                <option key={type} value={type}>{DOCUMENT_TYPE_LABELS[type]}</option>
              ))}
            </Select>
          </div>
          <Input label="Document URL" value={form.documentUrl} onChange={(event) => setForm({ ...form, documentUrl: event.target.value })} placeholder="Google Doc, Sheet, Drive file, form, PDF..." />
          <Textarea label="Summary" rows={3} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="What this document is for and when the team should use it." />
          <div className="grid gap-3 md:grid-cols-2">
            <Select label="Nation" value={form.nationId} onChange={(event) => setForm({ ...form, nationId: event.target.value })}>
              <option value="">Global / multiple nations</option>
              {nations.map((nation) => <option key={nation.id} value={nation.id}>{nation.name}</option>)}
            </Select>
            <Select label="Operation Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as "" | GlobalOperationCategory })}>
              <option value="">General</option>
              {(Object.keys(CATEGORY_LABELS) as GlobalOperationCategory[]).map((category) => (
                <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
              ))}
            </Select>
          </div>
          <Input label="Tags" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="visa, safety, volunteers, monthly meeting" />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.isRequiredTemplate}
              onChange={(event) => setForm({ ...form, isRequiredTemplate: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            Required template for mission readiness
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={createDocument} loading={saving} disabled={!form.title.trim() || !form.documentUrl.trim()}>Add Document</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function LibraryStat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </Card>
  );
}
