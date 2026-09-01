import React from 'react';
import { 
  ShieldAlert, 
  Cpu, 
  UserCheck, 
  Flame, 
  Database, 
  Zap, 
  Play, 
  Pause, 
  RotateCcw, 
  GraduationCap, 
  ChevronRight,
  Radio,
  FastForward,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  streamSpeed: number;
  setStreamSpeed: (speed: number) => void;
  onReset: () => void;
  onStepForward: () => void;
  onOpenAcademicModal: () => void;
  onInjectAttack: (scenarioId: string) => void;
  activeAlertCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isStreaming,
  setIsStreaming,
  streamSpeed,
  setStreamSpeed,
  onReset,
  onStepForward,
  onOpenAcademicModal,
  onInjectAttack,
  activeAlertCount,
}) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const tabs = [
    { id: 'dashboard', label: 'SOC ITDR Dashboard', icon: ShieldAlert, badge: activeAlertCount > 0 ? activeAlertCount : null },
    { id: 'ml-pipeline', label: 'ML Pipeline & Models', icon: Cpu },
    { id: 'ueba', label: 'Entity UEBA Profiler', icon: UserCheck },
    { id: 'attack-lab', label: 'Red Team Attack Lab', icon: Flame },
    { id: 'datasets', label: 'CloudTrail Datasets', icon: Database },
    { id: 'soar', label: 'Incident Response & SOAR', icon: Zap },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-gray-800 bg-[#0F1219]">
      {/* Top Academic & Project Identity Banner */}
      <div className="border-b border-gray-800/80 bg-[#0B0E14] px-4 py-1.5 text-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-blue-900/30 px-2 py-0.5 font-semibold text-blue-400 border border-blue-800/50 text-[11px] font-mono">
              <GraduationCap className="h-3.5 w-3.5" />
              M.TECH CYBER SECURITY & ML
            </span>
            <span className="hidden text-gray-600 sm:inline">•</span>
            <span className="hidden font-mono text-[11px] text-gray-400 sm:inline">
              REVA University — P Rahul (SRN: R23MTC09)
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase text-gray-500 font-mono">ML Pipeline:</span>
              <span className="text-xs font-mono text-green-400 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                LIVE INFERENCE
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-[10px] uppercase text-gray-500 font-mono">Dataset:</span>
              <span className="text-xs font-mono text-blue-400">AWS_CLOUDTRAIL_PROD</span>
            </div>
            <button
              onClick={onOpenAcademicModal}
              className="flex items-center gap-1 rounded bg-[#161B22] border border-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-300 transition hover:border-gray-700 hover:text-white"
            >
              <span>Project Abstract</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* App Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded flex items-center justify-center font-bold text-white shadow-sm">
            IT
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-gray-100">
                Identity Threat Detection & Response
              </h1>
              <span className="text-blue-400 text-xs font-mono bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-800/40">
                AWS-ML.v2.4
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-mono">
              Ensemble Isolation Forest (40%) + LSTM Autoencoder (60%) CloudTrail Analytics
            </p>
          </div>
        </div>

        {/* Live Stream Controller & Attack Injection */}
        <div className="flex items-center gap-2">
          {/* Stream Controls */}
          <div className="flex items-center rounded border border-gray-800 bg-[#161B22] p-0.5 shadow-inner">
            <button
              onClick={() => setIsStreaming(!isStreaming)}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-bold font-mono transition ${
                isStreaming
                  ? 'bg-amber-500 text-gray-950 shadow-sm'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
              title={isStreaming ? 'Pause log stream' : 'Start live event ingestion'}
            >
              {isStreaming ? (
                <>
                  <Pause className="h-3 w-3 fill-current" />
                  <span className="text-[11px] uppercase">PAUSE</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 fill-current" />
                  <span className="text-[11px] uppercase">STREAM</span>
                </>
              )}
            </button>

            <button
              onClick={onStepForward}
              disabled={isStreaming}
              className="rounded p-1 text-gray-400 transition hover:bg-gray-800 hover:text-gray-200 disabled:opacity-30"
              title="Step forward 1 event"
            >
              <FastForward className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={onReset}
              className="rounded p-1 text-gray-400 transition hover:bg-gray-800 hover:text-gray-200"
              title="Reset simulation stream"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            {/* Speed Selector */}
            <div className="ml-1 flex items-center border-l border-gray-800 pl-1">
              {[1, 3, 5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setStreamSpeed(speed)}
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold transition ${
                    streamSpeed === speed
                      ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {speed}X
                </button>
              ))}
            </div>
          </div>

          {/* Dark / Light Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 rounded border border-gray-800 bg-[#161B22] px-2.5 py-1 text-xs font-mono font-semibold text-gray-300 transition hover:bg-gray-800 hover:text-white shadow-sm"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline text-[11px] uppercase">Light</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-blue-500" />
                <span className="hidden sm:inline text-[11px] uppercase">Dark</span>
              </>
            )}
          </button>

          {/* Quick Attack Injector Dropdown */}
          <div className="relative">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  onInjectAttack(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="rounded border border-red-800/60 bg-red-950/20 px-2.5 py-1 text-xs font-mono font-semibold text-red-300 transition hover:bg-red-950/40 focus:outline-none focus:border-red-500"
            >
              <option value="" disabled>⚡ Inject Attack...</option>
              <option value="scen-role-chaining">Role Chaining Multi-Hop (T1548.005)</option>
              <option value="scen-policy-version">Policy Version Escalation (T1098)</option>
              <option value="scen-s3-exfil">S3 Data Exfiltration Burst (T1530)</option>
              <option value="scen-credential-spraying">AccessDenied Spraying (T1078)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mx-auto flex max-w-7xl space-x-1 overflow-x-auto px-4 border-t border-gray-800/60 bg-[#0B0E14]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold font-mono transition ${
                isActive
                  ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                  : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="rounded bg-red-900/40 border border-red-800/60 px-1.5 py-0.2 font-mono text-[10px] font-bold text-red-300">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
