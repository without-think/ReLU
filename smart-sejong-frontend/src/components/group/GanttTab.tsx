import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, X, Calendar } from 'lucide-react'
import { GanttChart } from './GanttChart'
import type { ProjectTask, TeamMember } from '@/types'

interface GanttTabProps {
  groupId: number
  members: TeamMember[]
}

type ViewMode = 'Day' | 'Week' | 'Month'

export function GanttTab({ groupId, members }: GanttTabProps) {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>('Week')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    assigneeId: '',
    startDate: '',
    deadline: '',
  })

  const { data: tasks = [] } = useQuery<ProjectTask[]>({
    queryKey: ['tasks', groupId],
    queryFn: () => api.getTasks(groupId),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      api.createTask(groupId, {
        title: form.title,
        description: form.description || undefined,
        assigneeId: form.assigneeId ? Number(form.assigneeId) : undefined,
        startDate: form.startDate || undefined,
        deadline: form.deadline || undefined,
      }),
    onSuccess: () => {
      toast.success('과제가 생성되었습니다.')
      setShowAddForm(false)
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['tasks', groupId] })
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ taskId, ...request }: { taskId: number } & Parameters<typeof api.updateTask>[1]) =>
      api.updateTask(taskId, request),
    onSuccess: () => {
      toast.success('과제가 수정되었습니다.')
      setEditingTask(null)
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['tasks', groupId] })
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => api.deleteTask(taskId),
    onSuccess: () => {
      toast.success('과제가 삭제되었습니다.')
      setEditingTask(null)
      queryClient.invalidateQueries({ queryKey: ['tasks', groupId] })
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
    },
  })

  const updateDatesMutation = useMutation({
    mutationFn: ({ taskId, startDate, deadline }: { taskId: number; startDate: string; deadline: string }) =>
      api.updateTaskDates(taskId, startDate, deadline),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', groupId] })
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
    },
  })

  const updateProgressMutation = useMutation({
    mutationFn: ({ taskId, progress }: { taskId: number; progress: number }) =>
      api.updateTaskProgress(taskId, progress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', groupId] })
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
    },
  })

  const resetForm = () => {
    setForm({ title: '', description: '', assigneeId: '', startDate: '', deadline: '' })
  }

  const handleTaskClick = (task: ProjectTask) => {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description || '',
      assigneeId: task.assigneeId ? String(task.assigneeId) : '',
      startDate: task.startDate ? task.startDate.substring(0, 16) : '',
      deadline: task.deadline ? task.deadline.substring(0, 16) : '',
    })
    setShowAddForm(false)
  }

  const handleDateChange = (taskId: number, startDate: string, deadline: string) => {
    updateDatesMutation.mutate({ taskId, startDate, deadline })
  }

  const handleProgressChange = (taskId: number, progress: number) => {
    updateProgressMutation.mutate({ taskId, progress })
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
      })
    } else {
      createMutation.mutate()
    }
  }

  const viewModes: ViewMode[] = ['Day', 'Week', 'Month']
  const viewModeLabels: Record<ViewMode, string> = {
    Day: '일',
    Week: '주',
    Month: '월',
  }

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#4a8768]" />
          <h3 className="font-bold text-[#25231f]">간트 차트</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode selector */}
          <div className="flex bg-[#f2eee8] rounded-full p-0.5">
            {viewModes.map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                  viewMode === mode
                    ? 'bg-white text-[#25231f] shadow-sm'
                    : 'text-[#7a7169] hover:text-[#25231f]'
                }`}
              >
                {viewModeLabels[mode]}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setShowAddForm((v) => !v)
              setEditingTask(null)
              resetForm()
            }}
            className="btn-primary text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            <span>과제 추가</span>
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingTask) && (
        <div className="border border-dashed border-[#4a8768]/40 rounded-2xl p-4 space-y-3 bg-[#4a8768]/6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#25231f]">
              {editingTask ? '과제 수정' : '새 과제 추가'}
            </span>
            <button
              onClick={() => {
                setShowAddForm(false)
                setEditingTask(null)
                resetForm()
              }}
              className="text-[#b0a8a0] hover:text-[#7a7169]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            className="input"
            placeholder="과제 제목 *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />

          <textarea
            className="input resize-none"
            rows={2}
            placeholder="설명 (선택)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />

          <select
            className="input"
            value={form.assigneeId}
            onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value }))}
          >
            <option value="">담당자 선택 (선택)</option>
            {members.map((m) => (
              <option key={m.userId} value={String(m.userId)}>
                {m.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#7a7169] block mb-1">시작일</label>
              <input
                type="datetime-local"
                className="input"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-[#7a7169] block mb-1">마감일</label>
              <input
                type="datetime-local"
                className="input"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={!form.title || createMutation.isPending || updateMutation.isPending}
              className="btn-primary text-sm flex-1"
            >
              {createMutation.isPending || updateMutation.isPending
                ? '저장 중...'
                : editingTask
                ? '수정'
                : '생성'}
            </button>
            {editingTask && (
              <button
                onClick={() => deleteMutation.mutate(editingTask.id)}
                disabled={deleteMutation.isPending}
                className="btn-secondary text-sm text-[#6f4141]"
              >
                {deleteMutation.isPending ? '삭제 중...' : '삭제'}
              </button>
            )}
            <button
              onClick={() => {
                setShowAddForm(false)
                setEditingTask(null)
                resetForm()
              }}
              className="btn-secondary text-sm"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Gantt Chart */}
      <div className="border border-[#e7e0d7] rounded-2xl overflow-hidden bg-white">
        <GanttChart
          tasks={tasks}
          viewMode={viewMode}
          onDateChange={handleDateChange}
          onProgressChange={handleProgressChange}
          onTaskClick={handleTaskClick}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-[#7a7169]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#31465d] rounded" />
          <span>진행중</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#4a8768] rounded" />
          <span>제출완료</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#6f4141] rounded" />
          <span>지각제출</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#3d7258] rounded" />
          <span>승인됨</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#b0a8a0] rounded" />
          <span>반려됨</span>
        </div>
        <span className="ml-auto text-[#b0a8a0]">
          드래그로 날짜 변경 · 바 클릭으로 수정
        </span>
      </div>
    </div>
  )
}
