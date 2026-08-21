/* =========================================================
   Research AI Lab
   app.js — Complete Integrated Version
   =========================================================

   FEATURES
   ---------------------------------------------------------
   - Supabase browser client
   - Research job queue
   - Background worker monitoring
   - False worker-failure detection prevention
   - Queue stagnation monitoring
   - Job recovery after page reload
   - Research history
   - Saved results
   - Research memos
   - 3D model bridge
   - Reverification
   - Navigation
   - Connection monitoring
   - Safe initialization
   ========================================================= */

"use strict";


/* =========================================================
   CONFIGURATION
========================================================= */

const SUPABASE_URL =
  "https://beadajbimgpephqszbfy.supabase.co";


/*
 * IMPORTANT
 *
 * Browser側にはService Role Keyを絶対に置かない。
 *
 * Publishable key / anon keyを使用する。
 */

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_s5kiFZVJ9jXyOgS-j2pS-g_7Kj1IeC8";


const PROJECT_ID =
  "ab429192-27d2-47e4-9ad7-08b639f45120";


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_VISIBLE_RESULTS = 100;

const CONTEXT_RESULT_LIMIT = 30;

const ROUTE_RESULT_LIMIT = 100;

const JOB_LIMIT = 100;


/*
 * ブラウザでのジョブ監視間隔。
 */

const POLL_INTERVAL = 5000;


/*
 * GitHub Actionsは5分cron。
 *
 * したがってqueued状態が数分続くことは
 * 正常な可能性が高い。
 */

const QUEUE_INFO_AFTER_MS =
  2 * 60 * 1000;


const QUEUE_LONG_WAIT_AFTER_MS =
  10 * 60 * 1000;


const QUEUE_STALE_WARNING_AFTER_MS =
  30 * 60 * 1000;


/*
 * DB上の終端状態。
 */

const TERMINAL_STATUSES = [
  "completed",
  "failed",
  "cancelled"
];


const POSITIVE_EVALUATIONS = [
  "⭕",
  "⭕️"
];


/* =========================================================
   SUPABASE CLIENT
========================================================= */

let sb = null;


/*
 * Supabaseを安全に初期化する。
 *
 * CDNが読み込まれていない場合、
 * ここで止めてしまわず画面へエラーを表示する。
 */

function initializeSupabase() {

  try {

    if (
      !window.supabase ||
      typeof window.supabase.createClient !==
        "function"
    ) {

      throw new Error(
        "Supabase JavaScript SDKを読み込めませんでした。"
      );

    }


    sb =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );


    console.log(
      "Research AI Lab: Supabase initialized."
    );


    return true;


  } catch (error) {

    console.error(
      "Supabase initialization failed:",
      error
    );


    setStatus(
      `Supabase初期化失敗: ${getErrorMessage(error)}`,
      "error"
    );


    setConnection(
      false,
      "SUPABASE ERROR"
    );


    return false;

  }

}


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

let lastResults = [];

let selectedResult = null;

let researchContext = [];

let routeCache = [];

let isStartingResearch = false;

let lastJobStatus = null;

let lastJobData = null;

let pollingStartedAt = null;

let pollErrorCount = 0;


/*
 * Workerがまだ実行されていないqueued状態を
 * 何回確認したか。
 */

let queuePollCount = 0;


/* =========================================================
   DOM HELPER
========================================================= */

function $(id) {

  return document.getElementById(id);

}


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
   DURATION
========================================================= */

function formatDuration(ms) {

  if (
    !ms ||
    ms < 0
  ) {

    return "0秒";

  }


  const totalSeconds =
    Math.floor(
      ms / 1000
    );


  const hours =
    Math.floor(
      totalSeconds / 3600
    );


  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );


  const seconds =
    totalSeconds % 60;


  if (hours > 0) {

    return (
      `${hours}時間${minutes}分${seconds}秒`
    );

  }


  if (minutes > 0) {

    return (
      `${minutes}分${seconds}秒`
    );

  }


  return (
    `${seconds}秒`
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

    return JSON.parse(
      value
    );

  } catch {

    return {
      text:
        String(value)
    };

  }

}


/* =========================================================
   ERROR
========================================================= */

function getErrorMessage(error) {

  if (!error)
    return "不明なエラー";


  if (
    typeof error === "string"
  ) {

    return error;

  }


  return (
    error.message ||
    error.error_description ||
    error.details ||
    error.hint ||
    "不明なエラー"
  );

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


  if (textNode) {

    textNode.textContent =
      text || "";

  }


  if (dot) {

    dot.className =
      `dot ${ok ? "ok" : "bad"}`;

  }

}


/* =========================================================
   CONNECTION CHECK
========================================================= */

async function checkConnection() {

  if (!sb) {

    setConnection(
      false,
      "SUPABASE ERROR"
    );

    return false;

  }


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
      "Supabase connection:",
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
    .querySelectorAll(
      ".page"
    )
    .forEach(
      section => {

        section.classList.toggle(
          "active",
          section.id ===
          `page-${page}`
        );

      }
    );


  document
    .querySelectorAll(
      ".nav-button"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.page ===
          page
        );

      }
    );


  if (
    page ===
    "history"
  ) {

    loadHistory();

  }


  if (
    page ===
    "saved"
  ) {

    loadSaved();

  }


  if (
    page ===
    "jobs"
  ) {

    loadJobs();

  }


  if (
    page ===
    "memos"
  ) {

    loadMemos();

  }


  if (
    page ===
    "model"
  ) {

    updateModelStatus(
      "READY"
    );

  }

}


/* =========================================================
   LOAD HISTORY
========================================================= */

async function loadHistory() {

  if (!sb)
    return;


  const box =
    $("historyList");


  if (!box)
    return;


  box.innerHTML =
    `
      <div class="empty">
        履歴を読み込んでいます...
      </div>
    `;


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
            ascending:
              false
          }
        )
        .limit(
          MAX_VISIBLE_RESULTS
        );


    if (error)
      throw error;


    lastResults =
      data || [];


    const countNode =
      $("historyCount");


    if (countNode) {

      countNode.textContent =
        `${lastResults.length}件`;

    }


    if (
      !selectedResult
    ) {

      const detail =
        $("detail");


      if (detail) {

        detail.innerHTML =
          `
            <div class="empty">
              研究結果を選択すると詳細が表示されます。
            </div>
          `;

      }

    }


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
      `
        <div class="error">
          履歴取得失敗<br>
          ${esc(
            getErrorMessage(error)
          )}
        </div>
      `;

  }

}


/* =========================================================
   SAVED RESULTS
========================================================= */

async function loadSaved() {

  if (!sb)
    return;


  const box =
    $("savedList");


  if (!box)
    return;


  box.innerHTML =
    `
      <div class="empty">
        読み込み中...
      </div>
    `;


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
            ascending:
              false
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
      `
        <div class="error">
          保存結果取得失敗<br>
          ${esc(
            getErrorMessage(error)
          )}
        </div>
      `;

  }

}


/* =========================================================
   JOBS
========================================================= */

async function loadJobs() {

  if (!sb)
    return;


  const box =
    $("jobsList");


  if (!box)
    return;


  box.innerHTML =
    `
      <div class="empty">
        ジョブを読み込んでいます...
      </div>
    `;


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
            ascending:
              false
          }
        )
        .limit(
          JOB_LIMIT
        );


    if (error)
      throw error;


    if (!data?.length) {

      box.innerHTML =
        `
          <div class="empty">
            研究ジョブはありません。
          </div>
        `;

      return;

    }


    box.innerHTML =
      data
        .map(
          job => {

            const payload =
              parseJson(
                job.payload
              );


            const theme =
              payload.theme ||
              payload.message ||
              job.job_type ||
              "Research";


            const status =
              job.status ||
              "unknown";


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

          }
        )
        .join("");


  } catch (error) {

    box.innerHTML =
      `
        <div class="error">
          ジョブ取得失敗<br>
          ${esc(
            getErrorMessage(error)
          )}
        </div>
      `;

  }

}


/* =========================================================
   RESULTS
========================================================= */

function resultSymbol(
  result
) {

  if (
    POSITIVE_EVALUATIONS
      .includes(
        result?.evaluation
      )
  ) {

    return "⭕";

  }


  if (
    result?.evaluation ===
    "❌"
  ) {

    return "❌";

  }


  return "△";

}


function renderResults(
  box,
  rows
) {

  if (!box)
    return;


  if (!rows?.length) {

    box.innerHTML =
      `
        <div class="empty">
          まだ研究結果がありません。
        </div>
      `;

    return;

  }


  box.innerHTML =
    rows
      .map(
        result => `

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
                  result.confidence_level ??
                  0
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

        `
      )
      .join("");


  box
    .querySelectorAll(
      ".result-row"
    )
    .forEach(
      element => {

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

      }
    );

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
          result.confidence_level ??
          0
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

}


/* =========================================================
   SAVE RESULT
========================================================= */

async function toggleSave(
  result
) {

  if (!sb)
    return;


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
      `保存変更失敗: ${getErrorMessage(error)}`,
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

  if (!sb)
    return;


  if (!result?.id)
    return;


  try {

    const content =
      parseJson(
        result.content
      );


    const theme =
      result.hypothesis ||
      result.title ||
      "Research";


    const payload = {

      /*
       * smart-handler互換用。
       *
       * themeとmessageの両方を入れる。
       */

      theme,

      message:
        theme,

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

        "literature_comparison"

      ],

      previous_result:
        content

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


    activeJobCreatedAt =
      data.created_at ||
      new Date().toISOString();


    lastJobData =
      data;


    lastJobStatus =
      data.status;


    queuePollCount =
      0;


    saveActiveJobState();


    renderJob(
      data
    );


    setStatus(
      "再検証ジョブを登録しました。Workerの次回実行を待っています。",
      "success"
    );


    startPolling();


  } catch (error) {

    console.error(
      "Reverification:",
      error
    );


    setStatus(
      `再検証登録失敗: ${getErrorMessage(error)}`,
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


  if (!sb) {

    setStatus(
      "Supabaseが初期化されていません。",
      "error"
    );

    return;

  }


  const input =
    $("questionInput");


  if (!input) {

    setStatus(
      "研究入力欄が見つかりません。",
      "error"
    );

    return;

  }


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
   * 既にactive jobがある場合、
   * 二重登録を防ぐ。
   */

  if (activeJobId) {

    const current =
      await refreshActiveJob();


    if (
      current &&
      (
        current.status ===
          "queued" ||
        current.status ===
          "running"
      )
    ) {

      setStatus(
        "現在進行中の研究があります。完了するまで新しい研究を登録しません。",
        "working"
      );

      return;

    }

  }


  isStartingResearch =
    true;


  const researchButton =
    $("researchButton");


  const stopButton =
    $("stopButton");


  if (researchButton)
    researchButton.disabled =
      true;


  if (stopButton)
    stopButton.disabled =
      false;


  setStatus(
    "過去研究を確認しています...",
    "working"
  );


  try {

    /*
     * 過去研究取得。
     */

    const context =
      await getResearchContext(
        theme
      );


    /*
     * 選択された研究モード。
     */

    const modeElement =
      document.querySelector(
        'input[name="researchMode"]:checked'
      );


    const researchMode =
      modeElement?.value ||
      "mathematics";


    setStatus(
      "研究ジョブを登録しています...",
      "working"
    );


    /*
     * -----------------------------------------------------
     * IMPORTANT
     *
     * smart-handler互換のため、
     * payloadにthemeとmessageの両方を入れる。
     * -----------------------------------------------------
     */

    const payload = {

      theme,

      message:
        theme,

      source:
        "Research AI Lab",

      mode:
        "autonomous_research",

      research_mode:
        researchMode,

      context,

      research_rules: {

        research_unresolved_problems:
          true,

        no_plausible_lies:
          true,

        no_unverified_claims:
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

        adversarial_attempt:
          true,

        branch_exploration:
          true,

        failure_pattern_analysis:
          true,

        historical_cross_check:
          true,

        cross_field_analogy:
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


    /*
     * DBへのqueued登録成功。
     */

    activeJobId =
      data.id;


    activeJobCreatedAt =
      data.created_at ||
      new Date().toISOString();


    lastJobStatus =
      data.status;


    lastJobData =
      data;


    pollingStartedAt =
      Date.now();


    queuePollCount =
      0;


    pollErrorCount =
      0;


    saveActiveJobState();


    renderJob(
      data
    );


    /*
     * 重要：
     *
     * ここではWorker起動確認をしない。
     *
     * queued登録成功 = 研究開始受付成功。
     */

    setStatus(
      "研究ジョブを登録しました。Workerの次回実行を待っています。",
      "success"
    );


    startPolling();


  } catch (error) {

    console.error(
      "Start research:",
      error
    );


    if (researchButton)
      researchButton.disabled =
        false;


    if (stopButton)
      stopButton.disabled =
        true;


    setStatus(
      `研究開始失敗: ${getErrorMessage(error)}`,
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

  if (!sb) {

    return {
      theme,
      previous_results: []
    };

  }


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
            ascending:
              false
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

      previous_results:
        [],

      context_warning:
        getErrorMessage(error)

    };

  }

}


/* =========================================================
   STOP RESEARCH
========================================================= */

async function stopResearch() {

  if (!sb)
    return;


  if (!activeJobId) {

    setStatus(
      "停止対象のジョブがありません。",
      "error"
    );

    return;

  }


  const stopButton =
    $("stopButton");


  if (stopButton)
    stopButton.disabled =
      true;


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

    if (stopButton)
      stopButton.disabled =
        false;


    setStatus(
      `停止失敗: ${getErrorMessage(error)}`,
      "error"
    );

  }

}


/* =========================================================
   JOB AGE
========================================================= */

function getJobAgeMs(job) {

  const created =
    job?.created_at ||
    activeJobCreatedAt;


  if (!created)
    return 0;


  const time =
    new Date(
      created
    ).getTime();


  if (
    Number.isNaN(time)
  ) {

    return 0;

  }


  return Math.max(
    0,
    Date.now() - time
  );

}


/* =========================================================
   QUEUE MESSAGE
========================================================= */

function getQueueStatusMessage(
  job
) {

  const age =
    getJobAgeMs(
      job
    );


  const seconds =
    Math.floor(
      age / 1000
    );


  const minutes =
    Math.floor(
      seconds / 60
    );


  if (
    age <
    QUEUE_INFO_AFTER_MS
  ) {

    return (
      "研究ジョブ登録済み・Workerの次回実行を待機中"
    );

  }


  if (
    age <
    QUEUE_LONG_WAIT_AFTER_MS
  ) {

    return (
      `研究キュー待機中（${minutes}分）。GitHub Actions Workerの次回実行を待っています。`
    );

  }


  if (
    age <
    QUEUE_STALE_WARNING_AFTER_MS
  ) {

    return (
      `研究キュー待機中（${minutes}分）。まだ失敗ではありません。Workerの状態を確認しています。`
    );

  }


  return (
    `研究キューが長時間待機中（${minutes}分）。ジョブは保持したままWorkerの復旧を待っています。`
  );

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


  const jobId =
    $("jobId");


  if (jobId) {

    jobId.textContent =
      job.id ||
      "—";

  }


  const jobStatus =
    $("jobStatus");


  if (jobStatus) {

    jobStatus.textContent =
      String(
        job.status ||
        "unknown"
      ).toUpperCase();

  }


  const jobCreated =
    $("jobCreated");


  if (jobCreated) {

    jobCreated.textContent =
      formatDate(
        job.created_at
      );

  }


  const jobStarted =
    $("jobStarted");


  if (jobStarted) {

    jobStarted.textContent =
      formatDate(
        job.started_at
      );

  }


  const jobFinished =
    $("jobFinished");


  if (jobFinished) {

    jobFinished.textContent =
      formatDate(
        job.finished_at
      );

  }


  let percent =
    0;


  let text =
    "待機中";


  switch (
    job.status
  ) {

    case "queued":

      percent =
        10;


      text =
        getQueueStatusMessage(
          job
        );

      break;


    case "running":

      percent =
        55;


      text =
        "AI研究実行中。複数の検証・反証・派生探索を実行しています。";

      break;


    case "completed":

      percent =
        100;


      text =
        "研究完了";

      break;


    case "failed":

      percent =
        100;


      text =
        "研究処理失敗";

      break;


    case "cancelled":

      percent =
        100;


      text =
        "研究停止";

      break;


    default:

      text =
        "研究状態を確認中";

  }


  const progressValue =
    $("progressValue");


  if (progressValue) {

    progressValue.style.width =
      `${percent}%`;

  }


  const progressPercent =
    $("progressPercent");


  if (progressPercent) {

    progressPercent.textContent =
      `${percent}%`;

  }


  const progressText =
    $("progressText");


  if (progressText) {

    progressText.textContent =
      text;

  }


  const queueAge =
    $("queueAge");


  if (
    queueAge &&
    job.status ===
      "queued"
  ) {

    queueAge.textContent =
      formatDuration(
        getJobAgeMs(job)
      );

  }

}


/* =========================================================
   REFRESH ACTIVE JOB
========================================================= */

async function refreshActiveJob() {

  if (!activeJobId)
    return null;


  if (!sb)
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


    /*
     * 一時的に見つからなくても
     * activeJobを即削除しない。
     */

    if (!data) {

      pollErrorCount++;


      console.warn(
        "Active job not found:",
        activeJobId,
        "attempt:",
        pollErrorCount
      );


      setStatus(
        "研究ジョブの状態を一時的に取得できません。再確認しています...",
        "working"
      );


      return null;

    }


    pollErrorCount =
      0;


    lastJobData =
      data;


    lastJobStatus =
      data.status;


    renderJob(
      data
    );


    /*
     * ------------------------------------------------------
     * QUEUED
     * ------------------------------------------------------
     */

    if (
      data.status ===
      "queued"
    ) {

      queuePollCount++;


      /*
       * queuedは正常状態。
       *
       * Worker起動確認に失敗した、
       * とは絶対に表示しない。
       */

      setStatus(
        getQueueStatusMessage(
          data
        ),
        "working"
      );


      return data;

    }


    /*
     * ------------------------------------------------------
     * RUNNING
     * ------------------------------------------------------
     */

    if (
      data.status ===
      "running"
    ) {

      queuePollCount =
        0;


      setStatus(
        "AI研究を実行中です。研究結果を生成・検証しています。",
        "working"
      );


      return data;

    }


    /*
     * ------------------------------------------------------
     * UNKNOWN / OTHER
     * ------------------------------------------------------
     */

    if (
      !TERMINAL_STATUSES
        .includes(
          data.status
        )
    ) {

      setStatus(
        `研究状態: ${
          data.status ||
          "unknown"
        }`,
        "working"
      );


      return data;

    }


    /*
     * ------------------------------------------------------
     * TERMINAL
     * ------------------------------------------------------
     */

    stopPolling();


    const researchButton =
      $("researchButton");


    const stopButton =
      $("stopButton");


    if (researchButton)
      researchButton.disabled =
        false;


    if (stopButton)
      stopButton.disabled =
        true;


    /*
     * COMPLETED
     */

    if (
      data.status ===
      "completed"
    ) {

      setStatus(
        "研究完了。結果を研究履歴へ反映しています。",
        "success"
      );


      selectedResult =
        null;


      await loadHistory();


      /*
       * Worker側で結果insertとjob updateの
       * 順序が前後した場合への保険。
       */

      setTimeout(
        () => {

          loadHistory();

        },
        1500
      );


      setStatus(
        "研究完了。結果が研究履歴に保存されました。",
        "success"
      );

    }


    /*
     * FAILED
     */

    if (
      data.status ===
      "failed"
    ) {

      setStatus(
        `研究失敗: ${
          data.error_message ||
          "WorkerまたはAI処理でエラーが発生しました。"
        }`,
        "error"
      );

    }


    /*
     * CANCELLED
     */

    if (
      data.status ===
      "cancelled"
    ) {

      setStatus(
        "研究は停止されました。",
        "success"
      );

    }


    /*
     * 終端後のみactive jobを削除。
     */

    activeJobId =
      null;


    activeJobCreatedAt =
      null;


    lastJobData =
      null;


    lastJobStatus =
      null;


    queuePollCount =
      0;


    clearActiveJobState();


    return data;


  } catch (error) {

    console.error(
      "Job polling:",
      error
    );


    pollErrorCount++;


    /*
     * DB取得エラーをWorker失敗とは判定しない。
     */

    setStatus(
      "研究状態を一時的に取得できません。自動再確認しています...",
      "working"
    );


    return null;

  }

}


/* =========================================================
   POLLING
========================================================= */

function startPolling() {

  stopPolling();


  if (!activeJobId)
    return;


  pollingStartedAt =
    Date.now();


  /*
   * 即時確認。
   */

  refreshActiveJob();


  /*
   * 5秒ごとに確認。
   */

  pollTimer =
    setInterval(
      () => {

        if (!activeJobId) {

          stopPolling();

          return;

        }


        refreshActiveJob();

      },
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


    pollTimer =
      null;

  }

}


/* =========================================================
   LOCAL STORAGE
========================================================= */

function saveActiveJobState() {

  if (activeJobId) {

    localStorage.setItem(
      "active_research_job",
      activeJobId
    );

  }


  if (activeJobCreatedAt) {

    localStorage.setItem(
      "active_research_job_created_at",
      activeJobCreatedAt
    );

  }

}


function clearActiveJobState() {

  localStorage.removeItem(
    "active_research_job"
  );


  localStorage.removeItem(
    "active_research_job_created_at"
  );

}


/* =========================================================
   RECOVER BACKGROUND JOB
========================================================= */

async function recoverJob() {

  if (!activeJobId)
    return;


  setStatus(
    "進行中の研究ジョブを確認しています...",
    "working"
  );


  const data =
    await refreshActiveJob();


  /*
   * queued / runningなら監視継続。
   */

  if (activeJobId) {

    const researchButton =
      $("researchButton");


    const stopButton =
      $("stopButton");


    if (researchButton)
      researchButton.disabled =
        true;


    if (stopButton)
      stopButton.disabled =
        false;


    startPolling();


    return;

  }


  /*
   * 終了済みならボタン復帰。
   */

  if (data) {

    const researchButton =
      $("researchButton");


    const stopButton =
      $("stopButton");


    if (researchButton)
      researchButton.disabled =
        false;


    if (stopButton)
      stopButton.disabled =
        true;

  }

}


/* =========================================================
   MEMOS
========================================================= */

async function loadMemos() {

  if (!sb)
    return;


  const box =
    $("memoList");


  if (!box)
    return;


  box.innerHTML =
    `
      <div class="empty">
        メモを読み込んでいます...
      </div>
    `;


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
            ascending:
              false
          }
        );


    if (error)
      throw error;


    if (!data?.length) {

      box.innerHTML =
        `
          <div class="empty">
            まだメモがありません。
          </div>
        `;

      return;

    }


    box.innerHTML =
      data
        .map(
          memo => `

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

          `
        )
        .join("");


    box
      .querySelectorAll(
        ".memo-delete"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () =>
              deleteMemo(
                button.dataset.id
              )
          );

        }
      );


  } catch (error) {

    box.innerHTML =
      `
        <div class="error">
          メモ取得失敗<br>
          ${esc(
            getErrorMessage(error)
          )}
        </div>
      `;

  }

}


/* =========================================================
   SAVE MEMO
========================================================= */

async function saveMemo() {

  if (!sb)
    return;


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
      $("memoTitle").value = "";


    if ($("memoContent"))
      $("memoContent").value = "";


    setStatus(
      "メモを保存しました。",
      "success"
    );


    await loadMemos();


  } catch (error) {

    setStatus(
      `メモ保存失敗: ${getErrorMessage(error)}`,
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

  if (!sb)
    return;


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
      `メモ削除失敗: ${getErrorMessage(error)}`,
      "error"
    );

  }

}


/* =========================================================
   3D MODEL
========================================================= */

function updateModelStatus(
  text
) {

  const node =
    $("modelStatus");


  if (node) {

    node.textContent =
      text;

  }

}


async function requestModelResearch() {

  if (!sb) {

    updateModelStatus(
      "ERROR"
    );

    return;

  }


  const type =
    $("modelType")
      ?.value ||
    "surface";


  const resolution =
    Number(
      $("modelResolution")
        ?.value ||
      40
    );


  const modelData = {

    type,

    resolution,

    source:
      "Research AI Lab 3D mathematical model"

  };


  updateModelStatus(
    "QUEUED"
  );


  try {

    const theme =
      `数学モデル探索: ${type}`;


    const payload = {

      theme,

      message:
        theme,

      model:
        modelData,

      source:
        "3D mathematical model",

      mode:
        "model_experiment",

      research_rules: {

        counterexample_search:
          true,

        alternative_transformations:
          true,

        physical_analogy:
          true,

        no_unverified_claims:
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
            "model_experiment",

          status:
            "queued",

          priority:
            5,

          payload

        })
        .select()
        .single();


    if (error)
      throw error;


    activeJobId =
      data.id;


    activeJobCreatedAt =
      data.created_at ||
      new Date().toISOString();


    lastJobData =
      data;


    lastJobStatus =
      data.status;


    queuePollCount =
      0;


    saveActiveJobState();


    renderJob(
      data
    );


    updateModelStatus(
      "QUEUED"
    );


    setStatus(
      "3D数学モデル研究をキューへ登録しました。Workerの次回実行を待っています。",
      "success"
    );


    startPolling();


  } catch (error) {

    console.error(
      "Model research:",
      error
    );


    updateModelStatus(
      "ERROR"
    );


    setStatus(
      `3Dモデル研究登録失敗: ${getErrorMessage(error)}`,
      "error"
    );

  }

}


/* =========================================================
   RESEARCH MODEL BRIDGE
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

    if (!sb)
      throw new Error(
        "Supabaseが初期化されていません。"
      );


    const theme =
      `数学モデル探索: ${
        JSON.stringify(
          modelData
        )
      }`;


    const payload = {

      theme,

      message:
        theme,

      model:
        modelData,

      source:
        "3D mathematical model",

      mode:
        "model_experiment",

      research_rules: {

        counterexample_search:
          true,

        alternative_transformations:
          true,

        physical_analogy:
          true,

        no_unverified_claims:
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
            "model_experiment",

          status:
            "queued",

          priority:
            5,

          payload

        })
        .select()
        .single();


    if (error)
      throw error;


    return data;

  }

};


/* =========================================================
   CLEAR INPUT
========================================================= */

function clearResearchInput() {

  const input =
    $("questionInput");


  if (input) {

    input.value =
      "";

  }


  setStatus(
    ""
  );

}


/* =========================================================
   INITIALIZE BUTTONS
========================================================= */

function initializeButtons() {

  /*
   * Research
   */

  const researchButton =
    $("researchButton");


  if (researchButton) {

    researchButton.addEventListener(
      "click",
      startResearch
    );

  }


  /*
   * Stop
   */

  const stopButton =
    $("stopButton");


  if (stopButton) {

    stopButton.addEventListener(
      "click",
      stopResearch
    );

  }


  /*
   * Clear
   */

  const clearButton =
    $("clearButton");


  if (clearButton) {

    clearButton.addEventListener(
      "click",
      clearResearchInput
    );

  }


  /*
   * Memo
   */

  const memoSaveButton =
    $("memoSaveButton");


  if (memoSaveButton) {

    memoSaveButton.addEventListener(
      "click",
      saveMemo
    );

  }


  /*
   * 3D Model
   */

  const modelResearchButton =
    $("modelResearchButton");


  if (modelResearchButton) {

    modelResearchButton.addEventListener(
      "click",
      requestModelResearch
    );

  }


  /*
   * Navigation
   */

  document
    .querySelectorAll(
      ".nav-button"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () =>
            showPage(
              button.dataset.page
            )
        );

      }
    );


  console.log(
    "Research AI Lab buttons initialized."
  );

}


/* =========================================================
   INITIAL LOAD
========================================================= */

async function initializeData() {

  /*
   * Connection
   */

  await checkConnection();


  /*
   * History
   */

  await loadHistory();


  /*
   * Background job
   */

  await recoverJob();

}


/* =========================================================
   INIT
========================================================= */

async function init() {

  console.log(
    "Research AI Lab initializing..."
  );


  /*
   * ButtonsはSupabase接続失敗でも
   * 登録しておく。
   *
   * これにより
   * 「Supabaseエラーだから全ボタン死亡」
   * を防ぐ。
   */

  initializeButtons();


  /*
   * Supabase
   */

  const supabaseReady =
    initializeSupabase();


  if (!supabaseReady) {

    setStatus(
      "Supabaseの読み込みに失敗しました。ページを再読み込みしてください。",
      "error"
    );


    return;

  }


  /*
   * データ初期化。
   *
   * ここでエラーが出ても
   * ボタンイベント自体は残る。
   */

  try {

    await initializeData();

  } catch (error) {

    console.error(
      "Initial data loading failed:",
      error
    );


    setStatus(
      `初期データ読み込み失敗: ${getErrorMessage(error)}`,
      "error"
    );

  }


  console.log(
    "Research AI Lab initialized."
  );

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
    () => {

      init();

    },
    {
      once: true
    }
  );

} else {

  init();

}


/* =========================================================
   GLOBAL DEBUG
========================================================= */

window.ResearchAILab = {

  getActiveJobId() {

    return activeJobId;

  },


  getActiveJob() {

    return lastJobData;

  },


  getJobStatus() {

    return lastJobStatus;

  },


  async refreshJob() {

    return refreshActiveJob();

  },


  startPolling() {

    startPolling();

  },


  stopPolling() {

    stopPolling();

  },


  async checkConnection() {

    return checkConnection();

  }

};
