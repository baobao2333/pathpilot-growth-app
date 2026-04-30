import express from "express";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  STATE_VERSION,
  applyGrade,
  createAgentRun,
  createDefaultState,
  createId,
  currentDate,
  ensurePlanState,
  hasAgentRun,
  isAiNativeState,
  latestReport,
  nextDateKey,
  todayKey,
  todaysBlocks,
  upsertReport,
  weekKey,
  type AnswerSubmission,
  type AgentName,
  type AppState,
  type GradeResult,
  type HomePayload,
  type LearningBlock,
  type Memory,
  type PlanProfile,
  type PracticeQuestion,
  type ReportType,
  type Report,
  type StageDraft,
  type StagePlan,
} from "../src/data";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const statePath = path.join(dataDir, "state.json");
const reportsDir = path.join(dataDir, "reports");
const backupsDir = path.join(dataDir, "backups");
const distDir = path.join(rootDir, "dist");

function toWslPath(windowsPath: string) {
  return windowsPath.replace(/^([A-Za-z]):/, (_, drive: string) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, "/");
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

const hermesPath = "/root/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";
const hermes = {
  home: process.env.HERMES_HOME ?? "/mnt/f/HermesAgent/home",
  cwd: process.env.HERMES_CWD ?? toWslPath(rootDir),
  bin: process.env.HERMES_BIN ?? "/root/.hermes/hermes-agent/venv/bin/hermes",
  launchCmd: process.env.HERMES_LAUNCH_CMD ?? "",
  distro: process.env.HERMES_WSL_DISTRO ?? "Ubuntu-24.04-Hermes",
};

let lastHermesLaunchError = "";
let schedulerBusy = false;

type PlannerRunInfo = {
  source: "hermes" | "local" | "skipped";
  elapsedMs: number;
  summary: string;
  error?: string;
};

type HermesTopic = {
  track: string;
  title: string;
  objective: string;
  content: string;
  questions: Array<Omit<PracticeQuestion, "id">>;
};

type HermesPlan = {
  main: HermesTopic;
  maintenance: HermesTopic;
};

type HermesChatResult = {
  reply: string;
  plan?: HermesPlan;
  stageDraft?: StagePlan;
};

type HermesGrade = Omit<GradeResult, "nextDrill"> & {
  nextDrill?: Omit<PracticeQuestion, "id">;
};

type HermesMemoryResult = {
  summary: string;
  memories: Array<Omit<Memory, "id" | "lastSeen">>;
};

type HermesReport = Omit<Report, "id" | "type" | "date" | "createdAt">;

type HermesStageReview = {
  stageCompleted?: boolean;
  reason?: string;
  stageDraft?: StagePlan;
};

type HermesReportResult = HermesReport & {
  stageReview?: HermesStageReview;
};

type HermesPlanUpdate = {
  reply: string;
  planProfile: PlanProfile;
  stagePlan: StagePlan;
};

function hasHermesConfig() {
  return Boolean(hermes.home && hermes.cwd && hermes.bin && hermes.distro);
}

function timestamp() {
  const now = new Date();
  const date = todayKey(now).replace(/-/g, "");
  const time = [now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()].map((part, index) => String(part).padStart(index === 3 ? 3 : 2, "0")).join("");
  return `${date}-${time}`;
}

function stripTerminalNoise(text: string) {
  return text
    .replace(/\u0000/g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("wsl:"))
    .join("\n")
    .trim();
}

function runProcess(command: string, args: string[], timeoutMs = 12000) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { cwd: rootDir, windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeoutId = setTimeout(() => {
      child.kill();
      finish(new Error(`${command} timed out.`));
    }, timeoutMs);

    function finish(error?: Error, output = "") {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (error) reject(error);
      else resolve(stripTerminalNoise(output));
    }

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (code === 0) finish(undefined, stdout);
      else finish(new Error(stripTerminalNoise([stderr, stdout].filter(Boolean).join("\n")) || `${command} exited with code ${code}.`));
    });
  });
}

function runLaunchCommand(command: string, timeoutMs = 15000) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, { cwd: rootDir, shell: true, windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeoutId = setTimeout(() => finish(undefined, stdout || stderr), timeoutMs);

    function finish(error?: Error, output = "") {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (error) reject(error);
      else resolve(stripTerminalNoise(output));
    }

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (code === 0) finish(undefined, stdout);
      else finish(new Error(stripTerminalNoise(stderr || stdout) || `Hermes launch exited with code ${code}.`));
    });
  });
}

async function launchHermes() {
  if (!hasHermesConfig()) throw new Error("Hermes environment is not configured.");
  if (hermes.launchCmd) await runLaunchCommand(hermes.launchCmd);
  else await runProcess("wsl.exe", ["-d", hermes.distro, "-u", "root", "--", "true"]);
}

async function runHermes(prompt: string, timeoutMs = 60000) {
  if (!hasHermesConfig()) throw new Error("Hermes environment is not configured.");
  await ensureDataDirs();
  const promptPath = path.join(dataDir, `hermes-${Date.now()}.txt`);
  const scriptPath = path.join(dataDir, `hermes-run-${Date.now()}.sh`);
  await writeFile(promptPath, prompt, "utf8");
  await writeFile(
    scriptPath,
    [
      "#!/bin/bash",
      "set -e",
      `export HERMES_HOME=${shellQuote(hermes.home)}`,
      `export PATH=${shellQuote(hermesPath)}:$PATH`,
      `exec ${shellQuote(hermes.bin)} -z "$(cat "$1")"`,
      "",
    ].join("\n"),
    "utf8",
  );

  try {
    return await runProcess(
      "wsl.exe",
      ["-d", hermes.distro, "-u", "root", "--cd", hermes.cwd, "/bin/bash", toWslPath(scriptPath), toWslPath(promptPath)],
      timeoutMs,
    );
  } finally {
    await rm(promptPath, { force: true });
    await rm(scriptPath, { force: true });
  }
}

async function isHermesAvailable() {
  if (!hasHermesConfig()) return false;
  const command = hermes.bin.includes("/") ? `test -x ${shellQuote(hermes.bin)}` : `command -v ${shellQuote(hermes.bin)}`;
  try {
    await runProcess("wsl.exe", ["-d", hermes.distro, "-u", "root", "--", "sh", "-lc", `export PATH=${shellQuote(hermesPath)}; ${command}`]);
    return true;
  } catch (error) {
    lastHermesLaunchError = error instanceof Error ? error.message : String(error);
    return false;
  }
}

async function getHermesStatus(autoStart = false) {
  if (autoStart) {
    try {
      await launchHermes();
      lastHermesLaunchError = "";
    } catch (error) {
      lastHermesLaunchError = error instanceof Error ? error.message : String(error);
    }
  }
  const available = await isHermesAvailable();
  return {
    available,
    launchCmd: hermes.launchCmd ? "Configured launch command" : `Auto WSL: ${hermes.distro}`,
    mode: available ? "hermes chat -Q" : "manual prompt",
    canRestart: hasHermesConfig(),
    lastError: available ? "" : lastHermesLaunchError,
  };
}

async function ensureDataDirs() {
  await mkdir(dataDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await mkdir(backupsDir, { recursive: true });
}

async function backupCurrentState(reason = "state-before-ai-native") {
  await ensureDataDirs();
  if (!existsSync(statePath)) return "";
  const backupPath = path.join(backupsDir, `${reason}-${timestamp()}.json`);
  await copyFile(statePath, backupPath);
  return backupPath;
}

async function archiveReports() {
  await ensureDataDirs();
  if (!existsSync(reportsDir)) return "";
  const files = await readdir(reportsDir).catch(() => []);
  if (files.length === 0) return "";
  const archiveDir = path.join(backupsDir, `reports-before-ai-native-${timestamp()}`);
  await rename(reportsDir, archiveDir);
  await mkdir(reportsDir, { recursive: true });
  return archiveDir;
}

async function writeState(state: AppState) {
  await ensureDataDirs();
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

async function initializeState(failSoft = true) {
  const state = createDefaultState();
  const result = await runDailyAgentsWithInfo(state, true, false, failSoft);
  const nextState = result.state;
  await writeState(nextState);
  return nextState;
}

async function readStoredState() {
  await ensureDataDirs();
  if (!existsSync(statePath)) return initializeState();
  const parsed = JSON.parse(await readFile(statePath, "utf8")) as unknown;
  if (!isAiNativeState(parsed)) {
    await backupCurrentState("state-before-ai-native");
    await archiveReports();
    return initializeState();
  }
  return ensurePlanState({
    ...parsed,
    appDate: parsed.appDate ?? todayKey(),
  } as AppState);
}

async function readState() {
  const state = await readStoredState();
  const nextState = await runDueAgents(state);
  if (JSON.stringify(nextState) !== JSON.stringify(state)) await writeState(nextState);
  return nextState;
}

function extractJsonObject<T>(text: string): T {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const source = fenced?.[1] ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(source) as T;
}

function buildPlannerPrompt(state: AppState, date: string, reroll: boolean) {
  return [
    "You are PlannerAgent for an AI-native learning assistant.",
    "Return ONLY valid JSON. No markdown.",
    "Create today's learning flow from the user's long-term plan, current stage plan, recent progress, memories, attempts, and reports.",
    "Priority is fixed: current stage plan first, stage-blocking memories second, general memories third, recent reports fourth.",
    "Do not let memory pull the main block away from the current stage objective. Use memory to shape reinforcement questions only.",
    "The plan must have exactly one 90-110 minute main block and one 10-20 minute maintenance block.",
    "Do not repeat yesterday's exact prompts. If there is a high-priority weakness, create new reinforcement questions.",
    "Schema:",
    '{"main":{"track":"","title":"","objective":"","content":"","questions":[{"type":"choice","prompt":"","options":["","","",""],"answer":"","rubric":""},{"type":"short","prompt":"","answer":"","rubric":""}]},"maintenance":{"track":"","title":"","objective":"","content":"","questions":[{"type":"short","prompt":"","answer":"","rubric":""}]}}',
    "",
    JSON.stringify(
      {
        date,
        reroll,
        profile: state.profile,
        planProfile: state.planProfile,
        stagePlan: state.stagePlan,
        stageDraft: state.stageDraft,
        stageBlockingMemories: state.memories.filter((memory) => memory.stageRelevance === "blocking").slice(0, 8),
        memories: state.memories.slice(0, 12),
        recentAttempts: state.practiceAttempts.slice(0, 6),
        recentReports: state.reports.slice(0, 4),
        existingBlocksForDate: todaysBlocks(state, date),
      },
      null,
      2,
    ),
  ].join("\n");
}

function toHermesBlocks(plan: HermesPlan, date: string): LearningBlock[] {
  return [topicToBlock(plan.main, "main", 100, date), topicToBlock(plan.maintenance, "maintenance", 20, date)];
}

function wantsPlanChange(message: string) {
  return /调整|计划|偏好|不符|先学|维护|改成|换成|重新安排|不想|想学/.test(message);
}

function buildChatPrompt(state: AppState, message: string, requirePlan: boolean) {
  const date = currentDate(state);
  return [
    "You are Hermes inside an AI-native learning assistant.",
    "The user is adjusting learning preferences and today's plan through a direct chat window.",
    "Return ONLY valid JSON. No markdown.",
    "Reply naturally in Chinese.",
    requirePlan ? "This user message requires a planning change. If it changes long-term or stage preference, include stageDraft. If it only changes today, include plan." : "If the user asks to change the current plan, include stageDraft or plan. Otherwise omit both.",
    "Respect this product rule: daily flow should be one 90-110 minute main block plus one 10-20 minute maintenance block.",
    "For example, if the user wants to focus on 系统架构师 and maintain language learning, make main.track about 系统架构师 and maintenance.track about language maintenance.",
    "Schema:",
    '{"reply":"","stageDraft":{"title":"","startDate":"","endDate":"","mainObjective":"","deliverables":"","completionCriteria":"","dailyRhythm":"","status":"active","updatedAt":""},"plan":{"main":{"track":"","title":"","objective":"","content":"","questions":[{"type":"choice","prompt":"","options":["","","",""],"answer":"","rubric":""},{"type":"short","prompt":"","answer":"","rubric":""}]},"maintenance":{"track":"","title":"","objective":"","content":"","questions":[{"type":"short","prompt":"","answer":"","rubric":""}]}}}',
    "",
    JSON.stringify(
      {
        date,
        userMessage: message,
        profile: state.profile,
        planProfile: state.planProfile,
        stagePlan: state.stagePlan,
        stageDraft: state.stageDraft,
        todayBlocks: todaysBlocks(state, date),
        memories: state.memories.slice(0, 10),
        recentAttempts: state.practiceAttempts.slice(0, 6),
        recentReports: state.reports.slice(0, 4),
      },
      null,
      2,
    ),
  ].join("\n");
}

function normalizeChatResult(raw: HermesChatResult) {
  return {
    reply: String(raw.reply || "我已经看过当前学习流。"),
    plan: raw.plan,
    stageDraft: raw.stageDraft,
  };
}

async function runHermesChat(state: AppState, message: string, requirePlan: boolean) {
  const startedAt = Date.now();
  try {
    const response = await runHermes(buildChatPrompt(state, message, requirePlan));
    const result = normalizeChatResult(extractJsonObject<HermesChatResult>(response));
    if (requirePlan && !result.plan && !result.stageDraft) throw new Error("Hermes replied but did not return an updated plan or stage draft.");
    return {
      result,
      run: {
        source: "hermes",
        elapsedMs: Date.now() - startedAt,
        summary: `Hermes chat completed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`,
      },
    };
  } catch (caught) {
    throw new Error(`Hermes chat failed: ${caught instanceof Error ? caught.message : String(caught)}`);
  }
}

function buildPlanUpdatePrompt(state: AppState, planProfile: PlanProfile, stagePlan: StagePlan) {
  return [
    "You are PlannerAgent for an AI-native learning assistant.",
    "Return ONLY valid JSON. No markdown.",
    "Normalize the user's long-term plan and current stage plan into a clear actionable planning context.",
    "The userPlanProfile and userStagePlan fields are authoritative. Do not revert them to currentState.",
    "You may only fill missing details, clarify vague wording, and make the current stage concrete enough for daily planning.",
    "Keep explicit targetTrack, mainObjective, dailyRhythm, preferences, and maintenanceItems intact.",
    "Use Chinese for user-facing fields.",
    "Schema:",
    '{"reply":"","planProfile":{"longTermGoal":"","targetTrack":"","targetOutcome":"","constraints":"","preferences":"","maintenanceItems":"","updatedAt":""},"stagePlan":{"title":"","startDate":"","endDate":"","mainObjective":"","deliverables":"","completionCriteria":"","dailyRhythm":"","status":"active","updatedAt":""}}',
    "",
    JSON.stringify(
      {
        currentState: {
          profile: state.profile,
          currentPlanProfile: state.planProfile,
          currentStagePlan: state.stagePlan,
          memories: state.memories.slice(0, 8),
          recentReports: state.reports.slice(0, 4),
        },
        userPlanProfile: planProfile,
        userStagePlan: stagePlan,
      },
      null,
      2,
    ),
  ].join("\n");
}

function normalizePlanProfile(raw: PlanProfile, fallback: PlanProfile): PlanProfile {
  return {
    longTermGoal: String(raw.longTermGoal || fallback.longTermGoal),
    targetTrack: String(raw.targetTrack || fallback.targetTrack),
    targetOutcome: String(raw.targetOutcome || fallback.targetOutcome),
    constraints: String(raw.constraints || fallback.constraints),
    preferences: String(raw.preferences || fallback.preferences),
    maintenanceItems: String(raw.maintenanceItems || fallback.maintenanceItems),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

async function runPlanUpdateAgent(state: AppState, planProfile: PlanProfile, stagePlan: StagePlan) {
  const startedAt = Date.now();
  try {
    const response = await runHermes(buildPlanUpdatePrompt(state, planProfile, stagePlan));
    const result = extractJsonObject<HermesPlanUpdate>(response);
    const preferUserText = (userValue: string, agentValue: string) => userValue.trim() || agentValue;
    const normalizedPlanProfile = normalizePlanProfile(result.planProfile ?? planProfile, planProfile);
    const normalizedStagePlan = normalizeStagePlan(result.stagePlan ?? stagePlan, stagePlan);
    return {
      reply: String(result.reply || "PlannerAgent 已更新计划。"),
      planProfile: normalizePlanProfile(
        {
          ...normalizedPlanProfile,
          longTermGoal: preferUserText(planProfile.longTermGoal, normalizedPlanProfile.longTermGoal),
          targetTrack: preferUserText(planProfile.targetTrack, normalizedPlanProfile.targetTrack),
          targetOutcome: preferUserText(planProfile.targetOutcome, normalizedPlanProfile.targetOutcome),
          constraints: preferUserText(planProfile.constraints, normalizedPlanProfile.constraints),
          preferences: preferUserText(planProfile.preferences, normalizedPlanProfile.preferences),
          maintenanceItems: preferUserText(planProfile.maintenanceItems, normalizedPlanProfile.maintenanceItems),
        },
        planProfile,
      ),
      stagePlan: normalizeStagePlan(
        {
          ...normalizedStagePlan,
          title: preferUserText(stagePlan.title, normalizedStagePlan.title),
          startDate: preferUserText(stagePlan.startDate, normalizedStagePlan.startDate),
          endDate: preferUserText(stagePlan.endDate, normalizedStagePlan.endDate),
          mainObjective: preferUserText(stagePlan.mainObjective, normalizedStagePlan.mainObjective),
          deliverables: preferUserText(stagePlan.deliverables, normalizedStagePlan.deliverables),
          completionCriteria: preferUserText(stagePlan.completionCriteria, normalizedStagePlan.completionCriteria),
          dailyRhythm: preferUserText(stagePlan.dailyRhythm, normalizedStagePlan.dailyRhythm),
          status: "active",
        },
        stagePlan,
      ),
      run: {
        source: "hermes",
        elapsedMs: Date.now() - startedAt,
        summary: `Hermes PlannerAgent plan update completed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`,
      },
    };
  } catch (caught) {
    throw new Error(`Hermes PlannerAgent plan update failed: ${caught instanceof Error ? caught.message : String(caught)}`);
  }
}

function buildGraderPrompt(block: LearningBlock, answers: AnswerSubmission[], elapsedSeconds: number) {
  return [
    "You are GraderAgent for an AI-native learning assistant.",
    "Return ONLY valid JSON. No markdown.",
    "Grade the whole practice block using the questions, reference answers, rubrics, user answers, and elapsed time.",
    "If elapsed time is lower than 70% of planned time, show improvements and include a nextDrill.",
    "Use Chinese for user-facing text.",
    "Schema:",
    '{"score":0,"passed":false,"conclusion":"","weaknesses":[""],"improvements":[""],"showImprovements":true,"nextDrill":{"type":"short","prompt":"","answer":"","rubric":""}}',
    "",
    JSON.stringify(
      {
        block: {
          title: block.title,
          track: block.track,
          objective: block.objective,
          minutes: block.minutes,
          questions: block.questions.map((question) => ({
            id: question.id,
            type: question.type,
            prompt: question.prompt,
            options: question.options,
            answer: question.answer,
            rubric: question.rubric,
          })),
        },
        answers,
        elapsedSeconds,
      },
      null,
      2,
    ),
  ].join("\n");
}

function normalizeGrade(raw: HermesGrade): GradeResult {
  const score = Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0)));
  return {
    score,
    passed: Boolean(raw.passed) && score >= 70,
    conclusion: String(raw.conclusion || (score >= 70 ? "本组通过。" : "本组需要重做。")),
    weaknesses: Array.isArray(raw.weaknesses) ? raw.weaknesses.map(String).filter(Boolean) : [],
    improvements: Array.isArray(raw.improvements) ? raw.improvements.map(String).filter(Boolean) : [],
    showImprovements: Boolean(raw.showImprovements),
    nextDrill: raw.nextDrill
      ? {
          id: createId("drill"),
          type: raw.nextDrill.type === "choice" ? "choice" : "short",
          prompt: String(raw.nextDrill.prompt || "请重新解释本组核心知识点。"),
          options: raw.nextDrill.type === "choice" ? raw.nextDrill.options?.slice(0, 4) : undefined,
          answer: String(raw.nextDrill.answer || ""),
          rubric: String(raw.nextDrill.rubric || "按题目要求作答。"),
        }
      : undefined,
  };
}

async function runGraderAgent(block: LearningBlock, answers: AnswerSubmission[], elapsedSeconds: number) {
  const startedAt = Date.now();
  try {
    const response = await runHermes(buildGraderPrompt(block, answers, elapsedSeconds));
    return {
      grade: normalizeGrade(extractJsonObject<HermesGrade>(response)),
      run: {
        source: "hermes",
        elapsedMs: Date.now() - startedAt,
        summary: `Hermes GraderAgent completed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`,
      },
    };
  } catch (caught) {
    throw new Error(`Hermes GraderAgent failed: ${caught instanceof Error ? caught.message : String(caught)}`);
  }
}

function failedRun(agent: AgentName, type: string, date: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return createAgentRun(agent, type, date, message, "failed");
}

function buildMemoryPrompt(state: AppState, block: LearningBlock, answers: AnswerSubmission[], grade: GradeResult) {
  return [
    "You are MemoryAgent for an AI-native learning assistant.",
    "Return ONLY valid JSON. No markdown.",
    "Convert the graded attempt into durable learning memories. Keep only useful weaknesses, misconceptions, low-confidence points, and planning signals.",
    "Mark stageRelevance as blocking only when the weakness directly blocks the current stage plan. Otherwise use related or general.",
    "Use Chinese for user-facing text.",
    "Schema:",
    '{"summary":"","memories":[{"track":"","topic":"","weakness":"","evidence":"","priority":50,"stageRelevance":"blocking"}]}',
    "",
    JSON.stringify(
      {
        date: block.date,
        profile: state.profile,
        planProfile: state.planProfile,
        stagePlan: state.stagePlan,
        block,
        answers,
        grade,
        existingMemories: state.memories.slice(0, 12),
      },
      null,
      2,
    ),
  ].join("\n");
}

function normalizeMemories(raw: HermesMemoryResult, date: string) {
  return {
    summary: String(raw.summary || "MemoryAgent updated learning memories."),
    memories: (Array.isArray(raw.memories) ? raw.memories : [])
      .map((memory) => {
        const stageRelevance: Memory["stageRelevance"] =
          memory.stageRelevance === "blocking" || memory.stageRelevance === "related" ? memory.stageRelevance : "general";
        return {
          id: createId("mem"),
          track: String(memory.track || "学习"),
          topic: String(memory.topic || "未命名主题"),
          weakness: String(memory.weakness || ""),
          evidence: String(memory.evidence || ""),
          lastSeen: date,
          priority: Math.max(1, Math.min(100, Math.round(Number(memory.priority) || 50))),
          stageRelevance,
        };
      })
      .filter((memory) => memory.weakness),
  };
}

function mergeMemories(existing: Memory[], incoming: Memory[]) {
  const next = [...existing];
  for (const memory of incoming) {
    const match = next.find((item) => item.track === memory.track && item.topic === memory.topic && item.weakness === memory.weakness);
    if (match) {
      match.priority = Math.max(match.priority, memory.priority);
      match.evidence = memory.evidence;
      match.lastSeen = memory.lastSeen;
    } else {
      next.push(memory);
    }
  }
  return next.sort((a, b) => b.priority - a.priority).slice(0, 40);
}

async function runMemoryAgent(state: AppState, block: LearningBlock, answers: AnswerSubmission[], grade: GradeResult) {
  const startedAt = Date.now();
  try {
    const response = await runHermes(buildMemoryPrompt(state, block, answers, grade));
    const result = normalizeMemories(extractJsonObject<HermesMemoryResult>(response), block.date);
    return {
      memories: mergeMemories(state.memories, result.memories),
      run: {
        source: "hermes",
        elapsedMs: Date.now() - startedAt,
        summary: `Hermes MemoryAgent completed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s. ${result.summary}`,
      },
    };
  } catch (caught) {
    throw new Error(`Hermes MemoryAgent failed: ${caught instanceof Error ? caught.message : String(caught)}`);
  }
}

function buildReportPrompt(state: AppState, type: ReportType, date: string) {
  const agent = type === "daily" ? "ReportAgent" : "ReviewAgent";
  return [
    `You are ${agent} for an AI-native learning assistant.`,
    "Return ONLY valid JSON. No markdown.",
    type === "daily"
      ? "Create a Pulse-style daily learning brief. Explain whether today's work advanced the current stage plan."
      : "Create a weekly review brief. Audit current stage completion. If completion criteria are met, include a stageDraft for the next stage; otherwise explain blockers.",
    "Use Chinese for user-facing text.",
    "Schema:",
    '{"title":"","summary":"","highlights":[""],"nextPlan":"","stageReview":{"stageCompleted":false,"reason":"","stageDraft":{"title":"","startDate":"","endDate":"","mainObjective":"","deliverables":"","completionCriteria":"","dailyRhythm":"","status":"active","updatedAt":""}}}',
    "",
    JSON.stringify(
      {
        date,
        type,
        profile: state.profile,
        planProfile: state.planProfile,
        stagePlan: state.stagePlan,
        stageDraft: state.stageDraft,
        todayBlocks: todaysBlocks(state, date),
        recentBlocks: state.learningFlow.slice(-10),
        memories: state.memories.slice(0, 12),
        attempts: state.practiceAttempts.slice(0, 10),
        reports: state.reports.slice(0, 5),
        agentRuns: state.agentRuns.slice(0, 10),
      },
      null,
      2,
    ),
  ].join("\n");
}

function normalizeStagePlan(raw: StagePlan, fallback: StagePlan): StagePlan {
  return {
    title: String(raw.title || fallback.title),
    startDate: String(raw.startDate || fallback.startDate),
    endDate: String(raw.endDate || fallback.endDate),
    mainObjective: String(raw.mainObjective || fallback.mainObjective),
    deliverables: String(raw.deliverables || fallback.deliverables),
    completionCriteria: String(raw.completionCriteria || fallback.completionCriteria),
    dailyRhythm: String(raw.dailyRhythm || fallback.dailyRhythm),
    status: raw.status === "completed" ? "completed" : "active",
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

function normalizeReport(raw: HermesReportResult, type: ReportType, date: string, currentStage: StagePlan): { report: Report; stageDraft: StageDraft } {
  const stageCompleted = Boolean(raw.stageReview?.stageCompleted);
  const draftPlan = raw.stageReview?.stageDraft;
  return {
    report: {
      id: type === "daily" ? `daily-${date}` : `weekly-${weekKey(date)}`,
      type,
      date: type === "daily" ? date : weekKey(date),
      title: String(raw.title || (type === "daily" ? `${date} 学习日报` : `${weekKey(date)} 周复盘`)),
      summary: String(raw.summary || ""),
      highlights: Array.isArray(raw.highlights) ? raw.highlights.map(String).filter(Boolean).slice(0, 6) : [],
      nextPlan: String(raw.nextPlan || ""),
      createdAt: new Date().toISOString(),
    },
    stageDraft:
      type === "weekly" && stageCompleted && draftPlan
        ? {
            status: "pending",
            reason: String(raw.stageReview?.reason || "ReviewAgent 判断当前阶段已完成，建议进入下一阶段。"),
            stagePlan: normalizeStagePlan(draftPlan, currentStage),
            createdAt: new Date().toISOString(),
          }
        : null,
  };
}

async function runReportAgent(state: AppState, type: ReportType, date: string) {
  const startedAt = Date.now();
  const agent = type === "daily" ? "ReportAgent" : "ReviewAgent";
  try {
    const response = await runHermes(buildReportPrompt(state, type, date));
    const result = normalizeReport(extractJsonObject<HermesReportResult>(response), type, date, state.stagePlan);
    return {
      report: result.report,
      stageDraft: result.stageDraft,
      run: {
        source: "hermes",
        elapsedMs: Date.now() - startedAt,
        summary: `Hermes ${agent} completed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`,
      },
    };
  } catch (caught) {
    throw new Error(`Hermes ${agent} failed: ${caught instanceof Error ? caught.message : String(caught)}`);
  }
}

function topicToBlock(topic: HermesTopic, role: LearningBlock["role"], minutes: number, date: string): LearningBlock {
  return {
    id: createId(role === "main" ? "main" : "keep"),
    date,
    role,
    track: String(topic.track || (role === "main" ? "主线" : "维护")),
    title: String(topic.title || (role === "main" ? "今日主线" : "今日维护")),
    objective: String(topic.objective || "完成本学习块并提交批改。"),
    content: String(topic.content || ""),
    minutes,
    status: "not_started",
    questions: topic.questions.slice(0, role === "main" ? 3 : 1).map((question, index) => ({
      id: createId(`q${index + 1}`),
      type: question.type === "choice" ? "choice" : "short",
      prompt: String(question.prompt || "请完成本题。"),
      options: question.type === "choice" ? question.options?.slice(0, 4) : undefined,
      answer: String(question.answer || ""),
      rubric: String(question.rubric || "按题目要求作答。"),
    })),
  };
}

async function runDueAgents(state: AppState) {
  const now = new Date();
  const realDate = todayKey(now);
  const stateDate = currentDate(state);
  if (stateDate < realDate && now.getHours() >= 4) {
    return runDailyAgents({ ...state, appDate: realDate }, true);
  }
  if (stateDate === realDate && now.getHours() < 4 && todaysBlocks(state, stateDate).length > 0) return state;
  return runDailyAgents(state);
}

async function runDailyAgents(state: AppState, force = false, reroll = false) {
  return (await runDailyAgentsWithInfo(state, force, reroll, true)).state;
}

async function runDailyAgentsWithInfo(state: AppState, force = false, reroll = false, failSoft = false) {
  const date = currentDate(state);
  let nextState = state;
  let run: PlannerRunInfo = {
    source: "skipped",
    elapsedMs: 0,
    summary: "PlannerAgent skipped because today's plan already exists.",
  };
  if (force || !hasAgentRun(nextState, "daily-plan", date) || todaysBlocks(nextState, date).length === 0) {
    const startedAt = Date.now();
    const rotation = reroll ? nextState.agentRuns.filter((run) => run.type === "daily-plan" && run.date === date).length + 1 : 0;
    let plan: LearningBlock[];
    try {
      const response = await runHermes(buildPlannerPrompt(nextState, date, reroll || rotation > 0));
      plan = toHermesBlocks(extractJsonObject<HermesPlan>(response), date);
    } catch (caught) {
      if (failSoft) {
        return {
          state: {
            ...nextState,
            agentRuns: [failedRun("PlannerAgent", "daily-plan", date, caught), ...nextState.agentRuns],
          },
          run: {
            source: "hermes" as const,
            elapsedMs: Date.now() - startedAt,
            summary: `Hermes PlannerAgent failed: ${caught instanceof Error ? caught.message : String(caught)}`,
          },
        };
      }
      throw new Error(`Hermes PlannerAgent failed: ${caught instanceof Error ? caught.message : String(caught)}`);
    }
    const elapsedMs = Date.now() - startedAt;
    run = {
      source: "hermes",
      elapsedMs,
      summary: `Hermes PlannerAgent completed in ${(elapsedMs / 1000).toFixed(1)}s.`,
    };
    nextState = {
      ...nextState,
      learningFlow: [...nextState.learningFlow.filter((block) => block.date !== date), ...plan],
      agentRuns: [createAgentRun("PlannerAgent", "daily-plan", date, `${run.summary} Generated ${plan.length} blocks.`), ...nextState.agentRuns],
    };
  }

  if (force || !hasAgentRun(nextState, "daily-report", date)) {
    try {
      const daily = await runReportAgent(nextState, "daily", date);
      nextState = {
        ...upsertReport(nextState, daily.report),
        stageDraft: daily.stageDraft ?? nextState.stageDraft,
        agentRuns: [createAgentRun("ReportAgent", "daily-report", date, daily.run.summary), ...nextState.agentRuns],
      };
      await writeReportFile(daily.report);
    } catch (caught) {
      if (!failSoft) throw caught;
      nextState = {
        ...nextState,
        agentRuns: [failedRun("ReportAgent", "daily-report", date, caught), ...nextState.agentRuns],
      };
    }
  }

  if (new Date(`${date}T00:00:00`).getDay() === 1 || force) {
    const weeklyDate = weekKey(date);
    if (force || !hasAgentRun(nextState, "weekly-report", weeklyDate)) {
      try {
        const weekly = await runReportAgent(nextState, "weekly", date);
        nextState = {
          ...upsertReport(nextState, weekly.report),
          stageDraft: weekly.stageDraft ?? nextState.stageDraft,
          agentRuns: [createAgentRun("ReviewAgent", "weekly-report", weeklyDate, weekly.run.summary), ...nextState.agentRuns],
        };
        await writeReportFile(weekly.report);
      } catch (caught) {
        if (!failSoft) throw caught;
        nextState = {
          ...nextState,
          agentRuns: [failedRun("ReviewAgent", "weekly-report", weeklyDate, caught), ...nextState.agentRuns],
        };
      }
    }
  }

  return { state: nextState, run };
}

async function writeReportFile(report: Report) {
  await ensureDataDirs();
  const fileName = report.type === "daily" ? `${report.date}-daily.md` : `${report.date}-weekly.md`;
  const body = [`# ${report.title}`, "", report.summary, "", "## Highlights", ...report.highlights.map((item) => `- ${item}`), "", "## Next Plan", report.nextPlan, ""].join("\n");
  await writeFile(path.join(reportsDir, fileName), body, "utf8");
}

function buildHomePayload(state: AppState): HomePayload {
  const todayBlocks = todaysBlocks(state, currentDate(state));
  const todayReport = latestReport(state, "daily");
  const latestWeeklyReport = latestReport(state, "weekly");
  const focus = todayBlocks.find((block) => block.role === "main")?.title ?? "等待 PlannerAgent 生成今日主线";
  return {
    state,
    todayBlocks,
    todayReport,
    latestWeeklyReport,
    agentSummary: todayReport?.summary ?? `今日聚焦：${focus}`,
    stageSummary: state.stageDraft
      ? `新阶段待确认：${state.stageDraft.stagePlan.title}`
      : `当前阶段：${state.stagePlan.title}`,
  };
}

async function resetState() {
  await backupCurrentState("state-before-ai-native-reset");
  await archiveReports();
  await rm(statePath, { force: true });
  return initializeState(false);
}

async function advanceDay() {
  const state = await readState();
  const nextState = {
    ...state,
    appDate: nextDateKey(currentDate(state)),
  };
  return runDailyAgentsWithInfo(nextState, true, false);
}

async function schedulerTick() {
  if (schedulerBusy) return;
  schedulerBusy = true;
  try {
    const state = await readStoredState();
    const nextState = await runDueAgents(state);
    if (JSON.stringify(nextState) !== JSON.stringify(state)) await writeState(nextState);
  } catch (error) {
    console.error(error);
  } finally {
    schedulerBusy = false;
  }
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

app.get("/api/home", async (_req, res) => {
  try {
    res.json(buildHomePayload(await readState()));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/reports", async (_req, res) => {
  try {
    const state = await readState();
    res.json({ reports: state.reports });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/plan", async (_req, res) => {
  try {
    const state = await readState();
    res.json({ planProfile: state.planProfile, stagePlan: state.stagePlan, stageDraft: state.stageDraft });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.put("/api/plan", async (req, res) => {
  try {
    const body = req.body as { planProfile: PlanProfile; stagePlan: StagePlan };
    const state = await readState();
    const update = await runPlanUpdateAgent(state, body.planProfile, body.stagePlan);
    const date = currentDate(state);
    const nextState = {
      ...state,
      planProfile: update.planProfile,
      stagePlan: update.stagePlan,
      stageDraft: null,
      agentRuns: [createAgentRun("PlannerAgent", "plan-update", date, update.run.summary), ...state.agentRuns],
    };
    await writeState(nextState);
    res.json({ ok: true, reply: update.reply, home: buildHomePayload(nextState), planProfile: nextState.planProfile, stagePlan: nextState.stagePlan, stageDraft: nextState.stageDraft });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/plan/stage/approve", async (_req, res) => {
  try {
    const state = await readState();
    if (!state.stageDraft) throw new Error("No pending stage draft.");
    const date = currentDate(state);
    const nextStage = {
      ...state.stageDraft.stagePlan,
      status: "active" as const,
      updatedAt: new Date().toISOString(),
    };
    const nextState = {
      ...state,
      stagePlan: nextStage,
      stageDraft: null,
      agentRuns: [createAgentRun("ReviewAgent", "stage-approve", date, `Approved next stage: ${nextStage.title}`), ...state.agentRuns],
    };
    await writeState(nextState);
    res.json({ ok: true, home: buildHomePayload(nextState), planProfile: nextState.planProfile, stagePlan: nextState.stagePlan, stageDraft: nextState.stageDraft });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/practice/submit", async (req, res) => {
  try {
    const body = req.body as { blockId: string; answers: AnswerSubmission[]; elapsedSeconds: number };
    const state = await readState();
    const block = state.learningFlow.find((item) => item.id === body.blockId);
    if (!block) throw new Error("Learning block not found.");
    const grader = await runGraderAgent(block, body.answers, body.elapsedSeconds);
    const memory = await runMemoryAgent(state, block, body.answers, grader.grade);
    let nextState = applyGrade(state, body.blockId, body.answers, body.elapsedSeconds, grader.grade, memory.memories);
    nextState = {
      ...nextState,
      agentRuns: [
        createAgentRun("MemoryAgent", "memory-update", block.date, memory.run.summary),
        createAgentRun("GraderAgent", "practice-grade", block.date, grader.run.summary),
        ...nextState.agentRuns.filter((run) => !(run.type === "practice-grade" && run.date === block.date) && !(run.type === "memory-update" && run.date === block.date)),
      ],
    };
    const reportResult = await runReportAgent(nextState, "daily", block.date);
    nextState = {
      ...upsertReport(nextState, reportResult.report),
      stageDraft: reportResult.stageDraft ?? nextState.stageDraft,
      agentRuns: [createAgentRun("ReportAgent", "daily-report", block.date, reportResult.run.summary), ...nextState.agentRuns],
    };
    await writeReportFile(reportResult.report);
    await writeState(nextState);
    const gradedBlock = nextState.learningFlow.find((item) => item.id === body.blockId);
    res.json({ ok: true, block: gradedBlock, grade: gradedBlock?.grade, state: nextState, runs: [grader.run, memory.run, reportResult.run] });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/practice/start", async (req, res) => {
  try {
    const body = req.body as { blockId: string };
    const state = await readState();
    const startedAt = new Date().toISOString();
    const nextState = {
      ...state,
      learningFlow: state.learningFlow.map((block) =>
        block.id === body.blockId && block.status === "not_started" ? { ...block, status: "in_progress" as const, startedAt } : block,
      ),
    };
    await writeState(nextState);
    res.json({ ok: true, home: buildHomePayload(nextState) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/practice/retry", async (req, res) => {
  try {
    const body = req.body as { blockId: string };
    const state = await readState();
    const nextState = {
      ...state,
      learningFlow: state.learningFlow.map((block) =>
        block.id === body.blockId
          ? {
              ...block,
              status: "not_started" as const,
              startedAt: undefined,
              submittedAt: undefined,
              gradedAt: undefined,
              grade: undefined,
            }
          : block,
      ),
    };
    await writeState(nextState);
    res.json({ ok: true, home: buildHomePayload(nextState) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/agents/run-daily", async (_req, res) => {
  try {
    const state = await readState();
    const result = await runDailyAgentsWithInfo(state, true, true, true);
    await writeState(result.state);
    if (result.run.summary.startsWith("Hermes PlannerAgent failed")) {
      res.status(500).json({ ok: false, error: result.run.summary, home: buildHomePayload(result.state), run: result.run });
      return;
    }
    res.json({ ok: true, home: buildHomePayload(result.state), run: result.run });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/hermes/chat", async (req, res) => {
  try {
    const body = req.body as { message: string };
    const state = await readState();
    const date = currentDate(state);
    const chat = await runHermesChat(state, body.message, wantsPlanChange(body.message));
    let nextState: AppState = {
      ...state,
      agentRuns: [createAgentRun("PlannerAgent", "coach-chat", date, chat.run.summary), ...state.agentRuns],
    };

    if (chat.result.plan) {
      const plan = toHermesBlocks(chat.result.plan, date);
      nextState = {
        ...nextState,
        learningFlow: [...nextState.learningFlow.filter((block) => block.date !== date), ...plan],
        agentRuns: [createAgentRun("PlannerAgent", "plan-adjust", date, "Hermes chat adjusted today's learning flow."), ...nextState.agentRuns],
      };
      const report = await runReportAgent(nextState, "daily", date);
      nextState = {
        ...upsertReport(nextState, report.report),
        stageDraft: report.stageDraft ?? nextState.stageDraft,
        agentRuns: [createAgentRun("ReportAgent", "daily-report", date, report.run.summary), ...nextState.agentRuns],
      };
      await writeReportFile(report.report);
    }
    if (chat.result.stageDraft) {
      nextState = {
        ...nextState,
        stageDraft: {
          status: "pending",
          reason: "Hermes 根据对话生成了新的阶段计划草案。",
          stagePlan: normalizeStagePlan(chat.result.stageDraft, state.stagePlan),
          createdAt: new Date().toISOString(),
        },
        agentRuns: [createAgentRun("PlannerAgent", "stage-draft", date, "Hermes chat created a stage plan draft."), ...nextState.agentRuns],
      };
    }

    await writeState(nextState);
    res.json({ ok: true, reply: chat.result.reply, planApplied: Boolean(chat.result.plan), stageDrafted: Boolean(chat.result.stageDraft), home: buildHomePayload(nextState), run: chat.run });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/dev/advance-day", async (_req, res) => {
  try {
    const result = await advanceDay();
    await writeState(result.state);
    res.json({ ok: true, home: buildHomePayload(result.state), run: result.run });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/reset", async (_req, res) => {
  try {
    const state = await resetState();
    res.json({ ok: true, home: buildHomePayload(state) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/agent/status", async (req, res) => {
  try {
    res.json(await getHermesStatus(req.query.autoStart === "1"));
  } catch (error) {
    res.status(500).json({ available: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/agent/restart", async (_req, res) => {
  try {
    if (hasHermesConfig()) {
      await runProcess("wsl.exe", ["--terminate", hermes.distro]).catch(() => "");
      await launchHermes();
    }
    res.json(await getHermesStatus());
  } catch (error) {
    lastHermesLaunchError = error instanceof Error ? error.message : String(error);
    res.status(500).json({ ...(await getHermesStatus()), error: lastHermesLaunchError });
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

setInterval(schedulerTick, 60000);
schedulerTick();
