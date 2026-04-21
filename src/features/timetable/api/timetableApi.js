import { http } from '../../../shared/services/http';

export const getTimetableEntries = async ({ gradeId, classId } = {}) => {
  const params = {};
  if (gradeId) params.gradeId = gradeId;
  if (classId) params.classId = classId;

  // Backend now exposes a single /admin/timetable endpoint that returns
  // both metadata (teachers/subjects/grades/classes) and timetable entries.
  const response = await http.get('/admin/timetable', { params });
  const payload = response?.data || {};
  const root = payload?.data ?? payload;

  const raw =
    root?.entries ||
    root?.timetable ||
    root?.items ||
    root?.rows ||
    root?.data ||
  [];
  const list = Array.isArray(raw) ? raw : [];

  // Normalize so override state persists after refresh. Backend should persist
  // isOverride, reason, and overriddenAt when PATCH /admin/timetable/entries/:id is called and
  // return them in GET /admin/timetable.
  return list.map((entry) => {
    const isOverride =
      entry?.isOverride === true ||
      entry?.overridden === true ||
      Boolean(entry?.is_override);
    const reason =
      String(
        entry?.reason ??
          entry?.overrideReason ??
          entry?.override_reason ??
          entry?.reason_text ??
          ''
      ).trim();
    // Prefer override-specific timestamp so "Changed on" shows when the slot was overridden.
    const overrideChangedAt =
      entry?.overriddenAt ??
      entry?.override_date ??
      entry?.overrideDate ??
      entry?.overridden_at ??
      (isOverride ? (entry?.updatedAt ?? entry?.updated_at) : null) ??
      entry?.changedAt ??
      entry?.changed_at;
    return {
      ...entry,
      isOverride,
      overridden: isOverride,
      reason,
      overrideReason: reason,
      overrideChangedAt: overrideChangedAt || null,
    };
  });
};

export const createTimetableEntry = async (payload) => {
  const response = await http.post('/admin/timetable/entries', payload);
  const data = response?.data;

  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Create timetable entry failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }

  return data;
};

export const updateTimetableEntry = async (id, payload) => {
  const entryId = String(id ?? '').trim();
  if (!entryId) {
    const err = new Error('Entry id is required to update.');
    err.response = { status: 400 };
    throw err;
  }
  const response = await http.patch(`/admin/timetable/entries/${encodeURIComponent(entryId)}`, payload);
  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Update timetable entry failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};

export const deleteTimetableEntry = async (id) => {
  const entryId = String(id ?? '').trim();
  if (!entryId) {
    const err = new Error('Entry id is required to delete.');
    err.response = { status: 400 };
    throw err;
  }
  const response = await http.delete(`/admin/timetable/entries/${encodeURIComponent(entryId)}`);
  const data = response?.data;
  if (data && typeof data === 'object') {
    const successFlag = data.success ?? data.ok;
    if (successFlag === false) {
      const err = new Error(data.message || 'Delete timetable entry failed');
      err.response = { data, status: response?.status };
      throw err;
    }
  }
  return data;
};

export const getTimetableMeta = async () => {
  // /admin/timetable returns the full meta object: teachers, subjects,
  // grades, classes, and possibly entries. For meta we just return root.
  const response = await http.get('/admin/timetable');
  const payload = response?.data || {};
  return payload?.data ?? payload;
};
