import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import {
  Plus, Users, Copy, LogOut, UserPlus, Github, Clock, CheckCircle,
  AlertTriangle, X, BookOpen, Search,
  CheckCircle2, XCircle, AlertCircle, Eye, EyeOff, Calendar, Trash2, Edit2,
} from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from 'recharts'
import {
  format, parseISO, isPast, differenceInHours, differenceInDays,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { TimetableGrid } from '@/components/timetable/TimetableGrid'
import { GanttTab } from '@/components/group/GanttTab'
import { ChatPanel } from '@/components/group/ChatPanel'
import type {
  GroupSummary, GroupDetail, TeamMember, MemberRole, ProjectTask,
  TaskStatus, AvailabilitySlot, PeerReviewRequest,
  EcampusCourse, Timetable, UpdateTaskRequest, MemberScore,
} from '@/types'

// ─── constants ───────────────────────────────────────────────────────────────

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
const DAY_LABELS: Record<string, string> = {
  MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토',
}
const SLOT_COUNT = 26 // 09:00 ~ 21:30, 30min each
const BASE_HOUR = 9

const ROLE_LABELS: Record<MemberRole, string> = {
  UNASSIGNED: '미배정',
  LEADER: '팀장',
  RESEARCHER: '자료조사',
  PRESENTER: '발표',
  BACKEND: '백엔드',
  FRONTEND: '프론트',
  AI: 'AI',
}

const ROLE_COLORS: Record<MemberRole, string> = {
  UNASSIGNED: 'bg-[#f2eee8] text-[#7a7169]',
  LEADER: 'bg-[#a8793d]/15 text-[#a8793d]',
  RESEARCHER: 'bg-[#31465d]/12 text-[#31465d]',
  PRESENTER: 'bg-purple-100 text-purple-700',
  BACKEND: 'bg-[#4a8768]/12 text-[#4a8768]',
  FRONTEND: 'bg-pink-100 text-pink-700',
  AI: 'bg-orange-100 text-orange-700',
}

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: '진행중',
  SUBMITTED: '제출완료',
  LATE: '지각제출',
  APPROVED: '승인됨',
  REJECTED: '반려됨',
}

const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  PENDING: 'bg-[#31465d]/12 text-[#31465d]',
  SUBMITTED: 'bg-[#4a8768]/12 text-[#4a8768]',
  LATE: 'bg-[#6f4141]/12 text-[#6f4141]',
  APPROVED: 'bg-[#4a8768]/20 text-[#3d7258]',
  REJECTED: 'bg-[#f2eee8] text-[#7a7169]',
}

function slotToTime(slot: number) {
  const totalMin = BASE_HOUR * 60 + slot * 30
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function tempColor(temp: number) {
  if (temp >= 38) return 'text-[#6f4141]'
  if (temp >= 36) return 'text-[#a8793d]'
  if (temp >= 33) return 'text-[#4a8768]'
  return 'text-[#31465d]'
}

// ─── main page ────────────────────────────────────────────────────────────────

type Tab = 'home' | 'timetable' | 'availability' | 'roles' | 'tasks' | 'gantt' | 'review' | 'ecampus' | 'ai' | 'chat'
type TeamView = 'mine' | 'find'

interface GroupRouteState {
  ecampusPassword?: string
  autoFetchEcampus?: boolean
}

const ECAMPUS_COURSES_SESSION_KEY = 'ecampus_current_courses'
const ECAMPUS_PASSWORD_ONCE_KEY = 'ecampus_pw_once'

function loadCachedCourses(): EcampusCourse[] {
  try {
    const cached = sessionStorage.getItem(ECAMPUS_COURSES_SESSION_KEY)
    return cached ? JSON.parse(cached) : []
  } catch {
    return []
  }
}

export default function GroupPage() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const routeState = location.state as GroupRouteState | null
  const user = useAuthStore(s => s.user)
  const studentId = user?.student_id ?? ''
  const didAutoFetch = useRef(false)
  const [courses, setCourses] = useState<EcampusCourse[]>(() => loadCachedCourses())
  const [selectedCourse, setSelectedCourse] = useState<EcampusCourse | null>(null)
  const [ecampusPassword, setEcampusPassword] = useState(
    routeState?.ecampusPassword ?? sessionStorage.getItem(ECAMPUS_PASSWORD_ONCE_KEY) ?? ''
  )
  const [showCoursePassword, setShowCoursePassword] = useState(false)
  const [courseSearch, setCourseSearch] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [teamView, setTeamView] = useState<TeamView>(() => searchParams.get('tab') === 'find' ? 'find' : 'mine')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)

  const fetchCoursesMutation = useMutation({
    mutationFn: (password: string) => api.getEcampusCurrent({ studentId, password }),
    onSuccess: data => {
      sessionStorage.removeItem(ECAMPUS_PASSWORD_ONCE_KEY)
      sessionStorage.setItem(ECAMPUS_COURSES_SESSION_KEY, JSON.stringify(data))
      setCourses(data)
      if (data.length === 0) {
        toast.error('현재학기 eCampus 과목을 찾지 못했습니다.')
      }
    },
    onError: () => {
      sessionStorage.removeItem(ECAMPUS_PASSWORD_ONCE_KEY)
      setCourses([])
      setSelectedCourse(null)
      toast.error('eCampus 과목을 불러오지 못했습니다.')
    },
  })

  const { data: myGroups = [], isLoading: myGroupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.getGroups(),
  })

  const { data: courseGroups = [], isLoading: courseGroupsLoading } = useQuery({
    queryKey: ['groups', selectedCourse?.courseId],
    queryFn: () => api.getGroups({ ecampusCourseId: selectedCourse?.courseId }),
    enabled: !!selectedCourse,
  })

  const { data: groupDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['group', selectedGroupId],
    queryFn: () => api.getGroupDetail(selectedGroupId!),
    enabled: !!selectedGroupId,
    refetchInterval: (query) => {
      // 역할 확정 전(온보딩 중)에는 3초마다 폴링, 확정 후엔 중단
      const data = query.state.data as import('@/types').GroupDetail | undefined
      return data?.rolesConfirmed ? false : 3000
    },
  })

  const leaveMutation = useMutation({
    mutationFn: (id: number) => api.leaveGroup(id),
    onSuccess: () => {
      toast.success('그룹에서 나갔습니다.')
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups', selectedCourse?.courseId] })
      setSelectedGroupId(null)
    },
  })

  const courseJoinMutation = useMutation({
    mutationFn: (inviteCode: string) => api.joinGroup({ inviteCode }),
    onSuccess: () => {
      toast.success('팀에 참가했습니다.')
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups', selectedCourse?.courseId] })
      handleTeamViewChange('mine')
    },
    onError: () => toast.error('팀 참가에 실패했습니다.'),
  })

  useEffect(() => {
    const oneTimePassword = routeState?.ecampusPassword ?? sessionStorage.getItem(ECAMPUS_PASSWORD_ONCE_KEY)
    if (didAutoFetch.current || !oneTimePassword || !studentId) return
    didAutoFetch.current = true
    fetchCoursesMutation.mutate(oneTimePassword)
  }, [fetchCoursesMutation, routeState?.ecampusPassword, studentId])

  useEffect(() => {
    setSelectedGroupId(null)
    setActiveTab('home')
  }, [selectedCourse?.courseId])

  useEffect(() => {
    const nextView = searchParams.get('tab') === 'find' ? 'find' : 'mine'
    setTeamView(nextView)
  }, [searchParams])

  // If roles just got confirmed, the active tab might not exist in the new set — keep it if valid, else snap to roles
  useEffect(() => {
    if (!groupDetail || groupDetail.rolesConfirmed) return
    const onboardingIds: Tab[] = ['home', 'availability', 'roles']
    if (!onboardingIds.includes(activeTab)) setActiveTab('roles')
  }, [groupDetail?.rolesConfirmed, activeTab])

  const filteredCourses = useMemo(() => {
    if (!courseSearch.trim()) return courses
    const q = courseSearch.toLowerCase()
    return courses.filter(course =>
      course.courseName.toLowerCase().includes(q) ||
      course.professor.toLowerCase().includes(q)
    )
  }, [courses, courseSearch])

  const activeGroupCourse = useMemo(() => {
    if (selectedCourse) return selectedCourse
    if (!groupDetail?.ecampusCourseId) return null
    return courses.find(course => course.courseId === groupDetail.ecampusCourseId) ?? null
  }, [courses, groupDetail?.ecampusCourseId, selectedCourse])

  const handleCourseFetch = () => {
    if (!ecampusPassword) {
      toast.error('포털 비밀번호를 입력해주세요.')
      return
    }
    fetchCoursesMutation.mutate(ecampusPassword)
  }

  const handleTeamViewChange = (view: TeamView) => {
    setTeamView(view)
    setSelectedGroupId(null)
    setSearchParams(view === 'find' ? { tab: 'find' } : {})
  }

  const isProfessor = user?.role === 'PROFESSOR' || user?.role === 'ADMIN'

  const allTabs: { id: Tab; label: string }[] = [
    { id: 'home', label: '팀 홈' },
    { id: 'chat', label: '채팅' },
    { id: 'availability', label: '가능 시간' },
    { id: 'roles', label: '역할 배분' },
    { id: 'review', label: '동료 평가' },
    { id: 'ai', label: 'AI 분석' },
    { id: 'ecampus', label: '과제 제출 이력' },
  ]

  // 교수용 탭 (시간표, 가능시간, 과제관리, 과제제출이력 제외)
  const professorTabs: { id: Tab; label: string }[] = [
    { id: 'home', label: '팀 홈' },
    { id: 'roles', label: '역할 배분' },
    { id: 'gantt', label: '간트 차트' },
    { id: 'review', label: '동료 평가' },
  ]

  // Before roles are confirmed, only show onboarding-relevant tabs
  const onboardingTabs: { id: Tab; label: string }[] = [
    { id: 'home', label: '팀 홈' },
    { id: 'availability', label: '가능 시간' },
    { id: 'roles', label: '역할 배분' },
  ]

  const getTabs = () => {
    if (isProfessor) return professorTabs
    if (!groupDetail?.rolesConfirmed) return onboardingTabs
    return allTabs
  }
  const tabs = getTabs()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#25231f] mb-1">팀 프로젝트</h1>
          {teamView === 'find' && selectedCourse && (
            <p className="text-sm font-medium text-[#7a7169]">
              {selectedCourse.courseName}{selectedCourse.professor ? ` · ${selectedCourse.professor}` : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!selectedCourse}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /><span>팀 생성</span>
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            disabled={!selectedCourse}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserPlus className="w-4 h-4" /><span>참가</span>
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${teamView === 'find' ? 'lg:grid-cols-4' : ''}`}>
        {/* Sidebar: course and group list */}
        {teamView === 'find' && (
        <div className="lg:col-span-1">
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-[#7a7169] text-xs uppercase tracking-wider">내 과목</h2>
                {courses.length > 0 && (
                  <button
                    onClick={() => {
                      sessionStorage.removeItem(ECAMPUS_COURSES_SESSION_KEY)
                      setCourses([])
                      setSelectedCourse(null)
                    }}
                    className="text-xs font-bold text-[#b0a8a0] hover:text-[#6f4141]"
                  >
                    초기화
                  </button>
                )}
              </div>

              {courses.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-[#7a7169]">현재학기 {courses.length}개 과목</p>
                    {fetchCoursesMutation.isPending && (
                      <span className="text-xs font-bold text-[#b0a8a0]">동기화 중</span>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#b0a8a0]" />
                    <input
                      type="text"
                      value={courseSearch}
                      onChange={e => setCourseSearch(e.target.value)}
                      className="input pl-9 text-sm"
                      placeholder="과목 검색"
                    />
                  </div>
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {filteredCourses.map(course => (
                      <CourseSelectCard
                        key={course.courseId}
                        course={course}
                        isSelected={selectedCourse?.courseId === course.courseId}
                        onSelect={() => {
                          setSelectedCourse(course)
                          setSelectedGroupId(null)
                          handleTeamViewChange('find')
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : fetchCoursesMutation.isPending ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-14 bg-[#f2eee8] rounded-xl animate-pulse" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[#7a7169]">로그인 후 eCampus 과목을 백그라운드로 불러옵니다. 목록이 비어 있으면 다시 불러오세요.</p>
                  <div className="relative">
                    <input
                      type={showCoursePassword ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="포털 비밀번호"
                      value={ecampusPassword}
                      onChange={e => setEcampusPassword(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCourseFetch() }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCoursePassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showCoursePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={handleCourseFetch}
                    disabled={!ecampusPassword}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    과목 불러오기
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
        )}

        {/* Main panel */}
        <div className={teamView === 'find' ? 'lg:col-span-3' : ''}>
          {!selectedGroupId ? (
            <div className="space-y-4">
              <TeamDashboard
                courses={courses}
                selectedCourse={selectedCourse}
                myGroups={myGroups}
                courseGroups={courseGroups}
                myGroupsLoading={myGroupsLoading}
                courseGroupsLoading={courseGroupsLoading}
                view={teamView}
                onViewChange={handleTeamViewChange}
                onSelectCourse={setSelectedCourse}
                onSelectGroup={(groupId) => { setSelectedGroupId(groupId); setActiveTab('roles') }}
                onJoinGroup={(inviteCode) => courseJoinMutation.mutate(inviteCode)}
                onCreateGroup={() => setShowCreateModal(true)}
              />
              {teamView === 'find' && selectedCourse && <CourseAssignmentPanel course={selectedCourse} />}
            </div>
          ) : detailLoading ? (
            <div className="card text-center py-16">
              <div className="animate-spin w-8 h-8 border-2 border-[#4a8768] border-t-transparent rounded-full mx-auto" />
            </div>
          ) : groupDetail ? (
            <div className="space-y-4">
              {/* Tab bar */}
              <div className="card py-3">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 flex-wrap">
                    {tabs.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`tab-btn ${activeTab === t.id ? 'tab-btn-active' : 'tab-btn-inactive'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => leaveMutation.mutate(selectedGroupId)}
                    className="text-[#b0a8a0] hover:text-[#6f4141] transition-colors p-2 rounded-full hover:bg-[#6f4141]/10"
                    title="나가기"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tab content */}
              {activeTab === 'home' && (
                <HomeTab group={groupDetail} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['group', selectedGroupId] })} />
              )}
              {activeTab === 'availability' && (
                <AvailabilityTab groupId={selectedGroupId} members={groupDetail.members} />
              )}
              {activeTab === 'roles' && (
                <RolesTab group={groupDetail} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['group', selectedGroupId] })} />
              )}
              {activeTab === 'review' && (
                <ReviewTab groupId={selectedGroupId} members={groupDetail.members} />
              )}
              {activeTab === 'ai' && (
                <AiAnalysisTab groupId={selectedGroupId} groupName={groupDetail.name} members={groupDetail.members} />
              )}
              {activeTab === 'chat' && (
                <ChatPanel groupId={selectedGroupId} members={groupDetail.members} />
              )}
              {activeTab === 'ecampus' && (
                activeGroupCourse ? (
                  <CourseAssignmentPanel course={activeGroupCourse} />
                ) : (
                  <div className="card text-center py-12 text-[#b0a8a0]">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>이 팀의 과목 데이터를 먼저 불러오세요</p>
                  </div>
                )
              )}
            </div>
          ) : null}
        </div>
      </div>

      {showCreateModal && (
        <CreateGroupModal
          course={selectedCourse}
          onClose={() => setShowCreateModal(false)}
          onCreated={(id) => {
            setSelectedGroupId(id)
            setShowCreateModal(false)
            queryClient.invalidateQueries({ queryKey: ['groups'] })
            queryClient.invalidateQueries({ queryKey: ['groups', selectedCourse?.courseId] })
          }}
        />
      )}
      {showJoinModal && (
        <JoinGroupModal
          onClose={() => setShowJoinModal(false)}
          onJoined={() => {
            setShowJoinModal(false)
            queryClient.invalidateQueries({ queryKey: ['groups'] })
            queryClient.invalidateQueries({ queryKey: ['groups', selectedCourse?.courseId] })
          }}
        />
      )}
    </div>
  )
}

function CourseSelectCard({ course, isSelected, onSelect }: {
  course: EcampusCourse; isSelected: boolean; onSelect: () => void
}) {
  const pending = course.assignments.filter(a => !a.submitted).length

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full p-3.5 rounded-2xl border-2 text-left transition-all ${
        isSelected
          ? 'border-[#4a8768] bg-[#4a8768]/8'
          : 'border-[#e7e0d7] hover:border-[#d0c8bf] bg-white/70'
      }`}
    >
      <p className="font-bold text-[#25231f] text-sm tracking-tight truncate">{course.courseName}</p>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-[#b0a8a0]">
        <span className="truncate">{course.professor || '교수 정보 없음'}</span>
        {pending > 0 && <span className="font-bold text-[#a8793d] flex-shrink-0">미제출 {pending}</span>}
      </div>
    </button>
  )
}

// ─── GroupCard ─────────────────────────────────────────────────────────────────

function GroupCard({ group, isSelected, onSelect }: {
  group: GroupSummary; isSelected: boolean; onSelect: () => void
}) {
  const courseLabel = group.courseName || '과목 정보 없음'
  const professorLabel = group.professor || '교수 정보 없음'

  return (
    <div
      onClick={onSelect}
      className={`min-h-[180px] p-6 rounded-[28px] border-2 cursor-pointer transition-all hover:-translate-y-1 ${
        isSelected ? 'border-[#4a8768]' : 'border-white/55 hover:border-[#4a8768]/50'
      }`}
      style={{
        background: isSelected
          ? 'linear-gradient(145deg, rgba(74,135,104,0.18) 0%, rgba(74,135,104,0.06) 100%)'
          : 'linear-gradient(145deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 100%)',
        backdropFilter: 'blur(6px) saturate(180%)',
        WebkitBackdropFilter: 'blur(6px) saturate(180%)',
        boxShadow: isSelected
          ? '0 8px 32px rgba(74,135,104,0.18), inset 0 1px 0 rgba(255,255,255,0.85)'
          : '0 8px 32px rgba(31,38,135,0.12), inset 0 1px 0 rgba(255,255,255,0.90), inset 0 4px 24px rgba(255,255,255,0.16)',
      }}
    >
      <div className="flex h-full flex-col justify-between gap-5">
        <div className="min-w-0 space-y-3">
          <p className="font-extrabold text-[#25231f] text-lg tracking-tight truncate">{group.name}</p>
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-[#7a7169] truncate">{courseLabel}</p>
            <p className="text-xs font-bold text-[#b0a8a0] truncate">{professorLabel}</p>
          </div>
        </div>
        <p className="text-sm text-[#b0a8a0] font-bold">참여 {group.memberCount}명{group.projectDeadline ? ` · D-${Math.max(0, differenceInHours(parseISO(group.projectDeadline), new Date()) / 24 | 0)}` : ''}</p>
      </div>
    </div>
  )
}

function FindGroupCard({ group, onSelect, onJoin }: {
  group: GroupSummary; onSelect: () => void; onJoin: () => void
}) {
  return (
    <div
      onClick={() => { if (group.joined) onSelect() }}
      className="p-3.5 rounded-2xl border cursor-pointer transition-all border-white/55 hover:border-[#4a8768]/50"
      style={{ background: 'linear-gradient(145deg,rgba(255,255,255,0.20) 0%,rgba(255,255,255,0.07) 100%)', backdropFilter: 'blur(6px) saturate(180%)', WebkitBackdropFilter: 'blur(6px) saturate(180%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-[#25231f] text-sm tracking-tight truncate">{group.name}</p>
          <p className="text-xs text-[#7a7169] mt-1 truncate">{group.courseName || '과목 정보 없음'}</p>
          <p className="text-xs text-[#b0a8a0] mt-0.5">참여 {group.memberCount}명{group.projectDeadline ? ` · D-${Math.max(0, differenceInHours(parseISO(group.projectDeadline), new Date()) / 24 | 0)}` : ''}</p>
        </div>
        {!group.joined && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onJoin()
            }}
            className="px-2.5 py-1 rounded-full bg-[#4a8768] text-white text-xs font-bold flex-shrink-0"
          >
            참가
          </button>
        )}
      </div>
    </div>
  )
}

function TeamDashboard({ courses, selectedCourse, myGroups, courseGroups, myGroupsLoading, courseGroupsLoading, view, onViewChange, onSelectCourse, onSelectGroup, onJoinGroup, onCreateGroup }: {
  courses: EcampusCourse[]
  selectedCourse: EcampusCourse | null
  myGroups: GroupSummary[]
  courseGroups: GroupSummary[]
  myGroupsLoading: boolean
  courseGroupsLoading: boolean
  view: TeamView
  onViewChange: (view: TeamView) => void
  onSelectCourse: (course: EcampusCourse) => void
  onSelectGroup: (groupId: number) => void
  onJoinGroup: (inviteCode: string) => void
  onCreateGroup: () => void
}) {
  const isLoading = view === 'mine' ? myGroupsLoading : courseGroupsLoading
  const visibleGroups = view === 'mine' ? myGroups : courseGroups

  return (
    <div className={view === 'mine' ? 'space-y-4' : 'card space-y-4'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold tracking-tight text-[#25231f]">
            {view === 'mine' ? '내가 소속된 팀' : '팀 찾기'}
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onViewChange('mine')}
            className={`tab-btn ${view === 'mine' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
          >
            내 팀
          </button>
          <button
            onClick={() => onViewChange('find')}
            className={`tab-btn ${view === 'find' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
          >
            팀 찾기
          </button>
        </div>
      </div>

      {view === 'find' && courses.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {courses.map(course => (
            <button
              key={course.courseId}
              onClick={() => onSelectCourse(course)}
              className={`px-3 py-2 rounded-full border text-sm font-bold whitespace-nowrap transition-colors ${
                selectedCourse?.courseId === course.courseId
                  ? 'bg-[#4a8768] text-white border-[#4a8768]'
                  : 'bg-white/70 text-[#7a7169] border-[#e7e0d7] hover:border-[#4a8768]/40'
              }`}
            >
              {course.courseName}
            </button>
          ))}
        </div>
      )}

      {view === 'find' && !selectedCourse ? (
        <div className="text-center py-12 text-[#b0a8a0]">
          <BookOpen className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="font-bold text-[#7a7169]">팀을 찾을 과목을 선택하세요</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-[#f2eee8] rounded-2xl animate-pulse" />)}
        </div>
      ) : view === 'mine' && myGroups.length === 0 ? (
        <div className="text-center py-12 text-[#b0a8a0]">
          <Users className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="font-bold text-[#7a7169]">아직 소속된 팀이 없습니다</p>
          <button
            onClick={() => onViewChange('find')}
            className="btn-primary mt-5 inline-flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            <span>팀 찾기</span>
          </button>
        </div>
      ) : view === 'find' && courseGroups.length === 0 ? (
        <div className="text-center py-12 text-[#b0a8a0]">
          <Users className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="font-bold text-[#7a7169]">아직 만들어진 팀이 없습니다</p>
          <button
            onClick={onCreateGroup}
            className="btn-primary mt-5 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>팀 생성</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibleGroups.map(group => (
            view === 'mine' ? (
              <GroupCard
                key={group.id}
                group={group}
                isSelected={false}
                onSelect={() => onSelectGroup(group.id)}
              />
            ) : (
              <FindGroupCard
                key={group.id}
                group={group}
                onSelect={() => onSelectGroup(group.id)}
                onJoin={() => onJoinGroup(group.inviteCode)}
              />
            )
          ))}
        </div>
      )}
    </div>
  )
}

function CourseAssignmentPanel({ course }: { course: EcampusCourse }) {
  const assignments = course.assignments ?? []
  const stats = {
    total: assignments.length,
    submitted: assignments.filter(a => a.submitted).length,
    pending: assignments.filter(a => !a.submitted).length,
    urgent: assignments.filter(a => {
      if (a.submitted || !a.deadline) return false
      const d = parseISO(a.deadline)
      return !isPast(d) && differenceInDays(d, new Date()) <= 3
    }).length,
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#4a8768]" />
            <h3 className="font-bold text-[#25231f]">과제 제출 현황</h3>
          </div>
          <p className="mt-1 text-sm text-[#7a7169] truncate">
            {course.courseName}{course.professor ? ` · ${course.professor}` : ''}
          </p>
        </div>
        <span className="text-xs font-bold text-[#b0a8a0] flex-shrink-0">eCampus 동기화</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: '전체', value: stats.total, color: 'text-[#25231f]' },
          { label: '제출', value: stats.submitted, color: 'text-[#4a8768]' },
          { label: '미제출', value: stats.pending, color: 'text-[#a8793d]' },
          { label: '임박', value: stats.urgent, color: 'text-[#6f4141]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-[#e7e0d7] rounded-2xl py-2.5 text-center bg-white/60">
            <p className={`text-xl font-extrabold tracking-tight ${color}`}>{value}</p>
            <p className="text-xs text-[#b0a8a0] font-medium">{label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {assignments.length === 0 ? (
          <div className="text-center py-8 text-[#b0a8a0]">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">등록된 과제가 없습니다</p>
          </div>
        ) : assignments.map(assignment => (
          <div
            key={assignment.assignmentId}
            className="flex items-center justify-between gap-3 rounded-2xl border border-[#e7e0d7] bg-white/70 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#25231f] truncate">{assignment.title}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#b0a8a0]">
                {assignment.deadline && <span>마감 {assignment.deadline.replace('T', ' ').slice(0, 16)}</span>}
                {assignment.submitted && assignment.submittedAt && (
                  <span className="font-bold text-[#4a8768]">제출 {assignment.submittedAt.replace('T', ' ').slice(0, 16)}</span>
                )}
              </div>
            </div>
            <div className="flex-shrink-0">
              <EcampusDeadlineBadge deadline={assignment.deadline} submitted={assignment.submitted} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── HomeTab ───────────────────────────────────────────────────────────────────

function HomeTab({ group, onRefresh }: { group: GroupDetail; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: group.name,
    description: group.description ?? '',
    githubRepoUrl: group.githubRepoUrl ?? '',
    projectDeadline: group.projectDeadline ? group.projectDeadline.substring(0, 16) : '',
  })

  const updateMutation = useMutation({
    mutationFn: () => api.updateGroup(group.id, {
      name: form.name,
      description: form.description || undefined,
      githubRepoUrl: form.githubRepoUrl || null,
      projectDeadline: form.projectDeadline || null,
    }),
    onSuccess: () => { toast.success('저장되었습니다.'); setEditing(false); onRefresh() },
  })

  return (
    <div className="space-y-4">
      {/* Group info card */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-[#25231f]">{group.name}</h2>
            {group.description && <p className="text-[#7a7169] text-sm mt-1">{group.description}</p>}
          </div>
          <button onClick={() => setEditing(!editing)} className="btn-secondary text-xs">
            {editing ? '취소' : '편집'}
          </button>
        </div>

        {editing ? (
          <div className="space-y-3 border-t pt-4">
            <div>
              <label className="text-xs text-[#7a7169] mb-1 block">팀 이름</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-[#7a7169] mb-1 block">설명</label>
              <textarea className="input resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-[#7a7169] mb-1 block">GitHub 레포 URL</label>
              <input className="input" placeholder="https://github.com/..." value={form.githubRepoUrl} onChange={e => setForm(f => ({ ...f, githubRepoUrl: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-[#7a7169] mb-1 block">프로젝트 마감일</label>
              <input type="datetime-local" className="input" value={form.projectDeadline} onChange={e => setForm(f => ({ ...f, projectDeadline: e.target.value }))} />
            </div>
            <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="btn-primary text-sm w-full">
              {updateMutation.isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 text-sm text-[#7a7169]">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{group.members.length}명</span>
            </div>
            {group.githubRepoUrl && (
              <a href={group.githubRepoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#31465d] hover:underline">
                <Github className="w-4 h-4" /><span>GitHub</span>
              </a>
            )}
            {group.projectDeadline && (
              <div className={`flex items-center gap-1 ${isPast(parseISO(group.projectDeadline)) ? 'text-[#6f4141]' : ''}`}>
                <Clock className="w-4 h-4" />
                <span>마감 {format(parseISO(group.projectDeadline), 'MM/dd HH:mm', { locale: ko })}</span>
              </div>
            )}
            <button
              onClick={() => { navigator.clipboard.writeText(group.inviteCode); toast.success('초대코드 복사!') }}
              className="flex items-center gap-1 text-[#4a8768] hover:underline font-bold"
            >
              <Copy className="w-4 h-4" />
              <span>초대코드: {group.inviteCode}</span>
            </button>
          </div>
        )}
      </div>

      {/* Gantt chart */}
      <GanttTab groupId={group.id} members={group.members} />

      {/* Members grid */}
      <div className="card">
        <h3 className="font-bold text-[#25231f] mb-3">팀원 온도</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {group.members.map(m => <MemberCard key={m.userId} member={m} />)}
        </div>
      </div>
    </div>
  )
}

function MemberCard({ member }: { member: TeamMember }) {
  return (
    <div className="border border-[#e7e0d7] rounded-2xl p-4 text-center bg-white/70 hover:bg-white/90 transition-all">
      <div className={`text-2xl font-extrabold tracking-tight ${tempColor(member.temperature)}`}>
        {member.temperature.toFixed(1)}°
      </div>
      <div className="text-sm font-bold text-[#25231f] mt-1">{member.name}</div>
      <div className="text-xs text-[#b0a8a0] mt-0.5">{member.major}</div>
      <span className={`inline-block mt-2.5 text-xs px-2.5 py-1 rounded-full font-bold ${ROLE_COLORS[member.role]}`}>
        {ROLE_LABELS[member.role]}
      </span>
    </div>
  )
}

// ─── AvailabilityTab (When2meet) ───────────────────────────────────────────────

function AvailabilityTab({ groupId, members }: { groupId: number; members: TeamMember[] }) {
  const queryClient = useQueryClient()

  const { data: avail } = useQuery({
    queryKey: ['availability', groupId],
    queryFn: () => api.getAvailability(groupId),
  })

  const [mySlots, setMySlots] = useState<Set<string>>(new Set())
  const [dragging, setDragging] = useState(false)
  const [dragMode, setDragMode] = useState<'add' | 'remove'>('add')

  const slotKey = (day: string, slot: number) => `${day}_${slot}`

  const heatmap = avail?.heatmap ?? {}
  const maxCount = Math.max(...Object.values(heatmap), 1)

  const saveMutation = useMutation({
    mutationFn: () => {
      const slots: AvailabilitySlot[] = Array.from(mySlots).map(k => {
        const [day, s] = k.split('_')
        return { dayOfWeek: day, slot: Number(s) }
      })
      return api.setAvailability(groupId, slots)
    },
    onSuccess: () => {
      toast.success('가능 시간이 저장되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['availability', groupId] })
    },
  })

  const toggleSlot = (day: string, slot: number) => {
    const key = slotKey(day, slot)
    setMySlots(prev => {
      const next = new Set(prev)
      if (dragMode === 'add') next.add(key)
      else next.delete(key)
      return next
    })
  }

  const handleMouseDown = (day: string, slot: number) => {
    const key = slotKey(day, slot)
    setDragMode(mySlots.has(key) ? 'remove' : 'add')
    setDragging(true)
    toggleSlot(day, slot)
  }

  const heatColor = (count: number) => {
    if (count === 0) return 'bg-[#f2eee8]'
    const intensity = count / maxCount
    if (intensity > 0.75) return 'bg-[#4a8768]'
    if (intensity > 0.5) return 'bg-[#6ea88a]'
    if (intensity > 0.25) return 'bg-[#99c4ac]'
    return 'bg-[#c3dece]'
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-[#25231f]">가능 시간 입력</h3>
          <p className="text-xs text-[#b0a8a0]">드래그로 가능한 시간대를 선택하세요</p>
        </div>
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary text-sm">
          {saveMutation.isPending ? '저장 중...' : '저장'}
        </button>
      </div>

      <div
        className="overflow-x-auto select-none"
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
      >
        <table className="w-full text-xs border-collapse table-fixed">
          <thead>
            <tr>
              <th className="w-14 text-[#b0a8a0] font-normal py-1 pr-2 text-right">시간</th>
              {DAYS.map(d => (
                <th key={d} className="text-center text-[#7a7169] font-bold py-1 px-1">{DAY_LABELS[d]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SLOT_COUNT }, (_, slot) => (
              <tr key={slot}>
                <td className="text-right pr-2 text-[#b0a8a0] whitespace-nowrap">
                  {slot % 2 === 0 ? slotToTime(slot) : ''}
                </td>
                {DAYS.map(day => {
                  const key = slotKey(day, slot)
                  const isMine = mySlots.has(key)
                  const count = heatmap[key] ?? 0
                  return (
                    <td
                      key={day}
                      className={`border border-white cursor-pointer transition-colors h-4 ${
                        isMine ? 'bg-[#4a8768]/60' : heatColor(count)
                      }`}
                      onMouseDown={() => handleMouseDown(day, slot)}
                      onMouseEnter={() => { if (dragging) toggleSlot(day, slot) }}
                      title={`${DAY_LABELS[day]} ${slotToTime(slot)} · ${count}명 가능`}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-xs text-[#7a7169]">
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-[#4a8768]/60 rounded" /><span>내 가능 시간</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-[#4a8768] rounded" /><span>모두 가능</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-[#f2eee8] rounded border border-[#e7e0d7]" /><span>불가</span></div>
        <span>· 총 {members.length}명</span>
      </div>
    </div>
  )
}

// ─── RolesTab ──────────────────────────────────────────────────────────────────

type SkillKey = 'skillBackend' | 'skillFrontend' | 'skillAI' | 'skillResearch' | 'skillPresent'

const SKILL_PARTS: { key: SkillKey; label: string; role: MemberRole }[] = [
  { key: 'skillBackend',  label: '백엔드',  role: 'BACKEND' },
  { key: 'skillFrontend', label: '프론트',  role: 'FRONTEND' },
  { key: 'skillAI',       label: 'AI/ML',   role: 'AI' },
  { key: 'skillResearch', label: '자료조사', role: 'RESEARCHER' },
  { key: 'skillPresent',  label: '발표',    role: 'PRESENTER' },
]

function SkillDots({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${i < value ? 'bg-[#4a8768]' : 'bg-[#e7e0d7]'}`}
        />
      ))}
    </div>
  )
}

// Preferred roles exclude LEADER (creator is always leader)
const PREFERRED_ROLE_OPTIONS: MemberRole[] = ['BACKEND', 'FRONTEND', 'AI', 'RESEARCHER', 'PRESENTER']

function RolesTab({ group, onRefresh }: {
  group: GroupDetail; onRefresh: () => void
}) {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore(s => s.user)
  const { members, rolesConfirmed, creatorId } = group
  const myMember = members.find(m => m.studentId === currentUser?.student_id)
  const isCreator = myMember?.userId === creatorId
  const allReady = members.every(m => m.preferenceReady)

  const allRoles: MemberRole[] = ['LEADER', 'RESEARCHER', 'PRESENTER', 'BACKEND', 'FRONTEND', 'AI']

  const [pref, setPref] = useState({
    preferredRole: (myMember?.preferredRole ?? null) as MemberRole | null,
    leadershipWilling: myMember?.leadershipWilling ?? false,
    prConfident: myMember?.prConfident ?? false,
    skillBackend:  myMember?.skillBackend  ?? 3,
    skillFrontend: myMember?.skillFrontend ?? 3,
    skillAI:       myMember?.skillAI       ?? 3,
    skillResearch: myMember?.skillResearch ?? 3,
    skillPresent:  myMember?.skillPresent  ?? 3,
  })

  const readyMutation = useMutation({
    mutationFn: async () => {
      await api.updatePreference(group.id, pref)
      return api.markReady(group.id)
    },
    onSuccess: () => {
      toast.success('준비 완료! 팀장이 확정할 때까지 기다려주세요.')
      queryClient.invalidateQueries({ queryKey: ['group', group.id] })
      onRefresh()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? '준비 완료 처리에 실패했습니다.')
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () => api.confirmRoles(group.id),
    onSuccess: () => {
      toast.success('역할이 확정되었습니다!')
      queryClient.invalidateQueries({ queryKey: ['group', group.id] })
      onRefresh()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? '역할 확정에 실패했습니다.')
    },
  })

  const assignMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: number; role: MemberRole }) =>
      api.assignRole(group.id, memberId, role),
    onSuccess: () => { toast.success('역할이 변경되었습니다.'); onRefresh() },
    onError: () => toast.error('역할 변경에 실패했습니다.'),
  })

  const radarData = (m: TeamMember) => [
    { subject: '기여', value: m.selfContributing * 20 },
    { subject: '소통', value: m.selfInteracting * 20 },
    { subject: '일정', value: m.selfKeepingOnTrack * 20 },
    { subject: '품질', value: m.selfExpectingQuality * 20 },
    { subject: '역량', value: m.selfKnowledgeSkills * 20 },
  ]

  return (
    <div className="space-y-4">
      {/* ── 내 선호도 입력 카드 (rolesConfirmed 전에만 표시) ── */}
      {myMember && !rolesConfirmed && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[#25231f]">내 선호도 입력</h3>
              <p className="text-xs text-[#b0a8a0]">
                {myMember.preferenceReady
                  ? '✓ 준비 완료 — 팀장이 확정을 누르면 역할이 배분됩니다'
                  : '선호 조건을 입력하고 준비 완료를 눌러주세요'}
              </p>
            </div>
            {myMember.preferenceReady && (
              <span className="px-3 py-1 rounded-full bg-[#4a8768]/12 text-[#4a8768] text-xs font-bold">준비됨</span>
            )}
          </div>

          {/* 선호도 폼 — 준비 완료 전에만 입력 가능 */}
          {!myMember.preferenceReady && (
            <div className="space-y-5 border-t border-[#e7e0d7] pt-4">
              {/* 선호 역할 (LEADER 제외) */}
              <div>
                <p className="text-sm font-bold text-[#25231f] mb-2">선호 역할</p>
                <div className="flex flex-wrap gap-2">
                  {PREFERRED_ROLE_OPTIONS.map(r => (
                    <button
                      key={r}
                      onClick={() => setPref(p => ({ ...p, preferredRole: p.preferredRole === r ? null : r }))}
                      className={`px-3.5 py-1.5 rounded-full text-sm font-bold border-2 transition-all ${
                        pref.preferredRole === r
                          ? 'border-[#4a8768] bg-[#4a8768]/10 text-[#4a8768]'
                          : 'border-[#e7e0d7] text-[#7a7169] hover:border-[#d0c8bf]'
                      }`}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 리더십 / PR 여부 */}
              <div>
                <p className="text-sm font-bold text-[#25231f] mb-2">추가 사항</p>
                <div className="flex gap-3 flex-wrap">
                  {[
                    { key: 'leadershipWilling' as const, label: '리더 역할 가능' },
                    { key: 'prConfident' as const, label: 'PR/발표 자신 있음' },
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => setPref(p => ({ ...p, [item.key]: !p[item.key] }))}
                      className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-all ${
                        pref[item.key]
                          ? 'border-[#4a8768] bg-[#4a8768]/10 text-[#4a8768]'
                          : 'border-[#e7e0d7] text-[#7a7169] hover:border-[#d0c8bf]'
                      }`}
                    >
                      {pref[item.key] ? '✓ ' : ''}{item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 파트별 숙련도 */}
              <div>
                <p className="text-sm font-bold text-[#25231f] mb-2">파트별 숙련도</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SKILL_PARTS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-[#7a7169] w-16 font-medium">{label}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(v => (
                          <button
                            key={v}
                            onClick={() => setPref(p => ({ ...p, [key]: v }))}
                            className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                              (pref[key] as number) >= v
                                ? 'bg-[#4a8768] text-white'
                                : 'bg-[#f2eee8] text-[#b0a8a0]'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => readyMutation.mutate()}
                disabled={readyMutation.isPending}
                className="btn-primary w-full"
              >
                {readyMutation.isPending ? '처리 중...' : '준비 완료'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 팀원 준비 현황 (rolesConfirmed 전) ── */}
      {!rolesConfirmed && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[#25231f]">팀원 준비 현황</h3>
              <p className="text-xs text-[#b0a8a0]">
                {members.filter(m => m.preferenceReady).length}/{members.length}명 준비 완료
              </p>
            </div>
            {isCreator && allReady && (
              <button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                className="btn-primary text-sm"
              >
                {confirmMutation.isPending ? '처리 중...' : 'OK 확정'}
              </button>
            )}
            {isCreator && !allReady && (
              <span className="text-xs text-[#b0a8a0]">모든 팀원이 준비되면 확정할 수 있습니다</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {members.map(m => (
              <div key={m.userId} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold ${
                m.preferenceReady
                  ? 'border-[#4a8768] bg-[#4a8768]/10 text-[#4a8768]'
                  : 'border-[#e7e0d7] bg-white/70 text-[#b0a8a0]'
              }`}>
                <span>{m.preferenceReady ? '✓' : '○'}</span>
                <span>{m.name}</span>
                {m.userId === creatorId && <span className="text-xs opacity-70">(방장)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 팀원 역량 현황 ── */}
      <div className="card space-y-3">
        <div>
          <h3 className="font-bold text-[#25231f]">팀원 역량 현황</h3>
          <p className="text-xs text-[#b0a8a0]">
            {rolesConfirmed
              ? '역할이 확정되었습니다'
              : '팀원들의 선호도와 역량을 바탕으로 역할을 배분하세요'}
          </p>
        </div>

        <div className="grid gap-4">
          {members.map(m => {
            const addRoles = m.additionalRoles
              ? m.additionalRoles.split(',').filter(Boolean) as MemberRole[]
              : []
            const isAssigned = m.role !== 'UNASSIGNED'
            return (
              <div key={m.userId} className="p-4 border border-[#e7e0d7] rounded-2xl bg-white/60 space-y-3">
                {/* 이름 행 */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#25231f]">{m.name}</span>
                      <span className={`text-sm font-extrabold ${tempColor(m.temperature)}`}>
                        {m.temperature.toFixed(1)}°
                      </span>
                      {m.preferenceReady && !rolesConfirmed && (
                        <span className="text-xs text-[#4a8768] font-bold">✓ 준비됨</span>
                      )}
                    </div>
                    <p className="text-xs text-[#b0a8a0] mt-0.5">{m.major} · {m.studentId}</p>
                  </div>

                  {/* 역할 직접 배정 select (확정 전만) */}
                  {!rolesConfirmed && (
                    <select
                      className="input text-sm py-1.5 w-28 flex-shrink-0"
                      value={m.role}
                      onChange={e => assignMutation.mutate({ memberId: m.memberId, role: e.target.value as MemberRole })}
                    >
                      {allRoles.map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 역할 행: 선호 / 배정 분리 */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  {/* 선호역할 — 본인이 입력한 것 */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#b0a8a0] font-medium">선호</span>
                    {m.preferredRole ? (
                      <span className="px-2.5 py-0.5 rounded-full border-2 border-dashed border-[#b0a8a0] text-[#7a7169] text-xs font-bold">
                        {ROLE_LABELS[m.preferredRole]}
                      </span>
                    ) : (
                      <span className="text-xs text-[#d0c8bf]">미입력</span>
                    )}
                  </div>

                  {/* 배정역할 — 시스템 또는 수동 배정 결과 */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-[#b0a8a0] font-medium">배정</span>
                    {isAssigned ? (
                      <>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${ROLE_COLORS[m.role]}`}>
                          {ROLE_LABELS[m.role]}
                        </span>
                        {addRoles.map(r => (
                          <span key={r} className={`px-2.5 py-0.5 rounded-full text-xs font-bold border border-dashed ${ROLE_COLORS[r as MemberRole]}`}>
                            +{ROLE_LABELS[r as MemberRole]}
                          </span>
                        ))}
                      </>
                    ) : (
                      <span className="text-xs text-[#d0c8bf]">미배정</span>
                    )}
                  </div>

                  {/* 부가 뱃지 */}
                  {m.leadershipWilling && (
                    <span className="badge bg-[#a8793d]/15 text-[#a8793d]">리더 가능</span>
                  )}
                  {m.prConfident && (
                    <span className="badge bg-[#31465d]/12 text-[#31465d]">PR 자신</span>
                  )}
                </div>

                {/* 스킬바 + 레이더 */}
                <div className="flex gap-4 items-center">
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                    {SKILL_PARTS.map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-[#b0a8a0] w-12">{label}</span>
                        <SkillDots value={m[key] as number} />
                      </div>
                    ))}
                  </div>
                  <div className="w-24 h-24 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData(m)} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 7 }} />
                        <Radar dataKey="value" fill="#4a8768" fillOpacity={0.45} stroke="#4a8768" />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── TasksTab ─────────────────────────────────────────────────────────────────

export function _TasksTab({ groupId, members }: { groupId: number; members: TeamMember[] }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null)
  const [form, setForm] = useState({ title: '', description: '', assigneeId: '', startDate: '', deadline: '', progress: 0 })

  const resetForm = () => setForm({ title: '', description: '', assigneeId: '', startDate: '', deadline: '', progress: 0 })

  const { data: tasks = [] } = useQuery<ProjectTask[]>({
    queryKey: ['tasks', groupId],
    queryFn: () => api.getTasks(groupId),
  })

  const createMutation = useMutation({
    mutationFn: () => api.createTask(groupId, {
      title: form.title,
      description: form.description || undefined,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : undefined,
      startDate: form.startDate || undefined,
      deadline: form.deadline || undefined,
    }),
    onSuccess: () => {
      toast.success('과제가 생성되었습니다.')
      setShowForm(false)
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['tasks', groupId] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ taskId, ...request }: { taskId: number } & UpdateTaskRequest) =>
      api.updateTask(taskId, request),
    onSuccess: () => {
      toast.success('과제가 수정되었습니다.')
      setEditingTask(null)
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['tasks', groupId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => api.deleteTask(taskId),
    onSuccess: () => {
      toast.success('과제가 삭제되었습니다.')
      setEditingTask(null)
      queryClient.invalidateQueries({ queryKey: ['tasks', groupId] })
    },
  })

  const submitMutation = useMutation({
    mutationFn: ({ taskId, file }: { taskId: number; file?: File }) => api.submitTask(taskId, file),
    onSuccess: () => { toast.success('제출되었습니다.'); queryClient.invalidateQueries({ queryKey: ['tasks', groupId] }) },
  })

  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: TaskStatus }) =>
      api.updateTaskStatus(taskId, status),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks', groupId] }) },
  })

  const progressMutation = useMutation({
    mutationFn: ({ taskId, progress }: { taskId: number; progress: number }) =>
      api.updateTaskProgress(taskId, progress),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks', groupId] }) },
  })

  const handleEdit = (task: ProjectTask) => {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description || '',
      assigneeId: task.assigneeId ? String(task.assigneeId) : '',
      startDate: task.startDate ? task.startDate.substring(0, 16) : '',
      deadline: task.deadline ? task.deadline.substring(0, 16) : '',
      progress: task.progress || 0,
    })
    setShowForm(false)
  }

  const handleSubmit = () => {
    if (editingTask) {
      updateMutation.mutate({
        taskId: editingTask.id,
        title: form.title,
        description: form.description || undefined,
        assigneeId: form.assigneeId ? Number(form.assigneeId) : undefined,
        startDate: form.startDate || undefined,
        deadline: form.deadline || undefined,
        progress: form.progress,
      })
    } else {
      createMutation.mutate()
    }
  }

  const pending = tasks.filter(t => t.status === 'PENDING' || t.status === 'SUBMITTED' || t.status === 'LATE')
  const done = tasks.filter(t => t.status === 'APPROVED' || t.status === 'REJECTED')

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#25231f]">과제 관리</h3>
        <button onClick={() => { setShowForm(v => !v); setEditingTask(null); resetForm() }} className="btn-primary text-sm flex items-center gap-1">
          <Plus className="w-4 h-4" /><span>과제 추가</span>
        </button>
      </div>

      {(showForm || editingTask) && (
        <div className="border border-dashed border-[#4a8768]/40 rounded-2xl p-4 space-y-3 bg-[#4a8768]/6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#25231f]">{editingTask ? '과제 수정' : '새 과제 추가'}</span>
          </div>
          <input className="input" placeholder="과제 제목" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <textarea className="input resize-none" rows={2} placeholder="설명 (선택)" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <select className="input" value={form.assigneeId} onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))}>
            <option value="">담당자 선택 (선택)</option>
            {members.map(m => <option key={m.userId} value={String(m.userId)}>{m.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#7a7169] block mb-1">시작일</label>
              <input type="datetime-local" className="input" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-[#7a7169] block mb-1">마감일</label>
              <input type="datetime-local" className="input" value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
          </div>
          {editingTask && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[#7a7169]">진행률</span>
                <span className="font-bold text-[#4a8768]">{form.progress}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={form.progress}
                onChange={e => setForm(f => ({ ...f, progress: Number(e.target.value) }))}
                className="w-full accent-[#4a8768]"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={!form.title || createMutation.isPending || updateMutation.isPending} className="btn-primary text-sm flex-1">
              {createMutation.isPending || updateMutation.isPending ? '저장 중...' : editingTask ? '수정' : '생성'}
            </button>
            {editingTask && (
              <button onClick={() => deleteMutation.mutate(editingTask.id)} disabled={deleteMutation.isPending} className="btn-secondary text-sm text-[#6f4141]">
                {deleteMutation.isPending ? '삭제 중...' : '삭제'}
              </button>
            )}
            <button onClick={() => { setShowForm(false); setEditingTask(null); resetForm() }} className="btn-secondary text-sm">취소</button>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <p className="text-xs text-[#b0a8a0] uppercase tracking-wider mb-2 font-bold">진행중</p>
          <div className="space-y-2">
            {pending.map(t => (
              <TaskRow key={t.id} task={t}
                onSubmit={(file) => submitMutation.mutate({ taskId: t.id, file })}
                onApprove={() => statusMutation.mutate({ taskId: t.id, status: 'APPROVED' })}
                onReject={() => statusMutation.mutate({ taskId: t.id, status: 'REJECTED' })}
                onEdit={() => handleEdit(t)}
                onDelete={() => deleteMutation.mutate(t.id)}
                onProgressChange={(progress) => progressMutation.mutate({ taskId: t.id, progress })}
              />
            ))}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div>
          <p className="text-xs text-[#b0a8a0] uppercase tracking-wider mb-2 font-bold">완료</p>
          <div className="space-y-2 opacity-60">
            {done.map(t => (
              <TaskRow key={t.id} task={t} onSubmit={(_f) => {}} onApprove={() => {}} onReject={() => {}} onEdit={() => handleEdit(t)} onDelete={() => deleteMutation.mutate(t.id)} onProgressChange={() => {}} />
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && !showForm && (
        <div className="text-center py-8 text-[#b0a8a0]">
          <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">과제가 없습니다</p>
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, onSubmit, onApprove, onReject, onEdit, onDelete, onProgressChange }: {
  task: ProjectTask; onSubmit: (file?: File) => void; onApprove: () => void; onReject: () => void; onEdit: () => void; onDelete: () => void; onProgressChange: (progress: number) => void
}) {
  const [selectedFile, setSelectedFile] = useState<File | undefined>()
  const [showFileInput, setShowFileInput] = useState(false)
  const [showProgressSlider, setShowProgressSlider] = useState(false)
  const [localProgress, setLocalProgress] = useState(task.progress || 0)
  const deadlinePassed = task.deadline && isPast(parseISO(task.deadline))
  const hoursLeft = task.deadline ? differenceInHours(parseISO(task.deadline), new Date()) : null
  const urgent = hoursLeft !== null && hoursLeft < 24 && hoursLeft > 0
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

  return (
    <div className={`p-3.5 border rounded-2xl space-y-2 transition-all ${urgent ? 'border-[#a8793d]/40 bg-[#a8793d]/6' : 'border-[#e7e0d7] bg-white/60'}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-[#25231f] truncate">{task.title}</span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${TASK_STATUS_COLORS[task.status]}`}>
              {TASK_STATUS_LABELS[task.status]}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#4a8768]/12 text-[#4a8768] font-bold">
              {task.progress || 0}%
            </span>
            {urgent && <AlertTriangle className="w-3.5 h-3.5 text-[#a8793d] flex-shrink-0" />}
          </div>
          <div className="flex gap-3 mt-1 text-xs text-[#b0a8a0] flex-wrap">
            {task.assigneeName && <span>담당: {task.assigneeName}</span>}
            {task.startDate && <span>시작: {format(parseISO(task.startDate), 'MM/dd HH:mm')}</span>}
            {task.deadline && (
              <span className={deadlinePassed && task.status === 'PENDING' ? 'text-[#6f4141]' : ''}>
                마감: {format(parseISO(task.deadline), 'MM/dd HH:mm')}
              </span>
            )}
            {task.submittedAt && <span>제출: {format(parseISO(task.submittedAt), 'MM/dd HH:mm')}</span>}
            {task.fileName && (
              <a
                href={`${API_BASE}${task.fileUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4a8768] hover:underline truncate max-w-[160px] font-bold"
                title={task.fileName}
              >
                📎 {task.fileName}
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {task.status === 'PENDING' && (
            <>
              <button onClick={onEdit} className="text-xs py-1 px-2 text-[#7a7169] hover:text-[#25231f]" title="수정">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={onDelete} className="text-xs py-1 px-2 text-[#b0a8a0] hover:text-[#6f4141]" title="삭제">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowProgressSlider(v => !v)}
                className="text-xs py-1 px-3 bg-[#31465d]/10 text-[#31465d] rounded-full font-bold hover:bg-[#31465d]/20"
              >
                진행률
              </button>
              <button
                onClick={() => setShowFileInput(v => !v)}
                className="btn-primary text-xs py-1 px-3"
              >
                제출
              </button>
            </>
          )}
          {(task.status === 'SUBMITTED' || task.status === 'LATE') && (
            <>
              <button onClick={onEdit} className="text-xs py-1 px-2 text-[#7a7169] hover:text-[#25231f]" title="수정">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={onApprove} className="text-xs py-1 px-3 bg-[#4a8768]/12 text-[#4a8768] rounded-full font-bold hover:bg-[#4a8768]/20">승인</button>
              <button onClick={onReject} className="text-xs py-1 px-3 bg-[#f2eee8] text-[#7a7169] rounded-full font-bold hover:bg-[#e7e0d7]">반려</button>
            </>
          )}
        </div>
      </div>

      {/* Progress slider */}
      {showProgressSlider && task.status === 'PENDING' && (
        <div className="flex items-center gap-3 pt-2 border-t border-[#e7e0d7]">
          <span className="text-xs text-[#7a7169]">진행률</span>
          <input
            type="range" min={0} max={100} value={localProgress}
            onChange={e => setLocalProgress(Number(e.target.value))}
            className="flex-1 accent-[#4a8768]"
          />
          <span className="text-xs font-bold text-[#4a8768] w-10">{localProgress}%</span>
          <button
            onClick={() => { onProgressChange(localProgress); setShowProgressSlider(false) }}
            className="btn-primary text-xs py-1 px-3"
          >
            저장
          </button>
          <button onClick={() => { setShowProgressSlider(false); setLocalProgress(task.progress || 0) }} className="text-xs text-[#b0a8a0] hover:text-[#7a7169]">취소</button>
        </div>
      )}

      {showFileInput && task.status === 'PENDING' && (
        <div className="flex items-center gap-2 pt-2 border-t border-[#e7e0d7]">
          <label className="flex-1 flex items-center gap-2 cursor-pointer text-sm text-[#7a7169] bg-[#f2eee8] border border-dashed border-[#d0c8bf] rounded-xl px-3 py-2 hover:bg-[#e7e0d7]">
            <span>📎</span>
            <span className="truncate">{selectedFile ? selectedFile.name : '파일 선택 (선택사항)'}</span>
            <input
              type="file"
              className="hidden"
              onChange={e => setSelectedFile(e.target.files?.[0])}
            />
          </label>
          <button
            onClick={() => { onSubmit(selectedFile); setShowFileInput(false); setSelectedFile(undefined) }}
            className="btn-primary text-xs py-2 px-3 flex-shrink-0"
          >
            확인
          </button>
          <button onClick={() => { setShowFileInput(false); setSelectedFile(undefined) }} className="text-xs text-[#b0a8a0] hover:text-[#7a7169]">취소</button>
        </div>
      )}
    </div>
  )
}

// ─── ReviewTab ────────────────────────────────────────────────────────────────

function ReviewTab({ groupId, members }: { groupId: number; members: TeamMember[] }) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<TeamMember | null>(null)
  const [scores, setScores] = useState({
    contributionScore: 20,
    contributing: 3,
    interacting: 3,
    keepingOnTrack: 3,
    expectingQuality: 3,
    knowledgeSkills: 3,
    comment: '',
  })

  const { data: summary } = useQuery({
    queryKey: ['reviews', groupId],
    queryFn: () => api.getPeerReviewSummary(groupId),
  })

  const submitMutation = useMutation({
    mutationFn: () => {
      const req: PeerReviewRequest = { revieweeId: selected!.userId, ...scores }
      return api.submitPeerReview(groupId, req)
    },
    onSuccess: () => {
      toast.success('동료평가가 제출되었습니다.')
      setSelected(null)
      queryClient.invalidateQueries({ queryKey: ['reviews', groupId] })
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message ?? '제출에 실패했습니다.')
    },
  })

  const dimensions = [
    { key: 'contributing', label: '기여도' },
    { key: 'interacting', label: '소통' },
    { key: 'keepingOnTrack', label: '일정관리' },
    { key: 'expectingQuality', label: '품질추구' },
    { key: 'knowledgeSkills', label: '역량' },
  ] as const

  return (
    <div className="card space-y-6">
      <div>
        <h3 className="font-bold text-[#25231f]">동료 평가</h3>
        <p className="text-xs text-[#b0a8a0]">팀원들의 기여도와 5가지 역량을 평가해주세요</p>
      </div>

      {/* Member selector */}
      <div>
        <p className="text-sm text-[#7a7169] mb-2 font-medium">평가할 팀원 선택</p>
        <div className="flex flex-wrap gap-2">
          {members.map(m => (
            <button
              key={m.userId}
              onClick={() => setSelected(prev => prev?.userId === m.userId ? null : m)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-bold border-2 transition-all ${
                selected?.userId === m.userId
                  ? 'border-[#4a8768] bg-[#4a8768]/10 text-[#4a8768]'
                  : 'border-[#e7e0d7] hover:border-[#d0c8bf] text-[#7a7169]'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="space-y-4 border-t border-[#e7e0d7] pt-4">
          <p className="font-bold text-[#25231f]">{selected.name} 평가</p>

          {/* Contribution score */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[#7a7169] font-medium">기여도 점수</span>
              <span className="font-extrabold text-[#4a8768]">{scores.contributionScore}점</span>
            </div>
            <input
              type="range" min={0} max={100} value={scores.contributionScore}
              onChange={e => setScores(s => ({ ...s, contributionScore: Number(e.target.value) }))}
              className="w-full accent-[#4a8768]"
            />
            <p className="text-xs text-[#b0a8a0]">팀원 기여도 합계 100점 기준</p>
          </div>

          {/* 5 dimension sliders */}
          {dimensions.map(d => (
            <div key={d.key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[#7a7169] font-medium">{d.label}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button
                      key={v}
                      onClick={() => setScores(s => ({ ...s, [d.key]: v }))}
                      className={`w-7 h-7 rounded-full text-sm font-bold transition-all ${
                        scores[d.key] >= v ? 'bg-[#4a8768] text-white' : 'bg-[#f2eee8] text-[#b0a8a0]'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Comment */}
          <div>
            <label className="text-sm text-[#7a7169] font-medium block mb-1">코멘트 (선택)</label>
            <textarea
              className="input resize-none text-sm"
              rows={3}
              placeholder="자유롭게 피드백을 남겨주세요..."
              value={scores.comment}
              onChange={e => setScores(s => ({ ...s, comment: e.target.value }))}
            />
          </div>

          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="btn-primary w-full"
          >
            {submitMutation.isPending ? '제출 중...' : '동료평가 제출'}
          </button>
        </div>
      )}

      {/* Summary */}
      {summary && summary.memberScores.length > 0 && (
        <div className="border-t border-[#e7e0d7] pt-4">
          <p className="text-sm font-bold text-[#25231f] mb-3">평가 결과</p>
          <div className="space-y-3">
            {summary.memberScores.map(ms => (
              <div key={ms.userId} className="flex items-center gap-4 p-3.5 border border-[#e7e0d7] rounded-2xl bg-white/60">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#25231f]">{ms.name}</span>
                    {ms.suspectedFreeRider && (
                      <span className="text-xs bg-[#6f4141]/12 text-[#6f4141] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />무임승차 의심
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#b0a8a0] mt-0.5">
                    평균 기여도: {ms.avgContributionScore.toFixed(0)}점 · {ms.reviewCount}명 평가
                  </p>
                </div>
                <div className="text-right">
                  <div className="w-20 h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart
                        data={[
                          { subject: '기여', value: ms.avgContributing * 20 },
                          { subject: '소통', value: ms.avgInteracting * 20 },
                          { subject: '일정', value: ms.avgKeepingOnTrack * 20 },
                          { subject: '품질', value: ms.avgExpectingQuality * 20 },
                          { subject: '역량', value: ms.avgKnowledgeSkills * 20 },
                        ]}
                        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                      >
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 7 }} />
                        <Radar dataKey="value" fill="#4a8768" fillOpacity={0.45} stroke="#4a8768" />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function CreateGroupModal({ course, onClose, onCreated }: {
  course: EcampusCourse | null; onClose: () => void; onCreated: (id: number) => void
}) {
  const [form, setForm] = useState({ name: '', description: '', githubRepoUrl: '', projectDeadline: '' })

  const createMutation = useMutation({
    mutationFn: () => api.createGroup({
      name: form.name,
      description: form.description || undefined,
      githubRepoUrl: form.githubRepoUrl || undefined,
      projectDeadline: form.projectDeadline || undefined,
      ecampusCourseId: course?.courseId,
      courseName: course?.courseName,
      professor: course?.professor,
    }),
    onSuccess: (data) => {
      toast.success(`팀 생성! 초대코드: ${data.inviteCode}`)
      onCreated(data.groupId)
    },
  })

  return (
    <Modal title="새 팀 생성" onClose={onClose}>
      <div className="space-y-3">
        {course && (
          <div className="rounded-2xl border border-[#e7e0d7] bg-[#f2eee8]/50 px-3 py-2">
            <p className="text-xs font-bold text-[#7a7169]">선택 과목</p>
            <p className="text-sm font-extrabold text-[#25231f] truncate">{course.courseName}</p>
          </div>
        )}
        <input className="input" placeholder="팀 이름 *" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
        <textarea className="input resize-none" rows={2} placeholder="팀 설명 (선택)"
          value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <input className="input" placeholder="GitHub 레포 URL (선택)" value={form.githubRepoUrl}
          onChange={e => setForm(f => ({ ...f, githubRepoUrl: e.target.value }))} />
        <div>
          <label className="text-xs text-gray-500 block mb-1">프로젝트 마감일 (선택)</label>
          <input type="datetime-local" className="input" value={form.projectDeadline}
            onChange={e => setForm(f => ({ ...f, projectDeadline: e.target.value }))} />
        </div>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!form.name || createMutation.isPending}
          className="btn-primary w-full"
        >
          {createMutation.isPending ? '생성 중...' : '팀 생성'}
        </button>
      </div>
    </Modal>
  )
}

function JoinGroupModal({ onClose, onJoined }: {
  onClose: () => void; onJoined: () => void
}) {
  const [code, setCode] = useState('')

  const joinMutation = useMutation({
    mutationFn: () => api.joinGroup({ inviteCode: code.toUpperCase() }),
    onSuccess: () => { toast.success('팀에 참가했습니다!'); onJoined() },
    onError: () => toast.error('유효하지 않은 초대코드입니다.'),
  })

  return (
    <Modal title="팀 참가" onClose={onClose}>
      <div className="space-y-3">
        <input
          className="input text-center text-2xl font-bold tracking-widest"
          placeholder="초대코드 입력"
          maxLength={6}
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          autoFocus
        />
        <button
          onClick={() => joinMutation.mutate()}
          disabled={code.length < 1 || joinMutation.isPending}
          className="btn-primary w-full"
        >
          {joinMutation.isPending ? '참가 중...' : '참가하기'}
        </button>
      </div>
    </Modal>
  )
}

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="rounded-[28px] p-6 max-w-md w-full"
        style={{
          background: 'rgba(255,255,255,0.95)',
          boxShadow: '0 24px 64px rgba(38,32,25,0.18)',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold tracking-tight text-[#25231f]">{title}</h2>
          <button onClick={onClose} className="text-[#b0a8a0] hover:text-[#7a7169] p-1 rounded-full hover:bg-[#f2eee8] transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── TimetableTab ────────────────────────────────────────────────────────────

export function _TimetableTab() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')

  const { data: timetables = [], isLoading } = useQuery({
    queryKey: ['timetables'],
    queryFn: () => api.getTimetables(),
  })

  const { data: detail } = useQuery({
    queryKey: ['timetable', selectedId],
    queryFn: () => api.getTimetable(selectedId!),
    enabled: !!selectedId,
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createTimetable({ name }),
    onSuccess: (data) => {
      toast.success('시간표 생성!')
      queryClient.invalidateQueries({ queryKey: ['timetables'] })
      setSelectedId(data.timetable_id)
      setIsCreating(false)
      setNewName('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteTimetable(id),
    onSuccess: () => {
      toast.success('삭제됨')
      queryClient.invalidateQueries({ queryKey: ['timetables'] })
      setSelectedId(null)
    },
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.updateTimetableName(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetables'] })
      setEditingId(null)
    },
  })

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#4a8768]" />
          <h3 className="font-bold text-[#25231f]">내 시간표</h3>
        </div>
        <button onClick={() => setIsCreating(v => !v)} className="btn-primary text-sm flex items-center gap-1">
          <Plus className="w-4 h-4" />새 시간표
        </button>
      </div>

      {isCreating && (
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="시간표 이름"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newName && createMutation.mutate(newName)}
            autoFocus
          />
          <button onClick={() => createMutation.mutate(newName)} disabled={!newName} className="btn-primary text-sm">생성</button>
          <button onClick={() => { setIsCreating(false); setNewName('') }} className="btn-secondary text-sm">취소</button>
        </div>
      )}

      {/* 시간표 목록 */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-10 bg-[#f2eee8] rounded-xl animate-pulse" />)}</div>
      ) : timetables.length === 0 ? (
        <p className="text-center py-8 text-[#b0a8a0] text-sm">시간표가 없습니다</p>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {timetables.map((t: Timetable) => (
            <div
              key={t.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 cursor-pointer transition-all font-bold text-sm ${
                selectedId === t.id ? 'border-[#4a8768] bg-[#4a8768]/10 text-[#4a8768]' : 'border-[#e7e0d7] hover:border-[#d0c8bf] text-[#7a7169]'
              }`}
              onClick={() => setSelectedId(t.id)}
            >
              {editingId === t.id ? (
                <input
                  className="text-sm border-none outline-none bg-transparent w-24"
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') renameMutation.mutate({ id: t.id, name: editingName })
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onClick={e => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span className="text-sm">{t.name}</span>
              )}
              <button
                onClick={e => { e.stopPropagation(); setEditingId(t.id); setEditingName(t.name) }}
                className="text-gray-400 hover:text-gray-600"
              ><Edit2 className="w-3 h-3" /></button>
              <button
                onClick={e => { e.stopPropagation(); deleteMutation.mutate(t.id) }}
                className="text-gray-400 hover:text-red-500"
              ><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}

      {/* 시간표 그리드 */}
      {detail && detail.items && (
        <TimetableGrid items={detail.items} />
      )}
      {selectedId && !detail && (
        <div className="h-40 bg-[#f2eee8] rounded-2xl animate-pulse" />
      )}
    </div>
  )
}

function EcampusDeadlineBadge({ deadline, submitted }: { deadline: string | null; submitted: boolean }) {
  if (submitted) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
      <CheckCircle2 className="w-3 h-3" />제출완료
    </span>
  )
  if (!deadline) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
      <AlertCircle className="w-3 h-3" />마감미정
    </span>
  )
  const d = parseISO(deadline)
  if (isPast(d)) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
      <XCircle className="w-3 h-3" />기한초과
    </span>
  )
  const days = differenceInDays(d, new Date())
  const hours = differenceInHours(d, new Date())
  if (hours < 24) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 animate-pulse">
      <Clock className="w-3 h-3" />{hours}시간
    </span>
  )
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${days <= 3 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
      <Clock className="w-3 h-3" />D-{days}
    </span>
  )
}

// ─── AiAnalysisTab ────────────────────────────────────────────────────────────

const DEMO_CHAT_DATA: Record<string, { messages: number; avgResponseH: number; orchRate: number; commScore: number; progressScore: number }> = {
  '정리더':  { messages: 38, avgResponseH: 0.7, orchRate: 0.89, commScore: 3, progressScore: 3 },
  '홍에이스': { messages: 28, avgResponseH: 1.0, orchRate: 0.86, commScore: 5, progressScore: 5 },
  '이소통':  { messages: 22, avgResponseH: 0.3, orchRate: 0.77, commScore: 5, progressScore: 5 },
  '박묵묵':  { messages: 19, avgResponseH: 1.7, orchRate: 0.79, commScore: 5, progressScore: 5 },
  '최마감':  { messages: 18, avgResponseH: 1.2, orchRate: 0.83, commScore: 3, progressScore: 3 },
  '김무임':  { messages: 20, avgResponseH: 1.6, orchRate: 0.60, commScore: 1, progressScore: 1 },
}

const MEMBER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

function AiAnalysisTab({ groupId, groupName }: { groupId: number; groupName: string; members: TeamMember[] }) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['reviews', groupId],
    queryFn: () => api.getPeerReviewSummary(groupId),
  })

  const isDemo = groupName === '스마트 홈 관리 시스템'
  const scores: MemberScore[] = summary?.memberScores ?? []
  const freeRiders = scores.filter(s => s.suspectedFreeRider)
  const sortedByContrib = [...scores].sort((a, b) => b.avgContributionScore - a.avgContributionScore)

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 rounded-full border-2 border-[#e6c49a] border-t-transparent animate-spin" />
    </div>
  )

  if (scores.length === 0 || scores.every(s => s.reviewCount === 0)) {
    return (
      <div className="card text-center py-16 text-[#b0a8a0]">
        <div className="text-4xl mb-3">🤖</div>
        <p className="font-semibold text-lg text-[#8a8078] mb-1">아직 분석 데이터가 없어요</p>
        <p className="text-sm">동료 평가가 완료되면 AI 분석 결과를 확인할 수 있습니다.</p>
      </div>
    )
  }

  const radarData = (ms: MemberScore) => [
    { dim: '기여', score: ms.avgContributing },
    { dim: '소통', score: ms.avgInteracting },
    { dim: '일정', score: ms.avgKeepingOnTrack },
    { dim: '품질', score: ms.avgExpectingQuality },
    { dim: '역량', score: ms.avgKnowledgeSkills },
  ]

  const avgScore = (ms: MemberScore) =>
    (ms.avgContributing + ms.avgInteracting + ms.avgKeepingOnTrack + ms.avgExpectingQuality + ms.avgKnowledgeSkills) / 5

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🤖</span>
          <div>
            <h3 className="font-bold text-lg text-[#25231f]">AI 팀 분석</h3>
            <p className="text-sm text-[#8a8078]">동료 평가 데이터를 기반으로 기여도와 역량을 분석합니다.</p>
          </div>
        </div>
      </div>

      {/* 무임승차 탐지 */}
      {freeRiders.length > 0 && (
        <div className="card p-4 bg-red-50 border border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-red-700">무임승차 의심 탐지됨</p>
              {freeRiders.map(fr => (
                <div key={fr.userId} className="flex flex-wrap items-center gap-2 text-sm text-red-600">
                  <span className="font-semibold">{fr.name}</span>
                  <span>·</span>
                  <span>평균 기여도 {fr.avgContributionScore.toFixed(1)}%</span>
                  <span>·</span>
                  <span>동료 평가 {avgScore(fr).toFixed(1)}/5</span>
                  <span>·</span>
                  <span>{fr.reviewCount}명 평가</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 기여도 분석 */}
      <div className="card p-5">
        <h4 className="font-bold text-[#25231f] mb-4">기여도 분석 <span className="text-xs font-normal text-[#8a8078]">(동료 평가 기반)</span></h4>
        <div className="space-y-3">
          {sortedByContrib.map((ms, i) => {
            const pct = ms.avgContributionScore
            const maxPct = sortedByContrib[0].avgContributionScore
            const barWidth = maxPct > 0 ? (pct / maxPct) * 100 : 0
            return (
              <div key={ms.userId} className="flex items-center gap-3">
                <span className="text-sm font-medium w-16 text-right text-[#25231f] flex-shrink-0">{ms.name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                  <div
                    className="h-5 rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }}
                  />
                </div>
                <span className="text-sm font-bold w-12 text-right text-[#25231f] flex-shrink-0">
                  {pct.toFixed(1)}%
                </span>
                {ms.suspectedFreeRider && <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* 역량 레이더 */}
      <div className="card p-5">
        <h4 className="font-bold text-[#25231f] mb-4">팀원별 역량 프로파일</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {scores.map((ms, i) => (
            <div
              key={ms.userId}
              className={`rounded-xl p-3 border ${ms.suspectedFreeRider ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#25231f]">{ms.name}</span>
                {ms.suspectedFreeRider && <AlertTriangle className="w-3 h-3 text-red-400" />}
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <RadarChart data={radarData(ms)} margin={{ top: 4, right: 12, bottom: 4, left: 12 }}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Radar
                    dataKey="score"
                    stroke={MEMBER_COLORS[i % MEMBER_COLORS.length]}
                    fill={MEMBER_COLORS[i % MEMBER_COLORS.length]}
                    fillOpacity={0.35}
                  />
                  <Tooltip formatter={(v: number) => [v.toFixed(1), '점수']} />
                </RadarChart>
              </ResponsiveContainer>
              <p className="text-xs text-center text-[#8a8078] mt-1">평균 {avgScore(ms).toFixed(2)} / 5</p>
            </div>
          ))}
        </div>
      </div>

      {/* 채팅 참여도 (데모 전용) */}
      {isDemo && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="font-bold text-[#25231f]">채팅 참여도 분석</h4>
            <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full font-medium">카카오톡 기반</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse table-fixed">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 font-semibold text-[#6b7280] border-b">팀원</th>
                  <th className="text-right px-3 py-2 font-semibold text-[#6b7280] border-b">발화수</th>
                  <th className="text-right px-3 py-2 font-semibold text-[#6b7280] border-b">평균 응답(h)</th>
                  <th className="text-right px-3 py-2 font-semibold text-[#6b7280] border-b">조율 비율</th>
                  <th className="text-center px-3 py-2 font-semibold text-[#6b7280] border-b">소통</th>
                  <th className="text-center px-3 py-2 font-semibold text-[#6b7280] border-b">진행관리</th>
                </tr>
              </thead>
              <tbody>
                {scores.map(ms => {
                  const chat = DEMO_CHAT_DATA[ms.name]
                  if (!chat) return null
                  const scoreColor = (v: number) =>
                    v >= 4 ? 'text-green-600 font-bold' : v <= 2 ? 'text-red-500 font-bold' : 'text-[#25231f]'
                  return (
                    <tr key={ms.userId} className={`border-b hover:bg-gray-50 ${ms.suspectedFreeRider ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-2 font-medium text-[#25231f]">
                        {ms.name}{ms.suspectedFreeRider && ' ⚠️'}
                      </td>
                      <td className="px-3 py-2 text-right text-[#25231f]">{chat.messages}</td>
                      <td className="px-3 py-2 text-right text-[#25231f]">{chat.avgResponseH.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-[#25231f]">{(chat.orchRate * 100).toFixed(0)}%</td>
                      <td className={`px-3 py-2 text-center ${scoreColor(chat.commScore)}`}>{chat.commScore}/5</td>
                      <td className={`px-3 py-2 text-center ${scoreColor(chat.progressScore)}`}>{chat.progressScore}/5</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[#b0a8a0] mt-3">
            * 발화수: 전체 채팅 메시지 수 · 평균 응답: 응답까지 소요 시간 · 조율 비율: 조율·진척 관련 메시지 비율
          </p>
        </div>
      )}
    </div>
  )
}
