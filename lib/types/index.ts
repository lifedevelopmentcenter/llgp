// ============================================================
// LEADING LIGHTS GLOBAL PLATFORM — TYPE DEFINITIONS
// ============================================================

import { Timestamp } from "firebase/firestore";

// ----------------------------------------------------------
// ROLES & PERMISSIONS
// ----------------------------------------------------------

export type UserRole =
  | "global_admin"
  | "global_team_lead"
  | "global_operations_member"
  | "finance_coordinator"
  | "travel_coordinator"
  | "missions_coordinator"
  | "national_leader"
  | "city_leader"
  | "hub_leader"
  | "participant";

export const ROLE_LABELS: Record<UserRole, string> = {
  global_admin: "Global Admin",
  global_team_lead: "Global Team Lead",
  global_operations_member: "Global Operations Member",
  finance_coordinator: "Finance Coordinator",
  travel_coordinator: "Travel Coordinator",
  missions_coordinator: "Missions Coordinator",
  national_leader: "National Leader",
  city_leader: "City Leader",
  hub_leader: "Hub Leader",
  participant: "Participant",
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  global_admin: 10,
  global_team_lead: 9,
  global_operations_member: 8,
  national_leader: 7,
  missions_coordinator: 6,
  finance_coordinator: 6,
  travel_coordinator: 6,
  city_leader: 5,
  hub_leader: 4,
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

  // LinkedIn-feel fields
  headline?: string;
  openTo?: string[]; // "mentorship" | "collaboration" | "speaking" | "partnership"
  creatorMode?: boolean;

  // Privacy
  hideOnlineStatus?: boolean;

  // Notification preferences
  emailNotifications?: {
    newFollower?: boolean;
    newComment?: boolean;
    newPrayer?: boolean;
    weeklyDigest?: boolean;
  };

  // Global operations assignment
  globalResponsibilities?: string[];
  globalOpsNotes?: string;

  isActive: boolean;
  hasOnboarded?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------
// GLOBAL OPERATIONS
// ----------------------------------------------------------

export type GlobalOperationCategory =
  | "team"
  | "meeting"
  | "mission_event"
  | "funding"
  | "travel"
  | "procedure";

export type GlobalOperationStatus =
  | "planned"
  | "in_progress"
  | "waiting"
  | "completed"
  | "blocked";

export interface GlobalOperationRecord {
  id: string;
  category: GlobalOperationCategory;
  title: string;
  summary: string;
  status: GlobalOperationStatus;
  priority: "low" | "medium" | "high" | "urgent";
  nationId?: string;
  nationName?: string;
  ownerId?: string;
  ownerName?: string;
  dueDate?: Timestamp | null;
  budgetAmount?: number | null;
  fundsSent?: number | null;
  currency?: string;
  travelRoute?: string;
  meetingLink?: string;
  documentUrl?: string;
  nextAction?: string;
  archivedAt?: Timestamp | null;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GlobalOperationTask {
  id: string;
  title: string;
  assignedToId?: string | null;
  assignedToName?: string | null;
  dueDate?: Timestamp | null;
  isComplete: boolean;
  completedAt?: Timestamp | null;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GlobalOperationNote {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
}

export type GlobalOperationFinanceType =
  | "budget"
  | "disbursement"
  | "expense";

export type GlobalOperationFinanceStatus =
  | "planned"
  | "requested"
  | "approved"
  | "sent"
  | "spent"
  | "reconciled";

export interface GlobalOperationFinanceItem {
  id: string;
  type: GlobalOperationFinanceType;
  status: GlobalOperationFinanceStatus;
  description: string;
  amount: number;
  currency: string;
  recipient?: string | null;
  receiptUrl?: string | null;
  transactionDate?: Timestamp | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  approvedAt?: Timestamp | null;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type GlobalOperationTravelStatus =
  | "planning"
  | "booked"
  | "arrived"
  | "completed"
  | "issue";

export interface GlobalOperationTravelItem {
  id: string;
  travelerName: string;
  travelerUserId?: string | null;
  status: GlobalOperationTravelStatus;
  origin?: string | null;
  destination?: string | null;
  arrivalDate?: Timestamp | null;
  departureDate?: Timestamp | null;
  flightInfo?: string | null;
  accommodation?: string | null;
  roomAssignment?: string | null;
  localTransport?: string | null;
  pickupPlan?: string | null;
  passportStatus?: string | null;
  visaStatus?: string | null;
  emergencyContact?: string | null;
  notes?: string | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  approvedAt?: Timestamp | null;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type GlobalOperationMeetingStatus =
  | "scheduled"
  | "held"
  | "cancelled";

export interface GlobalOperationMeetingItem {
  id: string;
  title: string;
  status: GlobalOperationMeetingStatus;
  meetingDate?: Timestamp | null;
  meetingLink?: string | null;
  attendees?: string | null;
  agenda?: string | null;
  minutes?: string | null;
  decisions?: string | null;
  followUpActions?: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type GlobalOperationProcedureType =
  | "playbook"
  | "form"
  | "checklist"
  | "policy"
  | "risk";

export type GlobalOperationProcedureStatus =
  | "not_started"
  | "in_review"
  | "complete"
  | "blocked";

export interface GlobalOperationProcedureItem {
  id: string;
  title: string;
  type: GlobalOperationProcedureType;
  status: GlobalOperationProcedureStatus;
  requiredBeforeMission: boolean;
  ownerId?: string | null;
  ownerName?: string | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  approvedAt?: Timestamp | null;
  documentUrl?: string | null;
  dueDate?: Timestamp | null;
  notes?: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type GlobalOperationDocumentType =
  | "playbook"
  | "form"
  | "template"
  | "procedure"
  | "policy"
  | "meeting_notes"
  | "budget"
  | "travel";

export interface GlobalOperationDocument {
  id: string;
  title: string;
  type: GlobalOperationDocumentType;
  summary?: string | null;
  documentUrl: string;
  nationId?: string | null;
  nationName?: string | null;
  category?: GlobalOperationCategory | null;
  tags?: string[];
  isRequiredTemplate?: boolean;
  createdBy: string;
  createdByName: string;
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
  type: "nation" | "city" | "hub" | "llgli_cohort" | "venture100" | "general" | string;
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
  type: "message" | "comment" | "reaction" | "group_activity" | "announcement" | "operation";
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
// INVITATIONS
// ----------------------------------------------------------

export interface Invitation {
  id: string; // = token (UUID)
  email: string;
  invitedById: string;
  invitedByName: string;
  adminInvite: boolean;
  preAssignedRole?: string;
  preAssignedNationId?: string;
  preAssignedNationName?: string;
  preAssignedCityId?: string;
  preAssignedCityName?: string;
  status: "pending" | "used" | "expired";
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

// ----------------------------------------------------------
// LESSON COMMENTS & NOTES
// ----------------------------------------------------------

export interface LessonComment {
  id: string;
  lessonId: string;
  courseId: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string | null;
  body: string;
  createdAt: Timestamp;
}

export interface LessonNote {
  id: string;
  userId: string;
  lessonId: string;
  courseId: string;
  notes: string;
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

// ----------------------------------------------------------
// LINKEDIN-FEEL FEATURES
// ----------------------------------------------------------

export interface Recommendation {
  id: string;
  toUserId: string;
  toUserName: string;
  fromUserId: string;
  fromUserName: string;
  fromUserPhoto?: string | null;
  fromUserHeadline?: string;
  body: string; // max 500 chars
  createdAt: Timestamp;
}

export interface Article {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string | null;
  authorHeadline?: string;
  title: string;
  subtitle?: string;
  coverImage?: string;
  body: string; // rich text stored as HTML
  tags?: string[];
  readTime?: number; // minutes, computed on save
  viewCount: number;
  commentCount: number;
  reactionCounts: { like: number; heart: number; pray: number };
  isPublished: boolean;
  publishedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProfileView {
  id: string; // `${profileId}_${viewerId}`
  profileId: string;
  viewerId: string;
  viewerName: string;
  viewerPhoto?: string | null;
  viewerHeadline?: string;
  createdAt: Timestamp;
}
