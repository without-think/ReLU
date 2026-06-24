import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import {
  Users, Calendar, CheckCircle2, Clock, ChevronRight, AlertTriangle,
  ChevronLeft, Bell, Plus, Search, MessageCircle, FileText, UserPlus,
  TrendingUp, Loader2,
} from 'lucide-react'
import { format, isToday, isTomorrow, parseISO, isPast, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, getDay, formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { GroupSummary, ProjectTask } from '@/types'

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

// 알림 타입
interface Notification {
  id: number
  type: 'task' | 'comment' | 'member' | 'deadline'
  title: string
  description: string
  time: Date
  groupId?: number
  groupName?: string
  read: boolean
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())

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

  // 진행률 통계
  const taskStats = useMemo(() => {
    const total = allTasks.length
    const completed = allTasks.filter(t => t.status === 'APPROVED' || t.status === 'SUBMITTED').length
    const inProgress = allTasks.filter(t => t.status === 'PENDING' || t.status === 'LATE').length
    const pending = allTasks.filter(t => t.status === 'PENDING').length
    return { total, completed, inProgress, pending }
  }, [allTasks])

  // 샘플 알림 데이터 (실제로는 API에서 가져와야 함)
  const notifications: Notification[] = useMemo(() => {
    const notifs: Notification[] = []

    // 마감 임박 알림
    urgentTasks.forEach((task, i) => {
      if (i < 3) {
        notifs.push({
          id: task.id,
          type: 'deadline',
          title: '마감 임박',
          description: `"${task.title}" 과제가 곧 마감됩니다`,
          time: task.deadline ? parseISO(task.deadline) : new Date(),
          groupId: task.groupId,
          groupName: task.groupName,
          read: false,
        })
      }
    })

    // 최근 생성된 과제 알림
    allTasks.slice(0, 2).forEach((task) => {
      notifs.push({
        id: task.id + 1000,
        type: 'task',
        title: '새 과제 등록',
        description: `"${task.title}" 과제가 등록되었습니다`,
        time: task.createdAt ? parseISO(task.createdAt) : new Date(),
        groupId: task.groupId,
        groupName: task.groupName,
        read: true,
      })
    })

    return notifs.slice(0, 5)
  }, [urgentTasks, allTasks])

  // 최근 활동 (샘플)
  const recentActivities = useMemo(() => {
    const activities: { id: number; user: string; action: string; target: string; time: Date; groupName: string }[] = []

    allTasks.slice(0, 4).forEach((task, i) => {
      activities.push({
        id: i,
        user: task.assigneeName || '팀원',
        action: i % 2 === 0 ? '과제를 완료했습니다' : '댓글을 남겼습니다',
        target: task.title,
        time: new Date(Date.now() - i * 3600000), // 1시간 간격
        groupName: task.groupName,
      })
    })

    return activities
  }, [allTasks])

  // 캘린더 날짜 생성
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start, end })
    const startDay = getDay(start)
    const paddingDays = Array(startDay).fill(null)
    return [...paddingDays, ...days]
  }, [currentMonth])

  // 특정 날짜의 과제 필터링
  const getTasksForDate = (date: Date) => {
    return allTasks.filter(t => {
      if (!t.deadline) return false
      return isSameDay(parseISO(t.deadline), date)
    })
  }

  // 선택된 날짜의 과제
  const selectedDateTasks = useMemo(() => {
    if (!selectedDate) return []
    return getTasksForDate(selectedDate)
  }, [selectedDate, allTasks])

  // 알림 아이콘 선택
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task': return <FileText className="w-4 h-4 text-[#4a8768]" />
      case 'comment': return <MessageCircle className="w-4 h-4 text-[#31465d]" />
      case 'member': return <UserPlus className="w-4 h-4 text-[#a8793d]" />
      case 'deadline': return <AlertTriangle className="w-4 h-4 text-[#6f4141]" />
      default: return <Bell className="w-4 h-4 text-[#7a7169]" />
    }
  }

  return (
    <div className="space-y-6">
      {/* 상단: 인사말 + 빠른 액션 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#25231f] mb-1">
            안녕하세요, {user?.nickname || '사용자'}님
          </h1>
          <p className="text-[#7a7169] text-sm">
            {urgentTasks.length > 0
              ? `마감 임박 과제 ${urgentTasks.length}개`
              : '오늘 마감 과제가 없습니다'}
          </p>
        </div>

        {/* 빠른 액션 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/group?tab=find')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#e7e0d7] hover:border-[#4a8768]/30 hover:bg-[#f2eee8] transition-all text-sm font-medium text-[#25231f]"
          >
            <Search className="w-4 h-4" />
            팀 찾기
          </button>
          <button
            onClick={() => navigate('/group?action=create')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4a8768] hover:bg-[#3d7259] transition-colors text-sm font-medium text-white"
          >
            <Plus className="w-4 h-4" />
            새 프로젝트
          </button>
        </div>
      </div>

      {/* 진행률 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#31465d]/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#31465d]" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[#25231f]">{taskStats.total}</p>
              <p className="text-xs text-[#7a7169]">전체 과제</p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4a8768]/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-[#4a8768]" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[#4a8768]">{taskStats.completed}</p>
              <p className="text-xs text-[#7a7169]">완료</p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#a8793d]/10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-[#a8793d]" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[#a8793d]">{taskStats.inProgress}</p>
              <p className="text-xs text-[#7a7169]">진행중</p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6f4141]/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#6f4141]" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[#6f4141]">{taskStats.pending}</p>
              <p className="text-xs text-[#7a7169]">대기중</p>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 그리드: 캘린더 + 알림 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 캘린더 (2칸) */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#25231f] flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#a8793d]/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-[#a8793d]" />
                </span>
                일정
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-1.5 rounded-lg hover:bg-[#f2eee8] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-[#7a7169]" />
                </button>
                <span className="text-sm font-bold text-[#25231f] min-w-[100px] text-center">
                  {format(currentMonth, 'yyyy년 M월', { locale: ko })}
                </span>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-1.5 rounded-lg hover:bg-[#f2eee8] transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-[#7a7169]" />
                </button>
              </div>
            </div>

            {/* 캘린더 그리드 */}
            <div className="mb-4">
              <div className="grid grid-cols-7 mb-2">
                {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                  <div key={day} className={`text-center text-xs font-bold py-2 ${i === 0 ? 'text-[#6f4141]' : i === 6 ? 'text-[#31465d]' : 'text-[#7a7169]'}`}>
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="h-10" />
                  }
                  const dayTasks = getTasksForDate(day)
                  const hasTask = dayTasks.length > 0
                  const isSelected = selectedDate && isSameDay(day, selectedDate)
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const isTodayDate = isToday(day)

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`h-10 rounded-lg text-sm font-medium transition-all relative
                        ${isSelected ? 'bg-[#4a8768] text-white' : ''}
                        ${!isSelected && isTodayDate ? 'bg-[#4a8768]/10 text-[#4a8768] font-bold' : ''}
                        ${!isSelected && !isTodayDate && isCurrentMonth ? 'hover:bg-[#f2eee8] text-[#25231f]' : ''}
                        ${!isCurrentMonth ? 'text-[#b0a8a0]' : ''}
                      `}
                    >
                      {format(day, 'd')}
                      {hasTask && (
                        <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-[#6f4141]'}`} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 선택된 날짜의 과제 목록 */}
            <div className="border-t border-[#e7e0d7] pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-[#25231f]">
                  {selectedDate && format(selectedDate, 'M월 d일 (EEE)', { locale: ko })}
                </span>
                {selectedDateTasks.length > 0 && (
                  <span className="text-xs font-bold text-[#6f4141] bg-[#6f4141]/10 px-2 py-0.5 rounded-full">
                    {selectedDateTasks.length}개
                  </span>
                )}
              </div>

              {selectedDateTasks.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-10 h-10 text-[#4a8768]/30 mx-auto mb-2" />
                  <p className="text-sm text-[#b0a8a0]">이 날은 마감 과제가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDateTasks.map((task) => {
                    const dl = formatDeadline(task.deadline)
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-[#e7e0d7] hover:border-[#4a8768]/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/group?selected=${task.groupId}&tab=tasks`)}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          dl?.urgent ? 'bg-[#6f4141]/10' : 'bg-[#31465d]/10'
                        }`}>
                          {dl?.urgent ? (
                            <AlertTriangle className="w-4 h-4 text-[#6f4141]" />
                          ) : (
                            <Clock className="w-4 h-4 text-[#31465d]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#25231f] text-sm truncate">{task.title}</p>
                          <p className="text-xs text-[#b0a8a0]">{task.groupName}</p>
                        </div>
                        <div className="w-14 h-1.5 rounded-full bg-[#f2eee8]">
                          <div
                            className="h-full rounded-full bg-[#4a8768]"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽: 알림 */}
        <div className="lg:col-span-1">
          <div className="card h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#25231f] flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#6f4141]/10 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-[#6f4141]" />
                </span>
                알림
              </h2>
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="text-xs font-bold text-white bg-[#6f4141] px-2 py-0.5 rounded-full">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-10 h-10 text-[#b0a8a0]/30 mx-auto mb-2" />
                <p className="text-sm text-[#b0a8a0]">새로운 알림이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => notif.groupId && navigate(`/group?selected=${notif.groupId}&tab=gantt`)}
                    className={`p-3 rounded-xl border transition-colors cursor-pointer ${
                      notif.read
                        ? 'bg-white/40 border-[#e7e0d7]'
                        : 'bg-[#6f4141]/5 border-[#6f4141]/20'
                    } hover:border-[#4a8768]/30`}
                  >
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#25231f] text-sm">{notif.title}</p>
                        <p className="text-xs text-[#7a7169] truncate">{notif.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {notif.groupName && (
                            <span className="text-xs text-[#b0a8a0]">{notif.groupName}</span>
                          )}
                          <span className="text-xs text-[#b0a8a0]">
                            {formatDistanceToNow(notif.time, { addSuffix: true, locale: ko })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 하단: 최근 활동 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#25231f] flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#31465d]/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#31465d]" />
            </span>
            최근 활동
          </h2>
          <button className="text-xs font-bold text-[#4a8768] hover:underline flex items-center gap-1">
            전체보기
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {recentActivities.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-10 h-10 text-[#b0a8a0]/30 mx-auto mb-2" />
            <p className="text-sm text-[#b0a8a0]">최근 활동이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-[#e7e0d7]"
              >
                <div className="w-8 h-8 rounded-full bg-[#4a8768]/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-[#4a8768]">
                    {activity.user.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#25231f]">
                    <span className="font-bold">{activity.user}</span>
                    <span className="text-[#7a7169]">님이 </span>
                    <span className="font-medium">"{activity.target}"</span>
                    <span className="text-[#7a7169]"> {activity.action}</span>
                  </p>
                  <p className="text-xs text-[#b0a8a0]">
                    {activity.groupName} · {formatDistanceToNow(activity.time, { addSuffix: true, locale: ko })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
