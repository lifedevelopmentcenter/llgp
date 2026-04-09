// ============================================================
// FIRESTORE COLLECTION NAMES & HELPERS
// ============================================================

export const COLLECTIONS = {
  USERS: "users",
  NATIONS: "nations",
  CITIES: "cities",
  HUBS: "hubs",
  VENTURE_COURSES: "ventureCourses",
  VENTURE_LESSONS: "ventureLessons",
  USER_PROGRESS: "userProgress",
  LLGLI_MODULES: "llgliModules",
  LLGLI_SUBMISSIONS: "llgliSubmissions",
  MONTHLY_REPORTS: "monthlyReports",
  RESOURCES: "resources",
  ANNOUNCEMENTS: "announcements",
  TESTIMONIES: "testimonies",
  COMMENTS: "comments",
  GROUPS: "groups",
  GROUP_MEMBERS: "groupMembers",
  GROUP_POSTS: "groupPosts",
  // Phase 2
  POSTS: "posts",
  REACTIONS: "reactions",
  EVENTS: "events",
  CONVERSATIONS: "conversations",
  MESSAGES: "messages",
  NOTIFICATIONS: "notifications",
  REPORTS: "reports",
  // Phase 3 — Live, Spotlights, LLU
  LIVE_EVENTS: "liveEvents",
  SPOTLIGHTS: "spotlights",
  COMMUNITY_COURSES: "communityCourses",
  FOLLOWS: "follows",
  STORIES: "stories",
  POLLS: "polls",
  SHARES: "shares",
  LESSON_COMMENTS: "lessonComments",
  LESSON_NOTES: "lessonNotes",
  COURSE_ENROLLMENTS: "courseEnrollments",
  INVITATIONS: "invitations",
} as const;
