import { createBrowserRouter } from 'react-router';
import DashboardLayout from '../layouts/DashboardLayout/DashboardLayout';
import DashboardPage from '../features/dashboard/pages/DashboardPage';
import UserManagementPage from '../features/users/pages/UserManagementPage';
import ClassesContentPage from '../features/classes/pages/ClassesContentPage';
import AnalyticsPage from '../features/analytics/pages/AnalyticsPage';
import AnalyticsOverviewPage from '../features/analytics/pages/AnalyticsOverviewPage';
import AnalyticsStudentProgressPage from '../features/analytics/pages/AnalyticsStudentProgressPage';
import AnalyticsTeacherActivityPage from '../features/analytics/pages/AnalyticsTeacherActivityPage';
import TimetablePage from '../features/timetable/pages/TimetablePage';
import GeneralTimetablePage from '../features/timetable/pages/GeneralTimetablePage';
import ClassSpecificTimetablePage from '../features/timetable/pages/ClassSpecificTimetablePage';
import LiveSessionsPage from '../features/liveSessions/pages/LiveSessionsPage';
import NotificationsPage from '../features/notifications/pages/NotificationsPage';
import SettingsPage from '../features/settings/pages/SettingsPage';
import LoginPage from '../features/auth/pages/LoginPage';
import RequireAuth from '../features/auth/components/RequireAuth';
import GuestOnly from '../features/auth/components/GuestOnly';

export const router = createBrowserRouter(
  [
    {
      Component: GuestOnly,
      children: [
        {
          path: '/auth/login',
          Component: LoginPage,
        },
      ],
    },
    {
      Component: RequireAuth,
      children: [
        {
          path: '/',
          Component: DashboardLayout,
          children: [
            {
              index: true,
              Component: DashboardPage,
            },
            {
              path: 'users',
              Component: UserManagementPage,
            },
            {
              path: 'classes-content',
              Component: ClassesContentPage,
            },
            {
              path: 'analytics',
              Component: AnalyticsPage,
              children: [
                {
                  index: true,
                  Component: AnalyticsOverviewPage,
                },
                {
                  path: 'student-progress',
                  Component: AnalyticsStudentProgressPage,
                },
                {
                  path: 'teacher-activity',
                  Component: AnalyticsTeacherActivityPage,
                },
              ],
            },
            {
              path: 'timetable',
              Component: TimetablePage,
              children: [
                {
                  index: true,
                  Component: GeneralTimetablePage,
                },
                {
                  path: 'general',
                  Component: GeneralTimetablePage,
                },
                {
                  path: 'class-specific',
                  Component: ClassSpecificTimetablePage,
                },
              ],
            },
            {
              path: 'live-sessions',
              Component: LiveSessionsPage,
            },
            {
              path: 'notifications',
              Component: NotificationsPage,
            },
            {
              path: 'settings',
              Component: SettingsPage,
            },
          ],
        },
      ],
    },
  ],
  {
    basename: '/admin',
  }
);
