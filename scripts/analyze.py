#!/usr/bin/env python3
"""聚合 data/cache/*.json 的原始训练数据，产出 data/analysis.json 供 Canvas 展示。"""
import datetime
import json
import os
from collections import Counter, defaultdict

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA = os.environ.get("DATA_DIR", os.path.join(_ROOT, "data"))
CACHE_DIR = os.path.join(_DATA, "cache")
OUT = os.path.join(_DATA, "analysis.json")

# 动作 -> 身体部位 分类（按关键词，顺序即优先级）
CATEGORY_RULES = [
    ("有氧", ["划船机", "跑步", "椭圆机", "单车", "骑行", "游泳", "跳绳", "爬楼", "登山机",
               "tabata", "hiit", "拳击", "有氧", "快走", "散步", "操课", "健身操", "风阻", "波比",
               "cycling", "running", "swimming", "jump rope", "rowing", "hiking", "walking",
               "elliptical", "stair", "applehealthworkout", "cardio", "treadmill"]),
    ("胸", ["卧推", "飞鸟", "夹胸", "俯卧撑", "推胸", "上斜", "下斜", "胸部", "蝴蝶机"]),
    ("背", ["引体", "下拉", "硬拉", "划船", "耸肩", "背部", "山羊挺身", "直臂下压", "反向飞鸟", "y字"]),
    ("腿", ["深蹲", "腿举", "腿屈伸", "腿弯举", "弓步", "箭步", "保加利亚", "提踵", "臀桥",
             "髋", "大腿", "小腿", "内收", "外展", "腿蹬", "倒蹬"]),
    ("肩", ["推举", "推肩", "侧平举", "前平举", "面拉", "后束", "肩上", "倒立", "哑铃推", "阿诺德"]),
    ("核心", ["卷腹", "平板", "转体", "举腿", "支撑", "腹肌", "腹部", "核心", "悬垂", "健腹轮", "仰卧起坐"]),
    ("手臂", ["弯举", "臂屈伸", "下压", "二头", "三头", "前臂", "锤式", "卷曲", "绳索"]),
]


def classify(name):
    n = name.lower()
    for cat, kws in CATEGORY_RULES:
        for kw in kws:
            if kw.lower() in n:
                return cat
    return "其他"


def is_cardio(move):
    sets = move.get("sets") or []
    if sets and sets[0].get("metrics"):
        return True
    if move.get("metrics"):
        return True
    return classify(move.get("name", "")) == "有氧"


def is_running(move_or_name):
    """Only running contributes to distance charts; walking stays excluded."""
    if isinstance(move_or_name, dict):
        name = str(move_or_name.get("name") or "")
    else:
        name = str(move_or_name or "")
    n = name.strip().lower()
    return any(keyword in n for keyword in ("running", "跑步", "treadmill", "jogging", "run"))


def is_activity_summary(name_or_move):
    """Exclude imported workout-type containers from movement rankings and exercise analysis."""
    if isinstance(name_or_move, dict):
        name = str(name_or_move.get("name") or "")
    else:
        name = str(name_or_move or "")
    normalized = "".join(char for char in name.lower() if char.isalnum())
    return (
        "walking" in normalized
        or "running" in normalized
        or "traditionalstrength" in normalized
        or "applehealth" in normalized
        or "elliptical" in normalized
    )


def is_traditional_strength(name_or_move):
    if isinstance(name_or_move, dict):
        name = str(name_or_move.get("name") or "")
    else:
        name = str(name_or_move or "")
    normalized = "".join(char for char in name.lower() if char.isalnum())
    return "traditionalstrength" in normalized or "功能性力量训练" in normalized


def parse_weight(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return 0.0


def parse_reps(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return 0.0


def classify_train(t):
    title = str(t.get("title") or "")
    movements = t.get("movements") or []
    has_running = any(is_running(m) for m in movements) or is_running(title)
    has_trad = is_traditional_strength(title) or any(is_traditional_strength(m) for m in movements)

    dist = 0.0
    for m in movements:
        for s in m.get("sets") or []:
            metrics = s.get("metrics") or {}
            d = parse_weight(metrics.get("distance") or m.get("distance") or s.get("distance"))
            if d > 0:
                dist += d

    is_walking = any("walking" in str(m.get("name") or "").lower() or "步行" in str(m.get("name") or "") for m in movements) or "步行" in title
    has_gym_strength = any(
        not is_activity_summary(m.get("name") or "") and str(m.get("name") or "").strip() != ""
        for m in movements
    )

    if has_running:
        return "running", dist
    elif is_walking:
        return "walking", dist
    elif has_gym_strength or has_trad:
        return "workout", dist
    else:
        return "other", dist


def get_day_sessions(trains):
    """
    Returns valid sessions for a day:
    - Maximal 1 workout session
    - Maximal 1 running session
    - Walking sessions only if distance > 1.0 km
    - Other cardio (e.g. hiking) only if distance > 1.0 km
    """
    workout_train = None
    running_train = None
    running_dist = 0.0
    walking_trains = []
    other_trains = []

    for t in trains:
        kind, dist = classify_train(t)
        if kind == "workout":
            moves = t.get("movements") or []
            has_gym = any(not is_activity_summary(m.get("name") or "") and str(m.get("name") or "").strip() != "" for m in moves)
            if workout_train is None or has_gym:
                workout_train = t
        elif kind == "running":
            if running_train is None or dist > running_dist:
                running_train = t
                running_dist = dist
        elif kind == "walking":
            if dist > 1.0:
                walking_trains.append(t)
        elif kind == "other":
            if dist > 1.0:
                other_trains.append(t)

    valid_sessions = []
    if workout_train:
        valid_sessions.append(("workout", workout_train))
    if running_train:
        valid_sessions.append(("running", running_train))
    for t in walking_trains:
        valid_sessions.append(("walking", t))
    for t in other_trains:
        valid_sessions.append(("other", t))
    return valid_sessions


def main():
    all_trains = []  # 每次训练一个 dict
    all_movements = []  # 每次训练每动作一个 dict
    day_trains = defaultdict(list)  # datestr -> [trains]

    for fname in sorted(os.listdir(CACHE_DIR)):
        if not fname.endswith(".json"):
            continue
        path = os.path.join(CACHE_DIR, fname)
        try:
            j = json.load(open(path, encoding="utf-8"))
        except Exception:
            continue
        res = j.get("res")
        if not isinstance(res, dict):
            continue
        trains = res.get("trains") or []
        for t in trains:
            all_trains.append(t)
            day_trains[t.get("datestr")].append(t)
            for m in t.get("movements") or []:
                all_movements.append({"train": t, "move": m})

    all_day_sessions = {ds: get_day_sessions(ts) for ds, ts in day_trains.items()}
    valid_sessions_flat = [
        (ds, kind, t)
        for ds in sorted(all_day_sessions.keys())
        for kind, t in all_day_sessions[ds]
    ]
    n_sessions = len(valid_sessions_flat)
    active_days = sorted(ds for ds, sess in all_day_sessions.items() if len(sess) > 0)
    n_days = len(active_days)

    # 总时长（分钟）：按有效 session 统计
    total_duration_min = 0.0
    durations = []
    for ds, kind, t in valid_sessions_flat:
        start = t.get("start") or t.get("started_at")
        end = t.get("end") or t.get("ended_at")
        dur = 0.0
        if start and end:
            dur = (end - start) / 60000
        else:
            for m in t.get("movements") or []:
                for s in m.get("sets") or []:
                    dur += (s.get("time") or 0) / 60
        total_duration_min += dur
        durations.append(dur)

    # 容量与组数
    total_volume_kg = 0.0
    total_sets = 0
    total_done_sets = 0
    move_stats = defaultdict(lambda: {"days": set(), "sessions": 0, "sets": 0, "volume": 0.0, "category": None})
    cat_sessions = Counter()  # 部位 -> 出现次数（按动作出现次数）
    cat_sets = Counter()

    # 有氧汇总（仅跑步算里程）
    total_distance_km = 0.0
    total_kcal = 0.0
    cardio_hr_avg = []
    cardio_hr_max = []
    n_strength_sessions = sum(1 for ds, kind, t in valid_sessions_flat if kind == "workout")
    n_cardio_sessions = sum(1 for ds, kind, t in valid_sessions_flat if kind in ("running", "walking", "other"))
    month_cardio_km = defaultdict(float)
    month_cardio_kcal = defaultdict(float)

    for t in all_trains:
        for m in t.get("movements") or []:
            name = m.get("name") or "(未命名)"
            running = is_running(m)
            summary_move = is_activity_summary(name)
            cat = classify(name)
            if not summary_move:
                st = move_stats[name]
                st["sessions"] += 1
                st["days"].add(t.get("datestr"))
                st["category"] = cat

            for s in m.get("sets") or []:
                metrics = s.get("metrics") or {}
                dist = parse_weight(metrics.get("distance") or m.get("distance"))
                kcal = parse_weight(metrics.get("calories") or metrics.get("kcal") or m.get("calories"))
                if running and dist > 0:
                    total_distance_km += dist
                    month_cardio_km[t.get("datestr", "")[:7]] += dist
                if kcal > 0:
                    total_kcal += kcal
                    month_cardio_kcal[t.get("datestr", "")[:7]] += kcal
                if parse_weight(metrics.get("avgHeartRate")) > 0:
                    cardio_hr_avg.append(parse_weight(metrics.get("avgHeartRate")))
                if parse_weight(metrics.get("maxHeartRate")) > 0:
                    cardio_hr_max.append(parse_weight(metrics.get("maxHeartRate")))

                w = parse_weight(s.get("weight") or s.get("weight_kg"))
                r = parse_reps(s.get("reps"))
                if not summary_move:
                    total_sets += 1
                    cat_sets[cat] += 1
                    if s.get("done"):
                        total_done_sets += 1
                        st["sets"] += 1
                    if w > 0 and r > 0 and not s.get("selfWeight"):
                        if str(s.get("unit") or "kg").strip().lower() in {"lb", "lbs", "pound", "pounds"}:
                            w *= 0.45359237
                        vol = w * r
                        total_volume_kg += vol
                        st["volume"] += vol

            if not summary_move:
                cat_sessions[cat] += 1

    # 月度聚合
    month_stats = defaultdict(lambda: {"sessions": 0, "days": set(), "volume": 0.0, "duration_min": 0.0})
    for ds, kind, t in valid_sessions_flat:
        month = ds[:7]
        ms = month_stats[month]
        ms["sessions"] += 1
        ms["days"].add(ds)
        start = t.get("start") or t.get("started_at")
        end = t.get("end") or t.get("ended_at")
        if start and end:
            ms["duration_min"] += (end - start) / 60000

    for t in all_trains:
        month = (t.get("datestr") or "")[:7]
        if not month:
            continue
        ms = month_stats[month]
        for m in t.get("movements") or []:
            name = m.get("name") or ""
            if is_activity_summary(name):
                continue
            for s in m.get("sets") or []:
                w = parse_weight(s.get("weight") or s.get("weight_kg"))
                r = parse_reps(s.get("reps"))
                if w > 0 and r > 0 and not s.get("selfWeight") and s.get("done"):
                    if str(s.get("unit") or "kg").strip().lower() in {"lb", "lbs", "pound", "pounds"}:
                        w *= 0.45359237
                    ms["volume"] += w * r

    # 每周聚合
    all_days = sorted(day_trains.keys())
    week_stats = defaultdict(int)
    for ds, kind, t in valid_sessions_flat:
        try:
            dt = datetime.date.fromisoformat(ds)
            # ISO 周
            iso = dt.isocalendar()
            week_stats[f"{iso[0]}-W{iso[1]:02d}"] += 1
        except ValueError:
            pass
    week_labels = []
    week_values = []
    if active_days:
        d0 = datetime.date.fromisoformat(active_days[0])
        d1 = datetime.date.fromisoformat(active_days[-1])
        start_monday = d0 - datetime.timedelta(days=d0.weekday())
        end_monday = d1 - datetime.timedelta(days=d1.weekday())
        w = start_monday
        while w <= end_monday:
            iso = w.isocalendar()
            key = f"{iso[0]}-W{iso[1]:02d}"
            week_labels.append(key)
            week_values.append(week_stats.get(key, 0))
            w += datetime.timedelta(days=7)

    # 星期几分布
    dow_counter = Counter()
    for ds, kind, t in valid_sessions_flat:
        try:
            dt = datetime.date.fromisoformat(ds)
            dow_counter[dt.weekday()] += 1
        except ValueError:
            pass

    # 开始时段分布（按东八区）
    hour_counter = Counter()
    for ds, kind, t in valid_sessions_flat:
        start = t.get("start") or t.get("started_at")
        if not start:
            continue
        lt = datetime.datetime.fromtimestamp(start / 1000, datetime.timezone(datetime.timedelta(hours=8)))
        hour_counter[lt.hour] += 1

    # 最长连续训练日/休息间隔
    max_streak = 0
    cur = 0
    prev = None
    for ds in active_days:
        dt = datetime.date.fromisoformat(ds)
        if prev is not None and (dt - prev).days == 1:
            cur += 1
        else:
            cur = 1
        max_streak = max(max_streak, cur)
        prev = dt
    gaps = []
    prev = None
    for ds in active_days:
        dt = datetime.date.fromisoformat(ds)
        if prev is not None:
            gaps.append((dt - prev).days)
        prev = dt

    # 平均每周训练次数（按实际日期跨度）
    span_days = 0
    if active_days:
        span_days = (datetime.date.fromisoformat(active_days[-1]) - datetime.date.fromisoformat(active_days[0])).days + 1
    avg_per_week = n_sessions / (span_days / 7) if span_days else 0

    # 月份序列（补全无训练月份）
    def month_iter(start, end):
        y, m = start // 100, start % 100
        ey, em = end // 100, end % 100
        while (y, m) <= (ey, em):
            yield f"{y:04d}-{m:02d}"
            m += 1
            if m == 13:
                m = 1
                y += 1

    if all_days:
        m0 = int(all_days[0][:7].replace("-", ""))
        m1 = int(all_days[-1][:7].replace("-", ""))
    else:
        m0 = m1 = 202508
    months = list(month_iter(m0, m1))

    # 排序 top 动作
    top_moves = sorted(
        ((name, stats) for name, stats in move_stats.items() if not is_activity_summary(name)),
        key=lambda kv: len(kv[1]["days"]),
        reverse=True,
    )

    # 日级统计（训练日历）
    daily_stats = []
    cat_month_vol = defaultdict(lambda: defaultdict(float))
    move_month_vol = defaultdict(lambda: defaultdict(float))
    movement_prs = {}
    cardio_sessions = []

    for t in all_trains:
        ds = t.get("datestr")
        month = ds[:7] if ds else ""
        t_cardio_km = 0.0
        t_cardio_kcal = 0.0
        t_duration = 0.0
        t_has_strength = False
        start = t.get("start") or t.get("started_at")
        end = t.get("end") or t.get("ended_at")
        if start and end:
            t_duration = (end - start) / 60000

        for m in t.get("movements") or []:
            name = m.get("name") or "(未命名)"
            summary_move = is_activity_summary(name)
            cat = classify(name)
            running = is_running(m)
            for s in m.get("sets") or []:
                w = parse_weight(s.get("weight") or s.get("weight_kg"))
                r = parse_reps(s.get("reps"))
                unit = s.get("unit") or "kg"
                if not summary_move and w > 0 and r > 0 and not s.get("selfWeight") and s.get("done"):
                    w_kg = w * 0.45359237 if str(unit).strip().lower() in {"lb", "lbs", "pound", "pounds"} else w
                    vol = w_kg * r
                    cat_month_vol[cat][month] += vol
                    move_month_vol[name][month] += vol
                    t_has_strength = True
                    prev = movement_prs.get(name)
                    if not prev or w_kg > prev["max_weight_kg"]:
                        movement_prs[name] = {
                            "max_weight_kg": round(w_kg, 1),
                            "reps": str(int(r) if r == int(r) else r),
                            "date": ds,
                            "category": cat,
                        }
                metrics = s.get("metrics") or {}
                dist = parse_weight(metrics.get("distance"))
                kcal = parse_weight(metrics.get("calories") or metrics.get("kcal"))
                if running:
                    t_cardio_km += dist
                t_cardio_kcal += kcal

    for ds, kind, t in valid_sessions_flat:
        if kind not in ("running", "walking", "other"):
            continue
        c_km = 0.0
        c_kcal = 0.0
        start = t.get("start") or t.get("started_at")
        end = t.get("end") or t.get("ended_at")
        dur = 0.0
        if start and end:
            dur = (end - start) / 60000
        avg_hr = 0.0
        for m in t.get("movements") or []:
            running = is_running(m)
            for s in m.get("sets") or []:
                met = s.get("metrics") or {}
                d = parse_weight(met.get("distance") or m.get("distance"))
                if (kind == "running" and running) or (kind != "running" and d > 0):
                    c_km += d
                k = parse_weight(met.get("calories") or met.get("kcal") or m.get("calories"))
                if k > 0:
                    c_kcal += k
                hr = parse_weight(met.get("avgHeartRate"))
                if hr > 0 and avg_hr == 0:
                    avg_hr = hr
        cardio_sessions.append({
            "date": ds,
            "title": t.get("title") or ("跑步" if kind == "running" else "步行" if kind == "walking" else "有氧"),
            "distance_km": round(c_km, 1),
            "kcal": round(c_kcal),
            "duration_min": round(dur, 0),
            "avg_hr": round(avg_hr, 0),
        })

    for ds in all_days:
        trains = day_trains[ds]
        day_sess = all_day_sessions.get(ds, [])
        day_vol = 0.0
        day_cardio_km = 0.0
        day_cardio_kcal = 0.0
        day_duration = 0.0
        for kind, t in day_sess:
            start = t.get("start") or t.get("started_at")
            end = t.get("end") or t.get("ended_at")
            if start and end:
                day_duration += (end - start) / 60000
            for m in t.get("movements") or []:
                running = is_running(m)
                for s in m.get("sets") or []:
                    metrics = s.get("metrics") or {}
                    if running:
                        day_cardio_km += parse_weight(metrics.get("distance"))
                    day_cardio_kcal += parse_weight(metrics.get("calories") or metrics.get("kcal"))
        # 确保当日所有真实力量训练动作的容量均被统计
        for t in trains:
            for m in t.get("movements") or []:
                if is_activity_summary(m.get("name") or ""):
                    continue
                for s in m.get("sets") or []:
                    w = parse_weight(s.get("weight") or s.get("weight_kg"))
                    r = parse_reps(s.get("reps"))
                    if w > 0 and r > 0 and not s.get("selfWeight") and s.get("done"):
                        if str(s.get("unit") or "kg").strip().lower() in {"lb", "lbs", "pound", "pounds"}:
                            w *= 0.45359237
                        day_vol += w * r
        daily_stats.append({
            "date": ds,
            "sessions": len(day_sess),
            "volume_kg": round(day_vol, 0),
            "duration_min": round(day_duration, 0),
            "cardio_km": round(day_cardio_km, 1),
            "cardio_kcal": round(day_cardio_kcal),
        })

    # 力量训练专项指标与目标汇总 (Strength Summary)
    workout_by_date = {}
    for ds, ts in sorted(day_trains.items()):
        sess = all_day_sessions.get(ds, [])
        for kind, t in sess:
            if kind == "workout":
                start = t.get("start") or t.get("started_at")
                end = t.get("end") or t.get("ended_at")
                dur = (end - start) / 60000 if (start and end) else 0
                vol = 0.0
                for tr in ts:
                    k, _ = classify_train(tr)
                    if k == "workout":
                        for m in tr.get("movements") or []:
                            if is_activity_summary(m.get("name") or ""):
                                continue
                            for s in m.get("sets") or []:
                                w = parse_weight(s.get("weight") or s.get("weight_kg"))
                                r = parse_reps(s.get("reps"))
                                if w > 0 and r > 0 and not s.get("selfWeight") and s.get("done"):
                                    if str(s.get("unit") or "kg").strip().lower() in {"lb", "lbs", "pound", "pounds"}:
                                        w *= 0.45359237
                                    vol += w * r
                workout_by_date[ds] = {
                    "date": ds,
                    "title": t.get("title") or "力量训练",
                    "duration_min": round(dur, 0),
                    "volume_kg": round(vol, 1),
                }

    workout_dates = sorted(workout_by_date.keys())
    latest_workout = workout_by_date[workout_dates[-1]] if workout_dates else {
        "date": "", "title": "力量训练", "duration_min": 0, "volume_kg": 0
    }

    # 锚点日期：取最新训练日
    anchor_dt = datetime.date.fromisoformat(workout_dates[-1]) if workout_dates else datetime.date.today()
    curr_year = anchor_dt.year
    curr_month_str = anchor_dt.strftime("%Y-%m")

    # 年度目标（52周 × 3次 = 156次）
    this_year_dates = [d for d in workout_dates if d.startswith(str(curr_year))]
    last_year_dates = [d for d in workout_dates if d.startswith(str(curr_year - 1))]
    this_year_dur_hours = sum(workout_by_date[d]["duration_min"] for d in this_year_dates) / 60

    # 月度目标（52周 × 3次 / 12月 = 13次）
    this_month_dates = [d for d in workout_dates if d.startswith(curr_month_str)]
    prev_month_last_day = datetime.date(curr_year, anchor_dt.month, 1) - datetime.timedelta(days=1)
    prev_month_str = prev_month_last_day.strftime("%Y-%m")
    last_month_dates = [d for d in workout_dates if d.startswith(prev_month_str)]
    this_month_dur_hours = sum(workout_by_date[d]["duration_min"] for d in this_month_dates) / 60

    # 周目标（每周 3 次，周日开始，计算当前周）
    today_dt = datetime.date.today()
    sun_offset = (today_dt.weekday() + 1) % 7
    cur_sun = today_dt - datetime.timedelta(days=sun_offset)
    cur_sat = cur_sun + datetime.timedelta(days=6)
    prev_sun = cur_sun - datetime.timedelta(days=7)
    prev_sat = cur_sat - datetime.timedelta(days=7)
    this_week_dates = [d for d in workout_dates if cur_sun.isoformat() <= d <= cur_sat.isoformat()]
    last_week_dates = [d for d in workout_dates if prev_sun.isoformat() <= d <= prev_sat.isoformat()]
    this_week_dur_hours = sum(workout_by_date[d]["duration_min"] for d in this_week_dates) / 60

    # 连续天数 Streak (以今日为准，若今日未练但昨日已练保留昨日连续天数)
    cur_day_streak = 0
    if today_dt.isoformat() in workout_by_date:
        check_d = today_dt
        while check_d.isoformat() in workout_by_date:
            cur_day_streak += 1
            check_d -= datetime.timedelta(days=1)
    else:
        yesterday_dt = today_dt - datetime.timedelta(days=1)
        if yesterday_dt.isoformat() in workout_by_date:
            check_d = yesterday_dt
            while check_d.isoformat() in workout_by_date:
                cur_day_streak += 1
                check_d -= datetime.timedelta(days=1)

    max_day_streak = 0
    cur_s = 0
    prev_d = None
    for d_str in workout_dates:
        d = datetime.date.fromisoformat(d_str)
        if prev_d is not None and (d - prev_d).days == 1:
            cur_s += 1
        else:
            cur_s = 1
        max_day_streak = max(max_day_streak, cur_s)
        prev_d = d

    # 连续周数 Streak (按每周至少1次训练，周日开始；本周已有训练则计入)
    workout_weeks = set()
    for ds in workout_dates:
        dt = datetime.date.fromisoformat(ds)
        sun_d = dt - datetime.timedelta(days=(dt.weekday() + 1) % 7)
        workout_weeks.add(sun_d)

    cur_week_streak = 0
    if cur_sun in workout_weeks:
        check_sun = cur_sun
        while check_sun in workout_weeks:
            cur_week_streak += 1
            check_sun -= datetime.timedelta(days=7)
    else:
        # 当前周正在进行中，检查上周连续周数
        check_sun = cur_sun - datetime.timedelta(days=7)
        while check_sun in workout_weeks:
            cur_week_streak += 1
            check_sun -= datetime.timedelta(days=7)

    sorted_w = sorted(list(workout_weeks))
    max_week_streak = 0
    cur_ws = 0
    prev_w_dt = None
    for sun_d in sorted_w:
        if prev_w_dt is not None and (sun_d - prev_w_dt).days == 7:
            cur_ws += 1
        else:
            cur_ws = 1
        max_week_streak = max(max_week_streak, cur_ws)
        prev_w_dt = sun_d

    # 生涯统计
    tot_strength_dur_hours = sum(workout_by_date[d]["duration_min"] for d in workout_dates) / 60
    first_dt = datetime.date.fromisoformat(workout_dates[0]) if workout_dates else anchor_dt
    last_dt = datetime.date.fromisoformat(workout_dates[-1]) if workout_dates else anchor_dt
    years_span = round((last_dt - first_dt).days / 365.25, 1)
    calendar_years = max(1, last_dt.year - first_dt.year + 1)

    # 常见与核心动作 Max & PR 统计
    COMPOUND_EXERCISES_DEF = [
        {
            "key": "bench_press",
            "name_en": "Bench Press",
            "name_zh": "杠铃卧推",
            "icon": "/exercises/bench_press.png",
            "gif": "/exercises/bench_press.gif",
            "matches": ["杠铃卧推", "平板杠铃卧推", "bench press"],
            "excludes": ["哑铃", "上斜", "下斜", "器械", "史密斯", "悍马"],
        },
        {
            "key": "incline_bench_press",
            "name_en": "Incline Barbell Bench Press",
            "name_zh": "上斜杠铃卧推",
            "icon": "/exercises/incline_bench_press.png",
            "gif": "/exercises/incline_bench_press.gif",
            "matches": ["上斜杠铃卧推", "上斜卧推", "incline barbell bench", "incline bench press"],
            "excludes": ["哑铃", "史密斯", "器械"],
        },
        {
            "key": "squat",
            "name_en": "Squat",
            "name_zh": "深蹲",
            "icon": "/exercises/squat.png",
            "gif": "/exercises/squat.gif",
            "matches": ["深蹲", "杠铃深蹲", "squat", "barbell squat"],
            "excludes": ["哑铃", "保加利亚", "分腿", "箭步", "弓步", "高脚杯", "器械", "哈克"],
        },
        {
            "key": "barbell_row",
            "name_en": "Barbell Row",
            "name_zh": "杠铃划船",
            "icon": "/exercises/barbell_row.png",
            "gif": "/exercises/barbell_row.gif",
            "matches": ["杠铃划船", "bent over row", "barbell row"],
            "excludes": ["哑铃", "坐姿", "单臂", "t杠", "绳索", "器械", "划船机"],
        },
        {
            "key": "shoulder_press",
            "name_en": "Barbell Shoulder Press",
            "name_zh": "站姿杠铃推举",
            "icon": "/exercises/shoulder_press.png",
            "gif": "/exercises/shoulder_press.gif",
            "matches": ["站姿杠铃推举", "杠铃推举", "推举", "shoulder press", "overhead press", "ohp"],
            "excludes": ["哑铃", "坐姿", "阿诺德", "器械", "史密斯"],
        },
        {
            "key": "deadlift",
            "name_en": "Deadlift",
            "name_zh": "硬拉 / 罗马尼亚硬拉",
            "icon": "/exercises/deadlift.png",
            "gif": "/exercises/deadlift.gif",
            "matches": ["硬拉", "杠铃罗马尼亚硬拉", "罗马尼亚硬拉", "deadlift", "romanian deadlift"],
            "excludes": ["哑铃", "单腿", "器械"],
        },
        {
            "key": "ez_bar_curl",
            "name_en": "EZ Bar Curl",
            "name_zh": "EZ杆二头弯举",
            "icon": "/exercises/ez_bar_curl.png",
            "gif": "/exercises/ez_bar_curl.gif",
            "matches": ["ez杆二头弯举", "ez杆", "ez杠铃弯举", "ez bar curl"],
            "excludes": [],
        },
        {
            "key": "dumbbell_row",
            "name_en": "Dumbbell Row",
            "name_zh": "哑铃划船",
            "icon": "/exercises/dumbbell_row.png",
            "gif": "/exercises/dumbbell_row.gif",
            "matches": ["哑铃划船", "单臂哑铃划船", "dumbbell row", "db row"],
            "excludes": [],
        },
        {
            "key": "tricep_pushdown",
            "name_en": "Tricep Pushdown",
            "name_zh": "直杆绳索下压",
            "icon": "/exercises/tricep_pushdown.png",
            "gif": "/exercises/tricep_pushdown.gif",
            "matches": ["直杆绳索下压", "绳索下压", "pushdown", "tricep pushdown"],
            "excludes": ["腿", "臂屈伸"],
        },
        {
            "key": "dips",
            "name_en": "Dips (Weighted)",
            "name_zh": "双杠臂屈伸（负重）",
            "icon": "/exercises/dips.png",
            "gif": "/exercises/dips.gif",
            "matches": ["双杠臂屈伸", "臂屈伸（负重）", "双杠", "dips", "chest dip"],
            "excludes": ["器械", "凳上"],
        },
        {
            "key": "lat_pulldown",
            "name_en": "Lat Pulldown",
            "name_zh": "宽距下拉",
            "icon": "/exercises/lat_pulldown.png",
            "gif": "/exercises/lat_pulldown.gif",
            "matches": ["宽距下拉", "高位下拉", "lat pulldown"],
            "excludes": ["悍马机", "直臂"],
        },
        {
            "key": "dumbbell_shoulder_press",
            "name_en": "Dumbbell Shoulder Press",
            "name_zh": "哑铃推肩",
            "icon": "/exercises/dumbbell_shoulder_press.png",
            "gif": "/exercises/dumbbell_shoulder_press.gif",
            "matches": ["哑铃推肩", "哑铃推举", "dumbbell shoulder press"],
            "excludes": [],
        },
        {
            "key": "seated_cable_row",
            "name_en": "Seated Cable Row",
            "name_zh": "坐姿划船",
            "icon": "/exercises/seated_cable_row.png",
            "gif": "/exercises/seated_cable_row.gif",
            "matches": ["坐姿划船", "seated cable row"],
            "excludes": ["器械坐姿反向飞鸟"],
        },
        {
            "key": "lateral_raise",
            "name_en": "Dumbbell Lateral Raise",
            "name_zh": "侧平举",
            "icon": "/exercises/lateral_raise.png",
            "gif": "/exercises/lateral_raise.gif",
            "matches": ["侧平举", "哑铃侧平举", "lateral raise"],
            "excludes": ["悍马机"],
        },
        {
            "key": "dumbbell_bench_press",
            "name_en": "Dumbbell Bench Press",
            "name_zh": "哑铃卧推",
            "icon": "/exercises/dumbbell_bench_press.png",
            "gif": "/exercises/dumbbell_bench_press.gif",
            "matches": ["哑铃卧推", "平板哑铃卧推", "dumbbell bench press"],
            "excludes": ["上斜", "下斜"],
        },
        {
            "key": "hammer_curl",
            "name_en": "Hammer Curl",
            "name_zh": "锤式弯举",
            "icon": "/exercises/hammer_curl.png",
            "gif": "/exercises/hammer_curl.gif",
            "matches": ["锤式弯举", "hammer curl"],
            "excludes": [],
        },
    ]

    compound_records = {
        c["key"]: {
            **c,
            "max_weight_kg": 0.0,
            "max_weight_lb": 0.0,
            "max_reps": 0,
            "max_date": "",
            "max_orig_weight": 0.0,
            "max_orig_unit": "kg",
            "best_1rm_kg": 0.0,
            "best_1rm_lb": 0.0,
            "best_1rm_weight": 0.0,
            "best_1rm_reps": 0,
            "best_1rm_date": "",
            "best_1rm_unit": "kg",
            "total_sets": 0,
            "history": [],
        }
        for c in COMPOUND_EXERCISES_DEF
    }

    for t in all_trains:
        ds = t.get("datestr") or ""
        for m in t.get("movements") or []:
            mname = (m.get("name") or "").strip()
            if not mname:
                continue
            matched_key = None
            for c in COMPOUND_EXERCISES_DEF:
                if any(mat.lower() in mname.lower() for mat in c["matches"]):
                    if not any(ex.lower() in mname.lower() for ex in c["excludes"]):
                        matched_key = c["key"]
                        break
            if not matched_key:
                continue

            for s in m.get("sets") or []:
                if not s.get("done") or s.get("selfWeight"):
                    continue
                w = parse_weight(s.get("weight") or s.get("weight_kg"))
                r = parse_reps(s.get("reps"))
                unit = str(s.get("unit") or "kg").strip().lower()
                if w <= 0 or r <= 0:
                    continue
                is_lb = unit in {"lb", "lbs", "pound", "pounds"}
                w_kg = w * 0.45359237 if is_lb else w
                w_lb = w if is_lb else w / 0.45359237
                e1rm_kg = w_kg * (1.0 + r / 30.0) if r > 1 else w_kg
                e1rm_lb = e1rm_kg / 0.45359237

                entry = compound_records[matched_key]
                entry["total_sets"] += 1
                entry["history"].append({
                    "date": ds,
                    "weight": round(w, 1),
                    "reps": int(r),
                    "unit": "lb" if is_lb else "kg",
                    "weight_kg": round(w_kg, 1),
                    "weight_lb": round(w_lb, 1),
                    "est_1rm_kg": round(e1rm_kg, 1),
                    "est_1rm_lb": round(e1rm_lb, 1),
                })

                if w_kg > entry["max_weight_kg"]:
                    entry["max_weight_kg"] = round(w_kg, 1)
                    entry["max_weight_lb"] = round(w_lb, 1)
                    entry["max_reps"] = int(r)
                    entry["max_date"] = ds
                    entry["max_orig_weight"] = round(w, 1)
                    entry["max_orig_unit"] = "lb" if is_lb else "kg"

                if e1rm_kg > entry["best_1rm_kg"]:
                    entry["best_1rm_kg"] = round(e1rm_kg, 1)
                    entry["best_1rm_lb"] = round(e1rm_lb, 1)
                    entry["best_1rm_weight"] = round(w, 1)
                    entry["best_1rm_reps"] = int(r)
                    entry["best_1rm_date"] = ds
                    entry["best_1rm_unit"] = "lb" if is_lb else "kg"

    compound_prs = []
    for c in COMPOUND_EXERCISES_DEF:
        rec = compound_records[c["key"]]
        if rec["total_sets"] == 0:
            continue
        top_by_1rm = sorted(rec["history"], key=lambda x: x["est_1rm_kg"], reverse=True)[:5]
        top_by_date = sorted(rec["history"], key=lambda x: x["date"], reverse=True)[:5]
        compound_prs.append({
            "key": rec["key"],
            "name_en": rec["name_en"],
            "name_zh": rec["name_zh"],
            "icon": rec["icon"],
            "gif": rec["gif"],
            "max_weight_kg": rec["max_weight_kg"],
            "max_weight_lb": rec["max_weight_lb"],
            "max_reps": rec["max_reps"],
            "max_date": rec["max_date"],
            "max_orig_weight": rec["max_orig_weight"],
            "max_orig_unit": rec["max_orig_unit"],
            "best_1rm_kg": rec["best_1rm_kg"],
            "best_1rm_lb": rec["best_1rm_lb"],
            "best_1rm_weight": rec["best_1rm_weight"],
            "best_1rm_reps": rec["best_1rm_reps"],
            "best_1rm_date": rec["best_1rm_date"],
            "best_1rm_unit": rec["best_1rm_unit"],
            "total_sets": rec["total_sets"],
            "top_sets": top_by_1rm,
            "recent_sets": top_by_date,
        })

    strength_summary = {
        "total_workouts": len(workout_dates),
        "total_volume_kg": round(total_volume_kg, 1),
        "total_duration_hours": round(tot_strength_dur_hours, 1),
        "total_years": years_span,
        "calendar_years": calendar_years,
        "latest_activity": latest_workout,
        "workout_dates": workout_dates,
        "workout_details": workout_by_date,
        "compound_prs": compound_prs,
        "streaks": {
            "current_days": cur_day_streak,
            "max_days": max_day_streak,
            "current_weeks": cur_week_streak,
            "max_weeks": max_week_streak,
        },
        "goals": {
            "weekly_target": 3,
            "monthly_target": 13,
            "yearly_target": 156,
            "this_week": {
                "workouts": len(this_week_dates),
                "duration_hours": round(this_week_dur_hours, 1),
                "diff_last_week": len(this_week_dates) - len(last_week_dates),
            },
            "this_month": {
                "workouts": len(this_month_dates),
                "duration_hours": round(this_month_dur_hours, 1),
                "diff_last_month": len(this_month_dates) - len(last_month_dates),
            },
            "this_year": {
                "workouts": len(this_year_dates),
                "duration_hours": round(this_year_dur_hours, 1),
                "diff_last_year": len(this_year_dates) - len(last_year_dates),
            },
        },
    }

    top8_names = [name for name, _ in top_moves[:8]]
    category_labels = ["背", "胸", "手臂", "腿", "核心", "肩", "有氧", "其他"]
    strength_cats = ["背", "胸", "手臂", "腿", "核心", "肩"]

    result = {
        "date_start": all_days[0] if all_days else None,
        "date_end": all_days[-1] if all_days else None,
        "n_days": n_days,
        "n_sessions": n_sessions,
        "n_movements": len(move_stats),
        "total_volume_kg": round(total_volume_kg, 1),
        "total_sets": total_sets,
        "total_done_sets": total_done_sets,
        "total_duration_min": round(total_duration_min, 1),
        "avg_session_duration_min": round(total_duration_min / n_sessions, 1) if n_sessions else 0,
        "avg_sessions_per_week": round(avg_per_week, 2),
        "max_streak_days": max_streak,
        "avg_gap_days": round(sum(gaps) / len(gaps), 1) if gaps else 0,
        "monthly": {
            "labels": months,
            "sessions": [month_stats.get(m, {}).get("sessions", 0) for m in months],
            "days": [len(month_stats.get(m, {}).get("days", set())) for m in months],
            "volume_tons": [round(month_stats.get(m, {}).get("volume", 0) / 1000, 2) for m in months],
            "duration_hours": [round(month_stats.get(m, {}).get("duration_min", 0) / 60, 1) for m in months],
            "cardio_km": [round(month_cardio_km.get(m, 0), 1) for m in months],
            "cardio_kcal": [round(month_cardio_kcal.get(m, 0)) for m in months],
        },
        "weekly": {
            "labels": week_labels,
            "sessions": week_values,
        },
        "cardio": {
            "n_sessions": n_cardio_sessions,
            "n_strength_sessions": n_strength_sessions,
            "total_km": round(total_distance_km, 1),
            "total_kcal": round(total_kcal),
            "avg_hr": round(sum(cardio_hr_avg) / len(cardio_hr_avg), 0) if cardio_hr_avg else 0,
            "max_hr": round(sum(cardio_hr_max) / len(cardio_hr_max), 0) if cardio_hr_max else 0,
        },
        "dow": {
            "labels": ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
            "sessions": [dow_counter.get(i, 0) for i in range(7)],
        },
        "hour_of_day": {
            "labels": [f"{h:02d}时" for h in range(24)],
            "sessions": [hour_counter.get(h, 0) for h in range(24)],
        },
        "categories": {
            "labels": [c[0] for c in sorted(cat_sessions.items(), key=lambda kv: -kv[1])],
            "sessions": [c[1] for c in sorted(cat_sessions.items(), key=lambda kv: -kv[1])],
        },
        "top_movements": [
            {
                "name": name,
                "days": len(st["days"]),
                "sessions": st["sessions"],
                "sets": st["sets"],
                "volume_kg": round(st["volume"], 0),
                "category": st["category"],
            }
            for name, st in top_moves[:20]
        ],
        "daily": daily_stats,
        "category_monthly": {
            "labels": months,
            "series": [
                {
                    "name": cat,
                    "data": [round(cat_month_vol[cat].get(m, 0) / 1000, 2) for m in months],
                }
                for cat in strength_cats
            ],
        },
        "movement_trends": {
            "labels": months,
            "series": [
                {
                    "name": name,
                    "data": [round(move_month_vol[name].get(m, 0) / 1000, 2) for m in months],
                }
                for name in top8_names
            ],
        },
        "movement_prs": sorted(
            [{"name": n, **v} for n, v in movement_prs.items()],
            key=lambda x: x["max_weight_kg"],
            reverse=True,
        )[:30],
        "cardio_sessions": sorted(cardio_sessions, key=lambda x: x["date"], reverse=True),
        "strength_summary": strength_summary,
        "compound_prs": compound_prs,
    }

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print(f"written {OUT}")

    web_public_dir = os.path.join(_ROOT, "web", "public", "data")
    if os.path.exists(os.path.join(_ROOT, "web")):
        os.makedirs(web_public_dir, exist_ok=True)
        web_out = os.path.join(web_public_dir, "analysis.json")
        with open(web_out, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=1)
        print(f"written {web_out}")

    print(json.dumps(result, ensure_ascii=False)[:600])


if __name__ == "__main__":
    main()
