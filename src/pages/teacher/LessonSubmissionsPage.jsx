import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, MessageSquare, CheckCircle, Loader2, PlayCircle, BookOpen, Upload, Users } from 'lucide-react'

export default function LessonSubmissionsPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState(null)
  const [students, setStudents] = useState([])
  const [progressMap, setProgressMap] = useState({})   // userId -> lesson_progress
  const [submissionMap, setSubmissionMap] = useState({}) // userId -> lesson_submission
  const [classes, setClasses] = useState([])
  const [filterClass, setFilterClass] = useState('')
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState(null) // { student, submission }
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)

    const { data: lessonData } = await supabase
      .from('lessons').select('*').eq('id', id).single()

    if (!lessonData) { toast.error('Không tìm thấy bài học'); navigate(-1); return }
    setLesson(lessonData)

    // Fetch students in lesson's grade
    const { data: studentData } = await supabase
      .from('profiles')
      .select('id, full_name, class_name, grade')
      .eq('role', 'student')
      .eq('grade', lessonData.grade)
      .order('class_name').order('full_name')

    const allStudents = studentData || []
    setStudents(allStudents)

    // Unique classes
    const cls = [...new Set(allStudents.map(s => s.class_name).filter(Boolean))].sort()
    setClasses(cls)

    // Fetch progress + submissions for all students
    const userIds = allStudents.map(s => s.id)
    if (userIds.length > 0) {
      const [{ data: progData }, { data: subData }] = await Promise.all([
        supabase.from('lesson_progress').select('*').eq('lesson_id', id).in('user_id', userIds),
        supabase.from('lesson_submissions').select('*').eq('lesson_id', id).in('user_id', userIds),
      ])
      const pm = {}; (progData || []).forEach(p => { pm[p.user_id] = p })
      const sm = {}; (subData || []).forEach(s => { sm[s.user_id] = s })
      setProgressMap(pm)
      setSubmissionMap(sm)
    }

    setLoading(false)
  }

  async function saveComment() {
    if (!selected) return
    setSaving(true)
    const sub = selected.submission
    const { error } = await supabase.from('lesson_submissions').update({
      teacher_comment: comment,
      reviewed_at: new Date().toISOString(),
    }).eq('id', sub.id)
    setSaving(false)
    if (error) { toast.error('Lưu thất bại: ' + error.message); return }
    toast.success('Đã lưu nhận xét')
    setSubmissionMap(prev => ({
      ...prev,
      [selected.student.id]: { ...sub, teacher_comment: comment, reviewed_at: new Date().toISOString() }
    }))
    setSelected(prev => prev ? { ...prev, submission: { ...sub, teacher_comment: comment, reviewed_at: new Date().toISOString() } } : prev)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const hasVideo = !!lesson?.video_url
  const hasQuiz = (lesson?.question_ids?.length || 0) > 0
  const hasPractice = lesson?.has_practice

  const displayedStudents = filterClass
    ? students.filter(s => s.class_name === filterClass)
    : students

  // Stats
  const total = displayedStudents.length
  const videoCount = hasVideo ? displayedStudents.filter(s => progressMap[s.id]?.video_watched).length : null
  const quizCount = hasQuiz ? displayedStudents.filter(s => progressMap[s.id]?.quiz_passed).length : null
  const practiceCount = hasPractice ? displayedStudents.filter(s => submissionMap[s.id]).length : null
  const completedCount = displayedStudents.filter(s => progressMap[s.id]?.completed).length

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate('/teacher/lessons')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition"
      >
        <ArrowLeft size={16} /> Bài học
      </button>

      <h1 className="text-xl font-bold text-gray-800 mb-1">{lesson?.title}</h1>
      <p className="text-sm text-gray-500 mb-5">Khối {lesson?.grade} · Tiến độ học sinh</p>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <select
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Tất cả lớp</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-sm text-gray-500">{total} học sinh</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-indigo-700">{completedCount}/{total}</div>
          <div className="text-xs text-indigo-500 mt-0.5">Hoàn thành</div>
        </div>
        {hasVideo && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{videoCount}/{total}</div>
            <div className="text-xs text-blue-500 mt-0.5 flex items-center justify-center gap-1"><PlayCircle size={10} />Xem video</div>
          </div>
        )}
        {hasQuiz && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{quizCount}/{total}</div>
            <div className="text-xs text-green-500 mt-0.5 flex items-center justify-center gap-1"><BookOpen size={10} />Đạt bài tập</div>
          </div>
        )}
        {hasPractice && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-orange-700">{practiceCount}/{total}</div>
            <div className="text-xs text-orange-500 mt-0.5 flex items-center justify-center gap-1"><Upload size={10} />Nộp thực hành</div>
          </div>
        )}
      </div>

      {selected ? (
        /* ── Submission detail ── */
        <div>
          <button
            onClick={() => { setSelected(null) }}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition"
          >
            <ArrowLeft size={14} /> Danh sách
          </button>
          <div className="bg-indigo-600 text-white rounded-xl px-5 py-4 mb-5">
            <p className="font-semibold text-base">{selected.student.full_name}</p>
            <p className="text-indigo-200 text-sm mt-0.5">
              {selected.student.class_name ? `Lớp ${selected.student.class_name}` : `Khối ${selected.student.grade}`}
              {selected.submission && ` · Nộp lúc ${new Date(selected.submission.submitted_at).toLocaleString('vi-VN')}`}
            </p>
          </div>

          {selected.submission ? (
            <div className="space-y-4 mb-6">
              {selected.submission.text_content && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Nội dung bài nộp</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{selected.submission.text_content}</p>
                </div>
              )}
              {selected.submission.file_url && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Ảnh minh chứng</p>
                  <img src={selected.submission.file_url} alt="Bài nộp" className="rounded-xl border max-h-80 object-contain" />
                </div>
              )}
              {!selected.submission.text_content && !selected.submission.file_url && (
                <p className="text-sm text-gray-400 italic">Học sinh không để lại nội dung</p>
              )}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare size={16} className="text-indigo-500" />
                  <h3 className="font-semibold text-gray-800 text-sm">Nhận xét của giáo viên</h3>
                </div>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={4}
                  placeholder="Nhập nhận xét..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-3"
                />
                <button
                  onClick={saveComment}
                  disabled={saving}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Lưu nhận xét
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <Upload size={32} className="mx-auto mb-2 opacity-30" />
              <p>Học sinh chưa nộp bài thực hành</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Student progress list ── */
        displayedStudents.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p>Không có học sinh nào</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedStudents.map(student => {
              const prog = progressMap[student.id]
              const sub = submissionMap[student.id]
              const completed = prog?.completed
              const videoOk = !hasVideo || prog?.video_watched
              const quizOk = !hasQuiz || prog?.quiz_passed
              const practiceOk = !hasPractice || !!sub

              // Calculate overall %
              const steps = [hasVideo, hasQuiz, hasPractice].filter(Boolean)
              const done = [videoOk && hasVideo, quizOk && hasQuiz, practiceOk && hasPractice].filter(Boolean)
              const pct = steps.length > 0 ? Math.round((done.length / steps.length) * 100) : 0

              return (
                <div
                  key={student.id}
                  onClick={() => hasPractice ? (setSelected({ student, submission: sub || null }), setComment(sub?.teacher_comment || '')) : null}
                  className={`bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 ${hasPractice ? 'cursor-pointer hover:border-indigo-300 hover:shadow-sm transition' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${completed ? 'bg-green-500 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                    {student.full_name?.[0]?.toUpperCase() || '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800 text-sm">{student.full_name}</span>
                      <span className="text-xs text-gray-400">{student.class_name || `Khối ${student.grade}`}</span>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-indigo-400' : 'bg-gray-200'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 w-8 text-right">{pct}%</span>
                    </div>

                    {/* Step badges */}
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {hasVideo && (
                        <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium
                          ${prog?.video_watched ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                          <PlayCircle size={9} /> Video {prog?.video_watched ? '✓' : '○'}
                        </span>
                      )}
                      {hasQuiz && (
                        <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium
                          ${prog?.quiz_passed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                          <BookOpen size={9} /> Bài tập {prog?.quiz_passed ? `✓ ${prog.quiz_correct ?? 0}/${prog.quiz_total ?? ''}` : `${prog?.quiz_correct ?? 0}/${lesson?.question_ids?.length ?? 0}`}
                        </span>
                      )}
                      {hasPractice && (
                        <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium
                          ${sub ? (sub.reviewed_at ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700') : 'bg-gray-100 text-gray-400'}`}>
                          <Upload size={9} /> {sub ? (sub.reviewed_at ? 'Đã nhận xét ✓' : 'Chờ nhận xét') : 'Chưa nộp'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
