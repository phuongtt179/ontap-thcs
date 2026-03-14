// ============================================================
// RegisterPage.jsx — Trang đăng ký tài khoản mới
// ------------------------------------------------------------
// Luồng đăng ký:
// 1. Người dùng điền form (tên, email, mật khẩu, vai trò)
// 2. Bấm "Đăng ký" → gọi supabase.auth.signUp()
// 3. Supabase tạo tài khoản + tự động tạo bản ghi trong bảng profiles
//    (nhờ trigger đã cài sẵn trong database)
// 4. Chuyển về trang đăng nhập
// ============================================================

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { BookOpen } from 'lucide-react'

// Danh sách khối cứng — chỉ dùng cho form đăng ký,
// không cần lấy từ database vì đây là màn hình chưa đăng nhập
const GRADES = ['6', '7', '8', '9']

export default function RegisterPage() {
  const navigate = useNavigate()

  // Tất cả dữ liệu form gom vào 1 state object để dễ quản lý
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',  // mặc định là học sinh
    grade: '6',       // mặc định khối 6
  })
  const [loading, setLoading] = useState(false)

  // Hàm tiện ích: cập nhật 1 trường trong form mà không xóa các trường khác
  // Cú pháp: set('email', 'abc@gmail.com')
  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault() // ngăn trình duyệt reload trang

    // Kiểm tra hợp lệ trước khi gửi lên server
    if (form.password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp')
      return
    }
    if (!form.full_name.trim()) {
      toast.error('Vui lòng nhập họ và tên')
      return
    }

    setLoading(true)
    try {
      // metadata: thông tin thêm gắn theo tài khoản Supabase Auth
      // Supabase sẽ tự động đưa metadata này vào bảng profiles qua trigger
      const metadata = {
        full_name: form.full_name.trim(),
        role: form.role,
        // Khối chỉ có ý nghĩa với học sinh, giáo viên để null
        grade: form.role === 'student' ? form.grade : null,
      }

      // Gọi Supabase Auth để tạo tài khoản mới
      const { error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: metadata }, // kèm metadata vào
      })

      if (error) throw error // nếu lỗi thì nhảy xuống catch

      toast.success('Đăng ký thành công! Vui lòng đăng nhập.')
      // Chờ 2 giây để người dùng đọc thông báo rồi chuyển trang
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      toast.error(err.message || 'Đăng ký thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-indigo-600 text-white rounded-full p-3 mb-3">
            <BookOpen size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Ôn Tập THCS</h1>
          <p className="text-gray-500 text-sm mt-1">Tạo tài khoản mới</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Họ và tên */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Họ và tên
            </label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Nguyễn Văn A"
              autoComplete="name"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => set('email', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="example@email.com"
              autoComplete="email"
            />
          </div>

          {/* Mật khẩu */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={e => set('password', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Tối thiểu 6 ký tự"
              autoComplete="new-password"
            />
          </div>

          {/* Xác nhận mật khẩu */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Xác nhận mật khẩu
            </label>
            <input
              type="password"
              required
              value={form.confirmPassword}
              onChange={e => set('confirmPassword', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
            />
          </div>

          {/* Chọn vai trò: học sinh hoặc giáo viên */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vai trò
            </label>
            <div className="flex gap-4">
              {[
                { value: 'student', label: 'Học sinh' },
                { value: 'teacher', label: 'Giáo viên' },
              ].map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 flex-1 border rounded-lg px-4 py-2.5 cursor-pointer transition
                    ${form.role === opt.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                      : 'border-gray-300 text-gray-600 hover:border-indigo-300'
                    }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={opt.value}
                    checked={form.role === opt.value}
                    onChange={() => set('role', opt.value)}
                    className="accent-indigo-600"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Chọn khối — chỉ hiện khi vai trò là học sinh */}
          {form.role === 'student' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Khối lớp
              </label>
              <select
                value={form.grade}
                onChange={e => set('grade', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {GRADES.map(g => (
                  <option key={g} value={g}>Lớp {g}</option>
                ))}
              </select>
            </div>
          )}

          {/* Nút đăng ký */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60 mt-2"
          >
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>

        {/* Link về trang đăng nhập */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Đã có tài khoản?{' '}
          <Link
            to="/login"
            className="text-indigo-600 font-medium hover:underline"
          >
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  )
}
