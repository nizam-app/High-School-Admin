import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Clock3, TrendingUp, Users } from 'lucide-react';
import { getAnalyticsStudentProgress } from '../api/analyticsApi';

const summaryCards = [
  {
    key: 'totalStudents',
    label: 'Total Students',
    icon: Users,
    iconBg: 'bg-[#ebf1fe] text-[#1f4ca8]',
    format: (value) => Number(value || 0).toLocaleString(),
  },
  // {
  //   key: 'avgAttendance',
  //   label: 'Avg Attendance',
  //   icon: Activity,
  //   iconBg: 'bg-[#daf6e6] text-[#039855]',
  //   format: (value) => `${Number(value || 0).toFixed(1)}%`,
  // },
  {
    key: 'assignmentsCompleted',
    label: 'Assignments Completed',
    icon: TrendingUp,
    iconBg: 'bg-[#efe5ff] text-[#7e22ce]',
    format: (value) => Number(value || 0).toLocaleString(),
  },
  {
    key: 'avgPerformance',
    label: 'Avg Performance',
    icon: Clock3,
    iconBg: 'bg-[#fff2e0] text-[#ea580c]',
    format: (value) => `${Number(value || 0).toFixed(1)}%`,
  },
];

const toInitials = (name) => {
  const text = String(name || '').trim();
  if (!text) return 'ST';
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const attendanceClass = (value) => {
  const pct = Number(value || 0);
  if (pct >= 90) return 'text-[#00a63e]';
  if (pct >= 80) return 'text-[#ff7a00]';
  return 'text-[#ff1b1b]';
};

const statusMeta = (status) => {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'excellent') {
    return {
      label: 'Excellent',
      className: 'bg-[#cdeed8] text-[#008a3d]',
    };
  }
  if (value === 'good') {
    return {
      label: 'Good',
      className: 'bg-[#d9e8ff] text-[#2463d7]',
    };
  }
  if (value === 'average') {
    return {
      label: 'Average',
      className: 'bg-[#fff1cd] text-[#9f7a00]',
    };
  }
  return {
    label: 'Needs Attention',
    className: 'bg-[#ffdfe0] text-[#d62828]',
  };
};

const getAssignmentPercent = (completed, total) => {
  const done = Number(completed || 0);
  const max = Number(total || 0);
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / max) * 100)));
};

const AnalyticsStudentProgressPage = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics-student-progress'],
    queryFn: getAnalyticsStudentProgress,
    staleTime: 30 * 1000,
    retry: 1,
  });

  const summary = data?.summary || {
    totalStudents: 0,
    avgAttendance: 0,
    assignmentsCompleted: 0,
    avgPerformance: 0,
  };

  const students = useMemo(() => (Array.isArray(data?.students) ? data.students : []), [data?.students]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => {
          const Icon = item.icon;
          const valueText = isLoading ? '--' : item.format(summary[item.key]);

          return (
            <article
              key={item.key}
              className="flex items-start justify-between rounded-[10px] border border-[#d6e3fb] bg-white p-4"
            >
              <div>
                <p className="m-0 text-[13px] text-[#6880b8]">{item.label}</p>
                <h3 className="my-2 text-[48px] font-bold leading-none text-[#1f3f93]">{valueText}</h3>
              </div>
              <span
                className={`inline-flex h-[46px] w-[46px] items-center justify-center rounded-xl ${item.iconBg}`}
              >
                <Icon size={22} />
              </span>
            </article>
          );
        })}
      </div>

      <article className="overflow-hidden rounded-[10px] border border-[#d6e3fb] bg-white">
        <div className="border-b border-[#d6e3fb] px-4 py-3">
          <h3 className="text-[30px] font-semibold leading-none text-[#1f3f93]">
            Individual Student Progress
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-[#eef4ff] text-sm font-semibold text-[#1f3f93]">
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Assignments</th>
                {/* <th className="px-4 py-3">Attendance</th> */}
                <th className="px-4 py-3">Avg Score</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#7b91be]">
                    Loading student progress...
                  </td>
                </tr>
              )}

              {!isLoading && isError && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-red-600">
                    Failed to load student progress.
                  </td>
                </tr>
              )}

              {!isLoading && !isError && students.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#7b91be]">
                    No student progress data available.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                students.map((student) => {
                  const done = Number(student.assignmentsCompleted || 0);
                  const total = Number(student.assignmentsTotal || 0);
                  const assignPct = getAssignmentPercent(done, total);
                  const status = statusMeta(student.status);

                  return (
                    <tr key={student.id} className="border-t border-[#d6e3fb] text-sm">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1f3f93] text-xs font-bold text-white">
                            {toInitials(student.name)}
                          </span>
                          <span className="font-semibold text-[#17367a]">{student.name}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-[#5f79af]">{student.grade || 'N/A'}</td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#17367a]">
                          {done}/{total}
                        </p>
                        <div className="mt-1 h-1.5 w-[90px] rounded-full bg-[#cfe0ff]">
                          <div
                            className="h-1.5 rounded-full bg-[#1f3f93]"
                            style={{ width: `${assignPct}%` }}
                          />
                        </div>
                      </td>

                      {/* <td className={`px-4 py-3 font-semibold ${attendanceClass(student.attendancePct)}`}>
                        {Number(student.attendancePct || 0).toFixed(0)}%
                      </td> */}

                      <td className="px-4 py-3 font-semibold text-[#17367a]">
                        {Number(student.avgScorePct || 0).toFixed(0)}%
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
};

export default AnalyticsStudentProgressPage;
