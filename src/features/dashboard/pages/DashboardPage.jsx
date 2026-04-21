import { BookOpen, CalendarDays, ChartLine, Users, Video } from 'lucide-react';
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
import { useDashboardOverview } from '../hooks/useDashboardOverview';

const stats = [
  { key: 'students', label: 'Total Students', icon: Users },
  { key: 'teachers', label: 'Total Teachers', icon: Users },
  { key: 'classes', label: 'Active Classes', icon: BookOpen },
  { key: 'sessions', label: 'Live Sessions Today', icon: Video },
  { key: 'assignments', label: 'Assignments Pending', icon: CalendarDays },
  { key: 'engagement', label: 'Engagement Rate', icon: ChartLine, suffix: '%' },
];

const PIE_COLORS = ['#274698', '#4568ba', '#5e98e2', '#84b0e2', '#a8c7ee', '#c2d9f8'];

const WeeklyActivityChart = ({ weekly }) => {
  const labels = weekly?.labels?.length ? weekly.labels : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const chartData = labels.map((label, index) => ({
    day: label,
    students: Number(weekly?.students?.[index] ?? 0),
    teachers: Number(weekly?.teachers?.[index] ?? 0),
  }));
  const hasData = chartData.some((item) => item.students || item.teachers);

  if (!hasData) {
    return (
      <div className="grid h-60 place-items-center rounded-lg border border-dashed border-[#bfd1f3] text-sm text-[#7b91be]">
        No weekly activity data yet
      </div>
    );
  }

  return (
    <div className="h-[290px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#d9e6ff" strokeDasharray="4 4" />
          <XAxis
            dataKey="day"
            tick={{ fill: '#4f66a0', fontSize: 12 }}
            axisLine={{ stroke: '#d9e6ff' }}
            padding={{ left: 0, right: 0 }}
          />
          <YAxis tick={{ fill: '#6f84b4', fontSize: 12 }} axisLine={{ stroke: '#d9e6ff' }} />
          <Tooltip />
          <Legend />
          <Line
            type="linear"
            dataKey="students"
            stroke="#224599"
            strokeWidth={2.2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            type="linear"
            dataKey="teachers"
            stroke="#4f8ff7"
            strokeWidth={1.8}
            dot={{ r: 2.8 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const GradeDistributionChart = ({ data }) => {
  const safeData = (data || []).filter((item) => Number(item?.value) > 0);
  if (!safeData.length) {
    return (
      <div className="grid min-h-[230px] place-items-center rounded-lg border border-dashed border-[#bfd1f3] text-sm text-[#7b91be]">
        No distribution data yet
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={safeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
            {safeData.map((entry, index) => (
              <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

const SubjectPerformanceChart = ({ data }) => {
  const safeData = (data || []).filter((item) => Number.isFinite(Number(item?.score)));
  if (!safeData.length) {
    return (
      <div className="grid h-60 place-items-center rounded-lg border border-dashed border-[#bfd1f3] text-sm text-[#7b91be]">
        No subject performance data yet
      </div>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={safeData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#d9e6ff" strokeDasharray="4 4" />
          <XAxis dataKey="subject" tick={{ fill: '#4f66a0', fontSize: 12 }} axisLine={{ stroke: '#d9e6ff' }} />
          <YAxis tick={{ fill: '#6f84b4', fontSize: 12 }} axisLine={{ stroke: '#d9e6ff' }} />
          <Tooltip />
          <Bar dataKey="score" fill="#274698" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const DashboardPage = () => {
  const { data, isLoading, isError } = useDashboardOverview();
  const statsData = data?.stats ?? {};
  const changesData = data?.changes ?? {};
  const weeklyData = data?.weekly ?? {};
  const gradeDistribution = data?.gradeDistribution ?? [];
  const subjectPerformance = data?.subjectPerformance ?? [];

  const getStatValue = (stat) => {
    if (isLoading) return '...';
    const rawValue = statsData[stat.key];
    if (rawValue === null || rawValue === undefined || rawValue === '') return '--';
    return stat.suffix ? `${rawValue}${stat.suffix}` : rawValue;
  };

  const getChangeText = (statKey) => {
    if (isLoading) return 'Loading data...';
    if (isError) return 'Failed to load backend data';
    return changesData[statKey];
  };

  const getChangeColorClass = (statKey) => {
    if (isLoading || isError) return 'text-[#7b91be]';
    const text = String(changesData[statKey] || '').trim();
    if (text.startsWith('-')) return 'text-red-600';
    if (text.startsWith('+')) return 'text-[#0ca65f]';
    return 'text-[#7b91be]';
  };

  return (
    <section className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2 2xl:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article
              key={stat.key}
              className="flex items-start justify-between rounded-[10px] border border-[#d6e3fb] bg-white p-4"
            >
              <div>
                <p className="m-0 text-[13px] text-[#6880b8]">{stat.label}</p>
                <h3 className="my-2 text-[48px] font-bold leading-none text-[#1f3f93]">
                  {getStatValue(stat)}
                </h3>
                <span className={`text-[13px] font-medium ${getChangeColorClass(stat.key)}`}>
                  {getChangeText(stat.key)}
                </span>
              </div>
              <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-[#ebf1fe] text-[#1f4ca8]">
                <Icon size={18} />
              </span>
            </article>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
        <article className="min-h-[300px] rounded-[10px] border border-[#d6e3fb] bg-white p-4">
          <h3 className="mb-3 text-[24px] font-semibold leading-none text-[#1f3f93]">Weekly Activity</h3>
          {isError ? (
            <div className="grid h-60 place-items-center rounded-lg border border-dashed border-[#bfd1f3] text-sm text-[#7b91be]">
              Failed to load weekly activity
            </div>
          ) : (
            <WeeklyActivityChart weekly={weeklyData} />
          )}
        </article>

        <article className="min-h-[240px] rounded-[10px] border border-[#d6e3fb] bg-white p-4">
          <h3 className="mb-3 text-[24px] font-semibold leading-none text-[#1f3f93]">
            Student Distribution by Grade
          </h3>
          {isError ? (
            <div className="grid min-h-[230px] place-items-center rounded-lg border border-dashed border-[#bfd1f3] text-sm text-[#7b91be]">
              Failed to load grade distribution
            </div>
          ) : (
            <GradeDistributionChart data={gradeDistribution} />
          )}
        </article>

        <article className="min-h-[300px] rounded-[10px] border border-[#d6e3fb] bg-white p-4">
          <h3 className="mb-3 text-[24px] font-semibold leading-none text-[#1f3f93]">
            Average Subject Performance
          </h3>
          {isError ? (
            <div className="grid h-60 place-items-center rounded-lg border border-dashed border-[#bfd1f3] text-sm text-[#7b91be]">
              Failed to load subject performance
            </div>
          ) : (
            <SubjectPerformanceChart data={subjectPerformance} />
          )}
        </article>

        <article className="min-h-[240px] rounded-[10px] border border-[#d6e3fb] bg-white p-4">
          <h3 className="mb-3 text-[24px] font-semibold leading-none text-[#1f3f93]">Recent Activities</h3>
          <div className="grid min-h-[230px] place-items-center rounded-lg border border-dashed border-[#bfd1f3] text-sm text-[#7b91be]">
            No recent activity yet
          </div>
        </article>
      </div>
    </section>
  );
};

export default DashboardPage;
