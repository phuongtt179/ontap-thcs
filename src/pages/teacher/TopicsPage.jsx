// ============================================================
// TopicsPage.jsx — Trang quản lý chủ đề (dành cho giáo viên)
// ------------------------------------------------------------
// Chức năng: Xem / Thêm / Sửa / Xóa chủ đề
// Chủ đề là nhóm phân loại câu hỏi.
// Ví dụ: Môn Toán - Khối 7 - chủ đề "Số nguyên"
// ============================================================

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTopics } from '../../hooks/useTopics'
import { useSubjects } from '../../hooks/useSubjects'
import { useGrades } from '../../hooks/useGrades'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

export default function TopicsPage() {
  // Lấy dữ liệu từ các hook — mỗi hook tự gọi Supabase và trả kết quả
  const { topics, loading, refetch } = useTopics()
  const { subjects } = useSubjects()          // chỉ trả môn được phân công cho GV này
  const { grades: gradeValues } = useGrades() // danh sách khối từ database

  // Tạo mảng GRADES có thêm "Tất cả khối" ở đầu
  // Cú pháp: [...arr1, ...arr2] = gộp 2 mảng thành 1
  const GRADES = [{ value: 'all', label: 'Tất cả khối' }, ...gradeValues.map(g => ({ value: g, label: `Khối ${g}` }))]

  // --- State bộ lọc ---
  const [filterGrade, setFilterGrade] = useState('all')
  const [filterSubject, setFilterSubject] = useState('')

  // --- State form thêm mới ---
  const [newName, setNewName] = useState('')
  const [newGrade, setNewGrade] = useState('')
  const [newSubjectId, setNewSubjectId] = useState('')
  const [adding, setAdding] = useState(false) // đang hiện form thêm hay không?

  // --- State chỉnh sửa inline ---
  const [editId, setEditId] = useState(null)  // id chủ đề đang được sửa (null = không sửa cái nào)
  const [editName, setEditName] = useState('')
  const [editGrade, setEditGrade] = useState('all')
  const [editSubjectId, setEditSubjectId] = useState('')

  // useEffect: chạy lại mỗi khi subjects thay đổi
  // Khi danh sách môn load xong → tự chọn môn đầu tiên làm bộ lọc mặc định
  useEffect(() => {
    if (subjects.length > 0 && !filterSubject) {
      setFilterSubject(subjects[0].id)
    }
  }, [subjects])

  // Khi danh sách khối load xong → tự chọn khối đầu tiên cho form thêm mới
  useEffect(() => {
    if (gradeValues.length > 0 && !newGrade) {
      setNewGrade(gradeValues[0])
    }
  }, [gradeValues])

  // Khi đổi bộ lọc môn → đồng bộ môn mặc định trong form thêm mới
  useEffect(() => {
    setNewSubjectId(filterSubject)
  }, [filterSubject])

  // Tính danh sách chủ đề cần hiển thị (lọc client-side từ mảng topics đã tải)
  const assignedSubjectIds = new Set(subjects.map(s => s.id)) // Set tra nhanh hơn Array
  const displayed = topics.filter(t => {
    const gradeOk = filterGrade === 'all' || t.grade === filterGrade
    // Lọc theo môn: nếu chọn môn cụ thể → đúng môn đó
    //               nếu "tất cả môn" → chỉ lấy môn được phân công (không lấy môn khác GV)
    const subjectOk = filterSubject ? t.subject_id === filterSubject : assignedSubjectIds.has(t.subject_id)
    return gradeOk && subjectOk
  })

  // Thêm chủ đề mới vào bảng topics trong database
  async function handleAdd() {
    if (!newName.trim()) return // bỏ qua nếu tên rỗng
    const { error } = await supabase.from('topics').insert({
      name: newName.trim(),
      grade: newGrade,
      subject_id: newSubjectId || null, // null nếu không chọn môn
    })
    if (error) {
      // Kiểm tra lỗi trùng tên (vi phạm ràng buộc unique trong database)
      toast.error(error.message.includes('unique') ? 'Chủ đề đã tồn tại' : 'Thêm thất bại')
    } else {
      toast.success('Đã thêm chủ đề')
      setNewName('')
      setNewGrade('all')
      setNewSubjectId(filterSubject)
      setAdding(false)
      refetch() // gọi lại hook để làm mới danh sách
    }
  }

  // Cập nhật chủ đề đang sửa
  async function handleUpdate(id) {
    if (!editName.trim()) return
    const { error } = await supabase.from('topics').update({
      name: editName.trim(),
      grade: editGrade,
      subject_id: editSubjectId || null,
    }).eq('id', id) // .eq('id', id) = WHERE id = ... trong SQL
    if (error) toast.error('Cập nhật thất bại')
    else { toast.success('Đã cập nhật'); setEditId(null); refetch() }
  }

  // Xóa chủ đề khỏi database
  async function handleDelete(id, name) {
    // Hỏi xác nhận trước — confirm() trả về true/false
    if (!confirm(`Xóa chủ đề "${name}"? Các câu hỏi thuộc chủ đề này sẽ không bị xóa.`)) return
    const { error } = await supabase.from('topics').delete().eq('id', id)
    if (error) toast.error('Xóa thất bại')
    else { toast.success('Đã xóa'); refetch() }
  }

  // Điền thông tin hiện tại của topic vào form sửa
  function startEdit(topic) {
    setEditId(topic.id)       // đánh dấu đang sửa topic này
    setEditName(topic.name)
    setEditGrade(topic.grade)
    setEditSubjectId(topic.subject_id || '')
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      {/* Tiêu đề + nút Thêm */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Chủ đề</h1>
          <p className="text-gray-400 text-sm mt-0.5">{displayed.length} chủ đề</p>
        </div>
        {/* Ẩn nút khi đang hiện form thêm */}
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} /> Thêm chủ đề
          </button>
        )}
      </div>

      {/* Bộ lọc: dropdown môn + nút tab khối */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {subjects.length > 0 && (
          <select
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tất cả môn</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        {/* Render danh sách nút khối từ mảng GRADES */}
        {GRADES.map(g => (
          <button
            key={g.value}
            onClick={() => setFilterGrade(g.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filterGrade === g.value
                ? 'bg-indigo-600 text-white'      // đang chọn → màu tím
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200' // chưa chọn → xám
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Form thêm chủ đề — chỉ render khi adding = true */}
      {adding && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 flex items-center gap-3 flex-wrap">
          <input
            autoFocus  // tự focus vào ô này khi form hiện ra
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()} // gõ Enter = bấm nút Thêm
            placeholder="Tên chủ đề..."
            className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {subjects.length > 0 && (
            <select
              value={newSubjectId}
              onChange={e => setNewSubjectId(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Môn --</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select
            value={newGrade}
            onChange={e => setNewGrade(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {GRADES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          <button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition">
            <Check size={16} />
          </button>
          <button onClick={() => { setAdding(false); setNewName('') }} className="text-gray-400 hover:text-gray-600 p-2">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Danh sách chủ đề */}
      {loading ? (
        // Spinner (vòng tròn xoay) — hiện khi đang tải dữ liệu
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(topic => (
            <div key={topic.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
              {/* Điều kiện: nếu topic này đang được sửa → hiện form inline, ngược lại hiện dạng xem */}
              {editId === topic.id ? (
                // === FORM SỬA INLINE ===
                <>
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUpdate(topic.id)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {subjects.length > 0 && (
                    <select
                      value={editSubjectId}
                      onChange={e => setEditSubjectId(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Môn --</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                  <select
                    value={editGrade}
                    onChange={e => setEditGrade(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {GRADES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                  <button onClick={() => handleUpdate(topic.id)} className="text-green-600 hover:text-green-700 p-1">
                    <Check size={16} />
                  </button>
                  <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600 p-1">
                    <X size={16} />
                  </button>
                </>
              ) : (
                // === CHẾ ĐỘ XEM ===
                <>
                  <span className="flex-1 text-sm font-medium text-gray-800">{topic.name}</span>
                  {topic.subject_id && (
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {/* Tìm tên môn học dựa vào subject_id — optional chaining ?. tránh lỗi null */}
                      {subjects.find(s => s.id === topic.subject_id)?.name || 'Môn học'}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {GRADES.find(g => g.value === topic.grade)?.label}
                  </span>
                  <button onClick={() => startEdit(topic)} className="text-gray-400 hover:text-indigo-600 p-1 transition">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => handleDelete(topic.id, topic.name)} className="text-gray-400 hover:text-red-500 p-1 transition">
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
