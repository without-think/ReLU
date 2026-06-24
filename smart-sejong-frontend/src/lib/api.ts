import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import toast from 'react-hot-toast'
import type {
  AuthResponse,
  LoginRequest,
  UserInfo,
  Course,
  LearningSummary,
  UploadResponse,
  CompletedCourseItem,
  CompletedCourseSummary,
  CompletedCourseUploadResult,
  CourseMaster,
  Section,
  Timetable,
  CreateTimetableRequest,
  CreateTimetableResponse,
  GroupSummary,
  GroupDetail,
  TeamMember,
  CreateGroupRequest,
  CreateGroupResponse,
  JoinGroupRequest,
  UpdateGroupRequest,
  AvailabilitySlot,
  AvailabilityResponse,
  ProjectTask,
  CreateTaskRequest,
  UpdateTaskRequest,
  TaskStatus,
  MemberRole,
  PeerReviewRequest,
  PeerReviewSummary,
  RecommendationRequest,
  RecommendationCombination,
  CopyRecommendationRequest,
  EcampusCourse,
  EcampusRequest,
  UpdatePreferenceRequest,
  ProfessorSection,
} from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

function formatSectionTime(s: { startTime?: string; endTime?: string }): string {
  const start = s.startTime ?? ''
  const end = s.endTime ?? ''
  if (start && end) return `${start}~${end}`
  return start || end || ''
}

class ApiClient {
  private client: AxiosInstance
  private isRefreshing = false
  private failedQueue: Array<{
    resolve: (token: string) => void
    reject: (error: unknown) => void
  }> = []

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor - Add token to headers
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('token')
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor - Handle errors with token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        // 네트워크 오류나 서버가 응답하지 않는 경우
        if (!error.response) {
          if (import.meta.env.DEV) {
            console.warn('API 요청 실패:', error.message)
          }
          return Promise.reject(error)
        }

        // 401 에러이고, 재시도하지 않은 요청이며, refresh 요청이 아닌 경우
        if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/refresh')) {
          if (this.isRefreshing) {
            // 이미 refresh 중이면 큐에 추가
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject })
            }).then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              return this.client(originalRequest)
            })
          }

          originalRequest._retry = true
          this.isRefreshing = true

          const refreshToken = localStorage.getItem('refreshToken')
          if (!refreshToken) {
            this.handleLogout()
            return Promise.reject(error)
          }

          try {
            const { data } = await axios.post<{ status: number; data: { accessToken: string; refreshToken?: string } }>(
              `${API_BASE_URL}/api/auth/refresh`,
              { refreshToken }
            )

            const newAccessToken = data.data.accessToken
            const newRefreshToken = data.data.refreshToken

            localStorage.setItem('token', newAccessToken)
            if (newRefreshToken) {
              localStorage.setItem('refreshToken', newRefreshToken)
            }

            // 대기 중인 요청들 처리
            this.failedQueue.forEach(({ resolve }) => resolve(newAccessToken))
            this.failedQueue = []

            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
            return this.client(originalRequest)
          } catch (refreshError) {
            this.failedQueue.forEach(({ reject }) => reject(refreshError))
            this.failedQueue = []
            this.handleLogout()
            return Promise.reject(refreshError)
          } finally {
            this.isRefreshing = false
          }
        }

        if (error.response?.status >= 500) {
          if (!import.meta.env.DEV) {
            toast.error('서버 오류가 발생했습니다.')
          }
        } else if (error.response?.data?.message && error.response?.status !== 401) {
          if (!import.meta.env.DEV) {
            toast.error(error.response.data.message)
          }
        }
        return Promise.reject(error)
      }
    )
  }

  private handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    window.location.href = '/login'
    toast.error('인증이 만료되었습니다. 다시 로그인해주세요.')
  }

  // Auth APIs
  async login(request: LoginRequest): Promise<AuthResponse> {
    const { data } = await this.client.post<{ status: number; message: string; data: AuthResponse }>(
      '/api/auth/login',
      request
    )
    if (data.status === 200 && data.data) {
      return data.data
    }
    throw new Error(data.message || '로그인에 실패했습니다.')
  }

  async professorMockLogin(name: string): Promise<AuthResponse> {
    const { data } = await this.client.post<{ status: number; message: string; data: AuthResponse }>(
      '/api/auth/professor-mock',
      { name }
    )
    if (data.status === 200 && data.data) {
      return data.data
    }
    throw new Error(data.message || '로그인에 실패했습니다.')
  }

  async demoLogin(name: string): Promise<AuthResponse> {
    const { data } = await this.client.post<{ status: number; message: string; data: AuthResponse }>(
      '/api/auth/demo',
      { name }
    )
    if (data.status === 200 && data.data) {
      return data.data
    }
    throw new Error(data.message || '로그인에 실패했습니다.')
  }

  async logout(): Promise<void> {
    await this.client.post('/api/auth/logout')
    localStorage.removeItem('token')
  }

  async getMyInfo(): Promise<UserInfo> {
    const { data } = await this.client.get<{ status?: number; data?: UserInfo }>('/api/users/me')
    const raw = data?.data ?? (data as unknown as UserInfo)
    const profile = raw as UserInfo & { fullName?: string; studentId?: string }
    return {
      ...profile,
      nickname: profile.nickname ?? profile.fullName ?? profile.studentId ?? profile.student_id ?? '사용자',
      student_id: profile.student_id ?? profile.studentId,
      is_verified: profile.is_verified ?? true,
    }
  }

  async updateMyInfo(updates: { name?: string; major?: string }): Promise<void> {
    await this.client.put('/api/users/me', updates)
  }

  /** 서비스 탈퇴 (계정 및 데이터 영구 삭제) */
  async deleteAccount(): Promise<void> {
    const { data } = await this.client.delete<{ status?: number }>('/api/users/me')
    if (data?.status === 200) {
      localStorage.removeItem('token')
    }
  }

  /** 포털 정보 재동기화 (전과 등 변경 시) */
  async syncPortalData(password: string): Promise<{ updatedFields?: string[] }> {
    const { data } = await this.client.post<{ status?: number; data?: { updatedFields?: string[] } }>(
      '/api/users/me/sync',
      { password }
    )
    if (data?.data) return data.data
    return {}
  }

  // Learning APIs (legacy)
  async uploadGrades(file: File): Promise<UploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await this.client.post<UploadResponse>(
      '/api/learning/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return data
  }

  async getCourses(): Promise<Course[]> {
    const { data } = await this.client.get<Course[]>('/api/learning/courses')
    return data
  }

  async getLearningSummary(): Promise<LearningSummary> {
    const { data } = await this.client.get<LearningSummary>('/api/learning/summary')
    return data
  }

  // Completed Course (기이수 과목) APIs
  /** 기이수 Excel 파싱만 (DB 저장 없음) */
  async uploadCompletedCoursesParseOnly(file: File): Promise<CompletedCourseItem[]> {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await this.client.post<{ status?: number; data?: CompletedCourseItem[] }>(
      '/api/completed-courses/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    if (data?.data) return data.data
    return (data as unknown as CompletedCourseItem[]) ?? []
  }

  /** 기이수 Excel 업로드 후 DB 저장 */
  async importCompletedCourses(file: File): Promise<CompletedCourseUploadResult> {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await this.client.post<{ status?: number; data?: CompletedCourseUploadResult }>(
      '/api/completed-courses/import',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    if (data?.data) return data.data
    throw new Error('저장 결과를 받지 못했습니다.')
  }

  async getCompletedCourses(userId?: number): Promise<CompletedCourseItem[]> {
    const params = userId != null ? { userId } : {}
    const { data } = await this.client.get<{ status?: number; data?: CompletedCourseItem[] }>(
      '/api/completed-courses',
      { params }
    )
    if (data?.data) return data.data
    return (data as unknown as CompletedCourseItem[]) ?? []
  }

  async getCompletedCoursesSummary(userId?: number): Promise<CompletedCourseSummary> {
    const params = userId != null ? { userId } : {}
    const { data } = await this.client.get<{ status?: number; data?: CompletedCourseSummary }>(
      '/api/completed-courses/summary',
      { params }
    )
    if (data?.data) return data.data
    throw new Error('요약 정보를 받지 못했습니다.')
  }

  private mapCourseToMaster(c: { id?: number; courseCode?: string; code?: string; name?: string; credits?: number }): CourseMaster {
    return {
      id: c.id ?? 0,
      code: c.courseCode ?? c.code ?? '',
      name: c.name ?? '',
      credits: c.credits,
    }
  }

  // Course APIs (CommonResponse unwrapped)
  async getAllCourses(): Promise<CourseMaster[]> {
    const { data } = await this.client.get<{ status?: number; data?: unknown[] }>('/api/courses')
    const list = data?.data ?? (data as unknown as unknown[]) ?? []
    return list.map((c) => this.mapCourseToMaster(c as Record<string, unknown>))
  }

  async searchCourses(params?: { name?: string; category?: string }): Promise<CourseMaster[]> {
    const { data } = await this.client.get<{ status?: number; data?: unknown[] }>(
      '/api/courses/search',
      { params: params ?? {} }
    )
    const list = data?.data ?? (data as unknown as unknown[]) ?? []
    return list.map((c) => this.mapCourseToMaster(c as Record<string, unknown>))
  }

  async getCourseDetails(id: number): Promise<CourseMaster> {
    const { data } = await this.client.get<{ status?: number; data?: unknown }>(
      `/api/courses/${id}`
    )
    const c = data?.data ?? data
    if (c && typeof c === 'object') return this.mapCourseToMaster(c as Record<string, unknown>)
    throw new Error('과목 정보를 받지 못했습니다.')
  }

  async getCourseByCode(courseCode: string): Promise<CourseMaster> {
    const { data } = await this.client.get<{ status?: number; data?: unknown }>(
      `/api/courses/code/${encodeURIComponent(courseCode)}`
    )
    const c = data?.data ?? data
    if (c && typeof c === 'object') return this.mapCourseToMaster(c as Record<string, unknown>)
    throw new Error('과목 정보를 받지 못했습니다.')
  }

  async getSections(courseId: number): Promise<Section[]> {
    const { data } = await this.client.get<{ status?: number; data?: Section[] }>(
      `/api/courses/${courseId}/sections`
    )
    const raw = data?.data ?? (data as unknown as Section[])
    if (!raw || !Array.isArray(raw)) return []
    return raw.map((s) => ({
      section_id: (s as { section_id?: number; id?: number }).section_id ?? (s as { id?: number }).id ?? 0,
      professor: (s as Section).professor ?? '',
      day: (s as { day?: string; dayOfWeekKor?: string }).day ?? (s as { dayOfWeekKor?: string }).dayOfWeekKor ?? '',
      time: formatSectionTime(s as { startTime?: string; endTime?: string }),
    }))
  }

  async getAllSections(): Promise<Section[]> {
    const { data } = await this.client.get<{ status?: number; data?: Section[] }>(
      '/api/courses/sections'
    )
    const raw = data?.data ?? (data as unknown as Section[])
    if (!raw || !Array.isArray(raw)) return []
    return raw.map((s) => ({
      section_id: (s as { section_id?: number; id?: number }).section_id ?? (s as { id?: number }).id ?? 0,
      professor: (s as Section).professor ?? '',
      day: (s as { day?: string; dayOfWeekKor?: string }).day ?? (s as { dayOfWeekKor?: string }).dayOfWeekKor ?? '',
      time: formatSectionTime(s as { startTime?: string; endTime?: string }),
    }))
  }

  async searchSections(params?: {
    courseName?: string
    professor?: string
    dayOfWeek?: string
  }): Promise<Section[]> {
    const { data } = await this.client.get<{ status?: number; data?: Section[] }>(
      '/api/courses/sections/search',
      { params: params ?? {} }
    )
    const raw = data?.data ?? (data as unknown as Section[])
    if (!raw || !Array.isArray(raw)) return []
    return raw.map((s) => ({
      section_id: (s as { section_id?: number; id?: number }).section_id ?? (s as { id?: number }).id ?? 0,
      professor: (s as Section).professor ?? '',
      day: (s as { day?: string; dayOfWeekKor?: string }).day ?? (s as { dayOfWeekKor?: string }).dayOfWeekKor ?? '',
      time: formatSectionTime(s as { startTime?: string; endTime?: string }),
    }))
  }

  async getProfessorSections(professorName: string): Promise<ProfessorSection[]> {
    const { data } = await this.client.get<{ status?: number; data?: ProfessorSection[] }>(
      '/api/courses/sections/search',
      { params: { professor: professorName } }
    )
    return data?.data ?? []
  }

  // Timetable APIs
  async createTimetable(request: CreateTimetableRequest): Promise<CreateTimetableResponse> {
    const { data } = await this.client.post<CreateTimetableResponse>(
      '/api/timetables',
      request
    )
    return data
  }

  async getTimetables(): Promise<Timetable[]> {
    const { data } = await this.client.get<Timetable[]>('/api/timetables')
    return data
  }

  async getTimetable(id: number): Promise<Timetable> {
    const { data } = await this.client.get<Timetable>(`/api/timetables/${id}`)
    return data
  }

  async updateTimetableName(id: number, name: string): Promise<void> {
    await this.client.patch(`/api/timetables/${id}/name`, { name })
  }

  async deleteTimetable(id: number): Promise<void> {
    await this.client.delete(`/api/timetables/${id}`)
  }

  // Timetable Item APIs
  async addSectionItem(timetableId: number, sectionId: number): Promise<{ item_id: number }> {
    const { data } = await this.client.post<{ item_id: number }>(
      `/api/timetables/${timetableId}/items/section`,
      { section_id: sectionId }
    )
    return data
  }

  async addCustomItem(
    timetableId: number,
    item: { name: string; day: string; start: string; end: string }
  ): Promise<{ item_id: number }> {
    const { data } = await this.client.post<{ item_id: number }>(
      `/api/timetables/${timetableId}/items/custom`,
      item
    )
    return data
  }

  async updateCustomItem(
    itemId: number,
    item: { name: string; day: string; start: string; end: string }
  ): Promise<void> {
    await this.client.put(`/api/timetables/items/custom/${itemId}`, item)
  }

  async deleteItem(itemId: number): Promise<void> {
    await this.client.delete(`/api/timetables/items/${itemId}`)
  }

  async togglePin(itemId: number, isPinned: boolean): Promise<{ item_id: number; is_pinned: boolean }> {
    const { data } = await this.client.patch<{ item_id: number; is_pinned: boolean }>(
      `/api/timetables/items/${itemId}/pin`,
      { is_pinned: isPinned }
    )
    return data
  }

  // Group / Team Project APIs
  async createGroup(request: CreateGroupRequest): Promise<CreateGroupResponse> {
    const { data } = await this.client.post<{ status: number; data: CreateGroupResponse }>('/api/groups', request)
    return data.data
  }

  async getGroups(params?: { ecampusCourseId?: string }): Promise<GroupSummary[]> {
    const { data } = await this.client.get<{ status: number; data: GroupSummary[] }>(
      '/api/groups',
      { params: params ?? {} }
    )
    return data.data ?? []
  }

  async getGroupDetail(id: number): Promise<GroupDetail> {
    const { data } = await this.client.get<{ status: number; data: GroupDetail }>(`/api/groups/${id}`)
    return data.data
  }

  async updateGroup(id: number, request: UpdateGroupRequest): Promise<void> {
    await this.client.patch(`/api/groups/${id}`, request)
  }

  async joinGroup(request: JoinGroupRequest): Promise<void> {
    await this.client.post('/api/groups/join', request)
  }

  async leaveGroup(id: number): Promise<void> {
    await this.client.delete(`/api/groups/${id}/leave`)
  }

  async setAvailability(groupId: number, slots: AvailabilitySlot[]): Promise<void> {
    await this.client.post(`/api/groups/${groupId}/availability`, { slots })
  }

  async getAvailability(groupId: number): Promise<AvailabilityResponse> {
    const { data } = await this.client.get<{ status: number; data: AvailabilityResponse }>(
      `/api/groups/${groupId}/availability`
    )
    return data.data
  }

  async getGroupMembers(groupId: number): Promise<TeamMember[]> {
    const { data } = await this.client.get<{ status: number; data: TeamMember[] }>(
      `/api/groups/${groupId}/members`
    )
    return data.data ?? []
  }

  async assignRole(groupId: number, memberId: number, role: MemberRole): Promise<TeamMember> {
    const { data } = await this.client.put<{ status: number; data: TeamMember }>(
      `/api/groups/${groupId}/members/${memberId}/role`,
      { role }
    )
    return data.data
  }

  async updatePreference(groupId: number, request: UpdatePreferenceRequest): Promise<TeamMember> {
    const { data } = await this.client.put<{ status: number; data: TeamMember }>(
      `/api/groups/${groupId}/members/preference`,
      request
    )
    return data.data
  }

  async markReady(groupId: number): Promise<TeamMember> {
    const { data } = await this.client.post<{ status: number; data: TeamMember }>(
      `/api/groups/${groupId}/members/ready`
    )
    return data.data
  }

  async confirmRoles(groupId: number): Promise<GroupDetail> {
    const { data } = await this.client.post<{ status: number; data: GroupDetail }>(
      `/api/groups/${groupId}/confirm-roles`
    )
    return data.data
  }

  async setAdditionalRoles(groupId: number, memberId: number, additionalRoles: MemberRole[]): Promise<TeamMember> {
    const { data } = await this.client.put<{ status: number; data: TeamMember }>(
      `/api/groups/${groupId}/members/${memberId}/additional-roles`,
      { additionalRoles }
    )
    return data.data
  }

  async createTask(groupId: number, request: CreateTaskRequest): Promise<ProjectTask> {
    const { data } = await this.client.post<{ status: number; data: ProjectTask }>(
      `/api/groups/${groupId}/tasks`,
      request
    )
    return data.data
  }

  async getTasks(groupId: number): Promise<ProjectTask[]> {
    const { data } = await this.client.get<{ status: number; data: ProjectTask[] }>(
      `/api/groups/${groupId}/tasks`
    )
    return data.data ?? []
  }

  async submitTask(taskId: number, file?: File): Promise<ProjectTask> {
    const formData = new FormData()
    if (file) formData.append('file', file)
    const { data } = await this.client.post<{ status: number; data: ProjectTask }>(
      `/api/groups/tasks/${taskId}/submit`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return data.data
  }

  async updateTaskStatus(taskId: number, status: TaskStatus): Promise<ProjectTask> {
    const { data } = await this.client.patch<{ status: number; data: ProjectTask }>(
      `/api/groups/tasks/${taskId}/status`,
      { status }
    )
    return data.data
  }

  async updateTask(taskId: number, request: UpdateTaskRequest): Promise<ProjectTask> {
    const { data } = await this.client.put<{ status: number; data: ProjectTask }>(
      `/api/groups/tasks/${taskId}`,
      request
    )
    return data.data
  }

  async deleteTask(taskId: number): Promise<void> {
    await this.client.delete(`/api/groups/tasks/${taskId}`)
  }

  async updateTaskProgress(taskId: number, progress: number): Promise<ProjectTask> {
    const { data } = await this.client.patch<{ status: number; data: ProjectTask }>(
      `/api/groups/tasks/${taskId}/progress`,
      { progress }
    )
    return data.data
  }

  async updateTaskDates(taskId: number, startDate: string, deadline: string): Promise<ProjectTask> {
    const { data } = await this.client.patch<{ status: number; data: ProjectTask }>(
      `/api/groups/tasks/${taskId}/dates`,
      { startDate, deadline }
    )
    return data.data
  }

  async submitPeerReview(groupId: number, request: PeerReviewRequest): Promise<void> {
    await this.client.post(`/api/groups/${groupId}/reviews`, request)
  }

  async getPeerReviewSummary(groupId: number): Promise<PeerReviewSummary> {
    const { data } = await this.client.get<{ status: number; data: PeerReviewSummary }>(
      `/api/groups/${groupId}/reviews`
    )
    return data.data
  }

  // AI Recommendation APIs
  async generateRecommendations(
    request: RecommendationRequest
  ): Promise<RecommendationCombination[]> {
    const { data } = await this.client.post<RecommendationCombination[]>(
      '/api/recommend/generate',
      request
    )
    return data
  }

  async copyRecommendation(request: CopyRecommendationRequest): Promise<void> {
    await this.client.post('/api/recommend/copy', request)
  }

  // Ecampus APIs
  async getEcampusCurrent(request: EcampusRequest): Promise<EcampusCourse[]> {
    const { data } = await this.client.post<{ status: number; data: EcampusCourse[] }>(
      '/api/ecampus/courses/current',
      request
    )
    return data.data ?? []
  }

  async getEcampusPast(request: EcampusRequest, year: string, semester: string): Promise<EcampusCourse[]> {
    const { data } = await this.client.post<{ status: number; data: EcampusCourse[] }>(
      `/api/ecampus/courses/past?year=${year}&semester=${semester}`,
      request
    )
    return data.data ?? []
  }
}

export const api = new ApiClient()
