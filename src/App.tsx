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
  refreshBadges,
  riskItems,
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

type Language = "en" | "zh" | "ja";
type LanguageMode = Language | "auto";
type AgentMode = "breakdown" | "diagnosis" | "learning" | "polish" | "interview" | "materials";

const localKey = "pathpilot-growth-state";
const languageKey = "pathpilot-language-mode";

const languageOptions = ["auto", "en", "zh", "ja"] as const;
const languageLabels: Record<LanguageMode, string> = {
  auto: "Auto",
  en: "English",
  zh: "中文",
  ja: "日本語",
};

const localeByLanguage: Record<Language, string> = {
  en: "en-US",
  zh: "zh-CN",
  ja: "ja-JP",
};

const copy = {
  en: {
    brandSubtitle: "Japan career path",
    loading: "Loading your three-year path.",
    nav: {
      today: "Today",
      roadmap: "Roadmap",
      tasks: "Tasks",
      learning: "Learning",
      portfolio: "Portfolio",
      visa: "Points & docs",
      opportunities: "Radar",
      reviews: "Reviews",
      achievements: "Badges",
      agent: "AI Coach",
      settings: "Settings",
    },
    sidebar: { streak: "day streak" },
    metrics: {
      annualProgress: "Year progress",
      assetScore: "Asset score",
      todayTasks: "Today tasks",
      completion: "Done today",
      plannedTime: "Planned time",
      focus: "Focus",
    },
    save: { error: "Local only", saving: "Saving", saved: "Saved" },
    taskKind: { main: "Main", maintenance: "Maintain", asset: "Asset", explore: "Explore", review: "Review" },
    taskStatus: { todo: "Todo", doing: "Doing", done: "Done", skipped: "Skipped", postponed: "Postponed" },
    materialStatus: { "not-started": "Not started", planned: "Planned", doing: "Preparing", done: "Done", verify: "Verify" },
    education: { bachelor: "Bachelor", master: "Master", doctor: "Doctorate" },
    intensity: { light: "Light", standard: "Standard", intensive: "Intensive" },
    today: {
      main: "Today",
      detailBack: "Today",
      target: "Goal",
      taskText: "Task text",
      notes: "Notes",
      exercise: "Exercise",
      showAnswer: "Show reference answer",
      answer: "Answer",
      explanation: "Explanation",
      hero: "Do only what moves the three-year outcome today.",
      day: "Day",
      freezeCards: "freeze cards",
      totalProgress: "Total path progress",
      askHermes: "Ask Hermes",
      completeTask: "Complete task",
      pathProgress: "Three-year progress",
      analyst: "Systems analyst",
      portfolioV1: "Portfolio V1",
      risk: "Path risk",
    },
    units: { minutes: "min", tasks: "tasks", doneMinutes: "min closed" },
    tasks: {
      title: "Task system",
      bannerTitle: "Today is planned from current progress",
      emptySummary: "The app creates about two hours of tasks and writes a daily summary when it opens.",
      all: "All",
    },
    learning: { title: "Learning center", notePlaceholder: "Notes, mistakes, or next step" },
    portfolio: {
      title: "Project portfolio",
      newProject: "New project",
      newProjectTitle: "New portfolio project",
      newProjectNextStep: "Write the problem and target users.",
      problem: "Problem",
      users: "Target users",
      solution: "Solution",
      evidence: "Evidence / metrics",
      nextStep: "Next step",
    },
    visa: {
      scoreTitle: "Highly skilled points",
      high: "80+ range",
      ready: "Ready to watch",
      needsWork: "Needs strengthening",
      education: "Education",
      age: "Age",
      workYears: "Work years",
      annualIncome: "Target income (JPY)",
      noJlpt: "None",
      japaneseDegree: "Japanese university degree",
      advancedCertificate: "Relevant certificate",
      researchPatent: "Research / patent / result",
      finePrint: "For planning only. Not official or professional advice.",
      materials: "Materials",
    },
    opportunity: {
      title: "Opportunity radar",
      bannerTitle: "Candidate opportunities refresh daily",
      bannerText: "Sources use public job APIs first, ranked by AI / Product / Japan / visa relevance.",
      bannerNote: "No need to add placeholder companies manually; status only tracks follow-up progress.",
      tier: { core: "Core", target: "Target", watch: "Watch" },
      source: "Source",
      generated: "Generated",
      visaFit: "Visa / remote fit",
      priority: "Priority watch",
      confirm: "Needs review",
      status: "Status",
      fit: "Fit",
      statusLabels: { research: "Researching", contacted: "Contacted", interviewing: "Interviewing", archived: "Archived" },
    },
    review: {
      title: "Background review",
      weekly: "Weekly",
      monthly: "Monthly",
      empty: "Weekly and monthly reviews are generated when state is read.",
      history: "Review history",
      missing: "No highlight yet",
    },
    achievement: { level: "Path level", badges: "Badges" },
    agent: {
      detected: "Hermes detected",
      missing: "Hermes not connected",
      outputs: "Target outputs",
      boundaries: "Boundaries",
      generatingDaily: "Hermes is rebuilding today's plan",
      generateDaily: "Rebuild today's background plan",
      running: "Hermes is thinking",
      run: "Call Hermes",
      errorTitle: "Call failed. Manual prompt is ready.",
      notes: "AI output history",
      empty: "No AI Coach output yet.",
      fallbackTitle: "PathPilot AI Coach request",
      mode: "Mode",
      currentState: "Current state",
      request: "Request",
      outputLanguage: "Output language",
    },
    settings: {
      profile: "Profile",
      language: "Interface language",
      pathName: "Path name",
      startDate: "Start date",
      targetYear: "Target year",
      targetRole: "Target role",
      currentPhase: "Current phase",
      intensity: "Study intensity",
      japaneseLevel: "Japanese level",
      data: "Data & Hermes",
      exportJson: "Export JSON",
      importJson: "Import JSON",
      reset: "Reset demo data",
      hermesAvailable: "Hermes Agent available",
      hermesMissing: "Hermes Agent disconnected",
      hermesHint: "The backend calls hermes chat -Q through WSL; if it fails, the AI Coach page keeps a manual prompt.",
    },
  },
  zh: {
    brandSubtitle: "日本高度人才路径",
    loading: "正在装载你的三年路径。",
    nav: {
      today: "今日路径",
      roadmap: "三年路线",
      tasks: "任务系统",
      learning: "学习中心",
      portfolio: "作品集",
      visa: "积分材料",
      opportunities: "机会雷达",
      reviews: "复盘中心",
      achievements: "成就",
      agent: "AI Coach",
      settings: "设置",
    },
    sidebar: { streak: "天" },
    metrics: {
      annualProgress: "年度进度",
      assetScore: "资产分",
      todayTasks: "今日任务",
      completion: "今日完成率",
      plannedTime: "计划时长",
      focus: "今日焦点",
    },
    save: { error: "本地保存", saving: "保存中", saved: "已保存" },
    taskKind: { main: "主线", maintenance: "维护", asset: "成果", explore: "探索", review: "复盘" },
    taskStatus: { todo: "未开始", doing: "进行中", done: "已完成", skipped: "已跳过", postponed: "已延期" },
    materialStatus: { "not-started": "未开始", planned: "已计划", doing: "准备中", done: "已完成", verify: "待确认" },
    education: { bachelor: "本科", master: "硕士", doctor: "博士" },
    intensity: { light: "轻量", standard: "标准", intensive: "强化" },
    today: {
      main: "今日主线",
      detailBack: "今日主线",
      target: "目标",
      taskText: "任务文本",
      notes: "备注",
      exercise: "练习",
      showAnswer: "查看参考答案",
      answer: "答案",
      explanation: "解析",
      hero: "今天只做能推动三年后结果的事。",
      day: "第",
      freezeCards: "冻结卡",
      totalProgress: "总路径进度",
      askHermes: "让 Hermes 拆任务",
      completeTask: "完成任务",
      pathProgress: "三年路径进度",
      analyst: "系统分析师",
      portfolioV1: "作品集 V1",
      risk: "路径风险提醒",
    },
    units: { minutes: "分钟", tasks: "个任务", doneMinutes: "分钟已闭环" },
    tasks: {
      title: "任务系统",
      bannerTitle: "后台已按当前进度安排今日任务",
      emptySummary: "打开应用时会自动生成约两小时任务，并写入每日总结。",
      all: "全部",
    },
    learning: { title: "学习中心", notePlaceholder: "笔记、错题或下一步" },
    portfolio: {
      title: "项目作品集",
      newProject: "新项目",
      newProjectTitle: "新的作品集项目",
      newProjectNextStep: "写出问题定义和目标用户。",
      problem: "问题定义",
      users: "目标用户",
      solution: "解决方案",
      evidence: "证据/指标",
      nextStep: "下一步",
    },
    visa: {
      scoreTitle: "高度人才积分测算",
      high: "80 分以上区间",
      ready: "达标观察区间",
      needsWork: "需要补强",
      education: "学历",
      age: "年龄",
      workYears: "工作年限",
      annualIncome: "目标年收（日元）",
      noJlpt: "暂无",
      japaneseDegree: "日本大学学位",
      advancedCertificate: "高相关证书",
      researchPatent: "研究/专利/成果",
      finePrint: "测算用于规划，不替代官方或专业意见。",
      materials: "材料清单",
    },
    opportunity: {
      title: "机会雷达",
      bannerTitle: "后台每日自动刷新候选机会",
      bannerText: "来源优先使用公开招聘 API，并按 AI / Product / Japan / visa 相关性排序。",
      bannerNote: "不再需要手动新增空公司；状态只用于记录你是否已推进连接。",
      tier: { core: "核心", target: "目标", watch: "观察" },
      source: "来源",
      generated: "后台生成",
      visaFit: "签证/远程可行性",
      priority: "优先观察",
      confirm: "需进一步确认",
      status: "状态",
      fit: "匹配度",
      statusLabels: { research: "调研中", contacted: "已连接", interviewing: "面试中", archived: "归档" },
    },
    review: {
      title: "后台复盘",
      weekly: "周复盘",
      monthly: "月复盘",
      empty: "后台会在读取状态时自动生成自然周/月复盘。",
      history: "复盘记录",
      missing: "未填写重点",
    },
    achievement: { level: "路径等级", badges: "徽章" },
    agent: {
      detected: "Hermes 已检测到",
      missing: "Hermes 未检测到",
      outputs: "目标输出",
      boundaries: "约束边界",
      generatingDaily: "Hermes 正在补跑今日计划",
      generateDaily: "立即补跑今日后台计划",
      running: "Hermes 正在思考",
      run: "调用 Hermes",
      errorTitle: "调用失败，已保留手动提示词",
      notes: "AI 输出记录",
      empty: "还没有 AI Coach 输出。",
      fallbackTitle: "PathPilot AI Coach 请求",
      mode: "模式",
      currentState: "当前状态",
      request: "请求",
      outputLanguage: "输出语言",
    },
    settings: {
      profile: "目标配置",
      language: "界面语言",
      pathName: "路径名称",
      startDate: "起始日期",
      targetYear: "目标年份",
      targetRole: "目标岗位",
      currentPhase: "当前阶段",
      intensity: "学习强度",
      japaneseLevel: "日语水平",
      data: "数据与 Hermes",
      exportJson: "导出 JSON",
      importJson: "导入 JSON",
      reset: "重置示例数据",
      hermesAvailable: "Hermes Agent 可用",
      hermesMissing: "Hermes Agent 未连接",
      hermesHint: "后端会通过 WSL 调用 hermes chat -Q；调用失败时 AI Coach 页会生成可手动复制的提示词。",
    },
  },
  ja: {
    brandSubtitle: "日本キャリアパス",
    loading: "3年ロードマップを読み込み中です。",
    nav: {
      today: "今日",
      roadmap: "ロードマップ",
      tasks: "タスク",
      learning: "学習",
      portfolio: "ポートフォリオ",
      visa: "ポイント・書類",
      opportunities: "機会レーダー",
      reviews: "振り返り",
      achievements: "バッジ",
      agent: "AI Coach",
      settings: "設定",
    },
    sidebar: { streak: "日連続" },
    metrics: {
      annualProgress: "年間進捗",
      assetScore: "資産スコア",
      todayTasks: "今日のタスク",
      completion: "完了率",
      plannedTime: "予定時間",
      focus: "今日の焦点",
    },
    save: { error: "ローカル保存", saving: "保存中", saved: "保存済み" },
    taskKind: { main: "主線", maintenance: "維持", asset: "成果", explore: "探索", review: "振り返り" },
    taskStatus: { todo: "未着手", doing: "進行中", done: "完了", skipped: "スキップ", postponed: "延期" },
    materialStatus: { "not-started": "未着手", planned: "計画済み", doing: "準備中", done: "完了", verify: "確認待ち" },
    education: { bachelor: "学士", master: "修士", doctor: "博士" },
    intensity: { light: "軽め", standard: "標準", intensive: "集中" },
    today: {
      main: "今日の主線",
      detailBack: "今日の主線",
      target: "目標",
      taskText: "タスク本文",
      notes: "メモ",
      exercise: "練習",
      showAnswer: "参考回答を見る",
      answer: "回答",
      explanation: "解説",
      hero: "今日は3年後の結果につながることだけを進める。",
      day: "Day",
      freezeCards: "フリーズカード",
      totalProgress: "全体進捗",
      askHermes: "Hermes に分解させる",
      completeTask: "タスクを完了",
      pathProgress: "3年パス進捗",
      analyst: "システムアナリスト",
      portfolioV1: "ポートフォリオ V1",
      risk: "パスのリスク",
    },
    units: { minutes: "分", tasks: "件", doneMinutes: "分完了" },
    tasks: {
      title: "タスクシステム",
      bannerTitle: "現在の進捗から今日のタスクを作成済み",
      emptySummary: "アプリ起動時に約2時間分のタスクとデイリーサマリーを自動作成します。",
      all: "すべて",
    },
    learning: { title: "学習センター", notePlaceholder: "メモ、間違い、次の一手" },
    portfolio: {
      title: "プロジェクトポートフォリオ",
      newProject: "新規プロジェクト",
      newProjectTitle: "新しいポートフォリオ項目",
      newProjectNextStep: "課題定義と対象ユーザーを書く。",
      problem: "課題定義",
      users: "対象ユーザー",
      solution: "解決策",
      evidence: "証拠 / 指標",
      nextStep: "次の一手",
    },
    visa: {
      scoreTitle: "高度人材ポイント試算",
      high: "80点以上",
      ready: "到達圏内",
      needsWork: "補強が必要",
      education: "学歴",
      age: "年齢",
      workYears: "職歴年数",
      annualIncome: "目標年収（円）",
      noJlpt: "なし",
      japaneseDegree: "日本の大学学位",
      advancedCertificate: "関連資格",
      researchPatent: "研究 / 特許 / 実績",
      finePrint: "計画用の試算であり、公式または専門的な助言ではありません。",
      materials: "書類リスト",
    },
    opportunity: {
      title: "機会レーダー",
      bannerTitle: "候補機会を毎日自動更新",
      bannerText: "公開求人 API を優先し、AI / Product / Japan / visa 関連度で並べます。",
      bannerNote: "空の会社を手動追加する必要はありません。状態は接点の進捗記録だけに使います。",
      tier: { core: "核心", target: "目標", watch: "観察" },
      source: "ソース",
      generated: "自動生成",
      visaFit: "ビザ / リモート適合",
      priority: "優先観察",
      confirm: "要確認",
      status: "状態",
      fit: "適合度",
      statusLabels: { research: "調査中", contacted: "接続済み", interviewing: "面接中", archived: "アーカイブ" },
    },
    review: {
      title: "バックグラウンド振り返り",
      weekly: "週次",
      monthly: "月次",
      empty: "状態の読み込み時に週次 / 月次レビューを自動生成します。",
      history: "振り返り履歴",
      missing: "重点未入力",
    },
    achievement: { level: "パスレベル", badges: "バッジ" },
    agent: {
      detected: "Hermes を検出済み",
      missing: "Hermes 未接続",
      outputs: "目標アウトプット",
      boundaries: "制約",
      generatingDaily: "Hermes が今日の計画を再生成中",
      generateDaily: "今日のバックグラウンド計画を再生成",
      running: "Hermes が考え中",
      run: "Hermes を呼び出す",
      errorTitle: "呼び出しに失敗しました。手動プロンプトを保持しました。",
      notes: "AI 出力履歴",
      empty: "AI Coach の出力はまだありません。",
      fallbackTitle: "PathPilot AI Coach リクエスト",
      mode: "モード",
      currentState: "現在の状態",
      request: "リクエスト",
      outputLanguage: "出力言語",
    },
    settings: {
      profile: "目標設定",
      language: "表示言語",
      pathName: "パス名",
      startDate: "開始日",
      targetYear: "目標年",
      targetRole: "目標ロール",
      currentPhase: "現在フェーズ",
      intensity: "学習強度",
      japaneseLevel: "日本語レベル",
      data: "データと Hermes",
      exportJson: "JSON をエクスポート",
      importJson: "JSON をインポート",
      reset: "デモデータをリセット",
      hermesAvailable: "Hermes Agent 利用可能",
      hermesMissing: "Hermes Agent 未接続",
      hermesHint: "バックエンドは WSL 経由で hermes chat -Q を呼び出します。失敗時は AI Coach ページに手動プロンプトを残します。",
    },
  },
} as const;

type Copy = (typeof copy)[Language];

const agentModes: Record<Language, Record<AgentMode, { label: string; prompt: string }>> = {
  en: {
    breakdown: {
      label: "Task breakdown",
      prompt: "Break down the most important lagging goal into executable tasks for this week, and explain which asset each task advances.",
    },
    diagnosis: {
      label: "Progress diagnosis",
      prompt: "Diagnose whether my current three-year path is lagging, then identify the highest-priority risk and this week's adjustment plan.",
    },
    learning: {
      label: "Learning advice",
      prompt: "Based on my current learning progress, give one smallest next step each for systems analyst study, Japanese, and portfolio work.",
    },
    polish: {
      label: "Document polish",
      prompt: "Improve the wording of my portfolio project so it stays truthful, professional, and suitable for Japan AI/product roles.",
    },
    interview: {
      label: "Mock interview",
      prompt: "Simulate a Product Manager interview at a Japanese AI company, with 6 questions and answer scoring criteria.",
    },
    materials: {
      label: "Material check",
      prompt: "Check the gaps in my highly skilled professional / engineer visa material list and rank them by priority.",
    },
  },
  zh: {
    breakdown: {
      label: "任务拆解",
      prompt: "请把当前最重要的一个滞后目标拆成本周可执行任务，并说明每个任务推进哪个资产。",
    },
    diagnosis: {
      label: "进度诊断",
      prompt: "请诊断我当前三年路径是否滞后，指出最高优先级风险和本周调整方案。",
    },
    learning: {
      label: "学习建议",
      prompt: "请根据当前学习进度，为系统分析师、日语、作品集各给一个最小下一步。",
    },
    polish: {
      label: "文档润色",
      prompt: "请帮我优化作品集中的项目表达，要求真实、专业、适合日本 AI/产品岗位。",
    },
    interview: {
      label: "面试模拟",
      prompt: "请模拟一家日本 AI 公司 Product Manager 面试，给我 6 个问题和回答评分标准。",
    },
    materials: {
      label: "材料检查",
      prompt: "请检查我的高度人才/技人国材料清单缺口，并按优先级排列。",
    },
  },
  ja: {
    breakdown: {
      label: "タスク分解",
      prompt: "現在いちばん遅れている重要目標を、今週実行できるタスクに分解し、各タスクがどの資産を前進させるか説明してください。",
    },
    diagnosis: {
      label: "進捗診断",
      prompt: "現在の3年パスが遅れているか診断し、最優先リスクと今週の調整案を示してください。",
    },
    learning: {
      label: "学習アドバイス",
      prompt: "現在の学習進捗にもとづき、システムアナリスト、日本語、ポートフォリオそれぞれに最小の次アクションを1つずつ提案してください。",
    },
    polish: {
      label: "文章改善",
      prompt: "ポートフォリオのプロジェクト表現を、事実ベースで専門的かつ日本の AI / プロダクト職に適した表現へ改善してください。",
    },
    interview: {
      label: "模擬面接",
      prompt: "日本の AI 企業の Product Manager 面接を想定し、6つの質問と回答評価基準を出してください。",
    },
    materials: {
      label: "書類チェック",
      prompt: "高度人材 / 技人国の書類リストの不足を確認し、優先度順に並べてください。",
    },
  },
};

const agentModeOrder: AgentMode[] = ["breakdown", "diagnosis", "learning", "polish", "interview", "materials"];

const outputLanguageName: Record<Language, string> = {
  en: "English",
  zh: "Simplified Chinese",
  ja: "Japanese",
};

const navItems: Array<{ id: View; label: keyof Copy["nav"]; icon: typeof Home }> = [
  { id: "today", label: "today", icon: Home },
  { id: "roadmap", label: "roadmap", icon: Map },
  { id: "tasks", label: "tasks", icon: CalendarCheck },
  { id: "learning", label: "learning", icon: BookOpen },
  { id: "portfolio", label: "portfolio", icon: BriefcaseBusiness },
  { id: "visa", label: "visa", icon: Landmark },
  { id: "opportunities", label: "opportunities", icon: Radar },
  { id: "reviews", label: "reviews", icon: ClipboardList },
  { id: "achievements", label: "achievements", icon: Trophy },
  { id: "agent", label: "agent", icon: Bot },
  { id: "settings", label: "settings", icon: Settings },
];

function detectSystemLanguage(): Language {
  const systemLanguages = typeof navigator === "undefined" ? [] : navigator.languages.length ? navigator.languages : [navigator.language];
  const first = systemLanguages[0]?.toLowerCase() ?? "";
  if (first.startsWith("zh")) return "zh";
  if (first.startsWith("ja")) return "ja";
  return "en";
}

function readLanguageMode(): LanguageMode {
  try {
    const stored = window.localStorage.getItem(languageKey) as LanguageMode | null;
    if (stored && languageOptions.includes(stored)) return stored;
  } catch {
    return "auto";
  }
  return "auto";
}

function resolveLanguage(mode: LanguageMode): Language {
  return mode === "auto" ? detectSystemLanguage() : mode;
}

function formatToday(language: Language) {
  return new Intl.DateTimeFormat(localeByLanguage[language], {
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
  const [languageMode, setLanguageMode] = useState<LanguageMode>(readLanguageMode);
  const loadedRef = useRef(false);
  const language = resolveLanguage(languageMode);
  const ui = copy[language];

  useEffect(() => {
    window.localStorage.setItem(languageKey, languageMode);
    document.documentElement.lang = language;
  }, [language, languageMode]);

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
        <p>{ui.loading}</p>
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
            <span>{ui.brandSubtitle}</span>
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
                <span>{ui.nav[item.label]}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-status">
          <span>Lv.{level.level}</span>
          <strong>{level.title}</strong>
          <small>
            {state.xp} XP · {state.streak} {ui.sidebar.streak}
          </small>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p>{formatToday(language)}</p>
            <h1>{state.profile.name}</h1>
          </div>
          <div className="topbar-actions">
            <Metric label={ui.metrics.annualProgress} value={`${yearProgress(state)}%`} />
            <Metric label={ui.metrics.assetScore} value={`${assetScore(state)}`} />
            <Metric label={ui.metrics.todayTasks} value={`${todayTasks.filter((task) => task.status === "done").length}/${todayTasks.length}`} />
            <select
              aria-label={ui.settings.language}
              className="language-select"
              onChange={(event) => setLanguageMode(event.target.value as LanguageMode)}
              value={languageMode}
            >
              {languageOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "auto" ? `${languageLabels.auto} (${languageLabels[language]})` : languageLabels[option]}
                </option>
              ))}
            </select>
            <span className={cx("save-chip", saveState)}>{saveState === "error" ? ui.save.error : saveState === "saving" ? ui.save.saving : ui.save.saved}</span>
          </div>
        </header>

        {activeView === "today" && <TodayView state={state} updateState={updateState} openAgent={() => setActiveView("agent")} ui={ui} />}
        {activeView === "roadmap" && <RoadmapView state={state} updateState={updateState} ui={ui} />}
        {activeView === "tasks" && <TasksView state={state} updateState={updateState} ui={ui} />}
        {activeView === "learning" && <LearningView state={state} updateState={updateState} ui={ui} />}
        {activeView === "portfolio" && <PortfolioView state={state} updateState={updateState} ui={ui} />}
        {activeView === "visa" && <VisaView state={state} updateState={updateState} ui={ui} />}
        {activeView === "opportunities" && <OpportunityView state={state} updateState={updateState} ui={ui} />}
        {activeView === "reviews" && <ReviewView state={state} updateState={updateState} ui={ui} />}
        {activeView === "achievements" && <AchievementView state={state} ui={ui} />}
        {activeView === "agent" && <AgentView state={state} updateState={updateState} agentStatus={agentStatus} language={language} ui={ui} />}
        {activeView === "settings" && (
          <SettingsView
            agentStatus={agentStatus}
            languageMode={languageMode}
            setLanguageMode={setLanguageMode}
            state={state}
            ui={ui}
            updateState={updateState}
          />
        )}
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

function taskDetailMarkdown(task: Task, ui: Copy) {
  return [
    `## ${ui.today.target}\n${task.impact}`,
    task.knowledgePoint ? `## ${ui.today.taskText}\n${task.knowledgePoint}` : undefined,
    task.notes && !task.questions?.length ? `## ${ui.today.notes}\n${task.notes}` : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function TaskQuestionList({ task, ui }: { task: Task; ui: Copy }) {
  const questions = task.questions?.length ? task.questions : task.question ? [task.question] : [];
  if (questions.length === 0) return null;

  return (
    <div className="task-exercises">
      {questions.map((question, index) => (
        <article key={question.id}>
          <span>
            {ui.today.exercise} {index + 1}
          </span>
          <MarkdownBlock text={question.prompt} />
          <details>
            <summary>{ui.today.showAnswer}</summary>
            <MarkdownBlock text={`**${ui.today.answer}**\n\n${question.answer}\n\n**${ui.today.explanation}**\n\n${question.explanation}`} />
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
  ui,
}: {
  task: Task;
  onBack: () => void;
  setTaskStatus: (taskId: string, status: TaskStatus) => void;
  ui: Copy;
}) {
  return (
    <div className="task-detail-view">
      <button className="back-button" onClick={onBack} type="button">
        <ArrowLeft size={16} />
        {ui.today.detailBack}
      </button>
      <div className="task-detail-head">
        <div>
          <span>
            {ui.taskKind[task.kind]} · {task.minutes} {ui.units.minutes} · +{task.xp} XP
          </span>
          <h2>{task.title}</h2>
        </div>
        <select value={task.status} onChange={(event) => setTaskStatus(task.id, event.target.value as TaskStatus)}>
          {Object.entries(ui.taskStatus).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <MarkdownBlock text={taskDetailMarkdown(task, ui)} />
      <TaskQuestionList task={task} ui={ui} />
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
  ui,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
  openAgent: () => void;
  ui: Copy;
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
          <h2>{ui.today.hero}</h2>
          <p>
            {ui.today.day} {daysBetween(state.profile.startDate)} · Lv.{level.level} {level.title} · {ui.today.freezeCards} {state.freezeCards}
          </p>
        </div>
        <div className="hero-progress">
          <strong>{totalProgress(state)}%</strong>
          <span>{ui.today.totalProgress}</span>
          <ProgressBar value={totalProgress(state)} />
        </div>
      </section>

      <section className="panel main-panel">
        {selectedTask ? (
          <TaskDetailView task={selectedTask} onBack={() => setSelectedTaskId(null)} setTaskStatus={setTaskStatus} ui={ui} />
        ) : (
          <>
        <SectionTitle
          kicker="Today"
          title={ui.today.main}
          action={
            <button className="ghost-button" onClick={openAgent} type="button">
              <Bot size={16} />
              {ui.today.askHermes}
            </button>
          }
        />

        <div className="task-stack">
          {todayTasks.map((task) => (
            <article className={cx("task-row", task.status === "done" && "completed")} key={task.id}>
              <button
                aria-label={ui.today.completeTask}
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
                  {ui.taskKind[task.kind]} · {task.minutes} {ui.units.minutes} · +{task.xp} XP
                </span>
                <small>{task.impact}</small>
                </span>
                <ChevronRight size={18} />
              </button>
              <select value={task.status} onChange={(event) => setTaskStatus(task.id, event.target.value as TaskStatus)}>
                {Object.entries(ui.taskStatus).map(([value, label]) => (
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
        <SectionTitle kicker="Progress" title={ui.today.pathProgress} />
        <div className="progress-list">
          <ProgressItem label="Year 1" value={yearProgress(state)} />
          <ProgressItem label={ui.today.analyst} value={state.roadmap[0].milestones[1].progress} />
          <ProgressItem label={ui.today.portfolioV1} value={state.roadmap[0].milestones[4].progress} />
          <ProgressItem label={ui.metrics.assetScore} value={assetScore(state)} />
        </div>
      </section>

      <section className="panel">
        <SectionTitle kicker="Risk" title={ui.today.risk} />
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
        <Metric label={ui.metrics.completion} value={`${done}/${todayTasks.length}`} />
        <Metric label={ui.metrics.plannedTime} value={`${todaySummary?.plannedMinutes ?? todayTasks.reduce((sum, task) => sum + task.minutes, 0)} ${ui.units.minutes}`} />
        <Metric label={ui.metrics.focus} value={todaySummary?.focus ?? ui.today.portfolioV1} />
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
  ui,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
  ui: Copy;
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
      <SectionTitle kicker="Roadmap" title={ui.nav.roadmap} />
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
  ui,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
  ui: Copy;
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
      <SectionTitle kicker="Tasks" title={ui.tasks.title} />
      <div className="automation-banner">
        <div>
          <strong>{ui.tasks.bannerTitle}</strong>
          <span>
            {todayTasks.length} {ui.units.tasks} · {plannedMinutes} {ui.units.minutes} · {todaySummary?.completedMinutes ?? 0} {ui.units.doneMinutes}
          </span>
        </div>
        <small>{todaySummary?.nextStep ?? ui.tasks.emptySummary}</small>
      </div>
      <div className="segmented">
        {(["all", "todo", "doing", "done", "skipped", "postponed"] as Array<"all" | TaskStatus>).map((item) => (
          <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)} type="button">
            {item === "all" ? ui.tasks.all : ui.taskStatus[item]}
          </button>
        ))}
      </div>
      <div className="table-list">
        {tasks.map((task) => (
          <article className="table-row" key={task.id}>
            <div>
              <strong>{task.title}</strong>
              <small>
                {task.dueDate} · {task.track} · {task.minutes} {ui.units.minutes} · +{task.xp} XP
              </small>
            </div>
            <span className="task-kind-chip">{ui.taskKind[task.kind]}</span>
            <select value={task.status} onChange={(event) => patchTask(task.id, { status: event.target.value as TaskStatus })}>
              {Object.entries(ui.taskStatus).map(([value, label]) => (
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
  ui,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
  ui: Copy;
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
      <SectionTitle kicker="Learning" title={ui.learning.title} />
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
                      {topic.kind} · {topic.minutes} {ui.units.minutes}
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
                    placeholder={ui.learning.notePlaceholder}
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
  ui,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
  ui: Copy;
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
          title: ui.portfolio.newProjectTitle,
          stage: "Draft",
          progress: 0,
          problem: "",
          users: "",
          solution: "",
          evidence: "",
          nextStep: ui.portfolio.newProjectNextStep,
        },
      ],
    }));
  }

  return (
    <section className="panel full-panel">
      <SectionTitle
        kicker="Portfolio"
        title={ui.portfolio.title}
        action={
          <button className="primary-button" onClick={addProject} type="button">
            <Plus size={16} />
            {ui.portfolio.newProject}
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
              <TextBlock label={ui.portfolio.problem} value={project.problem} onChange={(value) => patchProject(project.id, { problem: value })} />
              <TextBlock label={ui.portfolio.users} value={project.users} onChange={(value) => patchProject(project.id, { users: value })} />
              <TextBlock label={ui.portfolio.solution} value={project.solution} onChange={(value) => patchProject(project.id, { solution: value })} />
              <TextBlock label={ui.portfolio.evidence} value={project.evidence} onChange={(value) => patchProject(project.id, { evidence: value })} />
            </div>
            <TextBlock label={ui.portfolio.nextStep} value={project.nextStep} onChange={(value) => patchProject(project.id, { nextStep: value })} />
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
  ui,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
  ui: Copy;
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
        <SectionTitle kicker="Score" title={ui.visa.scoreTitle} />
        <div className="score-meter">
          <strong>{score}</strong>
          <span>{score >= 80 ? ui.visa.high : score >= 70 ? ui.visa.ready : ui.visa.needsWork}</span>
        </div>
        <div className="form-grid">
          <label>
            {ui.visa.education}
            <select value={state.visa.inputs.education} onChange={(event) => patchInputs({ education: event.target.value as AppState["visa"]["inputs"]["education"] })}>
              <option value="bachelor">{ui.education.bachelor}</option>
              <option value="master">{ui.education.master}</option>
              <option value="doctor">{ui.education.doctor}</option>
            </select>
          </label>
          <label>
            {ui.visa.age}
            <input type="number" value={state.visa.inputs.age} onChange={(event) => patchInputs({ age: Number(event.target.value) })} />
          </label>
          <label>
            {ui.visa.workYears}
            <input type="number" value={state.visa.inputs.workYears} onChange={(event) => patchInputs({ workYears: Number(event.target.value) })} />
          </label>
          <label>
            {ui.visa.annualIncome}
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
              <option value="none">{ui.visa.noJlpt}</option>
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
            {ui.visa.japaneseDegree}
          </label>
          <label>
            <input
              checked={state.visa.inputs.hasAdvancedCertificate}
              onChange={(event) => patchInputs({ hasAdvancedCertificate: event.target.checked })}
              type="checkbox"
            />
            {ui.visa.advancedCertificate}
          </label>
          <label>
            <input
              checked={state.visa.inputs.hasResearchOrPatent}
              onChange={(event) => patchInputs({ hasResearchOrPatent: event.target.checked })}
              type="checkbox"
            />
            {ui.visa.researchPatent}
          </label>
        </div>
        <p className="fine-print">{ui.visa.finePrint}</p>
      </section>

      <section className="panel">
        <SectionTitle kicker="Materials" title={ui.visa.materials} />
        <div className="material-list">
          {state.visa.materials.map((material) => (
            <article className="material" key={material.id}>
              <div>
                <strong>{material.title}</strong>
                <span>{material.group}</span>
              </div>
              <select value={material.status} onChange={(event) => patchMaterial(material.id, { status: event.target.value as MaterialStatus })}>
                {Object.entries(ui.materialStatus).map(([value, label]) => (
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
  ui,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
  ui: Copy;
}) {
  function patchOpportunity(id: string, patch: Partial<Opportunity>) {
    updateState((current) => ({
      ...current,
      opportunities: current.opportunities.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  return (
    <section className="panel full-panel">
      <SectionTitle kicker="Radar" title={ui.opportunity.title} />
      <div className="automation-banner">
        <div>
          <strong>{ui.opportunity.bannerTitle}</strong>
          <span>{ui.opportunity.bannerText}</span>
        </div>
        <small>{ui.opportunity.bannerNote}</small>
      </div>
      <div className="opportunity-list">
        {state.opportunities.map((item) => (
          <article className="opportunity" key={item.id}>
            <div className="opportunity-head">
              <div>
                <strong>{item.company}</strong>
                <span>{item.role}</span>
              </div>
              <span className="task-kind-chip">{ui.opportunity.tier[item.tier]}</span>
              <strong>{item.fit}%</strong>
            </div>
            <div className="form-grid compact">
              <label>
                {ui.opportunity.source}
                <span className="readonly-field">{item.contact || ui.opportunity.generated}</span>
              </label>
              <label>
                {ui.opportunity.visaFit}
                <span className="readonly-field">{item.visaFit ? ui.opportunity.priority : ui.opportunity.confirm}</span>
              </label>
              <label>
                {ui.opportunity.status}
                <select value={item.status} onChange={(event) => patchOpportunity(item.id, { status: event.target.value as Opportunity["status"] })}>
                  <option value="research">{ui.opportunity.statusLabels.research}</option>
                  <option value="contacted">{ui.opportunity.statusLabels.contacted}</option>
                  <option value="interviewing">{ui.opportunity.statusLabels.interviewing}</option>
                  <option value="archived">{ui.opportunity.statusLabels.archived}</option>
                </select>
              </label>
              <label>
                {ui.opportunity.fit}
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
  ui,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
  ui: Copy;
}) {
  const [type, setType] = useState<Review["type"]>("weekly");
  const currentReview = state.reviews.find((review) => review.type === type);

  return (
    <div className="view-grid review-grid">
      <section className="panel">
        <SectionTitle kicker="Review" title={ui.review.title} />
        <div className="segmented">
          <button className={type === "weekly" ? "active" : ""} onClick={() => setType("weekly")} type="button">
            {ui.review.weekly}
          </button>
          <button className={type === "monthly" ? "active" : ""} onClick={() => setType("monthly")} type="button">
            {ui.review.monthly}
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
          <p className="empty">{ui.review.empty}</p>
        )}
      </section>
      <section className="panel">
        <SectionTitle kicker="History" title={ui.review.history} />
        <div className="review-list">
          {state.reviews.map((review) => (
            <article key={review.id}>
              <span>
                {review.type === "weekly" ? ui.review.weekly : ui.review.monthly} · {review.date}
              </span>
              <strong>{review.biggestMove || ui.review.missing}</strong>
              <p>{review.adjustment}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AchievementView({ state, ui }: { state: AppState; ui: Copy }) {
  const level = levelFromState(state);

  return (
    <div className="view-grid achievement-grid">
      <section className="panel">
        <SectionTitle kicker="Level" title={ui.achievement.level} />
        <div className="level-display">
          <strong>Lv.{level.level}</strong>
          <span>{level.title}</span>
          <p>
            {state.xp} XP · {state.streak} {ui.sidebar.streak} · {ui.today.freezeCards} {state.freezeCards}
          </p>
        </div>
        <ProgressBar value={Math.min(100, (state.xp % 1000) / 10)} />
      </section>
      <section className="panel">
        <SectionTitle kicker="Badges" title={ui.achievement.badges} />
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
  language,
  ui,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
  agentStatus: AgentStatus | null;
  language: Language;
  ui: Copy;
}) {
  const [mode, setMode] = useState<AgentMode>("diagnosis");
  const [prompt, setPrompt] = useState(agentModes[language].diagnosis.prompt);
  const [running, setRunning] = useState(false);
  const [generatingDaily, setGeneratingDaily] = useState(false);
  const [error, setError] = useState("");
  const previousLanguageRef = useRef(language);
  const modeCopy = agentModes[language][mode];

  useEffect(() => {
    const previousPrompt = agentModes[previousLanguageRef.current][mode].prompt;
    if (prompt === previousPrompt) setPrompt(agentModes[language][mode].prompt);
    previousLanguageRef.current = language;
  }, [language, mode, prompt]);

  function selectMode(nextMode: AgentMode) {
    setMode(nextMode);
    setPrompt(agentModes[language][nextMode].prompt);
  }

  async function runAgent() {
    setRunning(true);
    setError("");
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, mode: modeCopy.label, prompt, state }),
      });
      const data = (await response.json()) as { ok: boolean; response?: string; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Hermes request failed");
      updateState((current) => ({
        ...current,
        agentNotes: [
          {
            id: createId("agent"),
            date: todayKey(),
            mode: modeCopy.label,
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
      const response = await fetch("/api/agent/generate-daily-lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
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
        ui.agent.fallbackTitle,
        `${ui.agent.mode}: ${modeCopy.label}`,
        `${ui.agent.outputLanguage}: ${outputLanguageName[language]}`,
        `${ui.agent.currentState}:`,
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
        `${ui.agent.request}:`,
        prompt,
      ].join("\n\n"),
    [language, modeCopy.label, prompt, state, ui],
  );

  return (
    <div className="view-grid agent-grid">
      <section className="panel">
        <SectionTitle kicker="Hermes" title="AI Coach" />
        <div className="agent-status">
          <span className={agentStatus?.available ? "dot on" : "dot"} />
          <div>
            <strong>{agentStatus?.available ? ui.agent.detected : ui.agent.missing}</strong>
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
            <strong>{ui.agent.outputs}</strong>
            {state.agentDesign.outputs.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div>
            <strong>{ui.agent.boundaries}</strong>
            {state.agentDesign.safety.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
        <div className="segmented wrap">
          {agentModeOrder.map((item) => (
            <button className={mode === item ? "active" : ""} key={item} onClick={() => selectMode(item)} type="button">
              {agentModes[language][item].label}
            </button>
          ))}
        </div>
        <textarea className="agent-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        <button className="ghost-button wide" disabled={generatingDaily} onClick={generateDailyLessons} type="button">
          {generatingDaily ? <RefreshCw className="spin" size={16} /> : <BookOpen size={16} />}
          {generatingDaily ? ui.agent.generatingDaily : ui.agent.generateDaily}
        </button>
        <button className="primary-button wide" disabled={running} onClick={runAgent} type="button">
          {running ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}
          {running ? ui.agent.running : ui.agent.run}
        </button>
        {error && (
          <div className="error-box">
            <strong>{ui.agent.errorTitle}</strong>
            <p>{error}</p>
            <textarea readOnly value={fallbackPrompt} />
          </div>
        )}
      </section>
      <section className="panel">
        <SectionTitle kicker="Notes" title={ui.agent.notes} />
        <div className="agent-notes">
          {state.agentNotes.length === 0 && <p className="empty">{ui.agent.empty}</p>}
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
  languageMode,
  setLanguageMode,
  ui,
}: {
  state: AppState;
  updateState: (next: (current: AppState) => AppState) => void;
  agentStatus: AgentStatus | null;
  languageMode: LanguageMode;
  setLanguageMode: (languageMode: LanguageMode) => void;
  ui: Copy;
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
        <SectionTitle kicker="Profile" title={ui.settings.profile} />
        <div className="form-grid">
          <label>
            {ui.settings.language}
            <select value={languageMode} onChange={(event) => setLanguageMode(event.target.value as LanguageMode)}>
              {languageOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "auto" ? `${languageLabels.auto} (${languageLabels[resolveLanguage(option)]})` : languageLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {ui.settings.pathName}
            <input value={state.profile.name} onChange={(event) => patchProfile({ name: event.target.value })} />
          </label>
          <label>
            {ui.settings.startDate}
            <input type="date" value={state.profile.startDate} onChange={(event) => patchProfile({ startDate: event.target.value })} />
          </label>
          <label>
            {ui.settings.targetYear}
            <input value={state.profile.targetYear} onChange={(event) => patchProfile({ targetYear: event.target.value })} />
          </label>
          <label>
            {ui.settings.targetRole}
            <input value={state.profile.targetRole} onChange={(event) => patchProfile({ targetRole: event.target.value })} />
          </label>
          <label>
            {ui.settings.currentPhase}
            <input value={state.profile.currentPhase} onChange={(event) => patchProfile({ currentPhase: event.target.value })} />
          </label>
          <label>
            {ui.settings.intensity}
            <select value={state.profile.intensity} onChange={(event) => patchProfile({ intensity: event.target.value as Intensity })}>
              <option value="light">{ui.intensity.light}</option>
              <option value="standard">{ui.intensity.standard}</option>
              <option value="intensive">{ui.intensity.intensive}</option>
            </select>
          </label>
          <label>
            {ui.settings.japaneseLevel}
            <input value={state.profile.japaneseLevel} onChange={(event) => patchProfile({ japaneseLevel: event.target.value })} />
          </label>
          <label>
            {ui.visa.education}
            <select value={state.profile.education} onChange={(event) => patchProfile({ education: event.target.value as AppState["profile"]["education"] })}>
              <option value="bachelor">{ui.education.bachelor}</option>
              <option value="master">{ui.education.master}</option>
              <option value="doctor">{ui.education.doctor}</option>
            </select>
          </label>
          <label>
            {ui.visa.age}
            <input type="number" value={state.profile.age} onChange={(event) => patchProfile({ age: Number(event.target.value) })} />
          </label>
          <label>
            {ui.visa.workYears}
            <input type="number" value={state.profile.workYears} onChange={(event) => patchProfile({ workYears: Number(event.target.value) })} />
          </label>
        </div>
      </section>
      <section className="panel">
        <SectionTitle kicker="Data" title={ui.settings.data} />
        <div className="settings-actions">
          <button className="ghost-button" onClick={exportState} type="button">
            <Download size={16} />
            {ui.settings.exportJson}
          </button>
          <button className="ghost-button" onClick={() => fileInputRef.current?.click()} type="button">
            <Upload size={16} />
            {ui.settings.importJson}
          </button>
          <button className="danger-button" onClick={() => updateState(() => createDefaultState())} type="button">
            {ui.settings.reset}
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
          <strong>{agentStatus?.available ? ui.settings.hermesAvailable : ui.settings.hermesMissing}</strong>
          <span>{agentStatus?.launchCmd}</span>
          <small>{ui.settings.hermesHint}</small>
        </div>
      </section>
    </div>
  );
}

export default App;
