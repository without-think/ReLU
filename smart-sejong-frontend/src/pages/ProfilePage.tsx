import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { BookOpen, CheckCircle2, CreditCard, GraduationCap, MessageSquare, Users } from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts'
import type { ReactNode } from 'react'
import type { GroupDetail, GroupSummary, MemberRole, MemberScore, PeerReviewSummary, ReviewComment, UserInfo } from '@/types'

interface ReviewSummaryWithGroup extends PeerReviewSummary {
  groupId: number
  groupName: string
  courseName: string
  projectDeadline: string | null
}

interface RadarAngleTickProps {
  x?: number
  y?: number
  textAnchor?: 'start' | 'middle' | 'end' | 'inherit'
  payload?: {
    value?: string
  }
}

interface CompletedProject {
  id: number
  teamName: string
  courseName: string
  role: MemberRole
  projectDeadline: string | null
  avgContributionScore: number
  reviewCount: number
}

interface ProfileReview extends ReviewComment {
  groupId: number
  groupName: string
  courseName: string
  role: MemberRole
}

const ROLE_LABELS: Record<MemberRole, string> = {
  UNASSIGNED: '미배정',
  LEADER: '팀장',
  RESEARCHER: '자료조사',
  PRESENTER: '발표',
  BACKEND: '백엔드',
  FRONTEND: '프론트',
  AI: 'AI',
}

const metricDescriptions = [
  { name: '기여도', description: '팀 프로젝트에 얼마나 적극적으로 참여하고 실질적인 결과물을 만들었는지 나타냅니다.' },
  { name: '소통', description: '팀원과 의견을 나누고 필요한 정보를 제때 공유했는지 나타냅니다.' },
  { name: '지식/기술', description: '과제 수행에 필요한 전공 지식과 기술 역량을 얼마나 잘 활용했는지 나타냅니다.' },
  { name: '품질', description: '맡은 작업의 완성도와 제출 결과물의 품질을 나타냅니다.' },
  { name: '일정관리', description: '마감과 약속을 지키고 진행 상황을 안정적으로 관리했는지 나타냅니다.' },
]

function normalizeGrade(grade?: string | null) {
  if (!grade) return null
  const number = grade.replace(/[^0-9]/g, '')
  return number ? `${number}학년` : grade
}

function currentSemesterLabel() {
  const month = new Date().getMonth() + 1
  return month >= 3 && month <= 8 ? '1학기' : '2학기'
}

function academicTerm(grade?: string | null) {
  const normalizedGrade = normalizeGrade(grade)
  return normalizedGrade ? `${normalizedGrade} ${currentSemesterLabel()}` : currentSemesterLabel()
}

function findMyScore(scores: MemberScore[] | undefined, userInfo?: UserInfo) {
  const ids = [userInfo?.id, userInfo?.userId].filter((id): id is number => typeof id === 'number')
  const byId = scores?.find((score) => ids.includes(score.userId))
  if (byId) return byId

  const names = [userInfo?.fullName, userInfo?.nickname].filter(Boolean)
  return scores?.find((score) => names.includes(score.name)) ?? null
}

function RadarAngleTick({ x = 0, y = 0, textAnchor = 'middle', payload }: RadarAngleTickProps) {
  const value = payload?.value ?? ''
  const contributionOffset = value === '기여도' ? -14 : 0

  return (
    <text
      x={x}
      y={y + contributionOffset}
      textAnchor={textAnchor}
      fill="#7a7169"
      fontSize={13}
      dominantBaseline="central"
    >
      {value}
    </text>
  )
}

export default function ProfilePage() {
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [showAllProjects, setShowAllProjects] = useState(false)
  const [showMetricHelp, setShowMetricHelp] = useState(false)
  const { setUser } = useAuthStore()

  const { data: userInfo, isLoading } = useQuery<UserInfo>({
    queryKey: ['user-info'],
    queryFn: async () => {
      const profile = await api.getMyInfo()
      setUser(profile)
      return profile
    },
  })

  const { data: groups = [] } = useQuery<GroupSummary[]>({
    queryKey: ['groups'],
    queryFn: () => api.getGroups(),
    refetchOnMount: 'always',
  })

  const myGroups = useMemo(() => groups.filter((group) => group.joined), [groups])

  const completedGroups = useMemo(() => {
    const now = Date.now()
    return myGroups
      .filter((group) => group.completed || (group.projectDeadline && new Date(group.projectDeadline).getTime() < now))
      .sort((a, b) => {
        const aTime = a.projectDeadline ? new Date(a.projectDeadline).getTime() : 0
        const bTime = b.projectDeadline ? new Date(b.projectDeadline).getTime() : 0
        return bTime - aTime
      })
  }, [myGroups])

  const { data: reviewSummaries = [] } = useQuery<ReviewSummaryWithGroup[]>({
    queryKey: ['profile-reviews', completedGroups.map((group) => group.id)],
    queryFn: async () => {
      const summaries = await Promise.all(
        completedGroups.map(async (group) => {
          try {
            const summary = await api.getPeerReviewSummary(group.id)
            return {
              ...summary,
              groupId: group.id,
              groupName: group.name,
              courseName: group.courseName || '과목 정보 없음',
              projectDeadline: group.projectDeadline,
            }
          } catch {
            return null
          }
        })
      )
      return summaries.filter((summary): summary is ReviewSummaryWithGroup => !!summary)
    },
    enabled: completedGroups.length > 0,
    refetchOnMount: 'always',
  })

  const { data: completedProjectDetails = [] } = useQuery<GroupDetail[]>({
    queryKey: ['profile-completed-projects', completedGroups.map((group) => group.id), userInfo?.student_id, userInfo?.studentId, userInfo?.fullName],
    queryFn: async () => {
      const details = await Promise.all(
        completedGroups.map(async (group) => {
          try {
            const detail = await api.getGroupDetail(group.id)
            return detail
          } catch {
            return null
          }
        })
      )

      return details.filter((detail): detail is GroupDetail => !!detail)
    },
    enabled: completedGroups.length > 0 && !!userInfo,
    refetchOnMount: 'always',
  })

  const myReviewScores = useMemo(() => {
    return reviewSummaries
      .map((summary) => {
        const score = findMyScore(summary.memberScores, userInfo)
        return score ? { ...score, groupId: summary.groupId, groupName: summary.groupName } : null
      })
      .filter((score): score is MemberScore & { groupId: number; groupName: string } => !!score)
  }, [reviewSummaries, userInfo])

  const roleByGroupId = useMemo(() => {
    const studentId = userInfo?.student_id || userInfo?.studentId
    const names = [userInfo?.fullName, userInfo?.nickname].filter(Boolean)

    return completedProjectDetails.reduce<Record<number, MemberRole>>((acc, detail) => {
      const me = detail.members.find((member) => (
        (studentId && member.studentId === studentId) || names.includes(member.name)
      ))
      acc[detail.id] = me?.role ?? 'UNASSIGNED'
      return acc
    }, {})
  }, [completedProjectDetails, userInfo])

  const completedProjects = useMemo<CompletedProject[]>(() => {
    return completedGroups.map((group) => {
      const score = myReviewScores.find((reviewScore) => reviewScore.groupId === group.id)
      return {
        id: group.id,
        teamName: group.name,
        courseName: group.courseName || '과목 정보 없음',
        role: roleByGroupId[group.id] ?? 'UNASSIGNED',
        projectDeadline: group.projectDeadline,
        avgContributionScore: score?.avgContributionScore ?? 0,
        reviewCount: score?.reviewCount ?? 0,
      }
    })
  }, [completedGroups, myReviewScores, roleByGroupId])

  const profileReviews = useMemo<ProfileReview[]>(() => {
    const myUserIds = [
      userInfo?.id,
      userInfo?.userId,
    ].filter((id): id is number => typeof id === 'number')
    const names = [userInfo?.fullName, userInfo?.nickname].filter(Boolean)

    return reviewSummaries
      .flatMap((summary) => (summary.reviewComments ?? [])
        .filter((review) => (
          myUserIds.includes(review.revieweeId) || names.includes(review.revieweeName)
        ))
        .map((review) => ({
          ...review,
          groupId: summary.groupId,
          groupName: summary.groupName,
          courseName: summary.courseName,
          role: roleByGroupId[summary.groupId] ?? 'UNASSIGNED',
        })))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [reviewSummaries, roleByGroupId, userInfo])

  const averageScores = useMemo(() => {
    if (myReviewScores.length === 0) return null

    const total = myReviewScores.reduce(
      (acc, score) => ({
        contributing: acc.contributing + score.avgContributing,
        interacting: acc.interacting + score.avgInteracting,
        keepingOnTrack: acc.keepingOnTrack + score.avgKeepingOnTrack,
        quality: acc.quality + score.avgExpectingQuality,
        knowledge: acc.knowledge + score.avgKnowledgeSkills,
      }),
      { contributing: 0, interacting: 0, keepingOnTrack: 0, quality: 0, knowledge: 0 }
    )

    return {
      contributing: total.contributing / myReviewScores.length,
      interacting: total.interacting / myReviewScores.length,
      keepingOnTrack: total.keepingOnTrack / myReviewScores.length,
      quality: total.quality / myReviewScores.length,
      knowledge: total.knowledge / myReviewScores.length,
    }
  }, [myReviewScores])

  const radarData = useMemo(() => [
    { subject: '기여도', value: averageScores?.contributing ?? 0, fullMark: 5 },
    { subject: '소통', value: averageScores?.interacting ?? 0, fullMark: 5 },
    { subject: '일정관리', value: averageScores?.keepingOnTrack ?? 0, fullMark: 5 },
    { subject: '품질', value: averageScores?.quality ?? 0, fullMark: 5 },
    { subject: '지식/기술', value: averageScores?.knowledge ?? 0, fullMark: 5 },
  ], [averageScores])

  if (isLoading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#e7e0d7] rounded w-1/4" />
          <div className="h-4 bg-[#e7e0d7] rounded w-1/2" />
          <div className="h-40 bg-[#f2eee8] rounded-2xl" />
        </div>
      </div>
    )
  }

  const displayName = userInfo?.fullName || userInfo?.nickname || '사용자'
  const studentId = userInfo?.student_id || userInfo?.studentId || '-'
  const visibleProjects = showAllProjects ? completedProjects : completedProjects.slice(0, 2)
  const visibleReviews = showAllReviews ? profileReviews : profileReviews.slice(0, 3)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-[#25231f] mb-2">프로필</h1>
        <p className="text-[#7a7169]">세종대 포털 정보와 협업 평가를 한눈에 확인합니다</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">
        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#4a8768]/10 flex items-center justify-center shrink-0">
                <GraduationCap className="w-6 h-6 text-[#4a8768]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold text-[#25231f] truncate">{displayName}</h2>
                <p className="text-sm text-[#b0a8a0]">세종대 포털 인증 정보</p>
              </div>
            </div>

            <div className="space-y-3">
              <InfoCard
                icon={<CreditCard className="w-5 h-5 text-[#31465d]" />}
                label="학번"
                value={studentId}
                tone="navy"
              />
              <InfoCard
                icon={<BookOpen className="w-5 h-5 text-[#4a8768]" />}
                label="학과"
                value={userInfo?.major || '-'}
                tone="sage"
              />
              <InfoCard
                icon={<GraduationCap className="w-5 h-5 text-[#a8793d]" />}
                label="학기"
                value={academicTerm(userInfo?.grade)}
                tone="gold"
              />
            </div>
          </section>

          <section className="card">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-bold text-[#25231f] flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#4a8768]/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-[#4a8768]" />
                </span>
                완료한 프로젝트
              </h2>
              {completedProjects.length > 2 && (
                <button
                  type="button"
                  onClick={() => setShowAllProjects((current) => !current)}
                  className="text-sm font-bold text-[#4a8768] hover:text-[#3f7359] transition-colors"
                >
                  {showAllProjects ? '접기' : '전체보기'}
                </button>
              )}
            </div>

            {completedProjects.length === 0 ? (
              <p className="text-sm text-[#b0a8a0] text-center py-6">완료한 프로젝트가 없습니다</p>
            ) : (
              <div className="space-y-3">
                {visibleProjects.map((project) => (
                  <div key={project.id} className="p-4 rounded-2xl bg-white/70 border border-[#e7e0d7]">
                    <p className="text-xs font-bold text-[#4a8768] truncate">{project.courseName}</p>
                    <p className="text-sm font-extrabold text-[#25231f] truncate mt-1">{project.teamName}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-[#f8f5f0] px-3 py-2">
                        <p className="text-[11px] font-bold text-[#b0a8a0]">담당 역할</p>
                        <p className="text-sm font-extrabold text-[#31465d]">{ROLE_LABELS[project.role]}</p>
                      </div>
                      <div className="rounded-xl bg-[#f8f5f0] px-3 py-2">
                        <p className="text-[11px] font-bold text-[#b0a8a0]">받은 평점</p>
                        <p className="text-sm font-extrabold text-[#4a8768]">
                          {project.reviewCount > 0 ? `${project.avgContributionScore.toFixed(0)}점` : '평가 없음'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="card relative">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h2 className="font-bold text-[#25231f] flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[#4a8768]/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-[#4a8768]" />
              </span>
              나의 협업 지표
            </h2>
            <button
              type="button"
              onClick={() => setShowMetricHelp((current) => !current)}
              aria-label="협업 지표 설명 보기"
              className="w-7 h-7 rounded-full text-[#9a9188] font-extrabold text-sm flex items-center justify-center hover:text-[#7a7169] transition-colors glass-item"
            >
              ?
            </button>
          </div>

          {showMetricHelp && (
            <div className="absolute right-6 top-16 z-10 w-[min(360px,calc(100%-48px))] rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', border: '1.5px solid rgba(255,255,255,0.65)', boxShadow: '0 8px 32px rgba(31,38,135,0.14), inset 0 1px 0 rgba(255,255,255,0.85)' }}>
              <p className="text-sm font-extrabold text-[#25231f] mb-3">협업 지표 설명</p>
              <div className="space-y-2">
                {metricDescriptions.map((metric) => (
                  <div key={metric.name}>
                    <p className="text-xs font-bold text-[#4a8768]">{metric.name}</p>
                    <p className="text-xs text-[#7a7169] leading-relaxed">{metric.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="h-[420px] lg:h-[500px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 48, right: 88, bottom: 46, left: 88 }} outerRadius="96%">
                <PolarGrid stroke="#e7e0d7" />
                <PolarAngleAxis dataKey="subject" tick={<RadarAngleTick />} tickSize={18} />
                <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 13, fill: '#b0a8a0' }} tickCount={6} />
                <Radar dataKey="value" fill="#4a8768" fillOpacity={0.42} stroke="#4a8768" strokeWidth={2.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {!averageScores && (
            <p className="text-center text-xs text-[#b0a8a0] mt-2">
              동료 평가 데이터가 없습니다
            </p>
          )}
        </section>
      </div>

      <section className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <h2 className="font-bold text-[#25231f] flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#31465d]/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-[#31465d]" />
            </span>
            후기
          </h2>
          {profileReviews.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllReviews((current) => !current)}
              className="text-sm font-bold text-[#4a8768] hover:text-[#3f7359] transition-colors self-start sm:self-auto"
            >
              {showAllReviews ? '접기' : '전체보기'}
            </button>
          )}
        </div>

        {profileReviews.length === 0 ? (
          <p className="text-sm text-[#b0a8a0] text-center py-8">아직 받은 후기가 없습니다</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {visibleReviews.map((review) => (
              <div key={`${review.groupId}-${review.reviewerId}-${review.createdAt}`} className="p-5 rounded-2xl bg-white/60 border border-[#e7e0d7]">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-bold text-[#25231f] truncate">{review.groupName}</p>
                    <p className="text-xs text-[#b0a8a0] truncate">
                      {review.courseName} · {ROLE_LABELS[review.role]}
                    </p>
                  </div>
                  <span className="badge bg-[#4a8768]/10 text-[#4a8768]">
                    {review.contributionScore}점
                  </span>
                </div>
                <p className="text-sm text-[#25231f] leading-relaxed line-clamp-3">
                  {review.comment}
                </p>
                <p className="text-xs text-[#b0a8a0] mt-3">
                  {review.reviewerName} 작성 · 소통 {review.interacting} · 품질 {review.expectingQuality} · 지식/기술 {review.knowledgeSkills}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function InfoCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  tone: 'sage' | 'navy' | 'gold'
}) {
  const bg = {
    sage: 'bg-[#4a8768]/10',
    navy: 'bg-[#31465d]/10',
    gold: 'bg-[#a8793d]/10',
  }[tone]

  return (
    <div className="glass-item p-3.5 rounded-2xl flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-[#b0a8a0] mb-0.5">{label}</p>
        <p className="text-base font-extrabold text-[#25231f] break-keep truncate">{value}</p>
      </div>
    </div>
  )
}
