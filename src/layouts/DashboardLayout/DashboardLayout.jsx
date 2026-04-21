import { NavLink, Outlet, useLocation } from 'react-router';
import { BarChart3, Bell, BookOpen, CalendarDays, Gauge, Settings, Users, Video } from 'lucide-react';
import logo from '../../assets/logo.png';
import { useAuth } from '../../features/auth/context/AuthContext';

const navItems = [
  { label: 'Dashboard', icon: Gauge, to: '/' },
  { label: 'User Management', icon: Users, to: '/users' },
  { label: 'Classes & Content', icon: BookOpen, to: '/classes-content' },
  { label: 'Analytics', icon: BarChart3, to: '/analytics' },
  { label: 'Live Sessions', icon: Video, to: '/live-sessions' },
  { label: 'Timetable', icon: CalendarDays, to: '/timetable' },
  { label: 'Notifications', icon: Bell, to: '/notifications' },
  { label: 'Settings', icon: Settings, to: '/settings' },
];

const DashboardLayout = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const adminName = user?.name || 'Admin User';
  const adminPhone = user?.phone || '';
  const avatarLetter = adminName.charAt(0).toUpperCase() || 'A';
  const pageTitleMap = {
    '/': 'Dashboard Overview',
    '/users': 'User Management',
    '/classes-content': 'Classes & Content',
    '/analytics': 'Analytics',
    '/timetable': 'Timetable',
    '/live-sessions': 'Live Sessions',
    '/notifications': 'Notifications Center',
    '/settings': 'App Settings',
  };
  const pageTitle = location.pathname.startsWith('/analytics')
    ? 'Analytics'
    : location.pathname.startsWith('/timetable')
    ? 'Timetable'
    : location.pathname.startsWith('/live-sessions')
    ? 'Live Sessions'
    : location.pathname.startsWith('/notifications')
    ? 'Notifications Center'
    : location.pathname.startsWith('/settings')
    ? 'App Settings'
    : pageTitleMap[location.pathname] || 'Dashboard Overview';

  return (
    <div className="min-h-screen bg-[#f3f7fe] text-[#17367a]">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[270px_1fr] xl:grid-cols-[270px_1fr]">
        <aside className="border-r border-[#d6e3fb] bg-[#f8fbff] p-3 md:flex md:flex-col md:gap-3">
          <div className="flex min-h-[140px] items-center justify-center rounded-sm bg-white p-4 md:min-h-[140px]">
            <img src={logo} alt="Guerini" className="h-24 w-24 object-contain" />
          </div>

          <nav className="mt-1 flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex h-11 items-center gap-2.5 rounded-[10px] px-3 text-left text-sm ${
                      isActive
                        ? 'bg-[#1f3f93] text-white shadow-[0_4px_10px_rgba(31,63,147,0.25)]'
                        : 'text-[#17367a]'
                    }`
                  }
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[10px] border border-[#d6e3fb] p-2.5 text-[#6f84b4]">
            <p className="m-0 text-xs">Version</p>
            <strong className="text-[13px] text-[#17367a]">1.0.0</strong>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="flex h-[68px] items-center justify-between border-b border-[#d6e3fb] bg-[#f8fbff] px-5">
            <h1 className="m-0 text-[32px] font-bold leading-none tracking-[0.2px] text-[#1f3f93]">
              {pageTitle}
            </h1>
            <div className="flex items-center gap-3">
              <div>
                <strong className="block text-right text-[13px]">{adminName}</strong>
                <p className="m-0 text-[11px] text-[#6f84b4]">{adminPhone}</p>
              </div>
              <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#1f3f93] font-semibold text-white">
                {avatarLetter}
              </span>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-[#d6e3fb] bg-white px-3 py-1.5 text-xs font-semibold text-[#1f3f93]"
              >
                Logout
              </button>
            </div>
          </header>

          <main className="p-5">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
