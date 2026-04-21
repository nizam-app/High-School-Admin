import { http } from '../../../shared/services/http';

const normalizeKey = (value) => String(value).replace(/[_\-\s]/g, '').toLowerCase();
const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

const deepFindCardValue = (source, cardAliases, fieldAliases, fallback = null) => {
  if (!Array.isArray(source)) return fallback;

  const cardAliasSet = new Set(cardAliases.map(normalizeKey));
  const fieldAliasSet = new Set(fieldAliases.map(normalizeKey));

  for (const item of source) {
    if (!item || typeof item !== 'object') continue;
    const title =
      item.title || item.label || item.name || item.key || item.metric || item.stat || item.type;

    if (!title || !cardAliasSet.has(normalizeKey(title))) continue;

    for (const [key, value] of Object.entries(item)) {
      if (fieldAliasSet.has(normalizeKey(key)) && value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
  }

  return fallback;
};

const pickMetric = (root, metricAliases, valueAliases, arraySources = []) => {
  for (const arraySource of arraySources) {
    const arrayValue = deepFindCardValue(arraySource, metricAliases, valueAliases);
    if (arrayValue !== null && arrayValue !== undefined && arrayValue !== '') {
      return arrayValue;
    }
  }

  return deepFindByAliases(root, [...metricAliases, ...valueAliases], null);
};

const toChangeText = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    return `${value > 0 ? '+' : ''}${value}% from last week`;
  }
  if (typeof value === 'object') {
    const amount =
      deepFindByAliases(value, ['value', 'change', 'percentage', 'percent', 'delta'], null) ?? null;
    const period = deepFindByAliases(value, ['period', 'duration', 'range'], 'last week');
    if (amount !== null && amount !== undefined && amount !== '') {
      if (typeof amount === 'number') {
        return `${amount > 0 ? '+' : ''}${amount}% from ${period}`;
      }
      return String(amount);
    }
  }
  return String(value);
};

const toNumberOrNull = (value) => {
  if (typeof value === 'string') {
    const cleaned = value.replace('%', '').trim();
    const parsedFromString = Number(cleaned);
    return Number.isFinite(parsedFromString) ? parsedFromString : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDayLabel = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized.startsWith('mon')) return 'Mon';
  if (normalized.startsWith('tue')) return 'Tue';
  if (normalized.startsWith('wed')) return 'Wed';
  if (normalized.startsWith('thu')) return 'Thu';
  if (normalized.startsWith('fri')) return 'Fri';
  if (normalized.startsWith('sat')) return 'Sat';
  if (normalized.startsWith('sun')) return 'Sun';
  return null;
};

const normalizeWeekSeries = (series, fallbackLength = WEEK_LABELS.length) => {
  if (!Array.isArray(series)) return Array.from({ length: fallbackLength }, () => null);
  return series.slice(0, fallbackLength).map(toNumberOrNull);
};

const extractWeeklyFromArray = (inputArray) => {
  const dayMap = Object.fromEntries(WEEK_LABELS.map((day, index) => [day, index]));
  const output = {
    labels: WEEK_LABELS,
    students: Array.from({ length: WEEK_LABELS.length }, () => null),
    teachers: Array.from({ length: WEEK_LABELS.length }, () => null),
    sessions: Array.from({ length: WEEK_LABELS.length }, () => null),
  };

  inputArray.forEach((entry, fallbackIndex) => {
    if (!entry || typeof entry !== 'object') return;
    const dayLabel = formatDayLabel(
      deepFindByAliases(entry, ['day', 'label', 'name', 'x', 'weekDay'], null)
    );
    const index = dayLabel ? dayMap[dayLabel] : fallbackIndex;
    if (index < 0 || index >= WEEK_LABELS.length) return;

    const studentsValue = deepFindByAliases(
      entry,
      ['students', 'student', 'studentCount', 'studentsCount'],
      null
    );
    const teachersValue = deepFindByAliases(
      entry,
      ['teachers', 'teacher', 'teacherCount', 'teachersCount'],
      null
    );
    const sessionsValue = deepFindByAliases(
      entry,
      ['sessions', 'session', 'liveSessions', 'sessionCount'],
      null
    );

    output.students[index] = toNumberOrNull(studentsValue);
    output.teachers[index] = toNumberOrNull(teachersValue);
    output.sessions[index] = toNumberOrNull(sessionsValue);
  });

  return output;
};

const extractWeekly = (root) => {
  const weeklySource =
    deepFindByAliases(
      root,
      ['weeklyActivity', 'weekly', 'activityByWeek', 'weeklyStats', 'weeklyOverview'],
      null
    ) || {};

  if (Array.isArray(weeklySource)) {
    return extractWeeklyFromArray(weeklySource);
  }

  const labels =
    deepFindByAliases(weeklySource, ['labels', 'days', 'xAxis', 'weekDays'], WEEK_LABELS) || WEEK_LABELS;
  const normalizedLabels =
    Array.isArray(labels) && labels.length > 0
      ? labels.map((label) => formatDayLabel(label) || String(label).slice(0, 3))
      : WEEK_LABELS;

  const studentsSeries =
    deepFindByAliases(weeklySource, ['students', 'studentSeries', 'studentsData'], null) || [];
  const teachersSeries =
    deepFindByAliases(weeklySource, ['teachers', 'teacherSeries', 'teachersData'], null) || [];
  const sessionsSeries =
    deepFindByAliases(weeklySource, ['sessions', 'sessionSeries', 'sessionsData'], null) || [];

  if (
    Array.isArray(studentsSeries) ||
    Array.isArray(teachersSeries) ||
    Array.isArray(sessionsSeries)
  ) {
    const length = normalizedLabels.length || WEEK_LABELS.length;
    return {
      labels: normalizedLabels,
      students: normalizeWeekSeries(studentsSeries, length),
      teachers: normalizeWeekSeries(teachersSeries, length),
      sessions: normalizeWeekSeries(sessionsSeries, length),
    };
  }

  return {
    labels: WEEK_LABELS,
    students: Array.from({ length: WEEK_LABELS.length }, () => null),
    teachers: Array.from({ length: WEEK_LABELS.length }, () => null),
    sessions: Array.from({ length: WEEK_LABELS.length }, () => null),
  };
};

const extractGradeDistribution = (root) => {
  const source =
    deepFindByAliases(
      root,
      ['gradeDistribution', 'studentDistributionByGrade', 'distributionByGrade', 'gradeStats'],
      null
    ) || [];

  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const name =
        deepFindByAliases(entry, ['grade', 'label', 'name', 'title', 'group'], null) || null;
      const value = toNumberOrNull(
        deepFindByAliases(entry, ['value', 'count', 'students', 'total', 'percentage', 'percent'], null)
      );

      if (!name || value === null) return null;
      return { name: String(name), value };
    })
    .filter(Boolean);
};

const extractSubjectPerformance = (root) => {
  const source = deepFindByAliases(
    root,
    [
      'subjectPerformance',
      'averageSubjectPerformance',
      'subjectStats',
      'subjectWisePerformance',
      'subjectChart',
      'performanceBySubject',
    ],
    null
  );

  if (Array.isArray(source)) {
    return source
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;

        const subject =
          deepFindByAliases(entry, ['subject', 'name', 'label', 'title', 'x'], null) || null;
        const score = toNumberOrNull(
          deepFindByAliases(
            entry,
            [
              'score',
              'value',
              'average',
              'averagePercentage',
              'average_percentage',
              'performance',
              'percent',
              'percentage',
              'y',
            ],
            null
          )
        );

        if (!subject || score === null) return null;
        return { subject: String(subject), score };
      })
      .filter(Boolean);
  }

  if (source && typeof source === 'object') {
    return Object.entries(source)
      .map(([key, value]) => {
        if (value && typeof value === 'object') {
          const nestedScore = toNumberOrNull(
            deepFindByAliases(
              value,
              [
                'score',
                'value',
                'average',
                'averagePercentage',
                'average_percentage',
                'performance',
                'percent',
                'percentage',
              ],
              null
            )
          );
          const nestedSubject =
            deepFindByAliases(value, ['subject', 'name', 'label', 'title'], key) || key;
          if (nestedScore === null) return null;
          return { subject: String(nestedSubject), score: nestedScore };
        }

        const score = toNumberOrNull(value);
        if (score === null) return null;
        return { subject: String(key), score };
      })
      .filter(Boolean);
  }

  const fallbackArray = deepFindByAliases(
    root,
    ['subjects', 'subjectData', 'subjectSeries', 'subjectPerformanceList'],
    null
  );

  if (!Array.isArray(fallbackArray)) return [];

  return fallbackArray
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;

      const subject =
        deepFindByAliases(entry, ['subject', 'name', 'label', 'title'], null) || null;
      const score = toNumberOrNull(
        deepFindByAliases(
          entry,
          [
            'score',
            'value',
            'average',
            'averagePercentage',
            'average_percentage',
            'performance',
            'percent',
            'percentage',
          ],
          null
        )
      );

      if (!subject || score === null) return null;
      return { subject: String(subject), score };
    })
    .filter(Boolean);
};

export const getDashboardOverview = async () => {
  const response = await http.get('/admin/dashboard/overview');
  const payload = response?.data || {};
  const root = payload?.data || payload;

  const candidateArrays = [root?.cards, root?.stats, root?.overview, root?.items, root].filter(
    (entry) => Array.isArray(entry)
  );

  const students = pickMetric(
    root,
    ['students', 'totalstudents', 'studentcount'],
    ['students', 'totalStudents', 'total_students'],
    candidateArrays
  );
  const teachers = pickMetric(
    root,
    ['teachers', 'totalteachers', 'teachercount'],
    ['teachers', 'totalTeachers', 'total_teachers'],
    candidateArrays
  );
  const classes = pickMetric(
    root,
    ['classes', 'activeclasses', 'classcount'],
    ['classes', 'activeClasses', 'active_classes'],
    candidateArrays
  );
  const sessions = pickMetric(
    root,
    ['sessions', 'livesessionstoday', 'liveSessions'],
    ['sessions', 'liveSessionsToday', 'live_sessions_today'],
    candidateArrays
  );
  const assignments = pickMetric(
    root,
    ['assignments', 'assignmentspending', 'pendingassignments'],
    ['assignments', 'assignmentsPending', 'assignments_pending'],
    candidateArrays
  );
  const engagement = pickMetric(
    root,
    ['engagement', 'engagementrate'],
    ['engagement', 'engagementRate', 'engagement_rate'],
    candidateArrays
  );

  const changesRoot = deepFindByAliases(root, ['changes', 'statsChanges', 'trend', 'trends'], {}) || {};

  return {
    stats: {
      students,
      teachers,
      classes,
      sessions,
      assignments,
      engagement,
    },
    changes: {
      students: toChangeText(
        deepFindByAliases(changesRoot, ['students', 'studentsChange', 'studentsTrend'], null)
      ),
      teachers: toChangeText(
        deepFindByAliases(changesRoot, ['teachers', 'teachersChange', 'teachersTrend'], null)
      ),
      classes: toChangeText(
        deepFindByAliases(changesRoot, ['classes', 'classesChange', 'classesTrend'], null)
      ),
      sessions: toChangeText(
        deepFindByAliases(changesRoot, ['sessions', 'sessionsChange', 'sessionsTrend'], null)
      ),
      assignments: toChangeText(
        deepFindByAliases(changesRoot, ['assignments', 'assignmentsChange', 'assignmentsTrend'], null)
      ),
      engagement: toChangeText(
        deepFindByAliases(changesRoot, ['engagement', 'engagementChange', 'engagementTrend'], null)
      ),
    },
    weekly: extractWeekly(root),
    gradeDistribution: extractGradeDistribution(root),
    subjectPerformance: extractSubjectPerformance(root),
  };
};
