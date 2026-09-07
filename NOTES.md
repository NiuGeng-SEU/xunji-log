# Product Roadmap & Future Features (开发笔记与后续规划)

This document outlines upcoming feature initiatives and design specifications for **Xunji Workout Dashboard** (`workout.gengniu.org`).

---

## 📋 Feature Pipeline Overview

| # | Feature Area | Description | Priority |
|---|---|---|---|
| 1 | **Fitness, Fatigue & Form (TSB Model)** | Banister impulse-response model tracking CTL, ATL, and TSB curves over time | High |
| 2 | **Powerlifting "Big Three" (SBD) Analytics** | Absolute & relative strength metrics (Strength-to-Weight, Wilks, DOTS, e1RM) | High |
| 3 | **Smart Workout Predictor & Recommendation** | Periodized next-session prescription (weights, sets, reps, target RPE) | High |
| 4 | **Mobile-First Experience & PWA** | Responsive layout optimization, touch interactions, and offline PWA support | Medium |

---

## 1. Fitness, Fatigue, and Form (Performance Management Chart)

### Background & Objective
Adapt the classical **Banister Impulse-Response Fitness-Fatigue Model** (widely used in platforms like TrainingPeaks, Strava Fitness & Freshness, and Intervals.icu) to strength training and hybrid cardio loads.

### Core Metrics & Mathematical Formulations
- **Chronic Training Load (CTL / "Fitness")**:
  - Represents long-term accumulated training base.
  - Calculated as an Exponentially Weighted Moving Average (EWMA) over a **42-day** time constant ($\tau_1 = 42$):
    $$CTL_t = CTL_{t-1} + \frac{\text{DailyLoad}_t - CTL_{t-1}}{42}$$
- **Acute Training Load (ATL / "Fatigue")**:
  - Represents short-term fatigue and systemic training stress.
  - Calculated as an EWMA over a **7-day** time constant ($\tau_2 = 7$):
    $$ATL_t = ATL_{t-1} + \frac{\text{DailyLoad}_t - ATL_{t-1}}{7}$$
- **Training Stress Balance (TSB / "Form" or "Readiness")**:
  - Quantifies the balance between accumulated fitness and lingering fatigue:
    $$TSB_t = CTL_{t-1} - ATL_{t-1}$$
  - **Zone Interpretation**:
    - $TSB > +15$: High freshness / potential detraining transition.
    - $-10 \le TSB \le +10$: Optimal performance / competition peak zone.
    - $-30 \le TSB < -10$: Productive training overload zone.
    - $TSB < -30$: High risk of overtraining, systemic CNS exhaustion, and injury.

### Implementation Scope
- Unified daily training impulse score combining strength volume load ($\sum \text{weight} \times \text{reps} \times \text{intensity}$) and cardio load (TRIMP / heart-rate zone impulse).
- Interactive multi-line time-series chart with shaded risk and readiness zones.

---

## 2. Powerlifting "Big Three" (SBD) PR Suite & Relative Strength Metrics

### Background & Objective
Provide dedicated analytics for the three cornerstone powerlifting movements: **Squat, Bench Press, and Deadlift (SBD)**, normalizing raw absolute weight against athlete bodyweight.

### Key Metrics & Calculations
1. **Absolute Milestones**:
   - Individual 1RM / PR records for Squat, Bench Press, and Deadlift.
   - **Big Three Total (SBD Total)**:
     $$\text{Total} = \text{Squat}_{\text{max}} + \text{Bench}_{\text{max}} + \text{Deadlift}_{\text{max}}$$
2. **Bodyweight-Relative Strength Ratios**:
   - **Total-to-Bodyweight Ratio**:
     $$\text{Ratio} = \frac{\text{Big Three Total}}{\text{Bodyweight}}$$
   - **Per-Lift Coefficients**:
     - $\text{Squat} / \text{BW}$ (e.g., target $1.5\times$ to $2.0\times$ BW)
     - $\text{Bench} / \text{BW}$ (e.g., target $1.2\times$ to $1.5\times$ BW)
     - $\text{Deadlift} / \text{BW}$ (e.g., target $2.0\times$ to $2.5\times$ BW)
3. **Normalized Powerlifting Formulas**:
   - **DOTS Score** & **Wilks 2.0 Score**: Standardized coefficients adjusting for gender and bodyweight non-linearities.
   - **IPF GL Points**: International Powerlifting Federation official scoring.
4. **Estimated 1RM (e1RM) Progression**:
   - Automatically estimate 1RM from submaximal working sets using Brzycki and Epley equations:
     $$\text{e1RM}_{\text{Epley}} = w \times \left(1 + \frac{r}{30}\right), \quad \text{e1RM}_{\text{Brzycki}} = w \times \frac{36}{37 - r}$$

---

## 3. Intelligent Next-Session Predictor & Workout Recommendations

### Background & Objective
Replace static guess-work with an automated, periodization-aware recommendation engine that suggests what to lift, how heavy, and for how many sets/reps in the upcoming session.

### Functional Capabilities
- **Split & Muscle Recovery Tracking**:
  - Tracks days elapsed since each muscle group was last trained (Chest, Back, Legs, Delts, Arms, Core).
  - Flags muscle groups that are fully recovered vs. those still in the recovery window.
- **Dynamic Load & Set/Rep Prescription**:
  - Based on the user's current progression scheme (e.g. Daily Undulating Periodization / DUP, Linear Overload, or 5/3/1):
    - Recommends target exercises for the session (e.g., Squat + Leg Curls + Calves).
    - Prescribes target working weight (e.g., $+2.5\text{ lbs} / 1.25\text{ kg}$ incremental increase over prior successful session).
    - Recommends target set/rep schemes (e.g., $3 \times 5$ @ RPE 8, or $4 \times 8$ @ RPE 7.5).
- **Autoregulation & Deload Trigger**:
  - If recent sessions reflect plateauing or declining volume/RPE (or if TSB dips into excessive fatigue), automatically suggest an autoregulated deload week (cutting volume by $40\text{--}50\%$ and intensity by $15\text{--}20\%$).

---

## 4. Mobile-First Responsive Design & PWA Support

### Background & Objective
Ensure seamless accessibility and swift interactions on smartphones and tablets directly at the gym.

### Implementation Scope
- **Responsive Layout Overhaul**:
  - Compact cards with clean typography and optimized whitespace for mobile viewports ($< 768\text{px}$).
  - Touch-optimized chart interactions (pinch-to-zoom, tap-to-inspect tooltips without cursor hovering).
  - Bottom navigation bar or collapsible sliding drawer for effortless thumb navigation.
- **Progressive Web App (PWA)**:
  - Add Web App Manifest (`manifest.json`) for "Add to Home Screen" standalone app capability.
  - Service Worker implementation for offline caching of analysis data and instant load times.
- **Quick In-Gym Reference View**:
  - A lightweight, fast-loading mobile view tailored for reviewing the current day's target weights, rest timers, and past set history while on the gym floor.
