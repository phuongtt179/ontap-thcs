# SQL TẠO BẢNG SUPABASE — EDUQUIZMASTER

> Chạy toàn bộ file này trong **Supabase Dashboard → SQL Editor**.
> Các lệnh đều có `IF NOT EXISTS` / `OR REPLACE` — an toàn để chạy lại nhiều lần.

---

## SƠ ĐỒ QUAN HỆ CÁC BẢNG

```
auth.users (Supabase tự quản lý)
    └── profiles (1-1)

subjects
    ├── teacher_subjects (giáo viên được phân công môn nào)
    ├── topics           (chủ đề theo môn + khối)
    ├── questions        (câu hỏi thuộc môn)
    ├── exams            (đề thi thuộc môn)
    └── lessons          (bài học thuộc môn)

profiles
    ├── quiz_sessions    (kết quả làm bài của học sinh)
    └── lesson_progress  (tiến trình học bài)

exams
    └── quiz_sessions    (mỗi lần làm bài thuộc đề nào)

lessons
    └── lesson_progress  (tiến trình từng bài học)
```

---

## BƯỚC 1 — TẠO CÁC BẢNG

### 1. Bảng `grades` — Danh sách khối lớp

```sql
-- Lưu danh sách khối: 6, 7, 8, 9 (hoặc tùy chỉnh)
-- Admin có thể thêm/sửa/xóa khối trong trang quản trị
create table if not exists public.grades (
  id         serial primary key,
  name       text not null unique,   -- "6", "7", "8", "9"
  created_at timestamptz not null default now()
);

-- Thêm dữ liệu mặc định
insert into public.grades (name) values ('6'), ('7'), ('8'), ('9')
  on conflict (name) do nothing;
```

---

### 2. Bảng `profiles` — Thông tin người dùng

```sql
-- Mở rộng từ auth.users của Supabase
-- Mỗi tài khoản đăng ký sẽ tự động có 1 dòng trong bảng này (xem trigger bên dưới)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  role        text not null default 'student'
                check (role in ('admin', 'teacher', 'student')),
  grade       text,                    -- khối lớp của học sinh (vd: "7")
  class_name  text,                    -- tên lớp (vd: "7A1")
  username    text,                    -- tên đăng nhập rút gọn (tùy chọn)
  avatar_url  text,                    -- link ảnh đại diện
  is_approved boolean not null default false,  -- tài khoản đã được admin duyệt chưa?
  is_active   boolean not null default true,   -- tài khoản có bị khóa không?
  created_at  timestamptz not null default now()
);
```

> **Lưu ý:**
> - `is_approved = false` → tài khoản chờ admin duyệt, chưa đăng nhập được
> - `is_active = false` → tài khoản bị khóa bởi admin
> - Học sinh mới đăng ký cần admin duyệt trước khi sử dụng

---

### 3. Bảng `subjects` — Danh sách môn học

```sql
-- Admin tạo các môn: Toán, Tiếng Anh, Tin học, KHTN...
create table if not exists public.subjects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,   -- "Toán", "Tiếng Anh"...
  color      text not null default 'indigo',  -- màu hiển thị (CSS)
  icon       text not null default 'BookOpen', -- tên icon Lucide
  created_at timestamptz not null default now()
);
```

---

### 4. Bảng `teacher_subjects` — Giáo viên dạy môn nào

```sql
-- Mỗi giáo viên được phân công 1 hoặc nhiều môn
-- Giáo viên chỉ thấy câu hỏi / đề thi của môn mình được phân công
create table if not exists public.teacher_subjects (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (teacher_id, subject_id)  -- mỗi cặp giáo viên-môn chỉ có 1 dòng
);
```

---

### 5. Bảng `topics` — Chủ đề theo môn và khối lớp

```sql
-- Phân loại câu hỏi / bài học theo chủ đề
-- Vd: môn Tin học khối 7 → "Bảng tính Excel", "Mạng Internet"...
create table if not exists public.topics (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  grade      text not null,           -- "6", "7", "8", "9", hoặc "all" (dùng mọi khối)
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now()
);
```

---

### 6. Bảng `questions` — Ngân hàng câu hỏi

```sql
-- Bảng quan trọng nhất — lưu tất cả câu hỏi của mọi môn, mọi dạng
create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  question       text not null,          -- nội dung câu hỏi
  type           text not null check (type in (
                   'multiple_choice',    -- trắc nghiệm A/B/C/D
                   'true_false',         -- đúng / sai
                   'fill_blank',         -- điền từ vào chỗ trống ___
                   'matching',           -- nối đôi cột trái - cột phải
                   'ordering',           -- sắp xếp thứ tự các mục
                   'drag_word',          -- kéo thả từ vào câu (có ___)
                   'word_order'          -- sắp xếp từ thành câu hoàn chỉnh
                 )),
  options        jsonb default '[]',     -- đáp án: [{key:"A", text:"...", image_url:"..."}]
  match_options  jsonb default '[]',     -- cột phải cho dạng nối đôi: [{key:"1", text:"..."}]
  correct_answer text,                   -- đáp án đúng (xem bảng bên dưới)
  image_url      text,                   -- link ảnh minh họa (Cloudinary)
  audio_url      text,                   -- link file âm thanh (Cloudinary)
  grade          text not null,          -- khối lớp áp dụng
  subject_id     uuid references public.subjects(id) on delete set null,
  topic          text,                   -- tên chủ đề
  difficulty     text not null default 'easy'
                   check (difficulty in ('easy', 'medium', 'hard')),
  created_at     timestamptz not null default now()
);
```

> **Định dạng `correct_answer` theo từng dạng câu hỏi:**
>
> | Dạng | Ví dụ `correct_answer` |
> |------|----------------------|
> | multiple_choice | `"B"` |
> | true_false | `"Đúng"` hoặc `"Sai"` |
> | fill_blank | `"Hà Nội"` hoặc `"Hà Nội,Việt Nam"` (nhiều chỗ trống) |
> | matching | `"A-2,B-3,C-1"` (A nối với 2, B nối với 3...) |
> | ordering | `"A,B,C,D"` (thứ tự đúng của các key) |
> | drag_word | `"CPU"` hoặc `"CPU,RAM"` (từ điền vào từng ___) |
> | word_order | `"She is a beautiful teacher"` (cả câu hoàn chỉnh) |

---

### 7. Bảng `exams` — Đề thi

```sql
-- Giáo viên tạo đề bằng cách chọn câu hỏi từ bảng questions
create table if not exists public.exams (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,            -- tiêu đề đề thi
  grade        text not null,            -- khối lớp được làm
  subject_id   uuid references public.subjects(id) on delete set null,
  time_limit   integer default 30,       -- giới hạn thời gian (phút), null = không giới hạn
  max_attempts integer default 1,        -- số lần học sinh được làm lại
  is_active    boolean not null default false,  -- true = học sinh thấy và làm được
  show_answer  boolean not null default true,   -- hiện đáp án sau khi nộp?
  show_score   boolean not null default true,   -- hiện điểm sau khi nộp?
  question_ids uuid[] not null default '{}',    -- mảng id câu hỏi được chọn
  created_at   timestamptz not null default now()
);
```

> **Lưu ý `question_ids`:**
> Đây là mảng UUID trỏ đến bảng `questions`.
> Khi học sinh làm bài, app đọc mảng này rồi fetch câu hỏi từ bảng `questions`.

---

### 8. Bảng `quiz_sessions` — Kết quả mỗi lần làm bài

```sql
-- Lưu mỗi lần học sinh nộp bài (thi hoặc luyện tập)
create table if not exists public.quiz_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  exam_id        uuid references public.exams(id) on delete set null,  -- null nếu là luyện tập
  mode           text check (mode in ('exam', 'practice')),
  total          integer not null,         -- tổng số câu
  correct        integer not null,         -- số câu đúng
  score          numeric(4,1) not null,    -- điểm thang 10 (vd: 8.5)
  answers        jsonb default '{}',       -- đáp án học sinh: {0: "B", 1: "Đúng", 2: "CPU"}
  question_ids   uuid[] default '{}',      -- id câu hỏi đã làm (dùng khi luyện tập)
  attempt_number integer default 1,        -- lần làm thứ mấy (cho đề có max_attempts > 1)
  submitted_at   timestamptz default now(),
  created_at     timestamptz not null default now()
);
```

---

### 9. Bảng `lessons` — Bài học lý thuyết

```sql
-- Giáo viên đăng bài học có video + câu hỏi kiểm tra + bài thực hành
create table if not exists public.lessons (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,                      -- mô tả ngắn bài học
  topic        text,                      -- chủ đề thuộc về
  grade        text not null,
  subject_id   uuid references public.subjects(id) on delete set null,
  video_url    text,                      -- link YouTube hoặc video trực tiếp
  question_ids uuid[] not null default '{}',  -- câu hỏi kiểm tra hiểu bài
  has_practice boolean not null default false, -- có bài thực hành nộp không?
  is_published boolean not null default false, -- true = học sinh thấy bài học
  "order"      integer not null default 0,     -- thứ tự hiển thị trong danh sách
  created_at   timestamptz not null default now()
);
```

---

### 10. Bảng `lesson_progress` — Tiến trình học của học sinh

```sql
-- Theo dõi từng học sinh học bài đến đâu (3 bước: video → quiz → thực hành)
create table if not exists public.lesson_progress (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  lesson_id          uuid not null references public.lessons(id) on delete cascade,
  video_watched      boolean not null default false,   -- đã xem video chưa?
  quiz_passed        boolean not null default false,   -- đã qua bài kiểm tra chưa?
  practice_submitted boolean not null default false,   -- đã nộp bài thực hành chưa?
  completed          boolean not null default false,   -- hoàn thành cả 3 bước?
  submitted_at       timestamptz,                      -- thời điểm hoàn thành
  created_at         timestamptz not null default now(),
  unique (user_id, lesson_id)   -- mỗi học sinh chỉ có 1 dòng cho mỗi bài học
);
```

---

## BƯỚC 2 — TẠO INDEX (tăng tốc truy vấn)

```sql
-- Index giúp lọc nhanh khi có nhiều dữ liệu (hàng nghìn câu hỏi, học sinh...)
create index if not exists idx_topics_grade           on public.topics(grade);
create index if not exists idx_topics_subject_id      on public.topics(subject_id);
create index if not exists idx_questions_grade        on public.questions(grade);
create index if not exists idx_questions_subject_id   on public.questions(subject_id);
create index if not exists idx_questions_topic        on public.questions(topic);
create index if not exists idx_exams_grade            on public.exams(grade);
create index if not exists idx_exams_subject_id       on public.exams(subject_id);
create index if not exists idx_exams_is_active        on public.exams(is_active);
create index if not exists idx_quiz_sessions_user_id  on public.quiz_sessions(user_id);
create index if not exists idx_quiz_sessions_exam_id  on public.quiz_sessions(exam_id);
create index if not exists idx_lessons_grade          on public.lessons(grade);
create index if not exists idx_lessons_subject_id     on public.lessons(subject_id);
create index if not exists idx_lesson_progress_user   on public.lesson_progress(user_id);
create index if not exists idx_lesson_progress_lesson on public.lesson_progress(lesson_id);
create index if not exists idx_teacher_subjects_teacher on public.teacher_subjects(teacher_id);
create index if not exists idx_teacher_subjects_subject on public.teacher_subjects(subject_id);
```

---

## BƯỚC 3 — TRIGGER tự tạo profile khi đăng ký

```sql
-- Khi user đăng ký qua Supabase Auth, tự động tạo dòng trong bảng profiles
-- Dữ liệu được lấy từ raw_user_meta_data (truyền vào lúc signUp)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, role, grade, class_name
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    nullif(new.raw_user_meta_data->>'grade', ''),
    nullif(new.raw_user_meta_data->>'class_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Gắn trigger vào sự kiện tạo user mới
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## BƯỚC 4 — BẬT ROW LEVEL SECURITY (RLS)

> RLS = "Bảo mật theo dòng" — kiểm soát ai được đọc/sửa/xóa dòng nào.
> Bắt buộc phải bật để bảo vệ dữ liệu khi dùng Supabase client từ trình duyệt.

```sql
alter table public.profiles          enable row level security;
alter table public.grades            enable row level security;
alter table public.subjects          enable row level security;
alter table public.teacher_subjects  enable row level security;
alter table public.topics            enable row level security;
alter table public.questions         enable row level security;
alter table public.exams             enable row level security;
alter table public.quiz_sessions     enable row level security;
alter table public.lessons           enable row level security;
alter table public.lesson_progress   enable row level security;
```

---

## BƯỚC 5 — HÀM HELPER KIỂM TRA QUYỀN

```sql
-- Trả về true nếu người dùng hiện tại là admin
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Trả về true nếu là admin hoặc giáo viên
create or replace function public.is_teacher()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'teacher')
  );
$$;
```

---

## BƯỚC 6 — POLICIES (quy tắc ai được làm gì)

### Bảng `profiles`
```sql
-- Học sinh/giáo viên đọc profile của chính mình
create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

-- Admin đọc tất cả profiles
create policy "profiles: admin read all"
  on public.profiles for select
  using (public.is_admin());

-- Giáo viên đọc profiles học sinh (để xem danh sách lớp)
create policy "profiles: teacher read students"
  on public.profiles for select
  using (public.is_teacher());

-- Tự cập nhật profile của mình
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

-- Admin cập nhật mọi profile (duyệt tài khoản, khóa user...)
create policy "profiles: admin update all"
  on public.profiles for update
  using (public.is_admin());

-- Admin xóa profile
create policy "profiles: admin delete"
  on public.profiles for delete
  using (public.is_admin());
```

### Bảng `grades`, `subjects`
```sql
-- Mọi người đăng nhập đều đọc được
create policy "grades: authenticated read"
  on public.grades for select
  using (auth.role() = 'authenticated');

create policy "grades: admin manage"
  on public.grades for all
  using (public.is_admin());

create policy "subjects: authenticated read"
  on public.subjects for select
  using (auth.role() = 'authenticated');

create policy "subjects: admin manage"
  on public.subjects for all
  using (public.is_admin());
```

### Bảng `teacher_subjects`, `topics`
```sql
create policy "teacher_subjects: authenticated read"
  on public.teacher_subjects for select
  using (auth.role() = 'authenticated');

create policy "teacher_subjects: admin manage"
  on public.teacher_subjects for all
  using (public.is_admin());

create policy "topics: authenticated read"
  on public.topics for select
  using (auth.role() = 'authenticated');

create policy "topics: teacher insert"
  on public.topics for insert
  with check (public.is_teacher());

create policy "topics: teacher update"
  on public.topics for update
  using (public.is_teacher());

create policy "topics: admin delete"
  on public.topics for delete
  using (public.is_admin());
```

### Bảng `questions`
```sql
-- Mọi người đăng nhập đọc được câu hỏi (học sinh cần khi làm bài)
create policy "questions: authenticated read"
  on public.questions for select
  using (auth.role() = 'authenticated');

create policy "questions: teacher insert"
  on public.questions for insert
  with check (public.is_teacher());

create policy "questions: teacher update"
  on public.questions for update
  using (public.is_teacher());

create policy "questions: teacher delete"
  on public.questions for delete
  using (public.is_teacher());
```

### Bảng `exams`
```sql
-- Học sinh chỉ thấy đề đang mở (is_active = true), giáo viên thấy tất cả
create policy "exams: student see active"
  on public.exams for select
  using (is_active = true or public.is_teacher());

create policy "exams: teacher insert"
  on public.exams for insert
  with check (public.is_teacher());

create policy "exams: teacher update"
  on public.exams for update
  using (public.is_teacher());

create policy "exams: teacher delete"
  on public.exams for delete
  using (public.is_teacher());
```

### Bảng `quiz_sessions`
```sql
-- Học sinh chỉ thấy kết quả của chính mình; giáo viên thấy tất cả
create policy "quiz_sessions: read own or teacher"
  on public.quiz_sessions for select
  using (auth.uid() = user_id or public.is_teacher());

-- Học sinh tự lưu kết quả của mình
create policy "quiz_sessions: student insert own"
  on public.quiz_sessions for insert
  with check (auth.uid() = user_id);

create policy "quiz_sessions: admin delete"
  on public.quiz_sessions for delete
  using (public.is_admin());
```

### Bảng `lessons`
```sql
-- Học sinh thấy bài học đã publish; giáo viên thấy tất cả
create policy "lessons: student see published"
  on public.lessons for select
  using (is_published = true or public.is_teacher());

create policy "lessons: teacher insert"
  on public.lessons for insert
  with check (public.is_teacher());

create policy "lessons: teacher update"
  on public.lessons for update
  using (public.is_teacher());

create policy "lessons: teacher delete"
  on public.lessons for delete
  using (public.is_teacher());
```

### Bảng `lesson_progress`
```sql
create policy "lesson_progress: read own or teacher"
  on public.lesson_progress for select
  using (auth.uid() = user_id or public.is_teacher());

create policy "lesson_progress: student insert own"
  on public.lesson_progress for insert
  with check (auth.uid() = user_id);

create policy "lesson_progress: student update own"
  on public.lesson_progress for update
  using (auth.uid() = user_id);
```

---

## TỔNG KẾT

| # | Bảng | Mục đích |
|---|------|---------|
| 1 | `grades` | Danh sách khối lớp (6, 7, 8, 9) |
| 2 | `profiles` | Thông tin người dùng + vai trò + trạng thái |
| 3 | `subjects` | Danh sách môn học |
| 4 | `teacher_subjects` | Giáo viên dạy môn nào |
| 5 | `topics` | Chủ đề theo môn + khối |
| 6 | `questions` | Ngân hàng câu hỏi (7 dạng) |
| 7 | `exams` | Đề thi (chứa danh sách id câu hỏi) |
| 8 | `quiz_sessions` | Kết quả mỗi lần làm bài |
| 9 | `lessons` | Bài học lý thuyết |
| 10 | `lesson_progress` | Tiến trình học của từng học sinh |
