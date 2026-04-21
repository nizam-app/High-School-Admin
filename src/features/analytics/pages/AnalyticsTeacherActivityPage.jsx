import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, BookOpen, Users, Video } from 'lucide-react';
import { getAnalyticsTeacherActivity } from '../api/analyticsApi';

const summaryCards = [
  {
    key: 'totalTeachers',
    label: 'Total Teachers',
    icon: Users,
    iconBg: 'bg-[#ebf1fe] text-[#1f4ca8]',
    format: (value) => Number(value || 0).toLocaleString(),
  },
  {
    key: 'lessonsUploaded',
    label: 'Lessons Uploaded',
    icon: BookOpen,
    iconBg: 'bg-[#daf6e6] text-[#039855]',
    format: (value) => Number(value || 0).toLocaleString(),
  },
  {
    key: 'sessionsCreated',
    label: 'Sessions Created',
    icon: Video,
    iconBg: 'bg-[#efe5ff] text-[#7e22ce]',
    format: (value) => Number(value || 0).toLocaleString(),
  },
  {
    key: 'avgEngagement',
    label: 'Avg Engagement',
    icon: Activity,
    iconBg: 'bg-[#fff2e0] text-[#ea580c]',
    format: (value) => `${Number(value || 0).toFixed(1)}%`,
  },
];

const toInitials = (name) => {
  const text = String(name || '').trim();
  if (!text) return 'TR';
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const performanceMeta = (value) => {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'excellent') {
    return { label: 'Excellent', className: 'bg-[#cdeed8] text-[#008a3d]' };
  }
  if (status === 'good') {
    return { label: 'Good', className: 'bg-[#d9e8ff] text-[#2463d7]' };
  }
  return { label: 'Needs Attention', className: 'bg-[#ffdfe0] text-[#d62828]' };
};

const AnalyticsTeacherActivityPage = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics-teacher-activity'],
    queryFn: getAnalyticsTeacherActivity,
    staleTime: 30 * 1000,
    retry: 1,
  });

  const summary = data?.summary || {
    totalTeachers: 0,
    lessonsUploaded: 0,
    sessionsCreated: 0,
    avgEngagement: 0,
  };

  const teachers = useMemo(() => (Array.isArray(data?.teachers) ? data.teachers : []), [data?.teachers]);

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
            Individual Teacher Activity
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-[#eef4ff] text-sm font-semibold text-[#1f3f93]">
                <th className="px-4 py-3">Teacher Name</th>
                <th className="px-4 py-3">Lessons Uploaded</th>
                <th className="px-4 py-3">Sessions Created</th>
                <th className="px-4 py-3">Performance</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#7b91be]">
                    Loading teacher activity...
                  </td>
                </tr>
              )}

              {!isLoading && isError && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-red-600">
                    Failed to load teacher activity.
                  </td>
                </tr>
              )}

              {!isLoading && !isError && teachers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#7b91be]">
                    No teacher activity data available.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                teachers.map((teacher) => {
                  const meta = performanceMeta(teacher.performance);

                  return (
                    <tr key={teacher.id} className="border-t border-[#d6e3fb] text-sm">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1f3f93] text-xs font-bold text-white">
                            {toInitials(teacher.name)}
                          </span>
                          <span className="font-semibold text-[#17367a]">{teacher.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#17367a]">
                        {Number(teacher.lessonsUploaded || 0)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#17367a]">
                        {Number(teacher.sessionsCreated || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}
                        >
                          {meta.label}
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

export default AnalyticsTeacherActivityPage;
