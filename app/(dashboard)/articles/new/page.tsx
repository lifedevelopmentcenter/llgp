"use client";
export const dynamic = "force-dynamic";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

function computeReadTime(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export default function NewArticlePage() {
  const { profile } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const handlePublish = async () => {
    if (!profile || !title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const tagList = tags.split(",").map(t => t.trim()).filter(Boolean);
      const readTime = computeReadTime(body);
      const ref = await addDoc(collection(db, COLLECTIONS.ARTICLES), {
        authorId: profile.id,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL || null,
        authorHeadline: (profile as any).headline || null,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        body: body.trim(),
        tags: tagList,
        readTime,
        viewCount: 0,
        commentCount: 0,
        reactionCounts: { like: 0, heart: 0, pray: 0 },
        isPublished: true,
        publishedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Article published!");
      router.push(`/articles/${ref.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to publish article.");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in pb-10">
      {/* Back */}
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="p-2 rounded-xl hover:bg-white text-slate-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-sm font-semibold text-slate-500">Write Article</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Title *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Your article title…"
            className="w-full px-4 py-3 text-lg font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-300"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Subtitle</label>
          <input
            type="text"
            value={subtitle}
            onChange={e => setSubtitle(e.target.value)}
            placeholder="Optional subtitle or summary…"
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Body *</label>
          <p className="text-xs text-slate-400 mb-2">Write your article below. You can use line breaks to separate paragraphs.</p>
          <textarea
            rows={18}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Start writing your article…"
            className="w-full px-4 py-3 text-sm text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y leading-relaxed"
          />
          {body.trim() && (
            <p className="text-xs text-slate-400 mt-1">~{computeReadTime(body)} min read · {body.trim().split(/\s+/).length} words</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Tags</label>
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="leadership, faith, entrepreneurship (comma separated)"
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="pt-2 flex gap-3">
          <Link href="/dashboard" className="flex-1">
            <button className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </Link>
          <Button
            className="flex-1"
            onClick={handlePublish}
            disabled={!title.trim() || !body.trim() || saving}
            loading={saving}
          >
            {saving ? "Publishing…" : "Publish Article"}
          </Button>
        </div>
      </div>
    </div>
  );
}
