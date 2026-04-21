import { http } from '../../../shared/services/http';

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const pick = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
};

export const getUserStats = async () => {
  const response = await http.get('/admin/users/stats');
  const payload = response?.data || {};
  const root = payload?.data || payload;

  return {
    totalStudents: toNumberOrNull(
      pick(root, ['totalStudents', 'students', 'studentCount', 'total_students'])
    ),
    totalTeachers: toNumberOrNull(
      pick(root, ['totalTeachers', 'teachers', 'teacherCount', 'total_teachers'])
    ),
    activeUsers: toNumberOrNull(
      pick(root, ['activeUsers', 'active', 'activeCount', 'active_users'])
    ),
    inactiveUsers: toNumberOrNull(
      pick(root, ['inactiveUsers', 'inactive', 'inactiveCount', 'inactive_users'])
    ),
  };
};

