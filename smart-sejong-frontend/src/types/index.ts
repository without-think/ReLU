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

// Learning Types
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

// Group Types
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

export interface CreateGroupRequest {
  group_name: string
}

export interface CreateGroupResponse {
  invite_code: string
  group_id: number
}

export interface JoinGroupRequest {
  invite_code: string
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

