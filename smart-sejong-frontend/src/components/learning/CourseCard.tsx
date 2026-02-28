import type { Course } from '@/types'

interface CourseCardProps {
  course: Course
}

const gradeColors: Record<string, string> = {
  'A+': 'bg-green-100 text-green-800',
  'A': 'bg-green-100 text-green-800',
  'A-': 'bg-green-100 text-green-800',
  'B+': 'bg-blue-100 text-blue-800',
  'B': 'bg-blue-100 text-blue-800',
  'B-': 'bg-blue-100 text-blue-800',
  'C+': 'bg-yellow-100 text-yellow-800',
  'C': 'bg-yellow-100 text-yellow-800',
  'C-': 'bg-yellow-100 text-yellow-800',
  'D+': 'bg-orange-100 text-orange-800',
  'D': 'bg-orange-100 text-orange-800',
  'F': 'bg-red-100 text-red-800',
}

export function CourseCard({ course }: CourseCardProps) {
  const gradeColor = gradeColors[course.grade] || 'bg-gray-100 text-gray-800'

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-900 flex-1">{course.course_name}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${gradeColor}`}>
          {course.grade}
        </span>
      </div>
      <div className="text-sm text-gray-600">
        {course.credits}학점
      </div>
    </div>
  )
}

