"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc, getDoc, updateDoc, serverTimestamp,
  getDocs, collection, query, where, orderBy, limit,
  deleteDoc, setDoc,
} from "firebase/firestore";
import {
  ArrowLeft, Edit2, Globe, Mail, Check, MapPin, Briefcase,
  BookOpen, Layers, MessageSquare, UserPlus, Pencil, Plus,
  Trash2, Users2, UserCheck, Image, GraduationCap, CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageLoader } from "@/components/ui/Spinner";
import { ROLE_LABELS } from "@/lib/types";
import { getRoleColor, timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import type { UserProfile, Group, VentureCourse, UserProgress, Event, Follow } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const SPHERES = ["Business", "Government", "Education", "Media", "Church", "Arts & Entertainment", "Family", "Health", "Technology", "Sports"];

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia",
  "Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Belarus","Belgium","Belize",
  "Benin","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria",
  "Burkina Faso","Burundi","Cambodia","Cameroon","Canada","Central African Republic",
  "Chad","Chile","China","Colombia","Congo","Costa Rica","Croatia","Cuba","Cyprus",
  "Czech Republic","Denmark","Dominican Republic","Ecuador","Egypt","El Salvador",
  "Eritrea","Estonia","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia",
  "Germany","Ghana","Greece","Guatemala","Guinea","Haiti","Honduras","Hungary","Iceland",
  "India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Ivory Coast","Jamaica",
  "Japan","Jordan","Kazakhstan","Kenya","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon",
  "Liberia","Libya","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Mali",
  "Malta","Mauritania","Mauritius","Mexico","Moldova","Mongolia","Morocco","Mozambique",
  "Myanmar","Namibia","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria",
  "North Korea","Norway","Oman","Pakistan","Palestine","Panama","Papua New Guinea",
  "Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda",
  "Saudi Arabia","Senegal","Serbia","Sierra Leone","Singapore","Slovakia","Slovenia",
  "Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan",
  "Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Togo",
  "Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Uganda","Ukraine",
  "United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan",
  "Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];

const COVER_GRADIENTS = [
  "from-indigo-500 via-indigo-600 to-violet-600",
  "from-teal-500 via-teal-600 to-emerald-600",
  "from-rose-500 via-rose-600 to-pink-600",
  "from-amber-500 via-orange-500 to-rose-500",
  "from-violet-500 via-purple-600 to-indigo-600",
];

function getCoverGradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h += name.charCodeAt(i);
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length];
}

type TabId = "timeline" | "profile" | "connections" | "groups" | "photos" | "courses" | "events";
const TABS: { id: TabId; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "profile", label: "Profile" },
  { id: "connections", label: "Connections" },
  { id: "groups", label: "Groups" },
  { id: "photos", label: "Photos" },
  { id: "courses", label: "Courses" },
  { id: "events", label: "Events" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start py-2 border-b border-slate-50 last:border-0">
      <span className="w-40 flex-shrink-0 text-xs font-semibold text-slate-500">{label}</span>
      <span className="flex-1 text-sm text-slate-900">{value || "—"}</span>
    </div>
  );
}

function SectionCard({
  title,
  isMe,
  onEdit,
  children,
}: {
  title: string;
  isMe: boolean;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
        {isMe && onEdit && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { profile: myProfile, refreshProfile } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  // Timeline
  const [userPosts, setUserPosts] = useState<Array<{
    id: string; type: string; title?: string; body: string; createdAt: any; collection: string;
  }>>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // Edit modals
  const [editPersonal, setEditPersonal] = useState(false);
  const [editAdditional, setEditAdditional] = useState(false);
  const [editPurpose, setEditPurpose] = useState(false);
  const [saving, setSaving] = useState(false);

  // Personal form
  const [personalForm, setPersonalForm] = useState({
    firstName: "", lastName: "", nickname: "", gender: "",
    countryOfOrigin: "", countryOfResidence: "", cityName: "",
    participatingInTraining: false as boolean,
  });

  // Additional form
  const [additionalForm, setAdditionalForm] = useState({
    phone: "", education: "", languages: "", profession: "",
    websiteUrl: "", podcastUrl: "", youtubeUrl: "",
  });

  // Purpose form
  const [purposeForm, setPurposeForm] = useState({
    nameAcronymHeader: "",
    nameAcronym: [] as { letter: string; meaning: string }[],
    sphereOfInfluence: [] as string[], missionStatement: "", summary: "", motto: "",
  });

  // Connections
  const [followers, setFollowers] = useState<Follow[]>([]);
  const [following, setFollowing] = useState<Follow[]>([]);
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<"followers" | "following">("followers");

  // Groups
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);

  // Photos
  const [photos, setPhotos] = useState<string[]>([]);
  const [photosLoaded, setPhotosLoaded] = useState(false);

  // Courses
  const [courseProgress, setCourseProgress] = useState<Array<VentureCourse & { completedLessons: number; percentage: number }>>([]);
  const [coursesLoaded, setCoursesLoaded] = useState(false);

  // Events
  const [userEvents, setUserEvents] = useState<Event[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  const isMe = myProfile?.id === userId;

  // ── Load profile ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.USERS, userId));
        if (snap.exists()) {
          const p = { id: snap.id, ...snap.data() } as UserProfile;
          setProfile(p);
          // Check follow status on load (not lazily)
          if (myProfile && myProfile.id !== userId) {
            const followSnap = await getDoc(doc(db, COLLECTIONS.FOLLOWS, `${myProfile.id}_${userId}`));
            setIsFollowing(followSnap.exists());
          }
          // Pre-fill forms for own profile
          if (myProfile?.id === userId) {
            setPersonalForm({
              firstName: p.firstName || "",
              lastName: p.lastName || "",
              nickname: p.nickname || "",
              gender: p.gender || "",
              countryOfOrigin: p.countryOfOrigin || "",
              countryOfResidence: p.countryOfResidence || "",
              cityName: p.cityName || "",
              participatingInTraining: p.participatingInTraining || false,
            });
            setAdditionalForm({
              phone: p.phone || "",
              education: p.education || "",
              languages: (p.languages || []).join(", "),
              profession: p.profession || "",
              websiteUrl: p.websiteUrl || "",
              podcastUrl: p.podcastUrl || "",
              youtubeUrl: p.youtubeUrl || "",
            });
            setPurposeForm({
              nameAcronymHeader: p.nameAcronymHeader || "",
              nameAcronym: p.nameAcronym ? [...p.nameAcronym] : [],
              sphereOfInfluence: p.sphereOfInfluence
                ? (Array.isArray(p.sphereOfInfluence) ? p.sphereOfInfluence : [p.sphereOfInfluence])
                : [],
              missionStatement: p.missionStatement || "",
              summary: p.summary || "",
              motto: p.motto || "",
            });
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, myProfile?.id]);

  // ── Load timeline posts ──────────────────────────────────────────────────────
  const loadUserPosts = async () => {
    if (postsLoading || userPosts.length > 0) return;
    setPostsLoading(true);
    try {
      const [postsSnap, wallSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.POSTS), where("authorId", "==", userId), orderBy("createdAt", "desc"), limit(20))),
        getDocs(query(collection(db, COLLECTIONS.TESTIMONIES), where("authorId", "==", userId), orderBy("createdAt", "desc"), limit(20))),
      ]);
      const posts = postsSnap.docs.map(d => ({ id: d.id, collection: "posts", ...(d.data() as any) }));
      const testimonies = wallSnap.docs.map(d => ({ id: d.id, collection: "testimonies", ...(d.data() as any) }));
      const combined = [...posts, ...testimonies].sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      setUserPosts(combined);
    } catch (e) {
      console.error(e);
    } finally {
      setPostsLoading(false);
    }
  };

  // ── Load connections ────────────────────────────────────────────────────────
  const loadConnections = async () => {
    if (connectionsLoaded) return;
    try {
      const [followersSnap, followingSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.FOLLOWS), where("followeeId", "==", userId))),
        getDocs(query(collection(db, COLLECTIONS.FOLLOWS), where("followerId", "==", userId))),
      ]);
      setFollowers(followersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Follow)));
      setFollowing(followingSnap.docs.map(d => ({ id: d.id, ...d.data() } as Follow)));
      if (myProfile && myProfile.id !== userId) {
        const followDocRef = doc(db, COLLECTIONS.FOLLOWS, `${myProfile.id}_${userId}`);
        const followSnap = await getDoc(followDocRef);
        setIsFollowing(followSnap.exists());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConnectionsLoaded(true);
    }
  };

  const toggleFollow = async () => {
    if (!myProfile || myProfile.id === userId) return;
    const docId = `${myProfile.id}_${userId}`;
    const followRef = doc(db, COLLECTIONS.FOLLOWS, docId);
    try {
      if (isFollowing) {
        await deleteDoc(followRef);
        setIsFollowing(false);
        setFollowers(prev => prev.filter(f => f.followerId !== myProfile.id));
      } else {
        await setDoc(followRef, {
          followerId: myProfile.id, followeeId: userId,
          followerName: myProfile.displayName, followerPhoto: myProfile.photoURL || null,
          followeeName: profile!.displayName, followeePhoto: profile!.photoURL || null,
          createdAt: serverTimestamp(),
        });
        setIsFollowing(true);
        setFollowers(prev => [...prev, { id: docId, followerId: myProfile.id, followeeId: userId, followerName: myProfile.displayName, followerPhoto: myProfile.photoURL || null, followeeName: profile!.displayName, followeePhoto: profile!.photoURL || null, createdAt: null as any }]);
      }
    } catch (e: any) {
      console.error("toggleFollow error:", e?.code, e?.message, { myProfileId: myProfile?.id, userId, isFollowing });
      toast.error(e?.code === "permission-denied" ? "Permission denied — check Firestore rules." : "Action failed. Please try again.");
    }
  };

  // ── Load groups ──────────────────────────────────────────────────────────────
  const loadGroups = async () => {
    if (groupsLoaded) return;
    try {
      const membershipsSnap = await getDocs(
        query(collection(db, COLLECTIONS.GROUP_MEMBERS), where("userId", "==", userId), limit(20))
      );
      const groupIds = membershipsSnap.docs.map(d => d.data().groupId as string);
      const groupDocs = await Promise.all(groupIds.map(id => getDoc(doc(db, COLLECTIONS.GROUPS, id))));
      const groups = groupDocs
        .filter(d => d.exists())
        .map(d => ({ id: d.id, ...d.data() } as Group));
      setUserGroups(groups);
    } catch (e) {
      console.error(e);
    } finally {
      setGroupsLoaded(true);
    }
  };

  // ── Load photos ──────────────────────────────────────────────────────────────
  const loadPhotos = async () => {
    if (photosLoaded) return;
    try {
      const postsSnap = await getDocs(
        query(collection(db, COLLECTIONS.POSTS), where("authorId", "==", userId), limit(50))
      );
      const allPhotos = postsSnap.docs
        .map(d => d.data().mediaUrls as string[] | undefined)
        .filter((urls): urls is string[] => Array.isArray(urls) && urls.length > 0)
        .flat();
      setPhotos(allPhotos);
    } catch (e) {
      console.error(e);
    } finally {
      setPhotosLoaded(true);
    }
  };

  // ── Load courses ─────────────────────────────────────────────────────────────
  const loadCourses = async () => {
    if (coursesLoaded) return;
    try {
      const [coursesSnap, progressSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.VENTURE_COURSES), orderBy("order"))),
        getDocs(query(collection(db, COLLECTIONS.USER_PROGRESS), where("userId", "==", userId))),
      ]);
      const progressMap: Record<string, number> = {};
      progressSnap.docs.forEach(d => {
        const data = d.data() as UserProgress;
        if (data.completed) {
          progressMap[data.courseId] = (progressMap[data.courseId] || 0) + 1;
        }
      });
      const courses = coursesSnap.docs.map(d => {
        const course = { id: d.id, ...d.data() } as VentureCourse;
        const completedLessons = progressMap[course.id] || 0;
        const percentage = course.totalLessons > 0 ? Math.round((completedLessons / course.totalLessons) * 100) : 0;
        return { ...course, completedLessons, percentage };
      });
      setCourseProgress(courses);
    } catch (e) {
      console.error(e);
    } finally {
      setCoursesLoaded(true);
    }
  };

  // ── Load events ──────────────────────────────────────────────────────────────
  const loadEvents = async () => {
    if (eventsLoaded) return;
    try {
      const eventsSnap = await getDocs(
        query(collection(db, COLLECTIONS.EVENTS), where("organizerId", "==", userId), orderBy("startDate", "desc"), limit(20))
      );
      setUserEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Event)));
    } catch (e) {
      console.error(e);
    } finally {
      setEventsLoaded(true);
    }
  };

  // ── Save functions ───────────────────────────────────────────────────────────
  const savePersonal = async () => {
    if (!profile || !isMe) return;
    setSaving(true);
    try {
      const data = { ...personalForm, updatedAt: serverTimestamp() };
      await updateDoc(doc(db, COLLECTIONS.USERS, profile.id), data);
      setProfile(prev => prev ? { ...prev, ...personalForm } as UserProfile : prev);
      await refreshProfile();
      setEditPersonal(false);
      toast.success("Personal details saved.");
    } catch (e) {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const saveAdditional = async () => {
    if (!profile || !isMe) return;
    setSaving(true);
    try {
      const data = {
        phone: additionalForm.phone,
        education: additionalForm.education,
        profession: additionalForm.profession,
        languages: additionalForm.languages.split(",").map(l => l.trim()).filter(Boolean),
        websiteUrl: additionalForm.websiteUrl,
        podcastUrl: additionalForm.podcastUrl,
        youtubeUrl: additionalForm.youtubeUrl,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, COLLECTIONS.USERS, profile.id), data);
      setProfile(prev => prev ? { ...prev, ...data } as UserProfile : prev);
      await refreshProfile();
      setEditAdditional(false);
      toast.success("Additional details saved.");
    } catch (e) {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const savePurpose = async () => {
    if (!profile || !isMe) return;
    setSaving(true);
    try {
      const data = {
        nameAcronymHeader: purposeForm.nameAcronymHeader,
        nameAcronym: purposeForm.nameAcronym,
        sphereOfInfluence: purposeForm.sphereOfInfluence,
        missionStatement: purposeForm.missionStatement,
        summary: purposeForm.summary,
        motto: purposeForm.motto,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, COLLECTIONS.USERS, profile.id), data);
      setProfile(prev => prev ? { ...prev, ...data } as UserProfile : prev);
      await refreshProfile();
      setEditPurpose(false);
      toast.success("Purpose details saved.");
    } catch (e) {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // ── Guards ───────────────────────────────────────────────────────────────────
  if (loading) return <PageLoader />;
  if (!profile) return <div className="text-center py-16 text-slate-400 text-sm">User not found.</div>;

  const gradient = getCoverGradient(profile.displayName || "user");

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-0 animate-fade-in pb-10">
      {/* Back */}
      <div className="flex items-center gap-2 pb-3">
        <Link href="/community/directory" className="p-2 rounded-xl hover:bg-white text-slate-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-sm font-semibold text-slate-500">Profile</span>
      </div>

      {/* ── Hero card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        {/* Cover photo */}
        <div className="relative h-48 rounded-t-2xl overflow-hidden z-0">
          {profile.coverImage ? (
            <img src={profile.coverImage} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className={`h-full bg-gradient-to-br ${gradient} relative`}>
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
                  backgroundSize: "30px 30px",
                }}
              />
            </div>
          )}
          {/* Cover upload overlay — own profile only */}
          {isMe && (
            <div className="absolute inset-0">
              <ImageUpload
                currentUrl={profile.coverImage || null}
                storagePath={`covers/${userId}`}
                onUploadComplete={async (url) => {
                  await updateDoc(doc(db, COLLECTIONS.USERS, profile.id), { coverImage: url, updatedAt: serverTimestamp() });
                  setProfile(prev => prev ? { ...prev, coverImage: url } : prev);
                  toast.success("Cover photo updated.");
                }}
                shape="rect"
                size="lg"
                cropAspect={4}
                placeholder={
                  <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100">
                  </div>
                }
                className="absolute inset-0 w-full h-full opacity-0 hover:opacity-100 transition-opacity"
              />
            </div>
          )}
        </div>

        {/* Avatar + actions row */}
        <div className="px-5 pb-5 relative z-10">
          <div className="flex items-end justify-between -mt-12 mb-4">
            {/* Profile photo */}
            <div className="ring-4 ring-white rounded-full shadow-lg">
              {isMe ? (
                <ImageUpload
                  currentUrl={profile.photoURL || null}
                  storagePath={`avatars/${userId}`}
                  onUploadComplete={async (url) => {
                    await updateDoc(doc(db, COLLECTIONS.USERS, profile.id), { photoURL: url, updatedAt: serverTimestamp() });
                    setProfile(prev => prev ? { ...prev, photoURL: url } : prev);
                    await refreshProfile();
                    toast.success("Profile photo updated.");
                  }}
                  shape="circle"
                  size="md"
                  cropAspect={1}
                  placeholder={<Avatar name={profile.displayName ?? "?"} size="xl" />}
                  className="w-24 h-24"
                />
              ) : (
                <Avatar name={profile.displayName ?? "?"} photoURL={profile.photoURL} size="xl" />
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-4">
              {!isMe && myProfile && (
                <>
                  {isFollowing ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={toggleFollow}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Following
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={toggleFollow}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Follow
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const convId = [myProfile.id, userId].sort().join("_");
                      router.push(`/messages/${convId}`);
                    }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Message
                  </Button>
                </>
              )}
              {isMe && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditPersonal(true)}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>

          {/* Name + role + active badge */}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black text-slate-900">{profile.displayName}</h1>
            {profile.isActive && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Active
              </span>
            )}
          </div>
          {profile.nickname && (
            <p className="text-sm text-slate-400 font-medium">@{profile.nickname}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span className={`pill ${getRoleColor(profile.role)}`}>{ROLE_LABELS[profile.role]}</span>
            {profile.isVenture100 && <span className="pill bg-green-100 text-green-700">✓ Venture 100</span>}
            {profile.isLLGLI && <span className="pill bg-violet-100 text-violet-700">✓ LLGLI</span>}
          </div>

          {/* Follower / following counts */}
          <div className="flex items-center gap-4 mt-3">
            <button
              className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
              onClick={() => { setActiveTab("connections"); setConnectionsTab("followers"); if (!connectionsLoaded) loadConnections(); }}
            >
              <span className="text-sm font-bold text-slate-900">{profile.followerCount || 0}</span>
              <span className="text-xs text-slate-400">Followers</span>
            </button>
            <button
              className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
              onClick={() => { setActiveTab("connections"); setConnectionsTab("following"); if (!connectionsLoaded) loadConnections(); }}
            >
              <span className="text-sm font-bold text-slate-900">{profile.followingCount || 0}</span>
              <span className="text-xs text-slate-400">Following</span>
            </button>
          </div>

          {/* Location + email */}
          <div className="flex flex-col gap-1.5 mt-3">
            {(profile.nationName || profile.cityName) && (
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                {[profile.cityName, profile.nationName].filter(Boolean).join(", ")}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              {profile.email}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-slate-600 mt-3 leading-relaxed">{profile.bio}</p>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="mt-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === "timeline") loadUserPosts();
                if (tab.id === "connections" && !connectionsLoaded) loadConnections();
                if (tab.id === "groups" && !groupsLoaded) loadGroups();
                if (tab.id === "photos" && !photosLoaded) loadPhotos();
                if (tab.id === "courses" && !coursesLoaded) loadCourses();
                if (tab.id === "events" && !eventsLoaded) loadEvents();
              }}
              className={`flex-shrink-0 px-4 py-3 text-sm font-semibold capitalize transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="mt-3 space-y-3">

        {/* TIMELINE TAB */}
        {activeTab === "timeline" && (
          <>
            {postsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                    <div className="space-y-2">
                      <div className="h-3 bg-slate-100 rounded w-1/3" />
                      <div className="h-3 bg-slate-100 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : userPosts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <p className="text-sm font-semibold text-slate-400">No posts yet</p>
                {isMe && <p className="text-xs text-slate-400 mt-1">Share something with the community!</p>}
              </div>
            ) : (
              userPosts.map(post => {
                const isTestimony = post.collection === "testimonies";
                const typeLabel = isTestimony
                  ? (post.type === "prayer_request" ? "🙏 Prayer" : "✦ Testimony")
                  : (post.type === "update" ? "📢 Update" : post.type === "insight" ? "💡 Insight" : post.type === "testimony" ? "✦ Testimony" : "📢 Post");
                const typeColors = isTestimony
                  ? (post.type === "prayer_request" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700")
                  : (post.type === "insight" ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700");
                return (
                  <div key={`${post.collection}-${post.id}`} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeColors}`}>{typeLabel}</span>
                      <span className="text-xs text-slate-400">{timeAgo(post.createdAt)}</span>
                    </div>
                    {post.title && <p className="text-sm font-bold text-slate-900 mb-1">{post.title}</p>}
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{post.body}</p>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <>
            {/* Card 1 — Personal Details */}
            <SectionCard
              title="Personal Details"
              isMe={isMe}
              onEdit={() => setEditPersonal(true)}
            >
              <FieldRow
                label="First Name"
                value={profile.firstName || profile.displayName?.split(" ")[0]}
              />
              <FieldRow
                label="Last Name"
                value={profile.lastName || profile.displayName?.split(" ")[1] || "—"}
              />
              <FieldRow label="Handle / Username" value={profile.nickname ? `@${profile.nickname}` : undefined} />
              <FieldRow label="Gender" value={profile.gender} />
              <FieldRow label="Country of Origin" value={profile.countryOfOrigin} />
              <FieldRow
                label="Country of Residence"
                value={profile.countryOfResidence || profile.nationName}
              />
              <FieldRow label="City" value={profile.cityName} />
              <FieldRow label="Role" value={ROLE_LABELS[profile.role]} />
              <FieldRow label="Participated in Leading Lights Experience?" value={profile.participatingInTraining ? "Yes" : "No"} />
            </SectionCard>

            {/* Card 2 — Additional Details */}
            <SectionCard
              title="Additional Details"
              isMe={isMe}
              onEdit={() => setEditAdditional(true)}
            >
              <FieldRow label="Phone" value={profile.phone} />
              <FieldRow label="Education" value={profile.education} />
              <FieldRow
                label="Languages"
                value={
                  profile.languages && profile.languages.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {profile.languages.map(l => (
                        <span key={l} className="pill bg-slate-100 text-slate-700">{l}</span>
                      ))}
                    </div>
                  ) : null
                }
              />
              <FieldRow label="Profession" value={profile.profession} />
              {(profile.websiteUrl || profile.podcastUrl || profile.youtubeUrl) && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {profile.websiteUrl && <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full">🌐 Website</a>}
                  {profile.podcastUrl && <a href={profile.podcastUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 bg-violet-50 px-3 py-1.5 rounded-full">🎙️ Podcast</a>}
                  {profile.youtubeUrl && <a href={profile.youtubeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-full">▶ YouTube</a>}
                </div>
              )}
            </SectionCard>

            {/* Card 2b — Privacy (own profile only) */}
            {isMe && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-sm font-bold text-slate-900 mb-3">Privacy</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-700 font-medium">Show online status</p>
                    <p className="text-xs text-slate-400">Others can see when you&apos;re active in the community</p>
                  </div>
                  <button
                    onClick={async () => {
                      const next = !profile.hideOnlineStatus;
                      setProfile(prev => prev ? { ...prev, hideOnlineStatus: next } : prev);
                      try {
                        await updateDoc(doc(db, COLLECTIONS.USERS, profile.id), { hideOnlineStatus: next, updatedAt: serverTimestamp() });
                      } catch { toast.error("Failed to save preference"); }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${profile.hideOnlineStatus ? "bg-slate-200" : "bg-indigo-600"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${profile.hideOnlineStatus ? "translate-x-1" : "translate-x-6"}`} />
                  </button>
                </div>
                {/* Email notification preferences */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Email Notifications</p>
                  <div className="space-y-3">
                    {([
                      { key: "newFollower", label: "New follower" },
                      { key: "newComment", label: "Comments on my posts" },
                      { key: "newPrayer", label: "Prayer responses" },
                      { key: "weeklyDigest", label: "Weekly digest" },
                    ] as const).map(({ key, label }) => {
                      const enabled = profile.emailNotifications?.[key] !== false; // default on
                      return (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm text-slate-700">{label}</span>
                          <button
                            onClick={async () => {
                              const next = { ...(profile.emailNotifications ?? {}), [key]: !enabled };
                              setProfile(prev => prev ? { ...prev, emailNotifications: next } : prev);
                              try {
                                await updateDoc(doc(db, COLLECTIONS.USERS, profile.id), { emailNotifications: next, updatedAt: serverTimestamp() });
                              } catch { toast.error("Failed to save"); }
                            }}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? "bg-indigo-600" : "bg-slate-200"}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-400 mt-3">Email notifications require the Firebase Trigger Email extension to be installed by the admin.</p>
                </div>
              </div>
            )}

            {/* Leave Platform */}
            {isMe && (
              <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-4">
                <p className="text-sm font-bold text-red-600 mb-1">Leave Platform</p>
                <p className="text-xs text-slate-500 mb-3">Deactivate your account. Your profile will be hidden and you will be logged out. An admin can reactivate your account.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={async () => {
                    if (!confirm("Are you sure you want to leave the platform? Your account will be deactivated.")) return;
                    try {
                      await updateDoc(doc(db, COLLECTIONS.USERS, profile.id), { isActive: false, updatedAt: serverTimestamp() });
                      toast.success("Your account has been deactivated.");
                      setTimeout(() => { window.location.href = "/"; }, 1500);
                    } catch { toast.error("Failed to deactivate account."); }
                  }}
                >
                  Leave Platform
                </Button>
              </div>
            )}

            {/* Card 3 — Purpose-Identifying Details */}
            <SectionCard
              title="Purpose-Identifying Details"
              isMe={isMe}
              onEdit={() => setEditPurpose(true)}
            >
              {/* Name Acronym */}
              <div className="mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-2">Name Acronym (CLAN)</p>
                {profile.nameAcronymHeader && (
                  <p className="text-sm font-bold text-slate-800 mb-2">{profile.nameAcronymHeader}</p>
                )}
                {profile.nameAcronym && profile.nameAcronym.length > 0 ? (
                  <div className="space-y-1">
                    {profile.nameAcronym.map((row, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-xs font-black text-indigo-600 flex-shrink-0">
                          {row.letter}
                        </span>
                        <span className="text-sm text-slate-700 pt-1 leading-snug">{row.meaning || "—"}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Not set</p>
                )}
              </div>

              <div className="border-t border-slate-50 pt-3 space-y-0">
                <FieldRow
                  label="Sphere of Influence"
                  value={profile.sphereOfInfluence && (Array.isArray(profile.sphereOfInfluence) ? profile.sphereOfInfluence.length > 0 : true) ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(Array.isArray(profile.sphereOfInfluence) ? profile.sphereOfInfluence : [profile.sphereOfInfluence])
                        .map(s => <span key={s} className="text-xs bg-indigo-50 text-indigo-700 font-medium px-2.5 py-1 rounded-full">{s}</span>)
                      }
                    </div>
                  ) : undefined}
                />
                <FieldRow label="Mission Statement" value={profile.missionStatement} />
                <FieldRow label="Summary" value={profile.summary} />
                <FieldRow label="Motto" value={profile.motto} />
              </div>
            </SectionCard>
          </>
        )}

        {/* CONNECTIONS TAB */}
        {activeTab === "connections" && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-1 bg-white border border-slate-100 rounded-2xl p-1 shadow-sm">
              {(["followers", "following"] as const).map(t => (
                <button key={t} onClick={() => setConnectionsTab(t)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-xl capitalize transition-colors ${connectionsTab === t ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-700"}`}>
                  {t === "followers" ? `Followers (${followers.length})` : `Following (${following.length})`}
                </button>
              ))}
            </div>
            {/* List */}
            <div className="space-y-2">
              {(connectionsTab === "followers" ? followers : following).map(f => {
                const otherId = connectionsTab === "followers" ? f.followerId : f.followeeId;
                const otherName = connectionsTab === "followers" ? f.followerName : f.followeeName;
                const otherPhoto = connectionsTab === "followers" ? f.followerPhoto : f.followeePhoto;
                return (
                  <Link key={f.id} href={`/profile/${otherId}`}>
                    <div className="bg-white rounded-2xl border border-slate-100 p-3 flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
                      <Avatar name={otherName ?? "?"} photoURL={otherPhoto ?? undefined} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{otherName}</p>
                      </div>
                      <span className="text-xs text-slate-400">View →</span>
                    </div>
                  </Link>
                );
              })}
              {(connectionsTab === "followers" ? followers : following).length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                  <p className="text-sm text-slate-400">{connectionsTab === "followers" ? "No followers yet" : "Not following anyone yet"}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GROUPS TAB */}
        {activeTab === "groups" && (
          <div className="space-y-3">
            {userGroups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <Users2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No groups joined yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {userGroups.map(group => {
                  const groupGradient = getCoverGradient(group.name);
                  return (
                    <Link key={group.id} href={`/community/groups/${group.id}`}>
                      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
                        {group.coverImage ? (
                          <img src={group.coverImage} alt={group.name} className="w-full h-20 object-cover" />
                        ) : (
                          <div className={`w-full h-20 bg-gradient-to-br ${groupGradient}`} />
                        )}
                        <div className="p-3">
                          <p className="font-bold text-slate-900 text-sm truncate">{group.name}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{group.type.replace(/_/g, " ")}</span>
                            <span className="text-xs text-slate-400">{group.memberCount} members</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PHOTOS TAB */}
        {activeTab === "photos" && (
          <div>
            {photos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <Image className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No photos shared yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {photos.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="aspect-square object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(url, "_blank")}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* COURSES TAB */}
        {activeTab === "courses" && (
          <div className="space-y-3">
            {/* Progress banner */}
            {courseProgress.length > 0 && (
              <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-4 flex items-center gap-3">
                <GraduationCap className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                <p className="text-sm font-semibold text-indigo-700">
                  {courseProgress.filter(c => c.percentage === 100).length} of {courseProgress.length} courses completed
                </p>
              </div>
            )}
            {courseProgress.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <GraduationCap className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No course progress yet</p>
              </div>
            ) : (
              courseProgress.map(course => (
                <div key={course.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-bold text-slate-900 text-sm">{course.title}</p>
                    {course.percentage === 100 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">Completed</span>
                    ) : course.completedLessons > 0 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">In Progress</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">Not Started</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{course.completedLessons} / {course.totalLessons} lessons</p>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${course.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* EVENTS TAB */}
        {activeTab === "events" && (
          <div className="space-y-3">
            {userEvents.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <CalendarDays className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No events organised yet</p>
              </div>
            ) : (
              userEvents.map(event => {
                const startDate = event.startDate?.toDate?.();
                const dateStr = startDate ? startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
                return (
                  <div key={event.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-bold text-slate-900 text-sm">{event.title}</p>
                      {event.isOnline ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 flex-shrink-0">Online</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 flex-shrink-0">In Person</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {dateStr}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users2 className="w-3 h-3" />
                        {event.rsvpCount} RSVPs
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════
          EDIT MODALS (isMe only)
      ════════════════════════════════════════════════ */}

      {/* ── Modal 1: Personal Details ── */}
      {isMe && (
        <Modal open={editPersonal} onClose={() => setEditPersonal(false)} title="Edit Personal Details" size="lg">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name"
                value={personalForm.firstName}
                onChange={e => setPersonalForm(p => ({ ...p, firstName: e.target.value }))}
              />
              <Input
                label="Last Name"
                value={personalForm.lastName}
                onChange={e => setPersonalForm(p => ({ ...p, lastName: e.target.value }))}
              />
            </div>
            <Input
              label="Handle / Username"
              value={personalForm.nickname}
              onChange={e => setPersonalForm(p => ({ ...p, nickname: e.target.value }))}
              placeholder="e.g. danny, liz"
            />
            <p className="text-xs text-slate-400 -mt-1">This is how others will tag you e.g. @{personalForm.nickname || "yourhandle"}</p>
            <Select
              label="Gender"
              value={personalForm.gender}
              onChange={e => setPersonalForm(p => ({ ...p, gender: e.target.value }))}
            >
              <option value="">Select…</option>
              <option>Male</option>
              <option>Female</option>
              <option>Prefer not to say</option>
            </Select>
            <Select
              label="Country of Origin"
              value={personalForm.countryOfOrigin}
              onChange={e => setPersonalForm(p => ({ ...p, countryOfOrigin: e.target.value }))}
            >
              <option value="">Select country…</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select
              label="Country of Residence"
              value={personalForm.countryOfResidence}
              onChange={e => setPersonalForm(p => ({ ...p, countryOfResidence: e.target.value }))}
            >
              <option value="">Select country…</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input
              label="City"
              value={personalForm.cityName}
              onChange={e => setPersonalForm(p => ({ ...p, cityName: e.target.value }))}
              placeholder="Your city"
            />
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1.5">Participated in Leading Lights Experience??</p>
              <div className="flex gap-3">
                {[{ label: "Yes", value: true }, { label: "No", value: false }].map(opt => (
                  <label key={opt.label} className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer text-sm font-semibold transition-colors ${personalForm.participatingInTraining === opt.value ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <input type="radio" name="participating" checked={personalForm.participatingInTraining === opt.value} onChange={() => setPersonalForm(p => ({ ...p, participatingInTraining: opt.value }))} className="hidden" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditPersonal(false)}>Cancel</Button>
              <Button className="flex-1" onClick={savePersonal} loading={saving}>Save</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal 2: Additional Details ── */}
      {isMe && (
        <Modal open={editAdditional} onClose={() => setEditAdditional(false)} title="Edit Additional Details" size="lg">
          <div className="space-y-3">
            <Input
              label="Phone"
              type="tel"
              value={additionalForm.phone}
              onChange={e => setAdditionalForm(p => ({ ...p, phone: e.target.value }))}
            />
            <Select
              label="Highest Level of Education"
              value={additionalForm.education}
              onChange={e => setAdditionalForm(p => ({ ...p, education: e.target.value }))}
            >
              <option value="">Select…</option>
              <option>Secondary</option>
              <option>Diploma</option>
              <option>Bachelor&apos;s</option>
              <option>Master&apos;s</option>
              <option>Post Graduate</option>
              <option>Doctorate</option>
              <option>Other</option>
            </Select>
            <Input
              label="Languages (comma-separated)"
              value={additionalForm.languages}
              onChange={e => setAdditionalForm(p => ({ ...p, languages: e.target.value }))}
              placeholder="English, French, Swahili"
            />
            <Input
              label="Profession"
              value={additionalForm.profession}
              onChange={e => setAdditionalForm(p => ({ ...p, profession: e.target.value }))}
              placeholder="e.g. Teacher, Engineer, Pastor"
            />
            <Input label="Website" type="url" placeholder="https://yoursite.com" value={additionalForm.websiteUrl} onChange={e => setAdditionalForm(f => ({...f, websiteUrl: e.target.value}))} />
            <Input label="Podcast URL" type="url" placeholder="https://podcast.com/..." value={additionalForm.podcastUrl} onChange={e => setAdditionalForm(f => ({...f, podcastUrl: e.target.value}))} />
            <Input label="YouTube Channel" type="url" placeholder="https://youtube.com/@..." value={additionalForm.youtubeUrl} onChange={e => setAdditionalForm(f => ({...f, youtubeUrl: e.target.value}))} />
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditAdditional(false)}>Cancel</Button>
              <Button className="flex-1" onClick={saveAdditional} loading={saving}>Save</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal 3: Purpose-Identifying Details ── */}
      {isMe && (
        <Modal open={editPurpose} onClose={() => setEditPurpose(false)} title="Edit Purpose Details" size="lg">
          <div className="space-y-4">
            {/* Name Acronym editor */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Name Acronym (CLAN)</p>
              <input
                type="text"
                value={purposeForm.nameAcronymHeader}
                onChange={e => setPurposeForm(p => ({ ...p, nameAcronymHeader: e.target.value }))}
                placeholder="e.g. Gregory Lan Ijiwola — My Name Amplified"
                className="w-full px-3 py-2 mb-3 text-sm font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:font-normal"
              />
              <div className="space-y-2">
                {purposeForm.nameAcronym.map((row, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <input
                      type="text"
                      maxLength={1}
                      value={row.letter}
                      onChange={e => {
                        const val = e.target.value.toUpperCase();
                        setPurposeForm(p => {
                          const updated = [...p.nameAcronym];
                          updated[i] = { ...updated[i], letter: val };
                          return { ...p, nameAcronym: updated };
                        });
                      }}
                      placeholder="A"
                      className="w-10 h-9 text-center text-sm font-black border border-slate-200 rounded-lg bg-indigo-50 text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 uppercase"
                    />
                    <input
                      type="text"
                      value={row.meaning}
                      onChange={e => {
                        const val = e.target.value;
                        setPurposeForm(p => {
                          const updated = [...p.nameAcronym];
                          updated[i] = { ...updated[i], meaning: val };
                          return { ...p, nameAcronym: updated };
                        });
                      }}
                      placeholder="Meaning or quality for this letter…"
                      className="flex-1 h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <button
                      onClick={() =>
                        setPurposeForm(p => ({
                          ...p,
                          nameAcronym: p.nameAcronym.filter((_, idx) => idx !== i),
                        }))
                      }
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  setPurposeForm(p => ({
                    ...p,
                    nameAcronym: [...p.nameAcronym, { letter: "", meaning: "" }],
                  }))
                }
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add letter
              </button>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 mb-2">Spheres of Influence</p>
              <div className="grid grid-cols-2 gap-2">
                {SPHERES.map(s => {
                  const selected = Array.isArray(purposeForm.sphereOfInfluence)
                    ? purposeForm.sphereOfInfluence.includes(s)
                    : purposeForm.sphereOfInfluence === s;
                  return (
                    <label key={s} className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer text-sm transition-colors ${selected ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={e => {
                          const current = Array.isArray(purposeForm.sphereOfInfluence) ? purposeForm.sphereOfInfluence : (purposeForm.sphereOfInfluence ? [purposeForm.sphereOfInfluence] : []);
                          const next = e.target.checked ? [...current, s] : current.filter(x => x !== s);
                          setPurposeForm(p => ({ ...p, sphereOfInfluence: next }));
                        }}
                        className="w-3.5 h-3.5 accent-indigo-600"
                      />
                      {s}
                    </label>
                  );
                })}
              </div>
            </div>

            <Textarea
              label="Mission Statement"
              value={purposeForm.missionStatement}
              onChange={e => setPurposeForm(p => ({ ...p, missionStatement: e.target.value }))}
              rows={3}
              placeholder="What is your mission?"
            />
            <Textarea
              label="Summary"
              value={purposeForm.summary}
              onChange={e => setPurposeForm(p => ({ ...p, summary: e.target.value }))}
              rows={3}
              placeholder="A brief summary of who you are…"
            />
            <Input
              label="Motto"
              value={purposeForm.motto}
              onChange={e => setPurposeForm(p => ({ ...p, motto: e.target.value }))}
              placeholder="e.g. Impact over impressions"
            />
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditPurpose(false)}>Cancel</Button>
              <Button className="flex-1" onClick={savePurpose} loading={saving}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
