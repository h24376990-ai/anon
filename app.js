/* =========================================================
   Research AI Lab
   app.js — Full Integrated Research System
   ========================================================= */

"use strict";


/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
  "https://beadajbimgpephqszbfy.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_s5kiFZVJ9jXyOgS-j2pS-g_7Kj1IeC8";

const PROJECT_ID =
  "ab429192-27d2-47e4-9ad7-08b639f45120";

/*
 * 重要:
 * research_jobsへ登録するだけでは
 * workerが確実に起動するとは限らない。
 *
 * そこでジョブ作成後にkick-workerを明示的に呼ぶ。
 */
const KICK_WORKER_FUNCTION =
  "kick-worker";


const sb =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );


/* =========================================================
   STATE
========================================================= */

let activeJobId =
  localStorage.getItem(
    "active_research_job"
  ) || null;

let pollTimer = null;

let workerRetryTimer = null;

let lastResults = [];

let selectedResult = null;

let researchContext = [];

let routeCache = [];

let isStartingResearch = false;

let workerKickInProgress = false;

let externalResearchNotes = "";

let currentResearchTheme = "";

let currentResearchSessionId = null;


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_VISIBLE_RESULTS = 100;

const CONTEXT_RESULT_LIMIT = 100;

const POLL_INTERVAL = 3000;

const WORKER_RETRY_INTERVAL = 10000;

const MAX_WORKER_RETRIES = 5;

const TERMINAL_STATUSES = [
  "completed",
  "failed",
  "cancelled"
];

const POSITIVE_EVALUATIONS = [
  "⭕",
  "⭕️",
  "○",
  "〇",
  "positive",
  "promising",
  "supported"
];


/* =========================================================
   RESEARCH APPROACHES
========================================================= */

/*
 * AIに「1つの考え方だけで終わらせない」ことを
 * 強制するための研究戦略。
 *
 * 特に未解決問題では
 * 「証明されていないため回答できません」
 * で終了させず、
 * 「現在の仮説をどう検証・破壊・派生できるか」
 * を継続させる。
 */

const RESEARCH_APPROACHES = [

  {
    id: "hypothesis_generation",
    name: "仮説生成",
    instruction:
      "現在の問題について複数の具体的仮説を生成する。"
  },

  {
    id: "hypothesis_attack",
    name: "仮説破壊",
    instruction:
      "現在もっとも有望な結論を意図的に壊す。反例、境界例、隠れた仮定を探す。"
  },

  {
    id: "counterexample",
    name: "反例探索",
    instruction:
      "結論が成立しない可能性のある反例を積極的に探索する。"
  },

  {
    id: "backward_reasoning",
    name: "逆向き推論",
    instruction:
      "目標が正しいと仮定し、そこから必要となる条件を逆算する。"
  },

  {
    id: "forward_reasoning",
    name: "順方向推論",
    instruction:
      "既知の定義・定理・条件から結論へ向けて段階的に進む。"
  },

  {
    id: "alternative_proof",
    name: "別証明",
    instruction:
      "現在の導出とは完全に異なる証明経路を探す。"
  },

  {
    id: "assumption_relaxation",
    name: "仮定緩和",
    instruction:
      "仮定を弱めた場合にも成立するか調べる。"
  },

  {
    id: "assumption_strengthening",
    name: "仮定強化",
    instruction:
      "より強い条件を置くことで構造が見えるか調べる。"
  },

  {
    id: "special_case",
    name: "特殊例",
    instruction:
      "低次元、有限の場合、対称な場合などの特殊例を詳しく調べる。"
  },

  {
    id: "generalization",
    name: "一般化",
    instruction:
      "得られた性質をより一般のクラスへ拡張できるか調べる。"
  },

  {
    id: "dimension_change",
    name: "次元変更",
    instruction:
      "低次元・高次元・離散・連続など別の設定へ移して構造を比較する。"
  },

  {
    id: "analogy",
    name: "類似構造探索",
    instruction:
      "別分野・別定理・別数学構造との類似性を探索する。"
  },

  {
    id: "numerical_experiment",
    name: "数値実験",
    instruction:
      "計算可能な範囲で数値実験を行い、仮説を支持または反証する。"
  },

  {
    id: "failure_analysis",
    name: "失敗原因分析",
    instruction:
      "過去の失敗研究を調べ、共通する失敗原因を抽出する。"
  },

  {
    id: "competing_hypotheses",
    name: "競合仮説",
    instruction:
      "現在の仮説とは反対方向の仮説も構築し比較する。"
  },

  {
    id: "literature_comparison",
    name: "文献・既知結果照合",
    instruction:
      "既知の数学的結果と照合し、既知結果を新発見として扱わない。"
  }

];


/* =========================================================
   DOM
========================================================= */

const $ = id =>
  document.getElementById(id);


/* =========================================================
   ESCAPE
========================================================= */

function esc(value) {

  return String(value ?? "")
    .replace(
      /[&<>\"']/g,
      c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;"
      })[c]
    );

}


/* =========================================================
   DATE
========================================================= */

function formatDate(value) {

  if (!value)
    return "—";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    "ja-JP"
  );

}


/* =========================================================
   JSON
========================================================= */

function parseJson(value) {

  if (!value)
    return {};

  if (
    typeof value === "object"
  ) {
    return value;
  }

  try {

    return JSON.parse(value);

  } catch {

    return {
      text:
        String(value)
    };

  }

}


/* =========================================================
   UUID
========================================================= */

function createSessionId() {

  if (
    crypto &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return (
    "research-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2)
  );

}


/* =========================================================
   RESULT SYMBOL
========================================================= */

function resultSymbol(result) {

  const evaluation =
    String(
      result?.evaluation ||
      ""
    ).trim();


  if (
    POSITIVE_EVALUATIONS
      .includes(
        evaluation
      )
  ) {
    return "⭕";
  }


  if (
    evaluation ===
      "❌" ||
    evaluation.toLowerCase() ===
      "negative"
  ) {
    return "❌";
  }


  return "△";

}


/* =========================================================
   STATUS
========================================================= */

function setStatus(
  text,
  type = ""
) {

  const box =
    $("statusBox");

  if (!box)
    return;

  box.textContent =
    text || "";

  box.className =
    `status ${type}`;

}


/* =========================================================
   CONNECTION
========================================================= */

function setConnection(
  ok,
  text
) {

  const textNode =
    $("connectionText");

  const dot =
    $("connectionDot");


  if (textNode)
    textNode.textContent =
      text;


  if (dot)
    dot.className =
      `dot ${ok ? "ok" : "bad"}`;

}


/* =========================================================
   CONNECTION CHECK
========================================================= */

async function checkConnection() {

  try {

    const response =
      await Promise.race([

        sb
          .from(
            "research_results"
          )
          .select(
            "id",
            {
              count: "exact",
              head: true
            }
          )
          .eq(
            "project_id",
            PROJECT_ID
          ),

        new Promise(
          (_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Supabase接続タイムアウト"
                  )
                ),
              8000
            )
        )

      ]);


    if (response.error)
      throw response.error;


    setConnection(
      true,
      "SUPABASE ONLINE"
    );


    return true;

  } catch (error) {

    console.error(
      "Supabase:",
      error
    );


    setConnection(
      false,
      "SUPABASE ERROR"
    );


    return false;

  }

}


/* =========================================================
   NAVIGATION
========================================================= */

function showPage(page) {

  document
    .querySelectorAll(".page")
    .forEach(section => {

      section.classList.toggle(
        "active",
        section.id ===
        `page-${page}`
      );

    });


  document
    .querySelectorAll(".nav-button")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page ===
        page
      );

    });


  if (page === "history")
    loadHistory();

  if (page === "saved")
    loadSaved();

  if (page === "jobs")
    loadJobs();

  if (page === "routes")
    loadRoutes();

  if (page === "memos")
    loadMemos();

}


/* =========================================================
   HISTORY
========================================================= */

async function loadHistory() {

  const box =
    $("historyList");

  if (!box)
    return;


  box.innerHTML =
    `<div class="empty">
      履歴を読み込んでいます...
    </div>`;


  try {

    const {
      data,
      error
    } =
      await sb
        .from(
          "research_results"
        )
        .select(
          [
            "id",
            "project_id",
            "title",
            "hypothesis",
            "content",
            "status",
            "evaluation",
            "confidence_level",
            "is_human_saved",
            "created_at",
            "updated_at"
          ].join(",")
        )
        .eq(
          "project_id",
          PROJECT_ID
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(
          MAX_VISIBLE_RESULTS
        );


    if (error)
      throw error;


    lastResults =
      data || [];


    const count =
      $("historyCount");

    if (count)
      count.textContent =
        `${lastResults.length}件`;


    /*
     * 重要:
     *
     * 以前はここで
     *
     * selectedResult = lastResults[0]
     *
     * としていた。
     *
     * これにより履歴を開いた瞬間に
     * 詳細が勝手に表示されていた。
     *
     * 今回は絶対に自動選択しない。
     */

    selectedResult = null;

    clearDetail();

    renderResults(
      box,
      lastResults
    );


  } catch (error) {

    console.error(
      "History:",
      error
    );


    box.innerHTML =
      `<div class="error">
        履歴取得失敗<br>
        ${esc(
          error.message
        )}
      </div>`;

  }

}


/* =========================================================
   CLEAR DETAIL
========================================================= */

function clearDetail() {

  const detail =
    $("detail");

  if (!detail)
    return;


  detail.innerHTML = `

    <div class="detail-empty">

      <div class="detail-empty-icon">
        ◇
      </div>

      <h3>
        研究結果を選択
      </h3>

      <p>
        左側の研究結果をクリックすると、
        詳細がここに表示されます。
      </p>

    </div>

  `;

}


/* =========================================================
   SAVED RESULTS
========================================================= */

async function loadSaved() {

  const box =
    $("savedList");

  if (!box)
    return;


  box.innerHTML =
    `<div class="empty">
      読み込み中...
    </div>`;


  try {

    const {
      data,
      error
    } =
      await sb
        .from(
          "research_results"
        )
        .select(
          [
            "id",
            "project_id",
            "title",
            "hypothesis",
            "content",
            "status",
            "evaluation",
            "confidence_level",
            "is_human_saved",
            "created_at",
            "updated_at"
          ].join(",")
        )
        .eq(
          "project_id",
          PROJECT_ID
        )
        .eq(
          "is_human_saved",
          true
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error)
      throw error;


    renderResults(
      box,
      data || []
    );


  } catch (error) {

    box.innerHTML =
      `<div class="error">
        保存結果取得失敗<br>
        ${esc(
          error.message
        )}
      </div>`;

  }

}


/* =========================================================
   JOBS
========================================================= */

async function loadJobs() {

  const box =
    $("jobsList");

  if (!box)
    return;


  box.innerHTML =
    `<div class="empty">
      ジョブを読み込んでいます...
    </div>`;


  try {

    const {
      data,
      error
    } =
      await sb
        .from(
          "research_jobs"
        )
        .select(
          [
            "id",
            "project_id",
            "job_type",
            "status",
            "priority",
            "payload",
            "result",
            "error_message",
            "started_at",
            "finished_at",
            "created_at"
          ].join(",")
        )
        .eq(
          "project_id",
          PROJECT_ID
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(100);


    if (error)
      throw error;


    if (!data?.length) {

      box.innerHTML =
        `<div class="empty">
          研究ジョブはありません。
        </div>`;

      return;

    }


    box.innerHTML =
      data.map(job => {

        const status =
          job.status ||
          "unknown";


        const payload =
          parseJson(
            job.payload
          );


        const theme =
          payload.theme ||
          job.job_type ||
          "Research";


        return `
          <div class="job-row">

            <div>

              <b>
                ${esc(theme)}
              </b>

              <small>
                ${formatDate(
                  job.created_at
                )}
              </small>

            </div>

            <span
              class="badge ${esc(status)}"
            >
              ${esc(status)}
            </span>

          </div>
        `;

      }).join("");


  } catch (error) {

    box.innerHTML =
      `<div class="error">
        ジョブ取得失敗<br>
        ${esc(
          error.message
        )}
      </div>`;

  }

}


/* =========================================================
   ROUTES
========================================================= */

/*
 * 探索ルートは研究メニューとしては
 * 重要度が低いので、index.htmlから削除する場合も
 * app.js側は壊れないようにしておく。
 */

async function loadRoutes() {

  const box =
    $("routesList");

  if (!box)
    return;


  try {

    const {
      data,
      error
    } =
      await sb
        .from(
          "research_results"
        )
        .select(
          "id,title,hypothesis,evaluation,created_at,content"
        )
        .eq(
          "project_id",
          PROJECT_ID
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(100);


    if (error)
      throw error;


    routeCache =
      data || [];


    if (!routeCache.length) {

      box.innerHTML =
        `<div class="empty">
          まだ研究ルートがありません。
        </div>`;

      return;

    }


    const nodes =
      routeCache
        .slice(0, 30)
        .map(
          (item, index) => `

            <div class="graph-node">

              <span>
                ${index + 1}
              </span>

              ${esc(
                item.title ||
                item.hypothesis ||
                "研究"
              )}

              <small>
                ${resultSymbol(item)}
              </small>

            </div>

          `
        )
        .join(
          '<div class="graph-line"></div>'
        );


    box.innerHTML = `

      <div class="graph-placeholder">

        <div class="graph-node main">
          RESEARCH
        </div>

        <div class="graph-line"></div>

        ${nodes}

      </div>

    `;


  } catch (error) {

    box.innerHTML =
      `<div class="error">
        研究ルート取得失敗<br>
        ${esc(
          error.message
        )}
      </div>`;

  }

}


/* =========================================================
   RESULTS
========================================================= */

function renderResults(
  box,
  rows
) {

  if (!rows.length) {

    box.innerHTML =
      `<div class="empty">
        まだ研究結果がありません。
      </div>`;

    return;

  }


  box.innerHTML =
    rows.map(result => `

      <button
        class="result-row"
        data-id="${esc(
          result.id
        )}"
      >

        <span class="symbol">
          ${resultSymbol(result)}
        </span>

        <span class="result-main">

          <b>
            ${esc(
              result.title ||
              "無題"
            )}
          </b>

          <small>

            ${formatDate(
              result.created_at
            )}

            ・信頼度

            ${Number(
              result.confidence_level ?? 0
            )}/5

          </small>

        </span>

        <span>

          ${
            result.is_human_saved
              ? "★"
              : ""
          }

        </span>

      </button>

    `).join("");


  box
    .querySelectorAll(
      ".result-row"
    )
    .forEach(element => {

      element.addEventListener(
        "click",
        () => {

          const result =
            rows.find(
              item =>
                String(item.id) ===
                String(
                  element.dataset.id
                )
            );


          if (!result)
            return;


          selectedResult =
            result;


          renderDetail(
            result
          );

        }
      );

    });

}


/* =========================================================
   DETAIL
========================================================= */

function renderDetail(
  result
) {

  const content =
    parseJson(
      result.content
    );


  const detail =
    $("detail");


  if (!detail)
    return;


  detail.innerHTML = `

    <div class="detail-head">

      <span class="big-symbol">
        ${resultSymbol(result)}
      </span>

      <div>

        <h3>
          ${esc(
            result.title ||
            "無題"
          )}
        </h3>

        <small>
          ${formatDate(
            result.created_at
          )}
        </small>

      </div>

    </div>


    <div class="chips">

      <span>
        評価:
        ${esc(
          result.evaluation ||
          "△"
        )}
      </span>

      <span>
        信頼度:
        ${Number(
          result.confidence_level ?? 0
        )}/5
      </span>

      <span>
        状態:
        ${esc(
          result.status ||
          "pending"
        )}
      </span>

    </div>


    <section>

      <label>
        仮説
      </label>

      <p>
        ${esc(
          result.hypothesis ||
          "—"
        )}
      </p>

    </section>


    <section>

      <label>
        研究内容
      </label>

      <pre>${esc(
        JSON.stringify(
          content,
          null,
          2
        )
      )}</pre>

    </section>


    <div class="detail-actions">

      <button
        id="saveDetail"
        class="button primary"
      >
        ${
          result.is_human_saved
            ? "★ 保存解除"
            : "★ 保存"
        }
      </button>


      <button
        id="reverifyDetail"
        class="button secondary"
      >
        🔄 再検証
      </button>

    </div>

  `;


  $("saveDetail")
    ?.addEventListener(
      "click",
      () =>
        toggleSave(result)
    );


  $("reverifyDetail")
    ?.addEventListener(
      "click",
      () =>
        requestReverification(
          result
        )
    );


  /*
   * 3Dモデルへ現在の研究を通知。
   */
  notify3DModel(
    "research-selected",
    result
  );

}


/* =========================================================
   SAVE
========================================================= */

/*
 * 保存と研究ジョブは別物。
 *
 * 保存:
 *   人間が「この結果は残したい」と判断したもの。
 *
 * 研究ジョブ:
 *   AIが実際に処理するタスク。
 *
 * したがって両方残す。
 */

async function toggleSave(
  result
) {

  try {

    const newValue =
      !result.is_human_saved;


    const {
      error
    } =
      await sb
        .from(
          "research_results"
        )
        .update({
          is_human_saved:
            newValue
        })
        .eq(
          "id",
          result.id
        )
        .eq(
          "project_id",
          PROJECT_ID
        );


    if (error)
      throw error;


    result.is_human_saved =
      newValue;


    setStatus(
      newValue
        ? "研究結果を保存しました。"
        : "保存を解除しました。",
      "success"
    );


    await loadHistory();

    await loadSaved();


    /*
     * 履歴再読み込みによって
     * selectedResultが消えるため、
     * 保存した結果を再表示する。
     */
    selectedResult =
      result;


    renderDetail(
      result
    );


  } catch (error) {

    setStatus(
      `保存変更失敗: ${
        error.message
      }`,
      "error"
    );

  }

}


/* =========================================================
   REVERIFICATION
========================================================= */

async function requestReverification(
  result
) {

  if (!result?.id)
    return;


  try {

    const content =
      parseJson(
        result.content
      );


    const sessionId =
      createSessionId();


    const payload = {

      theme:
        result.hypothesis ||
        result.title ||
        "Research",

      source:
        "positive_result_reverification",

      parent_result_id:
        result.id,

      research_session_id:
        sessionId,

      verification_modes:
        RESEARCH_APPROACHES
          .map(
            approach =>
              approach.id
          ),

      approaches:
        RESEARCH_APPROACHES,

      previous_result:
        content,

      research_policy: {

        never_stop_only_because_unsolved:
          true,

        attempt_continuation:
          true,

        actively_attack_conclusions:
          true,

        search_counterexamples:
          true,

        generate_branches:
          true,

        compare_multiple_methods:
          true,

        preserve_failure_information:
          true,

        use_previous_research:
          true

      }

    };


    const {
      data,
      error
    } =
      await sb
        .from(
          "research_jobs"
        )
        .insert({

          project_id:
            PROJECT_ID,

          job_type:
            "reverification",

          status:
            "queued",

          priority:
            20,

          payload

        })
        .select()
        .single();


    if (error)
      throw error;


    activeJobId =
      data.id;


    localStorage.setItem(
      "active_research_job",
      activeJobId
    );


    renderJob(
      data
    );


    setStatus(
      "再検証をキューへ登録しました。workerを起動しています。",
      "success"
    );


    await kickWorker(
      data.id
    );


    startPolling();


  } catch (error) {

    console.error(
      "Reverification:",
      error
    );


    setStatus(
      `再検証登録失敗: ${
        error.message
      }`,
      "error"
    );

  }

}


/* =========================================================
   EXTERNAL AI / CLAUDE NOTES
========================================================= */

/*
 * index.html側に以下のIDのtextareaが存在すれば
 * Claude等で考えた内容を受け取れる。
 *
 * id:
 *   externalResearchInput
 *
 * ボタン:
 *   externalResearchSend
 *
 * 存在しなくてもapp.jsは壊れない。
 */

function getExternalResearchInput() {

  const input =
    $("externalResearchInput");

  if (!input)
    return "";


  return input.value.trim();

}


/* =========================================================
   ADD EXTERNAL RESEARCH
========================================================= */

async function sendExternalResearch() {

  const input =
    getExternalResearchInput();


  if (!input) {

    setStatus(
      "外部AIで考えた研究内容を入力してください。",
      "error"
    );

    return;

  }


  externalResearchNotes =
    input;


  /*
   * 現在のテーマがある場合は、
   * その研究の追加情報として利用する。
   *
   * テーマがない場合は独立した研究テーマとして扱う。
   */

  const theme =
    currentResearchTheme ||
    $("questionInput")
      ?.value
      ?.trim() ||
    "外部AI提供研究";


  try {

    const sessionId =
      currentResearchSessionId ||
      createSessionId();


    const {
      data,
      error
    } =
      await sb
        .from(
          "research_jobs"
        )
        .insert({

          project_id:
            PROJECT_ID,

          job_type:
            "external_research_analysis",

          status:
            "queued",

          priority:
            15,

          payload: {

            theme,

            research_session_id:
              sessionId,

            source:
              "external_ai",

            external_ai_notes:
              input,

            instruction:
              "外部AIの内容をそのまま正しいと仮定せず、独立検証・反例探索・別導出を行う。",

            research_rules: {

              verify_external_claims:
                true,

              search_counterexamples:
                true,

              attempt_independent_derivation:
                true,

              compare_with_previous_research:
                true,

              no_plausible_lies:
                true

            }

          }

        })
        .select()
        .single();


    if (error)
      throw error;


    activeJobId =
      data.id;


    localStorage.setItem(
      "active_research_job",
      activeJobId
    );


    renderJob(
      data
    );


    setStatus(
      "外部AIの研究案を検証キューへ送信しました。",
      "success"
    );


    await kickWorker(
      data.id
    );


    if ($("externalResearchInput"))
      $("externalResearchInput")
        .value = "";


    startPolling();


  } catch (error) {

    console.error(
      "External research:",
      error
    );


    setStatus(
      `外部研究送信失敗: ${
        error.message
      }`,
      "error"
    );

  }

}


/* =========================================================
   START RESEARCH
========================================================= */

async function startResearch() {

  if (isStartingResearch)
    return;


  const input =
    $("questionInput");


  if (!input)
    return;


  const theme =
    input.value.trim();


  if (!theme) {

    setStatus(
      "研究テーマを入力してください。",
      "error"
    );

    return;

  }


  isStartingResearch =
    true;


  currentResearchTheme =
    theme;


  currentResearchSessionId =
    createSessionId();


  if ($("researchButton"))
    $("researchButton")
      .disabled = true;


  if ($("stopButton"))
    $("stopButton")
      .disabled = false;


  setStatus(
    "研究ジョブを作成しています..."
  );


  try {

    /*
     * 過去研究を取得。
     */
    const context =
      await getResearchContext(
        theme
      );


    /*
     * 物理演算を使うか。
     *
     * index.htmlに
     *
     * id="physicsMode"
     *
     * のcheckboxがあれば使用。
     */
    const physicsMode =
      Boolean(
        $("physicsMode")
          ?.checked
      );


    /*
     * 数学のみ / 数学＋物理的アナロジー
     */
    const researchMode =
      physicsMode
        ? "mathematics_plus_physics"
        : "mathematics";


    /*
     * 研究ペイロード。
     */
    const payload = {

      theme,

      source:
        "Research AI Lab",

      mode:
        "autonomous_research",

      research_session_id:
        currentResearchSessionId,

      research_domain:
        "mathematics",

      physics_mode:
        physicsMode,

      research_mode:
        researchMode,

      context,

      external_ai_notes:
        externalResearchNotes || "",

      /*
       * 16種類の研究アプローチ。
       */
      approaches:
        RESEARCH_APPROACHES,

      /*
       * 未解決問題への重要ルール。
       */
      research_rules: {

        /*
         * 「証明されていない」
         * だけで研究を終了しない。
         */
        no_unsolved_refusal:
          true,

        continue_if_unsolved:
          true,

        no_plausible_lies:
          true,

        no_unverified_claims:
          true,

        counterexample_search:
          true,

        hypothesis_attack:
          true,

        conclusion_destruction:
          true,

        branch_generation:
          true,

        alternative_proofs:
          true,

        backward_reasoning:
          true,

        forward_reasoning:
          true,

        numerical_experiments:
          true,

        failure_analysis:
          true,

        literature_verification:
          true,

        known_math_avoidance:
          true,

        route_block_after:
          3,

        independent_verification:
          true,

        preserve_failure_knowledge:
          true,

        reuse_all_previous_results:
          true,

        summarize_common_failure_causes:
          true,

        compare_successful_methods:
          true

      },

      /*
       * AIが研究結果を出したとき、
       * さらに次の分岐を考えさせる。
       */
      continuation_policy: {

        after_each_result:
          true,

        attack_current_conclusion:
          true,

        derive_new_hypotheses:
          true,

        search_for_counterexample:
          true,

        try_different_method:
          true,

        record_failure_reason:
          true

      }

    };


    /*
     * ジョブ作成。
     */
    const {
      data,
      error
    } =
      await sb
        .from(
          "research_jobs"
        )
        .insert({

          project_id:
            PROJECT_ID,

          job_type:
            "research_cycle",

          status:
            "queued",

          priority:
            10,

          payload

        })
        .select(
          [
            "id",
            "project_id",
            "job_type",
            "status",
            "priority",
            "payload",
            "result",
            "error_message",
            "started_at",
            "finished_at",
            "created_at"
          ].join(",")
        )
        .single();


    if (error)
      throw error;


    activeJobId =
      data.id;


    localStorage.setItem(
      "active_research_job",
      activeJobId
    );


    renderJob(
      data
    );


    setStatus(
      "研究ジョブ作成完了。workerを起動しています。",
      "success"
    );


    /*
     * ★最重要
     *
     * queuedで止まるのを防ぐ。
     *
     * GitHub Actions等の定期workerだけを
     * 待つのではなく、
     * ブラウザから明示的にkick-workerを呼ぶ。
     */
    const workerStarted =
      await kickWorker(
        data.id
      );


    if (!workerStarted) {

      setStatus(
        "ジョブは登録済みですがworker起動確認に失敗しました。自動再試行します。",
        "error"
      );

    }


    /*
     * 監視開始。
     */
    startPolling();


  } catch (error) {

    console.error(
      "Start research:",
      error
    );


    if ($("researchButton"))
      $("researchButton")
        .disabled = false;


    if ($("stopButton"))
      $("stopButton")
        .disabled = true;


    setStatus(
      `研究開始失敗: ${
        error.message
      }`,
      "error"
    );


  } finally {

    isStartingResearch =
      false;

  }

}


/* =========================================================
   KICK WORKER
========================================================= */

async function kickWorker(
  jobId
) {

  if (!jobId)
    return false;


  if (workerKickInProgress)
    return false;


  workerKickInProgress =
    true;


  try {

    console.log(
      "[Research AI Lab] kick-worker:",
      jobId
    );


    const {
      data,
      error
    } =
      await sb.functions.invoke(
        KICK_WORKER_FUNCTION,
        {
          body: {

            job_id:
              jobId,

            project_id:
              PROJECT_ID,

            source:
              "browser",

            requested_at:
              new Date()
                .toISOString()

          }

        }
      );


    if (error) {

      console.error(
        "kick-worker error:",
        error
      );


      scheduleWorkerRetry(
        jobId
      );


      return false;

    }


    console.log(
      "[Research AI Lab] worker response:",
      data
    );


    return true;


  } catch (error) {

    console.error(
      "kick-worker exception:",
      error
    );


    scheduleWorkerRetry(
      jobId
    );


    return false;


  } finally {

    workerKickInProgress =
      false;

  }

}


/* =========================================================
   WORKER RETRY
========================================================= */

function scheduleWorkerRetry(
  jobId
) {

  if (!jobId)
    return;


  if (workerRetryTimer)
    return;


  let attempts = 0;


  workerRetryTimer =
    setInterval(
      async () => {

        attempts++;


        const success =
          await kickWorker(
            jobId
          );


        if (
          success ||
          attempts >=
            MAX_WORKER_RETRIES
        ) {

          clearInterval(
            workerRetryTimer
          );


          workerRetryTimer =
            null;

        }

      },
      WORKER_RETRY_INTERVAL
    );

}


/* =========================================================
   GET RESEARCH CONTEXT
========================================================= */

async function getResearchContext(
  theme
) {

  try {

    /*
     * 研究結果をできるだけ多く取得。
     *
     * ここでは既存DBスキーマを壊さないよう
     * project_idだけを基準にする。
     */
    const {
      data,
      error
    } =
      await sb
        .from(
          "research_results"
        )
        .select(
          [
            "id",
            "title",
            "hypothesis",
            "content",
            "evaluation",
            "confidence_level",
            "created_at"
          ].join(",")
        )
        .eq(
          "project_id",
          PROJECT_ID
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(
          CONTEXT_RESULT_LIMIT
        );


    if (error)
      throw error;


    const results =
      data || [];


    researchContext =
      results;


    /*
     * すべての研究を次のAIへ渡す。
     *
     * 特に失敗結果を除外しない。
     *
     * AIにとって失敗は
     * 「次に避けるべき情報」なので重要。
     */

    return {

      theme,

      previous_results:
        results.map(
          item => ({

            id:
              item.id,

            title:
              item.title,

            hypothesis:
              item.hypothesis,

            evaluation:
              item.evaluation,

            confidence:
              item.confidence_level,

            content:
              parseJson(
                item.content
              ),

            created_at:
              item.created_at

          })
        ),

      memory_policy: {

        use_successes:
          true,

        use_failures:
          true,

        analyze_common_failure_causes:
          true,

        identify_repeated_patterns:
          true,

        avoid_repeated_routes:
          true,

        compare_methods:
          true

      }

    };


  } catch (error) {

    console.warn(
      "Research context:",
      error
    );


    return {

      theme,

      previous_results: [],

      memory_policy: {

        use_successes:
          true,

        use_failures:
          true,

        analyze_common_failure_causes:
          true

      }

    };

  }

}


/* =========================================================
   STOP
========================================================= */

async function stopResearch() {

  if (!activeJobId) {

    setStatus(
      "停止対象のジョブがありません。",
      "error"
    );

    return;

  }


  if ($("stopButton"))
    $("stopButton")
      .disabled = true;


  try {

    const {
      data,
      error
    } =
      await sb
        .from(
          "research_jobs"
        )
        .update({

          status:
            "cancelled",

          finished_at:
            new Date()
              .toISOString(),

          error_message:
            "Cancelled by user"

        })
        .eq(
          "id",
          activeJobId
        )
        .eq(
          "project_id",
          PROJECT_ID
        )
        .in(
          "status",
          [
            "queued",
            "running"
          ]
        )
        .select(
          "id,status"
        );


    if (error)
      throw error;


    if (!data?.length) {

      setStatus(
        "ジョブはすでに終了している可能性があります。",
        "error"
      );

    } else {

      setStatus(
        "研究停止を要求しました。",
        "success"
      );

    }


    await refreshActiveJob();


  } catch (error) {

    if ($("stopButton"))
      $("stopButton")
        .disabled = false;


    setStatus(
      `停止失敗: ${
        error.message
      }`,
      "error"
    );

  }

}


/* =========================================================
   JOB RENDER
========================================================= */

function renderJob(
  job
) {

  const panel =
    $("jobPanel");

  if (!panel)
    return;


  panel.classList.remove(
    "hidden"
  );


  if ($("jobId"))
    $("jobId")
      .textContent =
      job.id || "—";


  if ($("jobStatus"))
    $("jobStatus")
      .textContent =
      String(
        job.status ||
        "unknown"
      ).toUpperCase();


  if ($("jobCreated"))
    $("jobCreated")
      .textContent =
      formatDate(
        job.created_at
      );


  if ($("jobStarted"))
    $("jobStarted")
      .textContent =
      formatDate(
        job.started_at
      );


  if ($("jobFinished"))
    $("jobFinished")
      .textContent =
      formatDate(
        job.finished_at
      );


  let percent = 0;

  let text =
    "待機中";


  switch (
    job.status
  ) {

    case "queued":

      percent = 10;

      text =
        "研究キュー待機中";

      break;


    case "running":

      percent = 55;

      text =
        "AI研究実行中";

      break;


    case "completed":

      percent = 100;

      text =
        "研究完了";

      break;


    case "failed":

      percent = 100;

      text =
        "研究失敗";

      break;


    case "cancelled":

      percent = 100;

      text =
        "研究停止";

      break;

  }


  if ($("progressValue"))
    $("progressValue")
      .style.width =
      `${percent}%`;


  if ($("progressPercent"))
    $("progressPercent")
      .textContent =
      `${percent}%`;


  if ($("progressText"))
    $("progressText")
      .textContent =
      text;

}


/* =========================================================
   REFRESH ACTIVE JOB
========================================================= */

async function refreshActiveJob() {

  if (!activeJobId)
    return;


  try {

    const {
      data,
      error
    } =
      await sb
        .from(
          "research_jobs"
        )
        .select(
          [
            "id",
            "project_id",
            "job_type",
            "status",
            "priority",
            "payload",
            "result",
            "error_message",
            "started_at",
            "finished_at",
            "created_at"
          ].join(",")
        )
        .eq(
          "id",
          activeJobId
        )
        .eq(
          "project_id",
          PROJECT_ID
        )
        .maybeSingle();


    if (error)
      throw error;


    if (!data) {

      activeJobId =
        null;

      localStorage.removeItem(
        "active_research_job"
      );

      stopPolling();

      if ($("researchButton"))
        $("researchButton")
          .disabled = false;

      if ($("stopButton"))
        $("stopButton")
          .disabled = true;

      return;

    }


    renderJob(
      data
    );


    /*
     * queuedのまま一定時間経過した場合、
     * workerを再キックする。
     */
    if (
      data.status ===
      "queued"
    ) {

      const created =
        new Date(
          data.created_at
        ).getTime();


      const age =
        Date.now() -
        created;


      /*
       * 15秒以上queuedなら
       * workerを再起動。
       */
      if (
        age >
        15000
      ) {

        console.warn(
          "Job remains queued. Re-kicking worker.",
          data.id
        );


        await kickWorker(
          data.id
        );

      }

    }


    /*
     * runningなら正常。
     */
    if (
      data.status ===
      "running"
    ) {

      setStatus(
        "AIが研究を実行しています...",
        "success"
      );

    }


    const finished =
      TERMINAL_STATUSES
        .includes(
          data.status
        );


    if (!finished)
      return;


    stopPolling();


    if ($("researchButton"))
      $("researchButton")
        .disabled = false;


    if ($("stopButton"))
      $("stopButton")
        .disabled = true;


    if (
      data.status ===
      "completed"
    ) {

      setStatus(
        "研究完了。結果を取得しました。",
        "success"
      );


      /*
       * 結果を最新状態へ。
       */
      selectedResult =
        null;


      await loadHistory();


      /*
       * 3Dモデル側へ
       * 研究完了を通知。
       */
      notify3DModel(
        "research-completed",
        data
      );

    }


    if (
      data.status ===
      "failed"
    ) {

      setStatus(
        `研究失敗: ${
          data.error_message ||
          "worker error"
        }`,
        "error"
      );


      notify3DModel(
        "research-failed",
        data
      );

    }


    if (
      data.status ===
      "cancelled"
    ) {

      setStatus(
        "研究は停止されました。",
        "success"
      );

    }


    activeJobId =
      null;


    localStorage.removeItem(
      "active_research_job"
    );


  } catch (error) {

    console.error(
      "Job polling:",
      error
    );

  }

}


/* =========================================================
   POLLING
========================================================= */

function startPolling() {

  stopPolling();


  refreshActiveJob();


  pollTimer =
    setInterval(
      refreshActiveJob,
      POLL_INTERVAL
    );

}


function stopPolling() {

  if (pollTimer) {

    clearInterval(
      pollTimer
    );

    pollTimer = null;

  }

}


/* =========================================================
   MEMOS
========================================================= */

async function loadMemos() {

  const box =
    $("memoList");

  if (!box)
    return;


  box.innerHTML =
    `<div class="empty">
      メモを読み込んでいます...
    </div>`;


  try {

    const {
      data,
      error
    } =
      await sb
        .from(
          "research_memos"
        )
        .select(
          "id,title,content,created_at,updated_at"
        )
        .eq(
          "project_id",
          PROJECT_ID
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error)
      throw error;


    if (!data?.length) {

      box.innerHTML =
        `<div class="empty">
          まだメモがありません。
        </div>`;

      return;

    }


    box.innerHTML =
      data.map(memo => `

        <article
          class="memo-card"
        >

          <div>

            <h3>
              ${esc(
                memo.title ||
                "無題"
              )}
            </h3>

            <small>
              ${formatDate(
                memo.created_at
              )}
            </small>

          </div>


          <p>
            ${esc(
              memo.content
            )}
          </p>


          <button
            class="button danger memo-delete"
            data-id="${esc(
              memo.id
            )}"
          >
            削除
          </button>

        </article>

      `).join("");


    box
      .querySelectorAll(
        ".memo-delete"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () =>
            deleteMemo(
              button.dataset.id
            )
        );

      });


  } catch (error) {

    box.innerHTML =
      `<div class="error">
        メモ取得失敗<br>
        ${esc(
          error.message
        )}
      </div>`;

  }

}


/* =========================================================
   SAVE MEMO
========================================================= */

async function saveMemo() {

  const title =
    $("memoTitle")
      ?.value
      .trim() || "";


  const content =
    $("memoContent")
      ?.value
      .trim() || "";


  if (!content) {

    setStatus(
      "メモ内容を入力してください。",
      "error"
    );

    return;

  }


  try {

    const {
      error
    } =
      await sb
        .from(
          "research_memos"
        )
        .insert({

          project_id:
            PROJECT_ID,

          title:
            title ||
            "無題",

          content

        });


    if (error)
      throw error;


    if ($("memoTitle"))
      $("memoTitle")
        .value = "";


    if ($("memoContent"))
      $("memoContent")
        .value = "";


    setStatus(
      "メモを保存しました。",
      "success"
    );


    await loadMemos();


  } catch (error) {

    setStatus(
      `メモ保存失敗: ${
        error.message
      }`,
      "error"
    );

  }

}


/* =========================================================
   DELETE MEMO
========================================================= */

async function deleteMemo(
  id
) {

  if (
    !confirm(
      "このメモを削除しますか？"
    )
  ) {
    return;
  }


  try {

    const {
      error
    } =
      await sb
        .from(
          "research_memos"
        )
        .delete()
        .eq(
          "id",
          id
        )
        .eq(
          "project_id",
          PROJECT_ID
        );


    if (error)
      throw error;


    setStatus(
      "メモを削除しました。",
      "success"
    );


    await loadMemos();


  } catch (error) {

    setStatus(
      `メモ削除失敗: ${
        error.message
      }`,
      "error"
    );

  }

}


/* =========================================================
   BACKGROUND JOB RECOVERY
========================================================= */

async function recoverJob() {

  if (!activeJobId)
    return;


  console.log(
    "Recovering background job:",
    activeJobId
  );


  await refreshActiveJob();


  if (activeJobId) {

    if ($("researchButton"))
      $("researchButton")
        .disabled = true;


    if ($("stopButton"))
      $("stopButton")
        .disabled = false;


    /*
     * ブラウザを閉じている間に
     * workerが動いている可能性がある。
     *
     * 再度kickすることで
     * queued残留も回収する。
     */
    await kickWorker(
      activeJobId
    );


    startPolling();

  }

}


/* =========================================================
   3D MODEL BRIDGE
========================================================= */

function notify3DModel(
  eventName,
  data
) {

  try {

    window.dispatchEvent(
      new CustomEvent(
        `research-ai:${eventName}`,
        {
          detail: data
        }
      )
    );


    /*
     * 既存の3Dエンジンが
     * ResearchModelBridgeを直接利用できるようにする。
     */

    if (
      window.ResearchModelBridge &&
      typeof
        window.ResearchModelBridge
          .onResearchEvent ===
        "function"
    ) {

      window.ResearchModelBridge
        .onResearchEvent(
          eventName,
          data
        );

    }

  } catch (error) {

    console.warn(
      "3D notification failed:",
      error
    );

  }

}


/* =========================================================
   3D RESEARCH BRIDGE
========================================================= */

window.ResearchModelBridge = {

  getCurrentResearch() {

    return selectedResult;

  },


  getResearchContext() {

    return researchContext;

  },


  getCurrentSession() {

    return currentResearchSessionId;

  },


  getResearchApproaches() {

    return RESEARCH_APPROACHES;

  },


  /*
   * 3Dモデル側から研究を依頼。
   */
  async requestModelResearch(
    modelData
  ) {

    const theme =
      `数学モデル探索: ${
        JSON.stringify(
          modelData
        )
      }`;


    const sessionId =
      createSessionId();


    const {
      data,
      error
    } =
      await sb
        .from(
          "research_jobs"
        )
        .insert({

          project_id:
            PROJECT_ID,

          job_type:
            "model_experiment",

          status:
            "queued",

          priority:
            5,

          payload: {

            theme,

            model:
              modelData,

            source:
              "3D mathematical model",

            mode:
              "model_experiment",

            research_session_id:
              sessionId,

            approaches:
              RESEARCH_APPROACHES,

            research_rules: {

              counterexample_search:
                true,

              alternative_transformations:
                true,

              physical_analogy:
                true,

              no_unverified_claims:
                true,

              continue_if_unsolved:
                true,

              attack_conclusion:
                true

            }

          }

        })
        .select()
        .single();


    if (error)
      throw error;


    /*
     * 作成した3D研究ジョブを
     * workerへ即時送信。
     */
    await kickWorker(
      data.id
    );


    return data;

  },


  /*
   * AI研究結果を3Dモデルへ適用するための
   * 共通イベント。
   *
   * 実際の3D描画エンジンは
   * このイベントを受けてモデルを更新する。
   */
  applyResearchResult(
    result
  ) {

    notify3DModel(
      "apply-result",
      result
    );

  },


  onResearchEvent(
    eventName,
    data
  ) {

    console.log(
      "[3D Research Event]",
      eventName,
      data
    );

  }

};


/* =========================================================
   EXTERNAL AI BUTTON
========================================================= */

function initExternalResearchButton() {

  const button =
    $("externalResearchSend");


  if (!button)
    return;


  button.addEventListener(
    "click",
    sendExternalResearch
  );

}


/* =========================================================
   PHYSICS MODE UI
========================================================= */

function initPhysicsMode() {

  const checkbox =
    $("physicsMode");


  if (!checkbox)
    return;


  checkbox.addEventListener(
    "change",
    () => {

      if (
        checkbox.checked
      ) {

        setStatus(
          "物理的モデル・物理演算的な考察を研究に追加します。",
          "success"
        );

      } else {

        setStatus(
          "数学中心の研究モードに戻しました。",
          "success"
        );

      }

    }
  );

}


/* =========================================================
   QUESTION INPUT
========================================================= */

function initQuestionInput() {

  const input =
    $("questionInput");


  if (!input)
    return;


  input.addEventListener(
    "input",
    () => {

      currentResearchTheme =
        input.value.trim();

    }
  );

}


/* =========================================================
   KEYBOARD SHORTCUT
========================================================= */

function initKeyboardShortcuts() {

  document.addEventListener(
    "keydown",
    event => {

      /*
       * Ctrl / Cmd + Enter
       * 研究開始
       */
      if (
        event.key ===
          "Enter" &&
        (
          event.ctrlKey ||
          event.metaKey
        )
      ) {

        const active =
          document.activeElement;


        if (
          active &&
          active.id ===
            "questionInput"
        ) {

          event.preventDefault();

          startResearch();

        }

      }

    }
  );

}


/* =========================================================
   INIT
========================================================= */

function init() {

  /*
   * NAVIGATION
   */
  document
    .querySelectorAll(
      ".nav-button"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          showPage(
            button.dataset.page
          )
      );

    });


  /*
   * RESEARCH
   */
  $("researchButton")
    ?.addEventListener(
      "click",
      startResearch
    );


  /*
   * STOP
   */
  $("stopButton")
    ?.addEventListener(
      "click",
      stopResearch
    );


  /*
   * CLEAR
   */
  $("clearButton")
    ?.addEventListener(
      "click",
      () => {

        if ($("questionInput"))
          $("questionInput")
            .value = "";


        currentResearchTheme =
          "";


        setStatus("");

      }
    );


  /*
   * MEMO
   */
  $("memoSaveButton")
    ?.addEventListener(
      "click",
      saveMemo
    );


  /*
   * EXTERNAL AI
   */
  initExternalResearchButton();


  /*
   * PHYSICS
   */
  initPhysicsMode();


  /*
   * QUESTION
   */
  initQuestionInput();


  /*
   * KEYBOARD
   */
  initKeyboardShortcuts();


  /*
   * SUPABASE
   */
  checkConnection();


  /*
   * 初期履歴。
   *
   * ここで詳細は自動表示しない。
   */
  loadHistory();


  /*
   * バックグラウンドジョブ復旧。
   */
  recoverJob();

}


/* =========================================================
   START
========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    init
  );

} else {

  init();

}
