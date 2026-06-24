import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId || !password) {
      toast.error('학번과 비밀번호를 입력해주세요.')
      return
    }

    setIsLoggingIn(true)
    try {
      const response = await api.login({ studentId, password })

      if (response.accessToken) {
        localStorage.setItem('token', response.accessToken)
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken)
        }
      }

      if (response.user) {
        setUser({
          nickname: response.user.fullName || response.user.studentId || '사용자',
          student_id: response.user.studentId,
          fullName: response.user.fullName,
          studentId: response.user.studentId,
          major: response.user.major,
          grade: response.user.grade,
          role: response.user.role,
          is_verified: true,
          profile_image: undefined,
        })
      }

      sessionStorage.setItem('ecampus_pw_once', password)
      toast.success('로그인에 성공했습니다!')
      navigate('/group', {
        replace: true,
        state: { ecampusPassword: password, autoFetchEcampus: true },
      })
    } catch (error: any) {
      console.error('Login error:', error)
      const errorMessage = error?.response?.data?.message || error?.message || '로그인에 실패했습니다.'
      toast.error(errorMessage)

      if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Failed to fetch')) {
        toast.error('백엔드 서버가 실행 중인지 확인해주세요. (http://localhost:8080)')
      }
    } finally {
      setIsLoggingIn(false)
    }
  }

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center px-4"
      style={{ background: 'var(--screen-bg)', fontFamily: 'var(--ui-font)' }}
    >
      {/* Decorative floating blobs */}
      <div
        className="pointer-events-none fixed top-[-120px] right-[-80px] w-[400px] h-[400px] rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, #4a8768 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed bottom-[-80px] left-[-60px] w-[320px] h-[320px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #31465d 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-[1000px] flex items-center gap-16 fade-in-up">

        {/* Left: brand copy */}
        <div className="flex-1 hidden md:block">
          <div className="mb-4 flex items-center gap-2">
            <span
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'var(--sage-light)', color: 'var(--sage)' }}
            >
              세종대학교
            </span>
          </div>
          <h1
            className="text-[48px] font-extrabold leading-[1.15] tracking-[-0.03em]"
            style={{ color: 'var(--text-primary)' }}
          >
            팀플을 더 스마트하게,<br />
            <span style={{ color: 'var(--sage)' }}>Check-Mate</span>
          </h1>
          <p className="mt-4 text-[16px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            팀원 역할 분배, 일정 조율, 과제 관리를<br />한 곳에서 관리하세요.
          </p>
        </div>

        {/* Right: login card */}
        <div
          className="w-full max-w-[420px] rounded-[28px] p-8"
          style={{
            background: 'rgba(255,255,255,0.88)',
            boxShadow: 'var(--card-shadow)',
            border: '1px solid rgba(0,0,0,0.05)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="mb-6">
            <h2
              className="text-[26px] font-extrabold tracking-[-0.02em]"
              style={{ color: 'var(--text-primary)' }}
            >
              로그인
            </h2>
            <p className="mt-1 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
              세종대학교 포털 계정으로 로그인합니다
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                className="block text-sm font-bold mb-1.5"
                style={{ color: 'var(--text-primary)' }}
              >
                학번
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="input"
                placeholder="학번을 입력하세요"
                required
              />
            </div>
            <div>
              <label
                className="block text-sm font-bold mb-1.5"
                style={{ color: 'var(--text-primary)' }}
              >
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="비밀번호를 입력하세요"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full btn-primary mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoggingIn ? '로그인 중...' : '로그인하기'}
            </button>
          </form>

          <p className="text-xs mt-5 text-center" style={{ color: 'var(--text-muted)' }}>
            학번과 포털 비밀번호를 사용합니다
          </p>
        </div>
      </div>
    </div>
  )
}
