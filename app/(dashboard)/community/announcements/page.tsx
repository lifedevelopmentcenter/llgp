"use client";
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, orderBy, addDoc, serverTimestamp, limit,
  updateDoc, deleteDoc, doc,
} from "firebase/firestore";
import { Bell, Plus, Pin, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Announcement } from "@/lib/types";

export default function AnnouncementsPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", scope: "global" as Announcement["scope"], isPinned: false });
  const [editAnn, setEditAnn] = useState<Announcement | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, COLLECTIONS.ANNOUNCEMENTS), orderBy("createdAt", "desc"), limit(30)));
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const submit = async () => {
    if (!profile || !form.title || !form.body) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        authorId: profile.id,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL || null,
        nationId: profile.nationId || null,
        nationName: profile.nationName || null,
        cityId: profile.cityId || null,
        cityName: profile.cityName || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, COLLECTIONS.ANNOUNCEMENTS), data);
      setItems((prev) => [{ id: ref.id, ...data } as any, ...prev]);
      setModalOpen(false);
      setForm({ title: "", body: "", scope: "global", isPinned: false });
      toast.success("Announcement posted.");
    } catch (e) {
      toast.error("Failed to post announcement.");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editAnn) return;
    setEditSaving(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.ANNOUNCEMENTS, editAnn.id), {
        title: editAnn.title,
        body: editAnn.body,
        isPinned: editAnn.isPinned,
        updatedAt: serverTimestamp(),
      });
      setItems(prev => prev.map(a => a.id === editAnn.id ? { ...a, title: editAnn.title, body: editAnn.body, isPinned: editAnn.isPinned } : a));
      setEditAnn(null);
      toast.success("Updated.");
    } catch (e) { toast.error("Failed to update."); }
    finally { setEditSaving(false); }
  };

  const deleteAnn = async (id: string) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.ANNOUNCEMENTS, id));
      setItems(prev => prev.filter(a => a.id !== id));
      setDeleteConfirm(null);
      toast.success("Deleted.");
    } catch (e) { toast.error("Failed to delete."); }
  };

  const canPost = ["global_admin", "national_leader"].includes(profile?.role || "");
  const isAdmin = profile?.role === "global_admin";

  const visible = items.filter((ann) => {
    if (ann.scope === "global") return true;
    if (ann.scope === "national" && ann.nationId === profile?.nationId) return true;
    if (ann.scope === "city" && ann.cityId === profile?.cityId) return true;
    return false;
  });

  const pinned = visible.filter((a) => a.isPinned);
  const regular = visible.filter((a) => !a.isPinned);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Announcements</h1>
          <p className="text-sm text-slate-500">Updates from your leadership</p>
        </div>
        {canPost && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Post
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={<Bell className="w-6 h-6" />} title="No announcements yet" />
      ) : (
        <>
          {pinned.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5" /> Pinned
              </p>
              {pinned.map((ann) => (
                <AnnouncementCard
                  key={ann.id}
                  ann={ann}
                  canEdit={isAdmin || ann.authorId === profile?.id}
                  onEdit={setEditAnn}
                  onDelete={setDeleteConfirm}
                />
              ))}
            </div>
          )}
          <div className="space-y-3">
            {pinned.length > 0 && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recent</p>}
            {regular.map((ann) => (
              <AnnouncementCard
                key={ann.id}
                ann={ann}
                canEdit={isAdmin || ann.authorId === profile?.id}
                onEdit={setEditAnn}
                onDelete={setDeleteConfirm}
              />
            ))}
          </div>
        </>
      )}

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Post Announcement" size="md">
        <div className="space-y-3">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Message" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={5} />
          <Select label="Audience" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as any })}>
            <option value="global">Global</option>
            <option value="national">My Nation</option>
            <option value="city">My City</option>
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
            Pin this announcement
          </label>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={submit} loading={saving}>Post Announcement</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editAnn} onClose={() => setEditAnn(null)} title="Edit Announcement" size="md">
        <div className="space-y-3">
          <Input label="Title" value={editAnn?.title || ""} onChange={e => setEditAnn(prev => prev ? { ...prev, title: e.target.value } : null)} />
          <Textarea label="Message" value={editAnn?.body || ""} onChange={e => setEditAnn(prev => prev ? { ...prev, body: e.target.value } : null)} rows={5} />
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={editAnn?.isPinned || false} onChange={e => setEditAnn(prev => prev ? { ...prev, isPinned: e.target.checked } : null)} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
            Pinned
          </label>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setEditAnn(null)}>Cancel</Button>
            <Button className="flex-1" onClick={saveEdit} loading={editSaving}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Announcement?" size="sm">
        <p className="text-sm text-slate-600 mb-4">This cannot be undone.</p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button className="flex-1 !bg-red-600 hover:!bg-red-700" onClick={() => deleteAnn(deleteConfirm!)}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

function AnnouncementCard({
  ann, canEdit, onEdit, onDelete,
}: {
  ann: Announcement;
  canEdit: boolean;
  onEdit: (ann: Announcement) => void;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Avatar name={ann.authorName} photoURL={ann.authorPhoto} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-slate-900 text-sm">{ann.title}</h3>
              {ann.isPinned && <Badge variant="info"><Pin className="w-2.5 h-2.5 mr-0.5" />Pinned</Badge>}
              <Badge variant={ann.scope === "global" ? "purple" : ann.scope === "national" ? "info" : "default"} className="capitalize">
                {ann.scope}
              </Badge>
            </div>
            {canEdit && (
              <div className="relative flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(m => !m); }}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-7 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 min-w-[120px]">
                    <button onClick={() => { onEdit(ann); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                      <Pencil className="w-3.5 h-3.5" />Edit
                    </button>
                    <button onClick={() => { onDelete(ann.id); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5" />Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{ann.body}</p>
          <p className="text-xs text-slate-400 mt-2">{ann.authorName} · {timeAgo(ann.createdAt)}</p>
        </div>
      </div>
    </Card>
  );
}
