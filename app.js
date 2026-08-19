/* =========================================================
   Research AI Lab
   app.js — Integrated Version
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
   STATE
========================================================= */

let activeJobId =
  localStorage.getItem(
    "active_research_job"
  ) || null;

let pollTimer = null;

let lastResults = [];

let selectedResult = null;

let researchContext = [];

let routeCache = [];

let isStartingResearch = false;


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_VISIBLE_RESULTS = 100;

const POLL_INTERVAL = 5000;

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
   RESULT SYMBOL
========================================================= */

function resultSymbol(result) {

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

  if (page === "memory")
    loadMemory();

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


    $("historyCount")
      .textContent =
      `${lastResults.length}件`;


    renderResults(
      box,
      lastResults
    );


    if (
      lastResults.length &&
      !selectedResult
    ) {

      selectedResult =
        lastResults[0];

      renderDetail(
        selectedResult
      );

    }


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
          AIは将来的にこの履歴から、
          失敗した理由、反例、
          過去に試した研究ルート、
          成功した検証方法などを
          次の研究コンテキストとして利用できます。
        </p>

      </div>

    `;


  } catch (error) {

    box.innerHTML =
      `<div class="error">
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
                item.id ===
                element.dataset.id
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

  const content =
    parseJson(
      result.content
    );


  $("detail").innerHTML = `

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
      "⭕️研究結果を再検証キューへ登録しました。",
      "success"
    );


    activeJobId =
      data.id;


    localStorage.setItem(
      "active_research_job",
      activeJobId
    );


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


  $("researchButton")
    .disabled = true;

  $("stopButton")
    .disabled = false;


  setStatus(
    "研究ジョブをキューへ登録しています..."
  );


  try {

    /*
     * 過去研究を取得。
     * GitHub Actions側でさらに利用できるよう
     * payloadにも入れる。
     */

    const context =
      await getResearchContext(
        theme
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


    localStorage.setItem(
      "active_research_job",
      activeJobId
    );


    renderJob(
      data
    );


    setStatus(
      "研究をキューに登録しました。バックグラウンド研究を開始します。",
      "success"
    );


    startPolling();


  } catch (error) {

    console.error(
      "Start research:",
      error
    );


    $("researchButton")
      .disabled = false;

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
        .limit(30);


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


  $("jobId")
    .textContent =
    job.id || "—";


  $("jobStatus")
    .textContent =
    String(
      job.status ||
      "unknown"
    ).toUpperCase();


  $("jobCreated")
    .textContent =
    formatDate(
      job.created_at
    );


  $("jobStarted")
    .textContent =
    formatDate(
      job.started_at
    );


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

      $("researchButton")
        .disabled = false;

      $("stopButton")
        .disabled = true;

      return;

    }


    renderJob(
      data
    );


    const finished =
      TERMINAL_STATUSES
        .includes(
          data.status
        );


    if (!finished)
      return;


    stopPolling();


    $("researchButton")
      .disabled = false;

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


      await loadHistory();


      /*
       * 結果が保存された後、
       * 画面上の研究データも更新。
       */

      selectedResult =
        null;

    }


    if (
      data.status ===
      "failed"
    ) {

      setStatus(
        `研究失敗: ${
          data.error_message ||
          "GitHub Actions worker error"
        }`,
        "error"
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


    $("memoTitle")
      .value = "";

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


  await refreshActiveJob();


  if (activeJobId) {

    $("researchButton")
      .disabled = true;

    $("stopButton")
      .disabled = false;

    startPolling();

  }

}


/* =========================================================
   3D RESEARCH BRIDGE
========================================================= */

/*
 * 3Dモデル側から研究結果を受け取るための
 * 共通API。
 *
 * index.html側の3Dエンジンは、
 * 将来的にこの関数を呼び出せる。
 */

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


  $("researchButton")
    ?.addEventListener(
      "click",
      startResearch
    );


  $("stopButton")
    ?.addEventListener(
      "click",
      stopResearch
    );


  $("clearButton")
    ?.addEventListener(
      "click",
      () => {

        $("questionInput")
          .value = "";

        setStatus("");

      }
    );


  $("memoSaveButton")
    ?.addEventListener(
      "click",
      saveMemo
    );


  checkConnection();

  loadHistory();

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
