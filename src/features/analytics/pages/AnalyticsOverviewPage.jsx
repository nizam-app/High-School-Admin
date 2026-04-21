import { Activity, Clock3, TrendingUp, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { http } from '../../../shared/services/http';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const summaryCards = [
  {
    label: 'Active Users',
    value: '--',
   
    icon: Users,
    iconBg: 'bg-[#ebf1fe] text-[#1f4ca8]',
  },
  {
    label: 'Daily Active Users',
    value: '--',
   
    icon: Activity,
    iconBg: 'bg-[#daf6e6] text-[#039855]',
  },
  {
    label: 'User Retention',
    value: '--',
   
    icon: TrendingUp,
    iconBg: 'bg-[#efe5ff] text-[#7e22ce]',
  },
  {
    label: 'Avg. Session Time',
    value: '--',
   
    icon: Clock3,
    iconBg: 'bg-[#fff2e0] text-[#ea580c]',
  },
];
const ATTENDANCE_COLORS = {
  present: '#19b37b',
  absent: '#ef4444',
  late: '#f59e0b',
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pickNumber = (source = {}, keys = [], fallback = 0) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) {
      return toNumber(source[key], fallback);
    }
  }
  return fallback;
};

const formatIsoDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const toShortDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const buildLast7DaySeries = (fromDate, trendItems = []) => {
  const byDate = new Map(
    (Array.isArray(trendItems) ? trendItems : []).map((item) => [
      String(item?.date || ''),
      {
        students: toNumber(item?.students, 0),
        teachers: toNumber(item?.teachers, 0),
      },
    ])
  );

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(fromDate);
    day.setDate(fromDate.getDate() + index);
    const dateKey = formatIsoDate(day);
    const values = byDate.get(dateKey) || { students: 0, teachers: 0 };
    return {
      date: dateKey,
      label: toShortDate(dateKey),
      students: values.students,
      teachers: values.teachers,
    };
  });
};

const getAnalyticsOverview = async ({ from, to } = {}) => {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;

  const response = Object.keys(params).length
    ? await http.get('/admin/analytics/overview', { params })
    : await http.get('/admin/analytics/overview');
  const payload = response?.data?.data ?? response?.data ?? {};
  const cards = payload?.cards ?? {};
  const trend = Array.isArray(payload?.dailyActivityTrend) ? payload.dailyActivityTrend : [];
  const normalizedBands = (Array.isArray(payload?.studentPerformanceBandsByGradeLevel)
    ? payload.studentPerformanceBandsByGradeLevel
    : []
  ).map((item) => ({
    gradeLevel: String(item?.gradeLevel || 'N/A'),
    excellent: toNumber(item?.excellent, 0),
    good: toNumber(item?.good, 0),
    average: toNumber(item?.average, 0),
    needsImprovement: toNumber(item?.needsImprovement, 0),
  }));

  const performanceByGrade = (Array.isArray(payload?.studentPerformanceByGradeLevel)
    ? payload.studentPerformanceByGradeLevel
    : []
  ).map((item) => ({
    gradeLevel: String(item?.gradeLevel || 'N/A'),
    avgScorePct: toNumber(item?.avgScorePct, 0),
    gradedCount: toNumber(item?.gradedCount, 0),
  }));

  return {
    activeUsers: toNumber(cards?.activeUsers, 0),
    dailyActiveUsers: toNumber(cards?.dailyActiveUsers, 0),
    userRetention: toNumber(cards?.userRetention, 0),
    avgSessionTimeMinutes: toNumber(cards?.avgSessionTimeMinutes, 0),
    dailyActivityTrend: trend.map((item) => ({
      date: String(item?.date || ''),
      label: toShortDate(item?.date),
      students: toNumber(item?.students, 0),
      teachers: toNumber(item?.teachers, 0),
    })),
    attendanceDistribution: {
      present: toNumber(payload?.attendanceDistribution?.present, 0),
      absent: toNumber(payload?.attendanceDistribution?.absent, 0),
      late: toNumber(payload?.attendanceDistribution?.late, 0),
      presentPct: toNumber(payload?.attendanceDistribution?.presentPct, 0),
      absentPct: toNumber(payload?.attendanceDistribution?.absentPct, 0),
      latePct: toNumber(payload?.attendanceDistribution?.latePct, 0),
    },
    studentPerformanceBandsByGradeLevel: normalizedBands,
    studentPerformanceByGradeLevel: performanceByGrade,
    assignmentSubmissions: (Array.isArray(payload?.assignmentSubmissions)
      ? payload.assignmentSubmissions
      : []
    ).map((item, index) => ({
      week: `Week ${index + 1}`,
      submitted: toNumber(item?.submitted, 0),
      pending: toNumber(item?.pending, 0),
    })),
  };
};

const AnalyticsOverviewPage = () => {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(today.getDate() - 6);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => getAnalyticsOverview({}),
    staleTime: 30 * 1000,
    retry: 1,
  });

  const valueByKey = {
    'Active Users': isLoading ? '--' : String(data?.activeUsers ?? '--'),
    'Daily Active Users': isLoading ? '--' : String(data?.dailyActiveUsers ?? '--'),
    'User Retention': isLoading ? '--' : `${data?.userRetention ?? '--'}%`,
    'Avg. Session Time': isLoading ? '--' : `${data?.avgSessionTimeMinutes ?? '--'}m`,
  };
  const chartData = buildLast7DaySeries(fromDate, data?.dailyActivityTrend);
  const hasChartData = chartData.some((item) => Number(item?.students || 0) || Number(item?.teachers || 0));
  const maxStudents = Math.max(...chartData.map((item) => Number(item?.students || 0)), 0);
  const maxTeachers = Math.max(...chartData.map((item) => Number(item?.teachers || 0)), 0);
  const yMaxValue = Math.max(maxStudents, maxTeachers, 1);
  const yAxisUpperBound = yMaxValue <= 5 ? yMaxValue : Math.ceil(yMaxValue * 1.1);
  const yAxisTicks = Array.from({ length: yAxisUpperBound + 1 }, (_, index) => index);
  const attendance = data?.attendanceDistribution || {};
  const attendancePieData = [
    {
      key: 'present',
      name: 'Present',
      value: toNumber(attendance?.present, 0),
      percent: toNumber(attendance?.presentPct, 0),
      color: ATTENDANCE_COLORS.present,
    },
    {
      key: 'absent',
      name: 'Absent',
      value: toNumber(attendance?.absent, 0),
      percent: toNumber(attendance?.absentPct, 0),
      color: ATTENDANCE_COLORS.absent,
    },
    {
      key: 'late',
      name: 'Late',
      value: toNumber(attendance?.late, 0),
      percent: toNumber(attendance?.latePct, 0),
      color: ATTENDANCE_COLORS.late,
    },
  ];
  const hasAttendanceData = attendancePieData.some((item) => item.value > 0);
  const attendanceChartData = hasAttendanceData
    ? attendancePieData
    : attendancePieData.map((item) => ({ ...item, value: 1, percent: 0 }));
  const assignmentBars = Array.isArray(data?.assignmentSubmissions)
    ? data.assignmentSubmissions
    : [];
  const assignmentBarsDisplay =
    assignmentBars.length > 0
      ? assignmentBars
      : Array.from({ length: 4 }, (_, index) => ({
          week: `Week ${index + 1}`,
          submitted: 0,
          pending: 0,
        }));
  const hasAssignmentBars = assignmentBars.some(
    (item) => Number(item?.submitted || 0) || Number(item?.pending || 0)
  );
  const performanceBars = Array.isArray(data?.studentPerformanceBandsByGradeLevel)
    ? data.studentPerformanceBandsByGradeLevel
    : [];
  const performanceBarsDisplay =
    performanceBars.length > 0
      ? performanceBars
      : [{ gradeLevel: 'N/A', excellent: 0, good: 0, average: 0, needsImprovement: 0 }];
  const hasPerformanceBars = performanceBars.some(
    (item) =>
      Number(item?.excellent || 0) ||
      Number(item?.good || 0) ||
      Number(item?.average || 0) ||
      Number(item?.needsImprovement || 0)
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.label}
              className="flex items-start justify-between rounded-[10px] border border-[#d6e3fb] bg-white p-4"
            >
              <div>
                <p className="m-0 text-[13px] text-[#6880b8]">{item.label}</p>
                <h3 className="my-2 text-[48px] font-bold leading-none text-[#1f3f93]">
                  {valueByKey[item.label] ?? item.value}
                </h3>
                <span className="text-[13px] font-medium text-[#7b91be]">
                  {isError ? 'Failed to load data' : item.note}
                </span>
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

      <article className="rounded-[10px] border border-[#d6e3fb] bg-white p-4">
        <h3 className="mb-3 text-[34px] font-semibold leading-none text-[#1f3f93]">Daily Activity Trend</h3>
        {isLoading ? (
          <div className="grid h-[360px] place-items-center rounded-[10px] border border-dashed border-[#c7d8f7] bg-[#f9fbff] text-sm text-[#7b91be]">
            Loading chart...
          </div>
        ) : isError ? (
          <div className="grid h-[360px] place-items-center rounded-[10px] border border-dashed border-[#c7d8f7] bg-[#f9fbff] text-sm text-[#7b91be]">
            Failed to load chart data
          </div>
        ) : !hasChartData ? (
          <div className="grid h-[360px] place-items-center rounded-[10px] border border-dashed border-[#c7d8f7] bg-[#f9fbff] text-sm text-[#7b91be]">
            No chart data in last 7 days
          </div>
        ) : (
          <div className="h-[360px] w-full rounded-[10px] border border-dashed border-[#c7d8f7] bg-[#f9fbff] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#d9e6ff" strokeDasharray="4 4" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#4f66a0', fontSize: 12 }}
                  axisLine={{ stroke: '#d9e6ff' }}
                  tickLine={{ stroke: '#d9e6ff' }}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, yAxisUpperBound]}
                  ticks={yAxisTicks}
                  tick={{ fill: '#6f84b4', fontSize: 12 }}
                  axisLine={{ stroke: '#d9e6ff' }}
                  tickLine={{ stroke: '#d9e6ff' }}
                />
                <Tooltip />
                <Legend />
                <Line
                  type="linear"
                  dataKey="teachers"
                  name="Teachers"
                  stroke="#12b886"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#ffffff', stroke: '#12b886', strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
                <Line
                  type="linear"
                  dataKey="students"
                  name="Students"
                  stroke="#224599"
                  strokeWidth={2.2}
                  dot={{ r: 3, fill: '#ffffff', stroke: '#224599', strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-[10px] border border-[#d6e3fb] bg-white p-4">
          <h3 className="mb-3 text-[30px] font-semibold leading-none text-[#1f3f93]">
            Attendance Distribution
          </h3>
          {isLoading ? (
            <div className="grid h-[260px] place-items-center rounded-[10px] border border-dashed border-[#c7d8f7] bg-[#f9fbff] text-sm text-[#7b91be]">
              Loading attendance...
            </div>
          ) : isError ? (
            <div className="grid h-[260px] place-items-center rounded-[10px] border border-dashed border-[#c7d8f7] bg-[#f9fbff] text-sm text-[#7b91be]">
              Failed to load attendance data
            </div>
          ) : (
            <div className="rounded-[10px] border border-dashed border-[#c7d8f7] bg-[#f9fbff] p-3">
              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attendanceChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={78}
                      label={(entry) => `${entry.name}: ${entry.percent}%`}
                      labelLine={false}
                    >
                      {attendanceChartData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {!hasAttendanceData && (
                <p className="mb-2 text-center text-xs text-[#7b91be]">
                  No attendance records in selected range
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-sm">
                {attendancePieData.map((item) => (
                  <div key={item.key} className="inline-flex items-center gap-2 text-[#17367a]">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>
                      {item.name}: {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        <article className="rounded-[10px] border border-[#d6e3fb] bg-white p-4">
          <h3 className="mb-3 text-[30px] font-semibold leading-none text-[#1f3f93]">Assignment Submissions</h3>
          {isLoading ? (
            <div className="grid h-[260px] place-items-center rounded-[10px] border border-dashed border-[#c7d8f7] bg-[#f9fbff] text-sm text-[#7b91be]">
              Loading submissions...
            </div>
          ) : isError ? (
            <div className="grid h-[260px] place-items-center rounded-[10px] border border-dashed border-[#c7d8f7] bg-[#f9fbff] text-sm text-[#7b91be]">
              Failed to load submissions
            </div>
          ) : (
            <div className="h-[260px] rounded-[10px] border border-dashed border-[#c7d8f7] bg-[#f9fbff] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assignmentBarsDisplay} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="#d9e6ff" strokeDasharray="4 4" />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: '#4f66a0', fontSize: 12 }}
                    axisLine={{ stroke: '#d9e6ff' }}
                    tickLine={{ stroke: '#d9e6ff' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#6f84b4', fontSize: 12 }}
                    axisLine={{ stroke: '#d9e6ff' }}
                    tickLine={{ stroke: '#d9e6ff' }}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="submitted"
                    name="Submitted"
                    fill="#19b37b"
                    radius={[4, 4, 0, 0]}
                    minPointSize={2}
                  />
                  <Bar
                    dataKey="pending"
                    name="Pending"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                    minPointSize={2}
                  />
                </BarChart>
              </ResponsiveContainer>
              {!hasAssignmentBars && (
                <p className="mt-1 text-center text-xs text-[#7b91be]">
                  No assignment submissions in selected range
                </p>
              )}
            </div>
          )}
        </article>
      </div>

      <article className="rounded-[10px] border border-[#d6e3fb] bg-white p-4">
        <h3 className="mb-3 text-[30px] font-semibold leading-none text-[#1f3f93]">
          Student Performance by Grade Level
        </h3>
        {isLoading ? (
          <div className="grid h-[320px] place-items-center rounded-[10px] border border-dashed border-[#c7d8f7] bg-[#f9fbff] text-sm text-[#7b91be]">
            Loading performance data...
          </div>
        ) : isError ? (
          <div className="grid h-[320px] place-items-center rounded-[10px] border border-dashed border-[#c7d8f7] bg-[#f9fbff] text-sm text-[#7b91be]">
            Failed to load performance data
          </div>
        ) : (
          <div className="h-[320px] rounded-[10px] border border-dashed border-[#c7d8f7] bg-[#f9fbff] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceBarsDisplay} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#d9e6ff" strokeDasharray="4 4" />
                <XAxis
                  dataKey="gradeLevel"
                  tick={{ fill: '#4f66a0', fontSize: 12 }}
                  axisLine={{ stroke: '#d9e6ff' }}
                  tickLine={{ stroke: '#d9e6ff' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#6f84b4', fontSize: 12 }}
                  axisLine={{ stroke: '#d9e6ff' }}
                  tickLine={{ stroke: '#d9e6ff' }}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="excellent" name="Excellent" stackId="score" fill="#19b37b" />
                <Bar dataKey="good" name="Good" stackId="score" fill="#3b82f6" />
                <Bar dataKey="average" name="Average" stackId="score" fill="#f59e0b" />
                <Bar
                  dataKey="needsImprovement"
                  name="Needs Improvement"
                  stackId="score"
                  fill="#ef4444"
                />
              </BarChart>
            </ResponsiveContainer>
            {!hasPerformanceBars && (
              <p className="mt-1 text-center text-xs text-[#7b91be]">
                No graded submissions in selected range
              </p>
            )}
          </div>
        )}
      </article>
    </div>
  );
};

export default AnalyticsOverviewPage;
