/* ============================================================
   RESEARCH AI LAB
   Frontend Controller
   Backend:
   Supabase research_jobs
   →
   GitHub Actions
   →
   OpenRouter
   →
   research_results
============================================================ */


/* ============================================================
   CONFIG
============================================================ */

const SUPABASE_URL =
  "https://hiefdcodifkfhnqvruzn.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_HmcPY6BGvUQTPESGHVe7Hw_W4NlTPqj";

const PROJECT_ID =
  "ab429192-27d2-47e4-9ad7-08b639f45120";

const DISPLAY_LIMIT = 100;

const JOB_POLL_INTERVAL = 5000;


/* ============================================================
   SUPABASE
============================================================ */

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


/* ============================================================
   STATE
============================================================ */

let currentJob = null;

let pollingTimer = null;

let monitoring = false;

let results = [];

let selectedResult = null;


/* ============================================================
   DOM HELPERS
============================================================ */

const $ = id =>
  document.getElementById(id);


/* ============================================================
   INITIALIZATION
============================================================ */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupNavigation();

    setupButtons();

    setupInput();

    loadNotes();

    checkConnection();

    loadHistory();

    findCurrentJob();

    $("projectIdDisplay").textContent =
      PROJECT_ID;

    $("projectShort").textContent =
      PROJECT_ID.slice(0, 8) + "...";

    addLog(
      "SYS",
      "Research AI Lab initialized."
    );

  }
);


/* ============================================================
   NAVIGATION
============================================================ */

function setupNavigation() {

  document
    .querySelectorAll(".nav-button")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const page =
            button.dataset.page;

          if (!page) {
            return;
          }

          document
            .querySelectorAll(".nav-button")
            .forEach(
              item =>
                item.classList.remove(
                  "active"
                )
            );

          document
            .querySelectorAll(".page")
            .forEach(
              item =>
                item.classList.remove(
                  "active"
                )
            );

          button.classList.add(
            "active"
          );

          const target =
            $(`page-${page}`);

          if (target) {
            target.classList.add(
              "active"
            );
          }

          if (page === "history") {
            loadHistory();
          }

          if (page === "saved") {
            renderSaved();
          }

          if (page === "model") {
            updateModel();
          }

        }
      );

    });

}


/* ============================================================
   BUTTONS
============================================================ */

function setupButtons() {

  $("researchButton")
    .addEventListener(
      "click",
      startResearch
    );

  $("clearButton")
    .addEventListener(
      "click",
      () => {

        $("questionInput").value = "";

        updateInputCount();

      }
    );

  $("refreshJobButton")
    .addEventListener(
      "click",
      findCurrentJob
    );

  $("stopMonitorButton")
    .addEventListener(
      "click",
      stopMonitoring
    );

  $("refreshHistoryButton")
    .addEventListener(
      "click",
      loadHistory
    );

  $("historySearch")
    .addEventListener(
      "input",
      renderHistory
    );

  $("addNoteButton")
    .addEventListener(
      "click",
      addNote
    );

  $("closeModalButton")
    .addEventListener(
      "click",
      closeModal
    );

  $("latestDetailButton")
    .addEventListener(
      "click",
      () => {

        if (selectedResult) {
          openResult(
            selectedResult
          );
        }

      }
    );

  $("saveResultButton")
    .addEventListener(
      "click",
      saveSelectedResult
    );

}


/* ============================================================
   INPUT
============================================================ */

function setupInput() {

  $("questionInput")
    .addEventListener(
      "input",
      updateInputCount
    );

}


function updateInputCount() {

  const value =
    $("questionInput").value;

  $("inputCount").textContent =
    `${value.length} characters`;

}


/* ============================================================
   CONNECTION
============================================================ */

async function checkConnection() {

  try {

    const {
      error
    } =
      await supabaseClient
        .from("research_results")
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

    if (error) {
      throw error;
    }

    $("connectionDot")
      .classList.remove(
        "error"
      );

    $("connectionDot")
      .classList.add(
        "ok"
      );

    $("connectionText")
      .textContent =
      "Supabase 接続済み";

    addLog(
      "DB",
      "Supabase connection successful."
    );

  } catch (error) {

    console.error(error);

    $("connectionDot")
      .classList.add(
        "error"
      );

    $("connectionText")
      .textContent =
      "Supabase 接続エラー";

    addLog(
      "ERR",
      formatError(error)
    );

  }

}


/* ============================================================
   START RESEARCH
============================================================ */

async function startResearch() {

  const message =
    $("questionInput")
      .value
      .trim();

  if (!message) {

    showStatus(
      "研究テーマを入力してください。",
      "error"
    );

    return;
  }


  if (
    currentJob &&
    (
      currentJob.status === "queued" ||
      currentJob.status === "running"
    )
  ) {

    showStatus(
      "すでに研究ジョブが実行中です。",
      "error"
    );

    return;
  }


  $("researchButton")
    .disabled = true;

  setProgress(
    5,
    "研究ジョブを作成しています..."
  );

  showStatus(
    "research_jobs に研究ジョブを登録しています..."
  );


  try {

    const payload = {

      mode:
        "autonomous",

      theme:
        message,

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
      現在確認できているRLS:
      anon INSERT / SELECT
    */

    const {
      data,
      error
    } =
      await supabaseClient
        .from("research_jobs")
        .insert({

          project_id:
            PROJECT_ID,

          job_type:
            "research_cycle",

          status:
            "queued",

          priority:
            10,

          payload:
            payload

        })
        .select(
          "id,project_id,job_type,status,priority,payload,created_at"
        )
        .single();


    if (error) {
      throw error;
    }


    currentJob = data;


    $("jobId").textContent =
      data.id;

    $("jobStarted").textContent =
      "queued";

    $("jobStatus").textContent =
      "キュー待機中";


    setJobBadge(
      "queued"
    );


    setProgress(
      15,
      "キューに追加しました"
    );


    showStatus(
      [
        "研究ジョブを作成しました。",
        "",
        `Job ID: ${data.id}`,
        "",
        "GitHub Actions が queued ジョブを取得するのを待っています。"
      ].join("\n"),
      "success"
    );


    addLog(
      "JOB",
      `Created queued job ${data.id}`
    );


    monitoring = true;

    $("stopMonitorButton")
      .disabled = false;

    startPolling();


  } catch (error) {

    console.error(
      "START RESEARCH ERROR",
      error
    );

    showStatus(
      formatError(error),
      "error"
    );

    addLog(
      "ERR",
      formatError(error)
    );

    $("researchButton")
      .disabled = false;

  }

}


/* ============================================================
   FIND CURRENT JOB
============================================================ */

async function findCurrentJob() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("research_jobs")
        .select(
          `
          id,
          project_id,
          job_type,
          status,
          priority,
          payload,
          result,
          error_message,
          started_at,
          finished_at,
          created_at
          `
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
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(1);


    if (error) {
      throw error;
    }


    if (
      data &&
      data.length
    ) {

      currentJob =
        data[0];

      updateJobUI(
        currentJob
      );

      monitoring = true;

      $("stopMonitorButton")
        .disabled = false;

      startPolling();

      addLog(
        "JOB",
        `Active job found: ${currentJob.id}`
      );

      return;

    }


    currentJob = null;

    setJobIdle();

    addLog(
      "JOB",
      "No queued/running job found."
    );

  } catch (error) {

    console.error(error);

    showStatus(
      "ジョブ状態取得エラー: " +
      formatError(error),
      "error"
    );

  }

}


/* ============================================================
   POLLING
============================================================ */

function startPolling() {

  if (pollingTimer) {
    clearInterval(
      pollingTimer
    );
  }

  pollJob();

  pollingTimer =
    setInterval(
      pollJob,
      JOB_POLL_INTERVAL
    );

}


async function pollJob() {

  if (!monitoring) {
    return;
  }


  if (!currentJob?.id) {

    await findCurrentJob();

    return;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("research_jobs")
        .select(
          `
          id,
          project_id,
          job_type,
          status,
          priority,
          payload,
          result,
          error_message,
          started_at,
          finished_at,
          created_at
          `
        )
        .eq(
          "id",
          currentJob.id
        )
        .maybeSingle();


    if (error) {
      throw error;
    }


    if (!data) {

      addLog(
        "JOB",
        "Job is no longer visible."
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

      monitoring = false;

      clearPolling();

      $("researchButton")
        .disabled = false;

      $("stopMonitorButton")
        .disabled = true;

      setProgress(
        100,
        "研究完了"
      );

      showStatus(
        "研究が完了しました。結果を読み込んでいます。",
        "success"
      );

      addLog(
        "DONE",
        `Research job completed: ${data.id}`
      );

      await loadHistory();

      return;
    }


    if (
      data.status ===
      "failed"
    ) {

      monitoring = false;

      clearPolling();

      $("researchButton")
        .disabled = false;

      $("stopMonitorButton")
        .disabled = true;

      setProgress(
        100,
        "研究エラー"
      );

      showStatus(
        data.error_message ||
        "研究ジョブが失敗しました。",
        "error"
      );

      addLog(
        "ERR",
        data.error_message ||
        "Research job failed."
      );

      return;
    }


    if (
      data.status ===
      "running"
    ) {

      setProgress(
        55,
        "AIが研究・検証中..."
      );

      addLog(
        "AI",
        "Research engine is running."
      );

    }

  } catch (error) {

    console.error(
      "POLL ERROR",
      error
    );

    addLog(
      "ERR",
      formatError(error)
    );

  }

}


/* ============================================================
   STOP MONITORING
============================================================ */

function stopMonitoring() {

  /*
    重要:
    現在のRLSでは anon UPDATE が確認されていないため、
    ブラウザからrunningジョブを勝手にUPDATEしない。

    ここでは「ブラウザ側の監視」を安全に停止する。
    GitHub Actions側の研究そのものを止める機能は
    停止用UPDATE/Edge Function追加後に接続する。
  */

  monitoring = false;

  clearPolling();

  $("stopMonitorButton")
    .disabled = true;

  $("researchButton")
    .disabled = false;

  showStatus(
    "ブラウザ側の監視を停止しました。\n現在の権限ではバックエンドのrunningジョブ自体は変更していません。",
    "success"
  );

  addLog(
    "SYS",
    "Frontend monitoring stopped."
  );

}


function clearPolling() {

  if (pollingTimer) {

    clearInterval(
      pollingTimer
    );

    pollingTimer = null;

  }

}


/* ============================================================
   JOB UI
============================================================ */

function updateJobUI(
  job
) {

  const status =
    job.status ||
    "queued";


  $("jobId").textContent =
    job.id || "—";


  $("jobStarted").textContent =
    job.started_at
      ? formatDate(
          job.started_at
        )
      : status;


  setJobBadge(
    status
  );


  if (
    status ===
    "queued"
  ) {

    $("jobStatus").textContent =
      "キュー待機中";

  } else if (
    status ===
    "running"
  ) {

    $("jobStatus").textContent =
      "AI研究中";

  } else if (
    status ===
    "completed"
  ) {

    $("jobStatus").textContent =
      "完了";

  } else {

    $("jobStatus").textContent =
      status;

  }

}


function setJobBadge(
  status
) {

  const badge =
    $("jobBadge");

  badge.className =
    `job-badge ${status}`;

  badge.textContent =
    String(status)
      .toUpperCase();

}


function setJobIdle() {

  currentJob = null;

  $("jobId").textContent =
    "—";

  $("jobStarted").textContent =
    "—";

  $("jobStatus").textContent =
    "待機中";

  setJobBadge(
    "idle"
  );

  setProgress(
    0,
    "待機中"
  );

  $("stopMonitorButton")
    .disabled = true;

}


/* ============================================================
   PROGRESS
============================================================ */

function setProgress(
  percent,
  text
) {

  const safe =
    Math.max(
      0,
      Math.min(
        100,
        percent
      )
    );


  $("progressValue")
    .style.width =
    `${safe}%`;


  $("progressPercent")
    .textContent =
    `${Math.round(safe)}%`;


  $("progressText")
    .textContent =
    text;

}


/* ============================================================
   STATUS
============================================================ */

function showStatus(
  message,
  type = ""
) {

  const box =
    $("statusBox");

  box.textContent =
    message;

  box.className =
    "status-box show";

  if (type) {
    box.classList.add(
      type
    );
  }

}


/* ============================================================
   HISTORY
============================================================ */

async function loadHistory() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("research_results")
        .select(
          `
          id,
          project_id,
          title,
          hypothesis,
          content,
          status,
          evaluation,
          confidence_level,
          is_human_saved,
          created_at,
          updated_at
          `
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
          DISPLAY_LIMIT
        );


    if (error) {
      throw error;
    }


    results =
      data || [];


    $("historyCount")
      .textContent =
      results.length;


    renderHistory();

    renderLatest();

    renderSaved();

    updateModel();


  } catch (error) {

    console.error(
      "HISTORY ERROR",
      error
    );

    addLog(
      "ERR",
      formatError(error)
    );

    $("historyList").innerHTML =
      emptyHTML(
        "履歴を読み込めませんでした。"
      );

  }

}


/* ============================================================
   HISTORY RENDER
============================================================ */

function renderHistory() {

  const search =
    $("historySearch")
      .value
      .trim()
      .toLowerCase();


  let filtered =
    results;


  if (search) {

    filtered =
      results.filter(
        result => {

          const text =
            [
              result.title,
              result.hypothesis,
              result.content,
              result.evaluation
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          return text.includes(
            search
          );

        }
      );

  }


  if (!filtered.length) {

    $("historyList").innerHTML =
      emptyHTML(
        "該当する研究結果がありません。"
      );

    return;

  }


  $("historyList").innerHTML =
    filtered
      .map(
        createHistoryCard
      )
      .join("");


  document
    .querySelectorAll(
      "[data-result-id]"
    )
    .forEach(
      card => {

        card.addEventListener(
          "click",
          () => {

            const id =
              card.dataset.resultId;

            const result =
              results.find(
                item =>
                  item.id === id
              );

            if (result) {
              openResult(
                result
              );
            }

          }
        );

      }
    );

}


function createHistoryCard(
  result
) {

  const evaluation =
    normalizeEvaluation(
      result.evaluation
    );


  const symbol =
    evaluation === "good"
      ? "⭕"
      : evaluation === "bad"
        ? "❌"
        : "△";


  return `
    <article
      class="history-card"
      data-result-id="${escapeAttr(result.id)}"
    >

      <div class="history-card-top">

        <h3>
          ${escapeHTML(
            result.title ||
            "無題の研究"
          )}
        </h3>

        <span
          class="evaluation ${evaluation}"
        >
          ${symbol}
        </span>

      </div>

      <p>
        ${escapeHTML(
          getResultSummary(
            result
          )
        )}
      </p>

      <div class="history-card-meta">

        <span>
          信頼度:
          ${result.confidence_level ?? 0}/5
        </span>

        <span>
          ${formatDate(
            result.created_at
          )}
        </span>

      </div>

    </article>
  `;

}


/* ============================================================
   LATEST
============================================================ */

function renderLatest() {

  const latest =
    results[0];


  if (!latest) {

    $("latestEmpty")
      .classList.remove(
        "hidden"
      );

    $("latestResult")
      .classList.add(
        "hidden"
      );

    return;

  }


  $("latestEmpty")
    .classList.add(
      "hidden"
    );

  $("latestResult")
    .classList.remove(
      "hidden"
    );


  selectedResult =
    latest;


  $("latestTitle")
    .textContent =
    latest.title ||
    "無題の研究";


  $("latestConfidence")
    .textContent =
    `信頼度 ${latest.confidence_level ?? 0}/5`;


  $("latestDate")
    .textContent =
    formatDate(
      latest.created_at
    );


  $("latestHypothesis")
    .textContent =
    latest.hypothesis ||
    "記録なし";


  $("latestContent")
    .textContent =
    getResultSummary(
      latest
    );


  const evaluation =
    normalizeEvaluation(
      latest.evaluation
    );


  const evaluationElement =
    $("latestEvaluation");


  evaluationElement.className =
    `evaluation ${evaluation}`;


  evaluationElement.textContent =
    evaluation === "good"
      ? "⭕"
      : evaluation === "bad"
        ? "❌"
        : "△";

}


/* ============================================================
   SAVED
============================================================ */

function renderSaved() {

  const saved =
    results.filter(
      result =>
        result.is_human_saved === true
    );


  $("modelSaved")
    .textContent =
    saved.length;


  if (!saved.length) {

    $("savedList").innerHTML =
      emptyHTML(
        "まだ保存された研究結果はありません。"
      );

    return;

  }


  $("savedList").innerHTML =
    saved
      .map(
        createHistoryCard
      )
      .join("");


  $("savedList")
    .querySelectorAll(
      "[data-result-id]"
    )
    .forEach(
      card => {

        card.addEventListener(
          "click",
          () => {

            const result =
              results.find(
                item =>
                  item.id ===
                  card.dataset.resultId
              );

            if (result) {
              openResult(
                result
              );
            }

          }
        );

      }
    );

}


/* ============================================================
   RESULT MODAL
============================================================ */

function openResult(
  result
) {

  selectedResult =
    result;


  const evaluation =
    normalizeEvaluation(
      result.evaluation
    );


  $("modalTitle")
    .textContent =
    result.title ||
    "無題の研究";


  $("modalHypothesis")
    .textContent =
    result.hypothesis ||
    "記録なし";


  $("modalContent")
    .textContent =
    getResultSummary(
      result
    );


  $("modalEvaluation")
    .textContent =
    evaluation === "good"
      ? "⭕ 成立・妥当"
      : evaluation === "bad"
        ? "❌ 問題あり"
        : "△ 要検証";


  $("modalConfidence")
    .textContent =
    `信頼度 ${result.confidence_level ?? 0}/5`;


  $("modalEvaluationText")
    .textContent =
    getEvaluationText(
      result
    );


  $("saveResultButton")
    .textContent =
    result.is_human_saved
      ? "★ 保存済み"
      : "★ 重要研究として保存";


  $("detailModal")
    .classList.remove(
      "hidden"
    );

}


function closeModal() {

  $("detailModal")
    .classList.add(
      "hidden"
    );

}


/* ============================================================
   SAVE RESULT
============================================================ */

function saveSelectedResult() {

  if (!selectedResult) {
    return;
  }


  /*
    現在のRLSでは anon UPDATE が確認されていないため、
    DBへ勝手にUPDATEしない。

    重要研究のローカル保存として動作させる。
  */

  const key =
    "research_saved_ids";

  const saved =
    JSON.parse(
      localStorage.getItem(
        key
      ) || "[]"
    );


  if (
    !saved.includes(
      selectedResult.id
    )
  ) {

    saved.push(
      selectedResult.id
    );

  }


  localStorage.setItem(
    key,
    JSON.stringify(
      saved
    )
  );


  selectedResult
    .is_human_saved = true;


  $("saveResultButton")
    .textContent =
    "★ 保存済み";


  renderSaved();

  updateModel();


  showStatus(
    "重要研究としてこのブラウザに保存しました。",
    "success"
  );


  addLog(
    "SAVE",
    `Saved result ${selectedResult.id}`
  );

}


/* ============================================================
   3D MODEL
============================================================ */

function updateModel() {

  $("modelResults")
    .textContent =
    results.length;


  const saved =
    getLocalSavedIds();


  $("modelSaved")
    .textContent =
    saved.length;


  $("modelStatus")
    .textContent =
    currentJob?.status
      ? currentJob.status.toUpperCase()
      : "IDLE";

}


/* ============================================================
   NOTES
============================================================ */

function loadNotes() {

  const notes =
    getNotes();

  renderNotes(
    notes
  );

}


function getNotes() {

  try {

    return JSON.parse(
      localStorage.getItem(
        "research_notes"
      ) || "[]"
    );

  } catch {

    return [];

  }

}


function saveNotes(
  notes
) {

  localStorage.setItem(
    "research_notes",
    JSON.stringify(
      notes
    )
  );

}


function addNote() {

  const input =
    $("noteInput");

  const text =
    input.value.trim();


  if (!text) {

    showStatus(
      "メモを入力してください。",
      "error"
    );

    return;

  }


  const notes =
    getNotes();


  notes.unshift({

    id:
      crypto.randomUUID(),

    text:
      text,

    created_at:
      new Date()
        .toISOString()

  });


  saveNotes(
    notes
  );


  input.value = "";

  renderNotes(
    notes
  );


  addLog(
    "NOTE",
    "Research note created."
  );

}


function renderNotes(
  notes
) {

  const container =
    $("notesList");


  if (!notes.length) {

    container.innerHTML =
      emptyHTML(
        "まだメモがありません。"
      );

    return;

  }


  container.innerHTML =
    notes
      .map(
        note => `

          <article class="note-card">

            <button
              class="note-delete"
              data-note-id="${escapeAttr(note.id)}"
            >
              ×
            </button>

            <p>
              ${escapeHTML(
                note.text
              )}
            </p>

            <span class="note-date">
              ${formatDate(
                note.created_at
              )}
            </span>

          </article>

        `
      )
      .join("");


  container
    .querySelectorAll(
      ".note-delete"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            deleteNote(
              button.dataset.noteId
            );

          }
        );

      }
    );

}


function deleteNote(
  id
) {

  const notes =
    getNotes()
      .filter(
        note =>
          note.id !== id
      );


  saveNotes(
    notes
  );


  renderNotes(
    notes
  );


  addLog(
    "NOTE",
    "Research note deleted."
  );

}


/* ============================================================
   AI LOG
============================================================ */

function addLog(
  type,
  message
) {

  const log =
    $("aiLog");


  const line =
    document.createElement(
      "div"
    );


  line.className =
    "log-line";


  line.innerHTML =
    `<span>${escapeHTML(type)}</span>${escapeHTML(message)}`;


  log.appendChild(
    line
  );


  while (
    log.children.length >
    200
  ) {

    log.removeChild(
      log.firstChild
    );

  }


  log.scrollTop =
    log.scrollHeight;

}


/* ============================================================
   HELPERS
============================================================ */

function normalizeEvaluation(
  value
) {

  if (!value) {
    return "maybe";
  }


  const text =
    String(value);


  if (
    text.includes("⭕") ||
    text.includes("good")
  ) {
    return "good";
  }


  if (
    text.includes("❌") ||
    text.includes("bad")
  ) {
    return "bad";
  }


  return "maybe";

}


function getResultSummary(
  result
) {

  if (
    result.content
  ) {

    try {

      const content =
        typeof result.content ===
        "string"
          ? JSON.parse(
              result.content
            )
          : result.content;


      const parts = [
        content.summary,
        content.approach,
        content.critical_gap,
        content.next_steps
      ];


      const text =
        parts
          .flat()
          .filter(Boolean)
          .map(
            value =>
              Array.isArray(value)
                ? value.join(" / ")
                : String(value)
          )
          .join("\n");


      if (text) {
        return text;
      }

    } catch {

      return String(
        result.content
      );

    }

  }


  return (
    result.hypothesis ||
    "研究内容なし"
  );

}


function getEvaluationText(
  result
) {

  if (!result.evaluation) {
    return "未評価";
  }


  return String(
    result.evaluation
  );

}


function getLocalSavedIds() {

  try {

    return JSON.parse(
      localStorage.getItem(
        "research_saved_ids"
      ) || "[]"
    );

  } catch {

    return [];

  }

}


function formatDate(
  value
) {

  if (!value) {
    return "—";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "—";

  }


  return date.toLocaleString(
    "ja-JP",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


function formatError(
  error
) {

  if (!error) {
    return "Unknown error";
  }


  if (
    typeof error ===
    "string"
  ) {
    return error;
  }


  return (
    error.message ||
    error.details ||
    error.hint ||
    JSON.stringify(
      error
    )
  );

}


function escapeHTML(
  value
) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


function escapeAttr(
  value
) {

  return escapeHTML(
    value
  );

}


function emptyHTML(
  message
) {

  return `
    <div class="glass-card empty-state">
      ${escapeHTML(message)}
    </div>
  `;

}
