import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { Search, Users, User, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

const navItems = [
  { path: '/group', label: '내 팀', icon: Users, tab: null },
  { path: '/group?tab=find', label: '팀 찾기', icon: Search, tab: 'find' },
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout: clearUser } = useAuthStore()

  const isNavActive = (item: typeof navItems[number]) => {
    if (location.pathname !== '/group') return false
    const params = new URLSearchParams(location.search)
    return item.tab === (params.get('tab') ?? null)
  }

  const handleLogout = async () => {
    try {
      await api.logout()
      clearUser()
      navigate('/login')
      toast.success('로그아웃되었습니다.')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--screen-bg)', fontFamily: 'var(--ui-font)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md"
        style={{
          background: 'rgba(245, 245, 244, 0.85)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 1px 12px rgba(38,32,25,0.06)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--sage)' }}>
                Check-Mate
              </h1>
              <nav className="hidden md:flex gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={() =>
                        `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold tracking-tight transition-all duration-200 ${
                          isNavActive(item)
                            ? 'bg-[#4a8768] text-white shadow-sm'
                            : 'text-[#7a7169] hover:bg-[#f2eee8] hover:text-[#25231f]'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  )
                })}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <NavLink
                to="/profile"
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold tracking-tight text-[#7a7169] hover:bg-[#f2eee8] hover:text-[#25231f] transition-all duration-200"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{user?.nickname || '사용자'}</span>
              </NavLink>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold tracking-tight text-[#7a7169] hover:bg-[#f2eee8] hover:text-[#6f4141] transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-md"
        style={{
          background: 'rgba(245, 245, 244, 0.92)',
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex justify-around">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={() =>
                  `flex flex-col items-center justify-center py-2.5 px-4 flex-1 text-xs font-bold tracking-tight transition-all ${
                    isNavActive(item) ? 'text-[#4a8768]' : 'text-[#b0a8a0]'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span className="mt-1">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        <Outlet />
      </main>
    </div>
  )
}
