import { http } from '../../../shared/services/http';

const pick = (source, keys, fallback = null) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return fallback;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toObjectId = (value) => {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (typeof value === 'object') {
    if (value.$oid) return String(value.$oid).trim();
    if (value._id) return toObjectId(value._id);
    if (value.id) return toObjectId(value.id);
  }
  return '';
};

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const getApiOrigin = () => {
  const base = String(http?.defaults?.baseURL || '').trim();
  if (!base) return window.location.origin;
  try {
    return new URL(base).origin;
  } catch {
    return window.location.origin;
  }
};

export const resolveLessonDownloadUrl = (input) => {
  const rawUrl =
    typeof input === 'string'
      ? input
      : pick(input, ['fileUrl', 'url', 'assetUrl'], null) ||
        pick(input?.files?.[0] || {}, ['url', 'fileUrl'], null);

  const fileUrl = String(rawUrl || '').trim();
  if (!fileUrl) return '';
  if (isAbsoluteUrl(fileUrl)) return fileUrl;

  const origin = getApiOrigin().replace(/\/+$/, '');
  const normalizedPath = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
  return `${origin}${normalizedPath}`;
};

const normalizeClassItem = (item, index) => {
  const rawId = pick(item, ['_id', 'id', 'classId', 'class_id'], null);
  const normalizedId = toObjectId(rawId) || null;
  const gradeId = toObjectId(pick(item, ['gradeId', 'grade_id'], null));
  const subjectId = toObjectId(pick(item, ['subjectId', 'subject_id'], null));

  const studentsRaw = pick(item, ['students', 'studentIds'], null);
  const teacherRaw = pick(item, ['teacher', 'assignedTeacher'], null);

  const teacherName =
    (typeof teacherRaw === 'object' && pick(teacherRaw, ['name', 'fullName'], null)) ||
    (typeof teacherRaw === 'string' ? teacherRaw : null) ||
    pick(item, ['teacherName'], null) ||
    null;

  const studentsCount = Array.isArray(studentsRaw)
    ? studentsRaw.length
    : toNumber(pick(item, ['studentsCount', 'studentCount', 'totalStudents'], null), 0);
  const className = String(
    pick(item, ['className', 'name'], '') ||
      `${String(pick(item, ['subject', 'subjectName', 'title'], 'N/A'))} ${String(
        pick(item, ['gradeLevel', 'grade', 'classGrade'], 'N/A')
      )}`
  ).trim();
  const scheduleRaw = Array.isArray(pick(item, ['schedule'], [])) ? pick(item, ['schedule'], []) : [];
  const isOverriddenSlot = (slot) =>
    slot?.isOverride === true || slot?.overridden === true || Boolean(slot?.is_override);
  const schedule = scheduleRaw
    .filter((slot) => !isOverriddenSlot(slot))
    .map((slot, slotIndex) => ({
      id: toObjectId(slot?._id || slot?.id) || `slot-${index}-${slotIndex}`,
      day: String(pick(slot, ['day'], '')).trim().toLowerCase(),
      startMin: toNumber(pick(slot, ['startMin'], null), null),
      endMin: toNumber(pick(slot, ['endMin'], null), null),
      room: String(pick(slot, ['room'], '')).trim(),
      source: String(pick(slot, ['source'], 'class')).trim().toLowerCase(),
    }))
    .filter((slot) => slot.day);

  return {
    id: normalizedId || `class-${index}`,
    deleteId: normalizedId,
    className,
    gradeId,
    subjectId,
    subject: String(pick(item, ['subject', 'subjectName', 'title'], 'N/A')),
    grade: String(pick(item, ['gradeLevel', 'grade', 'classGrade'], 'N/A')),
    students: studentsCount,
    lessons: toNumber(pick(item, ['lessonsCount', 'lessonCount', 'totalLessons'], 0), 0),
    assignments: toNumber(
      pick(item, ['assignmentsCount', 'assignmentCount', 'totalAssignments'], 0),
      0
    ),
    schedule,
    status: String(pick(item, ['status'], 'active')).toLowerCase(),
    teacher: teacherName || 'Not assigned',
    teacherName: teacherName || 'Not assigned',
    teacherAssigned: Boolean(teacherName),
  };
};

const extractClassList = (root) => {
  if (Array.isArray(root)) return root;

  const direct = pick(root, ['classes', 'items', 'results', 'data', 'rows'], null);
  if (Array.isArray(direct)) return direct;

  if (direct && typeof direct === 'object') {
    const nested = pick(direct, ['docs', 'items', 'results', 'rows', 'data'], null);
    if (Array.isArray(nested)) return nested;
  }

  return [];
};

export const getClasses = async ({ page = 1, limit = 20, status = 'active' } = {}) => {
  const response = await http.get('/admin/classes', {
    params: { page, limit, status },
  });
  const payload = response?.data || {};
  const root = payload?.data ?? payload;
  const list = extractClassList(root);
  return {
    items: list.map(normalizeClassItem),
    meta: payload?.meta || root?.meta || null,
  };
};

export const createClass = async (payload) => {
  const response = await http.post('/admin/classes', payload);
  const data = response?.data;

  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Create class failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }

  return data;
};

export const updateClass = async (classId, payload) => {
  const id = String(classId || '').trim();
  const response = await http.patch(`/admin/classes/${encodeURIComponent(id)}`, payload);
  const data = response?.data;

  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Update class failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }

  return data;
};

export const deleteClass = async (classId, { hardDelete = true } = {}) => {
  const id = String(classId || '').trim();
  const encodedId = encodeURIComponent(id);

  const ensureSuccess = (response) => {
    const data = response?.data;
    if (data && typeof data === 'object') {
      const successFlag = data.success ?? data.ok;
      if (successFlag === false) {
        const err = new Error(data.message || 'Delete failed');
        err.response = { data, status: response?.status };
        throw err;
      }
    }
    return data;
  };

  const url = hardDelete
    ? `/admin/classes/${encodedId}?hardDelete=true`
    : `/admin/classes/${encodedId}`;
  const response = await http.delete(url, { data: {} });
  return ensureSuccess(response);
};

export const createSubject = async (payload) => {
  const response = await http.post('/subjects', payload);
  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Create subject failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};

export const createGrade = async (payload) => {
  const response = await http.post('/grades', payload);
  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Create grade failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};

const normalizeSubjectItem = (item, index) => {
  const rawId = pick(item, ['_id', 'id', 'subjectId', 'subject_id'], null);
  const id =
    typeof rawId === 'string'
      ? rawId
      : rawId && typeof rawId === 'object' && rawId.$oid
        ? String(rawId.$oid)
        : null;

  const name = String(
    pick(item, ['name', 'subject', 'subjectName', 'title', 'label'], '')
  ).trim();

  if (!name) return null;
  return { id: id || `subject-${index}`, name, deletable: Boolean(id) };
};

const extractSubjectList = (root) => {
  if (Array.isArray(root)) return root;
  const direct = pick(root, ['subjects', 'items', 'results', 'data', 'rows'], null);
  if (Array.isArray(direct)) return direct;
  if (direct && typeof direct === 'object') {
    const nested = pick(direct, ['docs', 'items', 'results', 'rows', 'data'], null);
    if (Array.isArray(nested)) return nested;
  }
  return [];
};

export const getSubjectsList = async () => {
  const response = await http.get('/admin/subjects/summary');
  const payload = response?.data || {};
  const root = payload?.data ?? payload;
  const rows = extractSubjectList(root);
  return rows
    .map((row, index) => {
      const normalized = normalizeSubjectItem(row, index);
      if (!normalized) return null;
      return {
        ...normalized,
        classCount: toNumber(pick(row, ['classCount'], 0), 0),
      };
    })
    .filter(Boolean);
};

export const getGradesSections = async () => {
  const response = await http.get('/admin/grades/sections');
  const payload = response?.data || {};
  const root = payload?.data ?? payload;
  if (!Array.isArray(root)) return [];
  return root
    .map((item) => ({
      id: toObjectId(pick(item, ['id', '_id'], null)),
      label: String(pick(item, ['label', 'gradeLevel', 'name'], '')).trim(),
      sections: Array.isArray(item?.sections) ? item.sections : [],
      classCount: toNumber(pick(item, ['classCount'], 0), 0),
    }))
    .filter((item) => item.id && item.label);
};

export const getContentStats = async () => {
  const response = await http.get('/admin/content/stats');
  const payload = response?.data || {};
  const data = payload?.data ?? payload;
  return {
    lessons: toNumber(pick(data, ['lessons'], 0), 0),
    videos: toNumber(pick(data, ['videos'], 0), 0),
    documents: toNumber(pick(data, ['documents'], 0), 0),
    assignments: toNumber(pick(data, ['assignments'], 0), 0),
  };
};

export const deleteSubject = async (subjectId) => {
  const id = String(subjectId || '').trim();
  const response = await http.delete(`/subjects/${encodeURIComponent(id)}`);
  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Delete subject failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};

export const deleteGrade = async (gradeId) => {
  const id = String(gradeId || '').trim();
  const response = await http.delete(`/grades/${encodeURIComponent(id)}`);
  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Delete grade failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};

const normalizeLessonItem = (item, index) => {
  const toObjectId = (value) => {
    if (!value) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      if (value.$oid) return String(value.$oid);
      if (value._id) return toObjectId(value._id);
      if (value.id) return toObjectId(value.id);
    }
    return '';
  };

  const toDateValue = (value) => {
    if (value && typeof value === 'object' && value.$date) return value.$date;
    return value;
  };

  const rawId = pick(item, ['_id', 'id', 'lessonId'], null);
  const id = toObjectId(rawId) || `lesson-${index}`;

  const uploadedByRaw = pick(item, ['uploadedBy', 'author', 'createdBy', 'teacher'], null);
  const uploadedBy =
    (typeof uploadedByRaw === 'object' &&
      String(pick(uploadedByRaw, ['name', 'fullName', 'username', 'email'], '')).trim()) ||
    (typeof uploadedByRaw === 'string' ? uploadedByRaw.trim() : '') ||
    String(pick(item, ['uploadedByName', 'authorName', 'createdByName', 'teacherName'], '')).trim();

  const gradeRaw = item?.grade;
  const subjectRaw = item?.subject;
  const gradeRefRaw = pick(item, ['gradeId', 'grade_id', 'grade'], null);
  const subjectRefRaw = pick(item, ['subjectId', 'subject_id', 'subject'], null);
  const gradeIdRaw = toObjectId(gradeRefRaw) || toObjectId(gradeRaw);
  const subjectIdRaw = toObjectId(subjectRefRaw) || toObjectId(subjectRaw);
  const gradeNameRaw =
    pick(item, ['gradeLevel', 'gradeName', 'gradeLabel'], null) ||
    (gradeRefRaw && typeof gradeRefRaw === 'object'
      ? pick(gradeRefRaw, ['label', 'name', 'level', 'gradeLevel'], '')
      : '') ||
    (typeof gradeRaw === 'string'
      ? gradeRaw
      : gradeRaw && typeof gradeRaw === 'object'
        ? pick(gradeRaw, ['level', 'name', 'label', 'gradeLevel'], '')
        : '');
  const subjectNameRaw =
    pick(item, ['subjectName', 'subjectTitle'], null) ||
    (subjectRefRaw && typeof subjectRefRaw === 'object'
      ? pick(subjectRefRaw, ['name', 'label', 'title', 'subjectName'], '')
      : '') ||
    (typeof subjectRaw === 'string'
      ? subjectRaw
      : subjectRaw && typeof subjectRaw === 'object'
        ? pick(subjectRaw, ['name', 'title', 'subjectName'], '')
        : '');

  return {
    id,
    title: String(pick(item, ['title', 'name'], 'Untitled')),
    chapter: String(pick(item, ['chapter', 'chapterName'], '')).trim(),
    description: String(pick(item, ['description', 'details'], '')),
    contentType: String(pick(item, ['contentType', 'type'], 'text')).toLowerCase(),
    gradeLevel: String(gradeNameRaw || '').trim(),
    gradeId: String(gradeIdRaw || '').trim(),
    subject: String(subjectNameRaw || '').trim(),
    subjectId: String(subjectIdRaw || '').trim(),
    uploadedBy,
    classId: toObjectId(pick(item, ['classId', 'class', 'class_id'], null)) || null,
    fileUrl:
      pick(item, ['fileUrl', 'url', 'assetUrl'], null) ||
      pick(item?.files?.[0] || {}, ['url', 'fileUrl'], null),
    createdAt: toDateValue(pick(item, ['createdAt', 'created_at', 'updatedAt', 'updated_at'], null)),
  };
};

const extractLessonList = (root) => {
  if (Array.isArray(root)) return root;
  const direct = pick(root, ['lessons', 'items', 'results', 'data', 'rows'], null);
  if (Array.isArray(direct)) return direct;
  if (direct && typeof direct === 'object') {
    const nested = pick(direct, ['docs', 'items', 'results', 'rows', 'data'], null);
    if (Array.isArray(nested)) return nested;
  }
  return [];
};

const extractLessonPagination = (payload, root, listLength, requestParams = {}) => {
  const objectOrNull = (value) =>
    value && typeof value === 'object' && !Array.isArray(value) ? value : null;

  const pagingRoot =
    objectOrNull(payload?.meta) ||
    objectOrNull(root?.meta) ||
    objectOrNull(payload?.pagination) ||
    objectOrNull(root?.pagination) ||
    objectOrNull(root) ||
    objectOrNull(payload) ||
    {};

  const page = toNumber(
    pick(pagingRoot, ['page', 'currentPage', 'pageNumber'], requestParams.page || 1),
    1
  );
  const limit = toNumber(
    pick(pagingRoot, ['limit', 'perPage', 'pageSize'], requestParams.limit || listLength || 5),
    requestParams.limit || listLength || 5
  );
  const total = toNumber(
    pick(pagingRoot, ['total', 'totalItems', 'count', 'totalCount'], listLength),
    listLength
  );
  const totalPages = toNumber(
    pick(
      pagingRoot,
      ['totalPages', 'pages', 'lastPage'],
      limit > 0 ? Math.ceil(total / limit) : 1
    ),
    limit > 0 ? Math.ceil(total / limit) : 1
  );

  return {
    page: page > 0 ? page : 1,
    limit: limit > 0 ? limit : 5,
    total: total >= 0 ? total : listLength,
    totalPages: totalPages > 0 ? totalPages : 1,
  };
};

export const getLessons = async (params = {}) => {
  let response;
  try {
    response = await http.get('/admin/lessons', { params });
  } catch (error) {
    if (error?.response?.status === 404) {
      try {
        response = await http.get('/lesson', { params });
      } catch (fallbackError) {
        if (fallbackError?.response?.status === 404) {
          response = await http.get('/lessons', { params });
        } else {
          throw fallbackError;
        }
      }
    } else {
      throw error;
    }
  }
  const payload = response?.data || {};
  const root = payload?.data ?? payload;
  const list = extractLessonList(root);
  return {
    items: list.map(normalizeLessonItem),
    pagination: extractLessonPagination(payload, root, list.length, params),
  };
};

const normalizeAssignmentItem = (item, index) => {
  const toObjectId = (value) => {
    if (!value) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      if (value.$oid) return String(value.$oid);
      if (value._id) return toObjectId(value._id);
      if (value.id) return toObjectId(value.id);
    }
    return '';
  };

  const toNumberSafe = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const id = toObjectId(pick(item, ['id', '_id', 'assignmentId'], null)) || `assignment-${index}`;
  const classInfo = pick(item, ['classInfo'], {}) || {};
  const submission = pick(item, ['submission'], {}) || {};

  const gradeId = toObjectId(
    pick(classInfo, ['gradeId'], null) || pick(item, ['gradeId', 'grade_id'], null)
  );
  const subjectId = toObjectId(
    pick(classInfo, ['subjectId'], null) || pick(item, ['subjectId', 'subject_id'], null)
  );

  return {
    id,
    classId: toObjectId(pick(item, ['classId', 'class_id'], null)),
    title: String(pick(item, ['title', 'name', 'assignmentTitle'], 'Untitled')).trim(),
    description: String(pick(item, ['description', 'details'], '')).trim(),
    dueAt: pick(item, ['dueAt', 'due_date', 'deadline'], null),
    points: toNumberSafe(pick(item, ['points', 'score'], 0), 0),
    status: String(pick(item, ['status'], 'active')).trim().toLowerCase(),
    derivedStatus: String(pick(item, ['derivedStatus'], 'active')).trim().toLowerCase(),
    lateAllowed: Boolean(pick(item, ['lateAllowed'], false)),
    attachments: Array.isArray(item?.attachments) ? item.attachments : [],
    gradeId: String(gradeId || '').trim(),
    gradeLevel: String(
      pick(classInfo, ['gradeLevel'], null) || pick(item, ['gradeLevel', 'gradeName'], '')
    ).trim(),
    subjectId: String(subjectId || '').trim(),
    subject: String(
      pick(classInfo, ['subject'], null) || pick(item, ['subject', 'subjectName'], '')
    ).trim(),
    submittedCount: toNumberSafe(pick(submission, ['submittedCount'], 0), 0),
    totalStudents: toNumberSafe(pick(submission, ['totalStudents'], 0), 0),
    progress: toNumberSafe(pick(submission, ['progress'], 0), 0),
    createdAt: pick(item, ['createdAt', 'created_at'], null),
  };
};

const extractAssignmentList = (root) => {
  if (Array.isArray(root)) return root;
  const direct = pick(root, ['assignments', 'items', 'results', 'data', 'rows'], null);
  if (Array.isArray(direct)) return direct;
  if (direct && typeof direct === 'object') {
    const nested = pick(direct, ['docs', 'items', 'results', 'rows', 'data'], null);
    if (Array.isArray(nested)) return nested;
  }
  return [];
};

const extractMetaPagination = (payload, root, listLength, requestParams = {}) => {
  const objectOrNull = (value) =>
    value && typeof value === 'object' && !Array.isArray(value) ? value : null;

  const pagingRoot =
    objectOrNull(payload?.meta) ||
    objectOrNull(root?.meta) ||
    objectOrNull(payload?.pagination) ||
    objectOrNull(root?.pagination) ||
    objectOrNull(root) ||
    objectOrNull(payload) ||
    {};

  const page = toNumber(pick(pagingRoot, ['page', 'currentPage', 'pageNumber'], requestParams.page || 1), 1);
  const limit = toNumber(
    pick(pagingRoot, ['limit', 'perPage', 'pageSize'], requestParams.limit || listLength || 10),
    requestParams.limit || listLength || 10
  );
  const total = toNumber(pick(pagingRoot, ['total', 'totalItems', 'count', 'totalCount'], listLength), listLength);
  const totalPages = toNumber(
    pick(pagingRoot, ['totalPages', 'pages', 'lastPage'], limit > 0 ? Math.ceil(total / limit) : 1),
    limit > 0 ? Math.ceil(total / limit) : 1
  );

  return {
    page: page > 0 ? page : 1,
    limit: limit > 0 ? limit : 10,
    total: total >= 0 ? total : listLength,
    totalPages: totalPages > 0 ? totalPages : 1,
  };
};

export const getAssignments = async (params = {}) => {
  const response = await http.get('/admin/assignments', { params });
  const payload = response?.data || {};
  const root = payload?.data ?? payload;
  const list = extractAssignmentList(root);
  return {
    items: list.map(normalizeAssignmentItem),
    pagination: extractMetaPagination(payload, root, list.length, params),
  };
};

export const getAssignmentsStats = async () => {
  const response = await http.get('/admin/assignments/stats');
  const payload = response?.data || {};
  const data = payload?.data ?? payload;
  return {
    active: toNumber(pick(data, ['active'], 0), 0),
    upcoming: toNumber(pick(data, ['upcoming'], 0), 0),
    closed: toNumber(pick(data, ['closed'], 0), 0),
    draft: toNumber(pick(data, ['draft'], 0), 0),
    total: toNumber(pick(data, ['total'], 0), 0),
  };
};

export const getAssignmentSubmissions = async (assignmentId) => {
  const id = String(assignmentId || '').trim();
  const response = await http.get(`/admin/assignments/${encodeURIComponent(id)}/submissions`);
  return response?.data?.data ?? response?.data;
};

export const createAssignment = async (payload = {}) => {
  const formData = new FormData();

  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'files') return;
    formData.append(key, String(value));
  });

  const files = Array.isArray(payload?.files) ? payload.files : [];
  files.forEach((file) => {
    if (file instanceof File) formData.append('files', file);
  });

  const response = await http.post('/admin/assignments', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Create assignment failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};

export const updateAssignment = async (assignmentId, payload) => {
  const id = String(assignmentId || '').trim();
  const formData = new FormData();

  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'files') return;
    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value));
      return;
    }
    formData.append(key, String(value));
  });

  const files = Array.isArray(payload?.files) ? payload.files : [];
  files.forEach((file) => {
    if (file instanceof File) formData.append('files', file);
  });

  const response = await http.patch(`/admin/assignments/${encodeURIComponent(id)}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Update assignment failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};

export const deleteAssignment = async (assignmentId) => {
  const id = String(assignmentId || '').trim();
  const encodedId = encodeURIComponent(id);
  try {
    const response = await http.delete(`/assignments/${encodedId}`, { data: {} });
    return response?.data;
  } catch (error) {
    if (error?.response?.status !== 404) throw error;
    const fallback = await http.delete(`/admin/assignments/${encodedId}`, { data: {} });
    return fallback?.data;
  }
};

export const updateLesson = async (lessonId, payload) => {
  const id = String(lessonId || '').trim();
  const response = await http.patch(`/admin/lessons/${encodeURIComponent(id)}`, payload);
  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Update lesson failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};

export const deleteLesson = async (lessonId) => {
  const id = String(lessonId || '').trim();
  const encodedId = encodeURIComponent(id);

  const ensureSuccess = (response) => {
    const data = response?.data;
    if (data && typeof data === 'object') {
      const successFlag = data.success ?? data.ok;
      if (successFlag === false) {
        const err = new Error(data.message || 'Delete lesson failed');
        err.response = { data, status: response?.status };
        throw err;
      }
    }
    return data;
  };

  try {
    const response = await http.delete(`/lessons/${encodedId}`, { data: {} });
    return ensureSuccess(response);
  } catch (error) {
    if (error?.response?.status !== 404) throw error;
    const fallbackResponse = await http.delete(`/admin/lessons/${encodedId}`, { data: {} });
    return ensureSuccess(fallbackResponse);
  }
};

export const uploadLesson = async (payload) => {
  const endpoints = ['/lesson', '/lessons'];
  const makeFormData = () => {
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (key === 'file' || key === 'files') return;
      if (value instanceof File) return;
      if (Array.isArray(value)) return;
      if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
        return;
      }
      formData.append(key, String(value));
    });

    const files = Array.isArray(payload?.files)
      ? payload.files.filter((f) => f instanceof File)
      : payload?.file instanceof File
        ? [payload.file]
        : [];
    for (const file of files) {
      formData.append('files', file);
    }
    return formData;
  };

  let response;
  let lastError;

  for (const endpoint of endpoints) {
    try {
      response = await http.post(endpoint, makeFormData(), {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      if (status === 404) continue;
      throw error;
    }
  }

  if (!response && lastError) {
    throw lastError;
  }

  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Upload lesson failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};
