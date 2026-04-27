export type TaskStatus = "todo" | "doing" | "done" | "skipped" | "postponed";
export type TaskKind = "main" | "maintenance" | "asset" | "explore" | "review";
export type Intensity = "light" | "standard" | "intensive";
export type MaterialStatus = "not-started" | "planned" | "doing" | "done" | "verify";
export type Mastery = 0 | 1 | 2 | 3 | 4;

export type PracticeQuestion = {
  id: string;
  prompt: string;
  answer: string;
  explanation: string;
  options?: string[];
};

export type Profile = {
  name: string;
  startDate: string;
  targetYear: string;
  targetRole: string;
  currentPhase: string;
  intensity: Intensity;
  japaneseLevel: string;
  education: "bachelor" | "master" | "doctor";
  age: number;
  workYears: number;
  annualIncomeJpy: number;
};

export type Task = {
  id: string;
  title: string;
  kind: TaskKind;
  track: string;
  status: TaskStatus;
  dueDate: string;
  minutes: number;
  xp: number;
  impact: string;
  notes: string;
  sourceTopicId?: string;
  knowledgePoint?: string;
  question?: PracticeQuestion;
  questions?: PracticeQuestion[];
};

export type Milestone = {
  id: string;
  title: string;
  standard: string;
  progress: number;
  status: "not-started" | "active" | "done";
};

export type RoadmapYear = {
  id: string;
  title: string;
  theme: string;
  goals: string[];
  milestones: Milestone[];
};

export type Topic = {
  id: string;
  title: string;
  kind: "micro" | "standard" | "deep" | "practice" | "output";
  minutes: number;
  mastery: Mastery;
  notes: string;
  objective?: string;
  content?: string;
  examples?: string[];
  questions?: PracticeQuestion[];
};

export type LearningTrack = {
  id: string;
  title: string;
  purpose: string;
  progress: number;
  topics: Topic[];
};

export type PortfolioProject = {
  id: string;
  title: string;
  stage: string;
  progress: number;
  problem: string;
  users: string;
  solution: string;
  evidence: string;
  nextStep: string;
};

export type Opportunity = {
  id: string;
  company: string;
  tier: "core" | "target" | "watch";
  role: string;
  fit: number;
  visaFit: boolean;
  contact: string;
  status: "research" | "contacted" | "interviewing" | "archived";
  notes: string;
};

export type VisaInputs = {
  education: Profile["education"];
  age: number;
  workYears: number;
  annualIncomeJpy: number;
  jlpt: "none" | "n2" | "n1";
  hasJapaneseDegree: boolean;
  hasAdvancedCertificate: boolean;
  hasResearchOrPatent: boolean;
};

export type Material = {
  id: string;
  title: string;
  group: string;
  status: MaterialStatus;
  notes: string;
};

export type Review = {
  id: string;
  type: "weekly" | "monthly";
  date: string;
  wins: string;
  biggestMove: string;
  lagging: string;
  adjustment: string;
};

export type Badge = {
  id: string;
  title: string;
  unlocked: boolean;
  condition: string;
};

export type AgentNote = {
  id: string;
  date: string;
  mode: string;
  prompt: string;
  response: string;
};

export type DailyLesson = {
  date: string;
  source: "seed" | "hermes";
  taskIds: string[];
  topicIds: string[];
  generatedAt: string;
  notes: string;
};

export type DailySummary = {
  date: string;
  plannedMinutes: number;
  completedMinutes: number;
  totalTasks: number;
  completedTasks: number;
  focus: string;
  progress: string;
  risks: string[];
  nextStep: string;
  generatedAt: string;
};

export type AgentDesign = {
  name: string;
  trigger: string;
  inputs: string[];
  outputs: string[];
  storage: string;
  safety: string[];
  prompt: string;
};

export type GeneratedLessonTopic = {
  trackId: string;
  title: string;
  kind: Topic["kind"];
  minutes: number;
  objective: string;
  content: string;
  examples: string[];
  questions: Array<Omit<PracticeQuestion, "id"> & { id?: string }>;
};

export type GeneratedLessonPack = {
  title: string;
  notes: string;
  topics: GeneratedLessonTopic[];
};

export type AppState = {
  version: number;
  profile: Profile;
  xp: number;
  streak: number;
  freezeCards: number;
  lastCompletionDate: string;
  completedDates: string[];
  roadmap: RoadmapYear[];
  tasks: Task[];
  learning: LearningTrack[];
  portfolio: PortfolioProject[];
  opportunities: Opportunity[];
  visa: {
    inputs: VisaInputs;
    materials: Material[];
  };
  reviews: Review[];
  badges: Badge[];
  agentNotes: AgentNote[];
  dailyLessons: DailyLesson[];
  dailySummaries: DailySummary[];
  agentDesign: AgentDesign;
};

export const taskKindLabel: Record<TaskKind, string> = {
  main: "主线",
  maintenance: "维护",
  asset: "成果",
  explore: "探索",
  review: "复盘",
};

export const taskStatusLabel: Record<TaskStatus, string> = {
  todo: "未开始",
  doing: "进行中",
  done: "已完成",
  skipped: "已跳过",
  postponed: "已延期",
};

export const materialStatusLabel: Record<MaterialStatus, string> = {
  "not-started": "未开始",
  planned: "已计划",
  doing: "准备中",
  done: "已完成",
  verify: "待确认",
};

const dailyLessonAgentDesign: AgentDesign = {
  name: "PathPilot Background Agent System",
  trigger: "每天首次读取 /api/state 时自动运行：生成约 120 分钟任务、写入每日总结、刷新机会雷达；每个自然周/月自动更新复盘。",
  inputs: [
    "当前日期、Day N、学习强度",
    "三年路线图、年度进度、总进度与当前阶段",
    "学习中心 topic 掌握度、今日任务完成情况与每日总结",
    "作品集、材料、机会雷达和最近复盘摘要",
  ],
  outputs: [
    "4-6 个具体学习 topic，合计 115-130 分钟",
    "每个 topic 的详细讲解、例子、2-3 道题目、答案和解析",
    "与 topic 绑定的今日任务、DailyLesson 记录和 DailySummary 记录",
    "机会雷达候选项、自然周复盘、自然月复盘",
  ],
  storage: "写入 AppState.learning[].topics、AppState.tasks、AppState.dailyLessons、AppState.dailySummaries、AppState.opportunities、AppState.reviews，并由 data/state.json 持久化。",
  safety: [
    "只生成学习、作品集和规划内容，不给签证法律结论",
    "不编造用户真实经历和成果数据",
    "机会雷达必须标注来源；公开 API 失败时使用保底研究清单，下一次后台刷新自动覆盖",
    "Hermes 失败时使用本地两小时任务规划，App 仍可用",
  ],
  prompt:
    "生成 JSON：{ title, notes, topics:[{ trackId, title, kind, minutes, objective, content, examples, questions:[{prompt, answer, explanation, options?}] }] }。trackId 只能是 analyst、japanese、portfolio；总时长约 120 分钟；日语按 0 基础从假名开始。",
};

const seedLearningTracks: LearningTrack[] = [
  {
    id: "analyst",
    title: "系统分析师",
    purpose: "从考试大纲和系统思维开始，逐步沉淀可用于作品集的分析表达。",
    progress: 0,
    topics: [
      {
        id: "analyst-001",
        title: "系统分析师考试结构与学习闭环",
        kind: "standard",
        minutes: 35,
        mastery: 0,
        notes: "",
        objective: "知道系统分析师考试为什么要分上午/下午/论文，并建立输入、练习、输出的学习闭环。",
        content:
          "系统分析师考试不只是背概念，而是考你把业务问题拆成需求、架构、数据、流程和风险的能力。第一天只需要建立地图：上午题用来扫概念，下午题用来练案例分析，论文用来训练结构化表达。",
        examples: [
          "上午：识别需求工程、系统架构、数据库、安全等概念。",
          "下午：读一个业务案例，找出问题、约束和系统改进方案。",
          "论文：围绕一个主题，用背景、问题、措施、效果四段表达。",
        ],
        questions: [
          {
            id: "analyst-q001",
            prompt: "系统分析师备考中，上午题、下午题、论文分别主要训练什么能力？",
            answer: "上午题训练概念识别，下午题训练案例分析，论文训练结构化表达和经验抽象。",
            explanation: "三类题型对应不同能力，不应该只刷选择题。",
          },
        ],
      },
      {
        id: "analyst-002",
        title: "需求与约束的区别",
        kind: "practice",
        minutes: 30,
        mastery: 0,
        notes: "",
        objective: "能把一个业务描述拆成需求、约束和风险。",
        content:
          "需求是系统必须满足的目标或能力，约束是设计时不能突破的条件，风险是不处理会导致目标失败的不确定因素。分析题里先分清这三类，答案会更稳。",
        examples: [
          "需求：订单状态要实时同步到客服系统。",
          "约束：现有 ERP 不能改数据库结构。",
          "风险：峰值流量导致同步延迟。",
        ],
        questions: [
          {
            id: "analyst-q002",
            prompt: "“现有系统不能停机超过 10 分钟”属于需求、约束还是风险？",
            answer: "约束。",
            explanation: "它不是系统要实现的新能力，而是实施和设计时必须遵守的限制。",
          },
        ],
      },
      {
        id: "analyst-003",
        title: "用输入-处理-输出描述系统",
        kind: "practice",
        minutes: 30,
        mastery: 0,
        notes: "",
        objective: "用 IPO 模型快速描述一个系统边界。",
        content:
          "IPO 指 Input、Process、Output。先写输入数据，再写处理规则，最后写输出结果，可以帮助你在案例题里快速抓住系统边界。",
        examples: ["输入：客户订单。", "处理：校验库存、计算价格、生成支付单。", "输出：订单确认、库存扣减、支付请求。"],
        questions: [
          {
            id: "analyst-q003",
            prompt: "把“用户提交简历后系统自动生成英文 profile”按 IPO 拆分。",
            answer: "输入：用户简历和目标岗位；处理：提取经历、匹配岗位关键词、生成英文表达；输出：英文 profile 草稿。",
            explanation: "只要能清楚说出数据从哪里来、怎么变、变成什么，就完成了第一层系统描述。",
          },
        ],
      },
    ],
  },
  {
    id: "japanese",
    title: "日语 0 基础",
    purpose: "从五十音、发音和最小句子开始，不默认任何 N5/N4/N3 基础。",
    progress: 0,
    topics: [
      {
        id: "jp-001",
        title: "平假名あ行：あ・い・う・え・お",
        kind: "micro",
        minutes: 20,
        mastery: 0,
        notes: "",
        objective: "认识并能读出あ行五个平假名。",
        content:
          "あ行是日语假名的入口：あ a、い i、う u、え e、お o。今天只要做到看到假名能读音，不要求写得漂亮。",
        examples: ["あ：a，像张开口发 a。", "い：i，短促发 i。", "う：u，嘴唇不要过度撅起。", "え：e。", "お：o。"],
        questions: [
          {
            id: "jp-q001",
            prompt: "请把 あ・い・う・え・お 依次读成罗马音。",
            answer: "a / i / u / e / o",
            explanation: "这是平假名第一行，先建立声音和字形的映射。",
          },
        ],
      },
      {
        id: "jp-002",
        title: "问候语：おはようございます",
        kind: "micro",
        minutes: 15,
        mastery: 0,
        notes: "",
        objective: "会识别一个正式早安问候，并知道使用场景。",
        content:
          "おはようございます 表示“早上好”，比 おはよう 更礼貌。0 基础阶段先把它当整句记住，不急着分析语法。",
        examples: ["早上见到同事：おはようございます。", "熟人之间可以说：おはよう。"],
        questions: [
          {
            id: "jp-q002",
            prompt: "见到不太熟的同事，早上更适合说 おはよう 还是 おはようございます？",
            answer: "おはようございます。",
            explanation: "ございます 让表达更礼貌，适合职场和不熟的人。",
          },
        ],
      },
      {
        id: "jp-003",
        title: "最小自我介绍：私は〇〇です",
        kind: "practice",
        minutes: 20,
        mastery: 0,
        notes: "",
        objective: "理解并替换“我是……”的最小句型。",
        content:
          "私は〇〇です 的意思是“我是〇〇”。私是我，は提示主题，です是礼貌判断句结尾。今天只要求能替换名字或职业。",
        examples: ["私はリンです。", "私はプロダクトマネージャーです。"],
        questions: [
          {
            id: "jp-q003",
            prompt: "把“我是产品经理”写成日语最小句。",
            answer: "私はプロダクトマネージャーです。",
            explanation: "0 基础阶段可以先使用外来语职业词，重点是掌握 私は〇〇です。",
          },
        ],
      },
    ],
  },
  {
    id: "portfolio",
    title: "项目作品集",
    purpose: "从第一篇 case study 的问题定义开始，把项目变成可展示资产。",
    progress: 0,
    topics: [
      {
        id: "portfolio-001",
        title: "Case Study 的 5 个必填字段",
        kind: "output",
        minutes: 30,
        mastery: 0,
        notes: "",
        objective: "能为一个项目写出问题、用户、方案、证据、下一步。",
        content:
          "作品集第一版不需要漂亮，先要完整。每个 case study 至少回答 5 个字段：问题是什么、用户是谁、你做了什么、有什么证据、下一步是什么。",
        examples: [
          "问题：长期目标无法落到每日任务。",
          "用户：计划海外职业迁移的产品/AI 从业者。",
          "方案：路线图 + 今日任务 + 复盘 + AI Coach。",
        ],
        questions: [
          {
            id: "portfolio-q001",
            prompt: "一个 case study 初版最少要回答哪 5 个字段？",
            answer: "问题、用户、方案、证据、下一步。",
            explanation: "这 5 个字段能保证项目不是流水账，而是可评估的产品资产。",
          },
        ],
      },
      {
        id: "portfolio-002",
        title: "问题定义的一句话模板",
        kind: "output",
        minutes: 25,
        mastery: 0,
        notes: "",
        objective: "用一句话写出可验证的问题定义。",
        content:
          "问题定义模板：某类用户在某个场景下，因为某个阻碍，无法达成某个目标。这个模板能防止你写成泛泛的愿景。",
        examples: ["准备日本求职的 AI 产品人，在三年路径推进中，因为任务和成果脱节，无法判断每天行动是否有效。"],
        questions: [
          {
            id: "portfolio-q002",
            prompt: "用模板改写：我想做一个成长 App。",
            answer: "有长期海外求职目标的用户，在日常执行中，因为目标跨度大且任务碎片化，无法稳定推进可验证成果。",
            explanation: "改写后包含用户、场景、阻碍和目标，才适合进入产品设计。",
          },
        ],
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

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function daysBetween(from: string, to = todayKey()) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function yearProgress(state: AppState) {
  const firstYear = state.roadmap[0];
  return average(firstYear.milestones.map((milestone) => milestone.progress));
}

export function totalProgress(state: AppState) {
  return average(
    state.roadmap.flatMap((year) => year.milestones.map((milestone) => milestone.progress)),
  );
}

export function assetScore(state: AppState) {
  const portfolio = average(state.portfolio.map((project) => project.progress));
  const materials = Math.round(
    (state.visa.materials.filter((material) => material.status === "done").length /
      state.visa.materials.length) *
      100,
  );
  const opportunities = Math.min(100, state.opportunities.length * 12);
  return average([portfolio, materials, opportunities]);
}

export function levelFromState(state: AppState) {
  const progress = totalProgress(state);
  if (progress === 0 && state.xp === 0 && state.completedDates.length === 0) {
    return { level: 1, title: "起步者" };
  }
  if (progress >= 80 || state.xp >= 6000) return { level: 10, title: "申请准备者" };
  if (state.opportunities.filter((item) => item.status !== "research").length >= 10) {
    return { level: 9, title: "市场验证者" };
  }
  if (state.profile.japaneseLevel === "N2" || state.profile.japaneseLevel === "N1") {
    return { level: 8, title: "语言突破者" };
  }
  if (state.portfolio.some((project) => project.progress >= 60)) return { level: 7, title: "项目沉淀者" };
  if (state.roadmap[0].milestones.some((item) => item.title.includes("英文职业定位") && item.progress >= 100)) {
    return { level: 6, title: "职业定位者" };
  }
  if (state.xp >= 2500) return { level: 5, title: "资格挑战者" };
  if (yearProgress(state) >= 30) return { level: 4, title: "备考者" };
  if (state.streak >= 14) return { level: 3, title: "执行者" };
  if (state.tasks.length > 0) return { level: 2, title: "规划者" };
  return { level: 1, title: "起步者" };
}

export function calculateVisaPoints(inputs: VisaInputs) {
  let score = 0;
  if (inputs.education === "doctor") score += 30;
  if (inputs.education === "master") score += 20;
  if (inputs.education === "bachelor") score += 10;

  if (inputs.workYears >= 10) score += 20;
  else if (inputs.workYears >= 7) score += 15;
  else if (inputs.workYears >= 5) score += 10;
  else if (inputs.workYears >= 3) score += 5;

  if (inputs.age < 30) score += 15;
  else if (inputs.age < 35) score += 10;
  else if (inputs.age < 40) score += 5;

  if (inputs.annualIncomeJpy >= 10000000) score += 40;
  else if (inputs.annualIncomeJpy >= 9000000) score += 35;
  else if (inputs.annualIncomeJpy >= 8000000) score += 30;
  else if (inputs.annualIncomeJpy >= 7000000) score += 25;
  else if (inputs.annualIncomeJpy >= 6000000) score += 20;
  else if (inputs.annualIncomeJpy >= 5000000) score += 15;
  else if (inputs.annualIncomeJpy >= 4000000) score += 10;

  if (inputs.jlpt === "n1") score += 15;
  if (inputs.jlpt === "n2") score += 10;
  if (inputs.hasJapaneseDegree) score += 10;
  if (inputs.hasAdvancedCertificate) score += 10;
  if (inputs.hasResearchOrPatent) score += 15;

  return score;
}

export function riskItems(state: AppState) {
  const todayTasks = state.tasks.filter((task) => task.dueDate === todayKey());
  const undoneMain = todayTasks.filter((task) => task.kind === "main" && task.status !== "done").length;
  const portfolio = average(state.portfolio.map((project) => project.progress));
  const visaScore = calculateVisaPoints(state.visa.inputs);
  const risks: string[] = [];

  if (undoneMain > 0) risks.push(`今日还有 ${undoneMain} 个主线任务未闭环`);
  if (portfolio < 35) risks.push("作品集产出偏薄，本周需要推进一个 case study");
  if (state.streak < 7) risks.push("连续执行习惯还在建立期，先保住 7 天");
  if (visaScore < 70) risks.push(`高度人才积分预估 ${visaScore}，需要继续补强语言/收入/证书项`);
  if (state.opportunities.filter((item) => item.status !== "research").length < 3) {
    risks.push("机会验证尚浅，建议每周推进公司或猎头连接");
  }

  return risks.slice(0, 4);
}

export function refreshBadges(state: AppState) {
  const doneMaterials = state.visa.materials.filter((material) => material.status === "done").length;
  return state.badges.map((badge) => {
    if (badge.id === "start") return { ...badge, unlocked: true };
    if (badge.id === "seven-days") return { ...badge, unlocked: state.streak >= 7 };
    if (badge.id === "thirty-days") return { ...badge, unlocked: state.streak >= 30 };
    if (badge.id === "analyst-entry") return { ...badge, unlocked: yearProgress(state) >= 20 };
    if (badge.id === "case-study") {
      return { ...badge, unlocked: state.portfolio.some((project) => project.progress >= 50) };
    }
    if (badge.id === "market-explorer") return { ...badge, unlocked: state.opportunities.length >= 20 };
    if (badge.id === "materials") {
      return { ...badge, unlocked: doneMaterials / state.visa.materials.length >= 0.5 };
    }
    return badge;
  });
}

function trackForTopic(state: AppState, topicId: string) {
  return state.learning.find((track) => track.topics.some((topic) => topic.id === topicId));
}

function firstQuestion(topic: Topic): PracticeQuestion | undefined {
  return topic.questions?.[0];
}

function expandedKnowledgePoint(topic: Topic) {
  const examples = topic.examples?.length ? `\n例子：${topic.examples.join("；")}` : "";
  const questions = topic.questions?.length
    ? `\n练习：${topic.questions.map((question, index) => `${index + 1}. ${question.prompt}`).join(" ")}`
    : "";
  const standard =
    topic.kind === "output"
      ? "\n完成标准：产出一段可放进作品集或材料库的文字，而不是只看完。"
      : "\n完成标准：读完讲解、复述关键点、完成练习并核对解析。";

  return [topic.objective && `目标：${topic.objective}`, topic.content, examples, questions, standard]
    .filter(Boolean)
    .join("\n");
}

export function taskFromTopic(
  topic: Topic,
  trackTitle: string,
  kind: TaskKind,
  dueDate = todayKey(),
  minutes = topic.minutes,
): Task {
  const question = firstQuestion(topic);
  return {
    id: createId("task"),
    title: `${trackTitle}：${topic.title}`,
    kind,
    track: trackTitle,
    status: "todo",
    dueDate,
    minutes,
    xp: kind === "asset" ? 60 : kind === "maintenance" ? 20 : Math.max(45, Math.round(minutes * 1.1)),
    impact: topic.objective || "推进今日学习闭环",
    notes: question ? `题目：${question.prompt}` : "",
    sourceTopicId: topic.id,
    knowledgePoint: expandedKnowledgePoint(topic),
    question,
    questions: topic.questions,
  };
}

function targetDailyMinutes(intensity: Intensity) {
  if (intensity === "light") return 90;
  if (intensity === "intensive") return 150;
  return 120;
}

function topicAt(state: AppState, trackId: string, offset: number) {
  const dayIndex = daysBetween(state.profile.startDate) - 1;
  const track = state.learning.find((item) => item.id === trackId);
  if (!track) return undefined;
  const candidates = track.topics.filter((topic) => topic.mastery < 4);
  const topic = candidates[(dayIndex + offset) % Math.max(1, candidates.length)];
  return topic ? { track, topic } : undefined;
}

function pickDailyTopics(state: AppState) {
  const base = [
    { pick: topicAt(state, "analyst", 0), kind: "main" as TaskKind, minutes: 45 },
    { pick: topicAt(state, "analyst", 1), kind: "main" as TaskKind, minutes: 25 },
    { pick: topicAt(state, "japanese", 0), kind: "maintenance" as TaskKind, minutes: 20 },
    { pick: topicAt(state, "portfolio", 0), kind: "asset" as TaskKind, minutes: 30 },
  ];

  if (state.profile.intensity === "light") return base.filter((_, index) => index !== 1);
  if (state.profile.intensity === "intensive") {
    return [...base, { pick: topicAt(state, "portfolio", 1), kind: "asset" as TaskKind, minutes: 30 }];
  }
  return base;
}

export function ensureTodayTasks(state: AppState): AppState {
  const today = todayKey();
  const dailyLessons = state.dailyLessons ?? [];
  const todayTasks = state.tasks.filter((task) => task.dueDate === today);
  const plannedMinutes = todayTasks.reduce((sum, task) => sum + task.minutes, 0);
  const expectedTaskCount = state.profile.intensity === "light" ? 3 : state.profile.intensity === "intensive" ? 5 : 4;
  if (
    dailyLessons.some((lesson) => lesson.date === today) &&
    todayTasks.length >= expectedTaskCount &&
    plannedMinutes >= targetDailyMinutes(state.profile.intensity) - 10
  ) {
    return state;
  }

  const picked = pickDailyTopics(state).filter(
    (item): item is { pick: { track: LearningTrack; topic: Topic }; kind: TaskKind; minutes: number } => Boolean(item.pick),
  );
  const tasks = picked.map(({ pick, kind, minutes }) => taskFromTopic(pick.topic, pick.track.title, kind, today, minutes));

  if (new Date().getDay() === 0) {
    tasks.push({
      id: createId("task"),
      title: "复盘：写出本周最小调整",
      kind: "review",
      track: "复盘",
      status: "todo",
      dueDate: today,
      minutes: 15,
      xp: 30,
      impact: "避免长期路线偏航",
      notes: "题目：本周哪个模块最容易滞后？下一周删掉什么、保留什么？",
      knowledgePoint: "复盘不是总结情绪，而是调整下一阶段的任务密度和重点。",
      question: {
        id: "review-q001",
        prompt: "本周最需要保护的一个主线任务是什么？",
        answer: "选择一个能直接推进三年路径资产的任务，例如系统分析师学习或作品集输出。",
        explanation: "复盘要落到下一步行动，不只记录感受。",
      },
    });
  }

  return {
    ...state,
    tasks: [...state.tasks.filter((task) => task.dueDate !== today), ...tasks],
    dailyLessons: [
      ...dailyLessons.filter((lesson) => lesson.date !== today),
      {
        date: today,
        source: "seed" as const,
        taskIds: tasks.map((task) => task.id),
        topicIds: picked.map(({ pick }) => pick.topic.id),
        generatedAt: new Date().toISOString(),
        notes: `本地后台已生成 ${tasks.reduce((sum, task) => sum + task.minutes, 0)} 分钟任务；Hermes 可自动覆盖为更细版本。`,
      },
    ],
  };
}

export function addGeneratedLessonPack(state: AppState, pack: GeneratedLessonPack): AppState {
  const today = todayKey();
  const generatedTopics = pack.topics.slice(0, 6).map((topic) => ({
    id: createId(`hermes-${topic.trackId}`),
    title: topic.title,
    kind: topic.kind,
    minutes: topic.minutes,
    mastery: 0 as Mastery,
    notes: "",
    objective: topic.objective,
    content: topic.content,
    examples: topic.examples,
    questions: topic.questions.map((question) => ({
      id: question.id ?? createId("hermes-q"),
      prompt: question.prompt,
      answer: question.answer,
      explanation: question.explanation,
      options: question.options,
    })),
  }));

  const learning = state.learning.map((track) => ({
    ...track,
    progress: 0,
    topics: [
      ...generatedTopics.filter((_, index) => pack.topics[index]?.trackId === track.id),
      ...track.topics,
    ],
  }));

  const nextState = { ...state, learning, tasks: state.tasks.filter((task) => task.dueDate !== today), dailyLessons: [] };
  const targetMinutes = targetDailyMinutes(state.profile.intensity);
  const picked = generatedTopics
    .flatMap((topic) => {
      const track = trackForTopic({ ...nextState, learning }, topic.id);
      return track ? [{ topic: topic as Topic, track }] : [];
    })
    .reduce<Array<{ topic: Topic; track: LearningTrack }>>((items, item) => {
      const planned = items.reduce((sum, current) => sum + current.topic.minutes, 0);
      return planned < targetMinutes - 5 ? [...items, item] : items;
    }, []);
  const tasks = picked.map(({ topic, track }) => {
    const kind: TaskKind = track.id === "portfolio" ? "asset" : track.id === "japanese" ? "maintenance" : "main";
    return taskFromTopic(topic, track.title, kind, today, topic.minutes);
  });

  return {
    ...nextState,
    tasks: [...nextState.tasks, ...tasks],
    dailyLessons: [
      {
        date: today,
        source: "hermes" as const,
        taskIds: tasks.map((task) => task.id),
        topicIds: picked.map(({ topic }) => topic.id),
        generatedAt: new Date().toISOString(),
        notes: pack.notes || pack.title,
      },
    ],
  };
}

export function ensureDailySummary(state: AppState): AppState {
  const today = todayKey();
  const todayTasks = state.tasks.filter((task) => task.dueDate === today);
  const completed = todayTasks.filter((task) => task.status === "done");
  const plannedMinutes = todayTasks.reduce((sum, task) => sum + task.minutes, 0);
  const completedMinutes = completed.reduce((sum, task) => sum + task.minutes, 0);
  const mainFocus = todayTasks.find((task) => task.kind === "main")?.track ?? "主线任务";
  const nextTask = todayTasks.find((task) => task.status !== "done");
  const existing = state.dailySummaries?.find((item) => item.date === today);
  const unchanged =
    existing?.plannedMinutes === plannedMinutes &&
    existing.completedMinutes === completedMinutes &&
    existing.totalTasks === todayTasks.length &&
    existing.completedTasks === completed.length &&
    existing.nextStep === (nextTask ? nextTask.title : "今日任务已闭环，等待明日后台计划。");
  const summary: DailySummary = {
    date: today,
    plannedMinutes,
    completedMinutes,
    totalTasks: todayTasks.length,
    completedTasks: completed.length,
    focus: mainFocus,
    progress:
      completed.length > 0
        ? `已完成 ${completed.length}/${todayTasks.length} 个任务，闭环 ${completedMinutes}/${plannedMinutes} 分钟。`
        : `已安排 ${todayTasks.length} 个任务，计划 ${plannedMinutes} 分钟。`,
    risks: riskItems(state),
    nextStep: nextTask ? nextTask.title : "今日任务已闭环，等待明日后台计划。",
    generatedAt: unchanged && existing ? existing.generatedAt : new Date().toISOString(),
  };

  return {
    ...state,
    dailySummaries: [...(state.dailySummaries ?? []).filter((item) => item.date !== today), summary],
  };
}

export function createDefaultState(): AppState {
  const today = todayKey();

  return ensureDailySummary(ensureTodayTasks({
    version: 3,
    profile: {
      name: "我的日本高度人才路径",
      startDate: today,
      targetYear: "2029",
      targetRole: "AI Product / Agent Product Lead",
      currentPhase: "Year 1 / Day 1 / 起步建模期",
      intensity: "standard",
      japaneseLevel: "0基础",
      education: "bachelor",
      age: 30,
      workYears: 5,
      annualIncomeJpy: 5000000,
    },
    xp: 0,
    streak: 0,
    freezeCards: 0,
    lastCompletionDate: "",
    completedDates: [],
    roadmap: [
      {
        id: "year-1",
        title: "Year 1",
        theme: "资格与定位年",
        goals: ["系统分析师", "高度人才积分测算", "英文职业定位", "项目作品集 V1"],
        milestones: [
          {
            id: "y1-analyst-plan",
            title: "系统分析师学习计划建立",
            standard: "完成考试大纲拆解、学习日历、真题计划",
            progress: 0,
            status: "not-started",
          },
          {
            id: "y1-analyst-round",
            title: "系统分析师第一轮学习完成",
            standard: "覆盖全部一级知识点，完成首轮笔记",
            progress: 0,
            status: "not-started",
          },
          {
            id: "y1-score",
            title: "高度人才积分测算 V1",
            standard: "填入学历、职历、年龄、证书、语言、年收，形成首版分数",
            progress: 0,
            status: "not-started",
          },
          {
            id: "y1-english",
            title: "英文职业定位 V1",
            standard: "完成英文 profile、headline、核心能力表达",
            progress: 0,
            status: "not-started",
          },
          {
            id: "y1-portfolio",
            title: "项目作品集 V1",
            standard: "至少完成 2 个项目 case study 初版",
            progress: 0,
            status: "not-started",
          },
        ],
      },
      {
        id: "year-2",
        title: "Year 2",
        theme: "语言与市场验证年",
        goals: ["N2/N1", "日本岗位市场验证", "猎头/公司连接", "项目作品集 V2"],
        milestones: [
          {
            id: "y2-n2",
            title: "N2 基础达标",
            standard: "词汇、语法、阅读、听力完成基础训练",
            progress: 0,
            status: "not-started",
          },
          {
            id: "y2-intro",
            title: "日文自我介绍完成",
            standard: "可用日语完成 3-5 分钟职业介绍",
            progress: 0,
            status: "not-started",
          },
          {
            id: "y2-companies",
            title: "日本目标公司清单",
            standard: "完成不少于 50 家公司分层",
            progress: 0,
            status: "not-started",
          },
          {
            id: "y2-headhunters",
            title: "猎头连接",
            standard: "建立不少于 10 个猎头/招聘联系人",
            progress: 0,
            status: "not-started",
          },
          {
            id: "y2-portfolio",
            title: "项目作品集 V2",
            standard: "作品集完成英文版，可用于对外发送",
            progress: 0,
            status: "not-started",
          },
        ],
      },
      {
        id: "year-3",
        title: "Year 3",
        theme: "落地与申请年",
        goals: ["正式求职", "日本侧接收机构", "技人国/高度人才材料", "COE/签证递交准备"],
        milestones: [
          {
            id: "y3-career-pack",
            title: "求职材料包完成",
            standard: "英文简历、日文简历、作品集、LinkedIn 完成",
            progress: 0,
            status: "not-started",
          },
          {
            id: "y3-applications",
            title: "第一批投递完成",
            standard: "完成 20-30 个高匹配岗位投递/推荐",
            progress: 0,
            status: "not-started",
          },
          {
            id: "y3-interviews",
            title: "面试记录库建立",
            standard: "每次面试记录问题、反馈、改进项",
            progress: 0,
            status: "not-started",
          },
          {
            id: "y3-offer",
            title: "Offer/接收机构锁定",
            standard: "获得日本侧正式接收条件",
            progress: 0,
            status: "not-started",
          },
          {
            id: "y3-visa-pack",
            title: "签证材料包完成",
            standard: "学历、职历、收入、证书、语言、岗位说明等材料齐备",
            progress: 0,
            status: "not-started",
          },
        ],
      },
    ],
    tasks: [],
    learning: seedLearningTracks,
    portfolio: [
      {
        id: "project-agent-persona",
        title: "AI Agent 虚拟人产品",
        stage: "Draft",
        progress: 0,
        problem: "用户需要一个可长期陪伴、记忆目标并推动执行的 agent。",
        users: "有长期目标但容易被信息过载打断的高阶职场人。",
        solution: "通过记忆、任务拆解、复盘和材料生成把目标变成连续行动。",
        evidence: "",
        nextStep: "先写出问题定义和目标用户。",
      },
      {
        id: "project-portfolio-editor",
        title: "作品集生成与编辑器",
        stage: "Draft",
        progress: 0,
        problem: "项目经历散落，无法快速转化成英文/日文求职材料。",
        users: "准备海外求职的产品/AI 从业者。",
        solution: "用结构化模板沉淀问题、动作、结果、证据和复盘。",
        evidence: "",
        nextStep: "整理第一版 case study 字段。",
      },
    ],
    opportunities: [],
    visa: {
      inputs: {
        education: "bachelor",
        age: 30,
        workYears: 5,
        annualIncomeJpy: 5000000,
        jlpt: "none",
        hasJapaneseDegree: false,
        hasAdvancedCertificate: false,
        hasResearchOrPatent: false,
      },
      materials: [
        {
          id: "mat-degree",
          title: "学历证明",
          group: "身份与学历",
          status: "not-started",
          notes: "",
        },
        {
          id: "mat-employment",
          title: "职历证明 / 在职证明",
          group: "职历",
          status: "not-started",
          notes: "",
        },
        {
          id: "mat-income",
          title: "收入证明",
          group: "职历",
          status: "not-started",
          notes: "",
        },
        {
          id: "mat-certs",
          title: "证书与考试成绩",
          group: "能力证明",
          status: "not-started",
          notes: "系统分析师和 JLPT 后续补充。",
        },
        {
          id: "mat-resume",
          title: "英文/日文简历",
          group: "求职材料",
          status: "not-started",
          notes: "",
        },
        {
          id: "mat-job",
          title: "日本岗位说明与接收机构材料",
          group: "签证材料",
          status: "not-started",
          notes: "",
        },
      ],
    },
    reviews: [],
    badges: [
      { id: "start", title: "三年计划启动", unlocked: true, condition: "完成目标初始化" },
      { id: "seven-days", title: "七日不断线", unlocked: false, condition: "连续完成 7 天" },
      { id: "thirty-days", title: "三十日执行者", unlocked: false, condition: "连续完成 30 天" },
      { id: "analyst-entry", title: "系统分析师入门", unlocked: false, condition: "Year 1 进度达到 20%" },
      { id: "case-study", title: "第一个 Case Study", unlocked: false, condition: "作品集项目达到 50%" },
      { id: "market-explorer", title: "日本市场探索者", unlocked: false, condition: "记录 20 家目标公司" },
      { id: "materials", title: "材料管理员", unlocked: false, condition: "完成 50% 材料清单" },
    ],
    agentNotes: [],
    dailyLessons: [],
    dailySummaries: [],
    agentDesign: dailyLessonAgentDesign,
  }));
}
