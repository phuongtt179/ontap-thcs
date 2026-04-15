# GIẢI THÍCH LUỒNG HOẠT ĐỘNG CỦA CODE — EDUQUIZMASTER

> Tài liệu này giải thích từng bước: bấm nút nào → hàm nào chạy → gọi gì → lưu vào đâu.
> Dành cho người mới học, đọc song song với code sẽ hiểu rất nhanh.

---

## MỤC LỤC
1. [Kiến trúc tổng thể](#1-kiến-trúc-tổng-thể)
2. [Luồng đăng nhập](#2-luồng-đăng-nhập)
3. [Luồng tạo câu hỏi (giáo viên)](#3-luồng-tạo-câu-hỏi)
4. [Luồng nhập câu hỏi hàng loạt](#4-luồng-nhập-câu-hỏi-hàng-loạt)
5. [Luồng tạo đề thi](#5-luồng-tạo-đề-thi)
6. [Luồng học sinh làm bài thi](#6-luồng-học-sinh-làm-bài-thi)
7. [Luồng luyện tập](#7-luồng-luyện-tập)
8. [Các bảng database (Supabase)](#8-các-bảng-database)

---

## 1. KIẾN TRÚC TỔNG THỂ

```
Trình duyệt (React)
    │
    ├── App.jsx          → định nghĩa tất cả các đường dẫn (route)
    ├── AuthContext.jsx  → quản lý thông tin người dùng đang đăng nhập
    ├── ProtectedRoute   → chặn truy cập nếu chưa đăng nhập / sai vai trò
    │
    ├── Trang giáo viên (/teacher/...)
    ├── Trang học sinh  (/student/...)
    └── Trang admin     (/admin/...)
         │
         └── Tất cả đều gọi Supabase (database đám mây)
```

**Supabase** là "kho lưu trữ" của toàn bộ ứng dụng. Mọi dữ liệu (câu hỏi, đề thi, kết quả...) đều được lưu ở đó và đọc từ đó qua hàm `supabase.from('tên_bảng').select/insert/update/delete`.

---

## 2. LUỒNG ĐĂNG NHẬP

**File liên quan:** `src/pages/LoginPage.jsx` → `src/context/AuthContext.jsx`

```
Người dùng nhập email + mật khẩu
    │
    └── bấm "Đăng nhập"
            │
            └── gọi hàm: signIn(email, password)         [LoginPage.jsx]
                    │
                    └── gọi: supabase.auth.signInWithPassword({ email, password })
                                │
                                ├── Thành công → Supabase trả về "session" (thông tin phiên đăng nhập)
                                │       │
                                │       └── AuthContext tự động nhận qua sự kiện onAuthStateChange
                                │               │
                                │               └── gọi: fetchProfile(userId)
                                │                       │
                                │                       └── đọc bảng "profiles" → lấy role, tên, lớp...
                                │                               │
                                │                               ├── role = 'teacher' → chuyển đến /teacher/dashboard
                                │                               ├── role = 'student' → chuyển đến /student/dashboard
                                │                               └── role = 'admin'   → chuyển đến /admin/users
                                │
                                └── Thất bại → hiện thông báo lỗi
```

**Lưu ý quan trọng:** Sau khi đăng nhập, thông tin người dùng được lưu trong `AuthContext`. Bất kỳ component nào cũng có thể lấy bằng `const { user, profile } = useAuth()`.

---

## 3. LUỒNG TẠO CÂU HỎI

**File liên quan:** `QuestionsPage.jsx` → `QuestionFormModal.jsx` → bảng `questions`

### Bước 1 — Hiện modal

```
Giáo viên đang ở trang /teacher/questions
    │
    └── bấm nút "+ Tạo câu hỏi"
            │
            └── chạy: setShowCreate(true)               [QuestionsPage.jsx, dòng ~103]
                    │
                    └── React thấy showCreate = true → render component <QuestionFormModal>
```

### Bước 2 — Điền thông tin trong modal

```
Modal QuestionFormModal hiện ra
    │
    ├── Chứa state "form" lưu toàn bộ thông tin đang điền:
    │     { type, question, grade, subject_id, topic, difficulty,
    │       image_url, audio_url, options, correct_answer, pairs, items... }
    │
    └── Mỗi lần người dùng thay đổi ô nhập liệu:
            └── gọi: setForm({ ...form, [field]: newValue })
                    └── React cập nhật giao diện ngay lập tức
```

### Bước 3 — Bấm "Lưu câu hỏi"

```
Bấm nút "Lưu"
    │
    └── gọi: handleSave()                               [QuestionFormModal.jsx, dòng ~197]
            │
            ├── Kiểm tra: câu hỏi có rỗng không? → nếu rỗng thì báo lỗi, dừng
            │
            ├── gọi: buildPayload()  → đóng gói dữ liệu theo từng dạng câu hỏi
            │       │
            │       ├── multiple_choice → { options: [...], correct_answer: 'B' }
            │       ├── matching       → { options: [...], match_options: [...], correct_answer: 'A-2,B-1' }
            │       ├── word_order     → tách câu thành từng từ → { options: [...], correct_answer: 'She is a teacher' }
            │       └── ... (7 dạng, mỗi dạng đóng gói khác nhau)
            │
            └── gọi: supabase.from('questions').insert({ ...dữ liệu })
                    │
                    ├── Thành công → toast.success("Đã thêm câu hỏi")
                    │               → gọi onDone() → QuestionPage gọi lại fetchQuestions()
                    │               → danh sách câu hỏi tự cập nhật
                    │
                    └── Thất bại → toast.error("Thêm thất bại: ...")
```

**Dữ liệu được lưu vào bảng:** `questions`

| Cột | Ý nghĩa |
|-----|---------|
| `id` | Mã tự tạo (UUID) |
| `type` | Dạng câu hỏi: multiple_choice, matching... |
| `question` | Nội dung câu hỏi |
| `options` | Mảng đáp án: `[{key:"A", text:"..."}, ...]` |
| `match_options` | Cột phải cho dạng nối đôi |
| `correct_answer` | Đáp án đúng |
| `grade` | Khối lớp: "6", "7", "8", "9" |
| `subject_id` | Môn học (liên kết bảng `subjects`) |
| `topic` | Tên chủ đề |
| `difficulty` | easy / medium / hard |
| `image_url` | Link ảnh trên Cloudinary |
| `audio_url` | Link âm thanh trên Cloudinary |

---

## 4. LUỒNG NHẬP CÂU HỎI HÀNG LOẠT

**File liên quan:** `QuestionsPage.jsx` → `QuestionImportModal.jsx` → `questionParser.js` → bảng `questions`

```
Bấm nút "Nhập câu hỏi"
    │
    └── setShowImport(true) → hiện <QuestionImportModal>

────────── BƯỚC 1: DÁN VĂN BẢN ──────────

Giáo viên dán văn bản từ Word vào ô textarea
    │
    └── bấm "Phân tích câu hỏi"
            │
            └── gọi: handleParse()                      [QuestionImportModal.jsx]
                    │
                    └── gọi: parseQuestions(rawText)     [questionParser.js]
                            │
                            ├── Đọc từng dòng văn bản
                            ├── Nhận ra "Câu 1:", "A.", "Đáp án:", ">1."...
                            ├── Phân loại tự động:
                            │     · Có A/B/C + đáp án 1 chữ → trắc nghiệm
                            │     · Có A/B/C + đáp án "A,B,C" → sắp xếp thứ tự
                            │     · Có A/B/C + đáp án có khoảng trắng → sắp xếp từ
                            │     · Question có ___ + có A/B/C → kéo thả từ
                            │     · Có dòng >1. >2. → nối đôi
                            │     · Không có options → điền từ
                            └── Trả về mảng câu hỏi đã phân tích

────────── BƯỚC 2: XEM TRƯỚC & CHỈNH SỬA ──────────

Giao diện chuyển sang Step 2 — hiện danh sách câu hỏi đã parse
    │
    └── Giáo viên có thể chỉnh sửa từng câu (sửa nội dung, đổi dạng, thêm/xóa đáp án)

────────── BƯỚC 3: LƯU ──────────

Bấm "Lưu X câu hỏi"
    │
    └── gọi: handleSave()
            │
            └── gọi: supabase.from('questions').insert(rows)
                    └── rows = mảng tất cả câu hỏi đã parse/chỉnh sửa
                            └── Lưu vào bảng "questions" (nhiều dòng cùng lúc)
```

---

## 5. LUỒNG TẠO ĐỀ THI

**File liên quan:** `teacher/ExamsPage.jsx` → bảng `exams`

```
Bấm "+ Tạo đề thi"
    │
    └── setShowCreate(true) → hiện <ExamFormModal>

────────── BƯỚC 1: THÔNG TIN CƠ BẢN ──────────

Điền: tiêu đề, môn, khối, thời gian (phút), số lần làm, hiện đáp án...
    │
    └── bấm "Tiếp theo →" → chuyển sang step 2

────────── BƯỚC 2: CHỌN CÂU HỎI ──────────

Modal tự động tải câu hỏi từ bảng "questions" (theo môn/khối đã chọn ở step 1)
    │
    ├── Giáo viên chọn từng câu (bấm checkbox) hoặc
    │   bấm "Chọn ngẫu nhiên N câu"
    │
    └── bấm "Lưu đề thi"
            │
            └── gọi: supabase.from('exams').insert({
                        title, grade, subject_id,
                        time_limit,       ← giới hạn thời gian (phút)
                        max_attempts,     ← số lần học sinh được làm
                        is_active,        ← bật/tắt đề
                        show_answer,      ← có hiện đáp án sau khi nộp không
                        show_score,       ← có hiện điểm không
                        question_ids,     ← mảng id câu hỏi đã chọn
                    })
```

**Dữ liệu lưu vào bảng:** `exams`

---

## 6. LUỒNG HỌC SINH LÀM BÀI THI

**File liên quan:** `student/ExamsPage.jsx` → `QuizSession.jsx` → bảng `quiz_sessions`

```
Học sinh vào trang /student/exams
    │
    └── fetchExams() → đọc bảng "exams" lấy các đề is_active = true và đúng khối/môn

────────── BẤM "LÀM BÀI" ──────────

    │
    └── Tải câu hỏi: đọc bảng "questions" với điều kiện id IN (question_ids của đề)
            │
            └── Hiện component <QuizSession> với:
                    questions = danh sách câu hỏi
                    mode = 'exam'
                    timeLimit = số phút
                    showAnswer = false (không hiện đáp án trong khi thi)

────────── TRONG KHI LÀM BÀI ──────────

Học sinh chọn đáp án
    │
    └── handleSelect(answer) → lưu vào state answers = { 0: 'B', 1: 'Đúng', 2: 'CPU'... }
                                (chỉ lưu trong bộ nhớ trình duyệt, chưa vào database)

Đồng hồ đếm ngược (timeLeft) giảm 1 giây mỗi giây
    │
    └── Khi timeLeft = 0 → tự động gọi handleFinish()

────────── NỘP BÀI ──────────

Bấm "Nộp bài" hoặc hết giờ
    │
    └── gọi: handleFinish()
            │
            ├── Đếm số câu đúng: so sánh answers[i] với q.correct_answer
            │     (mỗi dạng câu hỏi có cách so sánh riêng trong normalizeAnswer())
            │
            ├── Tính điểm: score = (số_câu_đúng / tổng_câu) × 10
            │
            └── gọi: supabase.from('quiz_sessions').insert({
                        exam_id,          ← thuộc đề thi nào
                        user_id,          ← học sinh nào
                        total,            ← tổng số câu
                        correct,          ← số câu đúng
                        score,            ← điểm (thang 10)
                        answers,          ← toàn bộ đáp án học sinh đã chọn (JSON)
                        attempt_number,   ← lần làm thứ mấy
                    })
                    │
                    └── Hiện màn hình kết quả (QuizResult)
```

---

## 7. LUỒNG LUYỆN TẬP

**File liên quan:** `student/PracticePage.jsx` → `QuizSession.jsx` → bảng `quiz_sessions`

```
Học sinh vào /student/practice
    │
    └── Chọn: môn → chủ đề → độ khó → số câu muốn ôn

────────── BẤM "BẮT ĐẦU" ──────────

    │
    └── gọi: startPractice()
            │
            └── đọc bảng "questions" với điều kiện:
                    grade = khối của học sinh
                    subject_id = môn đã chọn
                    topic IN (các chủ đề đã chọn)
                    difficulty = độ khó đã chọn
                    → lấy ngẫu nhiên N câu (shuffle)
            │
            └── Hiện <QuizSession> với:
                    mode = 'practice'
                    showAnswer = TRUE  ← hiện đáp án đúng/sai sau mỗi câu
                    timeLimit = null   ← không giới hạn thời gian

────────── KHÁC BIỆT SO VỚI CHẾ ĐỘ THI ──────────

Học sinh chọn đáp án → bấm "Xác nhận"
    │
    ├── confirmed = true
    └── giao diện đổi màu: xanh lá = đúng, đỏ = sai

────────── NỘP BÀI ──────────

Tương tự luồng thi, nhưng lưu vào quiz_sessions với:
    exam_id = null        ← không gắn với đề thi nào
    mode = 'practice'
    question_ids = [...]  ← lưu id các câu đã ôn để xem lại
```

---

## 8. CÁC BẢNG DATABASE

Toàn bộ dữ liệu lưu trên **Supabase** (PostgreSQL). Kết nối qua file `src/lib/supabase.js`.

```
profiles          → thông tin người dùng (tên, vai trò, lớp, trạng thái)
subjects          → danh sách môn học
topics            → chủ đề theo từng môn và khối lớp
questions         → ngân hàng câu hỏi
exams             → đề thi (chứa danh sách id câu hỏi)
quiz_sessions     → kết quả mỗi lần làm bài (thi hoặc luyện tập)
lessons           → bài học lý thuyết (có video + câu hỏi + thực hành)
lesson_progress   → tiến trình học của từng học sinh (đã xem video chưa, đã qua quiz chưa...)
```

### Sơ đồ liên kết các bảng

```
profiles (người dùng)
    │
    ├── quiz_sessions.user_id → profiles.id
    └── lesson_progress.user_id → profiles.id

subjects (môn học)
    │
    ├── topics.subject_id → subjects.id
    ├── questions.subject_id → subjects.id
    ├── exams.subject_id → subjects.id
    └── lessons.subject_id → subjects.id

questions (câu hỏi)
    │
    ├── exams.question_ids (mảng id) → questions.id
    └── lessons.question_ids (mảng id) → questions.id

exams (đề thi)
    └── quiz_sessions.exam_id → exams.id
```

---

## TỔNG KẾT NHANH

| Hành động | Hàm chính | Bảng DB |
|-----------|-----------|---------|
| Đăng nhập | `supabase.auth.signInWithPassword()` | (auth của Supabase) |
| Tạo câu hỏi | `handleSave()` trong QuestionFormModal | `questions` |
| Nhập hàng loạt | `handleSave()` trong QuestionImportModal | `questions` |
| Tạo đề thi | form trong ExamFormModal | `exams` |
| Nộp bài thi/luyện tập | `handleFinish()` trong QuizSession | `quiz_sessions` |
| Xem kết quả | `fetchSessions()` trong HistoryPage | `quiz_sessions` |
| Xem tiến trình học | `loadData()` trong LearnPage | `lesson_progress` |
