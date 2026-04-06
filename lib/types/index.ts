// ============================================================
// LEADING LIGHTS GLOBAL PLATFORM — TYPE DEFINITIONS
// ============================================================

import { Timestamp } from "firebase/firestore";

// ----------------------------------------------------------
// ROLES & PERMISSIONS
// ----------------------------------------------------------

export type UserRole =
  | "global_admin"
  | "national_leader"
  | "city_leader"
  | "hub_leader"
  | "participant";

export const ROLE_LABELS: Record<UserRole, string> = {
  global_admin: "Global Admin",
  national_leader: "National Leader",
  city_leader: "City Leader",
  hub_leader: "Hub Leader",
  participant: "Participant",
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  global_admin: 5,
  national_leader: 4,
  city_leader: 3,
  hub_leader: 2,
  participant: 1,
};

// ----------------------------------------------------------
// GEO STRUCTURE
// ----------------------------------------------------------

export interface Nation {
  id: string;
  name: string;
  code: string; // ISO 2-letter
  region: string;
  leaderId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface City {
  id: string;
  name: string;
  nationId: string;
  nationName: string;
  leaderId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Hub {
  id: string;
  name: string;
  nationId: string;
  nationName: string;
  cityId: string;
  cityName: string;
  leaderId: string;
  leaderName: string;
  memberCount: number;
  venture100Count: number;
  leadersInTraining: number;
  smallGroups: number;
  status: "active" | "inactive" | "forming";
  description?: string;
  meetingDay?: string;
  meetingTime?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------
// USERS & PROFILES
// ----------------------------------------------------------

export interface UserProfile {
  id: string; // same as Firebase Auth UID
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  nationId?: string;
  nationName?: string;
  cityId?: string;
  cityName?: string;
  hubId?: string;
  hubName?: string;

  // Basic extended fields
  bio?: string;
  phone?: string;
  profession?: string;
  sphereOfInfluence?: string | string[];
  passions?: string;
  languages?: string[];

  // Personal details
  firstName?: string;
  lastName?: string;
  nickname?: string;
  gender?: string;
  countryOfOrigin?: string;
  countryOfResidence?: string;
  education?: string;

  // Cover photo
  coverImage?: string;

  // Purpose-identifying details
  nameAcronymHeader?: string;
  missionStatement?: string;
  summary?: string;
  motto?: string;
  nameAcronym?: { letter: string; meaning: string }[];
  participatingInTraining?: boolean;

  // Social
  followerCount?: number;
  followingCount?: number;

  // Social links
  websiteUrl?: string;
  podcastUrl?: string;
  youtubeUrl?: string;

  isVenture100?: boolean;
  isLLGLI?: boolean;
  llgliCohort?: string;

  // Privacy
  hideOnlineStatus?: boolean;

  // Notification preferences
  emailNotifications?: {
    newFollower?: boolean;
    newComment?: boolean;
    newPrayer?: boolean;
    weeklyDigest?: boolean;
  };

  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------
// VENTURE 100 TRAINING
// ----------------------------------------------------------

export interface VentureCourse {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  totalLessons: number;
  order: number;
  isPublished: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface VentureLesson {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  videoUrl?: string;
  content?: string;
  duration?: number; // minutes
  order: number;
  isPublished: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserProgress {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  completed: boolean;
  completedAt?: Timestamp;
  createdAt: Timestamp;
}

export interface CourseProgress {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percentage: number;
  lastAccessedAt?: Timestamp;
}

// ----------------------------------------------------------
// LLGLI – LEADERSHIP INCUBATOR
// ----------------------------------------------------------

export interface LLGLIModule {
  id: string;
  weekNumber: number; // 1-6
  title: string;
  description: string;
  videoUrl?: string;
  content?: string;
  assignmentPrompt: string;
  isPublished: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LLGLISubmission {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  moduleId: string;
  weekNumber: number;
  content: string;
  status: "draft" | "submitted" | "reviewed";
  reviewNote?: string;
  submittedAt?: Timestamp;
  reviewedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------
// MONTHLY REPORTS
// ----------------------------------------------------------

export interface MonthlyReport {
  id: string;
  submittedBy: string;
  submitterName: string;
  submitterRole: UserRole;
  nationId: string;
  nationName: string;
  cityId?: string;
  cityName?: string;
  hubId?: string;
  hubName?: string;

  month: number; // 1-12
  year: number;

  memberCount: number;
  venture100Count: number;
  leadersInTraining: number;
  smallGroups: number;
  outreachActivities: number;
  newHubs: number;

  testimonies?: string;
  challenges?: string;
  prayerRequests?: string;
  goals?: string;

  status: "draft" | "submitted";
  submittedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------
// RESOURCES
// ----------------------------------------------------------

export interface Resource {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileType: string; // pdf, docx, mp4, etc.
  fileSize?: number;
  category: string;
  tags?: string[];
  uploadedBy: string;
  uploaderName: string;
  isPublic: boolean;
  downloadCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------
// COMMUNITY
// ----------------------------------------------------------

export interface Announcement {
  id: string;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  scope: "global" | "national" | "city";
  nationId?: string;
  nationName?: string;
  cityId?: string;
  cityName?: string;
  isPinned: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Testimony {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  nationName?: string;
  title: string;
  body: string;
  type: "testimony" | "prayer_request";
  commentCount: number;
  encouragementCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Comment {
  id: string;
  parentId: string; // testimony, group post, or post ID
  parentType: "testimony" | "group_post" | "post";
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  body: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  type: "nation" | "city" | "hub" | "llgli_cohort" | "venture100";
  coverImage?: string;
  leaderId: string;
  leaderName: string;
  nationId?: string;
  nationName?: string;
  cityId?: string;
  cityName?: string;
  hubId?: string;
  memberCount: number;
  isPrivate: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  role: "leader" | "member";
  joinedAt: Timestamp;
}

export interface GroupPost {
  id: string;
  groupId: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  body: string;
  commentCount: number;
  reactionCounts?: { like: number; heart: number; pray: number };
  isPinned?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------
// SOCIAL (Phase 2 — schema only)
// ----------------------------------------------------------

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  nationName?: string;
  cityName?: string;
  body: string;
  type: "testimony" | "update" | "prayer_request" | "event" | "insight" | "poll" | "share";
  scope: "global" | "national" | "city";
  nationId?: string;
  cityId?: string;
  mediaUrls?: string[];
  videoUrl?: string;
  hashtags?: string[];
  commentCount: number;
  reactionCounts: { like: number; heart: number; pray: number };
  authorRole?: string;
  shareCount?: number;
  sharedFromId?: string;
  sharedFromAuthorName?: string;
  sharedFromBody?: string;
  pollId?: string;
  isPinned?: boolean;
  linkPreview?: { url: string; title: string | null; description: string | null; image: string | null } | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  startDate: Timestamp;
  endDate?: Timestamp;
  location?: string;
  isOnline: boolean;
  meetingLink?: string;
  organizerId: string;
  organizerName: string;
  nationId?: string;
  cityId?: string;
  rsvpCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Conversation {
  id: string;
  type: "dm" | "group";
  participants: string[]; // UIDs
  participantNames: Record<string, string>; // uid → displayName
  participantPhotos: Record<string, string>; // uid → photoURL
  unreadCounts: Record<string, number>; // uid → unread count
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  readBy: string[];
  createdAt: Timestamp;
}

// ----------------------------------------------------------
// NOTIFICATIONS (Phase 2)
// ----------------------------------------------------------

export interface Notification {
  id: string;
  userId: string; // recipient UID
  type: "message" | "comment" | "reaction" | "group_activity" | "announcement";
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  fromId?: string;
  fromName?: string;
  fromPhoto?: string;
  createdAt: Timestamp;
}

// ----------------------------------------------------------
// REACTIONS & REPORTS
// ----------------------------------------------------------

export interface UserReaction {
  id: string; // "${postId}_${userId}"
  postId: string;
  postType: "post" | "group_post" | "testimony";
  userId: string;
  type: "like" | "heart" | "pray";
  createdAt: Timestamp;
}

export interface Report {
  id: string;
  postId: string;
  postType: "post" | "group_post" | "testimony";
  reporterId: string;
  reporterName: string;
  reason: string;
  createdAt: Timestamp;
}

// ----------------------------------------------------------
// STORIES (24h photo/text updates)
// ----------------------------------------------------------

export interface Story {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string | null;
  imageUrl?: string;
  caption?: string;
  expiresAt: Timestamp; // createdAt + 24h
  viewerIds?: string[];
  createdAt: Timestamp;
}

// ----------------------------------------------------------
// POLLS
// ----------------------------------------------------------

export interface PollOption {
  text: string;
  votes: number;
  voterIds: string[];
}

export interface Poll {
  id: string;
  postId: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  endsAt?: Timestamp;
  createdAt: Timestamp;
}

// ----------------------------------------------------------
// FOLLOWS / CONNECTIONS
// ----------------------------------------------------------

export interface Follow {
  id: string; // "${followerId}_${followeeId}"
  followerId: string;
  followeeId: string;
  followerName: string;
  followerPhoto?: string | null;
  followeeName: string;
  followeePhoto?: string | null;
  createdAt: Timestamp;
}

// ----------------------------------------------------------
// LIVE EVENTS
// ----------------------------------------------------------

export interface LiveEvent {
  id: string;
  title: string;
  description?: string;
  type: "youtube" | "jitsi" | "other";
  streamUrl?: string;    // YouTube URL
  roomName?: string;     // Jitsi room name (auto-generated)
  externalUrl?: string;  // Zoom / other external link
  hostedBy: string;
  hostName: string;
  hostPhoto?: string | null;
  isLive: boolean;
  isScheduled: boolean;
  scheduledAt?: any;
  startedAt?: any;
  endedAt?: any;
  viewerCount?: number;
  scope: "global" | "national" | "city";
  nationId?: string | null;
  nationName?: string | null;
  cityId?: string | null;
  cityName?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------
// SPOTLIGHTS (initiatives, podcasts, videos)
// ----------------------------------------------------------

export interface Spotlight {
  id: string;
  title: string;
  description?: string;
  url: string;
  thumbnailUrl?: string;
  type: "podcast" | "video" | "initiative" | "article" | "website";
  personName: string;
  personPhoto?: string | null;
  personId?: string;
  nationName?: string | null;
  isPinned?: boolean;
  isApproved: boolean;
  submittedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------
// COMMUNITY COURSES (Leading Lights University)
// ----------------------------------------------------------

export interface CommunityCourse {
  id: string;
  title: string;
  description: string;
  instructorId: string;
  instructorName: string;
  instructorPhoto?: string | null;
  category: string;
  thumbnailUrl?: string;
  externalUrl?: string;
  status: "pending" | "approved" | "published" | "rejected";
  enrollmentCount: number;
  lessonCount: number;
  nationId?: string | null;
  nationName?: string | null;
  tags?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------
// UI HELPERS
// ----------------------------------------------------------

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: UserRole[];
  children?: NavItem[];
}

export interface StatCard {
  label: string;
  value: string | number;
  change?: number;
  icon: string;
  color: string;
}
