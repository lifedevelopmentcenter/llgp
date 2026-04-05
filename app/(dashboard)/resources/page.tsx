"use client";
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, orderBy, addDoc, serverTimestamp, where,
} from "firebase/firestore";
import { FolderOpen, Plus, Download, Search, FileText, Video, Image, File } from "lucide-react";
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
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Resource } from "@/lib/types";

const CATEGORIES = ["Training", "Leadership", "Prayer", "Outreach", "Reports", "Media", "Other"];

function getFileIcon(type: string) {
  if (type.includes("video")) return <Video className="w-5 h-5 text-purple-600" />;
  if (type.includes("image")) return <Image className="w-5 h-5 text-blue-600" />;
  if (type.includes("pdf") || type.includes("doc")) return <FileText className="w-5 h-5 text-red-600" />;
  return <File className="w-5 h-5 text-slate-600" />;
}

export default function ResourcesPage() {
  const { profile } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", fileUrl: "", fileType: "pdf", category: "Training", tags: "" });

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, COLLECTIONS.RESOURCES), orderBy("createdAt", "desc")));
        setResources(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Resource)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const saveResource = async () => {
    if (!form.title || !form.fileUrl) { toast.error("Title and file URL are required."); return; }
    if (!profile) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        uploadedBy: profile.id,
        uploaderName: profile.displayName,
        isPublic: true,
        downloadCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, COLLECTIONS.RESOURCES), data);
      setResources((prev) => [{ id: ref.id, ...data } as any, ...prev]);
      setModalOpen(false);
      setForm({ title: "", description: "", fileUrl: "", fileType: "pdf", category: "Training", tags: "" });
      toast.success("Resource uploaded.");
    } catch (e) {
      toast.error("Failed to upload resource.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = resources.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat && r.category !== filterCat) return false;
    return true;
  });

  const canUpload = ["global_admin", "national_leader"].includes(profile?.role || "");

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Resource Library</h1>
          <p className="text-sm text-slate-500">{filtered.length} resource{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        {canUpload && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Add Resource
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-36">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search resources…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Resource grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-6 h-6" />}
          title="No resources found"
          description={canUpload ? "Upload your first resource." : "Resources will appear here once added."}
          action={canUpload ? <Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" />Add Resource</Button> : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r) => (
            <Card key={r.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  {getFileIcon(r.fileType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">{r.title}</p>
                  <Badge variant="default" className="mt-0.5">{r.category}</Badge>
                </div>
              </div>
              {r.description && (
                <p className="text-xs text-slate-500 line-clamp-2">{r.description}</p>
              )}
              <div className="flex items-center justify-between mt-auto">
                <p className="text-xs text-slate-400">{r.uploaderName}</p>
                <a
                  href={r.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Resource" size="lg">
        <div className="space-y-3">
          <Input label="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          <Input label="File URL *" type="url" value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} placeholder="https://drive.google.com/…" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="File Type" value={form.fileType} onChange={(e) => setForm({ ...form, fileType: e.target.value })}>
              {["pdf", "docx", "pptx", "mp4", "mp3", "image", "other"].map((t) => <option key={t}>{t}</option>)}
            </Select>
            <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <Input label="Tags (comma-separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="leadership, prayer, training" />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={saveResource} loading={saving}>Upload Resource</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
