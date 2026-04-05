"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, orderBy, addDoc, updateDoc,
  doc, serverTimestamp, where,
} from "firebase/firestore";
import { BookOpen, Plus, Layers, Video, Edit2, Eye, EyeOff } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { PageLoader } from "@/components/ui/Spinner";
import toast from "react-hot-toast";
import type { VentureCourse, VentureLesson, LLGLIModule } from "@/lib/types";

export default function AdminCoursesPage() {
  return (
    <AuthGuard requiredRoles={["global_admin"]}>
      <CoursesContent />
    </AuthGuard>
  );
}

function CoursesContent() {
  const [tab, setTab] = useState<"venture" | "llgli">("venture");
  const [courses, setCourses] = useState<VentureCourse[]>([]);
  const [lessons, setLessons] = useState<VentureLesson[]>([]);
  const [modules, setModules] = useState<LLGLIModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseModal, setCourseModal] = useState(false);
  const [lessonModal, setLessonModal] = useState(false);
  const [moduleModal, setModuleModal] = useState(false);
  const [activeCourse, setActiveCourse] = useState<VentureCourse | null>(null);
  const [editCourse, setEditCourse] = useState<VentureCourse | null>(null);
  const [editLesson, setEditLesson] = useState<VentureLesson | null>(null);
  const [editModule, setEditModule] = useState<LLGLIModule | null>(null);
  const [saving, setSaving] = useState(false);

  const [courseForm, setCourseForm] = useState({ title: "", description: "", order: 1, isPublished: false });
  const [lessonForm, setLessonForm] = useState({ title: "", description: "", videoUrl: "", content: "", duration: 0, order: 1, isPublished: true });
  const [moduleForm, setModuleForm] = useState({ weekNumber: 1, title: "", description: "", videoUrl: "", content: "", assignmentPrompt: "", isPublished: true });

  useEffect(() => {
    const load = async () => {
      try {
        const [cSnap, lSnap, mSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.VENTURE_COURSES), orderBy("order"))),
          getDocs(query(collection(db, COLLECTIONS.VENTURE_LESSONS), orderBy("order"))),
          getDocs(query(collection(db, COLLECTIONS.LLGLI_MODULES), orderBy("weekNumber"))),
        ]);
        setCourses(cSnap.docs.map((d) => ({ id: d.id, ...d.data() } as VentureCourse)));
        setLessons(lSnap.docs.map((d) => ({ id: d.id, ...d.data() } as VentureLesson)));
        setModules(mSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LLGLIModule)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  // ---- Courses ----
  const openCourseModal = (c?: VentureCourse) => {
    setEditCourse(c || null);
    setCourseForm(c ? { title: c.title, description: c.description, order: c.order, isPublished: c.isPublished } : { title: "", description: "", order: courses.length + 1, isPublished: false });
    setCourseModal(true);
  };

  const saveCourse = async () => {
    if (!courseForm.title) return;
    setSaving(true);
    try {
      const data = { ...courseForm, totalLessons: 0, updatedAt: serverTimestamp() };
      if (editCourse) {
        await updateDoc(doc(db, COLLECTIONS.VENTURE_COURSES, editCourse.id), data);
        setCourses((p) => p.map((c) => c.id === editCourse.id ? { ...c, ...data } as VentureCourse : c));
        toast.success("Course updated.");
      } else {
        const ref = await addDoc(collection(db, COLLECTIONS.VENTURE_COURSES), { ...data, createdAt: serverTimestamp() });
        setCourses((p) => [...p, { id: ref.id, ...data } as any]);
        toast.success("Course created.");
      }
      setCourseModal(false);
    } catch (e) { toast.error("Failed."); }
    finally { setSaving(false); }
  };

  const toggleCoursePublish = async (course: VentureCourse) => {
    await updateDoc(doc(db, COLLECTIONS.VENTURE_COURSES, course.id), { isPublished: !course.isPublished });
    setCourses((p) => p.map((c) => c.id === course.id ? { ...c, isPublished: !c.isPublished } : c));
  };

  // ---- Lessons ----
  const openLessonModal = (course: VentureCourse, l?: VentureLesson) => {
    setActiveCourse(course);
    setEditLesson(l || null);
    const courseLessons = lessons.filter((x) => x.courseId === course.id);
    setLessonForm(l
      ? { title: l.title, description: l.description || "", videoUrl: l.videoUrl || "", content: l.content || "", duration: l.duration || 0, order: l.order, isPublished: l.isPublished }
      : { title: "", description: "", videoUrl: "", content: "", duration: 0, order: courseLessons.length + 1, isPublished: true }
    );
    setLessonModal(true);
  };

  const saveLesson = async () => {
    if (!lessonForm.title || !activeCourse) return;
    setSaving(true);
    try {
      const data = { ...lessonForm, courseId: activeCourse.id, updatedAt: serverTimestamp() };
      if (editLesson) {
        await updateDoc(doc(db, COLLECTIONS.VENTURE_LESSONS, editLesson.id), data);
        setLessons((p) => p.map((l) => l.id === editLesson.id ? { ...l, ...data } as VentureLesson : l));
        toast.success("Lesson updated.");
      } else {
        const ref = await addDoc(collection(db, COLLECTIONS.VENTURE_LESSONS), { ...data, createdAt: serverTimestamp() });
        setLessons((p) => [...p, { id: ref.id, ...data } as any]);
        // Update totalLessons count
        const newCount = lessons.filter((l) => l.courseId === activeCourse.id).length + 1;
        await updateDoc(doc(db, COLLECTIONS.VENTURE_COURSES, activeCourse.id), { totalLessons: newCount });
        setCourses((p) => p.map((c) => c.id === activeCourse.id ? { ...c, totalLessons: newCount } : c));
        toast.success("Lesson added.");
      }
      setLessonModal(false);
    } catch (e) { toast.error("Failed."); }
    finally { setSaving(false); }
  };

  // ---- LLGLI Modules ----
  const openModuleModal = (m?: LLGLIModule) => {
    setEditModule(m || null);
    setModuleForm(m
      ? { weekNumber: m.weekNumber, title: m.title, description: m.description, videoUrl: m.videoUrl || "", content: m.content || "", assignmentPrompt: m.assignmentPrompt, isPublished: m.isPublished }
      : { weekNumber: modules.length + 1, title: "", description: "", videoUrl: "", content: "", assignmentPrompt: "", isPublished: true }
    );
    setModuleModal(true);
  };

  const saveModule = async () => {
    if (!moduleForm.title || !moduleForm.assignmentPrompt) return;
    setSaving(true);
    try {
      const data = { ...moduleForm, updatedAt: serverTimestamp() };
      if (editModule) {
        await updateDoc(doc(db, COLLECTIONS.LLGLI_MODULES, editModule.id), data);
        setModules((p) => p.map((m) => m.id === editModule.id ? { ...m, ...data } as LLGLIModule : m));
        toast.success("Module updated.");
      } else {
        const ref = await addDoc(collection(db, COLLECTIONS.LLGLI_MODULES), { ...data, createdAt: serverTimestamp() });
        setModules((p) => [...p, { id: ref.id, ...data } as any]);
        toast.success("Module created.");
      }
      setModuleModal(false);
    } catch (e) { toast.error("Failed."); }
    finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Course Management</h1>
        <p className="text-sm text-slate-500">Manage Venture 100 and LLGLI content</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[{ key: "venture", label: "Venture 100" }, { key: "llgli", label: "LLGLI Modules" }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`py-1.5 px-4 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "venture" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openCourseModal()}><Plus className="w-4 h-4" />Add Course</Button>
          </div>
          {courses.map((course) => {
            const courseLessons = lessons.filter((l) => l.courseId === course.id);
            return (
              <Card key={course.id} padding={false}>
                <div className="flex items-start justify-between p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">{course.order}</div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{course.title}</h3>
                      <p className="text-xs text-slate-500">{courseLessons.length} lessons</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleCoursePublish(course)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                      {course.isPublished ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <Button variant="ghost" size="sm" onClick={() => openCourseModal(course)}><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" onClick={() => openLessonModal(course)}><Plus className="w-3.5 h-3.5" />Lesson</Button>
                  </div>
                </div>
                {courseLessons.length > 0 && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {courseLessons.map((l) => (
                      <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-xs text-slate-400 w-5">{l.order}</span>
                        <div className="flex items-center gap-1.5 flex-1">
                          {l.videoUrl && <Video className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />}
                          <span className="text-sm text-slate-700">{l.title}</span>
                          {l.duration ? <span className="text-xs text-slate-400">· {l.duration}m</span> : null}
                        </div>
                        {!l.isPublished && <Badge variant="warning">Draft</Badge>}
                        <Button variant="ghost" size="sm" onClick={() => openLessonModal(course, l)}><Edit2 className="w-3 h-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openModuleModal()}><Plus className="w-4 h-4" />Add Week</Button>
          </div>
          {modules.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700">W{m.weekNumber}</div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{m.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{m.description}</p>
                    <p className="text-xs text-indigo-600 mt-0.5 line-clamp-1">Assignment: {m.assignmentPrompt}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!m.isPublished && <Badge variant="warning">Draft</Badge>}
                  <Button variant="ghost" size="sm" onClick={() => openModuleModal(m)}><Edit2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Course Modal */}
      <Modal open={courseModal} onClose={() => setCourseModal(false)} title={editCourse ? "Edit Course" : "Add Course"} size="md">
        <div className="space-y-3">
          <Input label="Title *" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} />
          <Textarea label="Description" value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} rows={3} />
          <Input label="Order" type="number" value={courseForm.order} onChange={(e) => setCourseForm({ ...courseForm, order: +e.target.value })} min={1} />
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={courseForm.isPublished} onChange={(e) => setCourseForm({ ...courseForm, isPublished: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
            Published (visible to participants)
          </label>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setCourseModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={saveCourse} loading={saving}>{editCourse ? "Update" : "Create"}</Button>
          </div>
        </div>
      </Modal>

      {/* Lesson Modal */}
      <Modal open={lessonModal} onClose={() => setLessonModal(false)} title={editLesson ? "Edit Lesson" : "Add Lesson"} size="lg">
        <div className="space-y-3">
          {activeCourse && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">Course: {activeCourse.title}</p>}
          <Input label="Lesson Title *" value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} />
          <Input label="Video URL" type="url" value={lessonForm.videoUrl} onChange={(e) => setLessonForm({ ...lessonForm, videoUrl: e.target.value })} placeholder="YouTube or Vimeo URL" />
          <Textarea label="Lesson Content / Notes" value={lessonForm.content} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} rows={4} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Duration (minutes)" type="number" value={lessonForm.duration} onChange={(e) => setLessonForm({ ...lessonForm, duration: +e.target.value })} min={0} />
            <Input label="Order" type="number" value={lessonForm.order} onChange={(e) => setLessonForm({ ...lessonForm, order: +e.target.value })} min={1} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={lessonForm.isPublished} onChange={(e) => setLessonForm({ ...lessonForm, isPublished: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
            Published
          </label>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setLessonModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={saveLesson} loading={saving}>{editLesson ? "Update" : "Add"} Lesson</Button>
          </div>
        </div>
      </Modal>

      {/* Module Modal */}
      <Modal open={moduleModal} onClose={() => setModuleModal(false)} title={editModule ? "Edit Module" : "Add Week"} size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Week Number *" type="number" value={moduleForm.weekNumber} onChange={(e) => setModuleForm({ ...moduleForm, weekNumber: +e.target.value })} min={1} max={6} />
            <Input label="Title *" value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} />
          </div>
          <Textarea label="Description" value={moduleForm.description} onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })} rows={2} />
          <Input label="Video URL" type="url" value={moduleForm.videoUrl} onChange={(e) => setModuleForm({ ...moduleForm, videoUrl: e.target.value })} placeholder="YouTube or Vimeo URL" />
          <Textarea label="Content / Teaching Notes" value={moduleForm.content} onChange={(e) => setModuleForm({ ...moduleForm, content: e.target.value })} rows={4} />
          <Textarea label="Assignment Prompt *" value={moduleForm.assignmentPrompt} onChange={(e) => setModuleForm({ ...moduleForm, assignmentPrompt: e.target.value })} rows={3} placeholder="What should participants reflect on and submit?" />
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={moduleForm.isPublished} onChange={(e) => setModuleForm({ ...moduleForm, isPublished: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
            Published
          </label>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModuleModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={saveModule} loading={saving}>{editModule ? "Update" : "Create"} Week</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
