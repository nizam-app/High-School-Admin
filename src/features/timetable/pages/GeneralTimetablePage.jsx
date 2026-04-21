const GeneralTimetablePage = () => {
  const activeClasses = ['4th', '5th', '6th', '7th'];

  return (
    <div className="rounded-[10px] border border-[#d6e3fb] bg-white p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-[#17367a]">School-Wide Timetable</h2>
        <p className="mt-1 text-sm text-[#6f84b4]">
          Manage the general timetable structure that applies to all classes.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="flex h-full flex-col justify-center rounded-[10px] border border-[#e4ecff] bg-[#f7f9ff] p-5">
          <div>
            <h3 className="text-sm font-semibold text-[#17367a]">Standard Schedule</h3>
            <div className="mt-4 space-y-2 text-sm text-[#34506f]">
              <div className="flex justify-between">
                <span>School Start:</span>
                <span className="font-semibold">08:00 AM</span>
              </div>
              <div className="flex justify-between">
                <span>School End:</span>
                <span className="font-semibold">04:00 PM</span>
              </div>
              <div className="flex justify-between">
                <span>Period Duration:</span>
                <span className="font-semibold">60 min</span>
              </div>
              <div className="flex justify-between">
                <span>Break Time:</span>
                <span className="font-semibold">12:00 PM</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex h-full flex-col justify-between rounded-[10px] border border-[#e4ecff] bg-[#f7f9ff] p-5">
          <div>
            <h3 className="text-sm font-semibold text-[#17367a]">Active Classes</h3>
            <div className="mt-4 space-y-2">
              {activeClasses.map((cls) => (
                <div
                  key={cls}
                  className="flex items-center justify-between rounded-lg border border-[#dde6ff] bg-white px-3 py-2"
                >
                  <span className="text-sm font-medium text-[#17367a]">{cls}</span>
                  <span className="rounded-full bg-[#dcf8e9] px-2 py-0.5 text-[11px] font-semibold text-[#047857]">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralTimetablePage;
