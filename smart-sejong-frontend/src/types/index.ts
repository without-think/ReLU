// Auth Types
export interface AuthResponse {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  user: AuthUserInfo
}

export interface AuthUserInfo {
  id: number
  studentId: string
  fullName?: string
  major?: string
}

export interface UserInfo {
  nickname: string
  student_id?: string
  is_verified: boolean
  profile_image?: string
}

export interface LoginRequest {
  studentId: string
  password: string
}

// Learning Types (legacy, prefer CompletedCourse)
export interface Course {
  id: number
  course_name: string
  grade: string
  credits: number
}

export interface LearningSummary {
  total: number
  major: number
  ge: number
}

export interface UploadResponse {
  added_count: number
  total_credits: number
}

// Completed Course (기이수 과목) Types
export interface CompletedCourseItem {
  id?: number
  courseCode: string
  courseName: string
  category: string
  credits: number
  grade: string
  gradePoint: number
  year?: string
  semester?: string
}

export interface CategorySummary {
  totalCredits: number
  earnedCredits: number
  totalGradePoints: number
  gradePointCredits: number
  averageGradePoint: number
}

export interface CompletedCourseSummary {
  major: CategorySummary
  liberal: CategorySummary
  other: CategorySummary
  total: CategorySummary
}

export interface CompletedCourseUploadResult {
  totalRows: number
  successCount: number
  failCount: number
  skipCount: number
}

// Course Types
export interface CourseMaster {
  id: number
  code: string
  name: string
  credits?: number
}

export interface Section {
  section_id: number
  professor: string
  day: string
  time: string
}

// Timetable Types
export interface Timetable {
  id: number
  name: string
  created_at: string
  items?: TimetableItem[]
}

export interface TimetableItem {
  item_id: number
  section_id?: number
  name: string
  day: string
  start: string
  end: string
  is_pinned: boolean
  type: 'section' | 'custom'
}

export interface CreateTimetableRequest {
  name: string
}

export interface CreateTimetableResponse {
  timetable_id: number
}

// Group / Team Project Types
export type MemberRole = 'UNASSIGNED' | 'LEADER' | 'RESEARCHER' | 'PRESENTER' | 'BACKEND' | 'FRONTEND' | 'AI'
export type TaskStatus = 'PENDING' | 'SUBMITTED' | 'LATE' | 'APPROVED' | 'REJECTED'

export interface GroupSummary {
  id: number
  name: string
  description: string | null
  inviteCode: string
  githubRepoUrl: string | null
  projectDeadline: string | null
  memberCount: number
}

export interface GroupDetail {
  id: number
  name: string
  description: string | null
  inviteCode: string
  githubRepoUrl: string | null
  projectDeadline: string | null
  members: TeamMember[]
}

export interface TeamMember {
  memberId: number
  userId: number
  name: string
  studentId: string
  major: string
  role: MemberRole
  temperature: number
}

export interface CreateGroupRequest {
  name: string
  description?: string
  githubRepoUrl?: string
  projectDeadline?: string
}

export interface CreateGroupResponse {
  groupId: number
  inviteCode: string
}

export interface JoinGroupRequest {
  inviteCode: string
}

export interface UpdateGroupRequest {
  name?: string
  description?: string
  githubRepoUrl?: string | null
  projectDeadline?: string | null
}

export interface AvailabilitySlot {
  dayOfWeek: string
  slot: number
}

export interface AvailabilityResponse {
  memberSlots: Record<number, AvailabilitySlot[]>
  heatmap: Record<string, number>
}

export interface ProjectTask {
  id: number
  title: string
  description: string | null
  assigneeId: number | null
  assigneeName: string | null
  createdById: number
  createdByName: string
  startDate: string | null
  deadline: string | null
  progress: number
  submittedAt: string | null
  fileName: string | null
  fileUrl: string | null
  status: TaskStatus
  createdAt: string
}

export interface CreateTaskRequest {
  title: string
  description?: string
  assigneeId?: number
  startDate?: string
  deadline?: string
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  assigneeId?: number
  startDate?: string
  deadline?: string
  progress?: number
}

export interface GanttTask {
  id: string
  name: string
  start: string
  end: string
  progress: number
  dependencies?: string
  custom_class?: string
}

export interface PeerReviewRequest {
  revieweeId: number
  contributionScore: number
  contributing: number
  interacting: number
  keepingOnTrack: number
  expectingQuality: number
  knowledgeSkills: number
  comment?: string
}

export interface MemberScore {
  userId: number
  name: string
  avgContributionScore: number
  avgContributing: number
  avgInteracting: number
  avgKeepingOnTrack: number
  avgExpectingQuality: number
  avgKnowledgeSkills: number
  overallTemperatureDelta: number
  suspectedFreeRider: boolean
  reviewCount: number
}

export interface PeerReviewSummary {
  memberScores: MemberScore[]
}

// Legacy aliases kept for backward compatibility
export interface Group {
  id: number
  name: string
  count: number
  members?: GroupMember[]
}

export interface GroupMember {
  user_id: number
  nickname: string
  timetable?: TimetableItem[]
}

export interface JoinGroupResponse {
  group_id: number
}

// AI Recommendation Types
export interface RecommendationFilters {
  preferred_days?: string[]
  min_free_days?: number
  preferred_times?: string[]
  required_courses?: string[]
}

export interface RecommendationRequest {
  filters: RecommendationFilters
  pinned_items?: number[]
}

export interface RecommendationCombination {
  combination_id: number
  items: TimetableItem[]
}

export interface CopyRecommendationRequest {
  section_id: number
  target_id: number
}

// Ecampus Types
export interface EcampusAssignment {
  assignmentId: string
  title: string
  deadline: string | null
  submittedAt: string | null
  submitted: boolean
}

export interface EcampusCourse {
  courseId: string
  courseName: string
  professor: string
  assignments: EcampusAssignment[]
}

export interface EcampusRequest {
  studentId: string
  password: string
}

