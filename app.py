import streamlit as st
import pandas as pd
import hashlib
from supabase import create_client, Client
import plotly.graph_objects as go
from datetime import datetime

# ─── Page Config ────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="向怡診所 - 個人健康儀表板",
    layout="wide",
    page_icon="🏥",
    initial_sidebar_state="collapsed",
)

# ─── Secrets ────────────────────────────────────────────────────────────────
try:
    SUPABASE_URL = st.secrets["SUPABASE_URL"]
    SUPABASE_KEY = st.secrets["SUPABASE_KEY"]
    CLINIC_SECRET = st.secrets["CLINIC_SECRET"]
except Exception:
    st.error("系統設定錯誤：遺失環境變數。請聯絡診所管理員。")
    st.stop()

@st.cache_resource
def init_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)

supabase = init_supabase()

# ─── Dark / Light Mode State ────────────────────────────────────────────────
if "dark_mode" not in st.session_state:
    st.session_state.dark_mode = True  # default: dark

# ─── Theme Tokens ────────────────────────────────────────────────────────────
def get_theme():
    if st.session_state.dark_mode:
        return {
            "bg":           "#0f172a",
            "surface":      "#1e293b",
            "surface2":     "#263348",
            "border":       "rgba(255,255,255,0.08)",
            "text":         "#e2e8f0",
            "subtext":      "#94a3b8",
            "accent":       "#4ECDC4",
            "accent_dim":   "rgba(78,205,196,0.12)",
            "comment_bg":   "rgba(78,205,196,0.08)",
            "comment_border": "rgba(78,205,196,0.25)",
            "grid":         "rgba(255,255,255,0.07)",
            "plotbg":       "rgba(0,0,0,0)",
            "chart_text":   "#cbd5e1",
            "toggle_icon":  "☀️",
            "toggle_label": "切換亮色",
        }
    else:
        return {
            "bg":           "#f0f4f8",
            "surface":      "#ffffff",
            "surface2":     "#f8fafc",
            "border":       "rgba(0,0,0,0.08)",
            "text":         "#1e293b",
            "subtext":      "#64748b",
            "accent":       "#0d9488",
            "accent_dim":   "rgba(13,148,136,0.10)",
            "comment_bg":   "rgba(13,148,136,0.07)",
            "comment_border": "rgba(13,148,136,0.30)",
            "grid":         "rgba(0,0,0,0.06)",
            "plotbg":       "rgba(0,0,0,0)",
            "chart_text":   "#475569",
            "toggle_icon":  "🌙",
            "toggle_label": "切換深色",
        }

# ─── Global CSS Injection ────────────────────────────────────────────────────
def inject_css(t):
    st.markdown(f"""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    /* ── Reset & Base ── */
    html, body, [data-testid="stAppViewContainer"],
    [data-testid="stMain"], section.main {{
        background-color: {t['bg']} !important;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        color: {t['text']};
        transition: background 0.3s ease, color 0.3s ease;
    }}
    [data-testid="stHeader"] {{ background: transparent !important; }}
    [data-testid="stSidebar"] {{ display: none !important; }}
    footer {{ display: none !important; }}

    /* ── Streamlit element overrides ── */
    div[data-testid="stMarkdownContainer"] p,
    div[data-testid="stMarkdownContainer"] span,
    div[data-testid="stCaptionContainer"] {{ color: {t['subtext']}; }}
    div[data-testid="InputInstructions"] {{ display: none !important; }}
    .stAlert {{ border-radius: 12px; }}
    button[kind="primary"] {{
        background: {t['accent']} !important;
        border: none !important;
        border-radius: 10px !important;
        font-weight: 700 !important;
        transition: opacity 0.2s;
    }}
    button[kind="primary"]:hover {{ opacity: 0.85; }}

    /* ── Layout wrapper ── */
    .portal-wrap {{
        max-width: 1100px;
        margin: 0 auto;
        padding: 1.5rem 1.2rem 3rem;
    }}

    /* ── Header bar ── */
    .portal-header {{
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 0 1.5rem;
        border-bottom: 2px solid {t['accent_dim']};
        margin-bottom: 1.8rem;
    }}
    .portal-header-left {{ display: flex; flex-direction: column; }}
    .portal-clinic-name {{
        font-size: 1.5rem;
        font-weight: 800;
        color: {t['accent']};
        letter-spacing: -0.5px;
    }}
    .portal-subtitle {{
        font-size: 1.15rem;
        font-weight: 500;
        color: {t['text']};
        margin-top: 5px;
    }}

    /* ── Group card ── */
    .group-card {{
        background: {t['surface']};
        border: 1px solid {t['border']};
        border-radius: 20px;
        padding: 1.4rem 1.6rem 1.2rem;
        margin-bottom: 1.6rem;
        box-shadow: 0 4px 24px rgba(0,0,0,0.07);
        transition: background 0.3s ease;
    }}
    .group-header {{
        margin-bottom: 1.1rem;
    }}
    .group-title {{
        font-size: 1.25rem;
        font-weight: 700;
        color: {t['text']};
        border-left: 4px solid {t['accent']};
        padding-left: 12px;
        margin-bottom: 0.7rem;
    }}
    .group-summary {{
        background: {t['comment_bg']};
        border: 1px solid {t['comment_border']};
        border-radius: 10px;
        padding: 0.7rem 1rem;
        font-size: 1.08rem;
        line-height: 1.85;
        color: {t['text']};
        margin-bottom: 0.9rem;
    }}
    .group-summary-label {{
        font-weight: 700;
        color: {t['accent']};
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 0.35rem;
    }}
    .comment-line {{ color: {t['text']}; }}
    .status-good  {{ color: #22c55e; font-weight: 600; }}
    .status-high  {{ color: #f97316; font-weight: 600; }}
    .status-low   {{ color: #3b82f6; font-weight: 600; }}

    /* ── Data update badge ── */
    .update-badge {{
        display: inline-flex; align-items: center; gap: 6px;
        background: {t['accent_dim']};
        border: 1px solid {t['comment_border']};
        color: {t['accent']};
        border-radius: 999px;
        padding: 4px 14px;
        font-size: 0.85rem;
        font-weight: 600;
        margin-bottom: 1.5rem;
    }}

    /* ── Expander (Historical Reports) ── */
    div[data-testid="stExpanderDetails"] p,
    div[data-testid="stExpanderDetails"] li {{
        font-size: 1.08rem;
        line-height: 1.75;
        color: {t['text']};
    }}
    div[data-testid="stExpanderDetails"] mark {{
        background-color: rgba(255, 217, 61, 0.35);
        color: inherit;
        border-radius: 4px;
        padding: 0 4px;
    }}

    /* ── RWD: charts grid ── */
    .charts-grid {{
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5rem;
    }}
    @media (max-width: 768px) {{
        .charts-grid {{ grid-template-columns: 1fr; }}
        .portal-header {{ flex-direction: column; align-items: flex-start; gap: 0.8rem; }}
        .portal-wrap {{ padding: 1rem 0.7rem 3rem; }}
    }}

    /* ── Login page ── */
    [data-testid="stForm"] {{
        background: {t['surface']} !important;
        border: 1px solid {t['border']} !important;
        border-radius: 24px !important;
        padding: 2.5rem 2.2rem !important;
        box-shadow: 0 20px 60px rgba(0,0,0,0.18) !important;
    }}
    .login-icon {{ font-size: 3rem; margin-bottom: 0.5rem; text-align: center; }}
    .login-title {{
        font-size: 1.6rem;
        font-weight: 800;
        color: {t['accent']};
        margin-bottom: 0.3rem;
        text-align: center;
    }}
    .login-sub {{
        font-size: 0.85rem;
        color: {t['subtext']};
        margin-bottom: 1.8rem;
        line-height: 1.6;
        text-align: center;
    }}

    /* ── Streamlit input overrides ── */
    div[data-testid="stTextInput"] input {{
        background: {t['surface2']} !important;
        color: {t['text']} !important;
        border: 1.5px solid {t['border']} !important;
        border-radius: 10px !important;
        font-size: 1rem !important;
        text-align: center;
    }}
    div[data-testid="stTextInput"] input:focus {{
        border-color: {t['accent']} !important;
        box-shadow: 0 0 0 3px {t['accent_dim']} !important;
    }}
    div[data-testid="stTextInput"] label {{ color: {t['subtext']} !important; text-align: left; }}

    /* ── No data placeholder ── */
    .no-data {{
        text-align: center;
        padding: 2rem;
        color: {t['subtext']};
        font-size: 0.9rem;
    }}

    /* ── Metric label ── */
    .metric-label {{
        font-size: 0.82rem;
        font-weight: 600;
        color: {t['subtext']};
        text-align: center;
        margin-bottom: -0.3rem;
    }}
    </style>
    """, unsafe_allow_html=True)

# ─── Hashing & Security ──────────────────────────────────────────────────────
def get_hash_id(national_id: str) -> str:
    nid = str(national_id).upper().strip()
    payload = f"{nid}_{CLINIC_SECRET}"
    return hashlib.sha256(payload.encode()).hexdigest()

def get_temp_pw_hash(mobile_last4: str) -> str:
    mob = str(mobile_last4).strip()
    payload = f"{mob}_{CLINIC_SECRET}"
    return hashlib.sha256(payload.encode()).hexdigest()

def _hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if salt is None:
        import os
        salt = os.urandom(16).hex()
    hashed = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
    return hashed, salt

def verify_custom_password(plain: str, stored_hash: str, salt: str) -> bool:
    h, _ = _hash_password(plain, salt)
    return h == stored_hash

@st.cache_data(ttl=300)
def load_clinical_rules() -> dict:
    try:
        resp = supabase.table("cloud_clinical_rules").select("rule_key,rule_value,unit").execute()
        rules = {}
        if resp.data:
            for row in resp.data:
                rules[row["rule_key"]] = {"raw": row["rule_value"], "unit": row["unit"]}
        return rules
    except Exception:
        return {}

def parse_rule_range(rule_str: str) -> tuple | None:
    rule_str = str(rule_str).strip()
    try:
        if "-" in rule_str and not rule_str.startswith("-"):
            parts = rule_str.split("-")
            return float(parts[0]), float(parts[1])
        if rule_str.startswith("<"):
            return 0.0, float(rule_str.replace("<=", "").replace("<", "").strip())
        if rule_str.startswith(">"):
            return float(rule_str.replace(">=", "").replace(">", "").strip()), None
    except Exception:
        pass
    return None

# ─── Clinical Groups Definition ─────────────────────────────────────────────
# rule_key 的名稱對應 SQLite ClinicalRules 表的 rule_key 欄位
# target_range 作為 fallback（當 Supabase 尚無資料時使用）
BASE_GROUPS = [
    {
        "id": "nutrition",
        "title": "🥗 1. 營養與代謝",
        "metrics": [
            {"key": "09038C", "label": "白蛋白 (Albumin)",     "unit": "g/dL",  "rule_key": "albumin_target",   "target_range": (3.8, 5.0)},
            {"key": "09002C", "label": "尿素氮 (BUN)",          "unit": "mg/dL", "target_range": None, "bun_mode": True},
            {"key": "09015C", "label": "肌酸酐 (Creatinine)",   "unit": "mg/dL", "target_range": None},
            {"key": "09022C", "label": "血鉀 (Potassium)",      "unit": "mEq/L", "rule_key": "potassium_target", "target_range": (3.5, 5.5)},
        ],
    },
    {
        "id": "ckd_mbd",
        "title": "🦴 2. 鈣磷代謝 (CKD-MBD)",
        "metrics": [
            {"key": "09012C",      "label": "血磷 (Phosphorus)",  "unit": "mg/dL", "rule_key": "phosphorus_target",    "target_range": (3.5, 5.5)},
            {"key": "09011C",      "label": "血鈣 (Calcium)",      "unit": "mg/dL", "rule_key": "calcium_target",       "target_range": (8.4, 10.2)},
            {"key": "CaP_product", "label": "鈣磷乘積 (Ca × P)",  "unit": "",       "rule_key": "ca_p_product_target",  "target_range": (0, 55)},
            {"key": "09122C",      "label": "副甲狀腺素 (i-PTH)", "unit": "pg/mL", "rule_key": "intact-PTH",           "target_range": (150, 600)},
            {"key": "09027C",      "label": "鹼性磷酸酶 (ALP)",   "unit": "U/L",   "rule_key": "alp_target",           "target_range": (40, 130)},
        ],
    },
    {
        "id": "anemia",
        "title": "🩸 3. 造血與鐵質 (Anemia)",
        "metrics": [
            {"key": "08003C", "label": "血色素 (Hb)",       "unit": "g/dL",  "rule_key": "hb_target_dialysis", "target_range": (10.0, 11.5)},
            {"key": "12116C", "label": "鐵蛋白 (Ferritin)", "unit": "ng/mL", "rule_key": "ferritin_target",    "target_range": (200, 800)},
            {"key": "Tsat",   "label": "鐵飽和度 (TSAT%)",  "unit": "%",     "rule_key": "tsat_target",        "target_range": (20, 50)},
        ],
    },
]


def get_groups():
    """Build GROUPS list, overriding target_range and unit from cloud_clinical_rules if available."""
    rules = load_clinical_rules()
    import copy
    groups = []
    for bg in BASE_GROUPS:
        g = copy.deepcopy(bg)
        for m in g["metrics"]:
            rkey = m.get("rule_key")
            if rkey and rkey in rules:
                raw = rules[rkey]["raw"]
                unit = rules[rkey].get("unit", "")
                if unit:
                    m["unit"] = unit
                parsed = parse_rule_range(raw)
                if parsed:
                    lo, hi = parsed
                    # For ‘<N’ rules, lo=0 so we can draw a standard colour band
                    if hi is None:
                        # ‘>N’ rule — keep fallback target_range as-is; no universal way to draw
                        pass
                    else:
                        m["target_range"] = (lo if lo is not None else 0, hi)
        groups.append(g)
    return groups

PALETTE = ["#4ECDC4", "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#F2A65A", "#C77DFF"]

# ─── Helpers ─────────────────────────────────────────────────────────────────
def evaluate_status(value: float, lo, hi) -> str:
    if lo is not None and hi is not None:
        if value < lo:   return "偏低"
        if value > hi:   return "偏高"
        return "達標"
    if hi is not None and value > hi:  return "偏高"
    if lo is not None and value < lo:  return "偏低"
    return ""

def status_class(s: str) -> str:
    return {"達標": "status-good", "偏高": "status-high", "偏低": "status-low"}.get(s, "")

def generate_comment_html(metrics_with_data: list) -> str:
    lines = []
    for m in metrics_with_data:
        vals   = m["values"]
        label  = m["label"]
        tr     = m["target_range"]
        if vals is None or len(vals) == 0:
            lines.append(f'<span class="comment-line">・{label}：本期無資料</span>')
            continue
        latest = vals.iloc[-1]
        trend  = ""
        if len(vals) >= 2:
            diff = latest - vals.iloc[-2]
            if abs(diff) < 0.01 * max(abs(latest), 0.001):
                trend = "→ 穩定"
            elif diff > 0:
                trend = f"↑ (+{diff:.1f})"
            else:
                trend = f"↓ ({diff:.1f})"
        status_str = ""
        if tr:
            lo, hi = tr[0], tr[1]
            s = evaluate_status(latest, lo, hi)
            if s:
                cls = status_class(s)
                status_str = f'<span class="{cls}">【{s}】</span>'
        lines.append(f'<span class="comment-line">・{label}：最新 <b>{latest:.1f}</b>　{trend} {status_str}</span>')
    return "<br>".join(lines)

def build_chart(metric, data: pd.DataFrame, color: str, t: dict):
    sub = data[data["nhi_code"] == metric["key"]].copy()
    if sub.empty:
        return None, None
    sub = sub.sort_values("visit_date")

    bun_mode = metric.get("bun_mode", False)
    tr = metric.get("target_range")
    lo, hi = (tr[0], tr[1]) if tr else (None, None)
    fig = go.Figure()

    if bun_mode:
        # 洗前 = 同日最高值；洗後 = 同日最低值
        grouped    = sub.groupby("visit_date")["test_result_numeric"]
        pre_vals   = grouped.max().reset_index()
        post_vals  = grouped.min().reset_index()
        pre_vals.columns  = ["visit_date", "value"]
        post_vals.columns = ["visit_date", "value"]

        # 只有真正有兩筆的日期才顯示洗後
        multi_day         = grouped.count()[grouped.count() > 1].index
        post_vals_filtered = post_vals[post_vals["visit_date"].isin(multi_day)]

        fig.add_trace(go.Scatter(
            x=pre_vals["visit_date"].dt.strftime("%m/%d").tolist(),
            y=pre_vals["value"].astype(float).tolist(),
            mode="lines+markers+text",
            name="BUN 洗前",
            text=[f"{v:.1f}" for v in pre_vals["value"]],
            textposition="top center",
            textfont=dict(size=10, color=t["chart_text"]),
            line=dict(color=color, width=2.5),
            marker=dict(symbol="circle", size=8, color=color),
        ))
        if not post_vals_filtered.empty:
            fig.add_trace(go.Scatter(
                x=post_vals_filtered["visit_date"].dt.strftime("%m/%d").tolist(),
                y=post_vals_filtered["value"].astype(float).tolist(),
                mode="markers+text",
                name="BUN 洗後",
                text=[f"{v:.1f}" for v in post_vals_filtered["value"]],
                textposition="bottom center",
                textfont=dict(size=10, color="#FFD93D"),
                marker=dict(symbol="triangle-down", size=9, color="#FFD93D"),
            ))
        all_y   = pre_vals["value"].tolist()
        if not post_vals_filtered.empty:
            all_y += post_vals_filtered["value"].tolist()
        series_for_comment = pre_vals["value"]
    else:
        agg = sub.groupby("visit_date")["test_result_numeric"].mean().reset_index()
        agg.columns = ["visit_date", "value"]
        fig.add_trace(go.Scatter(
            x=agg["visit_date"].dt.strftime("%m/%d").tolist(),
            y=agg["value"].astype(float).tolist(),
            mode="lines+markers+text",
            name=metric["label"],
            text=[f"{v:.1f}" for v in agg["value"]],
            textposition="top center",
            textfont=dict(size=11, color=t["chart_text"]),
            line=dict(color=color, width=2.5),
            marker=dict(symbol="circle", size=8, color=color),
        ))
        all_y  = agg["value"].tolist()
        series_for_comment = agg["value"]

    # Target range shading
    if lo is not None and hi is not None:
        annot_txt = f"目標 <{hi}" if lo == 0 else f"目標 {lo}\u2013{hi}"
        fig.add_hrect(y0=lo, y1=hi,
                      fillcolor="rgba(78,205,196,0.10)", line_width=0,
                      annotation_text=annot_txt,
                      annotation_position="top left",
                      annotation_font_size=10,
                      annotation_font_color=t["accent"])

    v_min = min(all_y + ([lo] if lo else []))
    v_max = max(all_y + ([hi] if hi else []))
    span  = max(v_max - v_min, 2.0)
    fig.update_layout(
        height=230,
        margin=dict(l=10, r=10, t=28, b=30),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family="'Inter',sans-serif", color=t["chart_text"]),
        xaxis=dict(gridcolor=t["grid"], tickfont=dict(size=10, color=t["subtext"]),
                   linecolor=t["grid"], fixedrange=True),
        yaxis=dict(gridcolor=t["grid"], linecolor=t["grid"],
                   range=[v_min - span*0.35, v_max + span*0.45],
                   tickfont=dict(size=10, color=t["subtext"]),
                   fixedrange=True, zeroline=False),
        showlegend=bun_mode,
        legend=dict(orientation="h", yanchor="bottom", y=1.02,
                    xanchor="right", x=1,
                    font=dict(size=10, color=t["subtext"])),
        hovermode="x unified",
        hoverlabel=dict(bgcolor=t["surface"], font_size=12, font_color=t["text"]),
    )
    return fig, series_for_comment

# ─── Session init ─────────────────────────────────────────────────────────────
if "logged_in" not in st.session_state:
    st.session_state.logged_in   = False
    st.session_state.cloud_id    = None
    st.session_state.trend_data  = None
    st.session_state.last_updated = None
    st.session_state.display_name = None
    st.session_state.historical_reports = None
    st.session_state.forgot_pw_mode = False

t = get_theme()
inject_css(t)

# ══════════════════════════════════════════════════════════════════════
# LOGIN PAGE
# ══════════════════════════════════════════════════════════════════════
if not st.session_state.logged_in:
    with st.container():
        col1, col2, col3 = st.columns([1, 1.5, 1])
        with col2:
            col_t1, col_t2 = st.columns([5, 1])
            with col_t2:
                if st.button(t["toggle_icon"], help=t["toggle_label"], key="theme_login"):
                    st.session_state.dark_mode = not st.session_state.dark_mode
                    st.rerun()

            if not st.session_state.forgot_pw_mode:
                # ── Normal Login Form ──
                with st.form("login_form"):
                    st.markdown(f"""
                    <div>
                        <div class="login-icon">🏥</div>
                        <div class="login-title">向怡診所</div>
                        <div class="login-sub">請輸入您的身分驗證資料<br>預設密碼為手機末四碼</div>
                    </div>
                    """, unsafe_allow_html=True)
                    national_id   = st.text_input("身分證字號", placeholder="例如：A123456789")
                    password      = st.text_input("密碼", placeholder="請輸入密碼", type="password")
                    submitted     = st.form_submit_button("🔓 登入並查看報告", use_container_width=True, type="primary")
                    
                    if submitted:
                        if not national_id or not password:
                            st.error("請完整填寫身分證字號與密碼。")
                        else:
                            with st.spinner("安全驗證中…"):
                                cloud_id = get_hash_id(national_id)
                                try:
                                    resp = supabase.table("cloud_patients").select("*").eq("cloud_id", cloud_id).execute()
                                    if resp.data:
                                        user_data = resp.data[0]
                                        valid = False
                                        
                                        # 1. 優先檢查自訂密碼
                                        if user_data.get("password_hash"):
                                            valid = verify_custom_password(password, user_data["password_hash"], user_data.get("salt", ""))
                                        else:
                                            # 2. 檢查預設手機末四碼
                                            expected_temp = get_temp_pw_hash(password)
                                            if expected_temp == user_data.get("temp_pw_hash"):
                                                valid = True
                                        
                                        if valid:
                                            st.session_state.cloud_id     = cloud_id
                                            st.session_state.trend_data   = user_data.get("trend_data")
                                            st.session_state.last_updated = user_data.get("last_updated")
                                            st.session_state.display_name = user_data.get("display_name", "")
                                            st.session_state.historical_reports = user_data.get("historical_reports", [])
                                            st.session_state.logged_in    = True
                                            st.rerun()
                                        else:
                                            st.error("密碼錯誤，請重新輸入。")
                                    else:
                                        st.error("找不到相符的資料，請確認輸入是否正確。")
                                except Exception as e:
                                    st.error(f"系統連線錯誤：{e}")
                
                if st.button("忘記密碼？", key="btn_forgot"):
                    st.session_state.forgot_pw_mode = True
                    st.rerun()

            else:
                # ── Forgot Password Form ──
                with st.form("forgot_pw_form"):
                    st.markdown(f"""
                    <div>
                        <div class="login-icon">🔑</div>
                        <div class="login-title">重設密碼</div>
                        <div class="login-sub">請驗證身分資料以重設您的密碼</div>
                    </div>
                    """, unsafe_allow_html=True)
                    national_id = st.text_input("身分證字號", placeholder="例如：A123456789")
                    birth_date  = st.date_input("出生年月日", min_value=datetime(1900, 1, 1), max_value=datetime.now())
                    new_pw      = st.text_input("設定新密碼 (至少 6 碼)", type="password")
                    new_pw2     = st.text_input("再次輸入新密碼", type="password")
                    submitted   = st.form_submit_button("確認重設密碼", use_container_width=True, type="primary")

                    if submitted:
                        if len(new_pw) < 6:
                            st.error("新密碼長度不足。")
                        elif new_pw != new_pw2:
                            st.error("兩次輸入的密碼不相符。")
                        else:
                            cloud_id = get_hash_id(national_id)
                            # 驗證身分證與完整生日
                            resp = supabase.table("cloud_patients").select("birth_date").eq("cloud_id", cloud_id).execute()
                            if resp.data:
                                db_birth = str(resp.data[0].get("birth_date", ""))
                                if db_birth == birth_date.strftime("%Y-%m-%d"):
                                    hashed, salt = _hash_password(new_pw)
                                    supabase.table("cloud_patients").update({
                                        "password_hash": hashed,
                                        "salt": salt
                                    }).eq("cloud_id", cloud_id).execute()
                                    st.success("✅ 密碼重設成功！請重新登入。")
                                    st.session_state.forgot_pw_mode = False
                                else:
                                    st.error("驗證資料不符，請確認身分證與出生年月日。")
                            else:
                                st.error("找不到相符的帳號資料。")
                
                if st.button("返回登入", key="btn_back"):
                    st.session_state.forgot_pw_mode = False
                    st.rerun()

    st.stop()

# ══════════════════════════════════════════════════════════════════════
# DASHBOARD (LOGGED IN)
# ══════════════════════════════════════════════════════════════════════
trend_data = st.session_state.trend_data
if not trend_data:
    st.info("您目前沒有近期的檢驗紀錄。")
    st.stop()

df = pd.DataFrame(trend_data)
if not df.empty and "visit_date" in df.columns:
    df["visit_date"]          = pd.to_datetime(df["visit_date"])
    df["test_result_numeric"] = pd.to_numeric(df["test_result_numeric"], errors="coerce")
    df = df.dropna(subset=["test_result_numeric"])

st.markdown('<div class="portal-wrap">', unsafe_allow_html=True)

# ── Header ──────────────────────────────────────────────────────────────────
greeting = f"{st.session_state.display_name}您好，" if st.session_state.display_name else ""
hdr_left, hdr_right = st.columns([5, 1])
with hdr_left:
    st.markdown(f"""
    <div class="portal-header">
        <div class="portal-header-left">
            <span class="portal-clinic-name">向怡診所</span>
            <span class="portal-subtitle">{greeting}這是您的個人健康趨勢儀表板</span>
        </div>
    </div>""", unsafe_allow_html=True)
with hdr_right:
    if st.button(t["toggle_icon"], help=t["toggle_label"], key="theme_dash"):
        st.session_state.dark_mode = not st.session_state.dark_mode
        st.rerun()
    if st.button("登出", key="logout_btn", use_container_width=True):
        st.session_state.logged_in   = False
        st.session_state.trend_data  = None
        st.session_state.last_updated = None
        st.session_state.display_name = None
        st.session_state.historical_reports = None
        st.rerun()

# ── Update badge ─────────────────────────────────────────────────────────────
try:
    last_updated = datetime.fromisoformat(st.session_state.last_updated).strftime('%Y-%m-%d %H:%M')
    st.markdown(f'<span class="update-badge">🔄 資料最後更新：{last_updated}</span>', unsafe_allow_html=True)
except Exception:
    pass

# ── Groups ───────────────────────────────────────────────────────────────────
for group in get_groups():


    metrics_with_data = []
    color_idx = 0
    for m in group["metrics"]:
        color = PALETTE[color_idx % len(PALETTE)]
        color_idx += 1
        fig, series = build_chart(m, df, color, t)
        if fig is not None:
            metrics_with_data.append({
                "label": m["label"],
                "unit":  m.get("unit", ""),
                "fig":   fig,
                "values": series,
                "target_range": m.get("target_range"),
            })

    if not metrics_with_data:
        st.markdown(f"""
        <div class="group-card">
            <div class="group-title">{group["title"]}</div>
            <div class="no-data">此區塊暫無近期檢驗資料。</div>
        </div>""", unsafe_allow_html=True)
        continue

    # ── Open the single group-card and render title + summary together ────────
    comment_html = generate_comment_html(metrics_with_data)
    st.markdown(f"""
    <div class="group-card">
        <div class="group-header">
            <div class="group-title">{group["title"]}</div>
            <div class="group-summary">
                <div class="group-summary-label">📝 本期追蹤摘要</div>
                {comment_html}
            </div>
        </div>
    """, unsafe_allow_html=True)

    # ── RWD chart grid — always 2 columns; single charts occupy left col only ──
    chunks = [metrics_with_data[i:i+2] for i in range(0, len(metrics_with_data), 2)]
    for chunk in chunks:
        col_left, col_right = st.columns(2)
        for idx, md in enumerate(chunk):
            target_col = col_left if idx == 0 else col_right
            with target_col:
                unit_str = f" <span style='color:{t['subtext']};font-size:0.77rem;'>({md['unit']})</span>" if md.get("unit") else ""
                st.markdown(f'<div class="metric-label">{md["label"]}{unit_str}</div>', unsafe_allow_html=True)
                st.plotly_chart(
                    md["fig"],
                    use_container_width=True,
                    config={"displayModeBar": False, "scrollZoom": False},
                    key=f"chart_{group['id']}_{md['label']}",
                )

    st.markdown('</div>', unsafe_allow_html=True)  # close group-card

# ── Historical Reports ───────────────────────────────────────────────────────
if st.session_state.historical_reports:
    st.markdown(f"""
    <div class="group-card">
        <div class="group-header">
            <div class="group-title">📚 歷史衛教報告</div>
            <div style="font-size: 0.85rem; color: {t['subtext']}; padding-left: 12px; margin-bottom: 1rem;">
                點擊下方月份，展開查看過往的追蹤短評紀錄。
            </div>
        </div>
    """, unsafe_allow_html=True)
    
    import re
    for r in st.session_state.historical_reports:
        with st.expander(f"📅 {r.get('report_month', '')}"):
            out_md = r.get('final_output', '')
            # 將 a. b. c. 轉換為無序列表的 -，以便 Streamlit markdown 正確渲染第二層級
            out_md = re.sub(r'^(\s+)[a-zA-Z]\.\s+', r'\1- ', out_md, flags=re.MULTILINE)
            st.markdown(out_md, unsafe_allow_html=True)
            
    st.markdown('</div>', unsafe_allow_html=True)

# ── Account Settings ─────────────────────────────────────────────────────────
with st.expander("⚙️ 帳號密碼設定"):
    st.markdown('<div style="padding: 10px 0;">', unsafe_allow_html=True)
    with st.form("change_pw_form_dash"):
        st.markdown("##### 修改登入密碼")
        curr_pw = st.text_input("輸入目前密碼", type="password")
        new_pw  = st.text_input("輸入新密碼 (至少 6 碼)", type="password")
        new_pw2 = st.text_input("再次輸入新密碼", type="password")
        submitted = st.form_submit_button("確認修改", type="primary")
        
        if submitted:
            if len(new_pw) < 6:
                st.error("新密碼長度不足。")
            elif new_pw != new_pw2:
                st.error("兩次輸入的密碼不相符。")
            else:
                # 驗證目前密碼
                cloud_id = st.session_state.cloud_id
                resp = supabase.table("cloud_patients").select("*").eq("cloud_id", cloud_id).execute()
                if resp.data:
                    user_data = resp.data[0]
                    valid = False
                    if user_data.get("password_hash"):
                        valid = verify_custom_password(curr_pw, user_data["password_hash"], user_data.get("salt", ""))
                    else:
                        expected_temp = get_temp_pw_hash(curr_pw)
                        if expected_temp == user_data.get("temp_pw_hash"):
                            valid = True
                    
                    if valid:
                        hashed, salt = _hash_password(new_pw)
                        supabase.table("cloud_patients").update({
                            "password_hash": hashed,
                            "salt": salt
                        }).eq("cloud_id", cloud_id).execute()
                        st.success("✅ 密碼修改成功！")
                    else:
                        st.error("目前密碼驗證失敗。")
    st.markdown('</div>', unsafe_allow_html=True)

# ── Footer ────────────────────────────────────────────────────────────────────
st.markdown(f"""
<div style="text-align:center; padding: 2rem 0 1rem; color:{t['subtext']}; font-size:0.78rem; border-top: 1px solid {t['border']}; margin-top: 1.5rem;">
    此儀表板由 NephroSystem 自動生成，供個人照護參考，請依醫囑進行治療。<br>
    © 向怡診所
</div>
""", unsafe_allow_html=True)

st.markdown('</div>', unsafe_allow_html=True)  # close portal-wrap
