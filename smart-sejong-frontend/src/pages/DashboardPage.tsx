import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts'
import {
  Users, Calendar, CheckCircle2, Clock, ChevronRight, AlertTriangle, Folder,
} from 'lucide-react'
import { format, isToday, isTomorrow, parseISO, isPast, differenceInDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { GroupSummary, ProjectTask, MemberScore } from '@/types'

// 온도 색상
function tempColor(temp: number) {
  if (temp >= 38) return 'text-[#6f4141]'
  if (temp >= 36) return 'text-[#a8793d]'
  if (temp >= 33) return 'text-[#4a8768]'
  return 'text-[#31465d]'
}

function tempBgColor(temp: number) {
  if (temp >= 38) return 'bg-[#6f4141]/10'
  if (temp >= 36) return 'bg-[#a8793d]/10'
  if (temp >= 33) return 'bg-[#4a8768]/10'
  return 'bg-[#31465d]/10'
}

// 마감일 포맷
function formatDeadline(deadline: string | null) {
  if (!deadline) return null
  const date = parseISO(deadline)
  if (isToday(date)) return { text: '오늘 마감', urgent: true }
  if (isTomorrow(date)) return { text: '내일 마감', urgent: true }
  if (isPast(date)) return { text: '마감됨', urgent: false }
  const days = differenceInDays(date, new Date())
  if (days <= 3) return { text: `${days}일 후 마감`, urgent: true }
  return { text: format(date, 'M/d(EEE)', { locale: ko }), urgent: false }
}

interface TaskWithGroup extends ProjectTask {
  groupId: number
  groupName: string
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // 내가 참여한 팀 목록
  const { data: groups = [] } = useQuery<GroupSummary[]>({
    queryKey: ['groups'],
    queryFn: () => api.getGroups(),
  })

  const myGroups = groups.filter(g => g.joined)

  // 각 팀의 과제 목록 가져오기
  const { data: allTasks = [] } = useQuery<TaskWithGroup[]>({
    queryKey: ['all-tasks', myGroups.map(g => g.id)],
    queryFn: async () => {
      const taskLists = await Promise.all(
        myGroups.map(async (group) => {
          const tasks = await api.getTasks(group.id)
          return tasks.map(t => ({ ...t, groupId: group.id, groupName: group.name }))
        })
      )
      return taskLists.flat()
    },
    enabled: myGroups.length > 0,
  })

  // 각 팀의 동료평가 데이터 가져오기
  const { data: reviewData } = useQuery({
    queryKey: ['all-reviews', myGroups.map(g => g.id)],
    queryFn: async () => {
      const reviews = await Promise.all(
        myGroups.map(async (group) => {
          try {
            const summary = await api.getPeerReviewSummary(group.id)
            return { groupId: group.id, ...summary }
          } catch {
            return null
          }
        })
      )
      return reviews.filter(Boolean)
    },
    enabled: myGroups.length > 0,
  })

  // 오늘/내일 마감 과제 필터링
  const urgentTasks = useMemo(() => {
    return allTasks
      .filter(t => {
        if (!t.deadline || t.status === 'APPROVED' || t.status === 'SUBMITTED') return false
        const date = parseISO(t.deadline)
        return isToday(date) || isTomorrow(date) || differenceInDays(date, new Date()) <= 3
      })
      .sort((a, b) => {
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return parseISO(a.deadline).getTime() - parseISO(b.deadline).getTime()
      })
  }, [allTasks])

  // 현재 사용자의 평균 점수 계산
  const myScores = useMemo(() => {
    if (!reviewData || !user) return null

    let totalContributing = 0
    let totalInteracting = 0
    let totalKeepingOnTrack = 0
    let totalQuality = 0
    let totalKnowledge = 0
    let count = 0

    reviewData.forEach((review) => {
      if (!review) return
      const myScore = (review as { memberScores: MemberScore[] }).memberScores?.find(
        (ms: MemberScore) => ms.name === user.nickname
      )
      if (myScore && myScore.reviewCount > 0) {
        totalContributing += myScore.avgContributing
        totalInteracting += myScore.avgInteracting
        totalKeepingOnTrack += myScore.avgKeepingOnTrack
        totalQuality += myScore.avgExpectingQuality
        totalKnowledge += myScore.avgKnowledgeSkills
        count++
      }
    })

    if (count === 0) return null

    return {
      contributing: totalContributing / count,
      interacting: totalInteracting / count,
      keepingOnTrack: totalKeepingOnTrack / count,
      quality: totalQuality / count,
      knowledge: totalKnowledge / count,
    }
  }, [reviewData, user])

  // 레이더 차트 데이터
  const radarChartData = useMemo(() => {
    if (!myScores) {
      // 기본값 (데이터 없을 때)
      return [
        { subject: '기여도', value: 0, fullMark: 5 },
        { subject: '소통', value: 0, fullMark: 5 },
        { subject: '일정관리', value: 0, fullMark: 5 },
        { subject: '품질', value: 0, fullMark: 5 },
        { subject: '지식/기술', value: 0, fullMark: 5 },
      ]
    }
    return [
      { subject: '기여도', value: myScores.contributing, fullMark: 5 },
      { subject: '소통', value: myScores.interacting, fullMark: 5 },
      { subject: '일정관리', value: myScores.keepingOnTrack, fullMark: 5 },
      { subject: '품질', value: myScores.quality, fullMark: 5 },
      { subject: '지식/기술', value: myScores.knowledge, fullMark: 5 },
    ]
  }, [myScores])

  // 평균 온도 계산
  const avgTemperature = useMemo(() => {
    let total = 0
    let count = 0
    myGroups.forEach(() => {
      // 기본 온도 36.5
      total += 36.5
      count++
    })
    return count > 0 ? total / count : 36.5
  }, [myGroups])

  return (
    <div className="space-y-6">
      {/* 인사말 섹션 */}
      <div className="card bg-gradient-to-br from-[#4a8768]/5 to-[#31465d]/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#25231f] mb-1">
              안녕하세요, {user?.nickname || '사용자'}님
            </h1>
            <p className="text-[#7a7169] text-sm">
              {urgentTasks.length > 0
                ? `오늘 처리할 과제가 ${urgentTasks.length}개 있습니다`
                : '오늘 마감 과제가 없습니다'}
            </p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl ${tempBgColor(avgTemperature)}`}>
            <span className="text-sm text-[#7a7169]">내 온도</span>
            <span className={`text-2xl font-extrabold ${tempColor(avgTemperature)}`}>
              {avgTemperature.toFixed(1)}°
            </span>
          </div>
        </div>
      </div>

      {/* 메인 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 레이더 차트 */}
        <div className="lg:col-span-1">
          <div className="card h-full">
            <h2 className="font-bold text-[#25231f] mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[#4a8768]/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-[#4a8768]" />
              </span>
              나의 협업 지표
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarChartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                  <PolarGrid stroke="#e7e0d7" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fontSize: 11, fill: '#7a7169' }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 5]}
                    tick={{ fontSize: 10, fill: '#b0a8a0' }}
                    tickCount={6}
                  />
                  <Radar
                    dataKey="value"
                    fill="#4a8768"
                    fillOpacity={0.4}
                    stroke="#4a8768"
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            {!myScores && (
              <p className="text-center text-xs text-[#b0a8a0] mt-2">
                동료 평가 데이터가 없습니다
              </p>
            )}
          </div>
        </div>

        {/* 오른쪽: 오늘 해야 할 일 + 현재 프로젝트 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 오늘 해야 할 일 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#25231f] flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#a8793d]/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-[#a8793d]" />
                </span>
                오늘 해야 할 일
              </h2>
              {urgentTasks.length > 0 && (
                <span className="text-xs font-bold text-[#6f4141] bg-[#6f4141]/10 px-2.5 py-1 rounded-full">
                  {urgentTasks.length}개
                </span>
              )}
            </div>

            {urgentTasks.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-[#4a8768]/30 mx-auto mb-2" />
                <p className="text-sm text-[#b0a8a0]">마감이 임박한 과제가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {urgentTasks.slice(0, 5).map((task) => {
                  const dl = formatDeadline(task.deadline)
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-[#e7e0d7] hover:border-[#4a8768]/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/group?selected=${task.groupId}&tab=tasks`)}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        dl?.urgent ? 'bg-[#6f4141]/10' : 'bg-[#31465d]/10'
                      }`}>
                        {dl?.urgent ? (
                          <AlertTriangle className="w-5 h-5 text-[#6f4141]" />
                        ) : (
                          <Clock className="w-5 h-5 text-[#31465d]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#25231f] text-sm truncate">{task.title}</p>
                        <p className="text-xs text-[#b0a8a0]">{task.groupName}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-bold ${dl?.urgent ? 'text-[#6f4141]' : 'text-[#7a7169]'}`}>
                          {dl?.text}
                        </span>
                        <div className="mt-1">
                          <div className="w-16 h-1.5 rounded-full bg-[#f2eee8]">
                            <div
                              className="h-full rounded-full bg-[#4a8768]"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 현재 프로젝트 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#25231f] flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#31465d]/10 flex items-center justify-center">
                  <Folder className="w-4 h-4 text-[#31465d]" />
                </span>
                현재 프로젝트
              </h2>
              <button
                onClick={() => navigate('/group')}
                className="text-xs font-bold text-[#4a8768] hover:underline flex items-center gap-1"
              >
                전체보기
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {myGroups.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-[#31465d]/30 mx-auto mb-2" />
                <p className="text-sm text-[#b0a8a0]">참여 중인 프로젝트가 없습니다</p>
                <button
                  onClick={() => navigate('/group?tab=find')}
                  className="mt-3 btn-primary text-sm px-4 py-2"
                >
                  팀 찾아보기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {myGroups.slice(0, 4).map((group) => {
                  const groupTasks = allTasks.filter(t => t.groupId === group.id)
                  const pendingCount = groupTasks.filter(t => t.status === 'PENDING').length
                  return (
                    <div
                      key={group.id}
                      className="p-4 rounded-xl bg-white/60 border border-[#e7e0d7] hover:border-[#4a8768]/30 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => navigate(`/group?selected=${group.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold text-[#25231f] text-sm truncate flex-1">{group.name}</h3>
                        {pendingCount > 0 && (
                          <span className="text-xs font-bold text-[#a8793d] bg-[#a8793d]/10 px-2 py-0.5 rounded-full ml-2">
                            {pendingCount}
                          </span>
                        )}
                      </div>
                      {group.courseName && (
                        <p className="text-xs text-[#7a7169] mb-2">{group.courseName}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-[#b0a8a0]">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {group.memberCount}명
                        </span>
                        {group.projectDeadline && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(parseISO(group.projectDeadline), 'M/d', { locale: ko })}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 소속팀 목록 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#25231f] flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#4a8768]/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-[#4a8768]" />
            </span>
            소속팀
          </h2>
          <span className="text-xs text-[#b0a8a0]">{myGroups.length}개 팀</span>
        </div>

        {myGroups.length === 0 ? (
          <p className="text-sm text-[#b0a8a0] text-center py-4">아직 소속된 팀이 없습니다</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e7e0d7]">
                  <th className="text-left text-xs font-bold text-[#7a7169] py-2 px-3">팀명</th>
                  <th className="text-left text-xs font-bold text-[#7a7169] py-2 px-3">과목</th>
                  <th className="text-center text-xs font-bold text-[#7a7169] py-2 px-3">인원</th>
                  <th className="text-center text-xs font-bold text-[#7a7169] py-2 px-3">마감일</th>
                  <th className="text-center text-xs font-bold text-[#7a7169] py-2 px-3">진행 과제</th>
                </tr>
              </thead>
              <tbody>
                {myGroups.map((group) => {
                  const groupTasks = allTasks.filter(t => t.groupId === group.id)
                  const pendingCount = groupTasks.filter(t => t.status === 'PENDING').length
                  return (
                    <tr
                      key={group.id}
                      className="border-b border-[#e7e0d7]/50 hover:bg-[#f2eee8]/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/group?selected=${group.id}`)}
                    >
                      <td className="py-3 px-3">
                        <span className="font-bold text-[#25231f] text-sm">{group.name}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-sm text-[#7a7169]">{group.courseName || '-'}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-sm text-[#7a7169]">{group.memberCount}명</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-sm text-[#7a7169]">
                          {group.projectDeadline
                            ? format(parseISO(group.projectDeadline), 'yyyy.M.d', { locale: ko })
                            : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {pendingCount > 0 ? (
                          <span className="text-xs font-bold text-[#a8793d] bg-[#a8793d]/10 px-2.5 py-1 rounded-full">
                            {pendingCount}개
                          </span>
                        ) : (
                          <span className="text-xs text-[#b0a8a0]">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
