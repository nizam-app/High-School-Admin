import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Clock3, Pencil, Play, Users, Video, X } from 'lucide-react';
import Swal from 'sweetalert2';
import {
  approveLiveSession,
  cancelLiveSession,
  createLiveSession,
  rejectLiveSession,
  updateLiveSession,
} from '../api/liveSessionsApi';
import { getGrades, getSubjects, getUsers } from '../../users/api/usersApi';
import { useLiveSessions, useLiveSessionsStats } from '../hooks/useLiveSessions';

const metrics = [
  { key: 'todaySessions', label: "Today's Sessions", icon: Video, valueColor: 'text-[#183e95]', iconColor: 'text-[#133f94]' },
  { key: 'liveNow', label: 'Live', icon: Play, valueColor: 'text-[#05914b]', iconColor: 'text-[#1f7a3f]' },
  { key: 'scheduledSessions', label: 'Scheduled', icon: CalendarDays, valueColor: 'text-[#1d5eff]', iconColor: 'text-[#1d5eff]' },
  { key: 'pendingApproval', label: 'Pending Approval', icon: Clock3, valueColor: 'text-[#d18400]', iconColor: 'text-[#c48a1f]' },
  { key: 'completedSessions', label: 'Completed', icon: Check, valueColor: 'text-[#5b6b86]', iconColor: 'text-[#5b6b86]' },
  { key: 'avgAttendance', label: 'Avg Attendance', icon: Users, valueColor: 'text-[#183e95]', iconColor: 'text-[#133f94]' },
];

const tabs = [
  { key: 'all', label: 'All Sessions' },
  { key: 'today', label: 'Today' },
  { key: 'pending', label: 'Pending' },
  { key: 'live', label: 'Live' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
];

const PAGE_SIZE = 5;

const getSessionSortTime = (session) => {
  const rawCreatedAt = String(session?.createdAt || '').trim();
  if (rawCreatedAt) {
    const parsedCreatedAt = Date.parse(rawCreatedAt);
    if (Number.isFinite(parsedCreatedAt)) return parsedCreatedAt;
  }

  const rawDate = String(session?.date || '').trim();
  const rawTime = String(session?.time || '').trim();

  if (rawDate) {
    const safeDate = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : rawDate;
    const timeMatch = rawTime.match(/\d{1,2}:\d{2}/);
    if (safeDate && timeMatch) {
      const combined = `${safeDate}T${timeMatch[0]}:00`;
      const parsed = Date.parse(combined);
      if (Number.isFinite(parsed)) return parsed;
    }

    const parsedDate = Date.parse(rawDate);
    if (Number.isFinite(parsedDate)) return parsedDate;
  }

  return 0;
};

const getStatusStyles = (status) => {
  const normalizedStatus = String(status || '').toLowerCase();

  if (normalizedStatus.includes('ongoing') || normalizedStatus.includes('live')) {
    return {
      chip: 'bg-[#def6e6] text-[#0a8b45]',
      dot: 'bg-[#e11d48]',
      label: 'Live',
    };
  }

  if (normalizedStatus.includes('completed')) {
    return {
      chip: 'bg-[#eef2f7] text-[#53627c]',
      dot: '',
      label: 'Completed',
    };
  }

  if (normalizedStatus.includes('pending')) {
    return {
      chip: 'bg-[#fff3cc] text-[#a56a00]',
      dot: '',
      label: 'Pending',
    };
  }

  return {
    chip: 'bg-[#e7f0ff] text-[#1d5eff]',
    dot: '',
    label: 'Scheduled',
  };
};

const matchesSessionTab = (session, activeTab) => {
  if (activeTab !== 'scheduled' && activeTab !== 'completed') return true;

  const normalizedStatus = String(session?.status || '').toLowerCase();
  const derivedLabel = getStatusStyles(session?.status).label.toLowerCase();

  if (activeTab === 'scheduled') {
    return derivedLabel === 'scheduled' || normalizedStatus.includes('approved');
  }

  if (activeTab === 'completed') {
    return derivedLabel === 'completed';
  }

  return true;
};

const getActionStyles = (variant, label) => {
  const key = String(variant || label || '').toLowerCase();

  if (key.includes('success') || key.includes('approve')) {
    return 'bg-[#dbf8e7] text-[#0d8f49]';
  }
  if (key.includes('danger') || key.includes('reject') || key.includes('cancel')) {
    return 'bg-[#ffe3e3] text-[#d01414]';
  }
  if (key.includes('primary') || key.includes('join')) {
    return 'bg-[#294697] text-white';
  }

  return 'bg-[#eaf1ff] text-[#2049a4]';
};

const getActionIcon = (label) => {
  const key = String(label || '').toLowerCase();

  if (key.includes('approve')) return Check;
  if (key.includes('reject') || key.includes('cancel')) return X;
  if (key.includes('edit')) return Pencil;
  return null;
};

const INITIAL_SESSION_FORM = {
  title: '',
  subject: '',
  grade: '',
  teacher: '',
  teacherId: '',
  className: '',
  date: '',
  time: '',
  duration: '',
  meetingLink: '',
};

const FILTER_PAGE_SIZE = 1000;

const LiveSessionsPage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [sessionFormValues, setSessionFormValues] = useState(INITIAL_SESSION_FORM);
  const [sessionFormError, setSessionFormError] = useState('');
  const [hiddenSessionIds, setHiddenSessionIds] = useState([]);
  const requestTab =
    activeTab === 'all' || activeTab === 'scheduled' || activeTab === 'completed' ? 'all' : activeTab;
  const requestLimit =
    activeTab === 'all' || activeTab === 'scheduled' || activeTab === 'completed'
      ? FILTER_PAGE_SIZE
      : PAGE_SIZE;
  const { data, isLoading, isError } = useLiveSessionsStats();
  const {
    data: sessionsResponse = {
      items: [],
      pagination: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 },
    },
    isLoading: isSessionsLoading,
    isError: isSessionsError,
  } = useLiveSessions({ tab: requestTab, page, limit: requestLimit });
  const { data: allSessionsResponse } = useLiveSessions({
    tab: 'all',
    page: 1,
    limit: FILTER_PAGE_SIZE,
  });
  const cancelSessionMutation = useMutation({
    mutationFn: cancelLiveSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions-stats'] });
    },
  });
  const approveSessionMutation = useMutation({
    mutationFn: approveLiveSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions-stats'] });
    },
  });
  const rejectSessionMutation = useMutation({
    mutationFn: rejectLiveSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions-stats'] });
    },
  });
  const createSessionMutation = useMutation({
    mutationFn: createLiveSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions-stats'] });
      closeSessionModal();
    },
  });
  const updateSessionMutation = useMutation({
    mutationFn: ({ id, payload }) => updateLiveSession(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions-stats'] });
      closeSessionModal();
    },
  });
  const handleJoinSession = async (session) => {
    const meetingLink = String(session?.meetingLink || '').trim();
    if (!meetingLink) {
      await Swal.fire({
        title: 'No meeting link',
        text: 'This live session does not have a meeting link yet.',
        icon: 'warning',
        confirmButtonColor: '#1f3f93',
      });
      return;
    }

    try {
      const url = new URL(meetingLink);
      window.open(url.toString(), '_blank', 'noopener,noreferrer');
    } catch {
      await Swal.fire({
        title: 'Invalid meeting link',
        text: 'Please edit the session and add a valid meeting URL.',
        icon: 'error',
        confirmButtonColor: '#1f3f93',
      });
    }
  };

  const { data: gradeOptions = [] } = useQuery({
    queryKey: ['live-sessions-form-grades'],
    queryFn: getGrades,
    staleTime: 5 * 60 * 1000,
  });

  const { data: subjectOptions = [] } = useQuery({
    queryKey: ['live-sessions-form-subjects'],
    queryFn: getSubjects,
    staleTime: 5 * 60 * 1000,
  });

  const { data: teacherUsers } = useQuery({
    queryKey: ['live-sessions-form-teachers'],
    queryFn: () => getUsers({ role: 'teacher', status: 'active', page: 1, limit: 100 }),
    staleTime: 60 * 1000,
  });

  const teacherOptions = useMemo(
    () =>
      Array.isArray(teacherUsers?.users)
        ? teacherUsers.users.map((u) => ({
            id: u.id,
            name: u.name || u.fullName || u.username || u.email || 'Teacher',
          }))
        : [],
    [teacherUsers]
  );

  const openSessionModal = (session = null) => {
    setEditingSession(session || null);
    if (session) {
      const rawDate = session.date ?? '';
      const dateOnly =
        typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)
          ? rawDate.slice(0, 10)
          : rawDate;
      const rawTime = session.time ?? '';
      const timeOnly =
        typeof rawTime === 'string' && /\d{1,2}:\d{2}/.test(rawTime)
          ? (rawTime.match(/\d{1,2}:\d{2}/)?.[0] ?? rawTime)
          : rawTime;
      setSessionFormValues({
        title: session.title ?? '',
        subject: session.subject ?? '',
        grade: session.grade ?? '',
        teacher: session.teacher ?? '',
        teacherId: session.teacherId ?? '',
        className: session.className ?? '',
        date: dateOnly,
        time: timeOnly,
        duration: session.duration ?? '',
        meetingLink: session.meetingLink ?? '',
      });
    } else {
      setSessionFormValues({ ...INITIAL_SESSION_FORM });
    }
    setSessionFormError('');
    setIsSessionModalOpen(true);
  };

  const closeSessionModal = () => {
    if (createSessionMutation.isPending || updateSessionMutation.isPending) return;
    setIsSessionModalOpen(false);
    setEditingSession(null);
    setSessionFormValues(INITIAL_SESSION_FORM);
    setSessionFormError('');
  };

  const handleSessionFormChange = (key, value) => {
    setSessionFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleTeacherChange = (value) => {
    const selected = teacherOptions.find((t) => String(t.id) === String(value));
    setSessionFormValues((prev) => ({
      ...prev,
      teacherId: value,
      teacher: selected?.name || prev.teacher,
    }));
  };

  const handleSessionSubmit = (event) => {
    event.preventDefault();
    setSessionFormError('');
    if (updateSessionMutation.isPending || createSessionMutation.isPending) return;
    const { title, subject, grade, teacher, teacherId, className, date, time, duration, meetingLink } =
      sessionFormValues;
    if (!String(title || '').trim()) {
      setSessionFormError('Title is required.');
      return;
    }
    if (editingSession?.id) {
      const sessionId = editingSession.id;
      updateSessionMutation.mutate(
        {
          id: sessionId,
          payload: {
            title: title.trim(),
            subject,
            grade,
            teacher,
            teacherId,
            className,
            date,
            time,
            duration,
            meetingLink,
          },
        },
        {
          onSuccess: async () => {
            await Swal.fire({
              title: 'Updated',
              text: 'Live session updated successfully.',
              icon: 'success',
              confirmButtonColor: '#1f3f93',
            });
          },
          onError: (error) => {
            const data = error?.response?.data;
            const message =
              (typeof data?.message === 'string' && data.message) ||
              (Array.isArray(data?.errors) && data.errors[0]?.message) ||
              data?.error ||
              error?.message ||
              'Failed to update session.';
            setSessionFormError(message);
          },
        }
      );
    } else {
      createSessionMutation.mutate(
        {
          title: title.trim(),
          subject,
          grade,
          teacher,
          teacherId,
          className,
          date,
          time,
          duration,
          meetingLink,
        },
        {
          onSuccess: async () => {
            await Swal.fire({
              title: 'Created',
              text: 'Live session created successfully.',
              icon: 'success',
              confirmButtonColor: '#1f3f93',
            });
          },
          onError: (error) => {
            const data = error?.response?.data;
            const message =
              (typeof data?.message === 'string' && data.message) ||
              (Array.isArray(data?.errors) && data.errors[0]?.message) ||
              data?.error ||
              error?.message ||
              'Failed to create session.';
            setSessionFormError(message);
          },
        }
      );
    }
  };

  const stats = useMemo(() => {
    if (!data || typeof data !== 'object') return {};
    const payload = data.data && typeof data.data === 'object' ? data.data : data;
    const sessionItems = Array.isArray(allSessionsResponse?.items) ? allSessionsResponse.items : [];
    const fallbackScheduledCount = sessionItems.filter(
      (session) => getStatusStyles(session?.status).label.toLowerCase() === 'scheduled'
    ).length;
    const fallbackLiveCount = sessionItems.filter(
      (session) => getStatusStyles(session?.status).label.toLowerCase() === 'live'
    ).length;
    const fallbackCompletedCount = sessionItems.filter(
      (session) => getStatusStyles(session?.status).label.toLowerCase() === 'completed'
    ).length;

    return {
      todaySessions:
        payload.todaySessions ??
        payload.todaysSessions ??
        payload.today_sessions ??
        payload.todays_sessions ??
        payload.today ??
        payload.today_sessions_count ??
        0,
      liveNow:
        payload.liveNow ?? payload.live_now ?? payload.live ?? payload.live_sessions ?? fallbackLiveCount,
      scheduledSessions:
        payload.scheduledSessions ??
        payload.scheduled_sessions ??
        payload.scheduled ??
        payload.approvedSessions ??
        payload.approved_sessions ??
        payload.approved ??
        fallbackScheduledCount,
      pendingApproval:
        payload.pendingApproval ?? payload.pending_approval ?? payload.pending ?? payload.pending_sessions ?? 0,
      completedSessions:
        payload.completedSessions ??
        payload.completed_sessions ??
        payload.completed ??
        payload.finishedSessions ??
        payload.finished_sessions ??
        payload.finished ??
        fallbackCompletedCount,
      avgAttendance:
        payload.avgAttendance ?? payload.avg_attendance ?? payload.attendance ?? payload.avg_attendance_rate ?? 0,
    };
  }, [allSessionsResponse, data]);

  const sessionRows = useMemo(
    () => {
      const items = Array.isArray(sessionsResponse?.items) ? sessionsResponse.items : [];
      const visibleItems = hiddenSessionIds.length
        ? items.filter((session) => !hiddenSessionIds.includes(session.id))
        : items;
      const filteredItems = visibleItems.filter((session) => matchesSessionTab(session, activeTab));

      return [...filteredItems].sort((a, b) => getSessionSortTime(b) - getSessionSortTime(a));
    },
    [sessionsResponse, hiddenSessionIds, activeTab]
  );

  const pagination = useMemo(() => {
    if (activeTab === 'all' || activeTab === 'scheduled' || activeTab === 'completed') {
      return {
        page: 1,
        limit: sessionRows.length || requestLimit,
        total: sessionRows.length,
        totalPages: 1,
      };
    }

    return (
      sessionsResponse?.pagination || {
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 1,
      }
    );
  }, [activeTab, requestLimit, sessionRows.length, sessionsResponse]);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    const totalPages = Number(pagination?.totalPages || 1);
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, pagination?.totalPages]);

  const getActionPendingLabel = (actionLabel) => {
    const normalizedLabel = String(actionLabel || '').toLowerCase();
    if (normalizedLabel.includes('approve')) return 'Approving...';
    if (normalizedLabel.includes('reject')) return 'Rejecting...';
    if (normalizedLabel.includes('cancel')) return 'Cancelling...';
    return actionLabel;
  };

  const isActionPending = (actionLabel) => {
    const normalizedLabel = String(actionLabel || '').toLowerCase();
    if (normalizedLabel.includes('approve')) return approveSessionMutation.isPending;
    if (normalizedLabel.includes('reject')) return rejectSessionMutation.isPending;
    if (normalizedLabel.includes('cancel')) return cancelSessionMutation.isPending;
    return false;
  };

  const handleActionClick = async (session, actionLabel) => {
    const normalizedLabel = String(actionLabel || '').toLowerCase();
    if (!session?.id || isActionPending(actionLabel)) return;

    if (normalizedLabel.includes('edit')) {
      openSessionModal(session);
      return;
    }

    if (normalizedLabel.includes('join')) {
      await handleJoinSession(session);
      return;
    }

    let config = null;
    let mutation = null;

    if (normalizedLabel.includes('approve')) {
      config = {
        title: 'Approve Session?',
        text: `Approve "${session.title}"?`,
        confirmButtonText: 'Yes, approve',
        cancelButtonText: 'Not now',
        confirmButtonColor: '#0d8f49',
        successTitle: 'Approved',
        successText: 'Live session approved successfully.',
        errorTitle: 'Approve Failed',
        errorText: 'Failed to approve live session.',
      };
      mutation = approveSessionMutation;
    } else if (normalizedLabel.includes('reject')) {
      config = {
        title: 'Reject Session?',
        text: `Reject "${session.title}"?`,
        confirmButtonText: 'Yes, reject',
        cancelButtonText: 'Keep pending',
        confirmButtonColor: '#d01414',
        cancelButtonColor: '#1f3f93',
        successTitle: 'Rejected',
        successText: 'Live session rejected successfully.',
        errorTitle: 'Reject Failed',
        errorText: 'Failed to reject live session.',
        payload: {
          id: session.id,
          reason: 'Rejected by admin',
        },
      };
      mutation = rejectSessionMutation;
    } else if (normalizedLabel.includes('cancel')) {
      config = {
        title: 'Cancel Session?',
        text: `Are you sure you want to cancel "${session.title}"?`,
        confirmButtonText: 'Yes, cancel it',
        cancelButtonText: 'Keep session',
        confirmButtonColor: '#d01414',
        successTitle: 'Cancelled',
        successText: 'Live session cancelled successfully.',
        errorTitle: 'Cancel Failed',
        errorText: 'Failed to cancel live session.',
      };
      mutation = cancelSessionMutation;
    }

    if (!config || !mutation) return;

    if (
      normalizedLabel.includes('approve') ||
      normalizedLabel.includes('cancel') ||
      normalizedLabel.includes('reject')
    ) {
      const result = await Swal.fire({
        title: config.title,
        text: config.text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: config.confirmButtonText,
        cancelButtonText: config.cancelButtonText,
        confirmButtonColor: config.confirmButtonColor,
        cancelButtonColor: '#1f3f93',
      });

      if (!result.isConfirmed) return;
    }

    mutation.mutate(config.payload ?? session.id, {
      onSuccess: async () => {
        if (normalizedLabel.includes('cancel')) {
          setHiddenSessionIds((prev) => (prev.includes(session.id) ? prev : [...prev, session.id]));
        }
        await Swal.fire({
          title: config.successTitle,
          text: config.successText,
          icon: 'success',
          confirmButtonColor: '#1f3f93',
        });
      },
      onError: async (error) => {
        const status = error?.response?.status;
        const message = error?.response?.data?.message || error?.message || config.errorText;
        await Swal.fire({
          title: config.errorTitle,
          text: status ? `(${status}) ${message}` : message,
          icon: 'error',
          confirmButtonColor: '#1f3f93',
        });
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="w-full max-w-[520px] rounded-[10px] border border-[#d6e3fb] bg-white p-1">
          <div className="grid grid-cols-3 gap-1 md:grid-cols-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`h-10 rounded-md text-sm font-semibold ${
                  activeTab === tab.key ? 'bg-[#1f3f93] text-white' : 'text-[#17367a]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => openSessionModal()}
          className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#1f3f93] px-5 font-semibold leading-none text-white"
        >
          Create Session
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const value = stats[metric.key];

          return (
            <div
              key={metric.key}
              className="rounded-xl border border-[#d6e3fb] bg-white p-4 shadow-[0_6px_18px_rgba(31,63,147,0.06)]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#6f84b4]">{metric.label}</p>
                  <p className={`mt-2 text-[40px] font-bold ${metric.valueColor}`}>
                    {isLoading ? '...' : isError ? '--' : `${value ?? 0}${metric.key === 'avgAttendance' ? '%' : ''}`}
                  </p>
                </div>
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#eef3ff] ${metric.iconColor}`}
                >
                  <Icon size={16} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        {isSessionsLoading ? (
          <div className="rounded-xl border border-dashed border-[#bfd1f3] bg-white p-6 text-center text-sm text-[#6880b0]">
            Loading live sessions list...
          </div>
        ) : isSessionsError ? (
          <div className="rounded-xl border border-dashed border-[#ffccd5] bg-white p-6 text-center text-sm text-[#a82746]">
            Failed to load live sessions list.
          </div>
        ) : sessionRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#bfd1f3] bg-white p-6 text-center text-sm text-[#6f84b4]">
            No live sessions available yet.
          </div>
        ) : (
          sessionRows.map((session, index) => {
            const statusStyles = getStatusStyles(session.status);
            const showAttendance = session.attendance !== null && session.attendance !== undefined;
            const normalizedStatus = String(session.status || '').toLowerCase();
            const isLive = normalizedStatus.includes('ongoing') || normalizedStatus.includes('live');
            const actions = Array.isArray(session.actions)
              ? session.actions.filter((action) => !String(action?.label || '').toLowerCase().includes('track'))
              : [];

            return (
              <div
                key={`${session.id}-${index}`}
                className="rounded-[18px] border border-[#d6e3fb] bg-white p-5 shadow-[0_8px_24px_rgba(31,63,147,0.07)]"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[20px] font-semibold text-[#1f3f93]">{session.title}</h3>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles.chip}`}
                      >
                        {statusStyles.dot ? <span className={`h-2.5 w-2.5 rounded-full ${statusStyles.dot}`} /> : null}
                        {statusStyles.label}
                      </span>
                      {session.subject ? (
                        <span className="rounded-full bg-[#eaf1ff] px-3 py-1 text-xs font-semibold text-[#1d5eff]">
                          {session.subject}
                        </span>
                      ) : null}
                      {session.grade ? (
                        <span className="rounded-full bg-[#eaf1ff] px-3 py-1 text-xs font-semibold text-[#1d5eff]">
                          {session.grade}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-[#556b97] md:grid-cols-2 xl:grid-cols-4">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-[#7b8fb8]" />
                        <span>{session.teacher}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays size={16} className="text-[#7b8fb8]" />
                        <span>{session.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock3 size={16} className="text-[#7b8fb8]" />
                        <span>
                          {session.time}
                          {session.duration ? ` (${session.duration})` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-[#7b8fb8]" />
                        <span>
                          {showAttendance && isLive
                            ? `${session.joinedCount}/${session.studentCount} students`
                            : `${session.studentCount} students`}
                        </span>
                      </div>
                    </div>

                    {showAttendance ? (
                      <div className="mt-5">
                        <div className="flex items-center justify-between text-sm font-semibold text-[#556b97]">
                          <span>Attendance</span>
                          <span className="text-[#1f3f93]">{session.attendance}%</span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#dfeafe]">
                          <div
                            className="h-full rounded-full bg-[#294697]"
                            style={{ width: `${Math.max(0, Math.min(100, Number(session.attendance) || 0))}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {actions.length > 0 ? (
                    <div className="flex flex-col gap-2 xl:w-[120px]">
                      {actions.map((action) => {
                        const ActionIcon = getActionIcon(action.label);

                        return (
                          <button
                            key={`${session.id}-${action.label}`}
                            type="button"
                            onClick={() => handleActionClick(session, action.label)}
                            disabled={isActionPending(action.label)}
                            className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] px-4 py-2 text-sm font-semibold ${getActionStyles(
                              action.variant,
                              action.label
                            )} disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {ActionIcon ? <ActionIcon size={16} /> : null}
                            {isActionPending(action.label) ? getActionPendingLabel(action.label) : action.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}

        <div className="flex items-center justify-between rounded-xl border border-[#d6e3fb] bg-white px-4 py-3 text-sm text-[#5f79af]">
          <p>
            Page {pagination.page || page} of {pagination.totalPages || 1} - Total {pagination.total || 0}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={
                page <= 1 ||
                isSessionsLoading ||
                activeTab === 'all' ||
                activeTab === 'scheduled' ||
                activeTab === 'completed'
              }
              className="h-9 rounded-md border border-[#d6e3fb] px-3 font-semibold text-[#1f3f93] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(prev + 1, Number(pagination.totalPages || 1)))}
              disabled={
                page >= Number(pagination.totalPages || 1) ||
                isSessionsLoading ||
                activeTab === 'all' ||
                activeTab === 'scheduled' ||
                activeTab === 'completed'
              }
              className="h-9 rounded-md border border-[#d6e3fb] px-3 font-semibold text-[#1f3f93] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {isSessionModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1d4a]/30 p-3">
          <div className="w-full max-w-[520px] rounded-xl border border-[#d6e3fb] bg-white p-6 shadow-xl">
            <form className="space-y-4" onSubmit={handleSessionSubmit}>
              <div className="flex items-center justify-between">
                <h2 className="text-[24px] font-semibold text-[#1f3f93]">
                  {editingSession ? 'Edit Session' : 'Create Session'}
                </h2>
                <button
                  type="button"
                  onClick={closeSessionModal}
                  disabled={createSessionMutation.isPending || updateSessionMutation.isPending}
                  className="rounded p-1 text-[#6f84b4] hover:bg-[#eef3ff] hover:text-[#1f3f93] disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              {sessionFormError && (
                <p className="rounded-lg bg-[#ffe3e3] px-3 py-2 text-sm text-[#d01414]">{sessionFormError}</p>
              )}

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Title *</label>
                <input
                  type="text"
                  value={sessionFormValues.title}
                  onChange={(e) => handleSessionFormChange('title', e.target.value)}
                  placeholder="e.g. Algebra Basics"
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Subject</label>
                  <select
                    value={sessionFormValues.subject}
                    onChange={(e) => handleSessionFormChange('subject', e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] bg-white px-3 text-sm outline-none focus:border-[#1f3f93]"
                  >
                    <option value="">Select subject</option>
                    {subjectOptions.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Grade</label>
                  <select
                    value={sessionFormValues.grade}
                    onChange={(e) => handleSessionFormChange('grade', e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] bg-white px-3 text-sm outline-none focus:border-[#1f3f93]"
                  >
                    <option value="">Select grade</option>
                    {gradeOptions.map((grade) => (
                      <option key={grade.id ?? grade.value ?? grade} value={grade.name ?? grade.label ?? grade}>
                        {grade.name ?? grade.label ?? grade}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Class Name</label>
                <input
                  type="text"
                  value={sessionFormValues.className}
                  onChange={(e) => handleSessionFormChange('className', e.target.value)}
                  placeholder="e.g. Grade 10 - Mathematics A"
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Instructor / Teacher</label>
                <select
                  value={sessionFormValues.teacherId}
                  onChange={(e) => handleTeacherChange(e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#d6e3fb] bg-white px-3 text-sm outline-none focus:border-[#1f3f93]"
                >
                  <option value="">Select teacher</option>
                  {teacherOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Date</label>
                  <input
                    type="date"
                    value={sessionFormValues.date}
                    onChange={(e) => handleSessionFormChange('date', e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">Time</label>
                  <input
                    type="time"
                    value={sessionFormValues.time}
                    onChange={(e) => handleSessionFormChange('time', e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">
                    Duration (minutes)
                  </label>
                  <input
                    type="text"
                    value={sessionFormValues.duration}
                    onChange={(e) => handleSessionFormChange('duration', e.target.value)}
                    placeholder="e.g. 60"
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[14px] font-semibold text-[#1f3f93]">
                    Zoom Meeting Link
                  </label>
                  <input
                    type="url"
                    value={sessionFormValues.meetingLink}
                    onChange={(e) => handleSessionFormChange('meetingLink', e.target.value)}
                    placeholder="https://zoom.us/j/..."
                    className="h-11 w-full rounded-lg border border-[#d6e3fb] px-3 text-sm outline-none focus:border-[#1f3f93]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeSessionModal}
                  disabled={createSessionMutation.isPending || updateSessionMutation.isPending}
                  className="h-10 rounded-lg border border-[#d6e3fb] px-4 text-sm font-semibold text-[#1f3f93] hover:bg-[#eef3ff] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSessionMutation.isPending || updateSessionMutation.isPending}
                  className="h-10 rounded-lg bg-[#1f3f93] px-4 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(31,63,147,0.25)] hover:bg-[#163f9a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createSessionMutation.isPending || updateSessionMutation.isPending
                    ? 'Saving...'
                    : editingSession
                      ? 'Update Session'
                      : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveSessionsPage;

