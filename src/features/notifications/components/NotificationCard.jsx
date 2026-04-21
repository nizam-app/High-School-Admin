import { CalendarDays, Clock, Eye, Target, Users } from 'lucide-react';

const tagStyles = {
  Sent: 'bg-emerald-100 text-emerald-700',
  Scheduled: 'bg-blue-100 text-blue-700',
  Draft: 'bg-slate-100 text-slate-600',
  Push: 'bg-indigo-100 text-indigo-700',
  Announcement: 'bg-sky-100 text-sky-700',
  Announcements: 'bg-sky-100 text-sky-700',
  Automated: 'bg-violet-100 text-violet-700',
  Priority: 'bg-rose-100 text-rose-700',
  'High Priority': 'bg-rose-100 text-rose-700',
};

const NotificationCard = ({ notification }) => {
  const hasSent = notification.tags.some((tag) => tag.toLowerCase() === 'sent');
  const hasScheduled = notification.tags.some((tag) => tag.toLowerCase() === 'scheduled');

  return (
    <article className="flex flex-col gap-4 rounded-[16px] border border-[#d6e3fb] bg-white p-4 shadow-[0_6px_18px_rgba(31,63,147,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-[14px] bg-[#ff3b3b] text-white">
            {notification.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-[18px] font-semibold text-[#18357a]">{notification.title}</h3>
              {notification.tags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                    tagStyles[tag] || 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="m-0 mt-2 text-sm text-[#5b73a8]">{notification.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-[#5d73a8]">
              <span className="inline-flex items-center gap-1.5">
                <Target size={14} />
                {notification.target}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users size={14} />
                Recipients: {notification.recipients}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} />
                {notification.date}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} />
                {notification.time}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Eye size={14} />
                {notification.read}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasSent && (
            <button
              type="button"
              className="rounded-[12px] border border-[#d6e3fb] bg-[#eef4ff] px-4 py-2 text-xs font-semibold text-[#1f3f93]"
            >
              View Stats
            </button>
          )}
          {hasScheduled && (
            <>
              <button
                type="button"
                className="rounded-[12px] border border-[#d6e3fb] bg-[#eef4ff] px-4 py-2 text-xs font-semibold text-[#1f3f93]"
              >
                Reschedule
              </button>
              <button
                type="button"
                className="rounded-[12px] border border-[#ffd4d4] bg-[#ffecec] px-4 py-2 text-xs font-semibold text-[#d93636]"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
};

export default NotificationCard;
