import {
  ArrowLeft,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  CalendarCheck,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  Gauge,
  Home,
  Landmark,
  Map,
  Plus,
  Radar,
  RefreshCw,
  Settings,
  Sparkles,
  Trophy,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  assetScore,
  average,
  calculateVisaPoints,
  clamp,
  createDefaultState,
  createId,
  daysBetween,
  ensureTodayTasks,
  levelFromState,
  materialStatusLabel,
  refreshBadges,
  riskItems,
  taskKindLabel,
  taskStatusLabel,
  todayKey,
  totalProgress,
  yearProgress,
  type AppState,
  type Intensity,
  type MaterialStatus,
  type Mastery,
  type Opportunity,
  type PortfolioProject,
  type Review,
  type Task,
  type TaskStatus,
} from "./data";

type View =
  | "today"
  | "roadmap"
  | "tasks"
  | "learning"
  | "portfolio"
  | "visa"
  | "opportunities"
  | "reviews"
  | "achievements"
  | "agent"
  | "settings";

type AgentStatus = {
  available: boolean;
  launchCmd: string;
  mode: string;
};

const localKey = "pathpilot-growth-state";

const navItems: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: "today", label: "今日路径", icon: Home },
  { id: "roadmap", label: "三年路线", icon: Map },
  { id: "tasks", label: "任务系统", icon: CalendarCheck },
  { id: "learning", label: "学习中心", icon: BookOpen },
  { id: "portfolio", label: "作品集", icon: BriefcaseBusiness },
  { id: "visa", label: "积分材料", icon: Landmark },
  { id: "opportunities", label: "机会雷达", icon: Radar },
  { id: "reviews", label: "复盘中心", icon: ClipboardList },
  { id: "achievements", label: "成就", icon: Trophy },
  { id: "agent", label: "AI Coach", icon: Bot },
  { id: "settings", label: "设置", icon: Settings },
];

const modePrompts: Record<string, string> = {
  "任务拆解": "请把当前最重要的一个滞后目标拆成本周可执行任务，并说明每个任务推进哪个资产。",
  "进度诊断": "请诊断我当前三年路径是否滞后，指出最高优先级风险和本周调整方案。",
  "学习建议": "请根据当前学习进度，为系统分析师、日语、作品集各给一个最小下一步。",
  "文档润色": "请帮我优化作品集中的项目表达，要求真实、专业、适合日本 AI/产品岗位。",
  "面试模拟": "请模拟一家日本 AI 公司 Product Manager 面试，给我 6 个问题和回答评分标准。",
  "材料检查": "请检查我的高度人才/技人国材料清单缺口，并按优先级排列。",
};

function formatToday() {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

function yesterdayKey() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return todayKey(yesterday);
}

function nextDateKey(date: string) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + 1);
  return todayKey(next);
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [activeView, setActiveView] = useState<View>("today");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/state");
        if (!response.ok) throw new Error("API state unavailable");
        const remote = (await response.json()) as AppState;
        setState(ensureTodayTasks(remote));
      } catch {
        const local = window.localStorage.getItem(localKey);
        setState(local ? ensureTodayTasks(JSON.parse(local)) : createDefaultState());
      } finally {
        loadedRef.current = true;
      }
    }

    load();
  }, []);

  useEffect(() => {
    fetch("/api/agent/status")
      .then((response) => response.json())
      .then((data) => setAgentStatus(data))
      .catch(() =>
        setAgentStatus({
          available: false,
          launchCmd: "Set HERMES_LAUNCH_CMD",
          mode: "manual prompt",
        }),
      );
  }, []);

  useEffect(() => {
    if (!state || !loadedRef.current) return;
    window.localStorage.setItem(localKey, JSON.stringify(state));
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
        if (!response.ok) throw new Error("Save failed");
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [state]);

  function updateState(next: (current: AppState) => AppState) {
    setState((current) => {
      if (!current) return current;
      const updated = next(current);
      return { ...updated, badges: refreshBadges(updated) };
    });
  }

  if (!state) {
    return (
      <main className="loading">
        <Sparkles size={28} />
        <p>正在装载你的三年路径。</p>
      </main>
    );
  }

  const level = levelFromState(state);
  const todayTasks = state.tasks.filter((task) => task.dueDate === todayKey());

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div>
            <strong>PathPilot</strong>
            <span>日本高度人才路径</span>
          </div>
        </div>

        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={cx("nav-item", activeView === item.id && "active")}
                key={item.id}
                onClick={() => setActiveView(item.id)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-status">
          <span>Lv.{level.level}</span>
          <strong>{level.title}</strong>
          <small>{state.xp} XP · 连续 {state.streak} 天</small>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p>{formatToday()}</p>
            <h1>{state.profile.name}</h1>
          </div>
          <div className="topbar-actions">
            <Metric label="年度进度" value={`${yearProgress(state)}%`} />
            <Metric label="资产分" value={`${assetScore(state)}`} />
            <Metric label="今日任务" value={`${todayTasks.filter((task) => task.status === "done").length}/${todayTasks.length}`} />
            <span className={cx("save-chip", saveState)}>{saveState === "error" ? "本地保存" : saveState === "saving" ? "保存中" : "已保存"}</span>
          </div>
        </header>

        {activeView === "today" && <TodayView state={state} updateState={updateState} openAgent={() => setActiveView("agent")} />}
        {activeView === "roadmap" && <RoadmapView state={state} updateState={updateState} />}
        {activeView === "tasks" && <TasksView state={state} updateState={updateState} />}
        {activeView === "learning" && <LearningView state={state} updateState={updateState} />}
        {activeView === "portfolio" && <PortfolioView state={state} updateState={updateState} />}
        {activeView === "visa" && <VisaView state={state} updateState={updateState} />}
        {activeView === "opportunities" && <OpportunityView state={state} updateState={updateState} />}
        {activeView === "reviews" && <ReviewView state={state} updateState={updateState} />}
        {activeView === "achievements" && <AchievementView state={state} />}
        {activeView === "agent" && <AgentView state={state} updateState={updateState} agentStatus={agentStatus} />}
        {activeView === "settings" && <SettingsView state={state} updateState={updateState} agentStatus={agentStatus} />}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress">
      <span style={{ width: `${clamp(value)}%` }} />
    </div>
  );
}

function MarkdownBlock({ text }: { text: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

function taskDetailMarkdown(task: Task) {
  return [
    `## 目标\n${task.impact}`,
    task.knowledgePoint ? `## 任务文本\n${task.knowledgePoint}` : undefined,
    task.notes && !task.questions?.length ? `## 备注\n${task.notes}` : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function TaskQuestionList({ task }: { task: Task }) {
  const questions = task.questions?.length ? task.questions : task.question ? [task.question] : [];
  if (questions.length === 0) return null;

  return (
    <div className="task-exercises">
      {questions.map((question, index) => (
        <article key={question.id}>
          <span>练习 {index + 1}</span>
          <MarkdownBlock text={question.prompt} />
          <details>
            <summary>查看参考答案</summary>
            <MarkdownBlock text={`**答案**\n\n${question.answer}\n\n**解析**\n\n${question.explanation}`} />
          </details>
        </article>
      ))}
    </div>
  );
}

function TaskDetailView({
  task,
  onBack,
  setTaskStatus,
}: {
  task: Task;
  onBack: () => void;
  setTaskStatus: (taskId: string, status: TaskStatus) => void;
}) {
  return (
    <div className="task-detail-view">
      <button className="back-button" onClick={onBack} type="button">
        <ArrowLeft size={16} />
        今日主线
      </button>
      <div className="task-detail-head">
        <div>
          <span>
            {taskKindLabel[task.kind]} · {task.minutes} 分钟 · +{task.xp} XP
          </span>
          <h2>{task.title}</h2>
        </div>
        <select value={task.status} onChange={(event) => setTaskStatus(task.id, event.target.value as TaskStatus)}>
          {Object.entries(taskStatusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <MarkdownBlock text={taskDetailMarkdown(task)} />
      <TaskQuestionList task={task} />
    </div>
  );
}

function SectionTitle({ kicker, title, action }: { kicker?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="section-title">
      <div>
        {kicker && <span>{kicker}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function TodayView({
  state,
  updateState,
  openAgent,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
  openAgent: () => void;
}) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const todayTasks = state.tasks.filter((task) => task.dueDate === todayKey());
  const selectedTask = selectedTaskId ? todayTasks.find((task) => task.id === selectedTaskId) : undefined;
  const risks = riskItems(state);
  const level = levelFromState(state);
  const done = todayTasks.filter((task) => task.status === "done").length;
  const todaySummary = state.dailySummaries.find((summary) => summary.date === todayKey());

  function setTaskStatus(taskId: string, status: TaskStatus) {
    updateState((current) => {
      let xpGain = 0;
      const tasks = current.tasks.map((task) => {
        if (task.id !== taskId) return task;
        if (status === "done" && task.status !== "done") xpGain = task.xp;
        return { ...task, status };
      });

      const completedToday = current.completedDates.includes(todayKey());
      const nextCompletedDates =
        status === "done" && !completedToday ? [...current.completedDates, todayKey()] : current.completedDates;
      let nextStreak = current.streak;
      if (status === "done" && !completedToday) {
        nextStreak = current.lastCompletionDate === yesterdayKey() ? current.streak + 1 : 1;
      }

      const portfolioBump = tasks.find((task) => task.id === taskId)?.kind === "asset" && status === "done" ? 3 : 0;
      const mainBump = tasks.find((task) => task.id === taskId)?.kind === "main" && status === "done" ? 2 : 0;

      return {
        ...current,
        tasks,
        xp: current.xp + xpGain,
        streak: nextStreak,
        lastCompletionDate: status === "done" ? todayKey() : current.lastCompletionDate,
        completedDates: nextCompletedDates,
        roadmap: current.roadmap.map((year) =>
          year.id === "year-1"
            ? {
                ...year,
                milestones: year.milestones.map((milestone) => {
                  if (mainBump && milestone.id === "y1-analyst-round") {
                    return { ...milestone, progress: clamp(milestone.progress + mainBump) };
                  }
                  if (portfolioBump && milestone.id === "y1-portfolio") {
                    return { ...milestone, progress: clamp(milestone.progress + portfolioBump) };
                  }
                  return milestone;
                }),
              }
            : year,
        ),
        portfolio: current.portfolio.map((project, index) =>
          portfolioBump && index === 0 ? { ...project, progress: clamp(project.progress + portfolioBump) } : project,
        ),
      };
    });
  }

  return (
    <div className="view-grid today-grid">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">{state.profile.currentPhase}</span>
          <h2>今天只做能推动三年后结果的事。</h2>
          <p>
            第 {daysBetween(state.profile.startDate)} 天 · Lv.{level.level} {level.title} · 冻结卡 {state.freezeCards} 张
          </p>
        </div>
        <div className="hero-progress">
          <strong>{totalProgress(state)}%</strong>
          <span>总路径进度</span>
          <ProgressBar value={totalProgress(state)} />
        </div>
      </section>

      <section className="panel main-panel">
        {selectedTask ? (
          <TaskDetailView task={selectedTask} onBack={() => setSelectedTaskId(null)} setTaskStatus={setTaskStatus} />
        ) : (
          <>
        <SectionTitle
          kicker="Today"
          title="今日主线"
          action={
            <button className="ghost-button" onClick={openAgent} type="button">
              <Bot size={16} />
              让 Hermes 拆任务
            </button>
          }
        />

        <div className="task-stack">
          {todayTasks.map((task) => (
            <article className={cx("task-row", task.status === "done" && "completed")} key={task.id}>
              <button
                aria-label="完成任务"
                className="check-button"
                onClick={() => setTaskStatus(task.id, task.status === "done" ? "todo" : "done")}
                type="button"
              >
                {task.status === "done" && <Check size={15} />}
              </button>
              <button className="task-open-button" onClick={() => setSelectedTaskId(task.id)} type="button">
                <span>
                <strong>{task.title}</strong>
                <span>
                  {taskKindLabel[task.kind]} · {task.minutes} 分钟 · +{task.xp} XP
                </span>
                <small>{task.impact}</small>
                </span>
                <ChevronRight size={18} />
              </button>
              <select value={task.status} onChange={(event) => setTaskStatus(task.id, event.target.value as TaskStatus)}>
                {Object.entries(taskStatusLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </article>
          ))}
        </div>
          </>
        )}
      </section>

      <section className="panel">
        <SectionTitle kicker="Progress" title="三年路径进度" />
        <div className="progress-list">
          <ProgressItem label="Year 1" value={yearProgress(state)} />
          <ProgressItem label="系统分析师" value={state.roadmap[0].milestones[1].progress} />
          <ProgressItem label="作品集 V1" value={state.roadmap[0].milestones[4].progress} />
          <ProgressItem label="资产分" value={assetScore(state)} />
        </div>
      </section>

      <section className="panel">
        <SectionTitle kicker="Risk" title="路径风险提醒" />
        <div className="risk-list">
          {risks.map((risk) => (
            <div key={risk}>
              <Gauge size={16} />
              <span>{risk}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel strip-panel">
        <Metric label="今日完成率" value={`${done}/${todayTasks.length}`} />
        <Metric label="计划时长" value={`${todaySummary?.plannedMinutes ?? todayTasks.reduce((sum, task) => sum + task.minutes, 0)} 分钟`} />
        <Metric label="今日焦点" value={todaySummary?.focus ?? "作品集 V1"} />
      </section>
    </div>
  );
}

function ProgressItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="progress-item">
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <ProgressBar value={value} />
    </div>
  );
}

function RoadmapView({
  state,
  updateState,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
}) {
  function updateMilestone(yearId: string, milestoneId: string, patch: Partial<AppState["roadmap"][number]["milestones"][number]>) {
    updateState((current) => ({
      ...current,
      roadmap: current.roadmap.map((year) =>
        year.id === yearId
          ? {
              ...year,
              milestones: year.milestones.map((milestone) =>
                milestone.id === milestoneId ? { ...milestone, ...patch } : milestone,
              ),
            }
          : year,
      ),
    }));
  }

  return (
    <section className="panel full-panel">
      <SectionTitle kicker="Roadmap" title="三年路线图" />
      <div className="roadmap">
        {state.roadmap.map((year) => (
          <article className="year-block" key={year.id}>
            <div className="year-head">
              <div>
                <span>{year.title}</span>
                <h3>{year.theme}</h3>
              </div>
              <strong>{average(year.milestones.map((milestone) => milestone.progress))}%</strong>
            </div>
            <div className="goal-line">
              {year.goals.map((goal) => (
                <span key={goal}>{goal}</span>
              ))}
            </div>
            <div className="milestone-list">
              {year.milestones.map((milestone) => (
                <div className="milestone" key={milestone.id}>
                  <div>
                    <strong>{milestone.title}</strong>
                    <span>{milestone.standard}</span>
                  </div>
                  <div className="milestone-control">
                    <input
                      max="100"
                      min="0"
                      onChange={(event) =>
                        updateMilestone(year.id, milestone.id, {
                          progress: Number(event.target.value),
                          status: Number(event.target.value) >= 100 ? "done" : Number(event.target.value) > 0 ? "active" : "not-started",
                        })
                      }
                      type="range"
                      value={milestone.progress}
                    />
                    <span>{milestone.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TasksView({
  state,
  updateState,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
}) {
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const tasks = state.tasks.filter((task) => filter === "all" || task.status === filter);
  const todaySummary = state.dailySummaries.find((summary) => summary.date === todayKey());
  const todayTasks = state.tasks.filter((task) => task.dueDate === todayKey());
  const plannedMinutes = todayTasks.reduce((sum, task) => sum + task.minutes, 0);

  function patchTask(taskId: string, patch: Partial<Task>) {
    updateState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
    }));
  }

  return (
    <section className="panel full-panel">
      <SectionTitle kicker="Tasks" title="任务系统" />
      <div className="automation-banner">
        <div>
          <strong>后台已按当前进度安排今日任务</strong>
          <span>
            今日 {todayTasks.length} 个任务 · {plannedMinutes} 分钟 · {todaySummary?.completedMinutes ?? 0} 分钟已闭环
          </span>
        </div>
        <small>{todaySummary?.nextStep ?? "打开应用时会自动生成约两小时任务，并写入每日总结。"}</small>
      </div>
      <div className="segmented">
        {(["all", "todo", "doing", "done", "skipped", "postponed"] as Array<"all" | TaskStatus>).map((item) => (
          <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)} type="button">
            {item === "all" ? "全部" : taskStatusLabel[item]}
          </button>
        ))}
      </div>
      <div className="table-list">
        {tasks.map((task) => (
          <article className="table-row" key={task.id}>
            <div>
              <strong>{task.title}</strong>
              <small>
                {task.dueDate} · {task.track} · {task.minutes} 分钟 · +{task.xp} XP
              </small>
            </div>
            <span className="task-kind-chip">{taskKindLabel[task.kind]}</span>
            <select value={task.status} onChange={(event) => patchTask(task.id, { status: event.target.value as TaskStatus })}>
              {Object.entries(taskStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button className="icon-button" onClick={() => patchTask(task.id, { dueDate: nextDateKey(task.dueDate), status: "postponed" })} type="button">
              <ChevronRight size={16} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function LearningView({
  state,
  updateState,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
}) {
  function updateTopic(trackId: string, topicId: string, patch: { mastery?: Mastery; notes?: string }) {
    updateState((current) => ({
      ...current,
      learning: current.learning.map((track) => {
        if (track.id !== trackId) return track;
        const topics = track.topics.map((topic) => (topic.id === topicId ? { ...topic, ...patch } : topic));
        return {
          ...track,
          topics,
          progress: average(topics.map((topic) => Math.round((topic.mastery / 4) * 100))),
        };
      }),
    }));
  }

  return (
    <section className="panel full-panel">
      <SectionTitle kicker="Learning" title="学习中心" />
      <div className="learning-grid">
        {state.learning.map((track) => (
          <article className="learning-track" key={track.id}>
            <div className="track-head">
              <div>
                <h3>{track.title}</h3>
                <p>{track.purpose}</p>
              </div>
              <strong>{track.progress}%</strong>
            </div>
            <ProgressBar value={track.progress} />
            <div className="topic-list">
              {track.topics.map((topic) => (
                <div className="topic" key={topic.id}>
                  <div>
                    <strong>{topic.title}</strong>
                    <span>
                      {topic.kind} · {topic.minutes} 分钟
                    </span>
                  </div>
                  {topic.objective && <p className="topic-objective">{topic.objective}</p>}
                  {topic.content && <p className="topic-content">{topic.content}</p>}
                  {topic.examples && topic.examples.length > 0 && (
                    <ul className="example-list">
                      {topic.examples.map((example) => (
                        <li key={example}>{example}</li>
                      ))}
                    </ul>
                  )}
                  {topic.questions && topic.questions.length > 0 && (
                    <div className="question-list">
                      {topic.questions.map((question) => (
                        <details key={question.id}>
                          <summary>{question.prompt}</summary>
                          <strong>{question.answer}</strong>
                          <p>{question.explanation}</p>
                        </details>
                      ))}
                    </div>
                  )}
                  <div className="mastery">
                    {([0, 1, 2, 3, 4] as Mastery[]).map((level) => (
                      <button
                        className={topic.mastery >= level ? "active" : ""}
                        key={level}
                        onClick={() => updateTopic(track.id, topic.id, { mastery: level })}
                        type="button"
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <textarea
                    onChange={(event) => updateTopic(track.id, topic.id, { notes: event.target.value })}
                    placeholder="笔记、错题或下一步"
                    value={topic.notes}
                  />
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PortfolioView({
  state,
  updateState,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
}) {
  function patchProject(projectId: string, patch: Partial<PortfolioProject>) {
    updateState((current) => ({
      ...current,
      portfolio: current.portfolio.map((project) => (project.id === projectId ? { ...project, ...patch } : project)),
    }));
  }

  function addProject() {
    updateState((current) => ({
      ...current,
      portfolio: [
        ...current.portfolio,
        {
          id: createId("project"),
          title: "新的作品集项目",
          stage: "Draft",
          progress: 0,
          problem: "",
          users: "",
          solution: "",
          evidence: "",
          nextStep: "写出问题定义和目标用户。",
        },
      ],
    }));
  }

  return (
    <section className="panel full-panel">
      <SectionTitle
        kicker="Portfolio"
        title="项目作品集"
        action={
          <button className="primary-button" onClick={addProject} type="button">
            <Plus size={16} />
            新项目
          </button>
        }
      />
      <div className="portfolio-list">
        {state.portfolio.map((project) => (
          <article className="portfolio-project" key={project.id}>
            <div className="project-title-line">
              <input onChange={(event) => patchProject(project.id, { title: event.target.value })} value={project.title} />
              <input onChange={(event) => patchProject(project.id, { stage: event.target.value })} value={project.stage} />
              <strong>{project.progress}%</strong>
            </div>
            <input
              max="100"
              min="0"
              onChange={(event) => patchProject(project.id, { progress: Number(event.target.value) })}
              type="range"
              value={project.progress}
            />
            <div className="case-grid">
              <TextBlock label="问题定义" value={project.problem} onChange={(value) => patchProject(project.id, { problem: value })} />
              <TextBlock label="目标用户" value={project.users} onChange={(value) => patchProject(project.id, { users: value })} />
              <TextBlock label="解决方案" value={project.solution} onChange={(value) => patchProject(project.id, { solution: value })} />
              <TextBlock label="证据/指标" value={project.evidence} onChange={(value) => patchProject(project.id, { evidence: value })} />
            </div>
            <TextBlock label="下一步" value={project.nextStep} onChange={(value) => patchProject(project.id, { nextStep: value })} />
          </article>
        ))}
      </div>
    </section>
  );
}

function TextBlock({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-block">
      <span>{label}</span>
      <textarea onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function VisaView({
  state,
  updateState,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
}) {
  const score = calculateVisaPoints(state.visa.inputs);

  function patchInputs(patch: Partial<AppState["visa"]["inputs"]>) {
    updateState((current) => ({
      ...current,
      visa: {
        ...current.visa,
        inputs: { ...current.visa.inputs, ...patch },
      },
    }));
  }

  function patchMaterial(id: string, patch: Partial<AppState["visa"]["materials"][number]>) {
    updateState((current) => ({
      ...current,
      visa: {
        ...current.visa,
        materials: current.visa.materials.map((material) => (material.id === id ? { ...material, ...patch } : material)),
      },
    }));
  }

  return (
    <div className="view-grid visa-grid">
      <section className="panel">
        <SectionTitle kicker="Score" title="高度人才积分测算" />
        <div className="score-meter">
          <strong>{score}</strong>
          <span>{score >= 80 ? "80 分以上区间" : score >= 70 ? "达标观察区间" : "需要补强"}</span>
        </div>
        <div className="form-grid">
          <label>
            学历
            <select value={state.visa.inputs.education} onChange={(event) => patchInputs({ education: event.target.value as AppState["visa"]["inputs"]["education"] })}>
              <option value="bachelor">本科</option>
              <option value="master">硕士</option>
              <option value="doctor">博士</option>
            </select>
          </label>
          <label>
            年龄
            <input type="number" value={state.visa.inputs.age} onChange={(event) => patchInputs({ age: Number(event.target.value) })} />
          </label>
          <label>
            工作年限
            <input type="number" value={state.visa.inputs.workYears} onChange={(event) => patchInputs({ workYears: Number(event.target.value) })} />
          </label>
          <label>
            目标年收（日元）
            <input
              step="500000"
              type="number"
              value={state.visa.inputs.annualIncomeJpy}
              onChange={(event) => patchInputs({ annualIncomeJpy: Number(event.target.value) })}
            />
          </label>
          <label>
            JLPT
            <select value={state.visa.inputs.jlpt} onChange={(event) => patchInputs({ jlpt: event.target.value as AppState["visa"]["inputs"]["jlpt"] })}>
              <option value="none">暂无</option>
              <option value="n2">N2</option>
              <option value="n1">N1</option>
            </select>
          </label>
        </div>
        <div className="checkbox-list">
          <label>
            <input
              checked={state.visa.inputs.hasJapaneseDegree}
              onChange={(event) => patchInputs({ hasJapaneseDegree: event.target.checked })}
              type="checkbox"
            />
            日本大学学位
          </label>
          <label>
            <input
              checked={state.visa.inputs.hasAdvancedCertificate}
              onChange={(event) => patchInputs({ hasAdvancedCertificate: event.target.checked })}
              type="checkbox"
            />
            高相关证书
          </label>
          <label>
            <input
              checked={state.visa.inputs.hasResearchOrPatent}
              onChange={(event) => patchInputs({ hasResearchOrPatent: event.target.checked })}
              type="checkbox"
            />
            研究/专利/成果
          </label>
        </div>
        <p className="fine-print">测算用于规划，不替代官方或专业意见。</p>
      </section>

      <section className="panel">
        <SectionTitle kicker="Materials" title="材料清单" />
        <div className="material-list">
          {state.visa.materials.map((material) => (
            <article className="material" key={material.id}>
              <div>
                <strong>{material.title}</strong>
                <span>{material.group}</span>
              </div>
              <select value={material.status} onChange={(event) => patchMaterial(material.id, { status: event.target.value as MaterialStatus })}>
                {Object.entries(materialStatusLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function OpportunityView({
  state,
  updateState,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
}) {
  function patchOpportunity(id: string, patch: Partial<Opportunity>) {
    updateState((current) => ({
      ...current,
      opportunities: current.opportunities.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  return (
    <section className="panel full-panel">
      <SectionTitle kicker="Radar" title="机会雷达" />
      <div className="automation-banner">
        <div>
          <strong>后台每日自动刷新候选机会</strong>
          <span>来源优先使用公开招聘 API，并按 AI / Product / Japan / visa 相关性排序。</span>
        </div>
        <small>不再需要手动新增空公司；状态只用于记录你是否已推进连接。</small>
      </div>
      <div className="opportunity-list">
        {state.opportunities.map((item) => (
          <article className="opportunity" key={item.id}>
            <div className="opportunity-head">
              <div>
                <strong>{item.company}</strong>
                <span>{item.role}</span>
              </div>
              <span className="task-kind-chip">{item.tier === "core" ? "核心" : item.tier === "target" ? "目标" : "观察"}</span>
              <strong>{item.fit}%</strong>
            </div>
            <div className="form-grid compact">
              <label>
                来源
                <span className="readonly-field">{item.contact || "后台生成"}</span>
              </label>
              <label>
                签证/远程可行性
                <span className="readonly-field">{item.visaFit ? "优先观察" : "需进一步确认"}</span>
              </label>
              <label>
                状态
                <select value={item.status} onChange={(event) => patchOpportunity(item.id, { status: event.target.value as Opportunity["status"] })}>
                  <option value="research">调研中</option>
                  <option value="contacted">已连接</option>
                  <option value="interviewing">面试中</option>
                  <option value="archived">归档</option>
                </select>
              </label>
              <label>
                匹配度
                <span className="readonly-field">{item.fit}%</span>
              </label>
            </div>
            <p className="opportunity-notes">{item.notes}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReviewView({
  state,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
}) {
  const [type, setType] = useState<Review["type"]>("weekly");
  const currentReview = state.reviews.find((review) => review.type === type);

  return (
    <div className="view-grid review-grid">
      <section className="panel">
        <SectionTitle kicker="Review" title="后台复盘" />
        <div className="segmented">
          <button className={type === "weekly" ? "active" : ""} onClick={() => setType("weekly")} type="button">
            周复盘
          </button>
          <button className={type === "monthly" ? "active" : ""} onClick={() => setType("monthly")} type="button">
            月复盘
          </button>
        </div>
        {currentReview ? (
          <div className="auto-review">
            <span>{currentReview.date}</span>
            <strong>{currentReview.wins}</strong>
            <p>{currentReview.biggestMove}</p>
            <p>{currentReview.lagging}</p>
            <p>{currentReview.adjustment}</p>
          </div>
        ) : (
          <p className="empty">后台会在读取状态时自动生成自然周/月复盘。</p>
        )}
      </section>
      <section className="panel">
        <SectionTitle kicker="History" title="复盘记录" />
        <div className="review-list">
          {state.reviews.map((review) => (
            <article key={review.id}>
              <span>
                {review.type === "weekly" ? "周复盘" : "月复盘"} · {review.date}
              </span>
              <strong>{review.biggestMove || "未填写重点"}</strong>
              <p>{review.adjustment}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AchievementView({ state }: { state: AppState }) {
  const level = levelFromState(state);

  return (
    <div className="view-grid achievement-grid">
      <section className="panel">
        <SectionTitle kicker="Level" title="路径等级" />
        <div className="level-display">
          <strong>Lv.{level.level}</strong>
          <span>{level.title}</span>
          <p>{state.xp} XP · 连续 {state.streak} 天 · 冻结卡 {state.freezeCards} 张</p>
        </div>
        <ProgressBar value={Math.min(100, (state.xp % 1000) / 10)} />
      </section>
      <section className="panel">
        <SectionTitle kicker="Badges" title="徽章" />
        <div className="badge-grid">
          {state.badges.map((badge) => (
            <article className={cx("badge", badge.unlocked && "unlocked")} key={badge.id}>
              <Trophy size={18} />
              <strong>{badge.title}</strong>
              <span>{badge.condition}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AgentView({
  state,
  updateState,
  agentStatus,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
  agentStatus: AgentStatus | null;
}) {
  const [mode, setMode] = useState("进度诊断");
  const [prompt, setPrompt] = useState(modePrompts["进度诊断"]);
  const [running, setRunning] = useState(false);
  const [generatingDaily, setGeneratingDaily] = useState(false);
  const [error, setError] = useState("");

  function selectMode(nextMode: string) {
    setMode(nextMode);
    setPrompt(modePrompts[nextMode]);
  }

  async function runAgent() {
    setRunning(true);
    setError("");
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, prompt, state }),
      });
      const data = (await response.json()) as { ok: boolean; response?: string; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Hermes request failed");
      updateState((current) => ({
        ...current,
        agentNotes: [
          {
            id: createId("agent"),
            date: todayKey(),
            mode,
            prompt,
            response: data.response || "",
          },
          ...current.agentNotes,
        ],
      }));
    } catch (agentError) {
      setError(agentError instanceof Error ? agentError.message : String(agentError));
    } finally {
      setRunning(false);
    }
  }

  async function generateDailyLessons() {
    setGeneratingDaily(true);
    setError("");
    try {
      const response = await fetch("/api/agent/generate-daily-lessons", { method: "POST" });
      const data = (await response.json()) as { ok: boolean; state?: AppState; response?: string; error?: string };
      if (!response.ok || !data.ok || !data.state) throw new Error(data.error || "Hermes lesson generation failed");
      updateState(() => data.state!);
    } catch (agentError) {
      setError(agentError instanceof Error ? agentError.message : String(agentError));
    } finally {
      setGeneratingDaily(false);
    }
  }

  const fallbackPrompt = useMemo(
    () =>
      [
        "PathPilot AI Coach 请求",
        `模式：${mode}`,
        "当前状态：",
        JSON.stringify(
          {
            profile: state.profile,
            yearProgress: yearProgress(state),
            totalProgress: totalProgress(state),
            risks: riskItems(state),
            todayTasks: state.tasks.filter((task) => task.dueDate === todayKey()),
            portfolio: state.portfolio,
            materials: state.visa.materials,
          },
          null,
          2,
        ),
        "请求：",
        prompt,
      ].join("\n\n"),
    [mode, prompt, state],
  );

  return (
    <div className="view-grid agent-grid">
      <section className="panel">
        <SectionTitle kicker="Hermes" title="AI Coach" />
        <div className="agent-status">
          <span className={agentStatus?.available ? "dot on" : "dot"} />
          <div>
            <strong>{agentStatus?.available ? "Hermes 已检测到" : "Hermes 未检测到"}</strong>
            <small>{agentStatus?.mode || "checking"}</small>
          </div>
        </div>
        <div className="agent-design">
          <strong>{state.agentDesign.name}</strong>
          <span>{state.agentDesign.trigger}</span>
          <small>{state.agentDesign.storage}</small>
        </div>
        <div className="agent-rule-grid">
          <div>
            <strong>目标输出</strong>
            {state.agentDesign.outputs.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div>
            <strong>约束边界</strong>
            {state.agentDesign.safety.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
        <div className="segmented wrap">
          {Object.keys(modePrompts).map((item) => (
            <button className={mode === item ? "active" : ""} key={item} onClick={() => selectMode(item)} type="button">
              {item}
            </button>
          ))}
        </div>
        <textarea className="agent-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        <button className="ghost-button wide" disabled={generatingDaily} onClick={generateDailyLessons} type="button">
          {generatingDaily ? <RefreshCw className="spin" size={16} /> : <BookOpen size={16} />}
          {generatingDaily ? "Hermes 正在补跑今日计划" : "立即补跑今日后台计划"}
        </button>
        <button className="primary-button wide" disabled={running} onClick={runAgent} type="button">
          {running ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}
          {running ? "Hermes 正在思考" : "调用 Hermes"}
        </button>
        {error && (
          <div className="error-box">
            <strong>调用失败，已保留手动提示词</strong>
            <p>{error}</p>
            <textarea readOnly value={fallbackPrompt} />
          </div>
        )}
      </section>
      <section className="panel">
        <SectionTitle kicker="Notes" title="AI 输出记录" />
        <div className="agent-notes">
          {state.agentNotes.length === 0 && <p className="empty">还没有 AI Coach 输出。</p>}
          {state.agentNotes.map((note) => (
            <article key={note.id}>
              <span>
                {note.date} · {note.mode}
              </span>
              <strong>{note.prompt}</strong>
              <p>{note.response}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function SettingsView({
  state,
  updateState,
  agentStatus,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
  agentStatus: AgentStatus | null;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function patchProfile(patch: Partial<AppState["profile"]>) {
    updateState((current) => ({
      ...current,
      profile: { ...current.profile, ...patch },
      visa: {
        ...current.visa,
        inputs: {
          ...current.visa.inputs,
          education: patch.education ?? current.visa.inputs.education,
          age: patch.age ?? current.visa.inputs.age,
          workYears: patch.workYears ?? current.visa.inputs.workYears,
          annualIncomeJpy: patch.annualIncomeJpy ?? current.visa.inputs.annualIncomeJpy,
        },
      },
    }));
  }

  function exportState() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pathpilot-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importState(file: File) {
    const imported = JSON.parse(await file.text()) as AppState;
    updateState(() => ensureTodayTasks(imported));
  }

  return (
    <div className="view-grid settings-grid">
      <section className="panel">
        <SectionTitle kicker="Profile" title="目标配置" />
        <div className="form-grid">
          <label>
            路径名称
            <input value={state.profile.name} onChange={(event) => patchProfile({ name: event.target.value })} />
          </label>
          <label>
            起始日期
            <input type="date" value={state.profile.startDate} onChange={(event) => patchProfile({ startDate: event.target.value })} />
          </label>
          <label>
            目标年份
            <input value={state.profile.targetYear} onChange={(event) => patchProfile({ targetYear: event.target.value })} />
          </label>
          <label>
            目标岗位
            <input value={state.profile.targetRole} onChange={(event) => patchProfile({ targetRole: event.target.value })} />
          </label>
          <label>
            当前阶段
            <input value={state.profile.currentPhase} onChange={(event) => patchProfile({ currentPhase: event.target.value })} />
          </label>
          <label>
            学习强度
            <select value={state.profile.intensity} onChange={(event) => patchProfile({ intensity: event.target.value as Intensity })}>
              <option value="light">轻量</option>
              <option value="standard">标准</option>
              <option value="intensive">强化</option>
            </select>
          </label>
          <label>
            日语水平
            <input value={state.profile.japaneseLevel} onChange={(event) => patchProfile({ japaneseLevel: event.target.value })} />
          </label>
          <label>
            学历
            <select value={state.profile.education} onChange={(event) => patchProfile({ education: event.target.value as AppState["profile"]["education"] })}>
              <option value="bachelor">本科</option>
              <option value="master">硕士</option>
              <option value="doctor">博士</option>
            </select>
          </label>
          <label>
            年龄
            <input type="number" value={state.profile.age} onChange={(event) => patchProfile({ age: Number(event.target.value) })} />
          </label>
          <label>
            工作年限
            <input type="number" value={state.profile.workYears} onChange={(event) => patchProfile({ workYears: Number(event.target.value) })} />
          </label>
        </div>
      </section>
      <section className="panel">
        <SectionTitle kicker="Data" title="数据与 Hermes" />
        <div className="settings-actions">
          <button className="ghost-button" onClick={exportState} type="button">
            <Download size={16} />
            导出 JSON
          </button>
          <button className="ghost-button" onClick={() => fileInputRef.current?.click()} type="button">
            <Upload size={16} />
            导入 JSON
          </button>
          <button className="danger-button" onClick={() => updateState(() => createDefaultState())} type="button">
            重置示例数据
          </button>
          <input
            accept="application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importState(file);
            }}
            ref={fileInputRef}
            type="file"
          />
        </div>
        <div className="hermes-box">
          <strong>{agentStatus?.available ? "Hermes Agent 可用" : "Hermes Agent 未连接"}</strong>
          <span>{agentStatus?.launchCmd}</span>
          <small>后端会通过 WSL 调用 hermes chat -Q；调用失败时 AI Coach 页会生成可手动复制的提示词。</small>
        </div>
      </section>
    </div>
  );
}

export default App;
