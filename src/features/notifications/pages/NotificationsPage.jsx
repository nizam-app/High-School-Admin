import { useMemo, useState } from 'react';
import { Bell, CalendarClock, Megaphone, Percent, Plus, Send, Sparkles, Users } from 'lucide-react';
import NotificationsLayout from '../components/NotificationsLayout';
import NotificationList from '../components/NotificationList';
import NotificationModal from '../components/NotificationModal';

const statusTabs = ['All', 'Sent', 'Scheduled', 'Drafts'];
const typeTabs = ['All Types', 'Push', 'Announcements', 'Automated'];

const stats = [
  { label: 'Sent Today', value: '3', icon: Send },
  { label: 'Scheduled', value: '2', icon: CalendarClock },
  { label: 'Total Recipients', value: '3,052', icon: Users },
  { label: 'Read Rate', value: '82%', icon: Percent },
];

const initialNotifications = [
  {
    id: 'ntf-1',
    title: 'Midterm Reminder',
    description: 'Reminder: Midterm exams start next Monday for all grades.',
    tags: ['Sent', 'Push', 'High Priority'],
    target: 'Target: All Students',
    recipients: '2,847',
    date: '2026-03-27',
    time: '09:00',
    read: 'Read: 2,134 (75%)',
    icon: <Bell size={20} />,
  },
  {
    id: 'ntf-2',
    title: 'Parent-Teacher Meeting',
    description: 'PTM scheduled for next week. Please confirm attendance.',
    tags: ['Scheduled', 'Announcements', 'High Priority'],
    target: 'Target: All Parents',
    recipients: '2,947',
    date: '2026-03-28',
    time: '10:30',
    read: 'Read: --',
    icon: <Megaphone size={20} />,
  },
  {
    id: 'ntf-3',
    title: 'Weekly Attendance Summary',
    description: 'Automated report for attendance is ready for review.',
    tags: ['Sent', 'Automated'],
    target: 'Target: All Teachers',
    recipients: '143',
    date: '2026-03-27',
    time: '08:15',
    read: 'Read: 88 (61%)',
    icon: <Sparkles size={20} />,
  },
];

const getFormattedDateTime = () => {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const time = [String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0')].join(
    ':'
  );
  return { date, time };
};

const NotificationsPage = () => {
  const [activeStatus, setActiveStatus] = useState('All');
  const [activeType, setActiveType] = useState('All Types');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState(initialNotifications);

  const filteredNotifications = useMemo(() => {
    return notificationItems.filter((notification) => {
      const statusMatch =
        activeStatus === 'All' ||
        notification.tags.some((tag) => tag.toLowerCase() === activeStatus.toLowerCase());
      const typeMatch =
        activeType === 'All Types' ||
        notification.tags.some((tag) => tag.toLowerCase() === activeType.toLowerCase());
      return statusMatch && typeMatch;
    });
  }, [activeStatus, activeType, notificationItems]);

  const handleCreateNotification = ({
    action,
    title,
    message,
    typeTag,
    targetLabel,
    recipients,
    priorityTag,
    icon,
  }) => {
    const { date, time } = getFormattedDateTime();
    const statusTag = action === 'sent' ? 'Sent' : action === 'scheduled' ? 'Scheduled' : 'Draft';
    const tags = [statusTag, typeTag];
    if (priorityTag) tags.push(priorityTag);

    const newNotification = {
      id: `ntf-${Date.now()}`,
      title: title || 'Untitled Notification',
      description: message || 'No message provided.',
      tags,
      target: `Target: ${targetLabel}`,
      recipients,
      date,
      time,
      read: action === 'sent' ? 'Read: 0 (0%)' : 'Read: --',
      icon,
    };

    setNotificationItems((prev) => [newNotification, ...prev]);
  };

  return (
    <NotificationsLayout actions={null}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="w-full max-w-[520px] rounded-[10px] border border-[#d6e3fb] bg-white p-1">
              <div className="grid grid-cols-4 gap-1">
                {statusTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveStatus(tab)}
                    className={`h-10 rounded-md text-sm font-semibold ${
                      activeStatus === tab ? 'bg-[#1f3f93] text-white' : 'text-[#17367a]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#1f3f93] px-5 font-semibold leading-none text-white"
            >
              <Plus size={16} />
              New Notification
            </button>
          </div>

          <div className="w-full max-w-[520px] rounded-[10px] border border-[#d6e3fb] bg-white p-1">
            <div className="grid grid-cols-4 gap-1">
              {typeTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveType(tab)}
                  className={`h-10 rounded-md text-sm font-semibold ${
                    activeType === tab ? 'bg-[#1f3f93] text-white' : 'text-[#17367a]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <article
                key={stat.label}
                className="flex items-center justify-between rounded-[14px] border border-[#d6e3fb] bg-white p-4"
              >
                <div>
                  <p className="m-0 text-[13px] text-[#6f84b4]">{stat.label}</p>
                  <h3 className="m-0 mt-2 text-[26px] font-bold text-[#1f3f93]">{stat.value}</h3>
                </div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#eaf1ff] text-[#1f3f93]">
                  <Icon size={20} />
                </span>
              </article>
            );
          })}
        </div>

        <NotificationList notifications={filteredNotifications} />
      </div>

      <NotificationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={(payload) => {
          handleCreateNotification(payload);
          setIsModalOpen(false);
        }}
      />
    </NotificationsLayout>
  );
};

export default NotificationsPage;
