"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  doc, getDoc, updateDoc, increment, addDoc, collection,
  serverTimestamp, getDocs, query, where, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { PageLoader } from "@/components/ui/Spinner";
import { ArrowLeft, Clock, Eye, MessageSquare } from "lucide-react";
import Link from "next/link";
import { timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Article } from "@/lib/types";

interface ArticleComment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string | null;
  body: string;
  createdAt: any;
}

export default function ArticleReaderPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const { profile } = useAuth();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [reacted, setReacted] = useState<string | null>(null);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.ARTICLES, articleId));
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as Article;
          setArticle(data);

          // Record view
          try {
            await updateDoc(doc(db, COLLECTIONS.ARTICLES, articleId), {
              viewCount: increment(1),
            });
          } catch { /* ignore */ }

          // Check own reaction
          if (profile) {
            const reactId = `${articleId}_${profile.id}`;
            const reactSnap = await getDoc(doc(db, COLLECTIONS.REACTIONS, reactId));
            if (reactSnap.exists() && reactSnap.data().type) {
              setReacted(reactSnap.data().type);
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [articleId, profile?.id]);

  const loadComments = async () => {
    try {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.COMMENTS),
        where("parentId", "==", articleId),
        where("parentType", "==", "article"),
        orderBy("createdAt", "asc")
      ));
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as ArticleComment)));
    } catch (e) { console.error(e); }
  };

  const handleReact = async (type: "like" | "heart" | "pray") => {
    if (!profile || !article) return;
    const reactId = `${articleId}_${profile.id}`;
    const existing = reacted;
    try {
      if (existing === type) {
        setReacted(null);
        setArticle(prev => prev ? {
          ...prev,
          reactionCounts: { ...prev.reactionCounts, [type]: Math.max(0, (prev.reactionCounts[type] || 0) - 1) }
        } : prev);
        await updateDoc(doc(db, COLLECTIONS.REACTIONS, reactId), { type: null });
        await updateDoc(doc(db, COLLECTIONS.ARTICLES, articleId), { [`reactionCounts.${type}`]: increment(-1) });
      } else {
        if (existing) {
          setArticle(prev => prev ? {
            ...prev,
            reactionCounts: {
              ...prev.reactionCounts,
              [existing]: Math.max(0, (prev.reactionCounts[existing as keyof typeof prev.reactionCounts] || 0) - 1),
              [type]: (prev.reactionCounts[type] || 0) + 1,
            }
          } : prev);
        } else {
          setArticle(prev => prev ? {
            ...prev,
            reactionCounts: { ...prev.reactionCounts, [type]: (prev.reactionCounts[type] || 0) + 1 }
          } : prev);
        }
        setReacted(type);
        await import("firebase/firestore").then(({ setDoc, doc: fsDoc }) =>
          setDoc(fsDoc(db, COLLECTIONS.REACTIONS, reactId), {
            postId: articleId, postType: "post", userId: profile.id, type, createdAt: serverTimestamp(),
          })
        );
        const updates: Record<string, any> = { [`reactionCounts.${type}`]: increment(1) };
        if (existing) updates[`reactionCounts.${existing}`] = increment(-1);
        await updateDoc(doc(db, COLLECTIONS.ARTICLES, articleId), updates);
      }
    } catch { toast.error("Reaction failed"); }
  };

  const handleComment = async () => {
    if (!profile || !commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await addDoc(collection(db, COLLECTIONS.COMMENTS), {
        parentId: articleId,
        parentType: "article",
        authorId: profile.id,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL || null,
        body: commentText.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCommentText("");
      toast.success("Comment posted");
      await loadComments();
    } catch { toast.error("Failed to post comment"); }
    finally { setSubmittingComment(false); }
  };

  if (loading) return <PageLoader />;
  if (!article) return <div className="text-center py-16 text-slate-400 text-sm">Article not found.</div>;

  const totalReactions = (article.reactionCounts?.like || 0) + (article.reactionCounts?.heart || 0) + (article.reactionCounts?.pray || 0);

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in pb-10">
      {/* Back */}
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="p-2 rounded-xl hover:bg-white text-slate-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-sm font-semibold text-slate-500">Article</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Cover image */}
        {article.coverImage && (
          <img src={article.coverImage} alt={article.title} className="w-full h-48 object-cover" />
        )}

        <div className="p-6">
          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {article.tags.map(tag => (
                <span key={tag} className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-2xl font-black text-slate-900 leading-tight mb-2">{article.title}</h1>
          {article.subtitle && (
            <p className="text-base text-slate-500 mb-4 leading-relaxed">{article.subtitle}</p>
          )}

          {/* Author + meta */}
          <div className="flex items-center gap-3 py-4 border-y border-slate-100 mb-5">
            <Link href={`/profile/${article.authorId}`}>
              <Avatar name={article.authorName} photoURL={article.authorPhoto} size="md" />
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/profile/${article.authorId}`} className="font-bold text-slate-900 text-sm hover:text-indigo-600 transition-colors">
                {article.authorName}
              </Link>
              {article.authorHeadline && (
                <p className="text-xs text-slate-400 truncate">{article.authorHeadline}</p>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 flex-shrink-0">
              {article.readTime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {article.readTime} min read
                </span>
              )}
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {article.viewCount}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed">
            {article.body.split("\n").map((para, i) => (
              para.trim() ? (
                <p key={i} className="mb-3">{para}</p>
              ) : (
                <br key={i} />
              )
            ))}
          </div>

          {/* Reaction counts */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span>👍❤️🙏</span>
              <span>{totalReactions} reactions</span>
            </div>
            <button
              onClick={() => { setShowComments(v => !v); if (!showComments) loadComments(); }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {article.commentCount || 0} comments
            </button>
          </div>

          {/* Reaction buttons */}
          {profile && (
            <div className="flex gap-1 mt-3 border-t border-slate-100 pt-3">
              {(["like", "heart", "pray"] as const).map(type => {
                const icons = { like: "👍", heart: "❤️", pray: "🙏" };
                const labels = { like: "Like", heart: "Love", pray: "Pray" };
                return (
                  <button key={type} onClick={() => handleReact(type)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-xl transition-colors ${reacted === type ? "text-indigo-600 bg-indigo-50" : "text-slate-500 hover:bg-slate-50"}`}>
                    <span>{icons[type]}</span>
                    <span className="text-xs">{labels[type]}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Comments */}
          {showComments && (
            <div className="mt-4 space-y-3">
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <Avatar name={c.authorName} photoURL={c.authorPhoto ?? undefined} size="sm" className="flex-shrink-0" />
                  <div className="bg-slate-50 rounded-xl px-3 py-2 flex-1">
                    <p className="text-xs font-bold text-slate-900">{c.authorName}</p>
                    <p className="text-sm text-slate-700 mt-0.5">{c.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{timeAgo(c.createdAt)}</p>
                  </div>
                </div>
              ))}
              {profile && (
                <div className="flex gap-2 mt-2">
                  <textarea
                    rows={2}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Write a comment…"
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleComment}
                    disabled={!commentText.trim() || submittingComment}
                    className="px-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-indigo-700 transition-colors"
                  >
                    Post
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
