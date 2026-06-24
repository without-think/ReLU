import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import {
  Plus, Users, Copy, LogOut, UserPlus, Github, Clock, CheckCircle,
  AlertTriangle, X, BookOpen, Search, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, Eye, EyeOff, Calendar, Trash2, Edit2,
} from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts'
import {
  format, parseISO, isPast, differenceInHours, differenceInDays,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { TimetableGrid } from '@/components/timetable/TimetableGrid'
import { GanttTab } from '@/components/group/GanttTab'
import type {
  GroupSummary, GroupDetail, TeamMember, MemberRole, ProjectTask,
  TaskStatus, AvailabilitySlot, PeerReviewRequest,
  EcampusCourse, Timetable, UpdateTaskRequest,
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

type Tab = 'home' | 'timetable' | 'availability' | 'roles' | 'tasks' | 'gantt' | 'review' | 'ecampus'

export default function GroupPage() {
  const queryClient = useQueryClient()
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.getGroups(),
  })

  const { data: groupDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['group', selectedGroupId],
    queryFn: () => api.getGroupDetail(selectedGroupId!),
    enabled: !!selectedGroupId,
  })

  const leaveMutation = useMutation({
    mutationFn: (id: number) => api.leaveGroup(id),
    onSuccess: () => {
      toast.success('그룹에서 나갔습니다.')
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setSelectedGroupId(null)
    },
  })

  const tabs: { id: Tab; label: string }[] = [
    { id: 'home', label: '팀 홈' },
    { id: 'timetable', label: '내 시간표' },
    { id: 'availability', label: '가능 시간' },
    { id: 'roles', label: '역할 배분' },
    { id: 'tasks', label: '과제 관리' },
    { id: 'gantt', label: '간트 차트' },
    { id: 'review', label: '동료 평가' },
    { id: 'ecampus', label: '과제 제출 이력' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#25231f] mb-1">팀 프로젝트</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /><span>팀 생성</span>
          </button>
          <button onClick={() => setShowJoinModal(true)} className="btn-secondary flex items-center gap-2">
            <UserPlus className="w-4 h-4" /><span>참가</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: group list */}
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="font-bold text-[#7a7169] mb-3 text-xs uppercase tracking-wider">내 팀</h2>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-14 bg-[#f2eee8] rounded-xl animate-pulse" />)}
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-8 text-[#b0a8a0]">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">팀이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map(g => (
                  <GroupCard
                    key={g.id}
                    group={g}
                    isSelected={selectedGroupId === g.id}
                    onSelect={() => { setSelectedGroupId(g.id); setActiveTab('home') }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main panel */}
        <div className="lg:col-span-3">
          {!selectedGroupId ? (
            <div className="card text-center py-16 text-[#b0a8a0]">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>팀을 선택하거나 새로 생성하세요</p>
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
              {activeTab === 'timetable' && (
                <TimetableTab />
              )}
              {activeTab === 'availability' && (
                <AvailabilityTab groupId={selectedGroupId} members={groupDetail.members} />
              )}
              {activeTab === 'roles' && (
                <RolesTab groupId={selectedGroupId} members={groupDetail.members} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['group', selectedGroupId] })} />
              )}
              {activeTab === 'tasks' && (
                <TasksTab groupId={selectedGroupId} members={groupDetail.members} />
              )}
              {activeTab === 'gantt' && (
                <GanttTab groupId={selectedGroupId} members={groupDetail.members} />
              )}
              {activeTab === 'review' && (
                <ReviewTab groupId={selectedGroupId} members={groupDetail.members} />
              )}
              {activeTab === 'ecampus' && (
                <EcampusTab />
              )}
            </div>
          ) : null}
        </div>
      </div>

      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(id) => {
            setSelectedGroupId(id)
            setShowCreateModal(false)
            queryClient.invalidateQueries({ queryKey: ['groups'] })
          }}
        />
      )}
      {showJoinModal && (
        <JoinGroupModal
          onClose={() => setShowJoinModal(false)}
          onJoined={() => {
            setShowJoinModal(false)
            queryClient.invalidateQueries({ queryKey: ['groups'] })
          }}
        />
      )}
    </div>
  )
}

// ─── GroupCard ─────────────────────────────────────────────────────────────────

function GroupCard({ group, isSelected, onSelect }: {
  group: GroupSummary; isSelected: boolean; onSelect: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
        isSelected
          ? 'border-[#4a8768] bg-[#4a8768]/8'
          : 'border-[#e7e0d7] hover:border-[#d0c8bf] bg-white/70'
      }`}
    >
      <p className="font-bold text-[#25231f] text-sm tracking-tight">{group.name}</p>
      <p className="text-xs text-[#b0a8a0] mt-0.5">{group.memberCount}명{group.projectDeadline ? ` · D-${Math.max(0, differenceInHours(parseISO(group.projectDeadline), new Date()) / 24 | 0)}` : ''}</p>
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
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="w-14 text-[#b0a8a0] font-normal py-1 pr-2 text-right">시간</th>
              {DAYS.map(d => (
                <th key={d} className="text-center text-[#7a7169] font-bold py-1 px-1 w-full">{DAY_LABELS[d]}</th>
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

function RolesTab({ groupId, members, onRefresh }: {
  groupId: number; members: TeamMember[]; onRefresh: () => void
}) {
  const roles: MemberRole[] = ['LEADER', 'RESEARCHER', 'PRESENTER', 'BACKEND', 'FRONTEND', 'AI', 'UNASSIGNED']

  const assignMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: number; role: MemberRole }) =>
      api.assignRole(groupId, memberId, role),
    onSuccess: () => { toast.success('역할이 변경되었습니다.'); onRefresh() },
  })

  const radarData = (member: TeamMember) => [
    { subject: '온도', value: Math.min(member.temperature, 42) / 42 * 100 },
    { subject: '기여', value: 70 },
    { subject: '소통', value: 75 },
    { subject: '일정', value: 80 },
    { subject: '품질', value: 65 },
  ]

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="font-bold text-[#25231f]">역할 배분</h3>
        <p className="text-xs text-[#b0a8a0]">팀장이 각 팀원의 역할을 지정합니다</p>
      </div>

      <div className="grid gap-4">
        {members.map(m => (
          <div key={m.userId} className="flex items-center gap-4 p-3.5 border border-[#e7e0d7] rounded-2xl bg-white/60">
            {/* Radar chart */}
            <div className="w-20 h-20 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData(m)} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8 }} />
                  <Radar dataKey="value" fill="#4a8768" fillOpacity={0.45} stroke="#4a8768" />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-[#25231f]">{m.name}</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${ROLE_COLORS[m.role]}`}>
                  {ROLE_LABELS[m.role]}
                </span>
                <span className={`text-sm font-extrabold ${tempColor(m.temperature)}`}>
                  {m.temperature.toFixed(1)}°
                </span>
              </div>
              <p className="text-xs text-[#b0a8a0]">{m.major} · {m.studentId}</p>
            </div>

            {/* Role selector */}
            <select
              className="input text-sm py-1.5 w-32"
              value={m.role}
              onChange={e => assignMutation.mutate({ memberId: m.memberId, role: e.target.value as MemberRole })}
            >
              {roles.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── TasksTab ─────────────────────────────────────────────────────────────────

function TasksTab({ groupId, members }: { groupId: number; members: TeamMember[] }) {
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

function CreateGroupModal({ onClose, onCreated }: {
  onClose: () => void; onCreated: (id: number) => void
}) {
  const [form, setForm] = useState({ name: '', description: '', githubRepoUrl: '', projectDeadline: '' })

  const createMutation = useMutation({
    mutationFn: () => api.createGroup({
      name: form.name,
      description: form.description || undefined,
      githubRepoUrl: form.githubRepoUrl || undefined,
      projectDeadline: form.projectDeadline || undefined,
    }),
    onSuccess: (data) => {
      toast.success(`팀 생성! 초대코드: ${data.inviteCode}`)
      onCreated(data.groupId)
    },
  })

  return (
    <Modal title="새 팀 생성" onClose={onClose}>
      <div className="space-y-3">
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

function TimetableTab() {
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

// ─── EcampusTab ───────────────────────────────────────────────────────────────

const SEMESTER_OPTIONS = [
  { value: '10', label: '1학기' },
  { value: '20', label: '2학기' },
  { value: '11', label: '여름계절' },
  { value: '21', label: '겨울계절' },
]
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => String(new Date().getFullYear() - 1 - i))

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

function EcampusCourseCard({ course }: { course: EcampusCourse }) {
  const [open, setOpen] = useState(false)
  const submitted = course.assignments.filter(a => a.submitted).length
  const total = course.assignments.length
  const hasUrgent = course.assignments.some(a => {
    if (a.submitted || !a.deadline) return false
    const d = parseISO(a.deadline)
    return !isPast(d) && differenceInDays(d, new Date()) <= 3
  })
  return (
    <div className={`border rounded-2xl overflow-hidden ${hasUrgent ? 'border-[#a8793d]/40' : 'border-[#e7e0d7]'}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-[#f2eee8]/60 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {hasUrgent && <span className="w-2 h-2 rounded-full bg-[#a8793d] flex-shrink-0" />}
            <p className="font-bold text-[#25231f] truncate text-sm">{course.courseName}</p>
          </div>
          {course.professor && <p className="text-xs text-[#b0a8a0] mt-0.5">{course.professor}</p>}
        </div>
        <div className="flex items-center gap-3 ml-3 flex-shrink-0">
          {total > 0 && (
            <span className="text-xs text-[#7a7169] font-medium">
              {submitted}/{total}
              {total - submitted > 0 && <span className="ml-1 text-[#a8793d] font-bold">({total - submitted} 미제출)</span>}
            </span>
          )}
          {open ? <ChevronDown className="w-4 h-4 text-[#b0a8a0]" /> : <ChevronRight className="w-4 h-4 text-[#b0a8a0]" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-[#e7e0d7] px-3 py-2 space-y-0.5 bg-[#f2eee8]/40">
          {total === 0 ? (
            <p className="text-sm text-[#b0a8a0] py-3 text-center">과제 없음</p>
          ) : course.assignments.map(a => (
            <div key={a.assignmentId} className="flex items-center justify-between py-2 px-2 rounded-xl hover:bg-white/60 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#25231f] truncate font-medium">{a.title}</p>
                <div className="flex gap-3 mt-0.5 text-xs text-[#b0a8a0]">
                  {a.deadline && <span>마감: {a.deadline.replace('T', ' ').slice(0, 16)}</span>}
                  {a.submitted && a.submittedAt && <span className="text-[#4a8768] font-medium">제출: {a.submittedAt.replace('T', ' ').slice(0, 16)}</span>}
                </div>
              </div>
              <div className="ml-3 flex-shrink-0">
                <EcampusDeadlineBadge deadline={a.deadline} submitted={a.submitted} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EcampusTab() {
  const user = useAuthStore(s => s.user)
  const studentId = user?.student_id ?? ''

  const [password, setPassword] = useState(() => localStorage.getItem('ecampus_pw') ?? '')
  const [showPw, setShowPw] = useState(false)
  const [tab, setTab] = useState<'current' | 'past'>('current')
  const [year, setYear] = useState(YEAR_OPTIONS[0])
  const [semester, setSemester] = useState('20')
  const [search, setSearch] = useState('')
  const [courses, setCourses] = useState<EcampusCourse[] | null>(null)

  const fetchMutation = useMutation({
    mutationFn: ({ pw, t, y, s }: { pw: string; t: 'current' | 'past'; y: string; s: string }) =>
      t === 'current'
        ? api.getEcampusCurrent({ studentId, password: pw })
        : api.getEcampusPast({ studentId, password: pw }, y, s),
    onSuccess: data => setCourses(data),
    onError: () => {
      setPassword('')
      localStorage.removeItem('ecampus_pw')
      setCourses(null)
    },
  })

  const handleFetch = (pw: string, t = tab, y = year, s = semester) => {
    localStorage.setItem('ecampus_pw', pw)
    setPassword(pw)
    fetchMutation.mutate({ pw, t, y, s })
  }

  const filtered = useMemo(() => {
    if (!courses) return []
    if (!search.trim()) return courses
    const q = search.toLowerCase()
    return courses.filter(c =>
      c.courseName.toLowerCase().includes(q) ||
      c.professor.toLowerCase().includes(q) ||
      c.assignments.some(a => a.title.toLowerCase().includes(q))
    )
  }, [courses, search])

  const stats = useMemo(() => {
    if (!courses) return null
    const all = courses.flatMap(c => c.assignments)
    return {
      total: all.length,
      submitted: all.filter(a => a.submitted).length,
      pending: all.filter(a => !a.submitted).length,
      urgent: all.filter(a => {
        if (a.submitted || !a.deadline) return false
        const d = parseISO(a.deadline)
        return !isPast(d) && differenceInDays(d, new Date()) <= 3
      }).length,
    }
  }, [courses])

  // 비밀번호 있으면 마운트 시 자동 로드
  useState(() => {
    const saved = localStorage.getItem('ecampus_pw')
    if (saved && !courses) fetchMutation.mutate({ pw: saved, t: 'current', y: YEAR_OPTIONS[0], s: '20' })
  })

  if (!password && !fetchMutation.isPending) {
    return (
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#4a8768]" />
          <h3 className="font-bold text-[#25231f]">e캠퍼스 과제 제출 이력</h3>
        </div>
        <p className="text-sm text-[#7a7169]">세종대 포털 비밀번호로 과제 제출 현황을 불러옵니다.</p>
        <div className="space-y-3 max-w-sm">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="포털 비밀번호"
              className="input pr-10"
              onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value) handleFetch(e.currentTarget.value) }}
              onChange={e => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={() => password && handleFetch(password)} disabled={!password} className="btn-primary w-full">
            불러오기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#4a8768]" />
          <h3 className="font-bold text-[#25231f]">과제 제출 이력</h3>
        </div>
        <button
          onClick={() => { setPassword(''); localStorage.removeItem('ecampus_pw'); setCourses(null) }}
          className="text-xs text-[#b0a8a0] hover:text-[#6f4141] font-medium"
        >
          연동 해제
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        {(['current', 'past'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setCourses(null); if (password) handleFetch(password, t, year, semester) }}
            className={`tab-btn ${tab === t ? 'tab-btn-active' : 'tab-btn-inactive'}`}
          >
            {t === 'current' ? '현재학기' : '이전학기'}
          </button>
        ))}
      </div>

      {tab === 'past' && (
        <div className="flex gap-2 flex-wrap">
          <select className="input text-sm py-1.5 w-auto" value={year} onChange={e => setYear(e.target.value)}>
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select className="input text-sm py-1.5 w-auto" value={semester} onChange={e => setSemester(e.target.value)}>
            {SEMESTER_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button onClick={() => handleFetch(password, 'past', year, semester)} className="btn-primary text-sm py-1.5">조회</button>
        </div>
      )}

      {fetchMutation.isPending && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-[#f2eee8] rounded-2xl animate-pulse" />)}
        </div>
      )}

      {fetchMutation.isError && (
        <div className="p-3 rounded-2xl border border-[#6f4141]/30 bg-[#6f4141]/8 text-sm text-[#6f4141] font-medium">
          로그인 실패. 비밀번호를 확인해주세요.
        </div>
      )}

      {courses && !fetchMutation.isPending && (
        <>
          {stats && stats.total > 0 && (
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
          )}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#b0a8a0]" />
            <input
              type="text"
              placeholder="강의명, 교수명, 과제명 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9 text-sm"
            />
          </div>
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="text-center py-8 text-[#b0a8a0] text-sm">
                {search ? '검색 결과 없음' : '강의 없음'}
              </p>
            ) : filtered.map(c => <EcampusCourseCard key={c.courseId} course={c} />)}
          </div>
        </>
      )}
    </div>
  )
}
