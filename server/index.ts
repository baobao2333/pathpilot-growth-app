import express from "express";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  addGeneratedLessonPack,
  assetScore,
  createDefaultState,
  ensureDailySummary,
  ensureTodayTasks,
  riskItems,
  todayKey,
  totalProgress,
  yearProgress,
  type AppState,
  type GeneratedLessonPack,
  type Opportunity,
  type Review,
} from "../src/data";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const statePath = path.join(dataDir, "state.json");
const distDir = path.join(rootDir, "dist");

const hermes = {
  home: process.env.HERMES_HOME ?? "",
  cwd: process.env.HERMES_CWD ?? "",
  bin: process.env.HERMES_BIN ?? "hermes",
  launchCmd: process.env.HERMES_LAUNCH_CMD ?? "",
  distro: process.env.HERMES_WSL_DISTRO ?? "Ubuntu",
};

function hasHermesConfig() {
  return Boolean(hermes.home && hermes.cwd && hermes.bin && hermes.distro);
}

const automationModes = {
  dailyLessons: "每日任务自动生成",
  opportunityRadar: "机会雷达自动更新",
  weeklyReview: "自然周复盘自动生成",
  monthlyReview: "自然月复盘自动生成",
};

type ArbeitnowJob = {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags?: string[];
  location: string;
  created_at: number;
};

type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  tags?: string[];
  publication_date: string;
  candidate_required_location: string;
  description: string;
};

function migrateState(state: AppState): AppState {
  if ((state.version ?? 0) < 2) return createDefaultState();
  const defaults = createDefaultState();
  const partial = state as Partial<AppState>;
  return {
    ...defaults,
    ...state,
    version: 3,
    agentNotes: partial.agentNotes ?? [],
    dailyLessons: partial.dailyLessons ?? [],
    dailySummaries: partial.dailySummaries ?? [],
    agentDesign: defaults.agentDesign,
  };
}

function todayPlannedMinutes(state: AppState) {
  const today = todayKey();
  return state.tasks.filter((task) => task.dueDate === today).reduce((sum, task) => sum + task.minutes, 0);
}

function hasAutomationNote(state: AppState, mode: string, date = todayKey()) {
  return state.agentNotes.some((note) => note.mode === mode && note.date === date);
}

function withAutomationNote(state: AppState, mode: string, prompt: string, response: string, date = todayKey()) {
  return {
    ...state,
    agentNotes: [
      {
        id: `agent-${Buffer.from(`${mode}-${date}`).toString("base64url").slice(0, 12)}`,
        date,
        mode,
        prompt,
        response,
      },
      ...state.agentNotes.filter((note) => !(note.mode === mode && note.date === date)),
    ],
  };
}

function stableId(prefix: string, text: string) {
  return `${prefix}-${Buffer.from(text).toString("base64url").slice(0, 16).toLowerCase()}`;
}

function stripHtml(text: string) {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchJson<T>(url: string, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function scoreOpportunity(title: string, text: string) {
  const titleLower = title.toLowerCase();
  const lower = text.toLowerCase();
  let score = 35;
  if (/product (manager|lead|owner|director)/i.test(title)) score += 35;
  else if (titleLower.includes("product")) score += 25;
  if (titleLower.includes("ai") || titleLower.includes("llm") || titleLower.includes("agent")) score += 20;
  else if (lower.includes("ai") || lower.includes("machine learning") || lower.includes("llm") || lower.includes("agent")) score += 10;
  if (titleLower.includes("platform") || titleLower.includes("solution") || titleLower.includes("growth")) score += 12;
  else if (lower.includes("platform") || lower.includes("solution") || lower.includes("growth")) score += 6;
  if (lower.includes("japan") || lower.includes("tokyo") || lower.includes("asia") || lower.includes("worldwide")) score += 15;
  if (lower.includes("visa") || lower.includes("sponsor")) score += 10;
  if (/engineer|developer|qa|marketing|artist|sales|video/i.test(title) && !titleLower.includes("product")) score -= 22;
  return Math.max(40, Math.min(96, score));
}

function tierFromScore(score: number): Opportunity["tier"] {
  if (score >= 82) return "core";
  if (score >= 66) return "target";
  return "watch";
}

function fromRemotive(job: RemotiveJob): Opportunity {
  const text = `${job.title} ${job.company_name} ${job.category} ${job.tags?.join(" ") ?? ""} ${job.candidate_required_location} ${stripHtml(job.description)}`;
  const fit = scoreOpportunity(job.title, text);
  return {
    id: stableId("opp-remotive", `${job.id}-${job.company_name}-${job.title}`),
    company: job.company_name,
    tier: tierFromScore(fit),
    role: job.title,
    fit,
    visaFit: /worldwide|asia|japan|remote/i.test(job.candidate_required_location),
    contact: "Remotive API",
    status: "research",
    notes: [
      `来源：Remotive public API`,
      `地点：${job.candidate_required_location || "Remote"}`,
      `发布：${job.publication_date?.slice(0, 10) || "未知"}`,
      `理由：${stripHtml(job.description).slice(0, 180)}`,
      `链接：${job.url}`,
    ].join("\n"),
  };
}

function fromArbeitnow(job: ArbeitnowJob): Opportunity {
  const text = `${job.title} ${job.company_name} ${job.tags?.join(" ") ?? ""} ${job.location} ${stripHtml(job.description)}`;
  const fit = scoreOpportunity(job.title, text);
  return {
    id: stableId("opp-arbeitnow", `${job.slug}-${job.company_name}-${job.title}`),
    company: job.company_name,
    tier: tierFromScore(fit),
    role: job.title,
    fit,
    visaFit: job.remote || /japan|tokyo|asia|visa|sponsor/i.test(text),
    contact: "Arbeitnow API",
    status: "research",
    notes: [
      `来源：Arbeitnow public API`,
      `地点：${job.location || (job.remote ? "Remote" : "未知")}`,
      `发布：${new Date(job.created_at * 1000).toISOString().slice(0, 10)}`,
      `理由：${stripHtml(job.description).slice(0, 180)}`,
      `链接：${job.url}`,
    ].join("\n"),
  };
}

function fallbackOpportunities(): Opportunity[] {
  return [
    {
      id: "opp-fallback-mercari",
      company: "Mercari",
      tier: "target",
      role: "AI / Product roles watch",
      fit: 72,
      visaFit: true,
      contact: "Fallback research list",
      status: "research",
      notes: "公开接口暂不可用时的保底研究对象；下一次后台刷新会优先用 Remotive / Arbeitnow 结果覆盖。",
    },
    {
      id: "opp-fallback-paypay",
      company: "PayPay",
      tier: "target",
      role: "Product / Platform roles watch",
      fit: 70,
      visaFit: true,
      contact: "Fallback research list",
      status: "research",
      notes: "公开接口暂不可用时的保底研究对象；下一次后台刷新会优先用 Remotive / Arbeitnow 结果覆盖。",
    },
    {
      id: "opp-fallback-rakuten",
      company: "Rakuten",
      tier: "watch",
      role: "AI / Data / Product roles watch",
      fit: 68,
      visaFit: true,
      contact: "Fallback research list",
      status: "research",
      notes: "公开接口暂不可用时的保底研究对象；下一次后台刷新会优先用 Remotive / Arbeitnow 结果覆盖。",
    },
    {
      id: "opp-fallback-woven",
      company: "Woven by Toyota",
      tier: "watch",
      role: "Platform / Product roles watch",
      fit: 67,
      visaFit: true,
      contact: "Fallback research list",
      status: "research",
      notes: "公开接口暂不可用时的保底研究对象；下一次后台刷新会优先用 Remotive / Arbeitnow 结果覆盖。",
    },
    {
      id: "opp-fallback-smartnews",
      company: "SmartNews",
      tier: "watch",
      role: "AI / Product roles watch",
      fit: 66,
      visaFit: true,
      contact: "Fallback research list",
      status: "research",
      notes: "公开接口暂不可用时的保底研究对象；下一次后台刷新会优先用 Remotive / Arbeitnow 结果覆盖。",
    },
  ];
}

function isRelevantOpportunity(item: Opportunity) {
  if (/office assistant|ta manager|qa automation|video artist|sales/i.test(item.role)) return false;
  return item.fit >= 70;
}

async function fetchOpportunityCandidates() {
  const [arbeitnow, remotiveProduct, remotiveAi] = await Promise.allSettled([
    fetchJson<{ data: ArbeitnowJob[] }>("https://www.arbeitnow.com/api/job-board-api?visa_sponsorship=true"),
    fetchJson<{ jobs: RemotiveJob[] }>("https://remotive.com/api/remote-jobs?search=product%20manager"),
    fetchJson<{ jobs: RemotiveJob[] }>("https://remotive.com/api/remote-jobs?search=AI%20product"),
  ]);

  const opportunities = [
    ...(arbeitnow.status === "fulfilled" ? arbeitnow.value.data.map(fromArbeitnow) : []),
    ...(remotiveProduct.status === "fulfilled" ? remotiveProduct.value.jobs.map(fromRemotive) : []),
    ...(remotiveAi.status === "fulfilled" ? remotiveAi.value.jobs.map(fromRemotive) : []),
  ];

  const seen = new Set<string>();
  return opportunities
    .filter((item) => {
      const key = `${item.company}:${item.role}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return isRelevantOpportunity(item);
    })
    .sort((left, right) => right.fit - left.fit)
    .slice(0, 8);
}

function isPlaceholderOpportunity(item: Opportunity) {
  return item.company === "新目标公司" && item.status === "research" && !item.notes.trim();
}

async function refreshOpportunities(state: AppState) {
  if (hasAutomationNote(state, automationModes.opportunityRadar) && state.opportunities.length > 0) return state;

  let generated: Opportunity[] = [];
  try {
    generated = await fetchOpportunityCandidates();
  } catch {
    generated = [];
  }
  if (generated.length < 5) generated = [...generated, ...fallbackOpportunities()].slice(0, 8);

  const generatedKeys = new Set(generated.map((item) => `${item.company}:${item.role}`.toLowerCase()));
  const existing = state.opportunities.filter((item) => !isPlaceholderOpportunity(item) && !generatedKeys.has(`${item.company}:${item.role}`.toLowerCase()));
  const nextState = {
    ...state,
    opportunities: [...generated, ...existing].slice(0, 12),
  };

  return withAutomationNote(
    nextState,
    automationModes.opportunityRadar,
    "Remotive public API + Arbeitnow public API",
    `后台已刷新 ${generated.length} 个机会候选，并按 AI/Product/Japan/visa 相关性排序。`,
  );
}

function startOfWeekKey(date = new Date()) {
  const day = date.getDay();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return todayKey(start);
}

function startOfMonthKey(date = new Date()) {
  return todayKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

function tasksSince(state: AppState, startDate: string) {
  const today = todayKey();
  return state.tasks.filter((task) => task.dueDate >= startDate && task.dueDate <= today);
}

function buildReview(state: AppState, type: Review["type"], startDate: string): Review {
  const tasks = tasksSince(state, startDate);
  const done = tasks.filter((task) => task.status === "done");
  const doneMain = done.filter((task) => task.kind === "main").length;
  const doneAssets = done.filter((task) => task.kind === "asset").length;
  const plannedMinutes = tasks.reduce((sum, task) => sum + task.minutes, 0);
  const doneMinutes = done.reduce((sum, task) => sum + task.minutes, 0);
  const lagging = tasks.filter((task) => task.status !== "done").slice(0, 4).map((task) => task.title);
  const periodLabel = type === "weekly" ? "本周" : "本月";

  return {
    id: `review-${type}-${startDate}`,
    type,
    date: startDate,
    wins:
      done.length > 0
        ? `${periodLabel}已闭环 ${done.length}/${tasks.length} 个任务，完成 ${doneMinutes}/${plannedMinutes} 分钟。`
        : `${periodLabel}复盘已自动建立，等待任务完成数据回填。`,
    biggestMove: doneMain + doneAssets > 0 ? `主线 ${doneMain} 个、成果 ${doneAssets} 个；年度进度 ${yearProgress(state)}%，总进度 ${totalProgress(state)}%。` : "当前最大推进仍在任务计划层，优先完成主线与成果任务。",
    lagging: lagging.length > 0 ? lagging.join("\n") : "暂无明显滞后任务。",
    adjustment:
      riskItems(state)[0] ??
      `继续维持约 120 分钟/日节奏；资产分 ${assetScore(state)}，优先让学习结果沉淀到作品集或机会验证。`,
  };
}

function upsertReview(state: AppState, review: Review) {
  return {
    ...state,
    reviews: [review, ...state.reviews.filter((item) => item.id !== review.id)],
  };
}

function ensureScheduledReviews(state: AppState) {
  const weekStart = startOfWeekKey();
  const monthStart = startOfMonthKey();
  let nextState = upsertReview(state, buildReview(state, "weekly", weekStart));
  nextState = upsertReview(nextState, buildReview(nextState, "monthly", monthStart));
  nextState = withAutomationNote(nextState, automationModes.weeklyReview, weekStart, "自然周复盘已由后台根据任务完成、风险和进度自动生成。", weekStart);
  return withAutomationNote(nextState, automationModes.monthlyReview, monthStart, "自然月复盘已由后台根据任务完成、风险和进度自动生成。", monthStart);
}

function dailyLessonPrompt(state: AppState) {
  return [
    "你是 PathPilot 的后台每日学习规划 agent。只返回 JSON，不要 Markdown，不要解释。",
    "目标：根据当前学习进度、年度进度、总进度，为今天生成约 120 分钟的可执行任务内容。",
    "硬性规则：",
    "- trackId 只能是 analyst、japanese、portfolio。",
    "- topics 总时长必须在 115-130 分钟之间，通常 4-6 个 topic。",
    "- analyst 至少 2 个 topic，japanese 至少 1 个 topic，portfolio 至少 1 个 topic。",
    "- 每个 topic 必须有 objective、content、examples、questions。",
    "- content 要足以支撑对应 minutes：20 分钟不少于 120 字，30 分钟不少于 220 字，45 分钟不少于 320 字。",
    "- 每个 topic 至少 2 道题，题目要有 prompt、answer、explanation；选择题可加 options。",
    "- japanese 必须按 0 基础设计，从五十音、发音、最小句子开始，不得假设已有 N5/N4/N3。",
    "- 不要给签证法律结论，不要编造用户真实经历。",
    "返回 JSON schema：",
    JSON.stringify(
      {
        title: "今日学习包标题",
        notes: "生成策略一句话",
        topics: [
          {
            trackId: "analyst",
            title: "具体知识点",
            kind: "standard",
            minutes: 30,
            objective: "今天学完能做到什么",
            content: "详细讲解",
            examples: ["例子 1", "例子 2"],
            questions: [
              {
                prompt: "题目",
                answer: "答案",
                explanation: "解析",
                options: ["可选项 A", "可选项 B"],
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
    "当前状态摘要：",
    JSON.stringify(compactState(state), null, 2),
  ].join("\n\n");
}

async function generateDailyLessonPack(state: AppState) {
  const response = await runHermes(dailyLessonPrompt(state));
  return extractJsonObject(response);
}

async function ensureBackgroundDailyLessons(state: AppState) {
  const today = todayKey();
  const existingLesson = state.dailyLessons.some((lesson) => lesson.date === today && lesson.source === "hermes");
  if (existingLesson && todayPlannedMinutes(state) >= 110) return state;

  const seeded = ensureTodayTasks(state);
  if (hasAutomationNote(seeded, automationModes.dailyLessons)) return seeded;
  if (!hasHermesConfig()) {
    return withAutomationNote(seeded, automationModes.dailyLessons, "Hermes 未检测到，使用本地两小时计划", "后台已生成本地任务包。");
  }

  try {
    const pack = await generateDailyLessonPack(seeded);
    return withAutomationNote(addGeneratedLessonPack(seeded, pack), automationModes.dailyLessons, pack.title, pack.notes);
  } catch (error) {
    return withAutomationNote(
      seeded,
      automationModes.dailyLessons,
      "Hermes 自动日课生成失败，已使用本地两小时计划",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function runBackgroundAutomation(state: AppState) {
  let nextState = await ensureBackgroundDailyLessons(state);
  nextState = await refreshOpportunities(nextState);
  nextState = ensureScheduledReviews(nextState);
  return ensureDailySummary(nextState);
}

async function readState() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(statePath)) {
    const initial = await runBackgroundAutomation(createDefaultState());
    await writeFile(statePath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }

  const state = migrateState(JSON.parse(await readFile(statePath, "utf8")) as AppState);
  const refreshed = await runBackgroundAutomation(state);
  if (JSON.stringify(refreshed) !== JSON.stringify(state)) {
    await writeFile(statePath, JSON.stringify(refreshed, null, 2), "utf8");
  }
  return refreshed;
}

async function writeState(state: AppState) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

function toWslPath(windowsPath: string) {
  return windowsPath.replace(/^([A-Za-z]):/, (_, drive: string) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, "/");
}

function compactState(state: AppState) {
  return {
    profile: state.profile,
    xp: state.xp,
    streak: state.streak,
    roadmap: state.roadmap.map((year) => ({
      title: year.title,
      theme: year.theme,
      milestones: year.milestones.map((milestone) => ({
        title: milestone.title,
        progress: milestone.progress,
        status: milestone.status,
      })),
    })),
    todayTasks: state.tasks
      .filter((task) => task.status !== "done")
      .slice(0, 12)
      .map((task) => ({
        title: task.title,
        kind: task.kind,
        track: task.track,
        status: task.status,
        minutes: task.minutes,
        impact: task.impact,
      })),
    portfolio: state.portfolio.map((project) => ({
      title: project.title,
      stage: project.stage,
      progress: project.progress,
      nextStep: project.nextStep,
    })),
    opportunities: state.opportunities.map((item) => ({
      company: item.company,
      role: item.role,
      fit: item.fit,
      status: item.status,
    })),
    materials: state.visa.materials.map((material) => ({
      title: material.title,
      group: material.group,
      status: material.status,
    })),
    learning: state.learning.map((track) => ({
      id: track.id,
      title: track.title,
      progress: track.progress,
      topics: track.topics.slice(0, 8).map((topic) => ({
        title: topic.title,
        mastery: topic.mastery,
        objective: topic.objective,
      })),
    })),
    dailyLessons: state.dailyLessons,
    dailySummaries: state.dailySummaries.slice(-7),
  };
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const source = fenced?.[1] ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(source) as GeneratedLessonPack;
}

function stripTerminalNoise(text: string) {
  return text
    .replace(/\u0000/g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("wsl:"))
    .join("\n")
    .trim();
}

async function runHermes(prompt: string) {
  if (!hasHermesConfig()) throw new Error("Hermes environment is not configured.");

  await mkdir(dataDir, { recursive: true });
  const promptPath = path.join(dataDir, `hermes-${Date.now()}.txt`);
  const scriptPath = path.join(dataDir, `hermes-run-${Date.now()}.sh`);
  await writeFile(promptPath, prompt, "utf8");
  await writeFile(
    scriptPath,
    [
      "#!/bin/bash",
      "set -e",
      `export HERMES_HOME='${hermes.home}'`,
      `exec '${hermes.bin}' chat -Q --source growth-app --max-turns 8 -q "$(cat "$1")"`,
      "",
    ].join("\n"),
    "utf8",
  );
  const wslPromptPath = toWslPath(promptPath);
  const wslScriptPath = toWslPath(scriptPath);

  return await new Promise<string>((resolve, reject) => {
    const child = spawn(
      "wsl.exe",
      ["-d", hermes.distro, "-u", "root", "--cd", hermes.cwd, "/bin/bash", wslScriptPath, wslPromptPath],
      { cwd: rootDir, windowsHide: true },
    );
    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Hermes request timed out after 180 seconds."));
    }, 180000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", async (error) => {
      clearTimeout(timeout);
      await rm(promptPath, { force: true });
      await rm(scriptPath, { force: true });
      reject(error);
    });

    child.on("close", async (code) => {
      clearTimeout(timeout);
      await rm(promptPath, { force: true });
      await rm(scriptPath, { force: true });
      if (code !== 0) {
        reject(new Error(stripTerminalNoise(stderr || stdout) || `Hermes exited with code ${code}.`));
        return;
      }
      resolve(stripTerminalNoise(stdout));
    });
  });
}

const app = express();

app.use(express.json({ limit: "5mb" }));

app.get("/api/state", async (_req, res) => {
  try {
    res.json(await readState());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.put("/api/state", async (req, res) => {
  try {
    await writeState(req.body as AppState);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/agent/status", (_req, res) => {
  res.json({
    available: hasHermesConfig(),
    launchCmd: hermes.launchCmd ? "Configured" : "Set HERMES_LAUNCH_CMD",
    mode: "hermes chat -Q",
  });
});

app.post("/api/agent/run", async (req, res) => {
  try {
    const body = req.body as { mode: string; prompt: string; state: AppState };
    const agentPrompt = [
      "你是 PathPilot 的 AI Coach，服务于一个单用户长期日本高度人才/技人国迁移规划 App。",
      "你只能做规划、拆解、诊断、润色、模拟面试和材料完整性检查；不要给官方法律结论，不要保证签证结果，不要编造经历或数据。",
      `当前模式：${body.mode}`,
      "当前 App 状态摘要：",
      JSON.stringify(compactState(body.state), null, 2),
      "用户请求：",
      body.prompt,
      "请用中文回答，输出要可执行、克制、具体。",
    ].join("\n\n");

    const response = await runHermes(agentPrompt);
    res.json({ ok: true, response });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/agent/generate-daily-lessons", async (_req, res) => {
  try {
    const state = await readState();
    const pack = await generateDailyLessonPack(state);
    const nextState = ensureDailySummary(addGeneratedLessonPack(state, pack));
    await writeState(nextState);
    res.json({ ok: true, state: nextState, response: pack.notes });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(distDir, "index.html"));
  });
}

const server = createServer(app);
const port = Number(process.env.PORT || 4187);

server.listen(port, "127.0.0.1", () => {
  console.log(`PathPilot API listening on http://127.0.0.1:${port}`);
});
