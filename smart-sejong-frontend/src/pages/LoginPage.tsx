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
  const [professorName, setProfessorName] = useState('')
  const [showProfessorInput, setShowProfessorInput] = useState(false)
  const [showDemoInput, setShowDemoInput] = useState(false)

  const DEMO_MEMBERS = [
    { name: '정리더', role: '팀장' },
    { name: '홍에이스', role: 'AI' },
    { name: '이소통', role: '발표' },
    { name: '박묵묵', role: '백엔드' },
    { name: '최마감', role: '프론트' },
    { name: '김무임', role: '자료조사' },
  ]

  const handleDemoLogin = async (name: string) => {
    setIsLoggingIn(true)
    try {
      const response = await api.demoLogin(name)
      if (response.accessToken) {
        localStorage.setItem('token', response.accessToken)
        if (response.refreshToken) localStorage.setItem('refreshToken', response.refreshToken)
      }
      if (response.user) {
        setUser({
          nickname: response.user.fullName || name,
          fullName: response.user.fullName,
          studentId: response.user.studentId,
          student_id: response.user.studentId,
          major: response.user.major,
          grade: response.user.grade,
          role: response.user.role as any,
          is_verified: true,
          profile_image: undefined,
        })
      }
      toast.success(`${name}으로 로그인됐습니다.`)
      navigate('/group', { replace: true })
    } catch (error: any) {
      toast.error(error?.message || '로그인에 실패했습니다.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleProfessorLogin = async () => {
    const name = professorName.trim()
    if (!name) {
      toast.error('교수님 이름을 입력해주세요.')
      return
    }
    setIsLoggingIn(true)
    try {
      const response = await api.professorMockLogin(name)
      if (response.accessToken) {
        localStorage.setItem('token', response.accessToken)
        if (response.refreshToken) localStorage.setItem('refreshToken', response.refreshToken)
      }
      if (response.user) {
        setUser({
          nickname: response.user.fullName || name,
          fullName: response.user.fullName,
          studentId: response.user.studentId,
          student_id: response.user.studentId,
          major: response.user.major,
          grade: response.user.grade,
          role: response.user.role as any,
          is_verified: true,
          profile_image: undefined,
        })
      }
      toast.success(`${name} 교수님으로 로그인됐습니다.`)
      navigate('/group', { replace: true })
    } catch (error: any) {
      toast.error(error?.message || '로그인에 실패했습니다.')
    } finally {
      setIsLoggingIn(false)
    }
  }

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

          <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
            {/* 교수 가계정 */}
            {!showProfessorInput ? (
              <button
                type="button"
                onClick={() => { setShowProfessorInput(true); setShowDemoInput(false) }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1.5px dashed #6366f1' }}
              >
                교수 가계정으로 로그인
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold" style={{ color: '#6366f1' }}>교수 가계정 (테스트용)</p>
                <input
                  type="text"
                  value={professorName}
                  onChange={(e) => setProfessorName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleProfessorLogin()}
                  className="input"
                  placeholder="교수님 이름 입력 (예: 홍길동)"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button type="button" onClick={handleProfessorLogin}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: '#6366f1', color: '#fff' }}>
                    교수로 로그인
                  </button>
                  <button type="button" onClick={() => { setShowProfessorInput(false); setProfessorName('') }}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}>
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 데모 팀 가계정 */}
            {!showDemoInput ? (
              <button
                type="button"
                onClick={() => { setShowDemoInput(true); setShowProfessorInput(false) }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981', border: '1.5px dashed #10b981' }}
              >
                🤖 데모 팀원으로 로그인 (AI 분석 시연)
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold" style={{ color: '#10b981' }}>스마트 홈 팀 데모 계정</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {DEMO_MEMBERS.map(m => (
                    <button
                      key={m.name}
                      type="button"
                      disabled={isLoggingIn}
                      onClick={() => handleDemoLogin(m.name)}
                      className="py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-50"
                      style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                    >
                      <div>{m.name}</div>
                      <div className="opacity-60">{m.role}</div>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setShowDemoInput(false)}
                  className="w-full py-1.5 rounded-xl text-xs"
                  style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)' }}>
                  접기
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
