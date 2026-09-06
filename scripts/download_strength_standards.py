#!/usr/bin/env python3
"""
Scrapes strength standards from strengthlevel.com and downloads exercise icons and GIFs.
Outputs:
  - data/strength_standards.json
  - web/src/data/strengthStandards.json
  - web/public/exercises/*.png
  - web/public/exercises/*.gif
"""

import json
import os
import re
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
WEB_DATA_DIR = os.path.join(ROOT, "web", "src", "data")
PUBLIC_EXERCISES_DIR = os.path.join(ROOT, "web", "public", "exercises")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(WEB_DATA_DIR, exist_ok=True)
os.makedirs(PUBLIC_EXERCISES_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

EXERCISES = {
    "bench-press": {
        "key": "bench_press",
        "name_en": "Bench Press",
        "name_zh": "杠铃卧推",
        "url": "https://strengthlevel.com/strength-standards/bench-press",
        "icon_url": "https://static.strengthlevel.com/images/exercises/bench-press/icons/bench-press-icon-128.png",
        "gif_url": "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0025-EIeI8Vf.gif",
        "aliases": ["杠铃卧推", "卧推", "Bench Press"],
    },
    "barbell-row": {
        "key": "barbell_row",
        "name_en": "Barbell Row",
        "name_zh": "杠铃划船",
        "url": "https://strengthlevel.com/strength-standards/bent-over-row",
        "icon_url": "https://static.strengthlevel.com/images/exercises/bent-over-row/icons/bent-over-row-icon-128.png",
        "gif_url": "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0027-eZyBC3j.gif",
        "aliases": ["杠铃划船", "俯身杠铃划船", "Barbell Row"],
    },
    "squat": {
        "key": "squat",
        "name_en": "Squat",
        "name_zh": "深蹲",
        "url": "https://strengthlevel.com/strength-standards/squat",
        "icon_url": "https://static.strengthlevel.com/images/exercises/squat/icons/squat-icon-128.png",
        "gif_url": "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0043-qXTaZnJ.gif",
        "aliases": ["深蹲", "杠铃深蹲", "Squat"],
    },
    "shoulder-press": {
        "key": "shoulder_press",
        "name_en": "Barbell Shoulder Press",
        "name_zh": "站姿杠铃推举",
        "url": "https://strengthlevel.com/strength-standards/shoulder-press",
        "icon_url": "https://static.strengthlevel.com/images/exercises/shoulder-press/icons/shoulder-press-icon-128.png",
        "gif_url": "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/1456-wdRZISl.gif",
        "aliases": ["站姿杠铃推举", "杠铃推举", "推举", "肩推", "Barbell Shoulder Press"],
    },
    "deadlift": {
        "key": "deadlift",
        "name_en": "Deadlift",
        "name_zh": "硬拉 / 罗马尼亚硬拉",
        "url": "https://strengthlevel.com/strength-standards/deadlift",
        "icon_url": "https://static.strengthlevel.com/images/exercises/deadlift/icons/deadlift-icon-128.png",
        "gif_url": "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0032-ila4NZS.gif",
        "aliases": ["杠铃罗马尼亚硬拉", "罗马尼亚硬拉", "硬拉", "Deadlift"],
    },
}

PERCENTILE_LEVELS = {
    "beginner": {"percentile": 5, "name_en": "Beginner", "name_zh": "初学者", "desc_en": "Stronger than 5% of lifters", "desc_zh": "超越 5% 训练者，掌握标准动作训练超1个月"},
    "novice": {"percentile": 20, "name_en": "Novice", "name_zh": "新手", "desc_en": "Stronger than 20% of lifters", "desc_zh": "超越 20% 训练者，系统规律训练超6个月"},
    "intermediate": {"percentile": 50, "name_en": "Intermediate", "name_zh": "中级", "desc_en": "Stronger than 50% of lifters", "desc_zh": "超越 50% 训练者，规律训练超2年"},
    "advanced": {"percentile": 80, "name_en": "Advanced", "name_zh": "高级", "desc_en": "Stronger than 80% of lifters", "desc_zh": "超越 80% 训练者，持续进阶训练超5年"},
    "elite": {"percentile": 95, "name_en": "Elite", "name_zh": "精英", "desc_en": "Stronger than 95% of lifters", "desc_zh": "超越 95% 训练者，达到力量举/竞技水准"},
}

def parse_table_rows(html_table, first_col_name="BW"):
    rows = re.findall(r"<tr.*?>(.*?)</tr>", html_table, re.DOTALL)
    result = []
    for r in rows:
        cols = [re.sub(r"<.*?>", "", c).strip() for c in re.findall(r"<t[dh].*?>(.*?)</t[dh]>", r, re.DOTALL)]
        if cols and cols[0] != first_col_name:
            try:
                result.append({
                    "val": float(cols[0]),
                    "beginner": float(cols[1]),
                    "novice": float(cols[2]),
                    "intermediate": float(cols[3]),
                    "advanced": float(cols[4]),
                    "elite": float(cols[5]),
                })
            except Exception:
                continue
    return result

def fetch_exercise_standards(slug, info):
    print(f"Fetching standards for {slug}...")
    standards = {"by_weight_kg": [], "by_weight_lb": [], "by_age": []}

    # 1. Fetch KG standards
    try:
        req = urllib.request.Request(f"{info["url"]}/kg", headers=HEADERS)
        html_kg = urllib.request.urlopen(req, timeout=15).read().decode("utf-8")
        tables = re.findall(r"<table.*?</table>", html_kg, re.DOTALL)
        for t in tables:
            if "BW" in t and "Elite" in t and not standards["by_weight_kg"]:
                parsed = parse_table_rows(t, "BW")
                standards["by_weight_kg"] = [
                    {"bw_kg": r["val"], "beginner": r["beginner"], "novice": r["novice"], "intermediate": r["intermediate"], "advanced": r["advanced"], "elite": r["elite"]}
                    for r in parsed
                ]
            elif "Age" in t and "Elite" in t and not standards["by_age"]:
                parsed = parse_table_rows(t, "Age")
                standards["by_age"] = [
                    {"age": int(r["val"]), "beginner": r["beginner"], "novice": r["novice"], "intermediate": r["intermediate"], "advanced": r["advanced"], "elite": r["elite"]}
                    for r in parsed
                ]
    except Exception as e:
        print(f"Error fetching KG standards for {slug}: {e}")

    # 2. Fetch LB standards
    try:
        req = urllib.request.Request(f"{info["url"]}/lb", headers=HEADERS)
        html_lb = urllib.request.urlopen(req, timeout=15).read().decode("utf-8")
        tables = re.findall(r"<table.*?</table>", html_lb, re.DOTALL)
        for t in tables:
            if "BW" in t and "Elite" in t and not standards["by_weight_lb"]:
                parsed = parse_table_rows(t, "BW")
                standards["by_weight_lb"] = [
                    {"bw_lb": r["val"], "beginner": r["beginner"], "novice": r["novice"], "intermediate": r["intermediate"], "advanced": r["advanced"], "elite": r["elite"]}
                    for r in parsed
                ]
                break
    except Exception as e:
        print(f"Error fetching LB standards for {slug}: {e}")

    return standards

def download_asset(url, dest_path):
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1000:
        print(f"  Asset already exists: {os.path.basename(dest_path)}")
        return True
    try:
        print(f"  Downloading {url} -> {os.path.basename(dest_path)}...")
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=20) as resp, open(dest_path, "wb") as out:
            out.write(resp.read())
        return True
    except Exception as e:
        print(f"  Failed downloading {url}: {e}")
        return False

def main():
    standards_data = {
        "levels": PERCENTILE_LEVELS,
        "exercises": {},
    }

    for slug, info in EXERCISES.items():
        std = fetch_exercise_standards(slug, info)

        icon_filename = f"{info["key"]}.png"
        icon_dest = os.path.join(PUBLIC_EXERCISES_DIR, icon_filename)
        download_asset(info["icon_url"], icon_dest)

        gif_filename = f"{info["key"]}.gif"
        gif_dest = os.path.join(PUBLIC_EXERCISES_DIR, gif_filename)
        download_asset(info["gif_url"], gif_dest)

        standards_data["exercises"][info["key"]] = {
            "key": info["key"],
            "slug": slug,
            "name_en": info["name_en"],
            "name_zh": info["name_zh"],
            "icon": f"/exercises/{icon_filename}",
            "gif": f"/exercises/{gif_filename}",
            "aliases": info["aliases"],
            "standards": std,
        }

    out_file1 = os.path.join(DATA_DIR, "strength_standards.json")
    with open(out_file1, "w", encoding="utf-8") as f:
        json.dump(standards_data, f, indent=2, ensure_ascii=False)
    print(f"Wrote standards to {out_file1}")

    out_file2 = os.path.join(WEB_DATA_DIR, "strengthStandards.json")
    with open(out_file2, "w", encoding="utf-8") as f:
        json.dump(standards_data, f, indent=2, ensure_ascii=False)
    print(f"Wrote standards to {out_file2}")

if __name__ == "__main__":
    main()
