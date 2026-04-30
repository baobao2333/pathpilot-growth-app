export const STATE_VERSION = 11;

export type BlockStatus = "not_started" | "in_progress" | "submitted" | "graded";
export type QuestionType = "choice" | "short";
export type ReportType = "daily" | "weekly";
export type AgentName = "PlannerAgent" | "GraderAgent" | "MemoryAgent" | "ReviewAgent" | "ReportAgent";

export type Profile = {
  name: string;
  startDate: string;
  targetRole: string;
  dailyMinutes: number;
  timezone: string;
};

export type PlanProfile = {
  longTermGoal: string;
  targetTrack: string;
  targetOutcome: string;
  constraints: string;
  preferences: string;
  maintenanceItems: string;
  updatedAt: string;
};

export type StagePlan = {
  title: string;
  startDate: string;
  endDate: string;
  mainObjective: string;
  deliverables: string;
  completionCriteria: string;
  dailyRhythm: string;
  status: "active" | "completed";
  updatedAt: string;
};

export type StageDraft = {
  status: "pending";
  reason: string;
  stagePlan: StagePlan;
  createdAt: string;
} | null;

export type PracticeQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  answer: string;
  rubric: string;
};

export type LearningBlock = {
  id: string;
  date: string;
  role: "main" | "maintenance";
  track: string;
  title: string;
  objective: string;
  content: string;
  minutes: number;
  status: BlockStatus;
  startedAt?: string;
  submittedAt?: string;
  gradedAt?: string;
  questions: PracticeQuestion[];
  grade?: GradeResult;
};

export type AnswerSubmission = {
  questionId: string;
  answer: string;
};

export type GradeResult = {
  score: number;
  passed: boolean;
  conclusion: string;
  weaknesses: string[];
  improvements: string[];
  showImprovements: boolean;
  nextDrill?: PracticeQuestion;
};

export type PracticeAttempt = {
  id: string;
  blockId: string;
  date: string;
  answers: AnswerSubmission[];
  elapsedSeconds: number;
  submittedAt: string;
  grade: GradeResult;
};

export type Memory = {
  id: string;
  track: string;
  topic: string;
  weakness: string;
  evidence: string;
  lastSeen: string;
  priority: number;
  stageRelevance?: "blocking" | "related" | "general";
};

export type Report = {
  id: string;
  type: ReportType;
  date: string;
  title: string;
  summary: string;
  highlights: string[];
  nextPlan: string;
  createdAt: string;
};

export type AgentRun = {
  id: string;
  agent: AgentName;
  type: string;
  date: string;
  status: "completed" | "failed";
  summary: string;
  createdAt: string;
};

export type AppState = {
  version: number;
  appDate: string;
  profile: Profile;
  planProfile: PlanProfile;
  stagePlan: StagePlan;
  stageDraft: StageDraft;
  xp: number;
  streak: number;
  lastCompletionDate: string;
  completedDates: string[];
  learningFlow: LearningBlock[];
  memories: Memory[];
  reports: Report[];
  practiceAttempts: PracticeAttempt[];
  agentRuns: AgentRun[];
};

export type HomePayload = {
  state: AppState;
  todayBlocks: LearningBlock[];
  todayReport?: Report;
  latestWeeklyReport?: Report;
  agentSummary: string;
  stageSummary: string;
};

type PlanTopic = {
  track: string;
  title: string;
  objective: string;
  content: string;
  questions: Array<Omit<PracticeQuestion, "id">>;
};

const mainTopics: PlanTopic[] = [
  {
    track: "系统分析师",
    title: "需求与约束的区分",
    objective: "能把一个业务描述拆成需求、约束和风险。",
    content:
      "今天的主线是建立系统分析的基本判断力。需求是系统必须提供的能力，约束是设计时不能突破的限制，风险是不处理会影响目标的不确定因素。学习时先读材料，再用自己的话重写案例，最后完成题目。",
    questions: [
      {
        type: "choice" as const,
        prompt: "“现有系统不能停机超过 10 分钟”更接近哪一类？",
        options: ["需求", "约束", "风险", "成果"],
        answer: "约束",
        rubric: "能区分系统要实现的能力和实施时必须遵守的限制。",
      },
      {
        type: "short" as const,
        prompt: "把“用户提交简历后系统自动生成英文 profile”按需求、约束、风险各写一句。",
        answer: "需求：自动生成英文 profile。约束：基于用户真实简历。风险：生成内容夸大或不适合目标岗位。",
        rubric: "答案需要覆盖三类，并避免编造用户经历。",
      },
    ],
  },
  {
    track: "系统分析师",
    title: "输入-处理-输出描述系统",
    objective: "能用 IPO 模型快速描述一个系统边界。",
    content:
      "IPO 是 Input、Process、Output。先写输入数据，再写处理规则，最后写输出结果。这个模型适合把模糊想法变成可讨论的系统边界。",
    questions: [
      {
        type: "choice" as const,
        prompt: "在 IPO 模型里，“生成学习报告”属于哪一部分？",
        options: ["Input", "Process", "Output", "Constraint"],
        answer: "Output",
        rubric: "能识别系统最终交付给用户或下游的结果。",
      },
      {
        type: "short" as const,
        prompt: "用 IPO 描述“AI 批改一组学习题目”的系统边界。",
        answer: "输入：用户答案、参考答案和题目 rubric。处理：比对答案、判断薄弱点、生成反馈。输出：得分、结论、改进点和记忆记录。",
        rubric: "答案需要包含输入、处理、输出三段。",
      },
    ],
  },
  {
    track: "作品集",
    title: "Case Study 五字段",
    objective: "能为一个项目写出问题、用户、方案、证据和下一步。",
    content:
      "作品集不是流水账，而是证明你如何判断问题、设计方案并验证结果。今天只做第一版结构化表达，不追求华丽。",
    questions: [
      {
        type: "choice" as const,
        prompt: "Case Study 初版最不应该缺少的是？",
        options: ["装饰插图", "问题与用户", "复杂动画", "长篇背景故事"],
        answer: "问题与用户",
        rubric: "能识别作品集表达的核心是问题和用户，而不是视觉装饰。",
      },
      {
        type: "short" as const,
        prompt: "用一句话定义这个学习助手正在解决的问题。",
        answer: "长期学习目标的用户缺少持续判断和反馈机制，导致每天行动和长期结果脱节。",
        rubric: "答案需要包含用户、场景、阻碍和目标。",
      },
    ],
  },
];

const maintenanceTopics: PlanTopic[] = [
  {
    track: "日语维护",
    title: "早安问候与最小句子",
    objective: "能识别正式早安问候，并写出一个最小自我介绍句。",
    content: "维护块只保温，不抢主线时间。今天复习 おはようございます 和 私は〇〇です。",
    questions: [
      {
        type: "choice" as const,
        prompt: "早上见到不太熟的同事，更适合说哪一句？",
        options: ["おはよう", "おはようございます", "じゃあね", "ありがとう"],
        answer: "おはようございます",
        rubric: "能判断职场场景下更礼貌的表达。",
      },
    ],
  },
  {
    track: "日语维护",
    title: "あ行假名复习",
    objective: "能按顺序读出 あ、い、う、え、お。",
    content: "维护块只做短记忆刷新。今天把あ行和罗马音重新对应起来。",
    questions: [
      {
        type: "short" as const,
        prompt: "请依次写出 あ、い、う、え、お 的罗马音。",
        answer: "a / i / u / e / o",
        rubric: "顺序和读音都需要正确。",
      },
    ],
  },
];

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultPlanProfile(profile: Profile): PlanProfile {
  return {
    longTermGoal: profile.targetRole,
    targetTrack: "AI Product / Agent Product Lead",
    targetOutcome: "建立可持续学习节奏，逐步形成可验证的职业能力与作品集。",
    constraints: "每天约 120 分钟；主线学习优先，语言学习作为维护项。",
    preferences: "每天聚焦一个主线，最多一个维护块；避免任务过碎。",
    maintenanceItems: "语言学习维护：听读/词汇/表达，每天 10-20 分钟。",
    updatedAt: new Date().toISOString(),
  };
}

function createDefaultStagePlan(profile: Profile): StagePlan {
  const startDate = todayKey();
  const end = new Date(`${startDate}T00:00:00`);
  end.setDate(end.getDate() + 13);
  return {
    title: "确认学习方向与第一阶段能力建设",
    startDate,
    endDate: todayKey(end),
    mainObjective: `围绕 ${profile.targetRole} 建立第一阶段学习主线，并确认每日学习节奏。`,
    deliverables: "完成第一批学习块、形成可复盘的答题记录、沉淀主要薄弱点。",
    completionCriteria: "至少完成 5 次主线批改，日报/周报能说明下一阶段重点。",
    dailyRhythm: "主线 90-110 分钟；维护 10-20 分钟。",
    status: "active",
    updatedAt: new Date().toISOString(),
  };
}

export function createDefaultState(): AppState {
  const profile = {
    name: "AI Native 学习助手",
    startDate: todayKey(),
    targetRole: "AI Product / Agent Product Lead",
    dailyMinutes: 120,
    timezone: "Asia/Shanghai",
  };
  return {
    version: STATE_VERSION,
    appDate: todayKey(),
    profile,
    planProfile: createDefaultPlanProfile(profile),
    stagePlan: createDefaultStagePlan(profile),
    stageDraft: null,
    xp: 0,
    streak: 0,
    lastCompletionDate: "",
    completedDates: [],
    learningFlow: [],
    memories: [],
    reports: [],
    practiceAttempts: [],
    agentRuns: [],
  };
}

export function isAiNativeState(value: unknown): value is AppState {
  return Boolean(value && typeof value === "object" && (value as AppState).version >= 10);
}

export function ensurePlanState(state: AppState): AppState {
  const fallback = createDefaultState();
  const profile = state.profile ?? fallback.profile;
  return {
    ...state,
    version: STATE_VERSION,
    profile,
    planProfile: state.planProfile ?? createDefaultPlanProfile(profile),
    stagePlan: state.stagePlan ?? createDefaultStagePlan(profile),
    stageDraft: state.stageDraft ?? null,
    memories: (state.memories ?? []).map((memory) => ({
      ...memory,
      stageRelevance: memory.stageRelevance ?? "general",
    })),
  };
}

export function currentDate(state: AppState) {
  return state.appDate || todayKey();
}

export function nextDateKey(date: string) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + 1);
  return todayKey(next);
}

export function todaysBlocks(state: AppState, date = currentDate(state)) {
  return state.learningFlow.filter((block) => block.date === date);
}

export function latestReport(state: AppState, type: ReportType) {
  return [...state.reports].filter((report) => report.type === type).sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function hasAgentRun(state: AppState, type: string, date = todayKey()) {
  return state.agentRuns.some((run) => run.type === type && run.date === date && run.status === "completed");
}

export function createDailyPlan(state: AppState, date = currentDate(state), rotation = 0) {
  const highPriority = [...state.memories].sort((a, b) => b.priority - a.priority)[0];
  const dayIndex = Math.max(0, Math.floor((new Date(`${date}T00:00:00`).getTime() - new Date(`${state.profile.startDate}T00:00:00`).getTime()) / 86400000));
  const recentMain = latestMainBlock(state, date);
  const mainTopic = highPriority && highPriority.priority >= 50 && rotation === 0 ? memoryToTopic(highPriority, recentMain?.title) : pickMainTopic(state, date, dayIndex, rotation);
  const maintenanceTopic = maintenanceTopics[(dayIndex + rotation) % maintenanceTopics.length];
  const mainBlock = topicToBlock(mainTopic, "main", 100, date);
  const maintenanceBlock = topicToBlock(maintenanceTopic, "maintenance", 20, date);
  return [mainBlock, maintenanceBlock];
}

function latestMainBlock(state: AppState, date: string) {
  return [...state.learningFlow]
    .filter((block) => block.role === "main" && block.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

function pickMainTopic(state: AppState, date: string, dayIndex: number, rotation: number) {
  const recentMain = latestMainBlock(state, date);
  let topic = mainTopics[(dayIndex + rotation) % mainTopics.length];
  if (topic.title === recentMain?.title && rotation === 0) topic = mainTopics[(dayIndex + 1) % mainTopics.length];
  return topic;
}

function memoryToTopic(memory: Memory, recentTitle?: string): PlanTopic {
  const baseTitle = memory.topic.replace(/：(?:强化纠错|进阶纠错)$/, "");
  const suffix = recentTitle === `${baseTitle}：强化纠错` ? "进阶纠错" : "强化纠错";
  return {
    track: memory.track,
    title: `${baseTitle}：${suffix}`,
    objective: `修正上次在「${baseTitle}」里的薄弱点，并能用自己的话解释正确判断。`,
    content: `PlannerAgent 根据最近批改记录安排今天的主线。上次暴露的问题是：${memory.weakness}。先复盘错误原因，再用一个新场景重新判断，最后写出可复用的判断规则。`,
    questions: [
      {
        type: "choice",
        prompt: `针对「${baseTitle}」的上次错误，今天第一步应该优先做什么？`,
        options: ["背原答案", "解释判断依据", "跳过薄弱点", "只看结论"],
        answer: "解释判断依据",
        rubric: "能从批改结论回到判断规则，而不是机械记忆原题答案。",
      },
      {
        type: "short",
        prompt: `用一个新例子重写这条薄弱点，并说明你会怎样避免再错：${memory.weakness}`,
        answer: "先给出新例子，再说明判断依据和避免错误的规则。",
        rubric: "答案需要包含新例子、判断依据、避免再错的方法三部分。",
      },
    ],
  };
}

function topicToBlock(topic: PlanTopic, role: LearningBlock["role"], minutes: number, date: string): LearningBlock {
  return {
    id: createId(role === "main" ? "main" : "keep"),
    date,
    role,
    track: topic.track,
    title: topic.title,
    objective: topic.objective,
    content: topic.content,
    minutes,
    status: "not_started",
    questions: topic.questions.map((question, index) => ({
      id: createId(`q${index + 1}`),
      ...question,
    })),
  };
}

export function gradeBlock(block: LearningBlock, answers: AnswerSubmission[], elapsedSeconds: number): GradeResult {
  const answerById = new Map(answers.map((answer) => [answer.questionId, answer.answer.trim()]));
  const checks = block.questions.map((question) => {
    const answer = answerById.get(question.id) ?? "";
    if (!answer) return { ok: false, weakness: `${question.prompt}：未作答` };
    if (question.type === "choice") {
      return answer === question.answer
        ? { ok: true, weakness: "" }
        : { ok: false, weakness: `${question.prompt}：选择错误，正确答案是 ${question.answer}` };
    }
    const required = question.answer
      .split(/[，。、；：\s/]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 2)
      .slice(0, 5);
    const matched = required.filter((part) => answer.includes(part)).length;
    return matched >= Math.max(1, Math.ceil(required.length * 0.35))
      ? { ok: true, weakness: "" }
      : { ok: false, weakness: `${question.prompt}：回答需要更贴近 rubric：${question.rubric}` };
  });
  const correct = checks.filter((check) => check.ok).length;
  const score = Math.round((correct / Math.max(1, block.questions.length)) * 100);
  const enoughTime = elapsedSeconds >= block.minutes * 60 * 0.7;
  const weaknesses = checks.map((check) => check.weakness).filter(Boolean);
  const improvements = weaknesses.length ? weaknesses : [`${block.track}：继续保持，下一次提高表达完整度。`];

  return {
    score,
    passed: score >= 70,
    conclusion: score >= 70 ? `本组通过，${block.track} 的关键点已经基本掌握。` : `本组需要重做，${block.track} 还有明显薄弱点。`,
    weaknesses,
    improvements,
    showImprovements: !enoughTime || score < 70,
    nextDrill:
      !enoughTime || score < 70
        ? {
            id: createId("drill"),
            type: "short",
            prompt: `用自己的话重新解释：${block.objective}`,
            answer: block.objective,
            rubric: "回答需要覆盖本学习块的核心目标，并给出一个例子。",
          }
        : undefined,
  };
}

export function applyGrade(state: AppState, blockId: string, answers: AnswerSubmission[], elapsedSeconds: number, graderResult?: GradeResult, nextMemories?: Memory[]) {
  const block = state.learningFlow.find((item) => item.id === blockId);
  if (!block) throw new Error("Learning block not found.");

  const submittedAt = new Date().toISOString();
  const grade = graderResult ?? gradeBlock(block, answers, elapsedSeconds);
  const attempt: PracticeAttempt = {
    id: createId("attempt"),
    blockId,
    date: block.date,
    answers,
    elapsedSeconds,
    submittedAt,
    grade,
  };
  const completedToday = state.completedDates.includes(block.date);
  const nextCompletedDates = grade.passed && !completedToday ? [...state.completedDates, block.date] : state.completedDates;
  const nextStreak = grade.passed && !completedToday ? (state.lastCompletionDate === previousDateKey(block.date) ? state.streak + 1 : 1) : state.streak;

  return {
    ...state,
    xp: state.xp + Math.round(grade.score / 2),
    streak: nextStreak,
    lastCompletionDate: grade.passed ? block.date : state.lastCompletionDate,
    completedDates: nextCompletedDates,
    learningFlow: state.learningFlow.map((item) =>
      item.id === blockId
        ? {
            ...item,
            status: "graded" as const,
            submittedAt,
            gradedAt: submittedAt,
            grade,
          }
        : item,
    ),
    memories: nextMemories ?? upsertMemories(state.memories, block, grade),
    practiceAttempts: [attempt, ...state.practiceAttempts],
    agentRuns: [
      createAgentRun("GraderAgent", "practice-grade", block.date, `批改 ${block.title}，得分 ${grade.score}`),
      createAgentRun("MemoryAgent", "memory-update", block.date, `记录 ${grade.improvements.length} 条学习记忆`),
      ...state.agentRuns,
    ],
  };
}

function upsertMemories(memories: Memory[], block: LearningBlock, grade: GradeResult) {
  const now = block.date;
  const next = [...memories];
  for (const weakness of grade.improvements) {
    const existing = next.find((memory) => memory.track === block.track && memory.topic === block.title && memory.weakness === weakness);
    if (existing) {
      existing.priority = Math.min(100, existing.priority + (grade.passed ? 4 : 14));
      existing.lastSeen = now;
      existing.evidence = grade.conclusion;
    } else {
      next.push({
        id: createId("mem"),
        track: block.track,
        topic: block.title,
        weakness,
        evidence: grade.conclusion,
        lastSeen: now,
        priority: grade.passed ? 24 : 62,
      });
    }
  }
  return next.sort((a, b) => b.priority - a.priority).slice(0, 40);
}

export function createDailyReport(state: AppState, date = currentDate(state)): Report {
  const blocks = todaysBlocks(state, date);
  const graded = blocks.filter((block) => block.status === "graded");
  const focus = blocks[0]?.title ?? "今日学习流";
  const weak = state.memories[0]?.weakness ?? "暂无明显薄弱点";
  return {
    id: `daily-${date}`,
    type: "daily",
    date,
    title: `${date} 学习日报`,
    summary: `今日聚焦 ${focus}，已批改 ${graded.length}/${blocks.length} 个学习块。`,
    highlights: [
      `主线：${blocks.find((block) => block.role === "main")?.title ?? "等待生成"}`,
      `维护：${blocks.find((block) => block.role === "maintenance")?.title ?? "等待生成"}`,
      `当前优先记忆：${weak}`,
    ],
    nextPlan: state.memories.length ? `下一轮优先强化：${state.memories[0].topic}` : "继续按 1 主线 + 维护节奏推进。",
    createdAt: new Date().toISOString(),
  };
}

export function createWeeklyReport(state: AppState, date = currentDate(state)): Report {
  const recentAttempts = state.practiceAttempts.slice(0, 10);
  const averageScore = recentAttempts.length
    ? Math.round(recentAttempts.reduce((sum, attempt) => sum + attempt.grade.score, 0) / recentAttempts.length)
    : 0;
  return {
    id: `weekly-${weekKey(date)}`,
    type: "weekly",
    date: weekKey(date),
    title: `${weekKey(date)} 周复盘`,
    summary: `本周平均批改分 ${averageScore || "暂无"}，记忆库保留 ${state.memories.length} 条强化线索。`,
    highlights: state.memories.slice(0, 3).map((memory) => `${memory.track} / ${memory.topic}：${memory.weakness}`),
    nextPlan: state.memories[0] ? `下周优先围绕 ${state.memories[0].track} 安排深度块。` : "下周继续建立答题样本。",
    createdAt: new Date().toISOString(),
  };
}

export function upsertReport(state: AppState, report: Report) {
  return {
    ...state,
    reports: [report, ...state.reports.filter((item) => item.id !== report.id)],
  };
}

export function createAgentRun(agent: AgentName, type: string, date: string, summary: string, status: AgentRun["status"] = "completed"): AgentRun {
  return {
    id: createId("run"),
    agent,
    type,
    date,
    status,
    summary,
    createdAt: new Date().toISOString(),
  };
}

export function weekKey(date = todayKey()) {
  const target = new Date(`${date}T00:00:00`);
  const firstDay = new Date(target.getFullYear(), 0, 1);
  const dayNumber = Math.floor((target.getTime() - firstDay.getTime()) / 86400000) + 1;
  const week = Math.ceil((dayNumber + firstDay.getDay()) / 7);
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function previousDateKey(date: string) {
  const previous = new Date(`${date}T00:00:00`);
  previous.setDate(previous.getDate() - 1);
  return todayKey(previous);
}
