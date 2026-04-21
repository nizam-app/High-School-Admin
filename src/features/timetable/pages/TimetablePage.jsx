import { NavLink, Outlet } from 'react-router';

const tabs = [
  { label: 'General Timetable', to: 'general' },
  { label: 'Class-Specific', to: 'class-specific' },
];

const TimetablePage = () => {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `rounded-[10px] border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'border-[#1f3f93] bg-[#1f3f93] text-white shadow-[0_4px_10px_rgba(31,63,147,0.25)]'
                  : 'border-[#d6e3fb] bg-white text-[#17367a] hover:border-[#1f3f93] hover:text-[#1f3f93]'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
};

export default TimetablePage;
