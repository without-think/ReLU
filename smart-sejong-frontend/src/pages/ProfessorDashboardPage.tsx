import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import {
  Users, BookOpen, ChevronRight, AlertTriangle,
  Calendar, CheckCircle2, BarChart3, AlertCircle,
} from 'lucide-react'
import { parseISO, differenceInDays } from 'date-fns'
import type { GroupSummary, ProjectTask, ProfessorSection } from '@/types'

interface TaskWithGroup extends ProjectTask {
  groupId: number
  groupName: string
}

function getTeamStatus(progress: number, daysLeft: number | null) {
  if (daysLeft !== null && daysLeft < 0) return { label: '마감됨', color: 'text-[#b0a8a0]', bg: 'bg-[#b0a8a0]/10' }
  if (progress >= 90) return { label: '완료 임박', color: 'text-[#4a8768]', bg: 'bg-[#4a8768]/10' }
  if (daysLeft !== null && daysLeft <= 3 && progress < 50) return { label: '지연 위험', color: 'text-[#6f4141]', bg: 'bg-[#6f4141]/10' }
  if (progress < 30) return { label: '시작 단계', color: 'text-[#31465d]', bg: 'bg-[#31465d]/10' }
  return { label: '정상 진행', color: 'text-[#4a8768]', bg: 'bg-[#4a8768]/10' }
}

export default function ProfessorDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const professorName = user?.fullName || user?.nickname || ''

  // 담당 강의 (강의시간표 기반)
  const { data: sections = [] } = useQuery<ProfessorSection[]>({
    queryKey: ['professor-sections', professorName],
    queryFn: () => api.getProfessorSections(professorName),
    enabled: !!professorName,
  })

  // 과목명으로 그룹핑 (중복 제거)
  const courses = useMemo(() => {
    const seen = new Map<string, { name: string; code: string; credits: number; category: string; sections: ProfessorSection[] }>()
    sections.forEach(s => {
      if (!seen.has(s.courseName)) {
        seen.set(s.courseName, { name: s.courseName, code: s.courseCode, credits: s.credits, category: s.categoryDescription, sections: [] })
      }
      seen.get(s.courseName)!.sections.push(s)
    })
    return Array.from(seen.values())
  }, [sections])

  // 팀 목록 (professor name으로 필터된 그룹)
  const { data: groups = [] } = useQuery<GroupSummary[]>({
    queryKey: ['groups'],
    queryFn: () => api.getGroups(),
  })

  // 선택된 과목의 팀들
  const selectedCourseGroups = useMemo(() => {
    if (!selectedCourse) return groups
    return groups.filter(g => (g.courseName || '기타') === selectedCourse)
  }, [groups, selectedCourse])

  // 각 팀의 과제 목록 가져오기
  const { data: allTasks = [] } = useQuery<TaskWithGroup[]>({
    queryKey: ['all-tasks', groups.map(g => g.id)],
    queryFn: async () => {
      const taskLists = await Promise.all(
        groups.map(async (group) => {
          const tasks = await api.getTasks(group.id)
          return tasks.map(t => ({ ...t, groupId: group.id, groupName: group.name }))
        })
      )
      return taskLists.flat()
    },
    enabled: groups.length > 0,
  })

  // 팀별 진행률 계산
  const teamStats = useMemo(() => {
    return selectedCourseGroups.map(group => {
      const groupTasks = allTasks.filter(t => t.groupId === group.id)
      const totalTasks = groupTasks.length
      const completedTasks = groupTasks.filter(t => t.status === 'APPROVED' || t.status === 'SUBMITTED').length
      const avgProgress = totalTasks > 0
        ? Math.round(groupTasks.reduce((sum, t) => sum + t.progress, 0) / totalTasks)
        : 0

      const daysLeft = group.projectDeadline
        ? differenceInDays(parseISO(group.projectDeadline), new Date())
        : null

      return {
        ...group,
        totalTasks,
        completedTasks,
        avgProgress,
        daysLeft,
        status: getTeamStatus(avgProgress, daysLeft)
      }
    })
  }, [selectedCourseGroups, allTasks])

  // 위험 팀 (지연 위험)
  const atRiskTeams = teamStats.filter(t => t.status.label === '지연 위험')

  // 활동 히트맵 데이터 (최근 4주)
  const heatmapData = useMemo(() => {
    const weeks = ['4주 전', '3주 전', '2주 전', '지난 주', '이번 주']
    return selectedCourseGroups.slice(0, 8).map(group => {
      // 샘플 데이터 (실제로는 API에서 가져와야 함)
      const activity = weeks.map(() => Math.floor(Math.random() * 10))
      return { name: group.name, activity }
    })
  }, [selectedCourseGroups])

  // 전체 통계
  const overallStats = useMemo(() => {
    const totalStudents = groups.reduce((sum, g) => sum + g.memberCount, 0)
    const totalTeams = groups.length
    const avgProgress = teamStats.length > 0
      ? Math.round(teamStats.reduce((sum, t) => sum + t.avgProgress, 0) / teamStats.length)
      : 0
    return { totalStudents, totalTeams, avgProgress, atRiskCount: atRiskTeams.length }
  }, [groups, teamStats, atRiskTeams])

  return (
    <div className="space-y-6">
      {/* 상단: 인사말 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#25231f] mb-1">
            안녕하세요, {user?.fullName || user?.nickname || '교수'}님
          </h1>
          <p className="text-[#7a7169] text-sm">
            {atRiskTeams.length > 0
              ? `주의가 필요한 팀이 ${atRiskTeams.length}개 있습니다`
              : '모든 팀이 정상적으로 진행 중입니다'}
          </p>
        </div>
      </div>

      {/* 담당 과목 카드 목록 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#4a8768]" />
            <h2 className="font-bold text-[#25231f]">담당 과목</h2>
            <span className="text-xs text-[#b0a8a0]">{courses.length}개 과목</span>
          </div>
          <button
            onClick={() => setSelectedCourse(null)}
            className={`text-xs px-3 py-1 rounded-lg transition-all ${selectedCourse === null ? 'bg-[#4a8768] text-white' : 'bg-[#f2eee8] text-[#7a7169]'}`}
          >
            전체 보기
          </button>
        </div>
        {courses.length === 0 ? (
          <p className="text-sm text-[#b0a8a0] text-center py-4">강의시간표에서 담당 과목을 불러오는 중...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {courses.map(course => {
              const courseGroups = groups.filter(g => g.courseName === course.name)
              const isSelected = selectedCourse === course.name
              return (
                <button
                  key={course.name}
                  onClick={() => setSelectedCourse(isSelected ? null : course.name)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-[#4a8768] bg-[#4a8768]/5'
                      : 'border-[#e7e0d7] bg-white/60 hover:border-[#4a8768]/40'
                  }`}
                >
                  <p className="font-bold text-sm text-[#25231f] mb-1 leading-snug">{course.name}</p>
                  <div className="flex items-center gap-2 text-xs text-[#7a7169]">
                    <span className="px-1.5 py-0.5 rounded bg-[#f2eee8]">{course.category}</span>
                    <span>{course.credits}학점</span>
                    <span>·</span>
                    <span>{course.sections.length}분반</span>
                  </div>
                  {courseGroups.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-[#4a8768] font-semibold">
                      <Users className="w-3 h-3" />
                      <span>팀 {courseGroups.length}개 등록</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 수강생 현황 통계 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#31465d]/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#31465d]" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[#25231f]">{overallStats.totalStudents}</p>
              <p className="text-xs text-[#7a7169]">전체 수강생</p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4a8768]/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-[#4a8768]" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[#4a8768]">{overallStats.totalTeams}</p>
              <p className="text-xs text-[#7a7169]">팀 수</p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6f4141]/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-[#6f4141]" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[#6f4141]">{overallStats.atRiskCount}</p>
              <p className="text-xs text-[#7a7169]">주의 필요</p>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 그리드: 팀별 카드 + 히트맵 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 팀별 진행 현황 (2칸) */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#25231f] flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#31465d]/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-[#31465d]" />
                </span>
                팀 프로젝트 현황
              </h2>
              <span className="text-xs text-[#b0a8a0]">{teamStats.length}개 팀</span>
            </div>

            {teamStats.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-[#b0a8a0]/30 mx-auto mb-2" />
                <p className="text-sm text-[#b0a8a0]">등록된 팀이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teamStats.map(team => (
                  <div
                    key={team.id}
                    className="p-4 rounded-xl bg-white/60 border border-[#e7e0d7] hover:border-[#4a8768]/30 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => navigate(`/group?selected=${team.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-[#25231f]">{team.name}</h3>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${team.status.bg} ${team.status.color}`}>
                          {team.status.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#7a7169]">
                        <Users className="w-3 h-3" />
                        <span>{team.memberCount}명</span>
                        {team.daysLeft !== null && (
                          <>
                            <Calendar className="w-3 h-3 ml-2" />
                            <span className={team.daysLeft <= 3 ? 'text-[#6f4141] font-bold' : ''}>
                              {team.daysLeft > 0 ? `D-${team.daysLeft}` : team.daysLeft === 0 ? 'D-Day' : '마감됨'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-[#7a7169]">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[#4a8768]" />
                        완료 {team.completedTasks}/{team.totalTasks}
                      </span>
                      {team.courseName && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {team.courseName}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 활동 히트맵 + 동료평가 결과 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 활동 히트맵 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#25231f] flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#a8793d]/10 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-[#a8793d]" />
                </span>
                팀별 활동량
              </h2>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs text-[#b0a8a0] mb-2">
                <span className="w-16"></span>
                {['4주전', '3주전', '2주전', '1주전', '이번주'].map(w => (
                  <span key={w} className="flex-1 text-center text-[10px]">{w}</span>
                ))}
              </div>
              {heatmapData.map(team => (
                <div key={team.name} className="flex items-center gap-1">
                  <span className="w-16 text-xs text-[#7a7169] truncate">{team.name}</span>
                  {team.activity.map((val, i) => (
                    <div
                      key={i}
                      className="flex-1 h-6 rounded"
                      style={{
                        backgroundColor: val === 0
                          ? '#f2eee8'
                          : `rgba(74, 135, 104, ${0.2 + (val / 10) * 0.8})`
                      }}
                      title={`${val} 활동`}
                    />
                  ))}
                </div>
              ))}
            </div>
            <p className="text-xs text-[#b0a8a0] mt-3 text-center">
              진할수록 활동량 많음
            </p>
          </div>

          {/* 동료평가 결과 / 프리라이더 의심 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#25231f] flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#6f4141]/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-[#6f4141]" />
                </span>
                동료평가 알림
              </h2>
            </div>

            {atRiskTeams.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-10 h-10 text-[#4a8768]/30 mx-auto mb-2" />
                <p className="text-sm text-[#b0a8a0]">특이사항 없음</p>
              </div>
            ) : (
              <div className="space-y-2">
                {atRiskTeams.slice(0, 5).map(team => (
                  <div
                    key={team.id}
                    className="p-3 rounded-xl bg-[#6f4141]/5 border border-[#6f4141]/20 cursor-pointer hover:border-[#6f4141]/40 transition-colors"
                    onClick={() => navigate(`/group?selected=${team.id}&tab=review`)}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#6f4141]" />
                      <span className="font-bold text-sm text-[#25231f]">{team.name}</span>
                    </div>
                    <p className="text-xs text-[#7a7169] mt-1">
                      진행률 {team.avgProgress}% · D-{team.daysLeft}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => navigate('/group')}
              className="w-full mt-3 text-xs font-bold text-[#4a8768] hover:underline flex items-center justify-center gap-1"
            >
              전체 동료평가 보기
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
