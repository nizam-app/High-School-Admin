import { http } from '../../../shared/services/http';

const pick = (source, keys, fallback = null) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return fallback;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDisplayText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text || fallback;
  }
  if (typeof value === 'object') {
    const nested =
      pick(value, ['name', 'fullName', 'teacherName', 'instructorName', 'username', 'email'], '') || '';
    const text = String(nested).trim();
    return text || fallback;
  }
  return fallback;
};

const normalizeStatus = (value) => {
  const status = String(value || 'Scheduled').trim();
  return status || 'Scheduled';
};

const normalizeActions = (value, status) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return { label: item, variant: '' };
        if (!item || typeof item !== 'object') return null;
        const label = pick(item, ['label', 'name', 'title', 'action'], '');
        const variant = pick(item, ['variant', 'type', 'intent'], '');
        return label ? { label: String(label), variant: String(variant || '') } : null;
      })
      .filter(Boolean);
  }

  const normalizedStatus = String(status || '').toLowerCase();
  if (normalizedStatus.includes('completed')) {
    // No row-level actions for completed sessions.
    return [];
  }
  if (normalizedStatus.includes('pending')) {
    return [
      { label: 'Approve', variant: 'success' },
      { label: 'Reject', variant: 'danger' },
    ];
  }
  if (normalizedStatus.includes('ongoing') || normalizedStatus.includes('live')) {
    return [
      { label: 'Join', variant: 'primary' },
      { label: 'Track', variant: 'secondary' },
    ];
  }
  return [
    { label: 'Edit', variant: 'secondary' },
    { label: 'Cancel', variant: 'danger' },
  ];
};

function extractEnrolledStudents(session) {
  const raw = pick(session, ['students', 'enrolledStudents', 'roster', 'studentList', 'enrolled'], null);
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((s, i) => {
    if (s == null) return { id: `enrolled-${i}`, name: '' };
    if (typeof s === 'string') return { id: `enrolled-${i}`, name: s };
    const id = String(pick(s, ['id', '_id', 'studentId', 'student_id'], `enrolled-${i}`));
    const name = toDisplayText(pick(s, ['name', 'studentName', 'fullName', 'student_name', 'username']), '');
    return { id, name: name || `Student ${i + 1}` };
  });
}

const normalizeSession = (session, index) => {
  const rawStatus = normalizeStatus(pick(session, ['status', 'state'], 'Scheduled'));
  const attendanceRaw = pick(session, ['attendance', 'attendanceRate', 'attendance_rate'], null);
  const attendance =
    attendanceRaw === null || attendanceRaw === undefined ? null : toNumber(attendanceRaw, null);
  const studentCount = toNumber(
    pick(session, ['studentCount', 'students', 'totalStudents', 'student_count'], 0),
    0
  );
  const joinedCount = toNumber(
    pick(session, ['joinedCount', 'attendedStudents', 'presentStudents', 'joined_count'], studentCount),
    studentCount
  );
  const enrolledStudents = extractEnrolledStudents(session);

  // Derive time-based status for approved/scheduled sessions only:
  // - Scheduled (future approved session)
  // - Live (ongoing)
  // - Completed (past)
  // For other raw statuses (Pending, Cancelled, etc.), we keep backend status.
  let status = rawStatus;
  const now = Date.now();
  let startMs = null;
  let endMs = null;

  // Prefer explicit date + time from separate fields, since some backends
  // store scheduledDate at midnight (00:00:00Z) only.
  const dateField = pick(session, ['date', 'scheduledDate', 'sessionDate', 'startAt', 'start_at'], null);
  const timeField = pick(session, ['time', 'scheduledTime', 'startTime'], null);

  if (typeof dateField === 'string') {
    const safeDate = dateField.slice(0, 10); // YYYY-MM-DD
    const timeString = typeof timeField === 'string' ? timeField : '';
    const timeMatch = timeString ? timeString.match(/\d{1,2}:\d{2}/) : null; // extract HH:mm from "10:00 (60)"
    if (safeDate && timeMatch) {
      const isoCandidate = `${safeDate}T${timeMatch[0]}:00`;
      const parsed = Date.parse(isoCandidate);
      if (Number.isFinite(parsed)) {
        startMs = parsed;
      }
    }
  }

  if (startMs === null) {
    const scheduledDateRaw = pick(
      session,
      ['scheduledDate', 'sessionDate', 'startAt', 'start_at'],
      null
    );
    if (typeof scheduledDateRaw === 'string') {
      const parsed = Date.parse(scheduledDateRaw);
      if (Number.isFinite(parsed)) {
        startMs = parsed;
      }
    }
  }

  const durationMinutes = toNumber(
    pick(session, ['durationMinutes', 'duration', 'length'], null),
    60
  );
  if (startMs !== null) {
    endMs = startMs + Math.max(durationMinutes, 1) * 60 * 1000;
  }

  const rawStatusLower = rawStatus.toLowerCase();
  const shouldUseTimeBasedStatus =
    rawStatusLower === 'approved' || rawStatusLower === 'scheduled';

  if (shouldUseTimeBasedStatus && startMs !== null && endMs !== null) {
    if (now < startMs) {
      status = 'Scheduled';
    } else if (now >= startMs && now <= endMs) {
      status = 'Live';
    } else if (now > endMs) {
      status = 'Completed';
    }
  }

  return {
    id: String(pick(session, ['id', '_id'], `session-${index}`)),
    title: toDisplayText(pick(session, ['title', 'name'], 'Untitled Session'), 'Untitled Session'),
    createdAt: toDisplayText(pick(session, ['createdAt', 'created_at', 'createdOn', 'created_on'], ''), ''),
    status,
    subject: toDisplayText(pick(session, ['subject', 'topic', 'category'], ''), ''),
    grade: toDisplayText(pick(session, ['grade', 'gradeLevel', 'className', 'class'], ''), ''),
    teacher: toDisplayText(pick(session, ['teacher', 'teacherName', 'instructor', 'host'], 'Teacher'), 'Teacher'),
    date: toDisplayText(pick(session, ['date', 'scheduledDate', 'sessionDate'], '-'), '-'),
    time: toDisplayText(pick(session, ['time', 'scheduledTime', 'startTime'], '-'), '-'),
    duration: toDisplayText(pick(session, ['duration', 'durationLabel', 'length'], ''), ''),
    studentCount,
    joinedCount,
    attendance,
    enrolledStudents,
    meetingLink: toDisplayText(
      pick(session, ['meetingLink', 'zoomLink', 'meetingUrl', 'meetingURL', 'joinUrl', 'joinURL', 'url', 'link'], ''),
      ''
    ),
    rawStatus,
    actions: normalizeActions(pick(session, ['actions', 'buttons'], null), status),
  };
};

const extractList = (root) => {
  if (Array.isArray(root)) return root;

  const direct = pick(root, ['sessions', 'items', 'results', 'docs', 'rows', 'data'], null);
  if (Array.isArray(direct)) return direct;

  if (direct && typeof direct === 'object') {
    const nested = pick(direct, ['sessions', 'items', 'results', 'docs', 'rows', 'data'], null);
    if (Array.isArray(nested)) return nested;
  }

  return [];
};

const extractPagination = (payload, root, page, limit, count) => {
  const nestedSessions = pick(root, ['sessions'], null);
  const pagingRoot =
    pick(payload, ['pagination', 'meta'], null) ||
    pick(root, ['pagination', 'meta'], null) ||
    pick(nestedSessions, ['pagination', 'meta'], null) ||
    {};

  const total = toNumber(
    pick(pagingRoot, ['total', 'totalItems', 'count'], null) ??
      pick(payload, ['total', 'count'], null) ??
      pick(root, ['total', 'count'], null),
    count
  );
  const currentPage = toNumber(
    pick(pagingRoot, ['page', 'currentPage'], null) ??
      pick(payload, ['page', 'currentPage'], null) ??
      pick(root, ['page', 'currentPage'], null),
    page
  );
  const perPage = toNumber(
    pick(pagingRoot, ['limit', 'perPage'], null) ??
      pick(payload, ['limit', 'perPage'], null) ??
      pick(root, ['limit', 'perPage'], null),
    limit
  );
  const totalPages = toNumber(
    pick(pagingRoot, ['totalPages', 'pages', 'lastPage'], null) ??
      pick(payload, ['totalPages', 'pages'], null) ??
      pick(root, ['totalPages', 'pages'], null),
    Math.max(1, Math.ceil((total || count || 0) / Math.max(perPage || limit || 1, 1)))
  );

  return {
    total,
    page: currentPage,
    limit: perPage,
    totalPages: totalPages > 0 ? totalPages : 1,
  };
};

export const getLiveSessionsStats = async () => {
  const response = await http.get('/admin/live-sessions/stats');
  const payload = response.data;
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
};

export const getLiveSessions = async ({ tab = 'all', page = 1, limit = 5 } = {}) => {
  const response = await http.get('/admin/live-sessions', {
    params: {
      tab,
      page,
      limit,
    },
  });

  const payload = response?.data || {};
  const root = payload?.data ?? payload;
  const items = extractList(root).map(normalizeSession);
  const pagination = extractPagination(payload, root, page, limit, items.length);

  return {
    items,
    pagination,
  };
};

export const cancelLiveSession = async (id) => {
  const encodedId = encodeURIComponent(String(id || '').trim());
  const response = await http.delete(`/admin/live-sessions/${encodedId}`, { data: {} });
  return response?.data;
};

export const approveLiveSession = async (id) => {
  const encodedId = encodeURIComponent(String(id || '').trim());
  const response = await http.patch(`/admin/live-sessions/${encodedId}/approve`, {});
  return response?.data;
};

export const rejectLiveSession = async ({ id, reason }) => {
  const encodedId = encodeURIComponent(String(id || '').trim());
  const response = await http.patch(`/admin/live-sessions/${encodedId}/reject`, {
    reason: String(reason || 'Rejected by admin').trim(),
  });
  return response?.data;
};

/**
 * Create a new live session.
 * @param {Object} payload - { title, subject, grade, teacher|teacherName, teacherId, className, date|scheduledDate, time|startTime, duration, meetingLink }
 */
export const createLiveSession = async (payload = {}) => {
  const body = {
    title: payload.title ?? payload.name ?? '',
    subject: payload.subject ?? payload.topic ?? '',
    grade: payload.grade ?? payload.gradeLevel ?? payload.class ?? '',
    teacher: payload.teacher ?? payload.teacherName ?? payload.instructor ?? '',
    teacherId: payload.teacherId ?? payload.teacher_id ?? payload.teacherID ?? '',
    className: payload.className ?? payload.class_name ?? '',
    date: payload.date ?? payload.scheduledDate ?? payload.sessionDate ?? '',
    time: payload.time ?? payload.startTime ?? payload.scheduledTime ?? '',
    duration: payload.duration ?? payload.length ?? '',
    meetingLink: payload.meetingLink ?? payload.zoomLink ?? payload.link ?? '',
  };
  const response = await http.post('/admin/live-sessions', body);
  return response?.data;
};

/**
 * Update an existing live session.
 * PATCH /admin/live-sessions/:id
 * @param {string} id - Session id
 * @param {Object} payload - { title, subject, grade, teacher, teacherId, date, time, duration }
 */
export const updateLiveSession = async (id, payload = {}) => {
  const rawId = String(id ?? '').trim();
  if (!rawId) {
    const err = new Error('Session id is required to update.');
    err.response = { status: 400 };
    throw err;
  }
  const encodedId = encodeURIComponent(rawId);

  const title = payload.title ?? payload.name ?? '';
  const subject = payload.subject ?? payload.topic ?? '';
  const grade = payload.grade ?? payload.gradeLevel ?? payload.class ?? '';
  const teacher = payload.teacher ?? payload.teacherName ?? payload.instructor ?? '';
  const teacherId = payload.teacherId ?? payload.teacher_id ?? payload.teacherID ?? '';
  const date = payload.date ?? payload.scheduledDate ?? payload.sessionDate ?? '';
  const time = payload.time ?? payload.startTime ?? payload.scheduledTime ?? '';
  const durationRaw = payload.duration ?? payload.length ?? payload.durationMinutes ?? '';
  const meetingLink = payload.meetingLink ?? payload.zoomLink ?? payload.meetingUrl ?? payload.link ?? '';

  const body = {
    title,
    subject,
    grade,
    teacher,
    teacherId,
    date,
    time,
    duration: durationRaw,
    meetingLink,
  };

  const durationNum = typeof durationRaw === 'number' ? durationRaw : parseInt(String(durationRaw).replace(/\D/g, ''), 10);
  if (Number.isFinite(durationNum)) {
    body.duration = durationNum;
    body.durationMinutes = durationNum;
  }

  if (date && time && /^\d{4}-\d{2}-\d{2}$/.test(String(date).trim()) && /\d{1,2}:\d{2}/.test(String(time))) {
    const [y, m, d] = String(date).trim().split('-');
    const t = String(time).trim().match(/\d{1,2}:\d{2}/)?.[0] ?? time;
    body.scheduledDate = `${y}-${m}-${d}T${t}:00.000Z`;
  }

  const response = await http.patch(`/admin/live-sessions/${encodedId}`, body);
  return response?.data;
};

/**
 * Get a single session by id (e.g. for Track modal student names).
 * GET /admin/live-sessions/:id
 */
export const getSessionById = async (sessionId) => {
  const id = String(sessionId ?? '').trim();
  if (!id) return null;
  const encodedId = encodeURIComponent(id);
  const response = await http.get(`/admin/live-sessions/${encodedId}`);
  const payload = response?.data;
  const raw = payload?.data ?? payload;
  if (!raw || typeof raw !== 'object') return null;
  const enrolledStudents = extractEnrolledStudents(raw);
  return {
    id: String(pick(raw, ['id', '_id'], id)),
    title: toDisplayText(pick(raw, ['title', 'name'], 'Untitled Session'), 'Untitled Session'),
    studentCount: toNumber(pick(raw, ['studentCount', 'totalStudents', 'student_count']), 0),
    joinedCount: toNumber(pick(raw, ['joinedCount', 'presentStudents', 'joined_count']), 0),
    attendance: toNumber(pick(raw, ['attendance', 'attendanceRate', 'attendance_rate']), null),
    enrolledStudents,
  };
};

/**
 * Get attendance for a session (for Track modal).
 * Primary source: GET /sessions/:id
 * This endpoint is expected to return the student list and summary
 * for a single live session.
 */
export const getSessionAttendance = async (sessionId) => {
  const id = String(sessionId ?? '').trim();
  if (!id) return { students: [], total: 0, present: 0, absent: 0, attendanceRate: 0 };

  const encodedId = encodeURIComponent(id);

  // Backend route for track modal UI
  const response = await http.get(`/sessions/${encodedId}`);
  const payload = response?.data;

  // Common shapes:
  // - { data: { ...session, students: [...] } }
  // - { students: [...], totalStudents, present, absent, attendanceRate }
  // - plain array: [ { student ... }, ... ]
  const root = payload?.data ?? payload ?? {};

  const studentsRoot =
    Array.isArray(root)
      ? root
      : Array.isArray(root.students)
        ? root.students
        : Array.isArray(root.items)
          ? root.items
          : Array.isArray(root.attendance?.students)
            ? root.attendance.students
            : [];

  const students = studentsRoot.map((s, i) => ({
    id: String(pick(s, ['id', '_id', 'studentId', 'student_id'], `student-${i}`)),
    name: toDisplayText(
      pick(s, ['name', 'studentName', 'fullName', 'student_name', 'student'], `Student ${i + 1}`),
      `Student ${i + 1}`
    ),
    status: normalizeAttendanceStatus(pick(s, ['status', 'attendance', 'state'], 'Absent')),
    joinTime: toDisplayText(pick(s, ['joinTime', 'join_time', 'joinedAt', 'joined_at'], ''), ''),
    participation:
      pick(s, ['participation', 'participationRate', 'participation_rate'], null) != null
        ? toNumber(pick(s, ['participation', 'participationRate', 'participation_rate'], 0), 0)
        : null,
  }));

  const summaryRoot = root.summary ?? root;
  const total = toNumber(
    pick(summaryRoot, ['total', 'totalStudents', 'total_students', 'studentCount']) ??
      (Array.isArray(root) ? root.length : null),
    students.length
  );
  const present = toNumber(
    pick(summaryRoot, ['present', 'presentCount', 'present_count', 'joined', 'presentStudents']),
    0
  );
  const absent = toNumber(
    pick(summaryRoot, ['absent', 'absentCount', 'absent_count']),
    Math.max(0, total - present)
  );
  const attendanceRate = toNumber(
    pick(summaryRoot, ['attendanceRate', 'attendance_rate', 'rate']),
    total > 0 ? Math.round((present / total) * 100) : 0
  );

  return { students, total, present, absent, attendanceRate };
};

function normalizeAttendanceStatus(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (v.includes('present') || v === 'joined' || v === 'here') return 'Present';
  return 'Absent';
}

/**
 * Update a student's attendance (admin track).
 * PUT /admin/live-sessions/:sessionId/attendance/:studentId
 */
export const updateStudentAttendance = async (sessionId, studentId, payload = {}) => {
  const sId = String(sessionId ?? '').trim();
  const stId = String(studentId ?? '').trim();
  if (!sId || !stId) {
    const err = new Error('Session id and student id are required.');
    err.response = { status: 400 };
    throw err;
  }
  const encodedSessionId = encodeURIComponent(sId);
  const encodedStudentId = encodeURIComponent(stId);
  const body = {
    status: payload.status ?? payload.attendance ?? 'Present',
    joinTime: payload.joinTime ?? payload.join_time ?? '',
    participation: payload.participation ?? payload.participationRate ?? null,
  };
  const response = await http.put(
    `/admin/live-sessions/${encodedSessionId}/attendance/${encodedStudentId}`,
    body
  );
  return response?.data;
};
