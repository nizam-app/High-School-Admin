import { useState } from 'react';
import { Palette, ShieldCheck, Sliders } from 'lucide-react';

const Toggle = ({ defaultChecked }) => {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input type="checkbox" defaultChecked={defaultChecked} className="peer sr-only" />
      <div className="h-6 w-11 rounded-full bg-[#cbd7f2] transition peer-checked:bg-[#1f3f93]"></div>
      <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5"></div>
    </label>
  );
};

const SettingRow = ({ title, description, control }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#dbe7ff] bg-[#f2f7ff] px-4 py-3">
      <div>
        <p className="m-0 text-sm font-semibold text-[#1f3f93]">{title}</p>
        <p className="m-0 text-xs text-[#6f84b4]">{description}</p>
      </div>
      <div className="flex items-center gap-2">{control}</div>
    </div>
  );
};

const SectionCard = ({ title, icon: Icon, children }) => {
  return (
    <section className="rounded-[16px] border border-[#d6e3fb] bg-white p-4 shadow-[0_12px_24px_rgba(31,63,147,0.08)]">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#e9f1ff] text-[#1f3f93]">
          <Icon size={18} />
        </span>
        <h3 className="m-0 text-[16px] font-semibold text-[#1f3f93]">{title}</h3>
      </div>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </section>
  );
};

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('General');

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {['General', 'Theme', 'Security'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-[10px] px-4 py-2 text-sm font-semibold transition ${
              tab === activeTab
                ? 'bg-[#1f3f93] text-white shadow-[0_6px_16px_rgba(31,63,147,0.25)]'
                : 'border border-[#d6e3fb] bg-white text-[#1f3f93]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'General' && (
        <SectionCard title="Curriculum Structure" icon={Sliders}>
          <div>
            <label className="text-sm font-semibold text-[#1f3f93]">Academic Year</label>
            <select className="mt-2 w-full rounded-[12px] border border-[#d6e3fb] bg-white px-4 py-2 text-sm text-[#1f3f93]">
              <option>2025-2026</option>
              <option>2024-2025</option>
              <option>2023-2024</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-[#1f3f93]">Grading System</label>
            <select className="mt-2 w-full rounded-[12px] border border-[#d6e3fb] bg-white px-4 py-2 text-sm text-[#1f3f93]">
              <option>Percentage (0-100)</option>
              <option>Letter (A-F)</option>
              <option>GPA (4.0)</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-[#1f3f93]">Default Class Duration (minutes)</label>
            <input
              type="text"
              defaultValue="45"
              className="mt-2 w-full rounded-[12px] border border-[#d6e3fb] px-4 py-2 text-sm text-[#1f3f93]"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-[#1f3f93]">School Start Time</label>
            <div className="mt-2 flex items-center gap-2 rounded-[12px] border border-[#d6e3fb] bg-white px-4 py-2 text-sm text-[#1f3f93]">
              <span>08:00 AM</span>
              <span className="ml-auto text-[#6f84b4]">\u23F0</span>
            </div>
          </div>
          <button
            type="button"
            className="mt-1 w-fit rounded-[12px] bg-[#1f3f93] px-6 py-2 text-sm font-semibold text-white"
          >
            Save Changes
          </button>
        </SectionCard>
      )}

      {activeTab === 'Theme' && (
        <SectionCard title="App Theme" icon={Palette}>
          <div>
            <p className="m-0 text-sm font-semibold text-[#1f3f93]">Primary Color</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="h-10 w-10 rounded-[10px] border border-[#d6e3fb] bg-[#1f3f93]"></span>
              <div>
                <p className="m-0 text-sm font-semibold text-[#1f3f93]">Current: #1F3C88</p>
                <p className="m-0 text-xs text-[#6f84b4]">Used for buttons, links, and highlights</p>
              </div>
            </div>
          </div>
          <div>
            <p className="m-0 text-sm font-semibold text-[#1f3f93]">Secondary Color</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="h-10 w-10 rounded-[10px] border border-[#d6e3fb] bg-[#2c3e66]"></span>
              <div>
                <p className="m-0 text-sm font-semibold text-[#1f3f93]">Current: #2C3E66</p>
                <p className="m-0 text-xs text-[#6f84b4]">Used for descriptions and secondary text</p>
              </div>
            </div>
          </div>
          <div>
            <p className="m-0 text-sm font-semibold text-[#1f3f93]">Background Style</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {['Light (Current)', 'Dark', 'Auto'].map((label) => (
                <button
                  key={label}
                  type="button"
                  className={`rounded-[14px] border px-4 py-4 text-sm font-semibold ${
                    label.includes('Current')
                      ? 'border-[#1f3f93] bg-white text-[#1f3f93]'
                      : 'border-[#d6e3fb] bg-white text-[#6f84b4]'
                  }`}
                >
                  <div
                    className={`mb-3 h-16 rounded-[10px] ${
                      label === 'Dark' ? 'bg-[#1e293b]' : 'bg-[#f8fbff]'
                    }`}
                  ></div>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      {activeTab === 'Security' && (
        <>
          <SectionCard title="Security & Privacy" icon={ShieldCheck}>
            <SettingRow
              title="Two-Factor Authentication"
              description="Require 2FA for all admin accounts"
              control={<Toggle defaultChecked />}
            />
            <SettingRow
              title="Session Timeout"
              description="Auto-logout after inactivity"
              control={
                <select className="rounded-[10px] border border-[#d6e3fb] bg-white px-3 py-1.5 text-xs font-semibold text-[#1f3f93]">
                  <option>15 minutes</option>
                  <option>30 minutes</option>
                  <option>1 hour</option>
                </select>
              }
            />
            <SettingRow
              title="Password Policy"
              description="Minimum password requirements"
              control={
                <button
                  type="button"
                  className="rounded-[10px] bg-[#1f3f93] px-3.5 py-1.5 text-xs font-semibold text-white"
                >
                  Configure
                </button>
              }
            />
            <SettingRow
              title="IP Whitelist"
              description="Restrict access to specific IP addresses"
              control={<Toggle />}
            />
            <SettingRow
              title="Data Encryption"
              description="Encrypt sensitive student data"
              control={<Toggle defaultChecked />}
            />
            <SettingRow
              title="Audit Logs"
              description="Track all administrative actions"
              control={
                <button
                  type="button"
                  className="rounded-[10px] bg-[#1f3f93] px-3.5 py-1.5 text-xs font-semibold text-white"
                >
                  View Logs
                </button>
              }
            />
          </SectionCard>

          <SectionCard title="Data Privacy" icon={ShieldCheck}>
            <SettingRow
              title="Allow Data Analytics"
              description="Collect anonymous usage data"
              control={<Toggle defaultChecked />}
            />
            <SettingRow
              title="Data Retention Period"
              description="How long to keep student records"
              control={
                <select className="rounded-[10px] border border-[#d6e3fb] bg-white px-3 py-1.5 text-xs font-semibold text-[#1f3f93]">
                  <option>1 year</option>
                  <option>2 years</option>
                  <option>5 years</option>
                </select>
              }
            />
          </SectionCard>
        </>
      )}
    </section>
  );
};

export default SettingsPage;
