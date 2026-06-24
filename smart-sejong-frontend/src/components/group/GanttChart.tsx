import { useEffect, useRef } from 'react'
import Gantt from 'frappe-gantt'
import type { ProjectTask, GanttTask, TaskStatus } from '@/types'
import { format, parseISO, addDays } from 'date-fns'

import '../../styles/frappe-gantt.css'

interface GanttChartProps {
  tasks: ProjectTask[]
  viewMode: 'Day' | 'Week' | 'Month'
  onDateChange?: (taskId: number, startDate: string, deadline: string) => void
  onProgressChange?: (taskId: number, progress: number) => void
  onTaskClick?: (task: ProjectTask) => void
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  PENDING: 'gantt-pending',
  SUBMITTED: 'gantt-submitted',
  LATE: 'gantt-late',
  APPROVED: 'gantt-approved',
  REJECTED: 'gantt-rejected',
}

export function GanttChart({
  tasks,
  viewMode,
  onDateChange,
  onProgressChange,
  onTaskClick,
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const ganttRef = useRef<Gantt | null>(null)
  const tasksMapRef = useRef<Map<string, ProjectTask>>(new Map())

  // 콜백을 ref로 관리 — 함수 참조 변경이 effect를 재실행시키지 않도록
  const onDateChangeRef = useRef(onDateChange)
  const onProgressChangeRef = useRef(onProgressChange)
  const onTaskClickRef = useRef(onTaskClick)
  useEffect(() => { onDateChangeRef.current = onDateChange }, [onDateChange])
  useEffect(() => { onProgressChangeRef.current = onProgressChange }, [onProgressChange])
  useEffect(() => { onTaskClickRef.current = onTaskClick }, [onTaskClick])

  useEffect(() => {
    if (!containerRef.current || tasks.length === 0) return

    const ganttTasks: GanttTask[] = tasks.map((task) => {
      const today = new Date()
      const start = task.startDate
        ? format(parseISO(task.startDate), 'yyyy-MM-dd')
        : format(today, 'yyyy-MM-dd')
      const end = task.deadline
        ? format(parseISO(task.deadline), 'yyyy-MM-dd')
        : format(addDays(today, 7), 'yyyy-MM-dd')
      tasksMapRef.current.set(String(task.id), task)
      return {
        id: String(task.id),
        name: task.title,
        start,
        end,
        progress: task.progress ?? 0,
        custom_class: STATUS_COLORS[task.status],
      }
    })

    if (ganttRef.current) {
      // 스크롤 위치 저장 후 refresh — frappe-gantt가 today로 scroll 이동하는 것 방지
      const savedScroll = containerRef.current.scrollLeft
      ganttRef.current.refresh(ganttTasks)
      requestAnimationFrame(() => {
        if (containerRef.current) containerRef.current.scrollLeft = savedScroll
      })
    } else {
      ganttRef.current = new Gantt(containerRef.current, ganttTasks, {
        view_mode: viewMode,
        date_format: 'YYYY-MM-DD',
        language: 'ko',
        custom_popup_html: (task: GanttTask) => {
          const projectTask = tasksMapRef.current.get(task.id)
          if (!projectTask) return ''
          return `
            <div class="gantt-popup">
              <h5 class="gantt-popup-title">${task.name}</h5>
              <p class="gantt-popup-subtitle">${projectTask.assigneeName || '미배정'}</p>
              <div class="gantt-popup-dates">
                <span>${task.start} ~ ${task.end}</span>
              </div>
              <div class="gantt-popup-progress">
                <span>진행률: ${task.progress}%</span>
              </div>
            </div>
          `
        },
        on_click: (task: GanttTask) => {
          const projectTask = tasksMapRef.current.get(task.id)
          if (projectTask) onTaskClickRef.current?.(projectTask)
        },
        on_date_change: (task: GanttTask, start: Date, end: Date) => {
          onDateChangeRef.current?.(
            Number(task.id),
            format(start, "yyyy-MM-dd'T'HH:mm:ss"),
            format(end, "yyyy-MM-dd'T'HH:mm:ss")
          )
        },
        on_progress_change: (task: GanttTask, progress: number) => {
          onProgressChangeRef.current?.(Number(task.id), progress)
        },
      })
    }
    // cleanup 없음 — gantt 인스턴스를 유지해야 스크롤 위치가 보존됨
  }, [tasks, viewMode])

  // unmount 시에만 인스턴스 해제
  useEffect(() => {
    return () => { ganttRef.current = null }
  }, [])

  useEffect(() => {
    if (ganttRef.current) {
      ganttRef.current.change_view_mode(viewMode)
    }
  }, [viewMode])


  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-[#b0a8a0]">
        <p className="text-sm">간트 차트에 표시할 과제가 없습니다</p>
        <p className="text-xs mt-1">과제를 추가하면 여기에 타임라인이 표시됩니다</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .gantt-container {
          overflow-x: auto;
        }
        .gantt .bar-wrapper:hover .bar {
          fill: #4a8768 !important;
        }
        .gantt .bar-wrapper .bar {
          transition: fill 0.2s ease;
        }
        .gantt .bar-progress {
          fill: #4a8768 !important;
        }
        .gantt .bar.gantt-pending .bar-progress {
          fill: #31465d !important;
        }
        .gantt .bar.gantt-submitted .bar-progress {
          fill: #4a8768 !important;
        }
        .gantt .bar.gantt-late .bar-progress {
          fill: #6f4141 !important;
        }
        .gantt .bar.gantt-approved .bar-progress {
          fill: #3d7258 !important;
        }
        .gantt .bar.gantt-rejected .bar-progress {
          fill: #b0a8a0 !important;
        }
        .gantt .bar-label {
          fill: #25231f !important;
          font-weight: 600 !important;
          font-size: 12px !important;
        }
        .gantt .lower-text, .gantt .upper-text {
          fill: #7a7169 !important;
          font-size: 11px !important;
        }
        .gantt .grid-header {
          fill: #f2eee8 !important;
        }
        .gantt .grid-row {
          fill: #ffffff !important;
        }
        .gantt .grid-row:nth-child(even) {
          fill: #faf9f7 !important;
        }
        .gantt .row-line {
          stroke: #e7e0d7 !important;
        }
        .gantt .tick {
          stroke: #e7e0d7 !important;
        }
        .gantt .today-highlight {
          fill: #4a8768 !important;
          opacity: 0.15 !important;
        }
        .gantt-popup {
          padding: 12px;
          background: rgba(255, 255, 255, 0.98);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          min-width: 180px;
        }
        .gantt-popup-title {
          font-weight: 700;
          font-size: 14px;
          color: #25231f;
          margin: 0 0 4px 0;
        }
        .gantt-popup-subtitle {
          font-size: 12px;
          color: #7a7169;
          margin: 0 0 8px 0;
        }
        .gantt-popup-dates {
          font-size: 11px;
          color: #b0a8a0;
        }
        .gantt-popup-progress {
          font-size: 11px;
          color: #4a8768;
          font-weight: 600;
          margin-top: 4px;
        }
        .popup-wrapper {
          background: transparent !important;
          box-shadow: none !important;
        }
      `}</style>
      <div ref={containerRef} className="gantt-container" />
    </>
  )
}
