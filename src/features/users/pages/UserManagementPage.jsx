import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import { FiEdit2, FiTrash2, FiUserCheck, FiUserPlus, FiUserX } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { getSubjectsList } from '../../classes/api/classesApi';
import {
  createUser,
  deleteAdminUser,
  getGrades,
  getSubjects,
  updateAdminUser,
  updateAdminUserStatus,
} from '../api/usersApi';
import { useUserStats } from '../hooks/useUserStats';
import { useUsers } from '../hooks/useUsers';

const cards = [
  { key: 'totalStudents', label: 'Total Students', valueClass: 'text-[#1f3f93]' },
  { key: 'totalTeachers', label: 'Total Teachers', valueClass: 'text-[#1f3f93]' },
  { key: 'activeUsers', label: 'Active Users', valueClass: 'text-[#00a04f]' },
  { key: 'inactiveUsers', label: 'Inactive Users', valueClass: 'text-[#e10000]' },
];

const formatValue = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return Number(value).toLocaleString();
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().split('T')[0];
};

const renderAssignedClasses = (classes) => {
  if (!Array.isArray(classes) || classes.length === 0) {
    return <span className="text-xs text-[#7b91be]">N/A</span>;
  }

  const normalized = uniqueListCaseInsensitive(classes);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {normalized.map((item) => (
        <span
          key={`assigned-class-${item}`}
          className="rounded-md border border-[#c8daf8] bg-[#eef4ff] px-2 py-0.5 text-xs text-[#1f4ca8]"
        >
          {item}
        </span>
      ))}
    </div>
  );
};

const getInitials = (name) => {
  if (!name || name === 'N/A') return 'NA';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const normalizeValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (typeof value === 'object') {
    if (value.$oid) return normalizeValue(value.$oid);
    if (value._id) return normalizeValue(value._id);
    if (value.id) return normalizeValue(value.id);
    if (value.name) return normalizeValue(value.name);
    if (value.label) return normalizeValue(value.label);
    return '';
  }
  return String(value).trim();
};
const uniqueList = (items) => Array.from(new Set((items || []).map(normalizeValue).filter(Boolean)));
const normalizeKey = (value) => normalizeValue(value).toLowerCase();
const uniqueListCaseInsensitive = (items = []) => {
  const seen = new Set();
  const out = [];
  (items || []).forEach((item) => {
    const value = normalizeValue(item);
    const key = normalizeKey(value);
    if (!value || seen.has(key)) return;
    seen.add(key);
    out.push(value);
  });
  return out;
};
const parseAssignedClasses = (assignedClasses = []) => {
  const gradeLabels = [];
  const subjects = [];

  (Array.isArray(assignedClasses) ? assignedClasses : []).forEach((entry) => {
    const value = normalizeValue(entry);
    if (!value || value.startsWith('+')) return;

    const separatorIndex = value.indexOf('-');
    const rawGrade = separatorIndex >= 0 ? value.slice(0, separatorIndex) : value;
    const rawSubject = separatorIndex >= 0 ? value.slice(separatorIndex + 1) : '';
    const gradeValue = normalizeValue(rawGrade);
    const subjectValue = normalizeValue(rawSubject);
    if (gradeValue) gradeLabels.push(gradeValue);
    if (subjectValue) subjects.push(subjectValue);
  });

  return {
    gradeLabels: uniqueList(gradeLabels),
    subjects: uniqueList(subjects),
  };
};

const UserManagementPage = () => {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [formRole, setFormRole] = useState('student');
  const [formValues, setFormValues] = useState({
    fullName: '',
    phone: '',
    grade: '',
    subject: '',
    pin: '',
    confirmPin: '',
  });
  const [formError, setFormError] = useState('');
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [assignmentValues, setAssignmentValues] = useState({
    gradeId: '',
    gradeIds: [],
    subject: '',
    subjects: [],
  });
  const [assignmentError, setAssignmentError] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editValues, setEditValues] = useState({
    fullName: '',
    phone: '',
    gradeId: '',
    subject: '',
  });
  const [editError, setEditError] = useState('');
  const [rowActionError, setRowActionError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryParams = useMemo(
    () => ({
      role: roleFilter === 'all' ? '' : roleFilter,
      status: '',
      search,
      page,
      limit: 10,
    }),
    [roleFilter, search, page]
  );

  const { data, isLoading, isError } = useUserStats();
  const {
    data: usersData,
    isLoading: isUsersLoading,
    isError: isUsersError,
  } = useUsers(queryParams);

  const allUsers = usersData?.users || [];
  const hasPhoneVerificationData = allUsers.some((user) => user?.phoneVerified !== null);
  const users = hasPhoneVerificationData
    ? allUsers.filter((user) => user?.phoneVerified === true)
    : allUsers;
  const totalPages = Number(usersData?.totalPages || 1);
  const { data: gradesFromApi = [] } = useQuery({
    queryKey: ['grades-options'],
    queryFn: getGrades,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const { data: subjectsFromApi = [] } = useQuery({
    queryKey: ['subjects-options'],
    queryFn: getSubjects,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const { data: subjectCatalog = [] } = useQuery({
    queryKey: ['subjects-catalog'],
    queryFn: getSubjectsList,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const gradeOptions = useMemo(() => {
    const fromApi = [...(usersData?.gradeOptions || []), ...gradesFromApi].filter(
      (item) => item?.id && item?.name
    );
    const fromUsers = users
      .map((user) => {
        const id = normalizeValue(user.gradeId || '');
        const name = normalizeValue(user.grade || '');
        if (!id || !name) return null;
        return { id, name };
      })
      .filter(Boolean);

    const merged = [...fromApi, ...fromUsers];
    const unique = new Map();
    merged.forEach((item) => {
      if (!unique.has(item.id)) unique.set(item.id, item);
    });
    return Array.from(unique.values());
  }, [users, usersData?.gradeOptions, gradesFromApi]);

  const subjectOptions = useMemo(() => {
    const fromApi = [...(usersData?.subjectOptions || []), ...subjectsFromApi]
      .map(normalizeValue)
      .filter(Boolean);
    const fromCatalog = subjectCatalog.map((item) => normalizeValue(item?.name)).filter(Boolean);
    return Array.from(new Set([...fromApi, ...fromCatalog]));
  }, [usersData?.subjectOptions, subjectsFromApi, subjectCatalog]);

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      setIsAddUserOpen(false);
      setFormValues({
        fullName: '',
        phone: '',
        grade: '',
        subject: '',
        pin: '',
        confirmPin: '',
      });
      setFormError('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-stats'] });
      queryClient.invalidateQueries({ queryKey: ['grades-options'] });
      queryClient.invalidateQueries({ queryKey: ['subjects-options'] });
    },
    onError: (error) => {
      setFormError(error?.response?.data?.message || 'Failed to create user');
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: ({ userId, payload }) => updateAdminUser(userId, payload),
    onSuccess: () => {
      setIsAssignOpen(false);
      setSelectedUser(null);
      setAssignmentError('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-stats'] });
    },
    onError: (error) => {
      setAssignmentError(error?.response?.data?.message || 'Failed to save assignments');
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }) => updateAdminUser(userId, payload),
    onSuccess: () => {
      setIsEditOpen(false);
      setEditUser(null);
      setEditError('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-stats'] });
    },
    onError: (error) => {
      setEditError(error?.response?.data?.message || 'Failed to update user');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, nextStatus }) => updateAdminUserStatus(userId, nextStatus),
    onSuccess: () => {
      setRowActionError('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-stats'] });
    },
    onError: (error) => {
      setRowActionError(error?.response?.data?.message || 'Failed to update user status');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => deleteAdminUser(userId),
    onSuccess: () => {
      setRowActionError('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-stats'] });
    },
    onError: (error) => {
      setRowActionError(error?.response?.data?.message || 'Failed to delete user');
    },
  });

  const handleFormChange = (key, value) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const openAddUser = () => {
    const defaultGradeId = normalizeValue(gradeOptions[0]?.id || '');
    setIsAddUserOpen(true);
    setFormRole('student');
    setFormValues({
      fullName: '',
      phone: '',
      grade: defaultGradeId,
      subject: '',
      pin: '',
      confirmPin: '',
    });
    setFormError('');
  };

  const closeAddUser = () => {
    if (createUserMutation.isPending) return;
    setIsAddUserOpen(false);
    setFormError('');
  };

  useEffect(() => {
    if (!isAddUserOpen) return;
    if (formRole !== 'student') return;
    if (normalizeValue(formValues.grade)) return;
    const fallback = normalizeValue(gradeOptions[0]?.id || '');
    if (!fallback) return;
    setFormValues((prev) => ({ ...prev, grade: fallback }));
  }, [isAddUserOpen, formRole, formValues.grade, gradeOptions]);

  const handleCreateUser = (event) => {
    event.preventDefault();
    setFormError('');

    const fullName = normalizeValue(formValues.fullName);
    const phone = normalizeValue(formValues.phone);
    const selectedGradeId = normalizeValue(formValues.grade);
    const subject = normalizeValue(formValues.subject);
    const selectedSubject = findSubjectByName(subject);
    const pin = normalizeValue(formValues.pin);
    const confirmPin = normalizeValue(formValues.confirmPin);

    if (!fullName || !phone || !pin || !confirmPin) {
      setFormError('Please fill all required fields');
      return;
    }

    if (!/^[234]\d{7}$/.test(phone)) {
      setFormError('Phone must be 8 digits and start with 2, 3, or 4');
      return;
    }

    if (pin !== confirmPin) {
      setFormError('PIN and Confirm PIN do not match');
      return;
    }

    let selectedGrade = null;
    if (formRole === 'student') {
      const fallbackGrade = gradeOptions[0] || null;
      selectedGrade =
        gradeOptions.find((item) => String(item.id) === selectedGradeId) || fallbackGrade;

      if (!selectedGrade?.id) {
        setFormError('Invalid gradeId. Please load grades from backend and select one.');
        return;
      }
    }

    if (formRole === 'teacher' && !subject) {
      setFormError('Subject is required for teachers');
      return;
    }

    const gradeName = normalizeValue(selectedGrade?.name || '');
    const gradeId = normalizeValue(selectedGrade?.id || '');
    const backendGradeLevel = normalizeValue(selectedGrade?.level || '');
    const normalizedRole = formRole.toLowerCase();
    const roleLabel = normalizedRole === 'student' ? 'Student' : 'Teacher';

    const payload = {
      role: normalizedRole,
      userType: normalizedRole,
      roleName: roleLabel,
      name: fullName,
      fullName,
      phone,
      pin,
      password: pin,
      confirmPin,
      ...(formRole === 'student'
        ? {
            grade: gradeName,
            gradeName,
            gradeId,
            ...(backendGradeLevel
              ? { gradeLevel: backendGradeLevel, gradeNumber: backendGradeLevel }
              : {}),
            grades: [gradeId],
            classGrade: gradeId,
            classGrades: [gradeId],
            assignedGrade: gradeId,
            assignedGrades: [gradeId],
            assignedClass: gradeId,
            assignedClasses: [gradeId],
            assignedClassesPayload: [{ _id: gradeId, name: gradeName }],
          }
        : {}),
      ...(formRole === 'teacher'
        ? {
            ...(selectedSubject?.id ? { subjectId: normalizeValue(selectedSubject.id) } : {}),
            subject,
            mainSubject: subject,
            subjects: [subject],
          }
        : {}),
    };

    createUserMutation.mutate(payload);
  };

  const findGradeById = (gradeId) =>
    gradeOptions.find((item) => normalizeValue(item.id) === normalizeValue(gradeId));

  const findSubjectByName = (subjectName) => {
    const normalized = normalizeValue(subjectName).toLowerCase();
    return subjectCatalog.find((item) => normalizeValue(item?.name).toLowerCase() === normalized);
  };

  const findGradeByLabel = (label) => {
    const normalized = normalizeValue(label).toLowerCase();
    return gradeOptions.find((item) => {
      const name = normalizeValue(item.name).toLowerCase();
      const level = normalizeValue(item.level).toLowerCase();
      return normalized && (name === normalized || level === normalized);
    });
  };

  const openEditModal = (user) => {
    const role = normalizeValue(user?.role).toLowerCase();
    const parsedClasses = parseAssignedClasses(user?.assignedClasses || []);
    const teacherSubjects = uniqueListCaseInsensitive([
      normalizeValue(user?.subject),
      ...(user?.assignedSubjects || []),
      ...parsedClasses.subjects,
    ]);
    const defaultGradeId =
      normalizeValue(user?.gradeId) ||
      normalizeValue(findGradeByLabel(user?.gradeLevel)?.id) ||
      normalizeValue(findGradeByLabel(user?.grade)?.id);

    setEditUser(user);
    setEditValues({
      fullName: normalizeValue(user?.name),
      phone: normalizeValue(user?.phone),
      gradeId: role === 'student' ? defaultGradeId : '',
      subject: role === 'teacher' ? normalizeValue(teacherSubjects[0] || '') : '',
    });
    setEditError('');
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    if (updateUserMutation.isPending) return;
    setIsEditOpen(false);
    setEditUser(null);
    setEditError('');
  };

  const handleEditChange = (key, value) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveEdit = (event) => {
    event.preventDefault();
    setEditError('');
    if (!editUser?.id) return;

    const role = normalizeValue(editUser.role).toLowerCase();
    const fullName = normalizeValue(editValues.fullName);
    const phone = normalizeValue(editValues.phone);
    const subject = normalizeValue(editValues.subject);
    const selectedSubject = findSubjectByName(subject);
    const gradeId = normalizeValue(editValues.gradeId);

    if (!fullName || !phone) {
      setEditError('Please fill all required fields');
      return;
    }

    if (!/^[234]\d{7}$/.test(phone)) {
      setEditError('Phone must be 8 digits and start with 2, 3, or 4');
      return;
    }

    if (role === 'teacher') {
      if (!subject) {
        setEditError('Subject is required for teachers');
        return;
      }
      const payload = {
        role: 'teacher',
        userType: 'teacher',
        roleName: 'Teacher',
        name: fullName,
        fullName,
        phone,
        ...(selectedSubject?.id ? { subjectId: normalizeValue(selectedSubject.id) } : {}),
        subject,
        mainSubject: subject,
        subjects: [subject],
        assignedSubjects: [subject],
        assignedGradeIds: Array.isArray(editUser.assignedGradeIds) ? editUser.assignedGradeIds : [],
        assignedGrades: Array.isArray(editUser.assignedGrades) ? editUser.assignedGrades : [],
      };
      updateUserMutation.mutate({ userId: editUser.id, payload });
      return;
    }

    if (role === 'student') {
      const grade = findGradeById(gradeId);
      if (!gradeId || !grade) {
        setEditError('Please select a valid grade');
        return;
      }
      const payload = {
        role: 'student',
        name: fullName,
        phone,
        gradeId,
        gradeLevel: normalizeValue(grade.level || grade.name),
        assignedSubjectIds: Array.isArray(editUser.assignedSubjectIds) ? editUser.assignedSubjectIds : [],
        assignedSubjects: Array.isArray(editUser.assignedSubjects) ? editUser.assignedSubjects : [],
      };
      updateUserMutation.mutate({ userId: editUser.id, payload });
      return;
    }

    updateUserMutation.mutate({
      userId: editUser.id,
      payload: { name: fullName, phone },
    });
  };

  const handleToggleUserStatus = (user) => {
    const currentStatus = normalizeValue(user?.status).toLowerCase();
    const nextStatus = currentStatus === 'active' ? 'blocked' : 'active';
    toggleStatusMutation.mutate({ userId: user.id, nextStatus });
  };

  const handleDeleteUser = async (user) => {
    const result = await Swal.fire({
      title: 'Delete User?',
      text: `Are you sure you want to delete "${user?.name || 'this user'}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#1f3f93',
    });

    if (!result.isConfirmed) return;

    deleteUserMutation.mutate(user.id, {
      onSuccess: async () => {
        await Swal.fire({
          title: 'Deleted',
          text: 'User deleted successfully.',
          icon: 'success',
          confirmButtonColor: '#1f3f93',
        });
      },
      onError: async (error) => {
        await Swal.fire({
          title: 'Delete Failed',
          text: error?.response?.data?.message || 'Failed to delete user',
          icon: 'error',
          confirmButtonColor: '#1f3f93',
        });
      },
    });
  };

  const openAssignModal = (user) => {
    const parsedClasses = parseAssignedClasses(user?.assignedClasses || []);
    const userAssignedSubjects = uniqueListCaseInsensitive([
      ...(user?.assignedSubjects || []),
      ...parsedClasses.subjects,
    ]);
    const userAssignedGradeIds = uniqueList((user?.assignedGradeIds || []).map(String));
    const userAssignedGrades = uniqueList([
      ...(user?.assignedGrades || []),
      ...parsedClasses.gradeLabels,
    ]);

    const defaultStudentGradeId =
      normalizeValue(user?.gradeId) ||
      normalizeValue(findGradeByLabel(user?.gradeLevel)?.id) ||
      normalizeValue(findGradeByLabel(user?.grade)?.id) ||
      normalizeValue(findGradeByLabel(userAssignedGrades[0])?.id) ||
      '';

    const defaultTeacherGradeIds =
      userAssignedGradeIds.length > 0
        ? userAssignedGradeIds
        : userAssignedGrades.length > 0
          ? uniqueListCaseInsensitive(userAssignedGrades.map((grade) => findGradeByLabel(grade)?.id))
          : uniqueListCaseInsensitive(parsedClasses.gradeLabels.map((grade) => findGradeByLabel(grade)?.id));

    const defaultTeacherSubject =
      normalizeValue(user?.subject) || normalizeValue(userAssignedSubjects[0] || '');

    setSelectedUser(user);
    setAssignmentValues({
      gradeId: defaultStudentGradeId,
      gradeIds: defaultTeacherGradeIds,
      subject: defaultTeacherSubject,
      subjects: userAssignedSubjects,
    });
    setAssignmentError('');
    setIsAssignOpen(true);
  };

  const closeAssignModal = () => {
    if (updateAssignmentMutation.isPending) return;
    setIsAssignOpen(false);
    setSelectedUser(null);
    setAssignmentError('');
  };

  const toggleTeacherGrade = (gradeId) => {
    setAssignmentValues((prev) => {
      const current = new Set(prev.gradeIds.map(String));
      const key = String(gradeId);
      if (current.has(key)) current.delete(key);
      else current.add(key);
      return { ...prev, gradeIds: Array.from(current) };
    });
  };

  const toggleStudentSubject = (subjectName) => {
    setAssignmentValues((prev) => {
      const name = normalizeValue(subjectName);
      const current = new Set(prev.subjects.map(normalizeValue));
      if (current.has(name)) current.delete(name);
      else current.add(name);
      return { ...prev, subjects: Array.from(current) };
    });
  };

  const handleSaveAssignments = (event) => {
    event.preventDefault();
    setAssignmentError('');
    if (!selectedUser?.id) return;

    const role = normalizeValue(selectedUser.role).toLowerCase();
    if (role !== 'student' && role !== 'teacher') {
      setAssignmentError('Assignments are only supported for students and teachers');
      return;
    }

    if (role === 'student') {
      const gradeId = normalizeValue(assignmentValues.gradeId);
      const grade = findGradeById(gradeId);
      const subjects = uniqueList(assignmentValues.subjects);

      if (!gradeId || !grade) {
        setAssignmentError('Please select one grade for the student');
        return;
      }
      if (subjects.length === 0) {
        setAssignmentError('Please assign at least one subject for the student');
        return;
      }

      const payload = {
        role: 'student',
        gradeId,
        gradeLevel: normalizeValue(grade.level || grade.name),
        assignedSubjectIds: [],
        assignedSubjects: subjects,
      };
      updateAssignmentMutation.mutate({ userId: selectedUser.id, payload });
      return;
    }

    const subject = normalizeValue(assignmentValues.subject);
    const selectedSubject = findSubjectByName(subject);
    const gradeIds = uniqueList(assignmentValues.gradeIds.map(String));
    if (!subject) {
      setAssignmentError('Please select one subject for the teacher');
      return;
    }
    if (gradeIds.length === 0) {
      setAssignmentError('Please assign at least one grade for the teacher');
      return;
    }

    const payload = {
      role: 'teacher',
      ...(selectedSubject?.id ? { subjectId: normalizeValue(selectedSubject.id) } : {}),
      subject,
      mainSubject: subject,
      subjects: [subject],
      assignedGradeIds: gradeIds,
      assignedGrades: gradeIds
        .map((gradeId) => findGradeById(gradeId))
        .filter(Boolean)
        .map((grade) => normalizeValue(grade.level || grade.name))
        .filter(Boolean),
      assignedClasses: gradeIds
        .map((gradeId) => findGradeById(gradeId))
        .filter(Boolean)
        .map((grade) => `${normalizeValue(grade.level || grade.name)} - ${subject}`),
    };
    updateAssignmentMutation.mutate({ userId: selectedUser.id, payload });
  };

  const buildUserAssignedDisplay = (user) => {
    const role = normalizeValue(user?.role).toLowerCase();
    const fromClasses = uniqueListCaseInsensitive(user?.assignedClasses || []);

    if (role === 'student') {
      const gradeLabel = normalizeValue(user?.gradeLevel || user?.grade);
      const subjects = uniqueListCaseInsensitive(user?.assignedSubjects || []);
      const fromSubjects = gradeLabel
        ? subjects.map((subject) => `${gradeLabel} - ${subject}`)
        : subjects;
      return uniqueListCaseInsensitive([...fromClasses, ...fromSubjects]);
    }

    if (role === 'teacher') {
      const subject = normalizeValue(user?.subject);
      const grades = uniqueListCaseInsensitive(
        (user?.assignedGrades || []).length > 0
          ? user.assignedGrades
          : (user?.assignedGradeIds || [])
              .map((gradeId) => findGradeById(gradeId)?.level || findGradeById(gradeId)?.name)
              .filter(Boolean)
      );
      const fromTeacherAssignments = subject
        ? grades.map((grade) => `${grade} - ${subject}`)
        : [];
      return fromTeacherAssignments.length > 0
        ? uniqueListCaseInsensitive(fromTeacherAssignments)
        : fromClasses;
    }

    return fromClasses;
  };

  const selectedUserRole = normalizeValue(selectedUser?.role).toLowerCase();
  const selectedStudentSubjects = uniqueListCaseInsensitive(
    (assignmentValues.subjects || []).map(normalizeValue)
  );
  const selectedTeacherGradeIds = uniqueListCaseInsensitive(
    (assignmentValues.gradeIds || []).map(normalizeValue)
  );
  const selectedStudentGrade = findGradeById(assignmentValues.gradeId);
  const selectedStudentGradeName = normalizeValue(selectedStudentGrade?.name);

  const availableGradeOptions = gradeOptions.filter((grade) => {
    const gradeId = normalizeValue(grade?.id);
    const gradeName = normalizeValue(grade?.name);
    if (!gradeId) return false;
    if (selectedUserRole === 'teacher') return true;
    if (selectedUserRole === 'student') {
      const selectedGradeId = normalizeValue(assignmentValues.gradeId);
      return selectedGradeId === gradeId || normalizeKey(selectedStudentGradeName) === normalizeKey(gradeName);
    }
    return true;
  });

  const availableStudentSubjects = uniqueListCaseInsensitive(subjectOptions.map(normalizeValue));
  const availableTeacherSubjects = normalizeValue(assignmentValues.subject)
    ? [normalizeValue(assignmentValues.subject)]
    : [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-[10px] border border-[#d6e3fb] bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-[520px]">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8aa3cf]"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search users..."
            className="h-11 w-full rounded-lg border border-[#d6e3fb] bg-[#f8fbff] pl-10 pr-3 text-sm text-[#17367a] outline-none focus:border-[#1f3f93]"
          />
        </label>

        <div className="flex items-center gap-2">
          <div className="inline-flex h-11 items-center rounded-[10px] border border-[#d6e3fb] bg-[#f8fbff] p-1">
            {[
              { label: 'All', value: 'all' },
              { label: 'Students', value: 'student' },
              { label: 'Teachers', value: 'teacher' },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setRoleFilter(tab.value);
                  setPage(1);
                }}
                className={`h-9 rounded-md px-4 text-sm font-semibold ${
                  roleFilter === tab.value ? 'bg-[#1f3f93] text-white' : 'text-[#1f3f93]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openAddUser}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#1f3f93] px-4  font-semibold text-white"
          >
            <Plus size={16} />
            Add User
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.key} className="rounded-[10px] border border-[#d6e3fb] bg-white px-4 py-4">
            <p className="mb-1 text-[13px] text-[#5f79af]">{card.label}</p>
            <h3 className={`text-[40px] font-bold leading-none ${card.valueClass}`}>
              {isLoading ? '...' : formatValue(data?.[card.key])}
            </h3>
            {isError && <p className="mt-2 text-xs text-red-600">Failed to load stats</p>}
          </article>
        ))}
      </div>

      <div className="overflow-hidden rounded-[10px] border border-[#d6e3fb] bg-white">
        {rowActionError && (
          <div className="border-b border-[#f5d0d0] bg-[#fff5f5] px-4 py-2 text-sm text-red-600">
            {rowActionError}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#eef4ff] text-left text-[13px] font-semibold text-[#1f3f93]">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Assigned Classes</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Join Date</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isUsersLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-[#7b91be]">
                    Loading users...
                  </td>
                </tr>
              )}

              {!isUsersLoading && isUsersError && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-red-600">
                    Failed to load users
                  </td>
                </tr>
              )}

              {!isUsersLoading && !isUsersError && users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-[#7b91be]">
                    No users found
                  </td>
                </tr>
              )}

              {!isUsersLoading &&
                !isUsersError &&
                users.map((user) => {
                  const statusText = String(user.status || '').toLowerCase();
                  const isActive = statusText === 'active';
                  const emailOrPhone = user.email && user.email !== 'N/A' ? user.email : user.phone;
                  return (
                    <tr key={user.id} className="border-t border-[#e2ecff] text-[#17367a]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1f3f93] text-sm font-semibold text-white">
                            {getInitials(user.name)}
                          </span>
                          <span className="font-semibold text-[16px] leading-none text-[#1f3f93]">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[#4f6695]">{emailOrPhone}</td>
                      <td className="px-5 py-4">{user.role}</td>
                      <td className="px-5 py-4">{renderAssignedClasses(buildUserAssignedDisplay(user))}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            isActive ? 'bg-[#d7f2e3] text-[#067e3d]' : 'bg-[#fde2e2] text-[#c92020]'
                          }`}
                        >
                          {user.status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-5 py-4">{formatDate(user.joinDate)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {['student', 'teacher'].includes(normalizeValue(user.role).toLowerCase()) ? (
                            <button
                              type="button"
                              className="text-[#1f4ca8]"
                              title="Manage Class Assignment"
                              onClick={() => openAssignModal(user)}
                            >
                              <FiUserPlus size={16} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="cursor-not-allowed text-[#9ab0dc]"
                              title="Assignment not available"
                              disabled
                            >
                              <FiUserPlus size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="text-[#4d91ff]"
                            title="Edit user"
                            onClick={() => openEditModal(user)}
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            type="button"
                            className={`disabled:cursor-not-allowed disabled:opacity-50 ${
                              isActive ? 'text-[#f0a115]' : 'text-[#0ca65f]'
                            }`}
                            title={isActive ? 'Block user' : 'Activate user'}
                            onClick={() => handleToggleUserStatus(user)}
                            disabled={toggleStatusMutation.isPending || deleteUserMutation.isPending}
                          >
                            {isActive ? <FiUserX size={16} /> : <FiUserCheck size={16} />}
                          </button>
                          <button
                            type="button"
                            className="text-[#e10000] disabled:cursor-not-allowed disabled:opacity-50"
                            title="Delete user"
                            onClick={() => handleDeleteUser(user)}
                            disabled={deleteUserMutation.isPending || toggleStatusMutation.isPending}
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[#e2ecff] px-4 py-3">
          <p className="text-xs text-[#6f84b4]">
            Page {usersData?.page || page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded-md border border-[#d6e3fb] px-3 py-1.5 text-xs font-semibold text-[#1f3f93] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-[#d6e3fb] px-3 py-1.5 text-xs font-semibold text-[#1f3f93] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {isEditOpen && editUser && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[520px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-4" onSubmit={handleSaveEdit}>
              <div className="text-sm text-[#5f79af]">
                Role:{' '}
                <span className="rounded-full bg-[#eef4ff] px-3 py-1 font-semibold capitalize text-[#1f4ca8]">
                  {editUser.role}
                </span>
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Full Name</label>
                <input
                  type="text"
                  value={editValues.fullName}
                  onChange={(event) => handleEditChange('fullName', event.target.value)}
                  className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Phone Number</label>
                <input
                  type="text"
                  value={editValues.phone}
                  onChange={(event) => handleEditChange('phone', event.target.value)}
                  placeholder="Enter your phone number"
                  className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              {normalizeValue(editUser.role).toLowerCase() === 'teacher' && (
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Subject</label>
                  <input
                    type="text"
                    list="edit-subject-options"
                    value={editValues.subject}
                    onChange={(event) => handleEditChange('subject', event.target.value)}
                    placeholder="Select or type subject"
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                  <datalist id="edit-subject-options">
                    {subjectOptions.map((subject) => (
                      <option key={subject} value={subject} />
                    ))}
                  </datalist>
                </div>
              )}

              {normalizeValue(editUser.role).toLowerCase() === 'student' && (
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Grade</label>
                  <select
                    value={editValues.gradeId}
                    onChange={(event) => handleEditChange('gradeId', event.target.value)}
                    className="h-12 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  >
                    <option value="">Select grade</option>
                    {gradeOptions.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editError && <p className="text-sm text-red-600">{editError}</p>}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="h-12 flex-1 rounded-[10px] bg-[#f1f3f8] text-sm font-semibold text-[#5b739f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                  className="h-12 flex-1 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAssignOpen && selectedUser && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="max-h-[95vh] w-full max-w-[760px] overflow-y-auto rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-5" onSubmit={handleSaveAssignments}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[34px] font-semibold leading-none text-[#1f3f93]">
                    Manage Grade Assignments
                  </h2>
                  <p className="mt-2 text-sm text-[#6f84b4]">
                    {normalizeValue(selectedUser.role).toLowerCase() === 'teacher'
                      ? 'Assign grades for teaching'
                      : 'Assign student to a grade'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeAssignModal}
                  className="text-[#6f84b4] transition hover:text-[#1f3f93]"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="rounded-xl border border-[#d6e3fb] bg-[#f3f7ff] p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#1f3f93] text-base font-semibold text-white">
                    {getInitials(selectedUser.name)}
                  </span>
                  <div>
                    <p className="text-xl font-semibold leading-none text-[#1f3f93]">{selectedUser.name}</p>
                    <p className="mt-1 text-sm text-[#5f79af]">
                      {selectedUser.email && selectedUser.email !== 'N/A' ? selectedUser.email : selectedUser.phone}
                    </p>
                    <p className="mt-1 text-sm font-medium capitalize text-[#1f4ca8]">{selectedUser.role}</p>
                  </div>
                </div>
              </div>

              {normalizeValue(selectedUser.role).toLowerCase() === 'student' ? (
                <div className="rounded-xl border border-[#efd88d] bg-[#fff9e9] p-4 text-[#99640a]">
                  Students can be assigned to one grade and multiple subjects.
                </div>
              ) : (
                <div className="rounded-xl border border-[#efd88d] bg-[#fff9e9] p-4 text-[#99640a]">
                  Teachers can be assigned to multiple grades but only one subject.
                </div>
              )}

              <div>
                <h3 className="mb-3 text-xl font-semibold text-[#1f3f93]">
                  Currently Assigned
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedUserRole === 'student' &&
                    normalizeValue(assignmentValues.gradeId) &&
                    findGradeById(assignmentValues.gradeId) && (
                      <span className="rounded-lg bg-[#1f3f93] px-3 py-1.5 text-sm font-semibold text-white">
                        {findGradeById(assignmentValues.gradeId)?.name}
                      </span>
                    )}
                  {selectedUserRole === 'student' &&
                    assignmentValues.subjects.map((subject) => (
                      <span
                        key={`assigned-subject-${subject}`}
                        className="rounded-lg bg-[#1f3f93] px-3 py-1.5 text-sm font-semibold text-white"
                      >
                        {subject}
                      </span>
                    ))}
                  {selectedUserRole === 'teacher' &&
                    assignmentValues.gradeIds
                      .map((gradeId) => findGradeById(gradeId))
                      .filter(Boolean)
                      .map((grade) => (
                        <span
                          key={`assigned-grade-${grade.id}`}
                          className="rounded-lg bg-[#1f3f93] px-3 py-1.5 text-sm font-semibold text-white"
                        >
                          {grade.name}
                        </span>
                      ))}
                  {selectedUserRole === 'teacher' &&
                    normalizeValue(assignmentValues.subject) && (
                      <span className="rounded-lg bg-[#1f3f93] px-3 py-1.5 text-sm font-semibold text-white">
                        {assignmentValues.subject}
                      </span>
                    )}
                  {selectedUserRole === 'student' &&
                    !normalizeValue(assignmentValues.gradeId) &&
                    assignmentValues.subjects.length === 0 && (
                      <p className="text-sm text-[#7b91be]">No assignments yet.</p>
                    )}
                  {selectedUserRole === 'teacher' &&
                    !normalizeValue(assignmentValues.subject) &&
                    assignmentValues.gradeIds.length === 0 && (
                      <p className="text-sm text-[#7b91be]">No assignments yet.</p>
                    )}
                </div>
              </div>

              {selectedUserRole === 'teacher' && (
                <div>
                  <h3 className="mb-3 text-xl font-semibold text-[#1f3f93]">Available Grades</h3>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {availableGradeOptions.map((grade) => {
                      const isSelected = selectedTeacherGradeIds.includes(normalizeValue(grade.id));
                      return (
                        <button
                          key={grade.id}
                          type="button"
                          onClick={() => toggleTeacherGrade(grade.id)}
                          className={`rounded-xl border px-3 py-3 text-left transition ${
                            isSelected
                              ? 'border-[#1f3f93] bg-[#edf3ff] text-[#1f3f93]'
                              : 'border-[#d6e3fb] bg-white text-[#4f6695] hover:border-[#1f3f93] hover:bg-[#edf3ff] hover:text-[#1f3f93]'
                          }`}
                        >
                          <p className="text-lg font-semibold">{grade.name}</p>
                        </button>
                      );
                    })}
                    {availableGradeOptions.length === 0 && (
                      <p className="col-span-full text-sm text-[#7b91be]">No remaining grades.</p>
                    )}
                  </div>
                </div>
              )}

              {selectedUserRole === 'student' && (
                <div>
                  <h3 className="mb-3 text-xl font-semibold text-[#1f3f93]">Available Subjects</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {availableStudentSubjects.map((subject) => {
                      const normalized = normalizeValue(subject);
                      const isSelected = selectedStudentSubjects.some(
                        (item) => normalizeKey(item) === normalizeKey(normalized)
                      );
                      return (
                        <button
                          key={subject}
                          type="button"
                          onClick={() => toggleStudentSubject(subject)}
                          className={`rounded-xl border px-3 py-3 text-left transition ${
                            isSelected
                              ? 'border-[#1f3f93] bg-[#edf3ff] text-[#1f3f93]'
                              : 'border-[#d6e3fb] bg-white text-[#4f6695] hover:border-[#1f3f93] hover:bg-[#edf3ff] hover:text-[#1f3f93]'
                          }`}
                        >
                          <p className="text-lg font-semibold">{normalized}</p>
                        </button>
                      );
                    })}
                    {availableStudentSubjects.length === 0 && (
                      <p className="col-span-full text-sm text-[#7b91be]">No remaining subjects.</p>
                    )}
                  </div>
                </div>
              )}

              {selectedUserRole === 'student' && (
                <div>
                  <h3 className="mb-3 text-xl font-semibold text-[#1f3f93]">Available Grades</h3>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {availableGradeOptions.map((grade) => (
                      <button
                        key={grade.id}
                        type="button"
                        onClick={() => setAssignmentValues((prev) => ({ ...prev, gradeId: String(grade.id) }))}
                        className="rounded-xl border border-[#d6e3fb] bg-white px-3 py-3 text-left text-[#4f6695] transition hover:border-[#1f3f93] hover:bg-[#edf3ff] hover:text-[#1f3f93]"
                      >
                        <p className="text-lg font-semibold">{grade.name}</p>
                      </button>
                    ))}
                    {availableGradeOptions.length === 0 && (
                      <p className="col-span-full text-sm text-[#7b91be]">No remaining grades.</p>
                    )}
                  </div>
                </div>
              )}

              {selectedUserRole === 'teacher' && (
                <div>
                  <h3 className="mb-3 text-xl font-semibold text-[#1f3f93]">Available Subjects</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {availableTeacherSubjects.map((subject) => {
                      const normalized = normalizeValue(subject);
                      return (
                        <button
                          key={subject}
                          type="button"
                          onClick={() =>
                            setAssignmentValues((prev) => ({
                              ...prev,
                              subject: normalized,
                            }))
                          }
                          className="rounded-xl border border-[#d6e3fb] bg-white px-3 py-3 text-left text-[#4f6695] transition hover:border-[#1f3f93] hover:bg-[#edf3ff] hover:text-[#1f3f93]"
                        >
                          <p className="text-lg font-semibold">{subject}</p>
                        </button>
                      );
                    })}
                    {availableTeacherSubjects.length === 0 && (
                      <p className="col-span-full text-sm text-[#7b91be]">No remaining subjects.</p>
                    )}
                  </div>
                </div>
              )}

              {assignmentError && <p className="text-sm text-red-600">{assignmentError}</p>}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  className="h-12 flex-1 rounded-[10px] bg-[#f1f3f8] text-sm font-semibold text-[#5b739f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateAssignmentMutation.isPending}
                  className="h-12 flex-1 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {updateAssignmentMutation.isPending ? 'Saving...' : 'Save Assignments'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[460px] rounded-xl border border-[#d6e3fb] bg-white p-6">
            <form className="space-y-4" onSubmit={handleCreateUser}>
              <div className="flex items-center gap-6">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    checked={formRole === 'student'}
                    onChange={() => setFormRole('student')}
                  />
                  <span className="text-lg font-semibold text-[#1f3f93]">Student</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    checked={formRole === 'teacher'}
                    onChange={() => setFormRole('teacher')}
                  />
                  <span className="text-lg font-semibold text-[#1f3f93]">Teacher</span>
                </label>
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Full Name</label>
                <input
                  type="text"
                  value={formValues.fullName}
                  onChange={(event) => handleFormChange('fullName', event.target.value)}
                  placeholder="Enter your full name"
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Phone Number</label>
                <input
                  type="text"
                  value={formValues.phone}
                  onChange={(event) => handleFormChange('phone', event.target.value)}
                  placeholder="Enter your phone number"
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              {formRole === 'student' && (
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Grade</label>
                  <select
                    value={formValues.grade}
                    onChange={(event) => handleFormChange('grade', event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  >
                    <option value="">Select a grade</option>
                    {gradeOptions.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formRole === 'teacher' && (
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Subject</label>
                  <input
                    type="text"
                    list="subject-options"
                    value={formValues.subject}
                    onChange={(event) => handleFormChange('subject', event.target.value)}
                    placeholder="e.g., Mathematics"
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                  <datalist id="subject-options">
                    {subjectOptions.map((subject) => (
                      <option key={subject} value={subject} />
                    ))}
                  </datalist>
                </div>
              )}

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">PIN</label>
                <input
                  type="password"
                  value={formValues.pin}
                  onChange={(event) => handleFormChange('pin', event.target.value)}
                  placeholder="Enter a PIN"
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Confirm PIN</label>
                <input
                  type="password"
                  value={formValues.confirmPin}
                  onChange={(event) => handleFormChange('confirmPin', event.target.value)}
                  placeholder="Re-enter the PIN"
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeAddUser}
                  className="h-12 flex-1 rounded-[10px] bg-[#f1f3f8] text-sm font-semibold text-[#5b739f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#1f3f93] text-sm font-semibold text-white disabled:opacity-60"
                >
                  <FiUserPlus size={18} />
                  {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default UserManagementPage;
