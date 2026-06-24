import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import GroupPage from './pages/GroupPage'
import ProfilePage from './pages/ProfilePage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  const setUser = useAuthStore((state) => state.setUser)
  
  // 카카오 로그인 후 localStorage에서 사용자 정보 로드
  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        setUser(user)
      } catch (error) {
        console.error('Failed to parse user info:', error)
      }
    }
  }, [setUser])
  
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/group" replace />} />
          <Route path="group" element={<GroupPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        {/* 잘못된 경로 처리 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
