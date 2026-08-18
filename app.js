"use strict";

/*
============================================================
Research AI Lab
Frontend controller
============================================================

Architecture:

Browser
  ↓
Supabase
  ↓
research_jobs
  ↓
GitHub Actions
  ↓
OpenRouter
  ↓
research_results
  ↓
Browser

IMPORTANT:
Never put SUPABASE_SERVICE_ROLE_KEY or OPENROUTER_API_KEY here.
============================================================
*/


/* =========================================================
   CONFIG
========================================================= */

const SUPABASE_URL =
  "https://hiefdcodifkfhnqvruzn.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_HmcPY6BGvUQTPESGHVe7Hw_W4NlTPqj";

/*
現在使用している研究プロジェクトID
*/
const DEFAULT_PROJECT_ID =
  "ab429192-27d2-47e4-9ad7-08b639f45120";


/*
GitHub Actions側と一致させる
*/
const JOB_TYPE =
  "research_cycle";


const MAX_VISIBLE_RESULTS =
  100;


/* =========================================================
   SUPABASE CLIENT
========================================================= */

const supabase =
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


/* =========================================================
   STATE
========================================================= */

let currentProjectId =
  localStorage.getItem(
    "research_project_id"
  ) ||
  DEFAULT_PROJECT_ID;


localStorage.setItem(
  "research_project_id",
  currentProjectId
);


let currentJob = null;
let latestResult = null;

let pollTimer = null;

let resultsCache = [];

let notes = [];


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (id) =>
  document.getElementById(id);


const questionInput =
  $("questionInput");

const researchButton =
  $("researchButton");

const stopButton =
  $("stopButton");

const clearButton =
  $("clearButton");

const statusBox =
  $("statusBox");

const connectionDot =
  $("connectionDot");

const connectionText =
  $("connectionText");

const progressPanel =
  $("progressPanel");

const progressValue =
  $("progressValue");

const jobStatusText =
  $("jobStatusText");

const jobPercent =
  $("jobPercent");

const jobIdText =
  $("jobIdText");

const jobStatusSmall =
  $("jobStatusSmall");

const latestSection =
  $("latestSection");

const latestTitle =
  $("latestTitle");

const latestDate =
  $("latestDate");

const latestEvaluation =
  $("latestEvaluation");

const latestConfidence =
  $("latestConfidence");

const latestSummary =
  $("latestSummary");

const latestTags =
  $("latestTags");

const latestDetails =
  $("latestDetails");

const historyList =
  $("historyList");

const savedList =
  $("savedList");

const jobsList =
  $("jobsList");

const notesList =
  $("notesList");

const toast =
  $("toast");


/* =========================================================
   BASIC UI
========================================================= */

function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function showStatus(
  message,
  type = ""
) {

  statusBox.textContent =
    message;

  statusBox.className =
    "status-box";

  if (type) {
    statusBox.classList.add(type);
  }

}


function hideStatus() {

  statusBox.className =
    "status-box hidden";

}


function showToast(message) {

  toast.textContent =
    message;

  toast.classList.add("show");

  clearTimeout(
    showToast.timer
  );

  showToast.timer =
    setTimeout(
      () => {
        toast.classList.remove("show");
      },
      2600
    );

}


function formatDate(value) {

  if (!value) {
    return "—";
  }

  try {

    return new Date(value)
      .toLocaleString(
        "ja-JP",
        {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        }
      );

  } catch {

    return String(value);

  }

}


function setConnection(
  ok,
  text
) {

  connectionDot.className =
    "status-dot " +
    (ok ? "ok" : "error");

  connectionText.textContent =
    text;

}


/* =========================================================
   TAB SYSTEM
========================================================= */

document
  .querySelectorAll(".tab")
  .forEach((button) => {

    button.addEventListener(
      "click",
      async () => {

        const target =
          button.dataset.tab;

        document
          .querySelectorAll(".tab")
          .forEach((item) => {

            item.classList.toggle(
              "active",
              item === button
            );

        });


        document
          .querySelectorAll(".tab-page")
          .forEach((page) => {

            page.classList.toggle(
              "active",
              page.id ===
              `tab-${target}`
            );

        });


        if (target === "history") {
          await loadHistory();
        }

        if (target === "saved") {
          await loadSaved();
        }

        if (target === "jobs") {
          await loadJobs();
        }

        if (target === "notes") {
          renderNotes();
        }

        if (target === "visual") {
          resizeCanvas();
          drawResearchModel();
        }

      });

  });


/* =========================================================
   QUICK THEMES
========================================================= */

document
  .querySelectorAll(".quick-theme")
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        const theme =
          button.dataset.theme;

        questionInput.value =
          `テーマ: ${theme}\n\n` +
          "このテーマについて、既存研究の単純な再説明ではなく、別の数学的構造・証明戦略・反例探索から新しい研究仮説を検討してください。";

        questionInput.focus();

      }
    );

  });


/* =========================================================
   SUPABASE CONNECTION
========================================================= */

async function checkConnection() {

  try {

    const {
      error
    } = await supabase
      .from("research_results")
      .select("id")
      .eq(
        "project_id",
        currentProjectId
      )
      .limit(1);


    if (error) {
      throw error;
    }


    setConnection(
      true,
      "Supabase 接続OK"
    );

    return true;

  } catch (error) {

    console.error(
      "Supabase connection error:",
      error
    );

    setConnection(
      false,
      "Supabase 接続エラー"
    );

    return false;

  }

}


/* =========================================================
   CREATE RESEARCH JOB
========================================================= */

async function createResearchJob() {

  const question =
    questionInput.value.trim();


  if (!question) {

    showStatus(
      "研究テーマを入力してください。",
      "error"
    );

    questionInput.focus();

    return null;

  }


  const payload = {

    mode:
      "autonomous",

    theme:
      question,

    max_route_attempts:
      3,

    enable_literature_check:
      true,

    enable_cross_domain_search:
      true,

    enable_reductio_ad_absurdum:
      true,

    enable_counterexample_search:
      true,

    require_independent_verification:
      true

  };


  /*
  IMPORTANT:

  ここではAIを直接呼ばない。

  research_jobsへqueuedを作り、
  GitHub Actionsが取得する。
  */

  const {
    data,
    error
  } = await supabase
    .from("research_jobs")
    .insert({
      project_id:
        currentProjectId,

      job_type:
        JOB_TYPE,

      status:
        "queued",

      priority:
        10,

      payload:
        payload
    })
    .select("*")
    .single();


  if (error) {

    console.error(
      "createResearchJob:",
      error
    );

    throw new Error(
      `研究ジョブ作成失敗: ${error.message}`
    );

  }


  return data;

}


/* =========================================================
   START RESEARCH
========================================================= */

async function startResearch() {

  if (currentJob) {

    showToast(
      "すでに研究ジョブが存在します。"
    );

    return;

  }


  try {

    researchButton.disabled =
      true;

    stopButton.disabled =
      true;

    showStatus(
      "研究ジョブをキューに登録しています..."
    );


    const job =
      await createResearchJob();


    if (!job) {
      return;
    }


    currentJob =
      job;


    updateJobUI(
      job
    );


    progressPanel
      .classList.remove("hidden");


    showStatus(
      "研究ジョブをキューに登録しました。\n" +
      "GitHub Actionsがqueuedジョブを取得すると研究が開始されます。",
      "success"
    );


    /*
    queuedの間は停止可能。
    */
    stopButton.disabled =
      false;


    startPolling();


    /*
    すぐにDBから最新状態を確認。
    */
    await refreshCurrentJob();


  } catch (error) {

    console.error(
      "startResearch:",
      error
    );


    showStatus(
      error.message ||
      String(error),
      "error"
    );


    researchButton.disabled =
      false;

    stopButton.disabled =
      true;

  }

}


/* =========================================================
   JOB POLLING
========================================================= */

function startPolling() {

  stopPolling();


  pollTimer =
    setInterval(
      refreshCurrentJob,
      5000
    );

}


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
   REFRESH CURRENT JOB
========================================================= */

async function refreshCurrentJob() {

  if (!currentJob?.id) {
    return;
  }


  try {

    const {
      data,
      error
    } = await supabase
      .from("research_jobs")
      .select("*")
      .eq(
        "id",
        currentJob.id
      )
      .maybeSingle();


    if (error) {
      throw error;
    }


    /*
    cancel等で見つからない場合
    */
    if (!data) {

      stopPolling();

      showStatus(
        "研究ジョブが見つからなくなりました。"
      );

      return;

    }


    currentJob =
      data;


    updateJobUI(
      data
    );


    if (
      data.status ===
      "completed"
    ) {

      stopPolling();

      researchButton.disabled =
        false;

      stopButton.disabled =
        true;

      showStatus(
        "研究が完了しました。",
        "success"
      );


      await loadHistory();

      await loadLatestResult();


      currentJob =
        null;


      return;

    }


    if (
      data.status ===
      "cancelled"
    ) {

      stopPolling();

      researchButton.disabled =
        false;

      stopButton.disabled =
        true;

      showStatus(
        "研究ジョブを停止しました。"
      );


      currentJob =
        null;


      return;

    }


    if (
      data.status ===
      "failed"
    ) {

      stopPolling();

      researchButton.disabled =
        false;

      stopButton.disabled =
        true;

      showStatus(
        data.error_message ||
        "研究ジョブが失敗しました。",
        "error"
      );


      currentJob =
        null;


      return;

    }


    /*
    queued / running
    */

    researchButton.disabled =
      true;

    stopButton.disabled =
      false;


  } catch (error) {

    console.error(
      "refreshCurrentJob:",
      error
    );

    showStatus(
      `ジョブ状態取得エラー: ${error.message}`,
      "error"
    );

  }

}


/* =========================================================
   UPDATE JOB UI
========================================================= */

function updateJobUI(job) {

  const status =
    String(
      job?.status ||
      "unknown"
    ).toLowerCase();


  let percent = 0;

  let text =
    "準備中";


  if (status === "queued") {

    percent = 12;
    text = "QUEUED / 待機中";

  }

  else if (status === "running") {

    percent = 55;
    text = "RUNNING / AI研究中";

  }

  else if (status === "completed") {

    percent = 100;
    text = "COMPLETED / 完了";

  }

  else if (status === "cancelled") {

    percent = 0;
    text = "CANCELLED / 停止";

  }

  else if (status === "failed") {

    percent = 0;
    text = "FAILED / 失敗";

  }


  progressValue.style.width =
    `${percent}%`;

  jobPercent.textContent =
    `${percent}%`;

  jobStatusText.textContent =
    text;

  jobStatusSmall.textContent =
    status.toUpperCase();

  jobIdText.textContent =
    job.id || "—";


  progressPanel
    .classList.remove("hidden");

}


/* =========================================================
   STOP / CANCEL JOB
========================================================= */

async function stopResearch() {

  if (!currentJob?.id) {

    showToast(
      "停止できる研究ジョブがありません。"
    );

    return;

  }


  const confirmed =
    window.confirm(
      "現在の研究ジョブを停止しますか？"
    );


  if (!confirmed) {
    return;
  }


  try {

    stopButton.disabled =
      true;


    /*
    queued または running の
    ジョブだけ停止対象。
    */

    const {
      data,
      error
    } = await supabase
      .from("research_jobs")
      .update({
        status:
          "cancelled",

        finished_at:
          new Date().toISOString()
      })
      .eq(
        "id",
        currentJob.id
      )
      .in(
        "status",
        ["queued", "running"]
      )
      .select("*")
      .maybeSingle();


    if (error) {
      throw error;
    }


    if (!data) {

      throw new Error(
        "ジョブを停止できませんでした。すでに完了または別の状態になっている可能性があります。"
      );

    }


    currentJob =
      data;


    updateJobUI(
      data
    );


    stopPolling();


    researchButton.disabled =
      false;


    stopButton.disabled =
      true;


    showStatus(
      "研究ジョブを停止しました。",
      "success"
    );


    currentJob =
      null;


  } catch (error) {

    console.error(
      "stopResearch:",
      error
    );


    stopButton.disabled =
      false;


    showStatus(
      `研究停止エラー: ${error.message}`,
      "error"
    );

  }

}


/* =========================================================
   LOAD RESULTS
========================================================= */

async function loadHistory() {

  historyList.innerHTML =
    `<div class="empty-state">読み込み中...</div>`;


  try {

    const {
      data,
      error
    } = await supabase
      .from("research_results")
      .select("*")
      .eq(
        "project_id",
        currentProjectId
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


    if (error) {
      throw error;
    }


    resultsCache =
      data || [];


    renderResultList(
      historyList,
      resultsCache
    );


  } catch (error) {

    console.error(
      "loadHistory:",
      error
    );


    historyList.innerHTML =
      `<div class="empty-state">
        履歴取得エラー:<br>
        ${escapeHtml(error.message)}
      </div>`;

  }

}


/* =========================================================
   LOAD SAVED
========================================================= */

async function loadSaved() {

  savedList.innerHTML =
    `<div class="empty-state">読み込み中...</div>`;


  try {

    const {
      data,
      error
    } = await supabase
      .from("research_results")
      .select("*")
      .eq(
        "project_id",
        currentProjectId
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


    if (error) {
      throw error;
    }


    renderResultList(
      savedList,
      data || []
    );


  } catch (error) {

    savedList.innerHTML =
      `<div class="empty-state">
        ⭕保存結果を取得できませんでした。<br>
        ${escapeHtml(error.message)}
      </div>`;

  }

}


/* =========================================================
   RESULT PARSER
========================================================= */

function parseContent(result) {

  if (!result) {
    return {};
  }


  if (
    typeof result.content ===
    "object" &&
    result.content !== null
  ) {

    return result.content;

  }


  if (
    typeof result.content ===
    "string"
  ) {

    try {

      return JSON.parse(
        result.content
      );

    } catch {

      return {
        summary:
          result.content
      };

    }

  }


  return {};

}


/* =========================================================
   EVALUATION
========================================================= */

function evaluationClass(
  evaluation
) {

  if (evaluation === "⭕️" ||
      evaluation === "⭕") {

    return "good";

  }

  if (evaluation === "❌") {
    return "bad";
  }

  if (evaluation === "△") {
    return "maybe";
  }

  return "";

}


function evaluationSymbol(
  evaluation
) {

  if (evaluation === "⭕️" ||
      evaluation === "⭕") {

    return "⭕";

  }

  if (evaluation === "❌") {
    return "❌";
  }

  if (evaluation === "△") {
    return "△";
  }

  return "—";

}


/* =========================================================
   RESULT LIST
========================================================= */

function renderResultList(
  container,
  results
) {

  if (!results.length) {

    container.innerHTML =
      `<div class="empty-state">
        研究結果はまだありません。
      </div>`;

    return;

  }


  container.innerHTML =
    results
      .map(
        (result) => {

          const content =
            parseContent(
              result
            );


          const evaluation =
            result.evaluation ||
            "△";


          const symbol =
            evaluationSymbol(
              evaluation
            );


          const cls =
            evaluationClass(
              evaluation
            );


          const summary =
            content.critical_gap ||
            content.research_question ||
            content.summary ||
            result.hypothesis ||
            "";


          return `
            <article
              class="result-card"
              data-result-id="${escapeHtml(result.id)}"
            >

              <div class="card-top">

                <div>

                  <h3 class="card-title">
                    ${escapeHtml(result.title)}
                  </h3>

                  <div class="card-date">
                    ${formatDate(result.created_at)}
                  </div>

                </div>

                <div class="card-symbol ${cls}">
                  ${symbol}
                </div>

              </div>


              <div class="card-summary">
                ${escapeHtml(summary)}
              </div>


              <div class="card-actions">

                <button
                  class="btn secondary result-open"
                  data-id="${escapeHtml(result.id)}"
                >
                  詳細
                </button>

                ${
                  result.is_human_saved
                    ? `<span class="tag">⭕保存済み</span>`
                    : `<button
                        class="btn secondary result-save"
                        data-id="${escapeHtml(result.id)}"
                      >
                        ⭕保存
                      </button>`
                }

              </div>

            </article>
          `;

        }
      )
      .join("");


  container
    .querySelectorAll(".result-open")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          const id =
            button.dataset.id;

          const result =
            resultsCache.find(
              (item) =>
                item.id === id
            );


          if (result) {
            displayLatest(
              result
            );

            activateTab(
              "research"
            );
          }

        }
      );

    });


  container
    .querySelectorAll(".result-save")
    .forEach((button) => {

      button.addEventListener(
        "click",
        async () => {

          await saveResult(
            button.dataset.id
          );

        }
      );

    });

}


/* =========================================================
   LATEST RESULT
========================================================= */

async function loadLatestResult() {

  try {

    const {
      data,
      error
    } = await supabase
      .from("research_results")
      .select("*")
      .eq(
        "project_id",
        currentProjectId
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(1)
      .maybeSingle();


    if (error) {
      throw error;
    }


    if (data) {

      latestResult =
        data;

      displayLatest(
        data
      );

    }

  } catch (error) {

    console.error(
      "loadLatestResult:",
      error
    );

  }

}


/* =========================================================
   DISPLAY LATEST
========================================================= */

function displayLatest(
  result
) {

  if (!result) {
    return;
  }


  latestResult =
    result;


  const content =
    parseContent(
      result
    );


  const evaluation =
    result.evaluation ||
    "△";


  const symbol =
    evaluationSymbol(
      evaluation
    );


  const cls =
    evaluationClass(
      evaluation
    );


  latestSection
    .classList.remove("hidden");


  latestTitle.textContent =
    result.title ||
    "研究結果";


  latestDate.textContent =
    formatDate(
      result.created_at
    );


  latestEvaluation.textContent =
    symbol;


  latestEvaluation.className =
    "evaluation-badge " +
    cls;


  const confidence =
    Number(
      result.confidence_level
    );


  latestConfidence.textContent =
    Number.isFinite(confidence)
      ? `Confidence ${confidence}/5`
      : "Confidence —";


  latestSummary.textContent =
    content.research_question ||
    content.summary ||
    result.hypothesis ||
    "研究結果の概要はありません。";


  latestTags.innerHTML =
    `
      <span class="tag">
        status: ${escapeHtml(result.status)}
      </span>

      <span class="tag">
        confidence: ${escapeHtml(result.confidence_level)}
      </span>

      ${
        result.is_human_saved
          ? `<span class="tag">⭕ human saved</span>`
          : ""
      }
    `;


  setDetail(
    "detailHypothesis",
    result.hypothesis
  );


  setDetail(
    "detailApproach",
    arrayOrText(
      content.approach
    )
  );


  setDetail(
    "detailKnownFacts",
    arrayOrText(
      content.known_facts
    )
  );


  setDetail(
    "detailProof",
    arrayOrText(
      content.proof_strategy
    )
  );


  setDetail(
    "detailCounterexample",
    arrayOrText(
      content.counterexample_strategy
    )
  );


  setDetail(
    "detailGap",
    content.critical_gap
  );


  setDetail(
    "detailNext",
    arrayOrText(
      content.next_steps
    );


  const saveButton =
    $("saveLatestButton");


  if (result.is_human_saved) {

    saveButton.textContent =
      "⭕ 保存済み";

    saveButton.disabled =
      true;

  } else {

    saveButton.textContent =
      "⭕として保存";

    saveButton.disabled =
      false;

  }


  updateVisualModel(
    result
  );

}


function setDetail(
  id,
  value
) {

  const element =
    $(id);

  if (!element) {
    return;
  }

  element.textContent =
    value ||
    "—";

}


function arrayOrText(
  value
) {

  if (
    Array.isArray(value)
  ) {

    return value
      .map(
        (item) =>
          typeof item === "string"
            ? item
            : JSON.stringify(
                item
              )
      )
      .join("\n");

  }


  return String(
    value ||
    ""
  );

}


/* =========================================================
   SAVE RESULT
========================================================= */

async function saveResult(
  resultId
) {

  try {

    const {
      data,
      error
    } = await supabase
      .from("research_results")
      .update({
        is_human_saved:
          true
      })
      .eq(
        "id",
        resultId
      )
      .select("*")
      .maybeSingle();


    if (error) {
      throw error;
    }


    if (!data) {

      throw new Error(
        "保存対象が見つかりませんでした。"
      );

    }


    showToast(
      "⭕として保存しました"
    );


    await loadHistory();

    await loadSaved();

    await loadLatestResult();


  } catch (error) {

    console.error(
      "saveResult:",
      error
    );


    showStatus(
      `保存エラー: ${error.message}`,
      "error"
    );

  }

}


/* =========================================================
   DETAILS BUTTON
========================================================= */

$("detailsButton")
  .addEventListener(
    "click",
    () => {

      latestDetails
        .classList.toggle(
          "hidden"
        );

    }
  );


$("saveLatestButton")
  .addEventListener(
    "click",
    async () => {

      if (
        latestResult?.id
      ) {

        await saveResult(
          latestResult.id
        );

      }

    }
  );


/* =========================================================
   JOB LIST
========================================================= */

async function loadJobs() {

  jobsList.innerHTML =
    `<div class="empty-state">
      ジョブを読み込み中...
    </div>`;


  try {

    const {
      data,
      error
    } = await supabase
      .from("research_jobs")
      .select("*")
      .eq(
        "project_id",
        currentProjectId
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(100);


    if (error) {
      throw error;
    }


    if (!data?.length) {

      jobsList.innerHTML =
        `<div class="empty-state">
          研究ジョブはありません。
        </div>`;

      return;

    }


    jobsList.innerHTML =
      data
        .map(
          (job) => {

            const payload =
              job.payload ||
              {};


            const status =
              String(
                job.status ||
                "unknown"
              ).toLowerCase();


            return `
              <article class="job-card">

                <div class="card-top">

                  <div>

                    <h3 class="card-title">
                      ${escapeHtml(job.job_type)}
                    </h3>

                    <div class="card-date">
                      ${formatDate(job.created_at)}
                    </div>

                  </div>

                  <span class="job-status ${status}">
                    ${escapeHtml(status)}
                  </span>

                </div>


                <div class="job-theme">
                  ${escapeHtml(
                    payload.theme ||
                    "テーマなし"
                  )}
                </div>


                <div class="job-id">
                  ID: ${escapeHtml(job.id)}
                </div>

              </article>
            `;

          }
        )
        .join("");


  } catch (error) {

    jobsList.innerHTML =
      `<div class="empty-state">
        ジョブ取得エラー:<br>
        ${escapeHtml(error.message)}
      </div>`;

  }

}


/* =========================================================
   NOTES
========================================================= */

function loadNotes() {

  try {

    notes =
      JSON.parse(
        localStorage.getItem(
          "research_lab_notes"
        ) ||
        "[]"
      );

  } catch {

    notes = [];

  }

}


function saveNotes() {

  localStorage.setItem(
    "research_lab_notes",
    JSON.stringify(notes)
  );

}


function renderNotes() {

  if (!notes.length) {

    notesList.innerHTML =
      `<div class="empty-state">
        まだメモがありません。
      </div>`;

    return;

  }


  notesList.innerHTML =
    notes
      .map(
        (note) => `
          <article
            class="note-card"
          >

            <button
              class="note-delete"
              data-id="${escapeHtml(note.id)}"
            >
              削除
            </button>

            <h4>
              ${escapeHtml(note.title)}
            </h4>

            <p>
              ${escapeHtml(note.content)}
            </p>

            <div class="note-date">
              ${formatDate(note.createdAt)}
            </div>

          </article>
        `
      )
      .join("");


  notesList
    .querySelectorAll(".note-delete")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          notes =
            notes.filter(
              (note) =>
                note.id !==
                button.dataset.id
            );


          saveNotes();

          renderNotes();

          showToast(
            "メモを削除しました"
          );

        }
      );

    });

}


$("addNoteButton")
  .addEventListener(
    "click",
    () => {

      const title =
        $("noteTitle")
          .value
          .trim();

      const content =
        $("noteContent")
          .value
          .trim();


      if (!content) {

        showToast(
          "メモ内容を入力してください"
        );

        return;

      }


      notes.unshift({

        id:
          crypto.randomUUID(),

        title:
          title ||
          "無題の研究メモ",

        content:
          content,

        createdAt:
          new Date().toISOString()

      });


      saveNotes();

      renderNotes();


      $("noteTitle").value =
        "";

      $("noteContent").value =
        "";


      showToast(
        "メモを保存しました"
      );

    }
  );


/* =========================================================
   HANDOVER
========================================================= */

$("generateHandoverButton")
  .addEventListener(
    "click",
    async () => {

      try {

        const {
          data: results,
          error
        } = await supabase
          .from("research_results")
          .select("*")
          .eq(
            "project_id",
            currentProjectId
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          )
          .limit(20);


        if (error) {
          throw error;
        }


        const {
          data: jobs,
          error: jobsError
        } = await supabase
          .from("research_jobs")
          .select("*")
          .eq(
            "project_id",
            currentProjectId
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          )
          .limit(10);


        if (jobsError) {
          throw jobsError;
        }


        const saved =
          (results || [])
            .filter(
              (r) =>
                r.is_human_saved
            );


        const lines = [];


        lines.push(
          "# Research AI Lab 引き継ぎ文"
        );

        lines.push("");

        lines.push(
          "## プロジェクト"
        );

        lines.push(
          `Project ID: ${currentProjectId}`
        );

        lines.push("");

        lines.push(
          "## 研究システム"
        );

        lines.push(
          "Supabase research_jobs → GitHub Actions → OpenRouter → research_results"
        );

        lines.push("");

        lines.push(
          "## 重要なルール"
        );

        lines.push(
          "- 未証明の主張を証明済みと扱わない"
        );

        lines.push(
          "- 既知の事実と仮説を分離する"
        );

        lines.push(
          "- 反例探索を行う"
        );

        lines.push(
          "- 数値実験だけで数学的証明とは判断しない"
        );

        lines.push(
          "- 同一研究ルートを3回以上繰り返さない"
        );

        lines.push("");

        lines.push(
          "## 保存された重要研究"
        );


        if (!saved.length) {

          lines.push(
            "まだ⭕保存された結果はありません。"
          );

        } else {

          saved.forEach(
            (result, index) => {

              lines.push(
                `${index + 1}. ${result.title}`
              );

              lines.push(
                `   仮説: ${result.hypothesis || "—"}`
              );

              const content =
                parseContent(
                  result
                );

              lines.push(
                `   論理的ギャップ: ${
                  content.critical_gap ||
                  "—"
                }`
              );

            }
          );

        }


        lines.push("");

        lines.push(
          "## 最近の研究"
        );


        (results || [])
          .slice(0, 10)
          .forEach(
            (result, index) => {

              lines.push(
                `${index + 1}. ${result.title} [${result.evaluation || "△"}]`
              );

            }
          );


        lines.push("");

        lines.push(
          "## 最近のジョブ"
        );


        (jobs || [])
          .slice(0, 5)
          .forEach(
            (job) => {

              const payload =
                job.payload ||
                {};

              lines.push(
                `- ${job.status}: ${
                  payload.theme ||
                  "テーマなし"
                }`
              );

            }
          );


        lines.push("");

        lines.push(
          "## 引き継ぎメモ"
        );


        notes
          .slice(0, 20)
          .forEach(
            (note) => {

              lines.push(
                `### ${note.title}`
              );

              lines.push(
                note.content
              );

              lines.push("");

            }
          );


        $("handoverText").value =
          lines.join("\n");


        showToast(
          "引き継ぎ文を生成しました"
        );


      } catch (error) {

        console.error(
          "handover:",
          error
        );


        showToast(
          `引き継ぎ生成エラー: ${error.message}`
        );

      }

    }
  );


$("copyHandoverButton")
  .addEventListener(
    "click",
    async () => {

      const text =
        $("handoverText").value;


      if (!text) {

        showToast(
          "先に引き継ぎ文を生成してください"
        );

        return;

      }


      try {

        await navigator.clipboard.writeText(
          text
        );

        showToast(
          "コピーしました"
        );

      } catch {

        $("handoverText").select();

        document.execCommand(
          "copy"
        );

        showToast(
          "コピーしました"
        );

      }

    }
  );


$("clearHandoverButton")
  .addEventListener(
    "click",
    () => {

      $("handoverText").value =
        "";

    }
  );


/* =========================================================
   CLEAR
========================================================= */

clearButton
  .addEventListener(
    "click",
    () => {

      questionInput.value =
        "";

      hideStatus();

      questionInput.focus();

    }
  );


/* =========================================================
   BUTTONS
========================================================= */

researchButton
  .addEventListener(
    "click",
    startResearch
  );


stopButton
  .addEventListener(
    "click",
    stopResearch
  );


$("refreshHistoryButton")
  .addEventListener(
    "click",
    loadHistory
  );


$("refreshSavedButton")
  .addEventListener(
    "click",
    loadSaved
  );


$("refreshJobsButton")
  .addEventListener(
    "click",
    loadJobs
  );


/* =========================================================
   TAB ACTIVATION
========================================================= */

function activateTab(
  name
) {

  const button =
    document.querySelector(
      `.tab[data-tab="${name}"]`
    );

  if (button) {
    button.click();
  }

}


/* =========================================================
   3D / CANVAS
========================================================= */

const canvas =
  $("researchCanvas");

const ctx =
  canvas.getContext("2d");


let visualNodes = [];

let visualEdges = [];

let animationFrame = null;


function resizeCanvas() {

  if (!canvas) {
    return;
  }


  const rect =
    canvas.getBoundingClientRect();


  const ratio =
    window.devicePixelRatio ||
    1;


  canvas.width =
    Math.max(
      1,
      Math.floor(
        rect.width * ratio
      )
    );


  canvas.height =
    Math.max(
      1,
      Math.floor(
        rect.height * ratio
      )
    );


  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );

}


window.addEventListener(
  "resize",
  () => {

    resizeCanvas();

    drawResearchModel();

  }
);


function updateVisualModel(
  result
) {

  if (!result) {
    return;
  }


  const content =
    parseContent(
      result
    );


  const nodes = [];


  nodes.push({
    label: "Hypothesis",
    type: "main"
  });


  (content.known_facts || [])
    .slice(0, 6)
    .forEach(
      (item) => {

        nodes.push({
          label:
            String(item)
              .slice(0, 35),

          type:
            "fact"

        });

      }
    );


  (content.next_steps || [])
    .slice(0, 5)
    .forEach(
      (item) => {

        nodes.push({
          label:
            String(item)
              .slice(0, 35),

          type:
            "next"

        });

      }
    );


  visualNodes =
    nodes;


  visualEdges =
    [];


  for (
    let i = 1;
    i < nodes.length;
    i++
  ) {

    visualEdges.push([
      0,
      i
    ]);

  }


  $("nodeCount").textContent =
    String(
      visualNodes.length
    );


  $("edgeCount").textContent =
    String(
      visualEdges.length
    );


  $("visualConfidence").textContent =
    `${result.confidence_level ?? "—"}/5`;


  $("visualTitle").textContent =
    result.title ||
    "Research Network";


  drawResearchModel();

}


function drawResearchModel() {

  if (!ctx || !canvas) {
    return;
  }


  const rect =
    canvas.getBoundingClientRect();


  const width =
    rect.width;


  const height =
    rect.height;


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  /*
  grid
  */

  ctx.strokeStyle =
    "rgba(100,150,210,.07)";

  ctx.lineWidth =
    1;


  const grid =
    45;


  for (
    let x = 0;
    x < width;
    x += grid
  ) {

    ctx.beginPath();

    ctx.moveTo(
      x,
      0
    );

    ctx.lineTo(
      x,
      height
    );

    ctx.stroke();

  }


  for (
    let y = 0;
    y < height;
    y += grid
  ) {

    ctx.beginPath();

    ctx.moveTo(
      0,
      y
    );

    ctx.lineTo(
      width,
      y
    );

    ctx.stroke();

  }


  if (!visualNodes.length) {

    ctx.fillStyle =
      "#66758e";

    ctx.font =
      "12px sans-serif";

    ctx.textAlign =
      "center";

    ctx.fillText(
      "研究結果が生成されるとモデルが表示されます",
      width / 2,
      height / 2
    );

    return;

  }


  const centerX =
    width / 2;

  const centerY =
    height / 2;


  const radius =
    Math.min(
      width,
      height
    ) * .32;


  const positions =
    visualNodes.map(
      (_, index) => {

        if (index === 0) {

          return {
            x: centerX,
            y: centerY
          };

        }


        const angle =
          (
            (index - 1) /
            Math.max(
              1,
              visualNodes.length - 1
            )
          ) *
          Math.PI *
          2;


        return {
          x:
            centerX +
            Math.cos(angle) *
            radius,

          y:
            centerY +
            Math.sin(angle) *
            radius
        };

      }
    );


  /*
  edges
  */

  visualEdges
    .forEach(
      ([a,b]) => {

        const p1 =
          positions[a];

        const p2 =
          positions[b];


        if (!p1 || !p2) {
          return;
        }


        ctx.strokeStyle =
          "rgba(77,231,255,.18)";

        ctx.lineWidth =
          1;


        ctx.beginPath();

        ctx.moveTo(
          p1.x,
          p1.y
        );

        ctx.lineTo(
          p2.x,
          p2.y
        );

        ctx.stroke();

      }
    );


  /*
  nodes
  */

  positions
    .forEach(
      (position, index) => {

        const node =
          visualNodes[index];


        const main =
          index === 0;


        const radius =
          main
            ? 28
            : 14;


        const gradient =
          ctx.createRadialGradient(
            position.x,
            position.y,
            1,
            position.x,
            position.y,
            radius * 2.2
          );


        gradient.addColorStop(
          0,
          main
            ? "rgba(77,231,255,.85)"
            : "rgba(107,140,255,.55)"
        );


        gradient.addColorStop(
          1,
          "rgba(77,231,255,0)"
        );


        ctx.fillStyle =
          gradient;


        ctx.beginPath();

        ctx.arc(
          position.x,
          position.y,
          radius * 2.2,
          0,
          Math.PI * 2
        );

        ctx.fill();


        ctx.fillStyle =
          main
            ? "#4de7ff"
            : "#6b8cff";


        ctx.beginPath();

        ctx.arc(
          position.x,
          position.y,
          radius,
          0,
          Math.PI * 2
        );

        ctx.fill();


        ctx.strokeStyle =
          "rgba(255,255,255,.35)";

        ctx.stroke();


        ctx.fillStyle =
          "#dce9ff";

        ctx.font =
          main
            ? "11px sans-serif"
            : "9px sans-serif";

        ctx.textAlign =
          "center";


        const label =
          String(
            node.label ||
            ""
          ).slice(
            0,
            main ? 20 : 18
          );


        ctx.fillText(
          label,
          position.x,
          position.y +
          radius +
          15
        );

      }
    );

}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initialize() {

  loadNotes();

  renderNotes();


  /*
  Clear any old project ID from the
  previous application version.
  */

  if (
    currentProjectId !==
    DEFAULT_PROJECT_ID
  ) {

    currentProjectId =
      DEFAULT_PROJECT_ID;

    localStorage.setItem(
      "research_project_id",
      currentProjectId
    );

  }


  resizeCanvas();


  await checkConnection();

  await loadHistory();

  await loadLatestResult();


  /*
  Check if a previous job is still
  queued/running.
  */

  try {

    const {
      data,
      error
    } = await supabase
      .from("research_jobs")
      .select("*")
      .eq(
        "project_id",
        currentProjectId
      )
      .in(
        "status",
        [
          "queued",
          "running"
        ]
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(1)
      .maybeSingle();


    if (error) {
      throw error;
    }


    if (data) {

      currentJob =
        data;


      updateJobUI(
        data
      );


      progressPanel
        .classList.remove(
          "hidden"
        );


      researchButton.disabled =
        true;

      stopButton.disabled =
        false;


      startPolling();


      showStatus(
        "実行中の研究ジョブを復元しました。"
      );

    }


  } catch (error) {

    console.error(
      "initial job check:",
      error
    );

    /*
    接続エラーはここで
    画面全体を壊さない。
    */

  }

}


initialize();
