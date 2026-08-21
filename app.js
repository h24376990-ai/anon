/* =========================================================
   Research AI Lab
   app.js
   Background Research Integrated Version
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
   CONSTANTS
========================================================= */

const MAX_VISIBLE_RESULTS = 100;

const CONTEXT_LIMIT = 50;

const POLL_INTERVAL = 4000;

const QUEUED_WARNING_TIME = 30000;

const WORKER_TIMEOUT = 10000;

const TERMINAL_STATUSES = [
  "completed",
  "failed",
  "cancelled"
];

const POSITIVE_EVALUATIONS = [
  "⭕",
  "⭕️"
];


/*
 * kick-worker
 *
 * Supabase Edge Function
 * GitHub Actions / Worker の起動を担当する。
 */
const KICK_WORKER_FUNCTION =
  "kick-worker";


/* =========================================================
   STATE
========================================================= */

let activeJobId =
  localStorage.getItem(
    "active_research_job"
  ) || null;

let activeJobCreatedAt =
  localStorage.getItem(
    "active_research_job_created_at"
  ) || null;

let pollTimer = null;

let queuedWarningTimer = null;

let lastResults = [];

let selectedResult = null;

let researchContext = [];

let routeCache = [];

let isStartingResearch = false;

let isKickingWorker = false;


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

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return {};
  }

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
   RESULT SYMBOL
========================================================= */

function resultSymbol(result) {

  const evaluation =
    String(
      result?.evaluation || ""
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
    "❌"
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

  /*
   * AI研究メモリ専用ページは削除予定。
   * AI側のメモリはDBに保持する。
   */

  if (page === "routes")
    loadRoutes();

  if (page === "memos")
    loadMemos();

}


/* =========================================================
   LOAD HISTORY
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
     * 以前は最初の結果を自動的に
     * selectedResult に入れていた。
     *
     * 今回はそれを完全に削除。
     *
     * 「履歴を押す」
     * ↓
     * 「詳細を開く」
     *
     * というUIにする。
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
    <div class="empty">
      研究結果を選択してください。
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
   LOAD ROUTES
========================================================= */

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

        <p>
          研究ルート候補
        </p>

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
        type="button"
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
                String(element.dataset.id)
            );


          if (result) {

            selectedResult =
              result;

            renderDetail(
              result
            );

          }

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

  const detail =
    $("detail");

  if (!detail)
    return;


  const content =
    parseJson(
      result.content
    );


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
        type="button"
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
        type="button"
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

}


/* =========================================================
   SAVE RESULT
========================================================= */

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
   KICK WORKER
========================================================= */

/*
 * 研究ジョブをDBに登録しただけでは
 * queued のままになる可能性がある。
 *
 * そこで登録直後に kick-worker を呼ぶ。
 *
 * kick-workerの役割:
 *
 * research_jobs
 *       ↓
 * GitHub Actions / Worker
 *
 * を起動すること。
 */

async function kickWorker(
  jobId
) {

  if (!jobId)
    throw new Error(
      "jobIdがありません。"
    );


  if (isKickingWorker)
    return;


  isKickingWorker = true;


  try {

    const response =
      await Promise.race([

        sb.functions.invoke(
          KICK_WORKER_FUNCTION,
          {
            body: {
              job_id:
                jobId,

              project_id:
                PROJECT_ID
            }
          }
        ),

        new Promise(
          (_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Worker起動要求がタイムアウトしました。"
                  )
                ),
              WORKER_TIMEOUT
            )
        )

      ]);


    if (response.error)
      throw response.error;


    console.log(
      "kick-worker:",
      response.data
    );


    return response.data;


  } finally {

    isKickingWorker =
      false;

  }

}


/* =========================================================
   CREATE RESEARCH JOB
========================================================= */

async function createResearchJob({
  jobType,
  priority,
  payload
}) {

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
          jobType,

        status:
          "queued",

        priority:
          priority ?? 10,

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


  if (!data?.id)
    throw new Error(
      "研究ジョブIDを取得できませんでした。"
    );


  /*
   * ブラウザを閉じても復旧できるよう
   * job IDを保存。
   */

  setActiveJob(
    data
  );


  /*
   * 最重要:
   *
   * DB登録だけで終わらせない。
   *
   * Worker起動要求を送る。
   */

  try {

    await kickWorker(
      data.id
    );

  } catch (workerError) {

    console.error(
      "Worker kick failed:",
      workerError
    );


    /*
     * ジョブ自体はDBに残す。
     *
     * ここで削除しない。
     *
     * GitHub Actionsの定期実行が
     * queuedジョブを拾える構成なら
     * 復旧可能だから。
     */

    setStatus(
      "研究ジョブは登録されましたが、Workerの即時起動確認に失敗しました。バックグラウンドWorkerの再取得を待機します。",
      "error"
    );

  }


  return data;

}


/* =========================================================
   ACTIVE JOB
========================================================= */

function setActiveJob(
  job
) {

  activeJobId =
    job?.id || null;


  activeJobCreatedAt =
    job?.created_at ||
    new Date().toISOString();


  if (activeJobId) {

    localStorage.setItem(
      "active_research_job",
      activeJobId
    );

    localStorage.setItem(
      "active_research_job_created_at",
      activeJobCreatedAt
    );

  }

}


/* =========================================================
   CLEAR ACTIVE JOB
========================================================= */

function clearActiveJob() {

  activeJobId = null;

  activeJobCreatedAt = null;

  localStorage.removeItem(
    "active_research_job"
  );

  localStorage.removeItem(
    "active_research_job_created_at"
  );

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


    const payload = {

      theme:
        result.hypothesis ||
        result.title ||
        "Research",

      source:
        "positive_result_reverification",

      parent_result_id:
        result.id,

      verification_modes: [

        "contradiction",

        "backward_reasoning",

        "induction",

        "deduction",

        "counterexample",

        "alternative_derivation",

        "literature_comparison",

        "boundary_case",

        "assumption_removal",

        "generalization",

        "specialization",

        "analogy",

        "computational_test"

      ],

      previous_result:
        content

    };


    const job =
      await createResearchJob({

        jobType:
          "reverification",

        priority:
          20,

        payload

      });


    setStatus(
      "研究結果を再検証キューへ登録し、Workerを起動しました。",
      "success"
    );


    renderJob(
      job
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
   RESEARCH MODE
========================================================= */

function getResearchMode() {

  /*
   * index.html側に
   *
   * researchMode
   *
   * が存在すれば使用。
   */

  const element =
    $("researchMode");


  if (
    element?.value
  ) {
    return element.value;
  }


  return "mathematics";

}


/* =========================================================
   PHYSICS MODE
========================================================= */

function getPhysicsMode() {

  const element =
    $("physicsMode");


  if (
    element
  ) {

    if (
      element.type ===
      "checkbox"
    ) {
      return element.checked;
    }

    return (
      element.value ===
      "true"
    );

  }


  return false;

}


/* =========================================================
   RESEARCH APPROACHES
========================================================= */

function getResearchApproaches() {

  return [

    "hypothesis_generation",

    "contradiction",

    "backward_reasoning",

    "forward_reasoning",

    "induction",

    "deduction",

    "counterexample_search",

    "boundary_case_analysis",

    "assumption_removal",

    "generalization",

    "specialization",

    "alternative_derivation",

    "transformation",

    "analogy",

    "computational_experiment",

    "literature_comparison",

    "known_result_connection",

    "failure_analysis",

    "adversarial_result_destruction",

    "independent_verification"

  ];

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


  /*
   * 既に実行中のジョブがある場合、
   * 同時研究を防ぐ。
   */

  if (activeJobId) {

    const existing =
      await getActiveJob();


    if (
      existing &&
      !TERMINAL_STATUSES
        .includes(
          existing.status
        )
    ) {

      setStatus(
        "すでに実行中の研究があります。先に現在の研究を確認してください。",
        "error"
      );

      return;

    }

    clearActiveJob();

  }


  isStartingResearch =
    true;


  if ($("researchButton"))
    $("researchButton")
      .disabled = true;

  if ($("stopButton"))
    $("stopButton")
      .disabled = false;


  setStatus(
    "過去研究を分析しています..."
  );


  try {

    const context =
      await getResearchContext(
        theme
      );


    const researchMode =
      getResearchMode();


    const physicsEnabled =
      getPhysicsMode();


    const approaches =
      getResearchApproaches();


    const payload = {

      theme,

      source:
        "Research AI Lab",

      mode:
        "autonomous_research",

      research_mode:
        researchMode,

      physics_enabled:
        physicsEnabled,

      context,

      research_approaches:
        approaches,

      research_rules: {

        no_plausible_lies:
          true,

        no_unverified_claims:
          true,

        do_not_stop_because_unsolved:
          true,

        continue_trial_when_unsolved:
          true,

        counterexample_search:
          true,

        literature_verification:
          true,

        known_math_avoidance:
          true,

        route_block_after:
          3,

        independent_verification:
          true,

        alternative_proofs:
          true,

        destroy_current_conclusion:
          true,

        derive_variants:
          true,

        analyze_failure_causes:
          true,

        cross_research_memory:
          true,

        separate_research_topics:
          true

      }

    };


    /*
     * 研究ジョブ作成
     *
     * createResearchJob内で
     * kick-workerまで行う。
     */

    const job =
      await createResearchJob({

        jobType:
          "research_cycle",

        priority:
          10,

        payload

      });


    renderJob(
      job
    );


    setStatus(
      "研究ジョブを登録しました。バックグラウンドWorkerを起動しています。",
      "success"
    );


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
   GET RESEARCH CONTEXT
========================================================= */

async function getResearchContext(
  theme
) {

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
          CONTEXT_LIMIT
        );


    if (error)
      throw error;


    const results =
      data || [];


    researchContext =
      results;


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
              )

          })
        )

    };


  } catch (error) {

    console.warn(
      "Research context:",
      error
    );


    return {

      theme,

      previous_results: []

    };

  }

}


/* =========================================================
   GET ACTIVE JOB
========================================================= */

async function getActiveJob() {

  if (!activeJobId)
    return null;


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


    return data || null;

  } catch (error) {

    console.error(
      "getActiveJob:",
      error
    );

    return null;

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
            new Date().toISOString(),

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


    default:

      percent = 5;

      text =
        "状態確認中";

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
   QUEUED WATCHDOG
========================================================= */

function startQueuedWatchdog(
  job
) {

  stopQueuedWatchdog();


  if (
    !job?.created_at ||
    job.status !== "queued"
  ) {
    return;
  }


  const created =
    new Date(
      job.created_at
    ).getTime();


  queuedWarningTimer =
    setInterval(
      async () => {

        const current =
          await getActiveJob();


        if (!current) {

          stopQueuedWatchdog();

          return;

        }


        if (
          current.status !==
          "queued"
        ) {

          stopQueuedWatchdog();

          return;

        }


        const age =
          Date.now() -
          created;


        if (
          age >=
          QUEUED_WARNING_TIME
        ) {

          setStatus(
            "Workerの処理開始を待っています。Workerがqueuedジョブを取得できるか確認中です。",
            "error"
          );


          /*
           * 再度kickを試す。
           */

          try {

            await kickWorker(
              current.id
            );

          } catch (error) {

            console.warn(
              "Worker retry:",
              error
            );

          }

        }

      },
      10000
    );

}


/* =========================================================
   STOP QUEUED WATCHDOG
========================================================= */

function stopQueuedWatchdog() {

  if (
    queuedWarningTimer
  ) {

    clearInterval(
      queuedWarningTimer
    );

    queuedWarningTimer =
      null;

  }

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

      stopPolling();

      stopQueuedWatchdog();

      clearActiveJob();

      if ($("researchButton"))
        $("researchButton")
          .disabled = false;

      if ($("stopButton"))
        $("stopButton")
          .disabled = true;

      setStatus(
        "研究ジョブが見つかりません。",
        "error"
      );

      return;

    }


    renderJob(
      data
    );


    if (
      data.status ===
      "queued"
    ) {

      startQueuedWatchdog(
        data
      );

    } else {

      stopQueuedWatchdog();

    }


    const finished =
      TERMINAL_STATUSES
        .includes(
          data.status
        );


    if (!finished)
      return;


    stopPolling();

    stopQueuedWatchdog();


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
       * Workerがresearch_resultsへ
       * 保存した結果を再取得。
       */

      await loadHistory();

      await loadJobs();

    }


    if (
      data.status ===
      "failed"
    ) {

      setStatus(
        `研究失敗: ${
          data.error_message ||
          "Worker error"
        }`,
        "error"
      );


      await loadJobs();

    }


    if (
      data.status ===
      "cancelled"
    ) {

      setStatus(
        "研究は停止されました。",
        "success"
      );


      await loadJobs();

    }


    clearActiveJob();


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


/* =========================================================
   STOP POLLING
========================================================= */

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
            type="button"
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
   RECOVER BACKGROUND JOB
========================================================= */

async function recoverJob() {

  if (!activeJobId)
    return;


  const job =
    await getActiveJob();


  if (!job) {

    clearActiveJob();

    return;

  }


  if (
    TERMINAL_STATUSES
      .includes(
        job.status
      )
  ) {

    await refreshActiveJob();

    return;

  }


  /*
   * ブラウザを閉じていた間も
   * DB側のジョブは残っている。
   */

  renderJob(
    job
  );


  if ($("researchButton"))
    $("researchButton")
      .disabled = true;

  if ($("stopButton"))
    $("stopButton")
      .disabled = false;


  setStatus(
    "バックグラウンド研究を復旧しました。",
    "success"
  );


  /*
   * queuedならWorker起動を
   * 再度要求する。
   */

  if (
    job.status ===
    "queued"
  ) {

    try {

      await kickWorker(
        job.id
      );

    } catch (error) {

      console.warn(
        "Recovery worker kick:",
        error
      );

    }

  }


  startPolling();

}


/* =========================================================
   EXTERNAL RESEARCH IMPORT
========================================================= */

/*
 * Claude等で考えた研究結果を
 * AI研究へ渡すための共通API。
 *
 * 例:
 *
 * window.ResearchAI.importExternalResearch({
 *   source: "Claude",
 *   theme: "...",
 *   content: "...",
 *   conclusion: "..."
 * });
 */

async function importExternalResearch(
  research
) {

  if (!research)
    throw new Error(
      "研究データがありません。"
    );


  const theme =
    research.theme ||
    "External Research";


  const payload = {

    theme,

    source:
      research.source ||
      "external_ai",

    external_research:
      research,

    research_rules: {

      critique_external_result:
        true,

      counterexample_search:
        true,

      independent_verification:
        true,

      do_not_trust_external_conclusion:
        true,

      derive_alternatives:
        true

    }

  };


  const job =
    await createResearchJob({

      jobType:
        "external_research_verification",

      priority:
        15,

      payload

    });


  renderJob(
    job
  );


  setStatus(
    "外部AIの研究結果を検証キューへ登録しました。",
    "success"
  );


  startPolling();


  return job;

}


/* =========================================================
   PUBLIC AI BRIDGE
========================================================= */

window.ResearchAI = {

  /*
   * 外部AIの結果を投入。
   */
  importExternalResearch,


  /*
   * 現在の研究結果。
   */
  getCurrentResearch() {

    return selectedResult;

  },


  /*
   * 過去研究コンテキスト。
   */
  getResearchContext() {

    return researchContext;

  },


  /*
   * 現在のジョブ。
   */
  async getActiveJob() {

    return getActiveJob();

  }

};


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


  async requestModelResearch(
    modelData
  ) {

    const theme =
      `数学モデル探索: ${
        JSON.stringify(
          modelData
        )
      }`;


    const payload = {

      theme,

      model:
        modelData,

      source:
        "3D mathematical model",

      mode:
        "model_experiment",

      physics_enabled:
        getPhysicsMode(),

      research_rules: {

        counterexample_search:
          true,

        alternative_transformations:
          true,

        physical_analogy:
          true,

        destroy_current_model:
          true,

        derive_model_variants:
          true,

        no_unverified_claims:
          true,

        independent_verification:
          true

      }

    };


    const job =
      await createResearchJob({

        jobType:
          "model_experiment",

        priority:
          5,

        payload

      });


    startPolling();


    return job;

  }

};


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
   * INITIAL CONNECTION
   */

  checkConnection();


  /*
   * HISTORY
   */

  loadHistory();


  /*
   * BACKGROUND JOB RECOVERY
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
