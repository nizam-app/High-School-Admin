import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiDownload,
  FiEdit2,
  FiPlus,
  FiTrash2,
  FiUpload,
} from 'react-icons/fi';
import Swal from 'sweetalert2';
import { getUsers } from '../../users/api/usersApi';
import { getTimetableEntries } from '../../timetable/api/timetableApi';
import {
  createAssignment,
  createClass,
  getContentStats,
  createGrade,
  createSubject,
  deleteAssignment,
  deleteGrade,
  deleteLesson,
  deleteSubject,
  deleteClass,
  getAssignments,
  getAssignmentsStats,
  getAssignmentSubmissions,
  getClasses,
  getGradesSections,
  getLessons,
  getSubjectsList,
  resolveLessonDownloadUrl,
  uploadLesson,
  updateAssignment,
  updateClass,
  updateLesson,
} from '../api/classesApi';

const TAB_OPTIONS = ['Classes', 'Content Library', 'Assignments'];
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const isMongoId = (value) => /^[a-f\d]{24}$/i.test(String(value || '').trim());
const looksLikeId = (value) => /^[a-f\d]{24}$/i.test(String(value || '').trim());
const LESSON_FILE_INPUT_ID = 'lesson-file-input';
const LESSONS_PAGE_SIZE = 5;
const DAY_LABELS = {
  sat: 'Sat',
  sun: 'Sun',
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
};
const ASSIGNMENTS_PAGE_SIZE = 4;
const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toISOString().slice(0, 16).replace('T', ' ');
};
const splitDueAt = (value) => {
  if (!value) return { dueDate: '', dueTime: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { dueDate: '', dueTime: '' };
  const iso = date.toISOString();
  return {
    dueDate: iso.slice(0, 10),
    dueTime: iso.slice(11, 16),
  };
};

const ClassesContentPage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Classes');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isAddGradeOpen, setIsAddGradeOpen] = useState(false);
  const [isLessonEditOpen, setIsLessonEditOpen] = useState(false);
  const [classActionError, setClassActionError] = useState('');
  const [editingClass, setEditingClass] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [createValues, setCreateValues] = useState({
    subject: '',
    grade: '',
    teacherId: '',
  });
  const [editValues, setEditValues] = useState({
    subject: '',
    grade: '',
  });
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newGradeLabel, setNewGradeLabel] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [recentLessonsPage, setRecentLessonsPage] = useState(1);
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState('all');
  const [isCreateAssignmentOpen, setIsCreateAssignmentOpen] = useState(false);
  const [isAssignmentSubmissionsOpen, setIsAssignmentSubmissionsOpen] = useState(false);
  const [isAssignmentSubmissionsLoading, setIsAssignmentSubmissionsLoading] = useState(false);
  const [isEditAssignmentOpen, setIsEditAssignmentOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [assignmentEditValues, setAssignmentEditValues] = useState({
    title: '',
    description: '',
    dueDate: '',
    dueTime: '',
    points: '',
    lateAllowed: false,
    status: 'active',
    files: [],
  });
  const [existingAssignmentFiles, setExistingAssignmentFiles] = useState([]);
  const [removedAssignmentFiles, setRemovedAssignmentFiles] = useState([]);
  const [assignmentSubmissionsData, setAssignmentSubmissionsData] = useState({
    assignment: null,
    submissions: [],
  });
  const [assignmentFormValues, setAssignmentFormValues] = useState({
    classId: '',
    title: '',
    description: '',
    dueDate: '',
    dueTime: '',
    points: '',
    files: [],
  });
  const fileInputRef = useRef(null);
  const [lessonValues, setLessonValues] = useState({
    title: '',
    contentType: 'pdf',
    gradeId: '',
    subjectId: '',
    chapter: '',
    description: '',
    textContent: '',
    quizJson: '',
    file: null,
  });
  const [lessonEditValues, setLessonEditValues] = useState({
    title: '',
    chapter: '',
    contentType: 'pdf',
    gradeId: '',
    subjectId: '',
    description: '',
  });

  const {
    data: classesResponse = { items: [], meta: null },
    isLoading: isClassesLoading,
    isError: isClassesError,
  } = useQuery({
    queryKey: ['classes-content-classes'],
    queryFn: () => getClasses({ page: 1, limit: 20 }),
    staleTime: 30 * 1000,
    retry: 1,
  });

  const { data: gradesFromApi = [], isLoading: isGradesLoading } = useQuery({
    queryKey: ['class-grades-options'],
    queryFn: getGradesSections,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: subjectsFromApi = [], isLoading: isSubjectsLoading } = useQuery({
    queryKey: ['class-subjects-options'],
    queryFn: getSubjectsList,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: contentStats = { lessons: 0, videos: 0, documents: 0, assignments: 0 } } = useQuery({
    queryKey: ['classes-content-stats'],
    queryFn: getContentStats,
    staleTime: 30 * 1000,
    retry: 1,
  });

  const {
    data: recentLessonsResponse = {
      items: [],
      pagination: { page: 1, limit: LESSONS_PAGE_SIZE, total: 0, totalPages: 1 },
    },
    isLoading: isRecentLessonsLoading,
    isError: isRecentLessonsError,
  } = useQuery({
    queryKey: ['classes-content-recent-lessons', recentLessonsPage],
    queryFn: () =>
      getLessons({
        page: recentLessonsPage,
        limit: LESSONS_PAGE_SIZE,
        status: 'all',
        contentType: 'all',
      }),
    staleTime: 30 * 1000,
    retry: 1,
    placeholderData: (previousData) => previousData,
  });

  const {
    data: assignmentsResponse = {
      items: [],
      pagination: { page: 1, limit: ASSIGNMENTS_PAGE_SIZE, total: 0, totalPages: 1 },
    },
    isLoading: isAssignmentsLoading,
    isError: isAssignmentsError,
  } = useQuery({
    queryKey: ['classes-content-assignments', assignmentsPage, assignmentStatusFilter],
    queryFn: () =>
      getAssignments({
        page: assignmentsPage,
        limit: ASSIGNMENTS_PAGE_SIZE,
        status: assignmentStatusFilter,
      }),
    staleTime: 30 * 1000,
    retry: 1,
    placeholderData: (previousData) => previousData,
    enabled: activeTab === 'Assignments',
  });

  const {
    data: assignmentsStats = { active: 0, upcoming: 0, closed: 0, total: 0 },
    isLoading: isAssignmentsStatsLoading,
  } = useQuery({
    queryKey: ['classes-content-assignments-stats'],
    queryFn: getAssignmentsStats,
    staleTime: 30 * 1000,
    retry: 1,
    enabled: activeTab === 'Assignments',
  });

  const { data: lessonsForCountResponse = { items: [], pagination: {} } } = useQuery({
    queryKey: ['classes-content-lessons-for-count'],
    queryFn: () => getLessons({ page: 1, limit: 1000, status: 'all', contentType: 'all' }),
    staleTime: 60 * 1000,
    retry: 1,
    enabled: activeTab === 'Classes',
  });

  const { data: assignmentsForCountResponse = { items: [], pagination: {} } } = useQuery({
    queryKey: ['classes-content-assignments-for-count'],
    queryFn: () => getAssignments({ page: 1, limit: 1000, status: 'all' }),
    staleTime: 60 * 1000,
    retry: 1,
    enabled: activeTab === 'Classes',
  });

  const { data: timetableEntriesForClasses = [] } = useQuery({
    queryKey: ['timetable-entries-for-class-cards'],
    queryFn: () => getTimetableEntries({}),
    staleTime: 60 * 1000,
    retry: 1,
    enabled: activeTab === 'Classes',
  });

  const createClassMutation = useMutation({
    mutationFn: createClass,
    onSuccess: () => {
      setClassActionError('');
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to create class');
    },
  });

  const deleteClassMutation = useMutation({
    mutationFn: deleteClass,
    onSuccess: () => {
      setClassActionError('');
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to delete class');
    },
  });

  const updateClassMutation = useMutation({
    mutationFn: ({ classId, payload }) => updateClass(classId, payload),
    onSuccess: () => {
      setClassActionError('');
      setIsEditOpen(false);
      setEditingClass(null);
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to update class');
    },
  });

  const createSubjectMutation = useMutation({
    mutationFn: createSubject,
    onSuccess: () => {
      setClassActionError('');
      setIsAddSubjectOpen(false);
      setNewSubjectName('');
      queryClient.invalidateQueries({ queryKey: ['class-subjects-options'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to create subject');
    },
  });

  const createGradeMutation = useMutation({
    mutationFn: createGrade,
    onSuccess: () => {
      setClassActionError('');
      setIsAddGradeOpen(false);
      setNewGradeLabel('');
      queryClient.invalidateQueries({ queryKey: ['class-grades-options'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to create grade');
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: deleteSubject,
    onSuccess: () => {
      setClassActionError('');
      queryClient.invalidateQueries({ queryKey: ['class-subjects-options'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to delete subject');
    },
  });

  const deleteGradeMutation = useMutation({
    mutationFn: deleteGrade,
    onSuccess: () => {
      setClassActionError('');
      queryClient.invalidateQueries({ queryKey: ['class-grades-options'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to delete grade');
    },
  });

  const uploadLessonMutation = useMutation({
    mutationFn: uploadLesson,
    onSuccess: () => {
      setClassActionError('');
      setIsDragOver(false);
      setLessonValues({
        title: '',
        contentType: 'pdf',
        gradeId: '',
        subjectId: '',
        chapter: '',
        description: '',
        textContent: '',
        quizJson: '',
        file: null,
      });
      setRecentLessonsPage(1);
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-recent-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-lessons-for-count'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to upload lesson');
    },
  });

  const updateLessonMutation = useMutation({
    mutationFn: ({ lessonId, payload }) => updateLesson(lessonId, payload),
    onSuccess: () => {
      setClassActionError('');
      setIsLessonEditOpen(false);
      setEditingLesson(null);
      queryClient.invalidateQueries({ queryKey: ['classes-content-recent-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-lessons-for-count'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to update lesson');
    },
  });

  const deleteLessonMutation = useMutation({
    mutationFn: deleteLesson,
    onSuccess: () => {
      setClassActionError('');
      queryClient.invalidateQueries({ queryKey: ['classes-content-recent-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-lessons-for-count'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to delete lesson');
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: ({ assignmentId, payload }) => updateAssignment(assignmentId, payload),
    onSuccess: () => {
      setClassActionError('');
      queryClient.invalidateQueries({ queryKey: ['classes-content-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-assignments-stats'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-assignments-for-count'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to update assignment');
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      setClassActionError('');
      queryClient.invalidateQueries({ queryKey: ['classes-content-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-assignments-stats'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-assignments-for-count'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to delete assignment');
    },
  });

  const createAssignmentMutation = useMutation({
    mutationFn: createAssignment,
    onSuccess: () => {
      setClassActionError('');
      setIsCreateAssignmentOpen(false);
      setAssignmentFormValues({
        classId: '',
        title: '',
        description: '',
        dueDate: '',
        dueTime: '',
        points: '',
        files: [],
      });
      setAssignmentsPage(1);
      setAssignmentStatusFilter('all');
      queryClient.invalidateQueries({ queryKey: ['classes-content-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-assignments-stats'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-assignments-for-count'] });
      queryClient.invalidateQueries({ queryKey: ['classes-content-classes'] });
    },
    onError: (error) => {
      setClassActionError(error?.response?.data?.message || 'Failed to create assignment');
    },
  });

  const { data: teachersResponse, isLoading: isTeachersLoading } = useQuery({
    queryKey: ['class-teachers-options'],
    queryFn: () =>
      getUsers({
        role: 'teacher',
        status: 'active',
        search: '',
        page: 1,
        limit: 1000,
      }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const gradeOptions = useMemo(
    () =>
      (gradesFromApi || [])
        .map((grade) => ({
          id: String(grade?.id || ''),
          label: String(grade?.label || grade?.level || grade?.name || '').trim(),
          classCount: Number(grade?.classCount || 0),
          sections: Array.isArray(grade?.sections) ? grade.sections : [],
        }))
        .filter((grade) => grade.id && grade.label),
    [gradesFromApi]
  );

  const subjectOptions = useMemo(() => {
    const fromApi = (subjectsFromApi || [])
      .map((subject) =>
        typeof subject === 'string' ? String(subject).trim() : String(subject?.name || '').trim()
      )
      .filter(Boolean);
    const fromClasses = (classesResponse?.items || [])
      .map((item) => String(item?.subject || '').trim())
      .filter(Boolean);
    return Array.from(new Set([...fromApi, ...fromClasses]));
  }, [subjectsFromApi, classesResponse?.items]);

  const teacherOptions = useMemo(() => {
    const users = Array.isArray(teachersResponse?.users)
      ? teachersResponse.users
      : Array.isArray(teachersResponse?.items)
        ? teachersResponse.items
        : [];

    return users
      .map((teacher) => ({
        id: String(teacher?.id || teacher?._id || '').trim(),
        name: String(teacher?.name || teacher?.fullName || '').trim(),
      }))
      .filter((teacher) => teacher.id && teacher.name);
  }, [teachersResponse]);

  const subjectCatalog = useMemo(
    () =>
      (subjectsFromApi || [])
        .map((item) => ({
          id: String(item?.id || '').trim(),
          name: String(item?.name || '').trim(),
        }))
        .filter((item) => item.id && item.name),
    [subjectsFromApi]
  );

  const subjectNameById = useMemo(() => {
    const map = new Map();
    subjectCatalog.forEach((item) => {
      map.set(String(item.id || '').trim(), String(item.name || '').trim());
    });
    return map;
  }, [subjectCatalog]);

  const gradeNameById = useMemo(() => {
    const map = new Map();
    gradeOptions.forEach((item) => {
      map.set(String(item.id || '').trim(), String(item.label || '').trim());
    });
    return map;
  }, [gradeOptions]);

  const classes = useMemo(
    () => (Array.isArray(classesResponse?.items) ? classesResponse.items : []),
    [classesResponse?.items]
  );

  const lessonCountByClassId = useMemo(() => {
    const list = Array.isArray(lessonsForCountResponse?.items) ? lessonsForCountResponse.items : [];
    const byClass = new Map();
    const byGradeSubject = new Map();
    list.forEach((lesson) => {
      const cid = String(lesson?.classId || '').trim();
      const gid = String(lesson?.gradeId || '').trim();
      const sid = String(lesson?.subjectId || '').trim();
      if (cid) {
        byClass.set(cid, (byClass.get(cid) || 0) + 1);
      }
      if (gid && sid) {
        const key = `${gid}|${sid}`;
        byGradeSubject.set(key, (byGradeSubject.get(key) || 0) + 1);
      }
    });
    return { byClass, byGradeSubject };
  }, [lessonsForCountResponse?.items]);

  const assignmentCountByClassId = useMemo(() => {
    const list = Array.isArray(assignmentsForCountResponse?.items)
      ? assignmentsForCountResponse.items
      : [];
    const byClass = new Map();
    const byGradeSubject = new Map();
    list.forEach((assignment) => {
      const cid = String(assignment?.classId || '').trim();
      const gid = String(assignment?.gradeId || '').trim();
      const sid = String(assignment?.subjectId || '').trim();
      if (cid) {
        byClass.set(cid, (byClass.get(cid) || 0) + 1);
      }
      if (gid && sid) {
        const key = `${gid}|${sid}`;
        byGradeSubject.set(key, (byGradeSubject.get(key) || 0) + 1);
      }
    });
    return { byClass, byGradeSubject };
  }, [assignmentsForCountResponse?.items]);

  const classesWithCounts = useMemo(
    () =>
      classes.map((c) => {
        const id = String(c?.id || c?.deleteId || '').trim();
        const gradeId = String(c?.gradeId || '').trim();
        const subjectId = String(c?.subjectId || '').trim();
        const gradeSubjectKey = gradeId && subjectId ? `${gradeId}|${subjectId}` : '';
        const lessons =
          lessonCountByClassId.byClass.get(id) ??
          (gradeSubjectKey ? lessonCountByClassId.byGradeSubject.get(gradeSubjectKey) : null) ??
          Number(c.lessons ?? 0);
        const assignments =
          assignmentCountByClassId.byClass.get(id) ??
          (gradeSubjectKey ? assignmentCountByClassId.byGradeSubject.get(gradeSubjectKey) : null) ??
          Number(c.assignments ?? 0);
        return { ...c, lessons, assignments };
      }),
    [classes, lessonCountByClassId, assignmentCountByClassId]
  );

  const overriddenSlotKeys = useMemo(() => {
    const entries = Array.isArray(timetableEntriesForClasses) ? timetableEntriesForClasses : [];
    const dayNorm = (d) => {
      const s = String(d || '').trim().toLowerCase();
      const map = { monday: 'mon', tue: 'tue', tuesday: 'tue', wed: 'wed', wednesday: 'wed', thu: 'thu', thursday: 'thu', fri: 'fri', friday: 'fri', sat: 'sat', saturday: 'sat', sun: 'sun', sunday: 'sun' };
      return map[s] || s.slice(0, 3);
    };
    const timeToMin = (t) => {
      if (t == null) return null;
      const str = String(t).trim();
      const m = str.match(/^(\d{1,2}):(\d{2})/);
      if (!m) return null;
      return Number(m[1]) * 60 + Number(m[2]);
    };
    const set = new Set();
    entries.forEach((entry) => {
      if (!entry?.isOverride && !entry?.overridden) return;
      const classId = String(entry?.classId ?? entry?.class_id ?? '').trim();
      const day = dayNorm(entry?.day);
      const min = timeToMin(entry?.startTime ?? entry?.start_time);
      if (classId && day && min != null) set.add(`${classId}|${day}|${min}`);
    });
    return set;
  }, [timetableEntriesForClasses]);

  const classesWithFilteredSchedule = useMemo(
    () => {
      const timeToMin = (t) => {
        if (t == null) return null;
        const str = String(t).trim();
        const m = str.match(/^(\d{1,2}):(\d{2})/);
        if (!m) return null;
        return Number(m[1]) * 60 + Number(m[2]);
      };
      return classesWithCounts.map((c) => {
        const classId = String(c?.id ?? c?.deleteId ?? '').trim();
        const dayNorm = (d) => String(d || '').trim().toLowerCase().slice(0, 3);
        const schedule = Array.isArray(c.schedule) ? c.schedule : [];
        const filtered = schedule.filter((slot) => {
          const day = dayNorm(slot?.day);
          const startMin = slot?.startMin != null ? Number(slot.startMin) : timeToMin(slot?.startTime ?? slot?.start_time);
          if (day && startMin != null && overriddenSlotKeys.has(`${classId}|${day}|${startMin}`))
            return false;
          return true;
        });
        return { ...c, schedule: filtered };
      });
    },
    [classesWithCounts, overriddenSlotKeys]
  );

  const assignmentClassOptions = useMemo(
    () =>
      classes
        .map((item) => ({
          id: String(item?.deleteId || item?.id || '').trim(),
          gradeId: String(item?.gradeId || '').trim(),
          subjectId: String(item?.subjectId || '').trim(),
          label: `${String(item?.grade || '').trim()} - ${String(item?.subject || '').trim()}`,
        }))
        .filter(
          (item) => item.id && item.gradeId && item.subjectId && item.label && item.label !== ' - '
        ),
    [classes]
  );
  const recentLessons = useMemo(
    () => (Array.isArray(recentLessonsResponse?.items) ? recentLessonsResponse.items : []),
    [recentLessonsResponse]
  );
  const recentLessonsPagination = useMemo(
    () =>
      recentLessonsResponse?.pagination || {
        page: 1,
        limit: LESSONS_PAGE_SIZE,
        total: 0,
        totalPages: 1,
      },
    [recentLessonsResponse]
  );
  const assignments = useMemo(
    () => (Array.isArray(assignmentsResponse?.items) ? assignmentsResponse.items : []),
    [assignmentsResponse]
  );
  const assignmentsPagination = useMemo(
    () =>
      assignmentsResponse?.pagination || {
        page: 1,
        limit: ASSIGNMENTS_PAGE_SIZE,
        total: 0,
        totalPages: 1,
      },
    [assignmentsResponse]
  );

  useEffect(() => {
    if (!createValues.subject && subjectOptions.length > 0) {
      setCreateValues((prev) => ({ ...prev, subject: subjectOptions[0] }));
    }
  }, [createValues.subject, subjectOptions]);

  useEffect(() => {
    if (!createValues.grade && gradeOptions.length > 0) {
      setCreateValues((prev) => ({ ...prev, grade: gradeOptions[0].id }));
    }
  }, [createValues.grade, gradeOptions]);

  useEffect(() => {
    if (!createValues.teacherId && teacherOptions.length > 0) {
      setCreateValues((prev) => ({ ...prev, teacherId: teacherOptions[0].id }));
    }
  }, [createValues.teacherId, teacherOptions]);

  useEffect(() => {
    const totalPages = Number(recentLessonsPagination?.totalPages || 1);
    if (recentLessonsPage > totalPages) {
      setRecentLessonsPage(totalPages);
    }
  }, [recentLessonsPage, recentLessonsPagination?.totalPages]);

  useEffect(() => {
    const totalPages = Number(assignmentsPagination?.totalPages || 1);
    if (assignmentsPage > totalPages) {
      setAssignmentsPage(totalPages);
    }
  }, [assignmentsPage, assignmentsPagination?.totalPages]);

  useEffect(() => {
    if (!isCreateAssignmentOpen) return;
    if (assignmentFormValues.classId) return;
    const defaultClassId = String(assignmentClassOptions?.[0]?.id || '').trim();
    if (!defaultClassId) return;
    setAssignmentFormValues((prev) => ({ ...prev, classId: defaultClassId }));
  }, [isCreateAssignmentOpen, assignmentFormValues.classId, assignmentClassOptions]);

  const handleCreateClass = (event) => {
    event.preventDefault();
    const subject = String(createValues.subject || '').trim();
    const gradeId = String(createValues.grade || '').trim();
    const teacherId = String(createValues.teacherId || '').trim();
    const selectedGrade = gradeOptions.find((item) => item.id === gradeId);
    const selectedSubject = subjectCatalog.find(
      (item) => normalizeText(item.name) === normalizeText(subject)
    );
    if (!subject || !selectedGrade || !teacherId) return;

    const payload = {
      subject,
      subjectId: selectedSubject?.id || undefined,
      gradeId,
      gradeLevel: selectedGrade.label,
      teacherId,
    };

    createClassMutation.mutate(payload, {
      onSuccess: async () => {
        await Swal.fire({
          title: 'Created',
          text: 'Class created successfully.',
          icon: 'success',
          confirmButtonColor: '#1f3f93',
        });
      },
      onError: async (error) => {
        const status = error?.response?.status;
        const message = error?.response?.data?.message || error?.message || 'Failed to create class';
        await Swal.fire({
          title: 'Create Failed',
          text: status ? `(${status}) ${message}` : message,
          icon: 'error',
          confirmButtonColor: '#1f3f93',
        });
      },
    });
  };

  const handleUpdateClass = (event) => {
    event.preventDefault();
    if (!editingClass) return;

    const subject = String(editValues.subject || '').trim();
    const gradeId = String(editValues.grade || '').trim();
    const selectedGrade = gradeOptions.find((item) => item.id === gradeId);
    const selectedSubject = subjectCatalog.find(
      (item) => normalizeText(item.name) === normalizeText(subject)
    );
    if (!subject || !selectedGrade) return;

    const payload = {
      subject,
      subjectId: selectedSubject?.id || undefined,
      gradeId,
      gradeLevel: selectedGrade.label,
    };

    updateClassMutation.mutate(
      { classId: editingClass.deleteId || editingClass.id, payload },
      {
        onSuccess: async () => {
          await Swal.fire({
            title: 'Updated',
            text: 'Class updated successfully.',
            icon: 'success',
            confirmButtonColor: '#1f3f93',
          });
        },
        onError: async (error) => {
          const status = error?.response?.status;
          const message = error?.response?.data?.message || error?.message || 'Failed to update class';
          await Swal.fire({
            title: 'Update Failed',
            text: status ? `(${status}) ${message}` : message,
            icon: 'error',
            confirmButtonColor: '#1f3f93',
          });
        },
      }
    );
  };

  const handleDeleteClass = async (item) => {
    const deleteId = String(item?.deleteId || item?.id || '').trim();

    if (!isMongoId(deleteId)) {
      await Swal.fire({
        title: 'Delete Failed',
        text: `Class id is invalid: "${deleteId || 'missing'}". Backend must return _id.`,
        icon: 'error',
        confirmButtonColor: '#1f3f93',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Delete Class?',
      text: `Are you sure you want to delete "${item.subject} ${item.grade}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#1f3f93',
    });

    if (!result.isConfirmed) return;

    deleteClassMutation.mutate(deleteId, {
      onSuccess: async () => {
        await Swal.fire({
          title: 'Deleted',
          text: 'Class deleted successfully.',
          icon: 'success',
          confirmButtonColor: '#1f3f93',
        });
      },
      onError: async (error) => {
        const status = error?.response?.status;
        const message = error?.response?.data?.message || error?.message || 'Failed to delete class';
        await Swal.fire({
          title: 'Delete Failed',
          text: status ? `(${status}) ${message}` : message,
          icon: 'error',
          confirmButtonColor: '#1f3f93',
        });
      },
    });
  };

  const handleCreateSubject = (event) => {
    event.preventDefault();
    const subjectName = String(newSubjectName || '').trim();
    if (!subjectName) return;

    createSubjectMutation.mutate(
      {
        name: subjectName,
        subject: subjectName,
      },
      {
        onSuccess: async () => {
          await Swal.fire({
            title: 'Created',
            text: 'Subject created successfully.',
            icon: 'success',
            confirmButtonColor: '#1f3f93',
          });
        },
        onError: async (error) => {
          const status = error?.response?.status;
          const message = error?.response?.data?.message || error?.message || 'Failed to create subject';
          await Swal.fire({
            title: 'Create Failed',
            text: status ? `(${status}) ${message}` : message,
            icon: 'error',
            confirmButtonColor: '#1f3f93',
          });
        },
      }
    );
  };

  const handleCreateGrade = (event) => {
    event.preventDefault();
    const gradeLabel = String(newGradeLabel || '').trim();
    if (!gradeLabel) return;

    createGradeMutation.mutate(
      {
        label: gradeLabel,
        name: gradeLabel,
        gradeLevel: gradeLabel,
      },
      {
        onSuccess: async () => {
          await Swal.fire({
            title: 'Created',
            text: 'Grade created successfully.',
            icon: 'success',
            confirmButtonColor: '#1f3f93',
          });
        },
        onError: async (error) => {
          const status = error?.response?.status;
          const message = error?.response?.data?.message || error?.message || 'Failed to create grade';
          await Swal.fire({
            title: 'Create Failed',
            text: status ? `(${status}) ${message}` : message,
            icon: 'error',
            confirmButtonColor: '#1f3f93',
          });
        },
      }
    );
  };

  const handleDeleteSubject = async (subjectItem) => {
    if (!subjectItem?.deletable) {
      await Swal.fire({
        title: 'Delete Not Available',
        text: 'This subject is missing backend id.',
        icon: 'info',
        confirmButtonColor: '#1f3f93',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Delete Subject?',
      text: `Are you sure you want to delete "${subjectItem.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#1f3f93',
    });
    if (!result.isConfirmed) return;

    deleteSubjectMutation.mutate(subjectItem.id, {
      onSuccess: async () => {
        await Swal.fire({
          title: 'Deleted',
          text: 'Subject deleted successfully.',
          icon: 'success',
          confirmButtonColor: '#1f3f93',
        });
      },
      onError: async (error) => {
        const status = error?.response?.status;
        const message = error?.response?.data?.message || error?.message || 'Failed to delete subject';
        await Swal.fire({
          title: 'Delete Failed',
          text: status ? `(${status}) ${message}` : message,
          icon: 'error',
          confirmButtonColor: '#1f3f93',
        });
      },
    });
  };

  const handleDeleteGrade = async (gradeItem) => {
    const gradeId = String(gradeItem?.id || '').trim();
    if (!gradeId) {
      await Swal.fire({
        title: 'Delete Not Available',
        text: 'This grade is missing backend id.',
        icon: 'info',
        confirmButtonColor: '#1f3f93',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Delete Grade?',
      text: `Are you sure you want to delete "${gradeItem.label}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#1f3f93',
    });
    if (!result.isConfirmed) return;

    deleteGradeMutation.mutate(gradeId, {
      onSuccess: async () => {
        await Swal.fire({
          title: 'Deleted',
          text: 'Grade deleted successfully.',
          icon: 'success',
          confirmButtonColor: '#1f3f93',
        });
      },
      onError: async (error) => {
        const status = error?.response?.status;
        const message = error?.response?.data?.message || error?.message || 'Failed to delete grade';
        await Swal.fire({
          title: 'Delete Failed',
          text: status ? `(${status}) ${message}` : message,
          icon: 'error',
          confirmButtonColor: '#1f3f93',
        });
      },
    });
  };

  const handleUploadLesson = (event) => {
    event.preventDefault();

    const title = String(lessonValues.title || '').trim();
    const contentType = String(lessonValues.contentType || '').trim().toLowerCase();
    const gradeId = String(lessonValues.gradeId || '').trim();
    const subjectId = String(lessonValues.subjectId || '').trim();
    const chapter = String(lessonValues.chapter || '').trim();
    const description = String(lessonValues.description || '').trim();
    const textContent = String(lessonValues.textContent || '').trim();
    const quizJson = String(lessonValues.quizJson || '').trim();

    if (!title || !gradeId || !subjectId || !chapter) {
      setClassActionError('Title, chapter, grade and subject are required for lesson upload.');
      return;
    }

    if ((contentType === 'pdf' || contentType === 'video') && !lessonValues.file) {
      setClassActionError('Please choose a file for PDF/Video lesson.');
      return;
    }

    let quizPayload;
    if (contentType === 'quiz' && quizJson) {
      try {
        quizPayload = JSON.parse(quizJson);
      } catch {
        setClassActionError('Quiz JSON is invalid. Please provide valid JSON.');
        return;
      }
    }

    const payload = {
      title,
      contentType,
      gradeId,
      subjectId,
      chapter,
      description: (contentType === 'text' && !description ? textContent : description) || undefined,
      textContent: contentType === 'text' ? textContent : undefined,
      quiz: contentType === 'quiz' ? quizPayload || quizJson : undefined,
      file: contentType === 'pdf' || contentType === 'video' ? lessonValues.file : undefined,
    };

    uploadLessonMutation.mutate(payload, {
      onSuccess: async () => {
        await Swal.fire({
          title: 'Uploaded',
          text: 'Lesson uploaded successfully.',
          icon: 'success',
          confirmButtonColor: '#1f3f93',
        });
      },
      onError: async (error) => {
        const status = error?.response?.status;
        const message = error?.response?.data?.message || error?.message || 'Failed to upload lesson';
        await Swal.fire({
          title: 'Upload Failed',
          text: status ? `(${status}) ${message}` : message,
          icon: 'error',
          confirmButtonColor: '#1f3f93',
        });
      },
    });
  };

  const handlePickedFile = (file) => {
    if (!file) return;
    setLessonValues((prev) => ({ ...prev, file }));
  };

  const openFilePicker = () => {
    const input = fileInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.click();
  };

  const getLessonTypeLabel = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'pdf') return 'PDF';
    if (normalized === 'video') return 'Video';
    if (normalized === 'quiz') return 'Quiz';
    if (normalized === 'text') return 'Text';
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'N/A';
  };

  const formatLessonDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toISOString().slice(0, 10);
  };

  const resolveSubjectName = (lesson) => {
    const subjectId = String(lesson?.subjectId || '').trim();
    const subjectText = String(lesson?.subject || '').trim();
    if (subjectId && subjectNameById.has(subjectId)) return subjectNameById.get(subjectId);
    if (subjectText && !looksLikeId(subjectText)) return subjectText;
    if (subjectText && subjectNameById.has(subjectText)) return subjectNameById.get(subjectText);
    return 'N/A';
  };

  const resolveGradeName = (lesson) => {
    const gradeId = String(lesson?.gradeId || '').trim();
    const gradeText = String(lesson?.gradeLevel || '').trim();
    if (gradeId && gradeNameById.has(gradeId)) return gradeNameById.get(gradeId);
    if (gradeText && !looksLikeId(gradeText)) return gradeText;
    if (gradeText && gradeNameById.has(gradeText)) return gradeNameById.get(gradeText);
    return 'N/A';
  };

  const formatMinutesLabel = (value) => {
    const total = Number(value);
    if (!Number.isFinite(total) || total < 0) return '';
    const hours24 = Math.floor(total / 60);
    const minutes = total % 60;
    const suffix = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;
    return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`;
  };

  const formatScheduleLabel = (slot) => {
    const day = DAY_LABELS[String(slot?.day || '').trim().toLowerCase()] || String(slot?.day || '').trim();
    const start = formatMinutesLabel(slot?.startMin);
    const end = formatMinutesLabel(slot?.endMin);
    const room = String(slot?.room || '').trim();
    const timeLabel = start && end ? `${start} - ${end}` : '';
    return [day, timeLabel, room ? `Room ${room}` : ''].filter(Boolean).join(' | ');
  };

  const findGradeIdByName = (name) => {
    const normalized = normalizeText(name);
    if (!normalized) return '';
    const found = gradeOptions.find((item) => normalizeText(item.label) === normalized);
    return String(found?.id || '');
  };

  const findSubjectIdByName = (name) => {
    const normalized = normalizeText(name);
    if (!normalized) return '';
    const found = subjectCatalog.find((item) => normalizeText(item.name) === normalized);
    return String(found?.id || '');
  };

  const openLessonEditModal = (lesson) => {
    const gradeId = String(lesson?.gradeId || '').trim() || findGradeIdByName(resolveGradeName(lesson));
    const subjectId =
      String(lesson?.subjectId || '').trim() || findSubjectIdByName(resolveSubjectName(lesson));

    setEditingLesson(lesson);
    setLessonEditValues({
      title: String(lesson?.title || '').trim(),
      chapter: String(lesson?.chapter || '').trim(),
      contentType: String(lesson?.contentType || 'pdf').trim().toLowerCase(),
      gradeId,
      subjectId,
      description: String(lesson?.description || '').trim(),
    });
    setIsLessonEditOpen(true);
  };

  const handleUpdateLesson = (event) => {
    event.preventDefault();
    if (!editingLesson?.id) return;

    const title = String(lessonEditValues.title || '').trim();
    const chapter = String(lessonEditValues.chapter || '').trim();
    const contentType = String(lessonEditValues.contentType || '').trim().toLowerCase();
    const gradeId = String(lessonEditValues.gradeId || '').trim();
    const subjectId = String(lessonEditValues.subjectId || '').trim();
    const description = String(lessonEditValues.description || '').trim();

    if (!title || !chapter || !gradeId || !subjectId) {
      setClassActionError('Title, chapter, grade and subject are required to update lesson.');
      return;
    }

    const payload = {
      title,
      chapter,
      contentType,
      gradeId,
      subjectId,
      description: description || undefined,
    };

    updateLessonMutation.mutate(
      { lessonId: editingLesson.id, payload },
      {
        onSuccess: async () => {
          await Swal.fire({
            title: 'Updated',
            text: 'Lesson updated successfully.',
            icon: 'success',
            confirmButtonColor: '#1f3f93',
          });
        },
        onError: async (error) => {
          const status = error?.response?.status;
          const message = error?.response?.data?.message || error?.message || 'Failed to update lesson';
          await Swal.fire({
            title: 'Update Failed',
            text: status ? `(${status}) ${message}` : message,
            icon: 'error',
            confirmButtonColor: '#1f3f93',
          });
        },
      }
    );
  };

  const handleDeleteLesson = async (lesson) => {
    const lessonId = String(lesson?.id || '').trim();
    if (!lessonId) {
      await Swal.fire({
        title: 'Delete Failed',
        text: 'Lesson id is missing.',
        icon: 'error',
        confirmButtonColor: '#1f3f93',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Delete Lesson?',
      text: `Are you sure you want to delete "${lesson?.title || 'this lesson'}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#1f3f93',
    });
    if (!result.isConfirmed) return;

    deleteLessonMutation.mutate(lessonId, {
      onSuccess: async () => {
        await Swal.fire({
          title: 'Deleted',
          text: 'Lesson deleted successfully.',
          icon: 'success',
          confirmButtonColor: '#1f3f93',
        });
      },
      onError: async (error) => {
        const status = error?.response?.status;
        const message = error?.response?.data?.message || error?.message || 'Failed to delete lesson';
        await Swal.fire({
          title: 'Delete Failed',
          text: status ? `(${status}) ${message}` : message,
          icon: 'error',
          confirmButtonColor: '#1f3f93',
        });
      },
    });
  };

  const handleDownloadLesson = (lesson) => {
    const downloadUrl = resolveLessonDownloadUrl(lesson);
    if (!downloadUrl) {
      Swal.fire({
        title: 'Download Unavailable',
        text: 'No file is attached to this lesson.',
        icon: 'info',
        confirmButtonColor: '#1f3f93',
      });
      return;
    }

    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
  };

  const formatAssignmentDueAt = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toISOString().slice(0, 16).replace('T', ' ');
  };

  const resolveAssignmentSubjectName = (assignment) => {
    const subjectId = String(assignment?.subjectId || '').trim();
    const subjectText = String(assignment?.subject || '').trim();
    if (subjectId && subjectNameById.has(subjectId)) return subjectNameById.get(subjectId);
    if (subjectText && !looksLikeId(subjectText)) return subjectText;
    if (subjectText && subjectNameById.has(subjectText)) return subjectNameById.get(subjectText);
    return 'N/A';
  };

  const resolveAssignmentGradeName = (assignment) => {
    const gradeId = String(assignment?.gradeId || '').trim();
    const gradeText = String(assignment?.gradeLevel || '').trim();
    if (gradeId && gradeNameById.has(gradeId)) return gradeNameById.get(gradeId);
    if (gradeText && !looksLikeId(gradeText)) return gradeText;
    if (gradeText && gradeNameById.has(gradeText)) return gradeNameById.get(gradeText);
    return 'N/A';
  };

  const resolveAssignmentStatus = (assignment) => {
    const derived = String(assignment?.derivedStatus || '').trim().toLowerCase();
    if (['active', 'upcoming', 'closed', 'draft'].includes(derived)) return derived;
    const status = String(assignment?.status || '').trim().toLowerCase();
    if (status === 'closed' || status === 'draft') return status;
    return 'active';
  };

  const assignmentStatusPillClass = (status) => {
    if (status === 'active') return 'bg-[#daf6e6] text-[#008a3d]';
    if (status === 'upcoming') return 'bg-[#e8f1ff] text-[#1a5cff]';
    if (status === 'closed') return 'bg-[#f4f0d0] text-[#9f7a00]';
    return 'bg-[#eef2f9] text-[#5f79af]';
  };

  const prettyStatus = (status) => {
    const value = String(status || '').trim().toLowerCase();
    if (!value) return 'Unknown';
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const handleAssignmentSubmissions = async (assignment) => {
    const assignmentId = String(assignment?.id || '').trim();
    if (!assignmentId) return;

    setIsAssignmentSubmissionsOpen(true);
    setIsAssignmentSubmissionsLoading(true);
    setAssignmentSubmissionsData({
      assignment,
      submissions: [],
    });

    try {
      const payload = await getAssignmentSubmissions(assignmentId);
      setAssignmentSubmissionsData({
        assignment: {
          ...(assignment || {}),
          ...(payload?.assignment || {}),
        },
        submissions: Array.isArray(payload?.submissions) ? payload.submissions : [],
      });
    } catch (error) {
      setIsAssignmentSubmissionsOpen(false);
      setAssignmentSubmissionsData({ assignment: null, submissions: [] });
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.message || 'Failed to load submissions';
      await Swal.fire({
        title: 'Request Failed',
        text: status ? `(${status}) ${message}` : message,
        icon: 'error',
        confirmButtonColor: '#1f3f93',
      });
    } finally {
      setIsAssignmentSubmissionsLoading(false);
    }
  };

  const closeAssignmentSubmissionsModal = () => {
    if (isAssignmentSubmissionsLoading) return;
    setIsAssignmentSubmissionsOpen(false);
    setAssignmentSubmissionsData({ assignment: null, submissions: [] });
  };

  const submissionBadgeMeta = (submission) => {
    const score = Number(submission?.grade?.score);
    const letter = String(submission?.grade?.letter || '').trim();
    if (Number.isFinite(score)) {
      return {
        label: letter ? `Graded - ${letter}` : 'Graded',
        className: 'bg-[#daf6e6] text-[#008a3d]',
      };
    }

    const status = String(submission?.status || '').trim().toLowerCase();
    if (status === 'submitted') {
      return {
        label: 'Needs Grading',
        className: 'bg-[#f8efc9] text-[#9f7a00]',
      };
    }

    return {
      label: 'Not Submitted',
      className: 'bg-[#ffe5e5] text-[#d32f2f]',
    };
  };

  const handleEditAssignment = (assignment) => {
    const assignmentId = String(assignment?.id || '').trim();
    if (!assignmentId) return;

    const due = splitDueAt(assignment?.dueAt);
    const existingFiles = Array.isArray(assignment?.attachments) ? assignment.attachments : [];

    setEditingAssignment(assignment);
    setAssignmentEditValues({
      title: String(assignment?.title || ''),
      description: String(assignment?.description || ''),
      dueDate: due.dueDate,
      dueTime: due.dueTime,
      points: String(Number(assignment?.points || 0) || ''),
      lateAllowed: Boolean(assignment?.lateAllowed),
      status: String(assignment?.status || resolveAssignmentStatus(assignment) || 'active')
        .trim()
        .toLowerCase(),
      files: [],
    });
    setExistingAssignmentFiles(existingFiles);
    setRemovedAssignmentFiles([]);
    setClassActionError('');
    setIsEditAssignmentOpen(true);
  };

  const closeEditAssignmentModal = () => {
    if (updateAssignmentMutation.isPending) return;
    setIsEditAssignmentOpen(false);
    setEditingAssignment(null);
    setExistingAssignmentFiles([]);
    setRemovedAssignmentFiles([]);
    setAssignmentEditValues({
      title: '',
      description: '',
      dueDate: '',
      dueTime: '',
      points: '',
      lateAllowed: false,
      status: 'active',
      files: [],
    });
  };

  const removeExistingAssignmentFile = (file) => {
    const url = String(file?.url || '').trim();
    const key = String(file?.storageKey || '').trim();
    setRemovedAssignmentFiles((prev) => [...prev, { url, storageKey: key }]);
    setExistingAssignmentFiles((prev) =>
      prev.filter(
        (item) =>
          !(
            String(item?.url || '').trim() === url &&
            String(item?.storageKey || '').trim() === key
          )
      )
    );
  };

  const handleUpdateAssignment = (event) => {
    event.preventDefault();
    if (!editingAssignment?.id) return;

    const title = String(assignmentEditValues.title || '').trim();
    const description = String(assignmentEditValues.description || '').trim();
    const dueDate = String(assignmentEditValues.dueDate || '').trim();
    const dueTime = String(assignmentEditValues.dueTime || '').trim();
    const points = String(assignmentEditValues.points || '').trim();
    const status = String(assignmentEditValues.status || '').trim().toLowerCase();
    const files = Array.isArray(assignmentEditValues.files) ? assignmentEditValues.files : [];

    if (!title || !dueDate || !points) {
      setClassActionError('Title, due date and points are required.');
      return;
    }

    const removeAttachmentUrls = removedAssignmentFiles
      .map((item) => String(item?.url || '').trim())
      .filter(Boolean);
    const removeAttachmentKeys = removedAssignmentFiles
      .map((item) => String(item?.storageKey || '').trim())
      .filter(Boolean);

    updateAssignmentMutation.mutate(
      {
        assignmentId: editingAssignment.id,
        payload: {
          title,
          description,
          dueDate,
          dueTime: dueTime || undefined,
          points,
          lateAllowed: Boolean(assignmentEditValues.lateAllowed),
          status: ['active', 'closed', 'draft'].includes(status) ? status : 'active',
          removeAttachmentUrls,
          removeAttachmentKeys,
          files,
        },
      },
      {
        onSuccess: async () => {
          closeEditAssignmentModal();
          await Swal.fire({
            title: 'Updated',
            text: 'Assignment updated successfully.',
            icon: 'success',
            confirmButtonColor: '#1f3f93',
          });
        },
        onError: async (error) => {
          const statusCode = error?.response?.status;
          const message =
            error?.response?.data?.message || error?.message || 'Failed to update assignment';
          await Swal.fire({
            title: 'Update Failed',
            text: statusCode ? `(${statusCode}) ${message}` : message,
            icon: 'error',
            confirmButtonColor: '#1f3f93',
          });
        },
      }
    );
  };

  const handleCloseAssignment = async (assignment) => {
    const assignmentId = String(assignment?.id || '').trim();
    if (!assignmentId) return;
    const status = resolveAssignmentStatus(assignment);
    if (status === 'closed') return;

    const result = await Swal.fire({
      title: 'Close Assignment?',
      text: `Are you sure you want to close "${assignment?.title || 'this assignment'}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Close',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#1f3f93',
    });
    if (!result.isConfirmed) return;

    updateAssignmentMutation.mutate(
      { assignmentId, payload: { status: 'closed' } },
      {
        onSuccess: async () => {
          await Swal.fire({
            title: 'Closed',
            text: 'Assignment is now closed.',
            icon: 'success',
            confirmButtonColor: '#1f3f93',
          });
        },
      }
    );
  };

  const handleDeleteAssignment = async (assignment) => {
    const assignmentId = String(assignment?.id || '').trim();
    if (!assignmentId) return;

    const result = await Swal.fire({
      title: 'Delete Assignment?',
      text: `Are you sure you want to delete "${assignment?.title || 'this assignment'}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#1f3f93',
    });
    if (!result.isConfirmed) return;

    deleteAssignmentMutation.mutate(assignmentId, {
      onSuccess: async () => {
        await Swal.fire({
          title: 'Deleted',
          text: 'Assignment deleted successfully.',
          icon: 'success',
          confirmButtonColor: '#1f3f93',
        });
      },
    });
  };

  const openCreateAssignmentModal = () => {
    if (assignmentClassOptions.length === 0) {
      Swal.fire({
        title: 'No Valid Class Found',
        text: 'No class has both grade and subject references. Please update class first.',
        icon: 'warning',
        confirmButtonColor: '#1f3f93',
      });
      return;
    }

    setClassActionError('');
    setAssignmentFormValues({
      classId: String(assignmentClassOptions?.[0]?.id || '').trim(),
      title: '',
      description: '',
      dueDate: '',
      dueTime: '',
      points: '',
      files: [],
    });
    setIsCreateAssignmentOpen(true);
  };

  const closeCreateAssignmentModal = () => {
    if (createAssignmentMutation.isPending) return;
    setIsCreateAssignmentOpen(false);
  };

  const handleAssignmentFormChange = (key, value) => {
    setAssignmentFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreateAssignment = (event) => {
    event.preventDefault();
    setClassActionError('');

    const classId = String(assignmentFormValues.classId || '').trim();
    const title = String(assignmentFormValues.title || '').trim();
    const description = String(assignmentFormValues.description || '').trim();
    const dueDate = String(assignmentFormValues.dueDate || '').trim();
    const dueTime = String(assignmentFormValues.dueTime || '').trim();
    const points = String(assignmentFormValues.points || '').trim();
    const files = Array.isArray(assignmentFormValues.files) ? assignmentFormValues.files : [];

    if (!classId || !title || !dueDate || !points) {
      setClassActionError('Class, title, due date and points are required.');
      return;
    }

    const selectedClass = assignmentClassOptions.find((item) => item.id === classId);
    if (!selectedClass?.gradeId || !selectedClass?.subjectId) {
      setClassActionError('Selected class is missing grade/subject references. Please update class first.');
      return;
    }

    createAssignmentMutation.mutate(
      {
        classId,
        title,
        description: description || undefined,
        dueDate,
        dueTime: dueTime || undefined,
        points,
        files,
      },
      {
        onSuccess: async () => {
          await Swal.fire({
            title: 'Created',
            text: 'Assignment created successfully.',
            icon: 'success',
            confirmButtonColor: '#1f3f93',
          });
        },
        onError: async (error) => {
          const status = error?.response?.status;
          const message = error?.response?.data?.message || error?.message || 'Failed to create assignment';
          await Swal.fire({
            title: 'Create Failed',
            text: status ? `(${status}) ${message}` : message,
            icon: 'error',
            confirmButtonColor: '#1f3f93',
          });
        },
      }
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="w-full max-w-[430px] rounded-[10px] border border-[#d6e3fb] bg-white p-1">
          <div className="grid grid-cols-3 gap-1">
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`h-10 rounded-md text-sm font-semibold ${
                  activeTab === tab ? 'bg-[#1f3f93] text-white' : 'text-[#17367a]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'Classes' && (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#1f3f93] px-5 font-semibold leading-none text-white"
          >
            <FiPlus size={16} />
            Create Class
          </button>
        )}
      </div>

      {classActionError && (
        <div className="rounded-[10px] border border-[#f5d0d0] bg-[#fff5f5] p-3 text-sm text-red-600">
          {classActionError}
        </div>
      )}

      {activeTab === 'Classes' && (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {isClassesLoading && (
          <div className="rounded-[10px] border border-[#d6e3fb] bg-white p-4 text-sm text-[#5f79af]">
            Loading classes...
          </div>
        )}
        {!isClassesLoading && isClassesError && (
          <div className="rounded-[10px] border border-[#f5d0d0] bg-[#fff5f5] p-4 text-sm text-red-600">
            Failed to load classes from backend.
          </div>
        )}
        {!isClassesLoading && !isClassesError && classes.length === 0 && (
          <div className="rounded-[10px] border border-[#d6e3fb] bg-white p-4 text-sm text-[#5f79af]">
            No classes found.
          </div>
        )}

        {classesWithFilteredSchedule.map((item) => {
          const displayStudents = Number(item.students || 0);
          return (
          <article
            key={item.id}
            className="rounded-[10px] border border-[#d6e3fb] bg-white p-4 text-[#17367a]"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="m-0 text-[20px] font-semibold leading-none text-[#1f3f93]">
                  {item.className || `${item.subject} ${item.grade}`}
                </h3>
                <p className="mt-2 text-sm text-[#5f79af]">{item.grade}</p>
              </div>
              <span className="rounded-full bg-[#1f3f93] px-3 py-1 text-xs font-semibold text-white">
                {item.subject}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#5f79af]">Students</span>
                <strong>{displayStudents}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5f79af]">Teacher</span>
                <strong>{item.teacherName || item.teacher || 'Not assigned'}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5f79af]">Lessons</span>
                <strong>{item.lessons}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5f79af]">Assignments</span>
                <strong>{item.assignments}</strong>
              </div>
            </div>

            <div className="mt-4 border-t border-[#e2ecff] pt-3">
              <p className="mb-2 text-sm text-[#5f79af]">Assigned Teacher:</p>
              <span className="rounded-md border border-[#c8daf8] bg-[#eef4ff] px-2 py-1 text-xs text-[#1f4ca8]">
                {item.teacherName || item.teacher || 'Not assigned'}
              </span>
            </div>

            <div className="mt-4 border-t border-[#e2ecff] pt-3">
              <p className="mb-2 text-sm text-[#5f79af]">Schedule:</p>
              {Array.isArray(item.schedule) && item.schedule.length > 0 ? (
                <div className="space-y-2">
                  {item.schedule.map((slot) => (
                    <div
                      key={slot.id}
                      className="rounded-md border border-[#d6e3fb] bg-[#f8fbff] px-3 py-2 text-xs text-[#1f3f93]"
                    >
                      {formatScheduleLabel(slot)}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#6f84b4]">No schedule added yet.</p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 border-t border-[#e2ecff] pt-3">
              <button
                type="button"
                onClick={() => handleDeleteClass(item)}
                disabled={deleteClassMutation.isPending}
                className="inline-flex h-9 items-center justify-center rounded-md bg-[#fff3f3] text-[#e10000]"
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          </article>
          );
        })}
      </div>
      )}

      {activeTab === 'Content Library' && (
        <div className="space-y-4">
          <section className="rounded-[10px] border border-[#d6e3fb] bg-white p-4">
            <h3 className="text-[24px] font-semibold text-[#1f3f93]">Content Stats</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'Lessons', value: Number(contentStats?.lessons || 0) },
                { label: 'Videos', value: Number(contentStats?.videos || 0) },
                { label: 'Documents', value: Number(contentStats?.documents || 0) },
                { label: 'Assignments', value: Number(contentStats?.assignments || 0) },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-[#d6e3fb] bg-[#f8fbff] px-3 py-2"
                >
                  <p className="text-xs text-[#5f79af]">{item.label}</p>
                  <p className="text-2xl font-semibold text-[#1f3f93]">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[10px] border border-[#d6e3fb] bg-white p-4">
            <h3 className="text-[32px] font-semibold text-[#1f3f93]">Upload New Content</h3>

            <div
              role="button"
              tabIndex={0}
              onClick={openFilePicker}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openFilePicker();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragOver(false);
                const file = event.dataTransfer?.files?.[0];
                handlePickedFile(file);
              }}
              className={`mt-4 rounded-[12px] border-2 border-dashed p-8 text-center ${
                isDragOver ? 'border-[#1f3f93] bg-[#eef4ff]' : 'border-[#cfe0ff] bg-[#f8fbff]'
              }`}
            >
              <FiUpload size={42} className="mx-auto text-[#5b9cff]" />
              <p className="mt-3 text-[32px] text-[#17367a]">
                Drag and drop files here, or click to browse
              </p>
              <p className="mt-1 text-[22px] text-[#6f84b4]">Supports PDF, MP4, DOCX, and more</p>
              <label
                htmlFor={LESSON_FILE_INPUT_ID}
                onClick={(event) => event.stopPropagation()}
                className="mt-4 inline-flex h-10 cursor-pointer items-center rounded-[10px] bg-[#1f3f93] px-6 text-[22px] font-semibold text-white"
              >
                Choose Files
              </label>
              {lessonValues.file && (
                <p className="mt-3 text-[22px] text-[#1f3f93]">Selected: {lessonValues.file.name}</p>
              )}
              <input
                id={LESSON_FILE_INPUT_ID}
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,video/*,.mp4,.mov,.mkv,.avi,.webm,.doc,.docx,.ppt,.pptx,.txt,.xls,.xlsx"
                onClick={(event) => {
                  event.currentTarget.value = '';
                }}
                onChange={(event) => handlePickedFile(event.target.files?.[0])}
              />
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleUploadLesson}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <input
                  type="text"
                  value={lessonValues.title}
                  onChange={(event) =>
                    setLessonValues((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Title"
                  className="h-11 rounded-[10px] border border-[#d6e3fb] px-3 text-sm text-[#17367a]"
                />
                <input
                  type="text"
                  value={lessonValues.chapter}
                  onChange={(event) =>
                    setLessonValues((prev) => ({ ...prev, chapter: event.target.value }))
                  }
                  placeholder="Chapter"
                  className="h-11 rounded-[10px] border border-[#d6e3fb] px-3 text-sm text-[#17367a]"
                />
                <select
                  value={lessonValues.contentType}
                  onChange={(event) =>
                    setLessonValues((prev) => ({
                      ...prev,
                      contentType: event.target.value,
                      file: null,
                      textContent: event.target.value === 'text' ? prev.textContent : '',
                      quizJson: event.target.value === 'quiz' ? prev.quizJson : '',
                    }))
                  }
                  className="h-11 rounded-[10px] border border-[#d6e3fb] px-3 text-sm text-[#17367a]"
                >
                  <option value="pdf">PDF Document</option>
                  <option value="video">Video Lesson</option>
                  <option value="text">Text Content</option>
                  <option value="quiz">Quiz/Test</option>
                </select>
                <select
                  value={lessonValues.gradeId}
                  onChange={(event) =>
                    setLessonValues((prev) => ({ ...prev, gradeId: event.target.value }))
                  }
                  className="h-11 rounded-[10px] border border-[#d6e3fb] px-3 text-sm text-[#17367a]"
                >
                  <option value="">Select Grade</option>
                  {gradeOptions.map((grade) => (
                    <option key={grade.id} value={grade.id}>
                      {grade.label}
                    </option>
                  ))}
                </select>
                <select
                  value={lessonValues.subjectId}
                  onChange={(event) =>
                    setLessonValues((prev) => ({ ...prev, subjectId: event.target.value }))
                  }
                  className="h-11 rounded-[10px] border border-[#d6e3fb] px-3 text-sm text-[#17367a]"
                >
                  <option value="">Select Subject</option>
                  {subjectCatalog.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <textarea
                  rows={3}
                  value={lessonValues.description}
                  onChange={(event) =>
                    setLessonValues((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Description (optional)"
                  className="w-full rounded-[10px] border border-[#d6e3fb] px-3 py-2 text-sm text-[#17367a]"
                />
                {lessonValues.contentType === 'text' && (
                  <textarea
                    rows={3}
                    value={lessonValues.textContent}
                    onChange={(event) =>
                      setLessonValues((prev) => ({ ...prev, textContent: event.target.value }))
                    }
                    placeholder="Text content"
                    className="w-full rounded-[10px] border border-[#d6e3fb] px-3 py-2 text-sm text-[#17367a]"
                  />
                )}
                {lessonValues.contentType === 'quiz' && (
                  <textarea
                    rows={3}
                    value={lessonValues.quizJson}
                    onChange={(event) =>
                      setLessonValues((prev) => ({ ...prev, quizJson: event.target.value }))
                    }
                    placeholder='Quiz JSON: {"questions":[...]}'
                    className="w-full rounded-[10px] border border-[#d6e3fb] px-3 py-2 text-sm text-[#17367a]"
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={uploadLessonMutation.isPending}
                className="h-11 rounded-[10px] bg-[#1f3f93] px-5 text-sm font-semibold leading-none text-white disabled:opacity-60 md:w-[220px]"
              >
                {uploadLessonMutation.isPending ? 'Uploading...' : 'Upload Lesson'}
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-[10px] border border-[#d6e3fb] bg-white">
            <div className="border-b border-[#d6e3fb] px-4 py-3">
              <h3 className="text-[30px] font-semibold text-[#1f3f93]">Recent Uploads</h3>
            </div>

            {isRecentLessonsLoading && (
              <div className="px-4 py-4 text-sm text-[#5f79af]">Loading recent uploads...</div>
            )}

            {!isRecentLessonsLoading && isRecentLessonsError && (
              <div className="px-4 py-4 text-sm text-red-600">
                Failed to load recent uploads from backend.
              </div>
            )}

            {!isRecentLessonsLoading && !isRecentLessonsError && (
              <div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                  <thead>
                    <tr className="bg-[#f3f8ff] text-left text-[13px] font-semibold text-[#1f3f93]">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Grade</th>
                      <th className="px-4 py-3">Uploaded By</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLessons.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-sm text-[#5f79af]">
                          No recent uploads found.
                        </td>
                      </tr>
                    )}

                    {recentLessons.map((lesson) => (
                      <tr key={lesson.id} className="border-t border-[#e6eeff] text-sm text-[#17367a]">
                        <td className="px-4 py-3 font-semibold">{lesson.title || 'Untitled'}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-[#e8f1ff] px-2 py-1 text-xs font-semibold text-[#1f3f93]">
                            {getLessonTypeLabel(lesson.contentType)}
                          </span>
                        </td>
                        <td className="px-4 py-3">{resolveSubjectName(lesson)}</td>
                        <td className="px-4 py-3">{resolveGradeName(lesson)}</td>
                        <td className="px-4 py-3">{lesson.uploadedBy || 'N/A'}</td>
                        <td className="px-4 py-3">{formatLessonDate(lesson.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 text-[#1f3f93]">
                            <button
                              type="button"
                              className="disabled:opacity-40"
                              title="Download"
                              disabled={!lesson.fileUrl}
                              onClick={() => handleDownloadLesson(lesson)}
                            >
                              <FiDownload size={15} />
                            </button>
                            <button
                              type="button"
                              className="disabled:opacity-40"
                              title="Edit"
                              onClick={() => openLessonEditModal(lesson)}
                            >
                              <FiEdit2 size={15} />
                            </button>
                            <button
                              type="button"
                              className="text-[#e10000] disabled:opacity-40"
                              title="Delete"
                              onClick={() => handleDeleteLesson(lesson)}
                              disabled={deleteLessonMutation.isPending}
                            >
                              <FiTrash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-[#e6eeff] px-4 py-3 text-sm text-[#5f79af]">
                  <p>
                    Page {recentLessonsPagination.page} of {recentLessonsPagination.totalPages} -
                    {' '}Total {recentLessonsPagination.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRecentLessonsPage((prev) => Math.max(prev - 1, 1))}
                      disabled={recentLessonsPage <= 1 || isRecentLessonsLoading}
                      className="h-8 rounded-md border border-[#d6e3fb] px-3 text-[#1f3f93] disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRecentLessonsPage((prev) =>
                          Math.min(prev + 1, Number(recentLessonsPagination.totalPages || 1))
                        )
                      }
                      disabled={
                        recentLessonsPage >= Number(recentLessonsPagination.totalPages || 1) ||
                        isRecentLessonsLoading
                      }
                      className="h-8 rounded-md border border-[#d6e3fb] px-3 text-[#1f3f93] disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

        </div>
      )}

      {activeTab === 'Assignments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={openCreateAssignmentModal}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#1f3f93] px-4 font-semibold text-white"
            >
              <FiPlus size={16} />
              Create Assignment
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { key: 'active', label: 'Active', value: Number(assignmentsStats?.active || 0) },
              { key: 'upcoming', label: 'Upcoming', value: Number(assignmentsStats?.upcoming || 0) },
              { key: 'closed', label: 'Closed', value: Number(assignmentsStats?.closed || 0) },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setAssignmentStatusFilter(item.key);
                  setAssignmentsPage(1);
                }}
                className={`rounded-[10px] border bg-white p-4 text-left shadow-sm ${
                  assignmentStatusFilter === item.key
                    ? 'border-[#1f3f93] ring-1 ring-[#1f3f93]'
                    : 'border-[#d6e3fb]'
                }`}
              >
                <p className="text-[24px] font-semibold leading-none text-[#1f3f93]">
                  {isAssignmentsStatsLoading ? '-' : item.value}
                </p>
                <p className="mt-2 text-sm text-[#5f79af]">{item.label}</p>
              </button>
            ))}
          </div>

          <div className="rounded-[10px] border border-[#d6e3fb] bg-white">
            <div className="flex items-center justify-between border-b border-[#e6eeff] px-4 py-3 text-sm">
              <p className="text-[#1f3f93]">
                Showing <strong>{prettyStatus(assignmentStatusFilter)}</strong> assignments
              </p>
              <button
                type="button"
                onClick={() => {
                  setAssignmentStatusFilter('all');
                  setAssignmentsPage(1);
                }}
                className="rounded-md border border-[#d6e3fb] px-3 py-1 text-[#1f3f93]"
              >
                Show All
              </button>
            </div>

            <div className="space-y-3 p-3">
              {isAssignmentsLoading && (
                <div className="rounded-[10px] border border-[#d6e3fb] bg-white p-4 text-sm text-[#5f79af]">
                  Loading assignments...
                </div>
              )}

              {!isAssignmentsLoading && isAssignmentsError && (
                <div className="rounded-[10px] border border-[#f5d0d0] bg-[#fff5f5] p-4 text-sm text-red-600">
                  Failed to load assignments from backend.
                </div>
              )}

              {!isAssignmentsLoading && !isAssignmentsError && assignments.length === 0 && (
                <div className="rounded-[10px] border border-[#d6e3fb] bg-white p-4 text-sm text-[#5f79af]">
                  No assignments found.
                </div>
              )}

              {!isAssignmentsLoading &&
                !isAssignmentsError &&
                assignments.map((assignment) => {
                  const status = resolveAssignmentStatus(assignment);
                  const submittedCount = Number(assignment?.submittedCount || 0);
                  const totalStudents = Number(assignment?.totalStudents || 0);
                  const progress = Math.max(0, Math.min(100, Number(assignment?.progress || 0)));
                  const progressLabel = `${submittedCount}/${totalStudents || 0} submitted`;

                  return (
                    <article
                      key={assignment.id}
                      className="rounded-[10px] border border-[#d6e3fb] bg-white p-4 text-[#17367a]"
                    >
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px]">
                        <div>
                          <h3 className="text-[32px] font-semibold leading-none text-[#1f3f93]">
                            {assignment.title || 'Untitled Assignment'}
                          </h3>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                            <span
                              className={`rounded-full px-3 py-1 ${assignmentStatusPillClass(status)}`}
                            >
                              {prettyStatus(status)}
                            </span>
                            <span className="rounded-full bg-[#e8f1ff] px-3 py-1 text-[#1f3f93]">
                              {resolveAssignmentSubjectName(assignment)}
                            </span>
                            <span className="rounded-full bg-[#eef2f9] px-3 py-1 text-[#5f79af]">
                              {resolveAssignmentGradeName(assignment)}
                            </span>
                          </div>

                          <p className="mt-3 text-sm text-[#5f79af]">
                            {assignment.description || 'No description provided.'}
                          </p>

                          <div className="mt-3">
                            <p className="text-sm font-semibold text-[#17367a]">Attachments</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {Array.isArray(assignment?.attachments) &&
                              assignment.attachments.length > 0 ? (
                                assignment.attachments.map((file, index) => {
                                  const fileUrl = resolveLessonDownloadUrl(file);
                                  const fileName = String(
                                    file?.originalName || file?.storageKey || `Attachment ${index + 1}`
                                  );

                                  if (!fileUrl) {
                                    return (
                                      <span
                                        key={`${String(file?.url || file?.storageKey || index)}`}
                                        className="inline-flex items-center gap-1 rounded-md border border-[#d6e3fb] bg-[#f8fbff] px-2 py-1 text-xs text-[#8aa0cb]"
                                        title={fileName}
                                      >
                                        <FiDownload size={12} />
                                        <span className="max-w-[220px] truncate">{fileName}</span>
                                      </span>
                                    );
                                  }

                                  return (
                                    <a
                                      key={`${String(file?.url || file?.storageKey || index)}`}
                                      href={fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-md border border-[#d6e3fb] bg-[#f8fbff] px-2 py-1 text-xs text-[#1f3f93] hover:bg-[#eef4ff]"
                                      title={`Open ${fileName}`}
                                    >
                                      <FiDownload size={12} />
                                      <span className="max-w-[220px] truncate">{fileName}</span>
                                    </a>
                                  );
                                })
                              ) : (
                                <span className="text-xs text-[#8aa0cb]">No attachments</span>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-[#5f79af] md:grid-cols-3">
                            <p>
                              <strong className="text-[#17367a]">Due:</strong>{' '}
                              {formatAssignmentDueAt(assignment.dueAt)}
                            </p>
                            <p>
                              <strong className="text-[#17367a]">Students:</strong> {totalStudents}
                            </p>
                            <p>
                              <strong className="text-[#17367a]">Points:</strong>{' '}
                              {Number(assignment?.points || 0)}
                            </p>
                          </div>

                          <div className="mt-2 text-sm text-[#5f79af]">
                            Late submissions:{' '}
                            <strong
                              className={
                                assignment?.lateAllowed ? 'text-[#008a3d]' : 'text-[#e10000]'
                              }
                            >
                              {assignment?.lateAllowed ? 'Allowed' : 'Not allowed'}
                            </strong>
                          </div>

                          <div className="mt-4">
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="text-[#5f79af]">Submission Progress</span>
                              <span className="font-semibold text-[#1f3f93]">{progress}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-[#d6e3fb]">
                              <div
                                className="h-2 rounded-full bg-[#1f3f93]"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <p className="mt-1 text-sm font-semibold text-[#17367a]">{progressLabel}</p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => handleAssignmentSubmissions(assignment)}
                            className="h-10 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white"
                          >
                            Submissions
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditAssignment(assignment)}
                            disabled={updateAssignmentMutation.isPending}
                            className="h-10 rounded-[10px] bg-[#eef2f9] text-sm font-semibold text-[#1f3f93] disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCloseAssignment(assignment)}
                            disabled={
                              updateAssignmentMutation.isPending ||
                              resolveAssignmentStatus(assignment) === 'closed'
                            }
                            className="h-10 rounded-[10px] bg-[#f3eec5] text-sm font-semibold text-[#9f7a00] disabled:opacity-50"
                          >
                            Close
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAssignment(assignment)}
                            disabled={deleteAssignmentMutation.isPending}
                            className="h-10 rounded-[10px] bg-[#fff3f3] text-sm font-semibold text-[#e10000] disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#e6eeff] px-4 py-3 text-sm text-[#5f79af]">
              <p>
                Page {assignmentsPagination.page} of {assignmentsPagination.totalPages} - Total{' '}
                {assignmentsPagination.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAssignmentsPage((prev) => Math.max(prev - 1, 1))}
                  disabled={assignmentsPage <= 1 || isAssignmentsLoading}
                  className="h-8 rounded-md border border-[#d6e3fb] px-3 text-[#1f3f93] disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAssignmentsPage((prev) =>
                      Math.min(prev + 1, Number(assignmentsPagination.totalPages || 1))
                    )
                  }
                  disabled={
                    assignmentsPage >= Number(assignmentsPagination.totalPages || 1) ||
                    isAssignmentsLoading
                  }
                  className="h-8 rounded-md border border-[#d6e3fb] px-3 text-[#1f3f93] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCreateAssignmentOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[520px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-4" onSubmit={handleCreateAssignment}>
              <div className="flex items-center justify-between">
                <h2 className="text-[24px] font-semibold text-[#1f3f93]">Create New Assignment</h2>
                <button
                  type="button"
                  onClick={closeCreateAssignmentModal}
                  className="text-[#6f84b4] hover:text-[#1f3f93]"
                >
                  x
                </button>
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Class *</label>
                <select
                  value={assignmentFormValues.classId}
                  onChange={(event) => handleAssignmentFormChange('classId', event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                >
                  <option value="">Select class</option>
                  {assignmentClassOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {assignmentClassOptions.length === 0 && (
                  <p className="mt-1 text-xs text-red-600">
                    No eligible class found. Classes must have grade and subject references.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">
                  Assignment Title *
                </label>
                <input
                  type="text"
                  value={assignmentFormValues.title}
                  onChange={(event) => handleAssignmentFormChange('title', event.target.value)}
                  placeholder="e.g., Math Homework"
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Description</label>
                <textarea
                  rows={3}
                  value={assignmentFormValues.description}
                  onChange={(event) => handleAssignmentFormChange('description', event.target.value)}
                  placeholder="Describe the assignment content..."
                  className="w-full rounded-lg border border-[#d6e3fb] px-3 py-2 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Due Date *</label>
                  <input
                    type="date"
                    value={assignmentFormValues.dueDate}
                    onChange={(event) => handleAssignmentFormChange('dueDate', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Due Time</label>
                  <input
                    type="time"
                    value={assignmentFormValues.dueTime}
                    onChange={(event) => handleAssignmentFormChange('dueTime', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Points *</label>
                <input
                  type="number"
                  min="1"
                  value={assignmentFormValues.points}
                  onChange={(event) => handleAssignmentFormChange('points', event.target.value)}
                  placeholder="e.g., 100"
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Attach Files</label>
                <input
                  type="file"
                  multiple
                  onChange={(event) =>
                    handleAssignmentFormChange('files', Array.from(event.target.files || []))
                  }
                  className="block w-full rounded-lg border border-dashed border-[#c8daf8] bg-[#f8fbff] px-3 py-3 text-sm text-[#4f6695]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-[1fr_220px]">
                <button
                  type="button"
                  onClick={closeCreateAssignmentModal}
                  className="h-12 rounded-[10px] bg-[#f1f3f8] text-sm font-semibold text-[#5b739f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAssignmentMutation.isPending}
                  className="h-12 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {createAssignmentMutation.isPending ? 'Creating...' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAssignmentSubmissionsOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/35 p-3">
          <div className="w-full max-w-[980px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[42px] font-semibold leading-none text-[#1f3f93]">
                  {String(
                    assignmentSubmissionsData?.assignment?.title || 'Assignment Submissions'
                  )}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span
                    className={`rounded-full px-3 py-1 ${assignmentStatusPillClass(
                      resolveAssignmentStatus(assignmentSubmissionsData?.assignment)
                    )}`}
                  >
                    {prettyStatus(resolveAssignmentStatus(assignmentSubmissionsData?.assignment))}
                  </span>
                  <span className="rounded-full bg-[#e8f1ff] px-3 py-1 text-[#1f3f93]">
                    {resolveAssignmentSubjectName(assignmentSubmissionsData?.assignment)}
                  </span>
                  <span className="rounded-full bg-[#eef2f9] px-3 py-1 text-[#5f79af]">
                    {resolveAssignmentGradeName(assignmentSubmissionsData?.assignment)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAssignmentSubmissionsModal}
                className="text-[28px] leading-none text-[#6f84b4] hover:text-[#1f3f93]"
              >
                x
              </button>
            </div>

            {isAssignmentSubmissionsLoading ? (
              <div className="rounded-[10px] border border-[#d6e3fb] bg-[#f8fbff] p-5 text-sm text-[#5f79af]">
                Loading submissions...
              </div>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-[10px] border border-[#d6efd9] bg-[#eefaf2] p-4">
                    <p className="text-sm text-[#2b7a49]">Submitted</p>
                    <p className="mt-2 text-[38px] font-semibold leading-none text-[#008a3d]">
                      {Array.isArray(assignmentSubmissionsData?.submissions)
                        ? assignmentSubmissionsData.submissions.length
                        : 0}
                    </p>
                  </div>
                  <div className="rounded-[10px] border border-[#efe0b0] bg-[#fcf6dd] p-4">
                    <p className="text-sm text-[#9f7a00]">Pending</p>
                    <p className="mt-2 text-[38px] font-semibold leading-none text-[#c48a00]">
                      {Math.max(
                        0,
                        Number(assignmentSubmissionsData?.assignment?.totalStudents || 0) -
                          Number(assignmentSubmissionsData?.submissions?.length || 0)
                      )}
                    </p>
                  </div>
                  <div className="rounded-[10px] border border-[#dae4f8] bg-[#eef4ff] p-4">
                    <p className="text-sm text-[#1f3f93]">Total Students</p>
                    <p className="mt-2 text-[38px] font-semibold leading-none text-[#1a5cff]">
                      {Number(assignmentSubmissionsData?.assignment?.totalStudents || 0)}
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[10px] border border-[#d6e3fb]">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="bg-[#eef4ff] text-sm font-semibold text-[#1f3f93]">
                          <th className="px-4 py-3">Student Name</th>
                          <th className="px-4 py-3">Submitted</th>
                          <th className="px-4 py-3">Grade</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(assignmentSubmissionsData?.submissions || []).map((item, index) => {
                          const score = Number(item?.grade?.score);
                          const points = Number(assignmentSubmissionsData?.assignment?.points || 0);
                          const gradeCell = Number.isFinite(score)
                            ? `${score}/${points || 0}`
                            : 'Pending';
                          const statusMeta = submissionBadgeMeta(item);

                          return (
                            <tr key={String(item?._id || item?.id || index)} className="border-t border-[#d6e3fb] text-sm">
                              <td className="px-4 py-3 font-semibold text-[#17367a]">
                                {String(item?.studentId?.name || 'Unknown')}
                              </td>
                              <td className="px-4 py-3 text-[#5f79af]">{formatDateTime(item?.submittedAt)}</td>
                              <td className="px-4 py-3 font-semibold text-[#1f3f93]">{gradeCell}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                                  {statusMeta.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {!assignmentSubmissionsData?.submissions?.length && (
                          <tr className="border-t border-[#d6e3fb]">
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#5f79af]">
                              No submission data found for this assignment.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeAssignmentSubmissionsModal}
                    className="h-11 rounded-[10px] bg-[#f1f3f8] px-6 text-sm font-semibold text-[#5b739f]"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isEditAssignmentOpen && editingAssignment && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[620px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-4" onSubmit={handleUpdateAssignment}>
              <div className="flex items-center justify-between">
                <h2 className="text-[24px] font-semibold text-[#1f3f93]">Edit Assignment</h2>
                <button
                  type="button"
                  onClick={closeEditAssignmentModal}
                  className="text-[#6f84b4] hover:text-[#1f3f93]"
                >
                  x
                </button>
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">
                  Assignment Title *
                </label>
                <input
                  type="text"
                  value={assignmentEditValues.title}
                  onChange={(event) =>
                    setAssignmentEditValues((prev) => ({ ...prev, title: event.target.value }))
                  }
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={assignmentEditValues.description}
                  onChange={(event) =>
                    setAssignmentEditValues((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#d6e3fb] px-3 py-2 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={assignmentEditValues.dueDate}
                    onChange={(event) =>
                      setAssignmentEditValues((prev) => ({ ...prev, dueDate: event.target.value }))
                    }
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">
                    Due Time
                  </label>
                  <input
                    type="time"
                    value={assignmentEditValues.dueTime}
                    onChange={(event) =>
                      setAssignmentEditValues((prev) => ({ ...prev, dueTime: event.target.value }))
                    }
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">
                    Points *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={assignmentEditValues.points}
                    onChange={(event) =>
                      setAssignmentEditValues((prev) => ({ ...prev, points: event.target.value }))
                    }
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">
                    Status
                  </label>
                  <select
                    value={assignmentEditValues.status}
                    onChange={(event) =>
                      setAssignmentEditValues((prev) => ({ ...prev, status: event.target.value }))
                    }
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  >
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-[#17367a]">
                <input
                  type="checkbox"
                  checked={assignmentEditValues.lateAllowed}
                  onChange={(event) =>
                    setAssignmentEditValues((prev) => ({
                      ...prev,
                      lateAllowed: event.target.checked,
                    }))
                  }
                />
                Allow late submissions
              </label>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">
                  Existing Attachments
                </label>
                <div className="space-y-2">
                  {existingAssignmentFiles.map((file, index) => (
                    <div
                      key={`${String(file?.url || '')}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-[#d6e3fb] px-3 py-2 text-sm"
                    >
                      <span className="truncate text-[#17367a]">
                        {String(file?.originalName || file?.url || `File ${index + 1}`)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeExistingAssignmentFile(file)}
                        className="rounded-md bg-[#fff3f3] px-2 py-1 text-xs font-semibold text-[#e10000]"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {existingAssignmentFiles.length === 0 && (
                    <p className="text-xs text-[#8aa0cb]">No existing attachments.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">
                  Add New Files
                </label>
                <input
                  type="file"
                  multiple
                  onChange={(event) =>
                    setAssignmentEditValues((prev) => ({
                      ...prev,
                      files: Array.from(event.target.files || []),
                    }))
                  }
                  className="block w-full rounded-lg border border-dashed border-[#c8daf8] bg-[#f8fbff] px-3 py-3 text-sm text-[#4f6695]"
                />
                {!!assignmentEditValues.files.length && (
                  <p className="mt-1 text-xs text-[#5f79af]">
                    {assignmentEditValues.files.length} file(s) selected
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-[1fr_220px]">
                <button
                  type="button"
                  onClick={closeEditAssignmentModal}
                  className="h-12 rounded-[10px] bg-[#f1f3f8] text-sm font-semibold text-[#5b739f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateAssignmentMutation.isPending}
                  className="h-12 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {updateAssignmentMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'Classes' && (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-[10px] border border-[#d6e3fb] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[30px] font-semibold text-[#1f3f93]">Subjects</h3>
            <button
              type="button"
              onClick={() => setIsAddSubjectOpen(true)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#1f3f93]"
            >
              <FiPlus size={14} />
              Add Subject
            </button>
          </div>
          <div className="space-y-2">
            {subjectsFromApi.map((subject) => (
              <div
                key={subject.id}
                className="flex items-center justify-between rounded-md border border-[#d6e3fb] bg-[#f8fbff] px-3 py-2 text-[#17367a]"
              >
                <span>
                  {subject.name}
                  <span className="ml-2 text-xs text-[#6f84b4]">
                    {Number(subject?.classCount || 0)} classes
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteSubject(subject)}
                  disabled={deleteSubjectMutation.isPending}
                  className="text-[#e10000] disabled:opacity-50"
                  title="Delete subject"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))}
            {subjectsFromApi.length === 0 && (
              <p className="text-sm text-[#6f84b4]">No subjects available.</p>
            )}
          </div>
        </section>

        <section className="rounded-[10px] border border-[#d6e3fb] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[30px] font-semibold text-[#1f3f93]">Grade Levels</h3>
            <button
              type="button"
              onClick={() => setIsAddGradeOpen(true)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#1f3f93]"
            >
              <FiPlus size={14} />
              Add Grade
            </button>
          </div>
          <div className="space-y-2">
            {gradeOptions.map((grade) => (
              <div
                key={grade.id}
                className="flex items-center justify-between rounded-md border border-[#d6e3fb] bg-[#f8fbff] px-3 py-2 text-[#17367a]"
              >
                <span>
                  {grade.label}
                  <span className="ml-2 text-xs text-[#6f84b4]">
                    {Number(grade?.classCount || 0)} classes
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteGrade(grade)}
                  disabled={deleteGradeMutation.isPending}
                  className="text-[#e10000] disabled:opacity-50"
                  title="Delete grade"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))}
            {gradeOptions.length === 0 && (
              <p className="text-sm text-[#6f84b4]">No grades available.</p>
            )}
          </div>
        </section>
      </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[760px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-4" onSubmit={handleCreateClass}>
              <h2 className="text-[24px] font-semibold text-[#1f3f93]">Create New Class</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Subject</label>
                  <select
                    value={createValues.subject}
                    onChange={(event) =>
                      setCreateValues((prev) => ({ ...prev, subject: event.target.value }))
                    }
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    disabled={isSubjectsLoading || subjectOptions.length === 0}
                  >
                    {subjectOptions.length === 0 && <option value="">No subjects available</option>}
                    {subjectOptions.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Grade</label>
                  <select
                    value={createValues.grade}
                    onChange={(event) =>
                      setCreateValues((prev) => ({ ...prev, grade: event.target.value }))
                    }
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    disabled={isGradesLoading || gradeOptions.length === 0}
                  >
                    {gradeOptions.length === 0 && <option value="">No grades available</option>}
                    {gradeOptions.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Teacher</label>
                  <select
                    value={createValues.teacherId}
                    onChange={(event) =>
                      setCreateValues((prev) => ({ ...prev, teacherId: event.target.value }))
                    }
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    disabled={isTeachersLoading || teacherOptions.length === 0}
                  >
                    {teacherOptions.length === 0 && <option value="">No teachers available</option>}
                    {teacherOptions.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-[1fr_180px]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="h-12 rounded-[10px] bg-[#f1f3f8] text-sm font-semibold text-[#5b739f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    subjectOptions.length === 0 ||
                    gradeOptions.length === 0 ||
                    teacherOptions.length === 0 ||
                    !createValues.teacherId ||
                    createClassMutation.isPending
                  }
                  className="h-12 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {createClassMutation.isPending ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditOpen && editingClass && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[760px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-4" onSubmit={handleUpdateClass}>
              <h2 className="text-[24px] font-semibold text-[#1f3f93]">Edit Class</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Subject</label>
                  <select
                    value={editValues.subject}
                    onChange={(event) =>
                      setEditValues((prev) => ({ ...prev, subject: event.target.value }))
                    }
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    disabled={isSubjectsLoading || subjectOptions.length === 0}
                  >
                    {subjectOptions.length === 0 && <option value="">No subjects available</option>}
                    {subjectOptions.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Grade</label>
                  <select
                    value={editValues.grade}
                    onChange={(event) =>
                      setEditValues((prev) => ({ ...prev, grade: event.target.value }))
                    }
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    disabled={isGradesLoading || gradeOptions.length === 0}
                  >
                    {gradeOptions.length === 0 && <option value="">No grades available</option>}
                    {gradeOptions.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-[1fr_180px]">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditOpen(false);
                    setEditingClass(null);
                  }}
                  className="h-12 rounded-[10px] bg-[#f1f3f8] text-sm font-semibold text-[#5b739f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    subjectOptions.length === 0 ||
                    gradeOptions.length === 0 ||
                    updateClassMutation.isPending
                  }
                  className="h-12 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {updateClassMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddSubjectOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[520px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-4" onSubmit={handleCreateSubject}>
              <h2 className="text-[24px] font-semibold text-[#1f3f93]">Add Subject</h2>
              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Subject Name</label>
                <input
                  type="text"
                  value={newSubjectName}
                  onChange={(event) => setNewSubjectName(event.target.value)}
                  placeholder="e.g. Mathematics"
                  className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-[1fr_180px]">
                <button
                  type="button"
                  onClick={() => setIsAddSubjectOpen(false)}
                  className="h-12 rounded-[10px] bg-[#f1f3f8] text-sm font-semibold text-[#5b739f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubjectMutation.isPending || !newSubjectName.trim()}
                  className="h-12 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {createSubjectMutation.isPending ? 'Creating...' : 'Add Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddGradeOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[520px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-4" onSubmit={handleCreateGrade}>
              <h2 className="text-[24px] font-semibold text-[#1f3f93]">Add Grade</h2>
              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Grade Label</label>
                <input
                  type="text"
                  value={newGradeLabel}
                  onChange={(event) => setNewGradeLabel(event.target.value)}
                  placeholder="e.g. 8th"
                  className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-[1fr_180px]">
                <button
                  type="button"
                  onClick={() => setIsAddGradeOpen(false)}
                  className="h-12 rounded-[10px] bg-[#f1f3f8] text-sm font-semibold text-[#5b739f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createGradeMutation.isPending || !newGradeLabel.trim()}
                  className="h-12 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {createGradeMutation.isPending ? 'Creating...' : 'Add Grade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLessonEditOpen && editingLesson && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[760px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-4" onSubmit={handleUpdateLesson}>
              <h2 className="text-[24px] font-semibold text-[#1f3f93]">Edit Lesson</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Title</label>
                  <input
                    type="text"
                    value={lessonEditValues.title}
                    onChange={(event) =>
                      setLessonEditValues((prev) => ({ ...prev, title: event.target.value }))
                    }
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Chapter</label>
                  <input
                    type="text"
                    value={lessonEditValues.chapter}
                    onChange={(event) =>
                      setLessonEditValues((prev) => ({ ...prev, chapter: event.target.value }))
                    }
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Type</label>
                  <select
                    value={lessonEditValues.contentType}
                    onChange={(event) =>
                      setLessonEditValues((prev) => ({ ...prev, contentType: event.target.value }))
                    }
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  >
                    <option value="pdf">PDF Document</option>
                    <option value="video">Video Lesson</option>
                    <option value="text">Text Content</option>
                    <option value="quiz">Quiz/Test</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Grade</label>
                  <select
                    value={lessonEditValues.gradeId}
                    onChange={(event) =>
                      setLessonEditValues((prev) => ({ ...prev, gradeId: event.target.value }))
                    }
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    disabled={isGradesLoading || gradeOptions.length === 0}
                  >
                    <option value="">Select Grade</option>
                    {gradeOptions.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Subject</label>
                  <select
                    value={lessonEditValues.subjectId}
                    onChange={(event) =>
                      setLessonEditValues((prev) => ({ ...prev, subjectId: event.target.value }))
                    }
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                    disabled={isSubjectsLoading || subjectCatalog.length === 0}
                  >
                    <option value="">Select Subject</option>
                    {subjectCatalog.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={lessonEditValues.description}
                  onChange={(event) =>
                    setLessonEditValues((prev) => ({ ...prev, description: event.target.value }))
                  }
                  className="w-full rounded-lg border border-[#d6e3fb] px-3 py-2 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-[1fr_180px]">
                <button
                  type="button"
                  onClick={() => {
                    setIsLessonEditOpen(false);
                    setEditingLesson(null);
                  }}
                  className="h-12 rounded-[10px] bg-[#f1f3f8] text-sm font-semibold text-[#5b739f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateLessonMutation.isPending}
                  className="h-12 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {updateLessonMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default ClassesContentPage;

