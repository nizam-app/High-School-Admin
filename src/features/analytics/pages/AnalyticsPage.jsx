import { NavLink, Outlet } from 'react-router';

const tabButtonClass = 'h-10 rounded-md text-sm font-semibold flex items-center justify-center';

const AnalyticsPage = () => {
  return (
    <section className="flex flex-col gap-4">
      <div className="w-full max-w-[520px] rounded-[10px] border border-[#d6e3fb] bg-white p-1">
        <div className="grid grid-cols-3 gap-1">
          <NavLink
            to="/analytics"
            end
            className={({ isActive }) =>
              `${tabButtonClass} ${isActive ? 'bg-[#1f3f93] text-white' : 'text-[#17367a]'}`
            }
          >
            Overview
          </NavLink>
          <NavLink
            to="/analytics/student-progress"
            className={({ isActive }) =>
              `${tabButtonClass} ${isActive ? 'bg-[#1f3f93] text-white' : 'text-[#17367a]'}`
            }
          >
            Student Progress
          </NavLink>
          <NavLink
            to="/analytics/teacher-activity"
            className={({ isActive }) =>
              `${tabButtonClass} ${isActive ? 'bg-[#1f3f93] text-white' : 'text-[#17367a]'}`
            }
          >
            Teacher Activity
          </NavLink>
        </div>
      </div>
      <Outlet />
    </section>
  );
};

export default AnalyticsPage;
