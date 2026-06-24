import { useState, useMemo, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { differenceInDays, differenceInHours, parseISO, isPast } from 'date-fns'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Search,
} from 'lucide-react'
import type { EcampusCourse, EcampusAssignment } from '@/types'

const SEMESTER_OPTIONS = [
  { value: '10', label: '1학기' },
  { value: '20', label: '2학기' },
  { value: '11', label: '여름계절' },
  { value: '21', label: '겨울계절' },
]

const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => String(new Date().getFullYear() - 1 - i))

function DeadlineBadge({ deadline, submitted }: { deadline: string | null; submitted: boolean }) {
  if (submitted) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle2 className="w-3 h-3" /> 제출완료
      </span>
    )
  }
  if (!deadline) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        <AlertCircle className="w-3 h-3" /> 마감 미정
      </span>
    )
  }

  const deadlineDate = parseISO(deadline)
  if (isPast(deadlineDate)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle className="w-3 h-3" /> 기한초과
      </span>
    )
  }

  const daysLeft = differenceInDays(deadlineDate, new Date())
  const hoursLeft = differenceInHours(deadlineDate, new Date())

  if (hoursLeft < 24) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 animate-pulse">
        <Clock className="w-3 h-3" /> {hoursLeft}시간 남음
      </span>
    )
  }
  if (daysLeft <= 3) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
        <Clock className="w-3 h-3" /> D-{daysLeft}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
      <Clock className="w-3 h-3" /> D-{daysLeft}
    </span>
  )
}

function AssignmentRow({ assignment }: { assignment: EcampusAssignment }) {
  const formatDate = (iso: string | null) => {
    if (!iso) return '-'
    return iso.replace('T', ' ').slice(0, 16)
  }

  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{assignment.title}</p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
          <span>마감: {formatDate(assignment.deadline)}</span>
          {assignment.submitted && assignment.submittedAt && (
            <span className="text-green-600">제출: {formatDate(assignment.submittedAt)}</span>
          )}
        </div>
      </div>
      <div className="ml-3 flex-shrink-0">
        <DeadlineBadge deadline={assignment.deadline} submitted={assignment.submitted} />
      </div>
    </div>
  )
}

function CourseCard({ course }: { course: EcampusCourse }) {
  const [open, setOpen] = useState(false)

  const submittedCount = course.assignments.filter((a) => a.submitted).length
  const totalCount = course.assignments.length
  const pendingCount = totalCount - submittedCount
  const hasUrgent = course.assignments.some((a) => {
    if (a.submitted || !a.deadline) return false
    return differenceInDays(parseISO(a.deadline), new Date()) <= 3 && !isPast(parseISO(a.deadline))
  })

  return (
    <div className={`card p-0 overflow-hidden border ${hasUrgent ? 'border-orange-200' : 'border-gray-100'}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {hasUrgent && <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />}
            <p className="font-semibold text-gray-900 truncate">{course.courseName}</p>
          </div>
          {course.professor && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{course.professor}</p>
          )}
        </div>
        <div className="flex items-center gap-3 ml-3 flex-shrink-0">
          {totalCount > 0 && (
            <span className="text-xs text-gray-500">
              {submittedCount}/{totalCount}
              {pendingCount > 0 && (
                <span className="ml-1 text-orange-600 font-medium">({pendingCount} 미제출)</span>
              )}
            </span>
          )}
          {open ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-3 py-2 space-y-0.5 bg-gray-50/50">
          {totalCount === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center">과제가 없습니다</p>
          ) : (
            course.assignments.map((a) => (
              <AssignmentRow key={a.assignmentId} assignment={a} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function PasswordForm({
  studentId,
  onSubmit,
}: {
  studentId: string
  onSubmit: (password: string) => void
}) {
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)

  return (
    <div className="card max-w-md mx-auto mt-16">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-6 h-6 text-primary-600" />
        <h2 className="text-lg font-semibold">e캠퍼스 연동</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        세종대 포털 비밀번호로 e캠퍼스 강의·과제 정보를 불러옵니다.
        <br />
        비밀번호는 이 기기에 저장되어 다음 방문 시 자동으로 연동됩니다.
      </p>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">학번</label>
          <input
            value={studentId}
            readOnly
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">포털 비밀번호</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pw && onSubmit(pw)}
              placeholder="비밀번호 입력"
              className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <button
          onClick={() => pw && onSubmit(pw)}
          disabled={!pw}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          불러오기
        </button>
      </div>
    </div>
  )
}

export default function EcampusPage() {
  const user = useAuthStore((state) => state.user)
  const studentId = user?.student_id ?? ''

  const [password, setPassword] = useState<string>(() => localStorage.getItem('ecampus_pw') ?? '')
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
    onSuccess: (data) => setCourses(data),
    onError: () => {
      setPassword('')
      localStorage.removeItem('ecampus_pw')
      setCourses(null)
    },
  })

  const handlePasswordSubmit = (pw: string) => {
    localStorage.setItem('ecampus_pw', pw)
    setPassword(pw)
    fetchMutation.mutate({ pw, t: tab, y: year, s: semester })
  }

  const handleTabChange = (t: 'current' | 'past') => {
    setTab(t)
    setCourses(null)
    if (password) {
      fetchMutation.mutate({ pw: password, t, y: year, s: semester })
    }
  }

  const handlePastSearch = () => {
    setCourses(null)
    if (password) {
      fetchMutation.mutate({ pw: password, t: 'past', y: year, s: semester })
    }
  }

  const filteredCourses = useMemo(() => {
    if (!courses) return []
    if (!search.trim()) return courses
    const q = search.toLowerCase()
    return courses.filter(
      (c) =>
        c.courseName.toLowerCase().includes(q) ||
        c.professor.toLowerCase().includes(q) ||
        c.assignments.some((a) => a.title.toLowerCase().includes(q))
    )
  }, [courses, search])

  const stats = useMemo(() => {
    if (!courses) return null
    const allAssignments = courses.flatMap((c) => c.assignments)
    return {
      total: allAssignments.length,
      submitted: allAssignments.filter((a) => a.submitted).length,
      pending: allAssignments.filter((a) => !a.submitted).length,
      urgent: allAssignments.filter((a) => {
        if (a.submitted || !a.deadline) return false
        const d = parseISO(a.deadline)
        return !isPast(d) && differenceInDays(d, new Date()) <= 3
      }).length,
    }
  }, [courses])

  // 비밀번호가 저장돼 있으면 마운트 시 자동 fetch
  useEffect(() => {
    if (password && !courses && !fetchMutation.isPending) {
      fetchMutation.mutate({ pw: password, t: tab, y: year, s: semester })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!password) {
    return <PasswordForm studentId={studentId} onSubmit={handlePasswordSubmit} />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">과제 제출 현황</h1>
        <p className="text-gray-500 text-sm">e캠퍼스 강의 및 과제 현황</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        <button
          onClick={() => handleTabChange('current')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'current'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          현재학기
        </button>
        <button
          onClick={() => handleTabChange('past')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'past'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          이전학기
        </button>
      </div>

      {/* 이전학기 셀렉터 */}
      {tab === 'past' && (
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {SEMESTER_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button onClick={handlePastSearch} className="btn-primary text-sm py-2">
            조회
          </button>
        </div>
      )}

      {/* 로딩 */}
      {fetchMutation.isPending && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-16" />
          ))}
        </div>
      )}

      {/* 에러 */}
      {fetchMutation.isError && (
        <div className="card border border-red-200 bg-red-50">
          <p className="text-sm text-red-700 font-medium">로그인에 실패했습니다. 비밀번호를 확인해주세요.</p>
          <button
            onClick={() => {
              setPassword('')
              localStorage.removeItem('ecampus_pw')
            }}
            className="text-sm text-red-600 underline mt-1"
          >
            다시 입력
          </button>
        </div>
      )}

      {/* 결과 */}
      {courses && !fetchMutation.isPending && (
        <>
          {/* 요약 통계 */}
          {stats && stats.total > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: '전체 과제', value: stats.total, color: 'text-gray-700' },
                { label: '제출완료', value: stats.submitted, color: 'text-green-600' },
                { label: '미제출', value: stats.pending, color: 'text-orange-600' },
                { label: '마감임박(3일)', value: stats.urgent, color: 'text-red-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="card py-3 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* 검색 */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="강의명, 교수명, 과제명 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* 강의 목록 */}
          <div className="space-y-3">
            {filteredCourses.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>{search ? '검색 결과가 없습니다' : '강의가 없습니다'}</p>
              </div>
            ) : (
              filteredCourses.map((course) => (
                <CourseCard key={course.courseId} course={course} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
