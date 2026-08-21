/* =========================================================
   Research AI Lab
   app.js — Complete Integrated Version
   Worker false-detection fixed
   Queue monitoring strengthened
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


if (
  !window.supabase ||
  !window.supabase.createClient
) {

  console.error(
    "Supabase client is not available."
  );

}


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

let queueWarningShown = false;

let pollErrorCount = 0;


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_VISIBLE_RESULTS = 100;

const CONTEXT_RESULT_LIMIT = 30;

const ROUTE_RESULT_LIMIT = 100;

const JOB_LIMIT = 100;

const POLL_INTERVAL = 5000;


/*
 * 重要：
 *
 * queued状態を何分続けても
 * 「Worker起動失敗」とは判定しない。
 *
 * GitHub Actionsは5分cronなので、
 * 最大数分の待機は正常。
 */

const QUEUE_INFO_AFTER_MS =
  2 * 60 * 1000;


const QUEUE_LONG_WAIT_AFTER_MS =
  10 * 60 * 1000;


const QUEUE_STALE_WARNING_AFTER_MS =
  30 * 60 * 1000;


/*
 * DB上で終端とみなす状態。
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
   ERROR
========================================================= */

function getErrorMessage(
  error
) {

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
   RESULT SYMBOL
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
      text;

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

function showPage(
  page
) {

  document
    .querySelectorAll(
      ".page"
    )
    .forEach(section => {

      section.classList.toggle(
        "active",
        section.id ===
        `page-${page}`
      );

    });


  document
    .querySelectorAll(
      ".nav-button"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page ===
        page
      );

    });


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


  /*
   * AI研究メモリは
   * メニューから削除する想定。
   *
   * 既存HTMLにページが残っている場合でも
   * 呼び出し可能。
   */

  if (
    page ===
    "memory"
  ) {

    loadMemory();

  }


  /*
   * 探索ルートも旧UIとの互換性のため
   * 関数は残す。
   *
   * メニューから削除しても問題ない。
   */

  if (
    page ===
    "routes"
  ) {

    loadRoutes();

  }


  if (
    page ===
    "memos"
  ) {

    loadMemos();

  }

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


    const countNode =
      $("historyCount");


    if (countNode) {

      countNode.textContent =
        `${lastResults.length}件`;

    }


    /*
     * 重要変更：
     *
     * 初回表示では
     * 詳細を自動表示しない。
     *
     * ユーザーが結果を押したときだけ
     * 詳細を開く。
     */

    if (
      !selectedResult
    ) {

      const detail =
        $("detail");


      if (detail) {

        detail.innerHTML =
          `<div class="empty">
            研究結果を選択すると詳細が表示されます。
          </div>`;

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
      `<div class="error">
        履歴取得失敗<br>
        ${esc(
          getErrorMessage(error)
        )}
      </div>`;

  }

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
          getErrorMessage(error)
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
        .limit(
          JOB_LIMIT
        );


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
      data.map(
        job => {

          const status =
            job.status ||
            "unknown";


          const theme =
            parseJson(
              job.payload
            ).theme ||
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

        }
      ).join("");


  } catch (error) {

    box.innerHTML =
      `<div class="error">
        ジョブ取得失敗<br>
        ${esc(
          getErrorMessage(error)
        )}
      </div>`;

  }

}


/* =========================================================
   AI MEMORY
========================================================= */

async function loadMemory() {

  const box =
    $("memoryList");


  if (!box)
    return;


  try {

    const {
      count,
      error
    } =
      await sb
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
        );


    if (error)
      throw error;


    box.innerHTML = `

      <div class="memory-stat">

        <strong>
          ${count ?? 0}
        </strong>

        <span>
          AI側に保存されている研究結果
        </span>

      </div>

      <div class="info-card">

        <h3>
          AI研究メモリ
        </h3>

        <p>
          DBには研究結果をすべて保存します。
          画面上では最新${MAX_VISIBLE_RESULTS}件だけを表示します。
        </p>

        <p>
          AIは過去研究を次の研究コンテキストとして
          利用できます。
        </p>

      </div>

    `;


  } catch (error) {

    box.innerHTML =
      `<div class="error">
        ${esc(
          getErrorMessage(error)
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
        .limit(
          ROUTE_RESULT_LIMIT
        );


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
          getErrorMessage(error)
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
    rows.map(
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

      `
    ).join("");


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
                  item.id ===
                  element.dataset.id
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

}


/* =========================================================
   SAVE
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
        getErrorMessage(error)
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


    setStatus(
      "⭕️研究結果を再検証キューへ登録しました。Workerの次回実行を待っています。",
      "success"
    );


    activeJobId =
      data.id;


    activeJobCreatedAt =
      data.created_at ||
      new Date().toISOString();


    saveActiveJobState();


    renderJob(
      data
    );


    startPolling();


  } catch (error) {

    console.error(
      "Reverification:",
      error
    );


    setStatus(
      `再検証登録失敗: ${
        getErrorMessage(error)
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


  const researchButton =
    $("researchButton");


  const stopButton =
    $("stopButton");


  if (researchButton)
    researchButton.disabled = true;


  if (stopButton)
    stopButton.disabled = false;


  setStatus(
    "研究内容を準備しています...",
    "working"
  );


  try {

    /*
     * 過去研究を取得。
     */

    const context =
      await getResearchContext(
        theme
      );


    setStatus(
      "研究ジョブを登録しています...",
      "working"
    );


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

          payload: {

            theme,

            source:
              "Research AI Lab",

            mode:
              "autonomous_research",

            context,

            research_rules: {

              /*
               * 「未解決だから回答不可」
               * ではなく
               * 「未解決だから研究対象」
               */

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

              /*
               * 研究結論を壊す
               */

              adversarial_attempt:
                true,

              /*
               * 派生方向を複数生成
               */

              branch_exploration:
                true,

              /*
               * 共通失敗原因を分析
               */

              failure_pattern_analysis:
                true,

              /*
               * 過去研究との比較
               */

              historical_cross_check:
                true,

              /*
               * 別分野との類推
               */

              cross_field_analogy:
                true

            }

          }

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


    activeJobCreatedAt =
      data.created_at ||
      new Date().toISOString();


    lastJobStatus =
      data.status;


    lastJobData =
      data;


    pollingStartedAt =
      Date.now();


    queueWarningShown =
      false;


    pollErrorCount =
      0;


    saveActiveJobState();


    renderJob(
      data
    );


    /*
     * ここが今回の重要変更。
     *
     * Workerを即時確認しない。
     *
     * DBにqueuedで登録できた時点で
     * 「研究開始成功」。
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
      researchButton.disabled = false;


    if (stopButton)
      stopButton.disabled = true;


    setStatus(
      `研究開始失敗: ${
        getErrorMessage(error)
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


    /*
     * 過去研究取得失敗だけで
     * 新しい研究を開始不能にしない。
     */

    return {

      theme,

      previous_results: [],

      context_warning:
        getErrorMessage(error)

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


  const stopButton =
    $("stopButton");


  if (stopButton)
    stopButton.disabled = true;


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
      stopButton.disabled = false;


    setStatus(
      `停止失敗: ${
        getErrorMessage(error)
      }`,
      "error"
    );

  }

}


/* =========================================================
   JOB AGE
========================================================= */

function getJobAgeMs(
  job
) {

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
   QUEUE STATUS MESSAGE
========================================================= */

function getQueueStatusMessage(
  job
) {

  const age =
    getJobAgeMs(job);


  const seconds =
    Math.floor(
      age / 1000
    );


  const minutes =
    Math.floor(
      seconds / 60
    );


  /*
   * 通常待機。
   */

  if (
    age <
    QUEUE_INFO_AFTER_MS
  ) {

    return (
      "研究ジョブ登録済み・Workerの次回実行を待機中"
    );

  }


  /*
   * 2分以上。
   */

  if (
    age <
    QUEUE_LONG_WAIT_AFTER_MS
  ) {

    return (
      `研究キュー待機中（${minutes}分）。Workerの次回実行を待っています。`
    );

  }


  /*
   * 10分以上。
   *
   * ここでも失敗扱いにはしない。
   */

  if (
    age <
    QUEUE_STALE_WARNING_AFTER_MS
  ) {

    return (
      `研究キュー待機中（${minutes}分）。まだ失敗ではありません。Workerの実行状況を確認しています。`
    );

  }


  /*
   * 30分以上。
   *
   * 自動失敗にはしない。
   */

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


  if (jobId)
    jobId.textContent =
      job.id || "—";


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

      /*
       * queuedは10%。
       * Worker未起動=失敗ではない。
       */

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


  /*
   * 追加の詳細表示領域がHTMLにあれば
   * 自動利用する。
   */

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
   DURATION
========================================================= */

function formatDuration(
  ms
) {

  if (!ms || ms < 0)
    return "0秒";


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
   REFRESH ACTIVE JOB
========================================================= */

async function refreshActiveJob() {

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


    /*
     * 一時的に見えなくなっただけで
     * activeJobIdを即削除しない。
     */

    if (!data) {

      console.warn(
        "Active job not found:",
        activeJobId
      );


      pollErrorCount++;


      /*
       * 数回のDB取得失敗だけでは
       * ジョブを消さない。
       */

      if (
        pollErrorCount <
        5
      ) {

        setStatus(
          "研究ジョブの状態を一時的に取得できません。再確認しています...",
          "working"
        );


        return null;

      }


      /*
       * 5回以上確認できない場合も
       * 「Worker失敗」とは言わない。
       */

      setStatus(
        "研究ジョブの状態取得が不安定です。ジョブ自体は保持しています。",
        "error"
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
     * ============================================
     * QUEUED
     * ============================================
     */

    if (
      data.status ===
      "queued"
    ) {

      /*
       * 重要：
       *
       * Worker起動確認はしない。
       *
       * queued = 正常。
       */

      const message =
        getQueueStatusMessage(
          data
        );


      setStatus(
        message,
        "working"
      );


      return data;

    }


    /*
     * ============================================
     * RUNNING
     * ============================================
     */

    if (
      data.status ===
      "running"
    ) {

      setStatus(
        "AI研究を実行中です。研究結果を生成・検証しています。",
        "working"
      );


      return data;

    }


    /*
     * ============================================
     * TERMINAL
     * ============================================
     */

    const finished =
      TERMINAL_STATUSES
        .includes(
          data.status
        );


    if (!finished) {

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
     * 終了したので
     * ポーリング停止。
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
     * ============================================
     * COMPLETED
     * ============================================
     */

    if (
      data.status ===
      "completed"
    ) {

      setStatus(
        "研究完了。研究結果を取得しています。",
        "success"
      );


      /*
       * まずDB反映を待って履歴更新。
       */

      await loadHistory();


      /*
       * 最新結果を選択状態にする。
       *
       * ただし詳細を勝手に開く仕様にはしない。
       */

      selectedResult =
        null;


      /*
       * 数秒後にもう一度履歴更新。
       * Workerがjob更新→result insertを
       * ほぼ同時に行う場合の保険。
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
     * ============================================
     * FAILED
     * ============================================
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
     * ============================================
     * CANCELLED
     * ============================================
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
     * 終端後にactive jobを削除。
     */

    activeJobId =
      null;


    activeJobCreatedAt =
      null;


    lastJobData =
      null;


    lastJobStatus =
      null;


    clearActiveJobState();


    return data;


  } catch (error) {

    console.error(
      "Job polling:",
      error
    );


    pollErrorCount++;


    /*
     * 取得エラーでは
     * Worker失敗と判定しない。
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
   * 以降5秒ごと。
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
   ACTIVE JOB STORAGE
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


/* =========================================================
   CLEAR ACTIVE JOB STORAGE
========================================================= */

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


  /*
   * ページを閉じて戻ってきても
   * DBから実際の状態を確認する。
   */

  setStatus(
    "進行中の研究ジョブを確認しています...",
    "working"
  );


  const data =
    await refreshActiveJob();


  /*
   * まだactiveJobIdが残っていれば
   * queued/runningなので監視継続。
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

  } else if (
    data
  ) {

    /*
     * すでに終了していた場合。
     */

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
      `<div class="error">
        メモ取得失敗<br>
        ${esc(
          getErrorMessage(error)
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
      `メモ保存失敗: ${
        getErrorMessage(error)
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
        getErrorMessage(error)
      }`,
      "error"
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


  async requestModelResearch(
    modelData
  ) {

    const theme =
      `数学モデル探索: ${
        JSON.stringify(
          modelData
        )
      }`;


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

          }

        })
        .select()
        .single();


    if (error)
      throw error;


    return data;

  }

};


/* =========================================================
   INIT
========================================================= */

function init() {

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


  /*
   * Research
   */

  $("researchButton")
    ?.addEventListener(
      "click",
      startResearch
    );


  /*
   * Stop
   */

  $("stopButton")
    ?.addEventListener(
      "click",
      stopResearch
    );


  /*
   * Clear
   */

  $("clearButton")
    ?.addEventListener(
      "click",
      () => {

        if ($("questionInput")) {

          $("questionInput")
            .value = "";

        }


        setStatus("");

      }
    );


  /*
   * Memo
   */

  $("memoSaveButton")
    ?.addEventListener(
      "click",
      saveMemo
    );


  /*
   * Connection
   */

  checkConnection();


  /*
   * Initial history
   */

  loadHistory();


  /*
   * Background job recovery
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
