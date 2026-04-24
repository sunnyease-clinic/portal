import streamlit as st
import pandas as pd
import hashlib
from supabase import create_client, Client
import plotly.graph_objects as go
from datetime import datetime

st.set_page_config(page_title="SunnyEase 診所 - 個人健康儀表板", layout="centered", page_icon="📈")

# ==========================================
# 核心設定與安全驗證
# ==========================================

# 從 Streamlit Cloud Secrets 讀取金鑰
try:
    SUPABASE_URL = st.secrets["SUPABASE_URL"]
    SUPABASE_KEY = st.secrets["SUPABASE_KEY"]
    CLINIC_SECRET = st.secrets["CLINIC_SECRET"]
except Exception as e:
    st.error("系統設定錯誤：遺失環境變數。請聯絡診所管理員。")
    st.stop()

@st.cache_resource
def init_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)

supabase = init_supabase()

def get_hash_id(national_id: str, mobile_last4: str) -> str:
    nid = str(national_id).upper().strip()
    mob = str(mobile_last4).strip()
    # 預設無手機碼處理，與同步腳本一致
    if not mob or len(mob) < 4:
        mob = "0000"
    payload = f"{nid}_{mob}_{CLINIC_SECRET}"
    return hashlib.sha256(payload.encode()).hexdigest()

# ==========================================
# 登入介面
# ==========================================
if "logged_in" not in st.session_state:
    st.session_state.logged_in = False
    st.session_state.trend_data = None

if not st.session_state.logged_in:
    st.markdown("<h1 style='text-align: center; color: #4ECDC4;'>SunnyEase 診所</h1>", unsafe_allow_html=True)
    st.markdown("<h3 style='text-align: center; color: #64748b;'>病患專屬健康儀表板</h3>", unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)
    
    with st.form("login_form"):
        st.markdown("**請輸入驗證資訊以查看您的檢驗報告**")
        national_id = st.text_input("身分證字號", placeholder="例如：A123456789")
        mobile_last4 = st.text_input("手機號碼末四碼", placeholder="例如：0987", max_chars=4)
        submitted = st.form_submit_button("登入並查看報告", use_container_width=True)
        
        if submitted:
            if not national_id or not mobile_last4:
                st.error("請完整填寫身分證字號與手機末四碼。")
            else:
                with st.spinner("安全驗證中..."):
                    cloud_id = get_hash_id(national_id, mobile_last4)
                    try:
                        response = supabase.table("cloud_patients").select("trend_data, last_updated").eq("cloud_id", cloud_id).execute()
                        if response.data and len(response.data) > 0:
                            st.session_state.trend_data = response.data[0]["trend_data"]
                            st.session_state.last_updated = response.data[0]["last_updated"]
                            st.session_state.logged_in = True
                            st.rerun()
                        else:
                            st.error("登入失敗：找不到相符的資料，請確認身分證與手機末四碼是否正確。若近期未回診可能暫無資料。")
                    except Exception as e:
                        st.error(f"系統連線錯誤，請稍後再試。")
    st.stop()

# ==========================================
# 儀表板介面 (已登入)
# ==========================================
st.markdown("<h2 style='color: #4ECDC4;'>📈 您的健康趨勢分析</h2>", unsafe_allow_html=True)

try:
    last_updated = datetime.fromisoformat(st.session_state.last_updated).strftime('%Y-%m-%d %H:%M')
    st.caption(f"資料最後更新時間：{last_updated}")
except:
    pass

if st.button("登出", type="secondary"):
    st.session_state.logged_in = False
    st.session_state.trend_data = None
    st.rerun()

trend_data = st.session_state.trend_data

if not trend_data:
    st.info("您目前沒有近期的檢驗紀錄。")
    st.stop()

# 轉換資料為 DataFrame 以利繪圖
df = pd.DataFrame(trend_data)
if not df.empty and "visit_date" in df.columns:
    df["visit_date"] = pd.to_datetime(df["visit_date"])

# 這裡我們定義與診所端一致的顯示群組 (精簡版，專注於重要指標)
GROUPS = [
    {
        "title": "🩸 1. 營養與透析指標 (Nutrition & Dialysis)",
        "metrics": [
            {"key": "09002C", "label": "尿素氮 (BUN)", "unit": "mg/dL"},
            {"key": "09038C", "label": "白蛋白 (Albumin)", "unit": "g/dL", "target_range": (4.0, None)},
            {"key": "09015C", "label": "肌酸酐 (Creatinine)", "unit": "mg/dL"},
            {"key": "09022C", "label": "血鉀 (Potassium)", "unit": "mmol/L", "target_range": (3.5, 5.5)},
            {"key": "09021C", "label": "血鈉 (Sodium)", "unit": "mmol/L", "target_range": (135.0, 145.0)},
        ],
    },
    {
        "title": "🦴 2. 鈣磷代謝 (CKD-MBD)",
        "metrics": [
            {"key": "09012C", "label": "血磷 (Phosphorus)", "unit": "mg/dL", "target_range": (3.5, 5.5)},
            {"key": "09011C", "label": "血鈣 (Calcium)", "unit": "mg/dL", "target_range": (8.4, 10.2)},
            {"key": "09122C", "label": "副甲狀腺素 (i-PTH)", "unit": "pg/mL", "target_range": (150, 600)},
        ],
    },
    {
        "title": "🔴 3. 造血與鐵質 (Anemia)",
        "metrics": [
            {"key": "08003C", "label": "血色素 (Hb)", "unit": "g/dL", "target_range": (10.0, 11.5)},
            {"key": "12116C", "label": "鐵蛋白 (Ferritin)", "unit": "ng/mL"},
        ],
    }
]

PALETTE = ["#4ECDC4", "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF"]

def build_simple_plot(metric, data, color):
    # 篩選該檢驗項目
    sub = data[data["nhi_code"] == metric["key"]].copy()
    if sub.empty:
        return None
        
    sub = sub.sort_values("visit_date")
    
    # 若同日有多筆(例如洗前洗後)，簡單平均化處理以利折線圖顯示
    sub = sub.groupby("visit_date")["test_result_numeric"].mean().reset_index()
    
    fig = go.Figure()
    
    fig.add_trace(go.Scatter(
        x=sub["visit_date"].dt.strftime("%m/%d").tolist(), 
        y=sub["test_result_numeric"].astype(float).tolist(),
        mode="lines+markers+text", 
        name=metric["label"],
        text=[f"{v:.1f}" for v in sub["test_result_numeric"]],
        textposition="top center",
        line=dict(color=color, width=2),
        marker=dict(symbol="circle", size=8),
    ))
    
    # 目標區間
    tr = metric.get("target_range")
    v_min = sub["test_result_numeric"].min()
    v_max = sub["test_result_numeric"].max()
    
    if tr:
        lo, hi = tr[0], tr[1]
        if lo is not None and hi is not None:
            fig.add_hrect(y0=lo, y1=hi, fillcolor="rgba(78, 205, 196, 0.12)", line_width=0, annotation_text=f"目標 {lo}-{hi}")
            v_min = min(v_min, lo)
            v_max = max(v_max, hi)
        elif lo is not None:
            fig.add_hline(y=lo, line_dash="dot", line_color="rgba(78, 205, 196, 0.6)", annotation_text=f"下限 {lo}")
            v_min = min(v_min, lo)
        elif hi is not None:
            fig.add_hline(y=hi, line_dash="dot", line_color="rgba(255,107,107,0.6)", annotation_text=f"上限 {hi}")
            v_max = max(v_max, hi)
            
    span = v_max - v_min
    if span == 0: span = 2
    
    fig.update_layout(
        height=250,
        margin=dict(l=20, r=20, t=30, b=20),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(gridcolor="#e2e8f0", fixedrange=True),
        yaxis=dict(gridcolor="#e2e8f0", range=[v_min - span*0.3, v_max + span*0.4], fixedrange=True),
        showlegend=False,
    )
    return fig

# 渲染圖表
for group in GROUPS:
    has_data = False
    st.markdown(f"### {group['title']}")
    
    color_idx = 0
    for m in group["metrics"]:
        fig = build_simple_plot(m, df, PALETTE[color_idx % len(PALETTE)])
        if fig:
            has_data = True
            unit_str = f" <span style='color: #94a3b8; font-size: 0.8rem;'>({m['unit']})</span>" if m.get('unit') else ""
            st.markdown(f"**{m['label']}**{unit_str}", unsafe_allow_html=True)
            st.plotly_chart(fig, use_container_width=True, config={'displayModeBar': False})
            color_idx += 1
            
    if not has_data:
        st.info("此區塊暫無近期檢驗資料。")
    st.markdown("---")
