import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import toast from 'react-hot-toast'
import type {
  AuthResponse,
  LoginRequest,
  UserInfo,
  Course,
  LearningSummary,
  UploadResponse,
  CourseMaster,
  Section,
  Timetable,
  TimetableItem,
  CreateTimetableRequest,
  CreateTimetableResponse,
  Group,
  GroupMember,
  CreateGroupRequest,
  CreateGroupResponse,
  JoinGroupRequest,
  JoinGroupResponse,
  RecommendationRequest,
  RecommendationCombination,
  CopyRecommendationRequest,
} from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

class ApiClient {
  private client: AxiosInstance

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

    // Response interceptor - Handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // 네트워크 오류나 서버가 응답하지 않는 경우
        if (!error.response) {
          // 개발 모드에서는 콘솔에만 표시 (흰 화면 방지)
          if (import.meta.env.DEV) {
            console.warn('API 요청 실패:', error.message)
          }
          return Promise.reject(error)
        }
        
        if (error.response?.status === 401) {
          localStorage.removeItem('token')
          // 개발 모드에서는 리다이렉트 안 함
          if (!import.meta.env.DEV) {
            window.location.href = '/login'
            toast.error('인증이 만료되었습니다. 다시 로그인해주세요.')
          }
        } else if (error.response?.status >= 500) {
          // 개발 모드에서는 토스트 안 띄움 (너무 많은 알림 방지)
          if (!import.meta.env.DEV) {
            toast.error('서버 오류가 발생했습니다.')
          }
        } else if (error.response?.data?.message) {
          // 개발 모드에서는 토스트 안 띄움
          if (!import.meta.env.DEV) {
            toast.error(error.response.data.message)
          }
        }
        return Promise.reject(error)
      }
    )
  }

  // Auth APIs
  async login(request: LoginRequest): Promise<AuthResponse> {
    const { data } = await this.client.post<{ status: number; message: string; data: AuthResponse }>(
      '/api/auth/login',
      request
    )
    // CommonResponse 형식: { status: 200, message: "...", data: AuthResponse }
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
    const { data } = await this.client.get<UserInfo>('/api/users/me')
    return data
  }

  async updateMyInfo(updates: { name?: string; major?: string }): Promise<void> {
    await this.client.put('/api/users/me', updates)
  }

  // Learning APIs
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

  // Course APIs
  async searchCourses(keyword?: string): Promise<CourseMaster[]> {
    const { data } = await this.client.get<CourseMaster[]>('/api/courses', {
      params: { keyword },
    })
    return data
  }

  async getCourseDetails(id: number): Promise<CourseMaster> {
    const { data } = await this.client.get<CourseMaster>(`/api/courses/${id}`)
    return data
  }

  async getSections(courseId: number): Promise<Section[]> {
    const { data } = await this.client.get<Section[]>(
      `/api/courses/${courseId}/sections`
    )
    return data
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

  // Group APIs
  async createGroup(request: CreateGroupRequest): Promise<CreateGroupResponse> {
    const { data } = await this.client.post<CreateGroupResponse>('/api/groups', request)
    return data
  }

  async getGroups(): Promise<Group[]> {
    const { data } = await this.client.get<Group[]>('/api/groups')
    return data
  }

  async getGroup(id: number): Promise<Group & { members: GroupMember[] }> {
    const { data } = await this.client.get<Group & { members: GroupMember[] }>(
      `/api/groups/${id}`
    )
    return data
  }

  async joinGroup(request: JoinGroupRequest): Promise<JoinGroupResponse> {
    const { data } = await this.client.post<JoinGroupResponse>('/api/groups/join', request)
    return data
  }

  async leaveGroup(id: number): Promise<void> {
    await this.client.delete(`/api/groups/${id}/leave`)
  }

  async setActiveTimetable(groupId: number, timetableId: number): Promise<void> {
    await this.client.put(`/api/groups/${groupId}/active`, { timetable_id: timetableId })
  }

  async getMemberTimetable(groupId: number, userId: number): Promise<{ user_id: number; items: TimetableItem[] }> {
    const { data } = await this.client.get<{ user_id: number; items: TimetableItem[] }>(
      `/api/groups/${groupId}/members/${userId}/timetable`
    )
    return data
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
}

export const api = new ApiClient()

