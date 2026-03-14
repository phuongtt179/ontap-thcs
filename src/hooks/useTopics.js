// ============================================================
// useTopics.js — Hook lấy danh sách chủ đề từ database
// ------------------------------------------------------------
// "Hook" là một hàm đặc biệt trong React, bắt đầu bằng "use".
// Mục đích: bất kỳ trang nào cần danh sách chủ đề đều gọi
// hook này thay vì tự viết lại code truy vấn database.
// ============================================================

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useTopics() {
  // useState lưu "trạng thái" — dữ liệu có thể thay đổi theo thời gian.
  // Khi topics thay đổi, React tự động vẽ lại giao diện.
  const [topics, setTopics] = useState([])     // ban đầu là mảng rỗng
  const [loading, setLoading] = useState(true) // đang tải? ban đầu = true

  // useEffect chạy một lần khi component được mount (hiển thị lần đầu).
  // [] ở cuối nghĩa là "chỉ chạy một lần, không chạy lại".
  useEffect(() => { fetch() }, [])

  // Hàm bất đồng bộ (async) — gọi lên Supabase để lấy dữ liệu.
  // "await" nghĩa là "chờ cho đến khi Supabase trả về kết quả".
  async function fetch() {
    const { data } = await supabase
      .from('topics')   // bảng "topics" trong database
      .select('*')      // lấy tất cả các cột
      .order('name')    // sắp xếp theo tên A→Z
    setTopics(data || []) // cập nhật state (nếu data = null thì dùng [])
    setLoading(false)     // đánh dấu đã tải xong
  }

  // Trả về dữ liệu cho component nào gọi hook này.
  // refetch: cho phép gọi lại để làm mới dữ liệu sau khi thêm/xóa.
  return { topics, loading, refetch: fetch }
}
