import { http } from '../../../shared/services/http';

const normalizeKey = (value) => String(value || '').replace(/[_\-\s]/g, '').toLowerCase();

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const cleaned = value.replace('%', '').trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const deepFindByAliases = (source, aliases, fallback = null) => {
  if (!source || typeof source !== 'object') return fallback;

  const aliasSet = new Set(aliases.map(normalizeKey));
  const queue = [source];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      current.forEach((item) => {
        if (item && typeof item === 'object') queue.push(item);
      });
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (aliasSet.has(normalizeKey(key)) && value !== undefined && value !== null && value !== '') {
        return value;
      }
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return fallback;
};

const deriveStatus = (entry) => {
  const explicit = String(
    deepFindByAliases(entry, ['status', 'performanceStatus', 'remark', 'gradeStatus'], '')
  )
    .trim()
    .toLowerCase();

  if (explicit.includes('excellent')) return 'excellent';
  if (explicit.includes('good')) return 'good';
  if (explicit.includes('need')) return 'needs_attention';
  if (explicit.includes('average')) return 'average';

  const attendance = toNumberOrNull(
    deepFindByAliases(entry, ['attendancePct', 'attendance', 'attendancePercentage', 'attendanceRate'])
  );
  const avgScore = toNumberOrNull(
    deepFindByAliases(entry, ['avgScorePct', 'avgScore', 'averageScore', 'performancePct'])
  );

  const score = avgScore ?? attendance ?? 0;
  if (score >= 90) return 'excellent';
  if (score >= 80) return 'good';
  if (score >= 70) return 'average';
  return 'needs_attention';
};

const normalizeStudents = (root) => {
  const source =
    deepFindByAliases(root, ['students', 'studentProgress', 'progress', 'items', 'rows'], null) || [];

  if (!Array.isArray(source)) return [];

  return source
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;

      const name = String(
        deepFindByAliases(entry, ['studentName', 'name', 'fullName', 'student', 'student_name'], '')
      ).trim();
      const grade = String(
        deepFindByAliases(entry, ['grade', 'gradeLevel', 'className', 'class', 'gradeSection'], '')
      ).trim();

      const assignmentsCompleted =
        toNumberOrNull(
          deepFindByAliases(entry, [
            'assignmentsCompleted',
            'completedAssignments',
            'submittedAssignments',
            'completed',
          ])
        ) ?? 0;

      const assignmentsTotal =
        toNumberOrNull(
          deepFindByAliases(entry, ['assignmentsTotal', 'totalAssignments', 'assignments', 'total'])
        ) ?? 0;

      const attendancePct =
        toNumberOrNull(
          deepFindByAliases(entry, ['attendancePct', 'attendance', 'attendancePercentage', 'attendanceRate'])
        ) ?? 0;

      const avgScorePct =
        toNumberOrNull(
          deepFindByAliases(entry, ['avgScorePct', 'avgScore', 'averageScore', 'performancePct'])
        ) ?? 0;

      return {
        id: String(entry?.id || entry?._id || name || index),
        name: name || `Student ${index + 1}`,
        grade: grade || 'N/A',
        assignmentsCompleted,
        assignmentsTotal,
        attendancePct,
        avgScorePct,
        status: deriveStatus(entry),
      };
    })
    .filter(Boolean);
};

export const getAnalyticsStudentProgress = async () => {
  const response = await http.get('/admin/analytics/student-progress');
  const payload = response?.data || {};
  const root = payload?.data || payload;

  const students = normalizeStudents(root);

  const summary = {
    totalStudents:
      toNumberOrNull(deepFindByAliases(root, ['totalStudents', 'studentsCount', 'studentCount'])) ??
      students.length,
    avgAttendance:
      toNumberOrNull(deepFindByAliases(root, ['avgAttendance', 'averageAttendance', 'attendanceAvg'])) ??
      0,
    assignmentsCompleted:
      toNumberOrNull(
        deepFindByAliases(root, [
          'assignmentsCompleted',
          'totalAssignmentsCompleted',
          'completedAssignments',
        ])
      ) ?? students.reduce((sum, item) => sum + Number(item.assignmentsCompleted || 0), 0),
    avgPerformance:
      toNumberOrNull(
        deepFindByAliases(root, ['avgPerformance', 'averagePerformance', 'avgScore', 'performanceAvg'])
      ) ??
      (students.length
        ? students.reduce((sum, item) => sum + Number(item.avgScorePct || 0), 0) / students.length
        : 0),
  };

  return { summary, students };
};

const deriveTeacherPerformance = (engagementPct) => {
  const value = Number(engagementPct || 0);
  if (value >= 85) return 'excellent';
  if (value >= 65) return 'good';
  return 'needs_attention';
};

const normalizeTeachers = (root) => {
  const source =
    deepFindByAliases(root, ['byTeacher', 'teachers', 'teacherActivity', 'items', 'rows'], null) || [];

  if (!Array.isArray(source)) return [];

  return source
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;

      const lessonsUploaded =
        toNumberOrNull(
          deepFindByAliases(entry, ['lessonsUploaded', 'lessonsCount', 'lessons', 'uploadedLessons'])
        ) ?? 0;

      const sessionsCreated =
        toNumberOrNull(
          deepFindByAliases(entry, ['sessionsCreated', 'sessionsCount', 'sessions', 'createdSessions'])
        ) ?? 0;

      const completedSessions =
        toNumberOrNull(
          deepFindByAliases(entry, ['completedSessionsCount', 'completedSessions', 'sessionsCompleted'])
        ) ?? 0;

      const engagementPct =
        toNumberOrNull(
          deepFindByAliases(entry, ['engagementPct', 'engagementRate', 'engagement', 'performancePct'])
        ) ?? (sessionsCreated > 0 ? (completedSessions / sessionsCreated) * 100 : 0);

      return {
        id: String(entry?.teacherId || entry?.id || entry?._id || index),
        name: String(deepFindByAliases(entry, ['name', 'teacherName', 'fullName'], 'Unknown')).trim(),
        lessonsUploaded,
        sessionsCreated,
        engagementPct,
        performance: deriveTeacherPerformance(engagementPct),
      };
    })
    .filter(Boolean);
};

export const getAnalyticsTeacherActivity = async () => {
  const response = await http.get('/admin/analytics/teacher-activity');
  const payload = response?.data || {};
  const root = payload?.data || payload;

  const teachers = normalizeTeachers(root);

  const summary = {
    totalTeachers:
      toNumberOrNull(deepFindByAliases(root, ['totalTeachers', 'teachersCount', 'teacherCount'])) ??
      teachers.length,
    lessonsUploaded:
      toNumberOrNull(deepFindByAliases(root, ['lessonsUploaded', 'totalLessons', 'lessonsCount'])) ??
      teachers.reduce((sum, t) => sum + Number(t.lessonsUploaded || 0), 0),
    sessionsCreated:
      toNumberOrNull(deepFindByAliases(root, ['sessionsCreated', 'totalSessions', 'sessionsCount'])) ??
      teachers.reduce((sum, t) => sum + Number(t.sessionsCreated || 0), 0),
    avgEngagement:
      toNumberOrNull(deepFindByAliases(root, ['avgEngagement', 'averageEngagement', 'engagementAvg'])) ??
      (teachers.length
        ? teachers.reduce((sum, t) => sum + Number(t.engagementPct || 0), 0) / teachers.length
        : 0),
  };

  return { summary, teachers };
};
