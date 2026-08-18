/* =========================================================
   Research AI Lab
   Frontend
   ========================================================= */


/* =========================================================
   SUPABASE CONFIG
   ========================================================= */

const SUPABASE_URL =
  "https://beadajbimgpephqszbfy.supabase co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_s5kiFZVJ9jXyOgS-j2pS-g_7Kj1IeC8";


const PROJECT_ID =
  "ab429192-27d2-47e4-9ad7-08b639f45120";


/* =========================================================
   CLIENT
   ========================================================= */

const {
  createClient
} = window.supabase;


const supabaseClient =
  createClient(
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

const state = {

  currentJob: null,

  latestResults: [],

  positiveResults: [],

  activeTab: "latest",

  evaluationFilter: "all",

  polling: false,

  lastRefresh: null

};


/* =========================================================
   DOM
   ========================================================= */

const $ = (id) =>
  document.getElementById(id);


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    setupTabs();

    setupEvents();

    await initialize();

  }
);


/* =========================================================
   INITIALIZE APP
   ========================================================= */

async function initialize() {

  setSupabaseStatus(
    "checking",
    "Supabase: checking..."
  );

  try {

    await testSupabaseConnection();

    setSupabaseStatus(
      "online",
      "Supabase: connected"
    );

    await refreshAll();

    startPolling();

  } catch (error) {

    console.error(error);

    setSupabaseStatus(
      "offline",
      "Supabase: failed"
    );

    showError(
      formatError(error)
    );

  }

}


/* =========================================================
   SUPABASE CONNECTION TEST
   ========================================================= */

async function testSupabaseConnection() {

  const {
    error
  } = await supabaseClient
    .from("research_jobs")
    .select("id", {
      count: "exact",
      head: true
    })
    .eq(
      "project_id",
      PROJECT_ID
    );

  if (error) {

    throw new Error(
      `Supabase connection failed: ${error.message}`
    );

  }

}


/* =========================================================
   REFRESH ALL
   ========================================================= */

async function refreshAll() {

  try {

    await Promise.all([
      loadCurrentJob(),
      loadLatestResults(),
      loadPositiveResults(),
      loadStatistics()
    ]);

    state.lastRefresh =
      new Date();

  } catch (error) {

    console.error(error);

    showError(
      formatError(error)
    );

  }

}


/* =========================================================
   CURRENT JOB
   ========================================================= */

async function loadCurrentJob() {

  const {
    data,
    error
  } = await supabaseClient
    .from("research_jobs")
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

  state.currentJob =
    data && data.length
      ? data[0]
      : null;

  renderCurrentJob();

}


/* =========================================================
   RENDER CURRENT JOB
   ========================================================= */

function renderCurrentJob() {

  const job =
    state.currentJob;

  const empty =
    $("jobEmpty");

  const details =
    $("jobDetails");

  if (!job) {

    empty.classList.remove(
      "hidden"
    );

    details.classList.add(
      "hidden"
    );

    $("jobStatus").textContent =
      "Research: idle";

    $("jobDot").className =
      "status-dot idle";

    $("researchIndicator").textContent =
      "IDLE";

    $("researchIndicator").className =
      "research-indicator idle";

    $("startResearchButton").disabled =
      false;

    return;

  }


  empty.classList.add(
    "hidden"
  );

  details.classList.remove(
    "hidden"
  );


  $("currentJobStatus")
    .textContent =
    String(job.status)
      .toUpperCase();


  $("currentJobId")
    .textContent =
    job.id;


  $("currentJobType")
    .textContent =
    job.job_type;


  $("currentJobCreated")
    .textContent =
    formatDate(job.created_at);


  $("jobStatus")
    .textContent =
    `Research: ${job.status}`;


  $("jobDot").className =
    "status-dot busy";


  $("researchIndicator")
    .textContent =
    String(job.status)
      .toUpperCase();


  $("researchIndicator")
    .className =
    "research-indicator busy";


  $("startResearchButton")
    .disabled = true;

}


/* =========================================================
   LOAD LATEST 100
   ========================================================= */

async function loadLatestResults() {

  const {
    data,
    error
  } = await supabaseClient
    .from("research_results")
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
    .limit(100);

  if (error) {

    throw error;

  }

  state.latestResults =
    data || [];

  renderLatestResults();

}


/* =========================================================
   LOAD ALL SUCCESS RESULTS
   ========================================================= */

async function loadPositiveResults() {

  const {
    data,
    error
  } = await supabaseClient
    .from("research_results")
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
      "evaluation",
      "⭕️"
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

  state.positiveResults =
    data || [];

  renderPositiveResults();

}


/* =========================================================
   STATISTICS
   ========================================================= */

async function loadStatistics() {

  const totalResult =
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


  if (totalResult.error) {

    throw totalResult.error;

  }


  const positiveResult =
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
      )
      .eq(
        "evaluation",
        "⭕️"
      );


  if (positiveResult.error) {

    throw positiveResult.error;

  }


  $("totalResults")
    .textContent =
    totalResult.count ?? 0;


  $("positiveResults")
    .textContent =
    positiveResult.count ?? 0;

}


/* =========================================================
   RENDER LATEST
   ========================================================= */

function renderLatestResults() {

  const container =
    $("latestResults");

  let results =
    state.latestResults;


  if (
    state.evaluationFilter !==
    "all"
  ) {

    results =
      results.filter(
        item =>
          normalizeEvaluation(
            item.evaluation
          ) ===
          state.evaluationFilter
      );

  }


  if (!results.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">∅</div>
        <p>表示できる研究結果がありません。</p>
      </div>
    `;

    return;

  }


  container.innerHTML =
    results
      .map(
        createResearchCard
      )
      .join("");

}


/* =========================================================
   RENDER POSITIVE
   ========================================================= */

function renderPositiveResults() {

  const container =
    $("positiveResultsList");


  if (
    !state.positiveResults.length
  ) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⭕️</div>
        <p>まだ⭕️の研究はありません。</p>
      </div>
    `;

    return;

  }


  container.innerHTML =
    state.positiveResults
      .map(
        createResearchCard
      )
      .join("");

}


/* =========================================================
   CREATE CARD
   ========================================================= */

function createResearchCard(
  result
) {

  const evaluation =
    normalizeEvaluation(
      result.evaluation
    );


  const evaluationClass =
    evaluation === "⭕️"
      ? "success"
      : evaluation === "❌"
        ? "danger"
        : "warning";


  const confidence =
    Number(
      result.confidence_level ?? 0
    );


  return `
    <article
      class="research-card"
      data-result-id="${escapeHtml(result.id)}"
    >

      <div class="research-card-top">

        <div>

          <h4>
            ${escapeHtml(
              result.title ||
              "Untitled Research"
            )}
          </h4>

          <p>
            ${escapeHtml(
              truncate(
                result.hypothesis ||
                "仮説なし",
                240
              )
            )}
          </p>

        </div>

        <span
          class="evaluation-badge ${evaluationClass}"
        >
          ${escapeHtml(evaluation)}
        </span>

      </div>


      <div class="card-meta">

        <span>
          confidence:
          ${confidence}/5
        </span>

        <span>
          ${formatDate(
            result.created_at
          )}
        </span>

        ${
          result.is_human_saved
            ? `<span>⭐ saved</span>`
            : ""
        }

      </div>

    </article>
  `;

}


/* =========================================================
   RESULT CLICK
   ========================================================= */

document.addEventListener(
  "click",
  event => {

    const card =
      event.target.closest(
        ".research-card"
      );

    if (!card) {
      return;
    }

    const id =
      card.dataset.resultId;

    openResultDetail(id);

  }
);


/* =========================================================
   OPEN DETAIL
   ========================================================= */

async function openResultDetail(
  id
) {

  const all =
    [
      ...state.latestResults,
      ...state.positiveResults
    ];


  let result =
    all.find(
      item => item.id === id
    );


  if (!result) {

    const {
      data,
      error
    } = await supabaseClient
      .from("research_results")
      .select("*")
      .eq(
        "id",
        id
      )
      .maybeSingle();


    if (error) {

      showError(
        formatError(error)
      );

      return;

    }

    result = data;

  }


  if (!result) {
    return;
  }


  renderDetail(result);


  $("detailPanel")
    .classList.remove(
      "hidden"
    );


  $("detailPanel")
    .scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

}


/* =========================================================
   RENDER DETAIL
   ========================================================= */

function renderDetail(
  result
) {

  const evaluation =
    normalizeEvaluation(
      result.evaluation
    );


  $("detailTitle")
    .textContent =
    result.title ||
    "Untitled Research";


  $("detailEvaluation")
    .textContent =
    evaluation;


  $("detailEvaluation")
    .className =
    `evaluation-badge ${
      evaluation === "⭕️"
        ? "success"
        : evaluation === "❌"
          ? "danger"
          : "warning"
    }`;


  $("detailConfidence")
    .textContent =
    `confidence ${Number(
      result.confidence_level ?? 0
    )}/5`;


  $("detailHypothesis")
    .textContent =
    result.hypothesis ||
    "仮説なし";


  $("detailContent")
    .textContent =
    prettyJsonOrText(
      result.content
    );


  $("detailEvaluationText")
    .textContent =
    prettyJsonOrText(
      result.evaluation
    );


  $("detailCreated")
    .textContent =
    formatDate(
      result.created_at
    );


  $("detailUpdated")
    .textContent =
    formatDate(
      result.updated_at
    );

}


/* =========================================================
   START RESEARCH
   ========================================================= */

async function startResearch() {

  const button =
    $("startResearchButton");


  if (
    state.currentJob
  ) {

    showError(
      "現在すでに研究ジョブが実行中です。"
    );

    return;

  }


  const theme =
    $("researchTheme")
      .value
      .trim();


  if (!theme) {

    showError(
      "研究テーマを入力してください。"
    );

    return;

  }


  button.disabled =
    true;


  button.textContent =
    "研究ジョブを作成中...";


  try {

    const payload = {

      mode:
        "autonomous",

      theme,

      max_route_attempts:
        3,

      enable_literature_check:
        $("literatureCheck")
          .checked,

      enable_cross_domain_search:
        $("crossDomain")
          .checked,

      enable_reductio_ad_absurdum:
        $("reductio")
          .checked,

      enable_counterexample_search:
        $("counterexample")
          .checked,

      require_independent_verification:
        $("independentVerification")
          .checked

    };


    const {
      data,
      error
    } = await supabaseClient
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

        payload

      })
      .select(
        "id,project_id,job_type,status,priority,payload,created_at"
      )
      .maybeSingle();


    if (error) {

      throw error;

    }


    state.currentJob =
      data;


    renderCurrentJob();


    $("jobStatus")
      .textContent =
      "Research: queued";


    showSuccess(
      "研究ジョブをキューに追加しました。GitHub Actionsが処理します。"
    );


    await refreshAll();


  } catch (error) {

    console.error(
      "startResearch error:",
      error
    );

    showError(
      formatError(error)
    );

  } finally {

    if (!state.currentJob) {

      button.disabled =
        false;

    }

    button.innerHTML =
      "<span>▶</span> 研究開始";

  }

}


/* =========================================================
   POLLING
   ========================================================= */

function startPolling() {

  if (state.polling) {
    return;
  }


  state.polling =
    true;


  setInterval(
    async () => {

      try {

        await loadCurrentJob();

        /*
         * ジョブが終了したら履歴を更新。
         */

        if (
          !state.currentJob
        ) {

          await loadLatestResults();

          await loadPositiveResults();

          await loadStatistics();

        }

      } catch (error) {

        console.error(
          "Polling error:",
          error
        );

      }

    },
    15000
  );

}


/* =========================================================
   HANDOVER
   ========================================================= */

function saveHandover() {

  const source =
    $("handoverSource")
      .value
      .trim();

  const title =
    $("handoverTitle")
      .value
      .trim();

  const text =
    $("handoverText")
      .value
      .trim();


  if (!text) {

    showError(
      "引き継ぐ研究内容を入力してください。"
    );

    return;

  }


  const record = {

    source:
      source ||
      "External AI",

    title:
      title ||
      "External Research",

    content:
      text,

    imported_at:
      new Date()
        .toISOString()

  };


  /*
   * 現段階では、外部研究の原文を
   * ブラウザ側の引き継ぎメモとして保存します。
   *
   * まだDBの専用テーブルを作っていないため、
   * research_resultsへ偽装して保存しません。
   */

  const existing =
    JSON.parse(
      localStorage.getItem(
        "research_ai_lab_handover"
      ) ||
      "[]"
    );


  existing.unshift(
    record
  );


  localStorage.setItem(
    "research_ai_lab_handover",
    JSON.stringify(
      existing
    )
  );


  $("handoverMessage")
    .textContent =
    "外部研究をこのブラウザの引き継ぎメモに保存しました。";


  $("handoverMessage")
    .classList.remove(
      "hidden"
    );


  $("handoverText")
    .value = "";

}


/* =========================================================
   TABS
   ========================================================= */

function setupTabs() {

  document
    .querySelectorAll(
      ".tab-button"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const tab =
              button.dataset.tab;


            state.activeTab =
              tab;


            document
              .querySelectorAll(
                ".tab-button"
              )
              .forEach(
                item =>
                  item.classList.toggle(
                    "active",
                    item === button
                  )
              );


            document
              .querySelectorAll(
                ".tab-content"
              )
              .forEach(
                content =>
                  content.classList.toggle(
                    "active",
                    content.id ===
                    `tab-${tab}`
                  )
              );

          }
        );

      }
    );

}


/* =========================================================
   EVENTS
   ========================================================= */

function setupEvents() {

  $("startResearchButton")
    .addEventListener(
      "click",
      startResearch
    );


  $("refreshButton")
    .addEventListener(
      "click",
      async () => {

        await refreshAll();

      }
    );


  $("evaluationFilter")
    .addEventListener(
      "change",
      event => {

        state.evaluationFilter =
          event.target.value;

        renderLatestResults();

      }
    );


  $("closeError")
    .addEventListener(
      "click",
      () => {

        $("errorBox")
          .classList.add(
            "hidden"
          );

      }
    );


  $("closeDetail")
    .addEventListener(
      "click",
      () => {

        $("detailPanel")
          .classList.add(
            "hidden"
          );

      }
    );


  $("saveHandoverButton")
    .addEventListener(
      "click",
      saveHandover
    );


  $("clearHandoverButton")
    .addEventListener(
      "click",
      () => {

        $("handoverSource")
          .value = "";

        $("handoverTitle")
          .value = "";

        $("handoverText")
          .value = "";

        $("handoverMessage")
          .classList.add(
            "hidden"
          );

      }
    );

}


/* =========================================================
   STATUS
   ========================================================= */

function setSupabaseStatus(
  type,
  text
) {

  $("supabaseDot")
    .className =
    `status-dot ${
      type === "online"
        ? "online"
        : type === "offline"
          ? "offline"
          : "busy"
    }`;


  $("supabaseStatus")
    .textContent =
    text;

}


/* =========================================================
   ERROR
   ========================================================= */

function showError(
  message
) {

  $("errorMessage")
    .textContent =
    message;


  $("errorBox")
    .classList.remove(
      "hidden"
    );

}


function showSuccess(
  message
) {

  /*
   * 成功通知は既存のエラー欄を利用せず、
   * consoleにも記録します。
   */

  console.log(
    "[Research AI Lab]",
    message
  );

}


/* =========================================================
   ERROR FORMAT
   ========================================================= */

function formatError(
  error
) {

  if (!error) {

    return "Unknown error.";

  }


  if (
    typeof error === "string"
  ) {

    return error;

  }


  const parts = [];


  if (error.message) {

    parts.push(
      error.message
    );

  }


  if (error.details) {

    parts.push(
      error.details
    );

  }


  if (error.hint) {

    parts.push(
      error.hint
    );

  }


  if (error.code) {

    parts.push(
      `code=${error.code}`
    );

  }


  return (
    parts.join(" | ") ||
    JSON.stringify(error)
  );

}


/* =========================================================
   EVALUATION NORMALIZATION
   ========================================================= */

function normalizeEvaluation(
  value
) {

  if (!value) {
    return "△";
  }


  const text =
    String(value)
      .trim();


  /*
   * evaluationがJSONの場合にも対応。
   */

  if (
    text.startsWith("{")
  ) {

    try {

      const parsed =
        JSON.parse(text);


      if (
        parsed.evaluation
      ) {

        return normalizeEvaluation(
          parsed.evaluation
        );

      }


      if (
        parsed.ai_status ===
        "verified"
      ) {

        return "⭕️";

      }


    } catch {
      // ignore
    }

  }


  if (
    text.includes("⭕️") ||
    text.includes("⭕")
  ) {

    return "⭕️";

  }


  if (
    text.includes("❌")
  ) {

    return "❌";

  }


  if (
    text.includes("△")
  ) {

    return "△";

  }


  return "△";

}


/* =========================================================
   JSON FORMAT
   ========================================================= */

function prettyJsonOrText(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }


  if (
    typeof value === "object"
  ) {

    return JSON.stringify(
      value,
      null,
      2
    );

  }


  const text =
    String(value);


  try {

    return JSON.stringify(
      JSON.parse(text),
      null,
      2
    );

  } catch {

    return text;

  }

}


/* =========================================================
   DATE
   ========================================================= */

function formatDate(
  value
) {

  if (!value) {
    return "-";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(value);

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


/* =========================================================
   TRUNCATE
   ========================================================= */

function truncate(
  value,
  length
) {

  const text =
    String(value || "");


  if (
    text.length <= length
  ) {

    return text;

  }


  return (
    text.slice(
      0,
      length
    ) +
    "..."
  );

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}
