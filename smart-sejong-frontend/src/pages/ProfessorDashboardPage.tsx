import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import {
  Users, BookOpen, ChevronRight, AlertTriangle,
  Calendar, CheckCircle2, BarChart3, AlertCircle, Thermometer,
} from 'lucide-react'
import { parseISO, differenceInDays } from 'date-fns'
import type { GroupSummary, ProjectTask, ProfessorSection, MemberScore } from '@/types'

interface TaskWithGroup extends ProjectTask {
  groupId: number
  groupName: string
}

interface FreeRider extends MemberScore {
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

function calcDelayStats(tasks: TaskWithGroup[]) {
  const done = tasks.filter(t => t.status !== 'PENDING')
  const lateRate = done.length > 0
    ? Math.round((tasks.filter(t => t.status === 'LATE').length / done.length) * 100)
    : 0
  const atRisk = tasks.filter(t => {
    if (t.status !== 'PENDING' || !t.deadline) return false
    const d = differenceInDays(parseISO(t.deadline), new Date())
    return d >= 0 && d <= 3 && t.progress < 60
  })
  return { lateRate, atRiskCount: atRisk.length }
}

export default function ProfessorDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const professorName = user?.fullName || user?.nickname || ''

  const { data: sections = [] } = useQuery<ProfessorSection[]>({
    queryKey: ['professor-sections', professorName],
    queryFn: () => api.getProfessorSections(professorName),
    enabled: !!professorName,
  })

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

  const { data: groups = [] } = useQuery<GroupSummary[]>({
    queryKey: ['groups'],
    queryFn: () => api.getGroups(),
  })

  const selectedCourseGroups = useMemo(() => {
    if (!selectedCourse) return groups
    return groups.filter(g => (g.courseName || '기타') === selectedCourse)
  }, [groups, selectedCourse])

  const { data: allTasks = [] } = useQuery<TaskWithGroup[]>({
    queryKey: ['all-tasks', groups.map(g => g.id)],
    queryFn: async () => {
      const results = await Promise.all(
        groups.map(async (group) => {
          const tasks = await api.getTasks(group.id)
          return tasks.map(t => ({ ...t, groupId: group.id, groupName: group.name }))
        })
      )
      return results.flat()
    },
    enabled: groups.length > 0,
  })

  const { data: freeRiders = [] } = useQuery<FreeRider[]>({
    queryKey: ['all-free-riders', groups.map(g => g.id)],
    queryFn: async () => {
      const results = await Promise.all(
        groups.map(async (group) => {
          try {
            const summary = await api.getPeerReviewSummary(group.id)
            return summary.memberScores
              .filter(ms => ms.suspectedFreeRider)
              .map(ms => ({ ...ms, groupId: group.id, groupName: group.name }))
          } catch {
            return []
          }
        })
      )
      return results.flat()
    },
    enabled: groups.length > 0,
  })

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
      const { lateRate, atRiskCount } = calcDelayStats(groupTasks)

      return {
        ...group,
        totalTasks,
        completedTasks,
        avgProgress,
        daysLeft,
        lateRate,
        atRiskCount,
        status: getTeamStatus(avgProgress, daysLeft),
      }
    })
  }, [selectedCourseGroups, allTasks])

  const overallStats = useMemo(() => ({
    totalStudents: groups.reduce((sum, g) => sum + g.memberCount, 0),
    totalTeams: groups.length,
    freeRiderCount: freeRiders.length,
  }), [groups, freeRiders])

  return (
    <div className="space-y-6">
      {/* 담당 과목 */}
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
                  className={`glass-item text-left p-4 rounded-xl border-2 transition-all ${
                    isSelected ? '!border-[#4a8768] bg-[#4a8768]/10' : 'hover:!border-[#4a8768]/50'
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

      {/* 통계 */}
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
              <p className="text-2xl font-extrabold text-[#6f4141]">{overallStats.freeRiderCount}</p>
              <p className="text-xs text-[#7a7169]">무임승차 의심</p>
            </div>
          </div>
        </div>
      </div>

      {/* 팀 현황 + 무임승차 패널 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 팀별 진행 현황 */}
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
                    className="glass-item p-4 rounded-xl hover:border-[#4a8768]/50 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => navigate(`/group?selected=${team.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-[#25231f]">{team.name}</h3>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${team.status.bg} ${team.status.color}`}>
                          {team.status.label}
                        </span>
                        {/* 지연 예측 지표 */}
                        {team.lateRate > 0 && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            team.lateRate >= 40
                              ? 'bg-[#6f4141]/12 text-[#6f4141]'
                              : 'bg-[#a8793d]/12 text-[#a8793d]'
                          }`}>
                            지연율 {team.lateRate}%
                          </span>
                        )}
                        {team.atRiskCount > 0 && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#6f4141]/12 text-[#6f4141] flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            마감 위험 {team.atRiskCount}건
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#7a7169] shrink-0">
                        <Users className="w-3 h-3" />
                        <span>{team.memberCount}명</span>
                        {team.daysLeft !== null && (
                          <>
                            <Calendar className="w-3 h-3 ml-1" />
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

        {/* 무임승차 의심 */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-xl bg-[#6f4141]/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-[#6f4141]" />
              </span>
              <h2 className="font-bold text-[#25231f]">무임승차 의심</h2>
            </div>

            {freeRiders.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-10 h-10 text-[#4a8768]/30 mx-auto mb-2" />
                <p className="text-sm text-[#b0a8a0]">특이사항 없음</p>
              </div>
            ) : (
              <div className="space-y-2">
                {freeRiders.map((fr, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-[#6f4141]/5 border border-[#6f4141]/20 cursor-pointer hover:border-[#6f4141]/40 transition-colors"
                    onClick={() => navigate(`/group?selected=${fr.groupId}`)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Thermometer className="w-4 h-4 text-red-500" />
                        <span className="font-bold text-sm text-[#25231f]">{fr.name}</span>
                      </div>
                      <span className="text-xs font-bold text-red-500">
                        기여도 {fr.avgContributionScore.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-red-100 overflow-hidden mb-1.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-600 transition-all duration-500"
                        style={{ width: `${Math.min(fr.avgContributionScore, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-[#7a7169] truncate">{fr.groupName}</p>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => navigate('/group')}
              className="w-full mt-3 text-xs font-bold text-[#4a8768] hover:underline flex items-center justify-center gap-1"
            >
              전체 팀 보기
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
