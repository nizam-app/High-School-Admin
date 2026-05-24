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

const normalizeId = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    const v = String(value).trim();
    return v || null;
  }
  if (typeof value === 'object') {
    if (value.$oid) return normalizeId(value.$oid);
    if (value._id) return normalizeId(value._id);
    if (value.id) return normalizeId(value.id);
  }
  return null;
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'yes', 'verified'].includes(normalized);
  }
  return false;
};

const hasBooleanValue = (value) => {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return value === 0 || value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', 'false', '1', '0', 'yes', 'no', 'verified', 'unverified'].includes(normalized);
  }
  return false;
};

const extractPreferredSubject = (user) => {
  const directSubject = pick(user, ['subject', 'teachingSubject', 'mainSubject'], null);
  if (directSubject) return directSubject;

  const assignedSubjects = extractStringArray(
    pick(user, ['assignedSubjects', 'subjects', 'teachingSubjects'], [])
  );
  if (assignedSubjects.length > 0) return assignedSubjects[0];

  return null;
};

const normalizeUsers = (list) => {
  if (!Array.isArray(list)) return [];

  const normalizeAssignedClasses = (user) => {
    const raw =
      pick(user, ['assignedClasses', 'classes', 'classList', 'assigned_classes'], null) ||
      pick(user, ['assignedClass', 'className', 'grade', 'class'], null);

    if (Array.isArray(raw)) {
      return raw
        .map((item) => {
          if (typeof item === 'string') return item;
          return pick(item, ['name', 'title', 'className', 'grade', 'label'], null);
        })
        .filter(Boolean);
    }

    if (raw && typeof raw === 'object') {
      const value = pick(raw, ['name', 'title', 'className', 'grade', 'label'], null);
      return value ? [value] : [];
    }

    if (typeof raw === 'string') return [raw];
    return [];
  };

  return list.map((user, index) => {
    const rawPhoneVerified = pick(
      user,
      ['phoneVerified', 'isPhoneVerified', 'verifiedPhone', 'phone_verified'],
      undefined
    );

    return {
      id: normalizeId(pick(user, ['_id', 'id'], null)) || `row-${index}`,
      name: pick(user, ['name', 'fullName', 'username'], 'N/A'),
      email: pick(user, ['email', 'mail'], 'N/A'),
      phone: pick(user, ['phone', 'mobile', 'phoneNumber'], 'N/A'),
      role: pick(user, ['role', 'userRole'], 'N/A'),
      gradeId: normalizeId(pick(user, ['gradeId', 'grade_id'], null)),
      gradeLevel: pick(user, ['gradeLevel', 'grade_level'], null),
      grade: pick(user, ['grade', 'classGrade', 'studentGrade'], null),
      subjectId: normalizeId(pick(user, ['subjectId', 'subject_id'], null)),
      subject: extractPreferredSubject(user),
      assignedGradeIds: Array.isArray(user?.assignedGradeIds)
        ? user.assignedGradeIds.map(normalizeId).filter(Boolean)
        : [],
      assignedGrades: Array.isArray(user?.assignedGrades) ? user.assignedGrades : [],
      assignedSubjectIds: Array.isArray(user?.assignedSubjectIds)
        ? user.assignedSubjectIds.map(normalizeId).filter(Boolean)
        : [],
      assignedSubjects: extractStringArray(
        pick(user, ['assignedSubjects', 'subjects', 'teachingSubjects'], [])
      ),
      phoneVerified: hasBooleanValue(rawPhoneVerified) ? normalizeBoolean(rawPhoneVerified) : null,
      assignedClasses: normalizeAssignedClasses(user),
      status: pick(user, ['status', 'userStatus'], 'N/A'),
      joinDate: pick(user, ['createdAt', 'joinDate', 'joinedAt'], null),
    };
  });
};

const extractStringArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          return pick(item, ['name', 'subject', 'subjectName', 'title', 'label', 'value'], null);
        }
        return null;
      })
      .filter(Boolean);
  }
  return [];
};

const normalizeIsActive = (item) => {
  const raw = pick(item, ['isActive', 'active'], null);
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw === 1;

  const status = String(pick(item, ['status'], '')).trim().toLowerCase();
  if (['inactive', 'blocked', 'disabled'].includes(status)) return false;
  if (status === 'active') return true;

  if (raw === null || raw === undefined) return true;
  const normalized = String(raw).trim().toLowerCase();
  if (['false', '0', 'no', 'inactive'].includes(normalized)) return false;
  return true;
};

const extractOptionArray = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const id = pick(item, ['_id', 'id', 'value'], null);
      const name = pick(item, ['name', 'gradeName', 'title', 'label'], null);
      const level = pick(item, ['gradeLevel', 'level', 'code'], null);
      if (!id || !name) return null;
      return {
        id: String(id),
        name: String(name),
        level: level !== null && level !== undefined ? String(level) : null,
        isActive: normalizeIsActive(item),
      };
    })
    .filter(Boolean);
};

/** Grades created by admin (Classes → Grades), used for user assignment dropdowns */
export const getAdminGradeOptions = async () => {
  const response = await http.get('/admin/grades/sections');
  const payload = response?.data || {};
  const root = payload?.data ?? payload;
  if (!Array.isArray(root)) return [];

  return root
    .map((item) => {
      const id = normalizeId(pick(item, ['id', '_id'], null));
      const name = String(pick(item, ['label', 'gradeLevel', 'name'], '')).trim();
      if (!id || !name) return null;
      return { id, name };
    })
    .filter(Boolean);
};

const extractUsersList = (root) => {
  if (Array.isArray(root)) return root;

  const direct = pick(root, ['users', 'items', 'results', 'data', 'rows'], null);
  if (Array.isArray(direct)) return direct;

  if (direct && typeof direct === 'object') {
    const nested = pick(direct, ['docs', 'items', 'results', 'rows', 'data'], null);
    if (Array.isArray(nested)) return nested;
  }

  const nestedRoot = pick(root, ['payload', 'list'], null);
  if (Array.isArray(nestedRoot)) return nestedRoot;
  if (nestedRoot && typeof nestedRoot === 'object') {
    const nested = pick(nestedRoot, ['users', 'docs', 'items', 'results', 'rows', 'data'], null);
    if (Array.isArray(nested)) return nested;
  }

  return [];
};

const extractPagination = (payload, root, page, limit, usersLength) => {
  const topLevelPagination = pick(payload, ['pagination', 'meta'], {});
  const rootPagination = pick(root, ['pagination', 'meta'], {});
  const nestedUsersFromPayload = pick(payload, ['users'], {});
  const nestedUsersFromRoot = pick(root, ['users'], {});
  const nestedPaginationFromPayload = pick(nestedUsersFromPayload, ['pagination', 'meta'], {});
  const nestedPaginationFromRoot = pick(nestedUsersFromRoot, ['pagination', 'meta'], {});

  const source =
    (topLevelPagination && Object.keys(topLevelPagination).length && topLevelPagination) ||
    (rootPagination && Object.keys(rootPagination).length && rootPagination) ||
    (nestedPaginationFromPayload &&
      Object.keys(nestedPaginationFromPayload).length &&
      nestedPaginationFromPayload) ||
    nestedPaginationFromRoot ||
    {};

  const total =
    Number(
      pick(source, ['total', 'totalItems', 'count'], null) ??
        pick(payload, ['total', 'count'], null) ??
        pick(root, ['total', 'count'], null)
    ) || usersLength;

  const currentPage =
    Number(
      pick(source, ['page', 'currentPage'], null) ??
        pick(payload, ['page', 'currentPage'], null) ??
        pick(root, ['page', 'currentPage'], null)
    ) || page;

  const perPage =
    Number(
      pick(source, ['limit', 'perPage'], null) ??
        pick(payload, ['limit', 'perPage'], null) ??
        pick(root, ['limit', 'perPage'], null)
    ) || limit;

  const totalPages =
    Number(
      pick(source, ['totalPages', 'pages'], null) ??
        pick(payload, ['totalPages', 'pages'], null) ??
        pick(root, ['totalPages', 'pages'], null)
    ) || Math.max(1, Math.ceil((Number(total) || usersLength || 0) / (Number(perPage) || limit || 1)));

  return {
    total,
    page: currentPage,
    limit: perPage,
    totalPages,
  };
};

export const getUsers = async ({
  role = '',
  status = '',
  search = '',
  page = 1,
  limit = 10,
}) => {
  const response = await http.get('/admin/users', {
    params: { role, status, search, page, limit },
  });

  const payload = response?.data || {};
  const root = payload?.data ?? payload;

  const users = normalizeUsers(extractUsersList(root));
  const pagination = extractPagination(payload, root, page, limit, users.length);
  const gradesRaw = pick(root, ['grades', 'availableGrades', 'gradeOptions'], []);
  const subjectsRaw = pick(root, ['subjects', 'availableSubjects', 'subjectOptions'], []);

  const gradeOptions = extractOptionArray(gradesRaw);
  const subjectOptions = extractStringArray(subjectsRaw);
  const grades = gradeOptions.map((item) => item.name);
  const subjects = subjectOptions;

  return {
    users,
    total: pagination.total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: pagination.totalPages,
    gradeOptions,
    subjectOptions,
    grades,
    subjects,
  };
};

/**
 * Build POST /users body matching the API contract (same shape as Postman).
 * Extra fields like `grade`, `classGrade`, or `assignedClass` can trigger
 * legacy grade validation on the server.
 */
export const buildCreateUserPayload = ({
  role,
  name,
  phone,
  pin,
  confirmPin,
  gradeLevel,
  gradeId,
  subject,
  subjectId,
  assignedSubjects,
}) => {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const payload = {
    role: normalizedRole,
    name: String(name || '').trim(),
    phone: String(phone || '').trim(),
    pin: String(pin || ''),
    confirmPin: String(confirmPin || ''),
  };

  if (normalizedRole === 'student') {
    const level = String(gradeLevel || '').trim();
    if (level) payload.gradeLevel = level;
    const id = normalizeId(gradeId);
    if (id) payload.gradeId = id;
    const subjects = extractStringArray(assignedSubjects);
    if (subjects.length > 0) payload.assignedSubjects = subjects;
  }

  if (normalizedRole === 'teacher') {
    const subjectName = String(subject || '').trim();
    if (subjectName) payload.subject = subjectName;
    const id = normalizeId(subjectId);
    if (id) payload.subjectId = id;
  }

  return payload;
};

export const buildStudentGradePayload = ({ gradeLevel, gradeId, assignedSubjects } = {}) => {
  const payload = {};
  const level = String(gradeLevel || '').trim();
  if (level) payload.gradeLevel = level;
  const id = normalizeId(gradeId);
  if (id) payload.gradeId = id;
  const subjects = extractStringArray(assignedSubjects);
  if (subjects.length > 0) payload.assignedSubjects = subjects;
  return payload;
};

export const createUser = async (payload) => {
  const response = await http.post('/users', payload);
  return response.data;
};

export const updateAdminUser = async (userId, payload) => {
  try {
    const response = await http.patch(`/admin/users/${userId}`, payload);
    return response.data;
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 405) {
      const fallback = await http.put(`/admin/users/${userId}`, payload);
      return fallback.data;
    }
    throw error;
  }
};

export const updateAdminUserStatus = async (userId, status) => {
  const response = await http.patch(`/admin/users/${userId}/status`, { status });
  return response.data;
};

export const resetAdminUserPin = async (userId, { pin, confirmPin } = {}) => {
  const id = String(userId || '').trim();
  const response = await http.patch(`/admin/users/${encodeURIComponent(id)}/pin`, {
    pin: String(pin || ''),
    confirmPin: String(confirmPin ?? pin ?? ''),
  });
  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Failed to reset PIN');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};

export const deleteAdminUser = async (userId) => {
  const response = await http.delete(`/admin/users/${userId}`);
  return response.data;
};

export const getGrades = async () => {
  const response = await http.get('/grades');
  const payload = response?.data || {};
  const root = payload?.data || payload;
  const rawList = pick(root, ['grades', 'items', 'results', 'data'], root);

  const options = extractOptionArray(Array.isArray(rawList) ? rawList : []);
  return options;
};

export const getSubjects = async () => {
  const response = await http.get('/subjects');
  const payload = response?.data || {};
  const root = payload?.data || payload;
  const rawList = pick(root, ['subjects', 'items', 'results', 'data'], root);

  return extractStringArray(Array.isArray(rawList) ? rawList : []);
};
