import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Pencil, Plus, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/context/AuthContext';
import { getGradesSections, getSubjectsList, getClasses } from '../../classes/api/classesApi';
import { getUsers } from '../../users/api/usersApi';
import {
  createTimetableEntry,
  deleteTimetableEntry,
  getTimetableEntries,
  getTimetableMeta,
  updateTimetableEntry,
} from '../api/timetableApi';
import Swal from 'sweetalert2';

const DAY_OPTIONS = [
  { label: 'Monday', value: 'mon' },
  { label: 'Tuesday', value: 'tue' },
  { label: 'Wednesday', value: 'wed' },
  { label: 'Thursday', value: 'thu' },
  { label: 'Friday', value: 'fri' },
  { label: 'Saturday', value: 'sat' },
  { label: 'Sunday', value: 'sun' },
];

const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00'];

const formatOverrideDateTime = (dayValue, startTime) => {
  const timeStr = normalizeTime(startTime) || startTime || '08:00';
  const dayLabel = DAY_OPTIONS.find((d) => d.value === normalizeDayValue(dayValue))?.label || dayValue;
  const d = new Date();
  const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const targetDay = dayMap[normalizeDayValue(dayValue)] ?? 1;
  let diff = targetDay - d.getDay();
  if (diff <= 0) diff += 7;
  const slotDate = new Date(d);
  slotDate.setDate(d.getDate() + diff);
  const dateStr = slotDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${timeStr} ${dayLabel}, ${dateStr}`;
};

const formatOverrideChangedOn = (entry, fallbackIsoString) => {
  const raw =
    entry?.overrideChangedAt ??
    entry?.overriddenAt ??
    entry?.override_date ??
    entry?.overrideDate ??
    entry?.overridden_at ??
    entry?.updatedAt ??
    entry?.updated_at ??
    entry?.changedAt ??
    entry?.changed_at ??
    fallbackIsoString;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const normalizeTime = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  const hour = match[1].padStart(2, '0');
  const minute = match[2];
  return `${hour}:${minute}`;
};

const normalizeDayValue = (value) => {
  if (!value) return '';
  const raw = String(value).trim().toLowerCase();
  const map = {
    mon: 'mon',
    monday: 'mon',
    tue: 'tue',
    tues: 'tue',
    tuesday: 'tue',
    wed: 'wed',
    weds: 'wed',
    wednesday: 'wed',
    thu: 'thu',
    thur: 'thu',
    thurs: 'thu',
    thursday: 'thu',
    fri: 'fri',
    friday: 'fri',
    sat: 'sat',
    saturday: 'sat',
    sun: 'sun',
    sunday: 'sun',
  };
  return map[raw] || raw;
};

const buildTimetableGrid = (entries = []) => {
  const bySlot = new Map();
  (entries || []).forEach((entry) => {
    if (!entry?.day || !entry?.startTime) return;
    const day = normalizeDayValue(entry.day);
    const start = normalizeTime(entry.startTime);
    const key = `${day}|${start}`;
    bySlot.set(key, entry);
  });
  return bySlot;
};

const ClassSpecificTimetablePage = () => {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const [selectedGradeId, setSelectedGradeId] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [overriddenEntryIds, setOverriddenEntryIds] = useState(() => new Set());
  const [overriddenDetailsMap, setOverriddenDetailsMap] = useState(() => ({}));
  const [overrideDetailsEntry, setOverrideDetailsEntry] = useState(null);
  const [formError, setFormError] = useState('');
  const [formValues, setFormValues] = useState({
    classId: '',
    gradeId: '',
    subjectId: '',
    teacherId: '',
    day: 'mon',
    startTime: '08:00',
    endTime: '09:00',
    overrideReason: '',
  });

  const gradesQuery = useQuery({
    queryKey: ['grades-sections'],
    queryFn: getGradesSections,
    staleTime: 5 * 60 * 1000,
  });

  const subjectsQuery = useQuery({
    queryKey: ['subjects-list'],
    queryFn: getSubjectsList,
    staleTime: 5 * 60 * 1000,
  });

  const teachersQuery = useQuery({
    queryKey: ['users', 'teachers'],
    queryFn: () => getUsers({ role: 'teacher', limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const classesQuery = useQuery({
    queryKey: ['classes-list'],
    queryFn: () => getClasses({ page: 1, limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  });

  const selectedGrade = useMemo(() => {
    const grades = gradesQuery.data || [];
    return grades.find((g) => g.id === selectedGradeId) || grades[0] || null;
  }, [gradesQuery.data, selectedGradeId]);

  const gradeTabs = useMemo(() => {
    const grades = gradesQuery.data || [];
    if (grades.length) return grades;
    return [
      { id: '4th', label: '4th' },
      { id: '5th', label: '5th' },
      { id: '6th', label: '6th' },
      { id: '7th', label: '7th' },
    ];
  }, [gradesQuery.data]);

  // Auto-select a grade tab when data becomes available.
  useEffect(() => {
    if (!selectedGradeId && gradeTabs.length > 0) {
      setSelectedGradeId(gradeTabs[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeTabs.length]);

  const gradeLabel = selectedGrade?.label || (gradeTabs[0] && gradeTabs[0].label) || 'Grade';

  const classOptions = useMemo(() => {
    const classes = classesQuery.data?.items || [];
    if (!selectedGradeId) return classes;
    return classes.filter((c) => String(c.gradeId) === String(selectedGradeId) || String(c.grade) === String(gradeLabel));
  }, [classesQuery.data, selectedGradeId, gradeLabel]);

  const timetableEntriesQuery = useQuery({
    queryKey: ['timetable-entries', selectedGradeId, selectedClassId],
    queryFn: () =>
      getTimetableEntries({ gradeId: selectedGradeId, classId: selectedClassId }).catch(() => []),
    enabled: Boolean(selectedGradeId),
    staleTime: 30 * 1000,
  });

  const timetableMetaQuery = useQuery({
    queryKey: ['timetable-meta'],
    queryFn: () => getTimetableMeta().catch(() => ({})),
    staleTime: 5 * 60 * 1000,
  });

  const timetableEntries = timetableEntriesQuery.data || [];
  const timetableMeta = timetableMetaQuery.data || {};

  const subjectMap = useMemo(() => {
    const subjects = subjectsQuery.data || [];
    const metaSubjects = timetableMeta?.subjects || [];

    const fromSubjects = subjects.reduce((acc, sub) => {
      if (sub?.id) acc[String(sub.id)] = sub.name || sub.label || '';
      return acc;
    }, {});

    const fromMeta = (Array.isArray(metaSubjects) ? metaSubjects : []).reduce((acc, sub) => {
      if (!sub) return acc;
      const id = String(sub.id || sub._id || sub.subjectId || sub.subject_id || '').trim();
      const name = String(sub.name || sub.label || sub.subject || sub.title || '').trim();
      if (id) acc[id] = name;
      return acc;
    }, {});

    return { ...fromSubjects, ...fromMeta };
  }, [subjectsQuery.data, timetableMeta]);

  const teacherMap = useMemo(() => {
    const users = teachersQuery.data?.users || [];
    const metaTeachers = timetableMeta?.teachers || [];

    const fromUsers = users.reduce((acc, teacher) => {
      if (teacher?.id) acc[String(teacher.id)] = teacher.name || teacher.fullName || '';
      return acc;
    }, {});

    const fromMeta = (Array.isArray(metaTeachers) ? metaTeachers : []).reduce((acc, teacher) => {
      if (!teacher) return acc;
      const id = String(teacher.id || teacher._id || teacher.teacherId || teacher.teacher_id || '').trim();
      const name = String(teacher.name || teacher.fullName || teacher.label || '').trim();
      if (id) acc[id] = name;
      return acc;
    }, {});

    return { ...fromUsers, ...fromMeta };
  }, [teachersQuery.data, timetableMeta]);

  const enrichedEntries = useMemo(() => {
    const resolveNameFromObject = (raw) => {
      if (!raw) return '';
      if (typeof raw === 'string') return raw;
      if (typeof raw === 'object') {
        return (
          String(raw.name || raw.title || raw.label || raw.subject || raw.teacher || '') ||
          ''
        );
      }
      return String(raw);
    };

    const resolveSubjectName = (entry) => {
      const rawSubject =
        resolveNameFromObject(entry?.subject) ||
        resolveNameFromObject(entry?.subjectName) ||
        resolveNameFromObject(entry?.subject_name);

      const subjectId =
        entry?.subjectId || entry?.subject_id || entry?.subject?.id || entry?.subjectName?.id;

      return (
        String(rawSubject || '') ||
        subjectMap[String(subjectId)] ||
        ''
      );
    };

    const resolveTeacherName = (entry) => {
      const rawTeacher =
        resolveNameFromObject(entry?.teacher) ||
        resolveNameFromObject(entry?.teacherName) ||
        resolveNameFromObject(entry?.teacher_name);

      const teacherId =
        entry?.teacherId || entry?.teacher_id || entry?.teacher?.id || entry?.teacherName?.id;

      return (
        String(rawTeacher || '') ||
        teacherMap[String(teacherId)] ||
        ''
      );
    };

    return timetableEntries.map((entry) => ({
      ...entry,
      subjectName: resolveSubjectName(entry),
      teacherName: resolveTeacherName(entry),
    }));
  }, [timetableEntries, subjectMap, teacherMap]);

  const gridMap = useMemo(() => buildTimetableGrid(enrichedEntries), [enrichedEntries]);

  const createEntryMutation = useMutation({
    mutationFn: (payload) => createTimetableEntry(payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-entries', selectedGradeId, selectedClassId]);
      setIsCreateOpen(false);
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ entryId, payload }) => updateTimetableEntry(entryId, payload),
    onSuccess: (_, variables) => {
      const entryId = variables?.entryId;
      if (entryId) {
        setOverriddenEntryIds((prev) => new Set(prev).add(entryId));
        const reason = variables?.payload?.reason;
        if (reason !== undefined || variables?.payload?.isOverride) {
          setOverriddenDetailsMap((prev) => ({
            ...prev,
            [entryId]: {
              reason: String(reason ?? '').trim(),
              changedOn: new Date().toISOString(),
            },
          }));
        }
      }
      queryClient.invalidateQueries(['timetable-entries', selectedGradeId, selectedClassId]);
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-entries-for-class-cards'] });
      setIsCreateOpen(false);
      setEditingEntryId(null);
      setEditingEntry(null);
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId) => deleteTimetableEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-entries', selectedGradeId, selectedClassId]);
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-entries-for-class-cards'] });
    },
  });

  const handleDeleteSlot = async (entry) => {
    const id = entry?.id ?? entry?._id;
    if (!id) return;
    const result = await Swal.fire({
      title: 'Delete schedule entry?',
      text: `Remove "${entry.subjectName || entry.subject || 'this entry'}" from the timetable?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d01414',
      cancelButtonColor: '#1f3f93',
    });
    if (!result.isConfirmed) return;
    deleteEntryMutation.mutate(id, {
      onSuccess: async () => {
        await Swal.fire({
          title: 'Deleted',
          text: 'Schedule entry removed.',
          icon: 'success',
          confirmButtonColor: '#1f3f93',
        });
      },
      onError: async (err) => {
        await Swal.fire({
          title: 'Delete failed',
          text: err?.response?.data?.message || err?.message || 'Could not delete entry.',
          icon: 'error',
          confirmButtonColor: '#1f3f93',
        });
      },
    });
  };

  const openCreateModal = (day, startTime) => {
    setEditingEntryId(null);
    setFormError('');
    setFormValues((current) => ({
      ...current,
      gradeId: selectedGradeId || current.gradeId || '',
      classId: selectedClassId || current.classId || '',
      day,
      startTime,
      endTime: startTime ? `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, '0')}:00` : '09:00',
    }));
    setIsCreateOpen(true);
  };

  const openOverrideModal = (entry) => {
    const id = entry?.id ?? entry?._id;
    if (!id) return;
    setFormError('');
    setEditingEntry(entry);
    const dayVal = normalizeDayValue(entry.day) || entry.day || 'mon';
    const startVal = normalizeTime(entry.startTime) || entry.startTime || '08:00';
    setFormValues((current) => ({
      ...current,
      gradeId: entry.gradeId || selectedGradeId || current.gradeId || '',
      classId: entry.classId || selectedClassId || current.classId || '',
      subjectId: entry.subjectId || entry.subject_id || '',
      teacherId: entry.teacherId || entry.teacher_id || '',
      day: dayVal,
      startTime: startVal,
      endTime: normalizeTime(entry.endTime) || (startVal ? `${String(Number(startVal.slice(0, 2)) + 1).padStart(2, '0')}:00` : '09:00'),
      overrideReason: '',
    }));
    setEditingEntryId(id);
    setIsCreateOpen(true);
  };

  const closeModal = () => {
    setIsCreateOpen(false);
    setEditingEntryId(null);
    setEditingEntry(null);
    setFormError('');
  };

  const handleFormChange = (key, value) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const { classId, gradeId, subjectId, teacherId, day, startTime, endTime, overrideReason } = formValues;
    if (editingEntryId) {
      if (!subjectId || !teacherId) {
        setFormError('Please select subject and teacher for the override.');
        return;
      }
    } else {
      if (!classId || !gradeId || !subjectId || !teacherId || !day || !startTime || !endTime) {
        setFormError('Please fill in all required fields.');
        return;
      }
    }

    const payload = {
      type: 'class',
      classId: classId || editingEntry?.classId,
      gradeId: gradeId || editingEntry?.gradeId,
      subjectId,
      teacherId,
      day: day || editingEntry?.day,
      startTime: startTime || editingEntry?.startTime,
      endTime: endTime || editingEntry?.endTime,
    };
    if (editingEntryId && overrideReason !== undefined) {
      payload.reason = String(overrideReason || '').trim();
      payload.isOverride = true;
    }
    try {
      if (editingEntryId) {
        await updateEntryMutation.mutateAsync({ entryId: editingEntryId, payload });
      } else {
        await createEntryMutation.mutateAsync(payload);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.message || 'Failed to save schedule entry.';
      setFormError(message);
      // eslint-disable-next-line no-console
      console.error('Timetable save error', err);
    }
  };

  const selectedClass = classOptions.find((c) => c.id === selectedClassId) || null;

  return (
    <div className="rounded-[10px] border border-[#d6e3fb] bg-white p-5">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#17367a]">Class-Specific Timetable</h2>
        <p className="mt-1 text-sm text-[#6f84b4]">
          Create and manage timetables for individual class groups.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {gradeTabs.map((grade) => {
            const isActive = grade.id === (selectedGradeId || gradeTabs[0]?.id);
            return (
              <button
                key={grade.id}
                type="button"
                onClick={() => {
                  setSelectedGradeId(grade.id);
                  setSelectedClassId(null);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-[#1f3f93] text-white shadow-[0_4px_10px_rgba(31,63,147,0.25)]'
                    : 'border border-[#d6e3fb] bg-white text-[#17367a] hover:border-[#1f3f93] hover:text-[#1f3f93]'
                }`}
              >
                {grade.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 rounded-[10px] border border-[#e4ecff] bg-[#f7f9ff] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-semibold text-[#17367a]">Class</label>
              <select
                value={selectedClassId || ''}
                onChange={(event) => setSelectedClassId(event.target.value)}
                className="h-10 rounded-lg border border-[#d6e3fb] bg-white px-3 text-sm outline-none focus:border-[#1f3f93]"
              >
                <option value="">Select class</option>
                {classOptions.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.className || cls.grade || cls.subject || cls.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-sm text-[#6f84b4]">
              Select a slot to add a new schedule entry.
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#5f79af]">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-[#1f3f93]" aria-hidden />
                Normal class
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-[#fef08a]" aria-hidden />
                Override
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed border-collapse">
              <thead className="bg-[#eef4ff] text-left text-[13px] font-semibold text-[#1f3f93]">
                <tr>
                  <th className="w-24 px-4 py-3">Time</th>
                  {DAY_OPTIONS.map((day) => (
                    <th key={day.value} className="px-4 py-3">
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((time) => (
                  <tr key={time} className="border-t border-[#e2ecff]">
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-[#1f3f93]">
                      {time}
                    </td>
                    {DAY_OPTIONS.map((day) => {
                      const key = `${day.value}|${time}`;
                      const entry = gridMap.get(key);
                      const isDisabled = !selectedClassId;
                      return (
                        <td key={key} className="px-3 py-3">
                          {entry ? (() => {
                              const entryId = entry?.id ?? entry?._id;
                              const isOverridden =
                                entry.isOverride === true ||
                                entry.overridden === true ||
                                (entryId && overriddenEntryIds.has(entryId));
                              return (
                            <div
                              role={isOverridden ? 'button' : undefined}
                              tabIndex={isOverridden ? 0 : undefined}
                              onClick={isOverridden ? () => setOverrideDetailsEntry(entry) : undefined}
                              onKeyDown={
                                isOverridden
                                  ? (e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setOverrideDetailsEntry(entry);
                                      }
                                    }
                                  : undefined
                              }
                              className={`relative rounded-lg border p-2 pr-14 text-sm ${
                                isOverridden
                                  ? 'cursor-pointer border-[#fde047] bg-[#fefce8]'
                                  : 'border-[#d6e3ff] bg-white'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openOverrideModal(entry);
                                }}
                                disabled={updateEntryMutation.isPending}
                                className={`absolute right-8 top-1 flex h-6 w-6 items-center justify-center rounded-full disabled:opacity-50 ${
                                  isOverridden
                                    ? 'text-[#ca8a04] hover:bg-[#fef08a] hover:text-[#a16207]'
                                    : 'text-[#6f84b4] hover:bg-[#e0e7ff] hover:text-[#1f3f93]'
                                }`}
                                aria-label="Override timetable"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSlot(entry);
                                }}
                                disabled={deleteEntryMutation.isPending}
                                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-[#6f84b4] hover:bg-[#fee2e2] hover:text-[#b91c1c] disabled:opacity-50"
                                aria-label="Delete slot"
                              >
                                <X size={14} />
                              </button>
                              <div className={`font-semibold ${isOverridden ? 'text-[#a16207]' : 'text-[#1f3f93]'}`}>
                                {entry.subject || entry.subjectName || 'Class'}
                              </div>
                              <div className={`text-xs ${isOverridden ? 'text-[#ca8a04]' : 'text-[#6f84b4]'}`}>
                                {entry.teacherName || entry.teacher || ''}
                              </div>
                              {isOverridden && (
                                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-[#a16207]">
                                  <AlertCircle size={12} className="shrink-0" />
                                  <span>Overridden</span>
                                  <AlertTriangle size={12} className="shrink-0" />
                                </div>
                              )}
                            </div>
                              );
                            })() : (
                            <button
                              type="button"
                              disabled={isDisabled}
                              onClick={() => openCreateModal(day.value, time)}
                              className={`group flex h-14 w-full items-center justify-center rounded-lg border border-dashed px-1 text-sm text-[#6f84b4] transition ${
                                isDisabled
                                  ? 'cursor-not-allowed bg-[#f3f7fe] opacity-60'
                                  : 'hover:border-[#1f3f93] hover:text-[#1f3f93]'
                              }`}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[520px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            {editingEntryId ? (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="flex items-center justify-between">
                  <h2 className="text-[24px] font-semibold text-[#1f3f93]">Override Schedule</h2>
                  <button type="button" onClick={closeModal} className="text-[#6f84b4] hover:text-[#1f3f93]">
                    <X size={18} />
                  </button>
                </div>

                {formError && <p className="text-sm text-red-600">{formError}</p>}

                <div>
                  <p className="mb-1 text-sm font-semibold text-[#5f79af]">Current:</p>
                  <p className="text-[15px] text-[#17367a]">
                    {editingEntry
                      ? `${editingEntry.subject || editingEntry.subjectName || 'Class'} - ${editingEntry.teacherName || editingEntry.teacher || '—'} at ${normalizeTime(editingEntry.startTime) || editingEntry.startTime || '08:00'}`
                      : '—'}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-[#1f3f93]">Override with:</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <select
                        value={formValues.subjectId}
                        onChange={(event) => handleFormChange('subjectId', event.target.value)}
                        className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                      >
                        <option value="">Select subject</option>
                        {subjectsQuery.data?.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        value={formValues.teacherId}
                        onChange={(event) => handleFormChange('teacherId', event.target.value)}
                        className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                      >
                        <option value="">Select teacher</option>
                        {(teachersQuery.data?.users || []).map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Reason</label>
                  <input
                    type="text"
                    value={formValues.overrideReason ?? ''}
                    onChange={(event) => handleFormChange('overrideReason', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>

                <p className="text-sm text-[#6f84b4]">
                  This action will override the schedule for 1 class period.
                </p>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-[#d6e3fb] bg-white px-5 text-sm font-semibold text-[#17367a] hover:bg-[#f7f9ff]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateEntryMutation.isLoading}
                    className="inline-flex h-11 items-center justify-center rounded-lg bg-[#1f3f93] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updateEntryMutation.isLoading ? 'Saving...' : 'Override'}
                  </button>
                </div>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="flex items-center justify-between">
                  <h2 className="text-[24px] font-semibold text-[#1f3f93]">Add Schedule Entry</h2>
                  <button type="button" onClick={closeModal} className="text-[#6f84b4] hover:text-[#1f3f93]">
                    <X size={18} />
                  </button>
                </div>

                {formError && <p className="text-sm text-red-600">{formError}</p>}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Grade *</label>
                    <select
                      value={formValues.gradeId}
                      onChange={(event) => handleFormChange('gradeId', event.target.value)}
                      className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    >
                      <option value="">Select grade</option>
                      {gradeTabs.map((grade) => (
                        <option key={grade.id} value={grade.id}>
                          {grade.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Class *</label>
                    <select
                      value={formValues.classId}
                      onChange={(event) => handleFormChange('classId', event.target.value)}
                      className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    >
                      <option value="">Select class</option>
                      {classOptions.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.className || cls.grade || cls.subject || cls.id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Subject *</label>
                    <select
                      value={formValues.subjectId}
                      onChange={(event) => handleFormChange('subjectId', event.target.value)}
                      className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    >
                      <option value="">Select subject</option>
                      {subjectsQuery.data?.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Teacher *</label>
                    <select
                      value={formValues.teacherId}
                      onChange={(event) => handleFormChange('teacherId', event.target.value)}
                      className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    >
                      <option value="">Select teacher</option>
                      {(teachersQuery.data?.users || []).map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Day *</label>
                    <select
                      value={formValues.day}
                      onChange={(event) => handleFormChange('day', event.target.value)}
                      className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    >
                      {DAY_OPTIONS.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Start Time *</label>
                    <input
                      type="time"
                      value={formValues.startTime}
                      onChange={(event) => handleFormChange('startTime', event.target.value)}
                      className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">End Time *</label>
                    <input
                      type="time"
                      value={formValues.endTime}
                      onChange={(event) => handleFormChange('endTime', event.target.value)}
                      className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    />
                  </div>
                  <div className="flex items-end justify-end">
                    <button
                      type="submit"
                      disabled={createEntryMutation.isLoading}
                      className="inline-flex h-11 items-center justify-center rounded-lg bg-[#1f3f93] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {createEntryMutation.isLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {overrideDetailsEntry && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3"
          onClick={() => setOverrideDetailsEntry(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="override-details-title"
        >
          <div
            className="w-full max-w-[420px] rounded-xl border border-[#d6e3fb] bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="override-details-title" className="text-[20px] font-semibold text-[#1f3f93]">
                Override Details
              </h2>
              <button
                type="button"
                onClick={() => setOverrideDetailsEntry(null)}
                className="text-[#6f84b4] hover:text-[#1f3f93]"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1f3f93] text-sm font-semibold text-white"
                  aria-hidden
                >
                  {(authUser?.name || authUser?.role || 'Admin').charAt(0).toUpperCase()}
                </div>
                <p className="text-[15px] text-[#17367a]">
                  Changed by:{' '}
                  <span className="font-semibold">
                    {authUser?.name || authUser?.role || 'Super Admin'}
                  </span>
                </p>
              </div>

              <div>
                <p className="text-[15px] text-[#17367a]">
                  <span className="text-[#5f79af]">Reason:</span>{' '}
                  {overrideDetailsEntry.reason ||
                    overrideDetailsEntry.overrideReason ||
                    overriddenDetailsMap[overrideDetailsEntry?.id ?? overrideDetailsEntry?._id]?.reason ||
                    '—'}
                </p>
              </div>

              <div>
                <p className="text-[15px] text-[#17367a]">
                  <span className="text-[#5f79af]">Changed on:</span>{' '}
                  {formatOverrideChangedOn(
                    overrideDetailsEntry,
                    overriddenDetailsMap[overrideDetailsEntry?.id ?? overrideDetailsEntry?._id]?.changedOn
                  ) || '—'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setOverrideDetailsEntry(null)}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1f3f93] px-4 text-sm font-semibold text-white hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassSpecificTimetablePage;
