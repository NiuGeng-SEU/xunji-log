import { createContext, ReactNode, useContext, useEffect } from "react";

type LanguageContextValue = {
  language: "en" | "zh";
  t: (english: string, chinese: string) => string;
  label: (value: string) => string;
  rawLabel: (value: string) => string;
  text: (value: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const ENGLISH_LABELS: Record<string, string> = {
  "有氧": "Cardio",
  "其他": "Other",
  "手臂": "Arms",
  "背": "Back",
  "胸": "Chest",
  "肩": "Shoulders",
  "腿": "Legs",
  "核心": "Core",
  "周一": "Mon",
  "周二": "Tue",
  "周三": "Wed",
  "周四": "Thu",
  "周五": "Fri",
  "周六": "Sat",
  "周日": "Sun",
  "步行": "Walking",
  "跑步": "Running",
  "室内跑步": "Indoor Running",
  "户外跑步": "Outdoor Running",
  "骑行": "Cycling",
  "功能性力量训练": "Functional Strength Training",
  "TraditionalStrengthTraining": "Traditional Strength Training",
  "EZ杆二头弯举": "EZ-Bar Curl",
  "上斜哑铃卧推": "Incline Dumbbell Bench Press",
  "上斜杠铃卧推": "Incline Barbell Bench Press",
  "侧平举": "Lateral Raise",
  "单手哑铃手腕弯举（正手）": "Single-Arm Dumbbell Wrist Curl (Overhand)",
  "双杠臂屈伸（负重）": "Weighted Parallel-Bar Dip",
  "哑铃划船": "Dumbbell Row",
  "哑铃卧推": "Dumbbell Bench Press",
  "哑铃弯举": "Dumbbell Curl",
  "哑铃推肩": "Dumbbell Shoulder Press",
  "器械坐姿反向飞鸟": "Seated Reverse Machine Fly",
  "器械臂屈伸": "Machine Triceps Extension",
  "器械飞鸟": "Machine Chest Fly",
  "坐姿划船": "Seated Row",
  "宽距下拉": "Wide-Grip Lat Pulldown",
  "引体向上": "Pull-Up",
  "悍马机下拉": "Hammer Strength Pulldown",
  "悍马机侧平举": "Hammer Strength Lateral Raise",
  "悍马机推胸": "Hammer Strength Chest Press",
  "杠铃划船": "Barbell Row",
  "杠铃卧推": "Barbell Bench Press",
  "杠铃罗马尼亚硬拉": "Barbell Romanian Deadlift",
  "深蹲": "Squat",
  "牧师凳弯举": "Preacher Curl",
  "直杆绳索下压": "Straight-Bar Cable Pushdown",
  "站姿杠铃推举": "Standing Barbell Overhead Press",
  "锤式弯举": "Hammer Curl",
  "面拉": "Face Pull",
  "背·二头": "Back & Biceps",
  "胸·三头·腹肌": "Chest, Triceps & Abs",
  "腿·肩": "Legs & Shoulders",
  "腹部 小臂": "Abs & Forearms",
  "力量训练": "Strength Workout",
  "远足": "Hiking",
  "硬拉": "Deadlift",
  "罗马尼亚硬拉": "Romanian Deadlift",
  "杠铃推举": "Barbell Overhead Press",
  "双杠臂屈伸": "Parallel-Bar Dip",
};
const RAW_LABELS = Object.fromEntries(Object.entries(ENGLISH_LABELS).map(([raw, english]) => [english, raw]));

function replaceKnownLabels(value: string): string {
  return Object.entries(ENGLISH_LABELS)
    .sort(([a], [b]) => b.length - a.length)
    .reduce((text, [raw, english]) => text.replaceAll(raw, english), value);
}

const BODY_PART_MAP: Record<string, string> = {
  "胸": "Chest",
  "背": "Back",
  "腿": "Legs",
  "肩": "Shoulders",
  "手臂": "Arms",
  "二头": "Biceps",
  "三头": "Triceps",
  "腹肌": "Abs",
  "腹部": "Abs",
  "小臂": "Forearms",
  "核心": "Core",
  "力量": "Strength",
  "有氧": "Cardio",
  "跑步": "Running",
  "远足": "Hiking",
  "步行": "Walking",
  "骑行": "Cycling",
};

export function translateLabel(raw: string): string {
  if (!raw) return "";
  if (ENGLISH_LABELS[raw]) return ENGLISH_LABELS[raw];

  // Try decomposing compound split labels like "背·二头" or "胸·三头·腹肌" or "腹部 小臂"
  if (/[·/+\s]/.test(raw)) {
    const parts = raw.split(/[·/+\s]+/).filter(Boolean);
    const translatedParts = parts.map((part) => BODY_PART_MAP[part] || ENGLISH_LABELS[part] || part);
    const combined = translatedParts.join(" & ");
    if (!/\p{Script=Han}/u.test(combined)) {
      return combined;
    }
  }

  // Replace known sub-phrases
  const replaced = replaceKnownLabels(raw);
  if (!/\p{Script=Han}/u.test(replaced)) {
    return replaced;
  }

  // Fallback: strip any remaining Chinese characters, or default to English fallback
  const stripped = replaced.replace(/[\u4e00-\u9fa5]+/g, "").trim();
  return stripped || "Workout";
}

function translateGeneratedText(raw: string): string {
  const rules: Array<[RegExp, (...parts: string[]) => string]> = [
    [/^共 (\d+) 次训练：(.+)$/, (n, names) => `${n} sessions: ${names}`],
    [/^力量总容量 (.+)，完成 (\d+) 组 \/ (\d+) 个动作$/, (volume, sets, moves) => `Strength volume ${volume}; ${sets} completed sets across ${moves} movements`],
    [/^有氧 (.+?)，消耗约 (.+)$/, (distance, calories) => `Cardio ${distance}; approximately ${calories}`],
    [/^有氧 (.+?) · 消耗约 (.+)$/, (distance, calories) => `Cardio ${distance}; approximately ${calories}`],
    [/^主练部位：(.+?)（(\d+) 个动作(?:出现)?）$/, (area, count) => `Primary area: ${ENGLISH_LABELS[area] || area} (${count} movements)`],
    [/^(?:当日)?容量最高动作：(.+?)（(.+?)）(.+)$/, (move, area, volume) => `Highest-volume movement: ${move} (${ENGLISH_LABELS[area] || area}), ${volume}`],
    [/^容量最高：(.+?)（(.+)）$/, (move, detail) => `Highest volume: ${move} (${detail})`],
    [/^容量高于日常均值 (.+) 约 (.+)$/, (average, percent) => `Volume was approximately ${percent} above the usual average of ${average}`],
    [/^容量低于日常均值 (.+) 约 (.+)$/, (average, percent) => `Volume was approximately ${percent} below the usual average of ${average}`],
    [/^共 (\d+) 个训练日 · (\d+) 组 · 累计容量 (.+)$/, (days, sets, volume) => `${days} training days · ${sets} sets · total volume ${volume}`],
    [/^峰值重量：(.+)$/, (detail) => `Peak weight: ${detail}`],
    [/^单次容量从 (.+) 涨到 (.+)$/, (from, to) => `Volume per session increased from ${from} to ${to}`],
    [/^近期单次容量 (.+)，低于早期 (.+)$/, (recent, early) => `Recent volume per session is ${recent}, below the earlier ${early}`],
    [/^平均 (.+) 天练一次 · 部位：(.+)$/, (gap, area) => `Trained every ${gap} days on average · Area: ${ENGLISH_LABELS[area] || area}`],
    [/^首次 (.+) · 最近 (.+)$/, (first, recent) => `First: ${first} · Most recent: ${recent}`],
    [/^活跃日平均容量 (.+)$/, (volume) => `Average volume on active days: ${volume}`],
    [/^占全部训练的? (.+)$/, (share) => `Share of all training: ${share}`],
    [/^平均每次 (.+) 分钟$/, (minutes) => `Average duration: ${minutes} min`],
    [/^常练动作：(.+)$/, (names) => `Common movements: ${names}`],
  ];
  for (const [pattern, render] of rules) {
    const match = raw.match(pattern);
    if (match) {
      const translated = replaceKnownLabels(render(...match.slice(1)));
      return /\p{Script=Han}/u.test(translated) ? "" : translated;
    }
  }
  const translated = replaceKnownLabels(ENGLISH_LABELS[raw] || raw);
  return /\p{Script=Han}/u.test(translated) ? "" : translated;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    window.localStorage.removeItem("xunji-language");
    document.documentElement.lang = "en";
    document.title = "Workout Dashboard";
  }, []);

  const value: LanguageContextValue = {
    language: "en",
    t: (english) => english,
    label: (raw) => translateLabel(raw),
    rawLabel: (display) => RAW_LABELS[display] || display,
    text: (raw) => translateGeneratedText(raw),
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
