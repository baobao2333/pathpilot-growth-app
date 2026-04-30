"use client";

import { BarChart3, Bot, CheckCircle2, Clock3, FileText, Home, Loader2, Play, RefreshCw, RotateCcw, Send, Settings } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { AgentRun, AnswerSubmission, GradeResult, HomePayload, LearningBlock, PlanProfile, Report, StageDraft, StagePlan } from "./data";

type View = "home" | "reports" | "settings";

type AgentStatus = {
  available: boolean;
  launchCmd: string;
  mode: string;
  canRestart?: boolean;
  checking?: boolean;
  lastError?: string;
};

type ReportsPayload = {
  reports: Report[];
};

type PlannerRunInfo = {
  source: "hermes" | "local" | "skipped";
  elapsedMs: number;
  summary: string;
  error?: string;
};

type AgentRunPayload = {
  ok: boolean;
  home: HomePayload;
  run?: PlannerRunInfo;
};

type ChatMessage = {
  role: "user" | "hermes";
  text: string;
};

type PlanPayload = {
  planProfile: PlanProfile;
  stagePlan: StagePlan;
  stageDraft: StageDraft;
};

const navItems: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: "home", label: "首页", icon: Home },
  { id: "reports", label: "报告", icon: FileText },
  { id: "settings", label: "设置", icon: Settings },
];

function App() {
  const [view, setView] = useState<View>("home");
  const [home, setHome] = useState<HomePayload | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [notice, setNotice] = useState("");
  const [agentRunText, setAgentRunText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  async function loadHome() {
    const response = await fetch("/api/home");
    if (!response.ok) throw new Error("Home API unavailable");
    const payload = (await response.json()) as HomePayload;
    setHome(payload);
  }

  async function loadReports() {
    const response = await fetch("/api/reports");
    if (!response.ok) throw new Error("Reports API unavailable");
    const payload = (await response.json()) as ReportsPayload;
    setReports(payload.reports);
  }

  async function refreshAll() {
    setLoading(true);
    try {
      await Promise.all([loadHome(), loadReports(), refreshAgentStatus(true)]);
    } finally {
      setLoading(false);
    }
  }

  async function refreshAgentStatus(autoStart = false) {
    setAgentStatus((current) => (current ? { ...current, checking: true } : { available: false, launchCmd: "Checking Hermes", mode: "checking", checking: true }));
    try {
      const response = await fetch(`/api/agent/status${autoStart ? "?autoStart=1" : ""}`);
      const data = (await response.json()) as AgentStatus;
      setAgentStatus({ ...data, checking: false });
    } catch {
      setAgentStatus({ available: false, launchCmd: "Hermes status unavailable", mode: "manual prompt", checking: false });
    }
  }

  async function restartHermes() {
    setBusy("restart");
    try {
      const response = await fetch("/api/agent/restart", { method: "POST" });
      const data = (await response.json()) as AgentStatus;
      setAgentStatus({ ...data, checking: false });
    } finally {
      setBusy("");
    }
  }

  async function runDaily() {
    setBusy("daily");
    setNotice("");
    setAgentRunText("PlannerAgent 正在读取 memory、最近批改和报告，重新生成今日学习流...");
    try {
      const response = await fetch("/api/agents/run-daily", { method: "POST" });
      const payload = (await response.json()) as AgentRunPayload & { error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Daily planner failed");
      if (payload.run?.source !== "hermes") throw new Error(payload.run?.summary || "PlannerAgent did not rerun through Hermes.");
      setHome(payload.home);
      setSelectedBlockId("");
      await loadReports();
      setNotice(`${payload.home.state.appDate} PlannerAgent 重新备课完成：${payload.run.summary}`);
    } catch (error) {
      setNotice(`PlannerAgent 备课失败，题目未刷新。${error instanceof Error ? error.message : "请检查 Hermes 后重试。"}`);
    } finally {
      setAgentRunText("");
      setBusy("");
    }
  }

  async function advanceDay() {
    setBusy("advance");
    setNotice("");
    setAgentRunText("ReviewAgent 正在收束今天记录，PlannerAgent 正在模拟明日 04:00 备课...");
    try {
      const response = await fetch("/api/dev/advance-day", { method: "POST" });
      const payload = (await response.json()) as AgentRunPayload & { error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Advance-day planner failed");
      setHome(payload.home);
      setSelectedBlockId("");
      await loadReports();
      setView("home");
      setNotice(`已推进到 ${payload.home.state.appDate}：${payload.run?.summary ?? "PlannerAgent 已完成明日备课。"}`);
    } catch (error) {
      setNotice(`模拟切天失败，日期和题目未改变。${error instanceof Error ? error.message : "请检查 Hermes 后重试。"}`);
    } finally {
      setAgentRunText("");
      setBusy("");
    }
  }

  async function resetData() {
    setBusy("reset");
    try {
      const response = await fetch("/api/reset", { method: "POST" });
      const payload = (await response.json()) as { ok: boolean; home: HomePayload };
      setHome(payload.home);
      setSelectedBlockId("");
      await loadReports();
      setView("home");
      setNotice("AI Native 数据已重置，旧数据已备份。");
    } finally {
      setBusy("");
    }
  }

  async function sendHermesChat(message: string) {
    setBusy("chat");
    setNotice("");
    setChatMessages((current) => [...current, { role: "user", text: message }]);
    try {
      const response = await fetch("/api/hermes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = (await response.json()) as { ok: boolean; reply: string; planApplied: boolean; stageDrafted?: boolean; home: HomePayload; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Hermes chat failed");
      setChatMessages((current) => [...current, { role: "hermes", text: payload.reply }]);
      setHome(payload.home);
      setSelectedBlockId("");
      await loadReports();
      if (payload.planApplied) setNotice("Hermes 已按你的偏好调整今日学习流。");
      if (payload.stageDrafted) setNotice("Hermes 已生成新的阶段计划草案，请在设置页确认后生效。");
    } catch (error) {
      setChatMessages((current) => [...current, { role: "hermes", text: `对话失败：${error instanceof Error ? error.message : "请稍后重试。"}` }]);
    } finally {
      setBusy("");
    }
  }

  async function savePlan(planProfile: PlanProfile, stagePlan: StagePlan) {
    setBusy("plan");
    setNotice("");
    try {
      const response = await fetch("/api/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planProfile, stagePlan }),
      });
      const payload = (await response.json()) as PlanPayload & { ok: boolean; home: HomePayload; reply?: string; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Plan update failed");
      setHome(payload.home);
      await loadReports();
      setNotice(payload.reply || "PlannerAgent 已更新总计划和当前阶段计划。");
    } catch (error) {
      setNotice(`计划保存失败。${error instanceof Error ? error.message : "请稍后重试。"}`);
    } finally {
      setBusy("");
    }
  }

  async function approveStageDraft() {
    setBusy("approve-stage");
    setNotice("");
    try {
      const response = await fetch("/api/plan/stage/approve", { method: "POST" });
      const payload = (await response.json()) as PlanPayload & { ok: boolean; home: HomePayload; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Stage approve failed");
      setHome(payload.home);
      setSelectedBlockId("");
      setNotice("下一阶段计划已确认，后续每日目标会按新阶段生成。");
    } catch (error) {
      setNotice(`阶段确认失败。${error instanceof Error ? error.message : "请稍后重试。"}`);
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    refreshAll().catch(() => setLoading(false));
  }, []);

  const activeBlock = useMemo(() => {
    const selected = home?.todayBlocks.find((block) => block.id === selectedBlockId);
    return selected ?? home?.todayBlocks.find((block) => block.status !== "graded") ?? home?.todayBlocks[0];
  }, [home, selectedBlockId]);
  const completed = home?.todayBlocks.filter((block) => block.status === "graded").length ?? 0;
  const plannedMinutes = home?.todayBlocks.reduce((sum, block) => sum + block.minutes, 0) ?? 0;

  if (loading || !home) {
    return (
      <main className="loading">
        <Loader2 className="spin" size={30} />
        <p>正在唤醒本机学习 agents...</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div>
            <strong>PathPilot</strong>
            <span>AI Native 学习助手</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button className={view === item.id ? "active" : ""} key={item.id} onClick={() => setView(item.id)} type="button">
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <AgentChip status={agentStatus} />
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Pulse-style Study Assistant</span>
            <h1>{view === "home" ? "今日学习流" : view === "reports" ? "Agent 报告" : "系统设置"}</h1>
          </div>
          <div className="metric-row">
            <Metric label="今日计划" value={`${plannedMinutes} 分钟`} />
            <Metric label="已批改" value={`${completed}/${home.todayBlocks.length}`} />
            <Metric label="记忆线索" value={`${home.state.memories.length}`} />
            <Metric label="模拟日期" value={home.state.appDate.slice(5)} />
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}
        {agentRunText && (
          <div className="agent-run-banner">
            <Loader2 className="spin" size={18} />
            <div>
              <strong>Agent run in progress</strong>
              <span>{agentRunText}</span>
            </div>
          </div>
        )}

        {view === "home" && (
          <HomeView
            activeBlock={activeBlock}
            home={home}
            onHomeChange={setHome}
            reloadReports={loadReports}
            selectedBlockId={selectedBlockId}
            setSelectedBlockId={setSelectedBlockId}
          />
        )}
        {view === "reports" && <ReportsView reports={reports} />}
        {view === "settings" && (
          <SettingsView
            agentStatus={agentStatus}
            busy={busy}
            chatMessages={chatMessages}
            planProfile={home.state.planProfile}
            runs={home.state.agentRuns}
            stageDraft={home.state.stageDraft}
            stagePlan={home.state.stagePlan}
            onAdvanceDay={advanceDay}
            onApproveStageDraft={approveStageDraft}
            onRefresh={refreshAll}
            onReset={resetData}
            onRestartHermes={restartHermes}
            onRunDaily={runDaily}
            onSavePlan={savePlan}
            onSendHermesChat={sendHermesChat}
          />
        )}
      </main>
    </div>
  );
}

function HomeView({
  home,
  activeBlock,
  onHomeChange,
  reloadReports,
  selectedBlockId,
  setSelectedBlockId,
}: {
  home: HomePayload;
  activeBlock?: LearningBlock;
  onHomeChange: (home: HomePayload) => void;
  reloadReports: () => Promise<void>;
  selectedBlockId: string;
  setSelectedBlockId: (blockId: string) => void;
}) {
  const nextBlock = home.todayBlocks.find((block) => block.status !== "graded" && block.id !== activeBlock?.id);

  return (
    <div className="home-grid">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">PlannerAgent 已为今天备课</span>
          <h2>{activeBlock ? activeBlock.title : "今天没有待完成学习块"}</h2>
          <p>{home.agentSummary}</p>
          <p className="stage-summary">{home.stageSummary}</p>
        </div>
        <div className="hero-card">
          <Bot size={24} />
          <strong>{activeBlock?.track ?? "今日完成"}</strong>
          <span>{activeBlock ? `${activeBlock.minutes} 分钟 · ${activeBlock.role === "main" ? "主线" : "维护"}` : "等待明日 04:00 刷新"}</span>
        </div>
      </section>

      <section className="panel focus-panel">
        <BlockTabs blocks={home.todayBlocks} selectedBlockId={selectedBlockId || activeBlock?.id || ""} setSelectedBlockId={setSelectedBlockId} />
        {activeBlock ? (
          <PracticeBlock block={activeBlock} nextBlock={nextBlock} onHomeChange={onHomeChange} reloadReports={reloadReports} setSelectedBlockId={setSelectedBlockId} />
        ) : (
          <EmptyDone />
        )}
      </section>

      <section className="panel side-panel">
        <SectionTitle icon={BarChart3} title="今日摘要" />
        <p className="report-summary">{home.todayReport?.summary ?? "ReportAgent 正在等待更多学习样本。"}</p>
        <div className="mini-list">
          {(home.todayReport?.highlights ?? []).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="panel side-panel">
        <SectionTitle icon={CheckCircle2} title="记忆优先级" />
        <div className="memory-list">
          {home.state.memories.slice(0, 5).map((memory) => (
            <article key={memory.id}>
              <strong>{memory.topic}</strong>
              <span>{memory.weakness}</span>
            </article>
          ))}
          {home.state.memories.length === 0 && <p className="muted">完成第一组批改后，MemoryAgent 会开始记录薄弱点。</p>}
        </div>
      </section>
    </div>
  );
}

function BlockTabs({ blocks, selectedBlockId, setSelectedBlockId }: { blocks: LearningBlock[]; selectedBlockId: string; setSelectedBlockId: (blockId: string) => void }) {
  return (
    <div className="block-tabs">
      {blocks.map((block) => (
        <button className={selectedBlockId === block.id ? "active" : ""} key={block.id} onClick={() => setSelectedBlockId(block.id)} type="button">
          {block.role === "main" ? "主线" : "维护"} · {block.status === "graded" ? "已批改" : "待完成"}
        </button>
      ))}
    </div>
  );
}

function PracticeBlock({
  block,
  nextBlock,
  onHomeChange,
  reloadReports,
  setSelectedBlockId,
}: {
  block: LearningBlock;
  nextBlock?: LearningBlock;
  onHomeChange: (home: HomePayload) => void;
  reloadReports: () => Promise<void>;
  setSelectedBlockId: (blockId: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(block.status === "in_progress");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!running || block.status === "graded") return;
    const timer = window.setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running, block.status]);

  async function startBlock() {
    setRunning(true);
    await fetch("/api/practice/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId: block.id }),
    });
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const submittedAnswers: AnswerSubmission[] = block.questions.map((question) => ({ questionId: question.id, answer: answers[question.id] ?? "" }));
      const response = await fetch("/api/practice/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId: block.id, answers: submittedAnswers, elapsedSeconds: elapsed }),
      });
      const payload = (await response.json()) as { ok: boolean; state: HomePayload["state"]; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Practice submit failed");
      const homeResponse = await fetch("/api/home");
      const nextHome = (await homeResponse.json()) as HomePayload;
      onHomeChange(nextHome);
      setSelectedBlockId(block.id);
      await reloadReports();
    } catch (error) {
      setSubmitError(`GraderAgent 批改失败，进度未更新。${error instanceof Error ? error.message : "请稍后重试。"}`);
    } finally {
      setSubmitting(false);
      setRunning(false);
    }
  }

  if (block.status === "graded" && block.grade) {
    return <GradeCard block={block} grade={block.grade} nextBlock={nextBlock} onHomeChange={onHomeChange} setSelectedBlockId={setSelectedBlockId} />;
  }

  return (
    <div className="practice">
      <div className="practice-head">
        <div>
          <span className="eyebrow">{block.role === "main" ? "今日主线" : "维护块"}</span>
          <h2>{block.title}</h2>
          <p>{block.objective}</p>
        </div>
        <TimerBadge elapsed={elapsed} targetMinutes={block.minutes} />
      </div>
      <div className="content-card">{block.content}</div>
      <div className="question-stack">
        {block.questions.map((question, index) => (
          <article className="question-card" key={question.id}>
            <strong>
              {index + 1}. {question.prompt}
            </strong>
            {question.type === "choice" ? (
              <div className="choice-list">
                {question.options?.map((option) => (
                  <label key={option}>
                    <input checked={answers[question.id] === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} type="radio" />
                    {option}
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                placeholder="写下你的简答，提交后由 GraderAgent 批改"
                value={answers[question.id] ?? ""}
              />
            )}
          </article>
        ))}
      </div>
      {submitting && (
        <div className="agent-run-banner">
          <Loader2 className="spin" size={18} />
          <div>
            <strong>GraderAgent 批改中</strong>
            <span>正在读取题目、rubric、答案和用时，完成后才会更新进度与 memory。</span>
          </div>
        </div>
      )}
      {submitError && <div className="notice">{submitError}</div>}
      <div className="practice-actions">
        <button className="ghost-button" disabled={running} onClick={startBlock} type="button">
          <Play size={16} />
          开始计时
        </button>
        <button className="primary-button" disabled={submitting} onClick={submit} type="button">
          {submitting ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
          {submitting ? "GraderAgent 批改中" : "整组提交批改"}
        </button>
      </div>
    </div>
  );
}

function GradeCard({
  block,
  grade,
  nextBlock,
  onHomeChange,
  setSelectedBlockId,
}: {
  block: LearningBlock;
  grade: GradeResult;
  nextBlock?: LearningBlock;
  onHomeChange: (home: HomePayload) => void;
  setSelectedBlockId: (blockId: string) => void;
}) {
  async function retryBlock() {
    const response = await fetch("/api/practice/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId: block.id }),
    });
    const payload = (await response.json()) as { ok: boolean; home: HomePayload };
    onHomeChange(payload.home);
    setSelectedBlockId(block.id);
  }

  return (
    <div className="grade-card">
      <CheckCircle2 size={30} />
      <span>GraderAgent 批改完成</span>
      <strong>{grade.score} 分</strong>
      <p>{grade.conclusion}</p>
      {grade.showImprovements && (
        <div className="mini-list">
          {grade.improvements.map((item) => (
            <span key={item}>{item}</span>
          ))}
          {grade.nextDrill && <span>改进题：{grade.nextDrill.prompt}</span>}
        </div>
      )}
      {!grade.passed && (
        <button className="ghost-button" onClick={retryBlock} type="button">
          <RefreshCw size={16} />
          重做本组
        </button>
      )}
      {nextBlock && (
        <button className="primary-button" onClick={() => setSelectedBlockId(nextBlock.id)} type="button">
          继续下一块
        </button>
      )}
    </div>
  );
}

function ReportsView({ reports }: { reports: Report[] }) {
  const [type, setType] = useState<"daily" | "weekly">("daily");
  const visible = reports.filter((report) => report.type === type);
  return (
    <section className="panel reports-panel">
      <div className="segmented">
        <button className={type === "daily" ? "active" : ""} onClick={() => setType("daily")} type="button">
          日报
        </button>
        <button className={type === "weekly" ? "active" : ""} onClick={() => setType("weekly")} type="button">
          周报
        </button>
      </div>
      <div className="report-list">
        {visible.map((report) => (
          <article key={report.id}>
            <span>{report.date}</span>
            <strong>{report.title}</strong>
            <p>{report.summary}</p>
            <div className="mini-list">
              {report.highlights.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <em>{report.nextPlan}</em>
          </article>
        ))}
        {visible.length === 0 && <p className="muted">还没有这类报告。周报会在周一或手动补跑时生成。</p>}
      </div>
    </section>
  );
}

function SettingsView({
  agentStatus,
  busy,
  chatMessages,
  planProfile,
  runs,
  stageDraft,
  stagePlan,
  onAdvanceDay,
  onApproveStageDraft,
  onRefresh,
  onReset,
  onRestartHermes,
  onRunDaily,
  onSavePlan,
  onSendHermesChat,
}: {
  agentStatus: AgentStatus | null;
  busy: string;
  chatMessages: ChatMessage[];
  planProfile: PlanProfile;
  runs: AgentRun[];
  stageDraft: StageDraft;
  stagePlan: StagePlan;
  onAdvanceDay: () => Promise<void>;
  onApproveStageDraft: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onReset: () => Promise<void>;
  onRestartHermes: () => Promise<void>;
  onRunDaily: () => Promise<void>;
  onSavePlan: (planProfile: PlanProfile, stagePlan: StagePlan) => Promise<void>;
  onSendHermesChat: (message: string) => Promise<void>;
}) {
  return (
    <div className="settings-grid">
      <section className="panel">
        <SectionTitle icon={Bot} title="Hermes / Agents" />
        <div className="status-box">
          <span className={agentStatus?.available ? "dot on" : "dot"} />
          <div>
            <strong>{agentStatus?.available ? "Hermes 已连接" : "Hermes 未连接"}</strong>
            <p>{agentStatus?.lastError || agentStatus?.mode || "checking"}</p>
          </div>
        </div>
        <div className="settings-actions">
          <button className="ghost-button" disabled={Boolean(busy)} onClick={onRestartHermes} type="button">
            <RefreshCw className={busy === "restart" ? "spin" : ""} size={16} />
            重启 Hermes
          </button>
          <button className="ghost-button" disabled={Boolean(busy)} onClick={onRunDaily} type="button">
            {busy === "daily" ? <Loader2 className="spin" size={16} /> : <Clock3 size={16} />}
            {busy === "daily" ? "PlannerAgent 备课中" : "手动补跑 04:00 备课"}
          </button>
          <button className="ghost-button" disabled={Boolean(busy)} onClick={onAdvanceDay} type="button">
            {busy === "advance" ? <Loader2 className="spin" size={16} /> : <Clock3 size={16} />}
            {busy === "advance" ? "模拟切天中" : "推进一天并重新备课"}
          </button>
          <button className="ghost-button" disabled={Boolean(busy)} onClick={onRefresh} type="button">
            <RefreshCw size={16} />
            刷新状态
          </button>
        </div>
      </section>
      <section className="panel danger-panel">
        <SectionTitle icon={RotateCcw} title="数据重置" />
        <p>会先备份当前 data/state.json，并归档旧 reports，然后创建新版 AI Native 默认状态。</p>
        <button className="danger-button" disabled={Boolean(busy)} onClick={onReset} type="button">
          {busy === "reset" ? <Loader2 className="spin" size={16} /> : <RotateCcw size={16} />}
          重置 AI Native 数据
        </button>
      </section>
      <PlanEditorPanel
        busy={busy === "plan" || busy === "approve-stage"}
        planProfile={planProfile}
        stageDraft={stageDraft}
        stagePlan={stagePlan}
        onApproveStageDraft={onApproveStageDraft}
        onSave={onSavePlan}
      />
      <HermesChatPanel busy={busy === "chat"} messages={chatMessages} onSend={onSendHermesChat} />
      <section className="panel agent-runs-panel">
        <SectionTitle icon={Clock3} title="Agent Runs" />
        <div className="agent-run-list">
          {runs.slice(0, 8).map((run) => (
            <article className={run.status === "failed" ? "failed" : ""} key={run.id}>
              <strong>
                {run.agent} · {run.status}
              </strong>
              <span>{run.summary}</span>
              <small>
                {run.date} · {new Date(run.createdAt).toLocaleTimeString()}
              </small>
            </article>
          ))}
          {runs.length === 0 && <p className="muted">还没有 agent 执行记录。</p>}
        </div>
      </section>
    </div>
  );
}

function AgentChip({ status }: { status: AgentStatus | null }) {
  return (
    <div className="agent-chip">
      <span className={status?.available ? "dot on" : "dot"} />
      <div>
        <strong>{status?.available ? "Hermes online" : "Local agents"}</strong>
        <small>{status?.mode ?? "checking"}</small>
      </div>
    </div>
  );
}

function PlanEditorPanel({
  busy,
  planProfile,
  stageDraft,
  stagePlan,
  onApproveStageDraft,
  onSave,
}: {
  busy: boolean;
  planProfile: PlanProfile;
  stageDraft: StageDraft;
  stagePlan: StagePlan;
  onApproveStageDraft: () => Promise<void>;
  onSave: (planProfile: PlanProfile, stagePlan: StagePlan) => Promise<void>;
}) {
  const [profileDraft, setProfileDraft] = useState(planProfile);
  const [stageDraftForm, setStageDraftForm] = useState(stagePlan);

  useEffect(() => {
    setProfileDraft(planProfile);
    setStageDraftForm(stagePlan);
  }, [planProfile, stagePlan]);

  function updateProfile(key: keyof PlanProfile, value: string) {
    setProfileDraft((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
  }

  function updateStage(key: keyof StagePlan, value: string) {
    setStageDraftForm((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave(profileDraft, { ...stageDraftForm, status: "active", updatedAt: new Date().toISOString() });
  }

  return (
    <section className="panel plan-editor-panel">
      <SectionTitle icon={FileText} title="计划编辑" />
      <form className="plan-form" onSubmit={submit}>
        <label>
          <span>总目标</span>
          <textarea onChange={(event) => updateProfile("longTermGoal", event.target.value)} value={profileDraft.longTermGoal} />
        </label>
        <label>
          <span>优先方向</span>
          <input onChange={(event) => updateProfile("targetTrack", event.target.value)} value={profileDraft.targetTrack} />
        </label>
        <label>
          <span>长期结果</span>
          <textarea onChange={(event) => updateProfile("targetOutcome", event.target.value)} value={profileDraft.targetOutcome} />
        </label>
        <label>
          <span>约束</span>
          <textarea onChange={(event) => updateProfile("constraints", event.target.value)} value={profileDraft.constraints} />
        </label>
        <label>
          <span>学习偏好</span>
          <textarea onChange={(event) => updateProfile("preferences", event.target.value)} value={profileDraft.preferences} />
        </label>
        <label>
          <span>维护项</span>
          <textarea onChange={(event) => updateProfile("maintenanceItems", event.target.value)} value={profileDraft.maintenanceItems} />
        </label>
        <label>
          <span>当前阶段</span>
          <input onChange={(event) => updateStage("title", event.target.value)} value={stageDraftForm.title} />
        </label>
        <label>
          <span>阶段周期</span>
          <div className="date-pair">
            <input onChange={(event) => updateStage("startDate", event.target.value)} type="date" value={stageDraftForm.startDate} />
            <input onChange={(event) => updateStage("endDate", event.target.value)} type="date" value={stageDraftForm.endDate} />
          </div>
        </label>
        <label>
          <span>阶段主线目标</span>
          <textarea onChange={(event) => updateStage("mainObjective", event.target.value)} value={stageDraftForm.mainObjective} />
        </label>
        <label>
          <span>阶段交付物</span>
          <textarea onChange={(event) => updateStage("deliverables", event.target.value)} value={stageDraftForm.deliverables} />
        </label>
        <label>
          <span>完成标准</span>
          <textarea onChange={(event) => updateStage("completionCriteria", event.target.value)} value={stageDraftForm.completionCriteria} />
        </label>
        <label>
          <span>每日节奏</span>
          <textarea onChange={(event) => updateStage("dailyRhythm", event.target.value)} value={stageDraftForm.dailyRhythm} />
        </label>
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
          保存并让 PlannerAgent 规范化
        </button>
      </form>
      {stageDraft && (
        <div className="stage-draft-box">
          <strong>下一阶段草案待确认</strong>
          <span>{stageDraft.reason}</span>
          <p>{stageDraft.stagePlan.title}</p>
          <button className="ghost-button" disabled={busy} onClick={onApproveStageDraft} type="button">
            确认下一阶段
          </button>
        </div>
      )}
    </section>
  );
}

function HermesChatPanel({ busy, messages, onSend }: { busy: boolean; messages: ChatMessage[]; onSend: (message: string) => Promise<void> }) {
  const [draft, setDraft] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    setDraft("");
    await onSend(message);
  }

  return (
    <section className="panel hermes-chat-panel">
      <SectionTitle icon={Bot} title="Hermes 对话" />
      <div className="chat-log">
        {messages.map((message, index) => (
          <article className={message.role} key={`${message.role}-${index}`}>
            <strong>{message.role === "user" ? "你" : "Hermes"}</strong>
            <span>{message.text}</span>
          </article>
        ))}
        {messages.length === 0 && <p className="muted">直接告诉 Hermes 你的偏好，例如：我想先学系统架构师，每天只维护语言学习进度。</p>}
        {busy && (
          <article className="hermes">
            <strong>Hermes</strong>
            <span>正在理解你的偏好并判断是否需要改写今日计划...</span>
          </article>
        )}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <textarea onChange={(event) => setDraft(event.target.value)} placeholder="告诉 Hermes 你想怎么调整学习计划" value={draft} />
        <button className="primary-button" disabled={busy || !draft.trim()} type="submit">
          {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
          发送给 Hermes
        </button>
      </form>
    </section>
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

function SectionTitle({ icon: Icon, title }: { icon: typeof Home; title: string }) {
  return (
    <div className="section-title">
      <Icon size={18} />
      <h2>{title}</h2>
    </div>
  );
}

function TimerBadge({ elapsed, targetMinutes }: { elapsed: number; targetMinutes: number }) {
  const minutes = Math.floor(elapsed / 60);
  const seconds = String(elapsed % 60).padStart(2, "0");
  return (
    <div className="timer-badge">
      <Clock3 size={16} />
      <strong>
        {minutes}:{seconds}
      </strong>
      <span>/ {targetMinutes} 分钟</span>
    </div>
  );
}

function EmptyDone() {
  return (
    <div className="grade-card">
      <CheckCircle2 size={34} />
      <strong>今天的学习流已完成</strong>
      <p>ReportAgent 会把批改结果写入日报，PlannerAgent 明天 04:00 会用这些记忆重新备课。</p>
    </div>
  );
}

export default App;
