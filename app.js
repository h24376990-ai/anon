/* =========================================================
   RESEARCH AI LAB
   GitHub Pages
   Supabase -> research_jobs -> GitHub Actions
   ========================================================= */


/* =========================================================
   CONFIG
   ========================================================= */

const SUPABASE_URL =
  "https://hiefdcodifkfhnqvruzn.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_HmcPY6BGvUQTPESGHVe7Hw_W4NlTPqj";

const DEFAULT_PROJECT_ID =
  "ab429192-27d2-47e4-9ad7-08b639f45120";

const MAX_HISTORY =
  100;

const POLL_INTERVAL =
  4000;


/* =========================================================
   SUPABASE
   ========================================================= */

const supabase =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
  );


/* =========================================================
   STATE
   ========================================================= */

let currentProjectId =
  localStorage.getItem(
    "research_project_id",
  ) ||
  DEFAULT_PROJECT_ID;

localStorage.setItem(
  "research_project_id",
  currentProjectId,
);


let currentJob = null;

let latestResult = null;

let historyResults = [];

let savedResults = [];

let pollTimer = null;

let polling = false;

let stopRequested = false;


/* =========================================================
   DOM
   ========================================================= */

const $ = id =>
  document.getElementById(id);

const questionInput =
  $("questionInput");

const researchButton =
  $("researchButton");

const stopButton =
  $("stopButton");

const clearButton =
  $("clearButton");

const refreshButton =
  $("refreshButton");

const historyRefreshButton =
  $("historyRefreshButton");

const jobsRefreshButton =
  $("jobsRefreshButton");

const statusBox =
  $("statusBox");

const connectionDot =
  $("connectionDot");

const connectionText =
  $("connectionText");

const dbStatus =
  $("dbStatus");

const jobPanel =
  $("jobPanel");

const jobStatusTitle =
  $("jobStatusTitle");

const jobStatusBadge =
  $("jobStatusBadge");

const jobStatusText =
  $("jobStatusText");

const jobIdText =
  $("jobIdText");

const jobUpdatedText =
  $("jobUpdatedText");

const progressBar =
  $("progressBar");

const progressText =
  $("progressText");

const progressPercent =
  $("progressPercent");

const latestEmpty =
  $("latestEmpty");

const latestResultElement =
  $("latestResult");

const latestDate =
  $("latestDate");

const latestTitle =
  $("latestTitle");

const latestEvaluation =
  $("latestEvaluation");

const latestHypothesis =
  $("latestHypothesis");

const latestContent =
  $("latestContent");

const latestEvaluationText =
  $("latestEvaluationText");

const latestStatus =
  $("latestStatus");

const latestConfidence =
  $("latestConfidence");

const latestSaved =
  $("latestSaved");

const detailsButton =
  $("detailsButton");

const saveButton =
  $("saveButton");

const historyList =
  $("historyList");

const historySearch =
  $("historySearch");

const historyFilter =
  $("historyFilter");

const historyStat =
  $("historyStat");

const savedStat =
  $("savedStat");

const savedList =
  $("savedList");

const jobsList =
  $("jobsList");

const noteInput =
  $("noteInput");

const addNoteButton =
  $("addNoteButton");

const notesList =
  $("notesList");

const detailModal =
  $("detailModal");

const modalContent =
  $("modalContent");

const closeModalButton =
  $("closeModalButton");

const modelCanvas =
  $("modelCanvas");

const modelSpinButton =
  $("modelSpinButton");

const modelResetButton =
  $("modelResetButton");


/* =========================================================
   STATUS
   ========================================================= */

function showStatus(
  message,
  type = "",
) {

  statusBox.textContent =
    message;

  statusBox.className =
    "status-box";

  statusBox.classList.remove(
    "hidden",
  );

  if (type) {
    statusBox.classList.add(
      type,
    );
  }
}


function hideStatus() {

  statusBox.className =
    "status-box hidden";
}


/* =========================================================
   ERROR
   ========================================================= */

function errorMessage(error) {

  if (!error) {
    return "不明なエラーです。";
  }

  if (
    typeof error === "string"
  ) {
    return error;
  }

  return (
    error.message ||
    error.error_description ||
    JSON.stringify(
      error,
      null,
      2,
    )
  );
}


/* =========================================================
   CONNECTION
   ========================================================= */

async function checkConnection() {

  connectionText.textContent =
    "Supabase 接続確認中...";

  dbStatus.textContent =
    "確認中";

  connectionDot.classList.remove(
    "ok",
    "error",
  );

  try {

    const {
      error,
    } =
      await supabase
        .from("research_results")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        )
        .eq(
          "project_id",
          currentProjectId,
        );

    if (error) {
      throw error;
    }

    connectionDot.classList.add(
      "ok",
    );

    connectionText.textContent =
      "Supabase 接続済み";

    dbStatus.textContent =
      "ONLINE";

    return true;

  } catch (error) {

    console.error(
      "Supabase connection:",
      error,
    );

    connectionDot.classList.add(
      "error",
    );

    connectionText.textContent =
      "Supabase 接続エラー";

    dbStatus.textContent =
      "ERROR";

    showStatus(
      "Supabase接続に失敗しました。\n\n" +
      errorMessage(error),
      "error",
    );

    return false;
  }
}


/* =========================================================
   NAVIGATION
   ========================================================= */

document
  .querySelectorAll(
    ".nav-item",
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const screen =
            button.dataset.screen;

          switchScreen(
            screen,
          );

        },
      );

    },
  );


function switchScreen(
  name,
) {

  document
    .querySelectorAll(
      ".screen",
    )
    .forEach(
      screen => {

        screen.classList.remove(
          "active",
        );

      },
    );

  const target =
    $(
      `screen-${name}`,
    );

  if (target) {

    target.classList.add(
      "active",
    );

  }

  document
    .querySelectorAll(
      ".nav-item",
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.screen === name,
        );

      },
    );


  if (name === "history") {
    loadHistory();
  }

  if (name === "saved") {
    loadSavedResults();
  }

  if (name === "jobs") {
    loadJobs();
  }

  if (name === "notes") {
    renderNotes();
  }
}


/* =========================================================
   CREATE RESEARCH JOB
   ========================================================= */

async function createResearchJob(
  question,
) {

  const payload = {

    research_question:
      question,

    question:
      question,

    message:
      question,

    source:
      "research_ai_lab_web",

    client_version:
      "2026.08.18",

    configuration: {

      max_history:
        MAX_HISTORY,

      prevent_plausible_lies:
        true,

      save_all_ai_results:
        true,

      preserve_good_results:
        true,

      route_repeat_limit:
        3,

    },

  };


  const record = {

    project_id:
      currentProjectId,

    job_type:
      "research",

    status:
      "queued",

    priority:
      0,

    payload:
      payload,

  };


  const {
    data,
    error,
  } =
    await supabase
      .from("research_jobs")
      .insert(
        record,
      )
      .select(
        "id,project_id,job_type,status,priority,payload,result,error_message,started_at,finished_at,created_at",
      )
      .single();


  if (error) {
    throw error;
  }

  return data;
}


/* =========================================================
   START RESEARCH
   ========================================================= */

async function runResearch() {

  const question =
    questionInput.value.trim();


  if (!question) {

    showStatus(
      "研究したい数学的な問題を入力してください。",
      "error",
    );

    questionInput.focus();

    return;
  }


  if (currentJob) {

    showStatus(
      "すでに研究ジョブが実行中です。",
      "error",
    );

    return;
  }


  researchButton.disabled =
    true;

  clearButton.disabled =
    true;

  stopButton.classList.remove(
    "hidden",
  );

  stopRequested =
    false;


  try {

    await checkConnection();


    showStatus(
      "research_jobs に研究ジョブを登録しています...",
    );

    setProgress(
      8,
      "研究ジョブを作成しています...",
    );


    const job =
      await createResearchJob(
        question,
      );


    currentJob =
      job;


    renderJob(
      job,
    );


    showStatus(
      [
        "研究ジョブをキューに追加しました。",
        "",
        `JOB ID: ${job.id}`,
        "",
        "GitHub Actionsが queued ジョブを取得すると研究が開始されます。",
      ].join("\n"),
      "success",
    );


    setProgress(
      15,
      "研究キューに登録済み。AI処理を待っています...",
    );


    startPolling(
      job.id,
    );


  } catch (error) {

    console.error(
      "Create job error:",
      error,
    );

    showStatus(
      "研究ジョブの作成に失敗しました。\n\n" +
      errorMessage(error),
      "error",
    );

    resetResearchButtons();

  }

}


/* =========================================================
   JOB POLLING
   ========================================================= */

function startPolling(
  jobId,
) {

  stopPolling();

  polling =
    true;


  pollTimer =
    setInterval(
      () => {

        pollJob(
          jobId,
        );

      },
      POLL_INTERVAL,
    );


  pollJob(
    jobId,
  );
}


function stopPolling() {

  if (pollTimer) {

    clearInterval(
      pollTimer,
    );

    pollTimer =
      null;
  }

  polling =
    false;
}


/* =========================================================
   GET JOB
   ========================================================= */

async function getJob(
  jobId,
) {

  const {
    data,
    error,
  } =
    await supabase
      .from("research_jobs")
      .select(
        "*",
      )
      .eq(
        "id",
        jobId,
      )
      .maybeSingle();


  if (error) {
    throw error;
  }

  return data;
}


/* =========================================================
   POLL JOB
   ========================================================= */

async function pollJob(
  jobId,
) {

  try {

    const job =
      await getJob(
        jobId,
      );


    if (!job) {

      showStatus(
        "研究ジョブが見つかりません。\n\n" +
        "Supabase側で削除された可能性があります。",
        "error",
      );

      stopPolling();

      resetResearchButtons();

      currentJob =
        null;

      return;
    }


    currentJob =
      job;


    renderJob(
      job,
    );


    const status =
      String(
        job.status ||
        "",
      ).toLowerCase();


    if (
      status === "queued"
    ) {

      setProgress(
        15,
        "研究キューで待機中...",
      );

      return;
    }


    if (
      status === "running"
    ) {

      setProgress(
        55,
        "AIが研究・検証を実行しています...",
      );

      showStatus(
        [
          "AI研究処理中...",
          "",
          "GitHub Actions → OpenRouter → 検証",
          "",
          "この画面を閉じてもバックグラウンド処理は継続します。",
        ].join("\n"),
      );

      return;
    }


    if (
      status === "completed"
    ) {

      stopPolling();

      setProgress(
        100,
        "研究完了",
      );

      showStatus(
        "研究が完了しました。結果を読み込んでいます...",
        "success",
      );


      await loadHistory();

      await loadLatestResult();


      currentJob =
        null;

      resetResearchButtons();

      return;
    }


    if (
      status === "failed"
    ) {

      stopPolling();

      setProgress(
        100,
        "研究失敗",
      );

      showStatus(
        [
          "研究ジョブが失敗しました。",
          "",
          formatJobError(job),
        ].join("\n"),
        "error",
      );


      currentJob =
        null;

      resetResearchButtons();

      return;
    }


    if (
      status === "cancelled" ||
      status === "canceled"
    ) {

      stopPolling();

      setProgress(
        100,
        "研究停止",
      );

      showStatus(
        "研究ジョブは停止されました。",
      );


      currentJob =
        null;

      resetResearchButtons();

      return;
    }


  } catch (error) {

    console.error(
      "Job polling error:",
      error,
    );

    /*
      一時的な通信エラーでは
      研究自体を停止しない。
    */

    showStatus(
      "ジョブ状態の取得を一時的に失敗しました。\n\n" +
      errorMessage(error) +
      "\n\n再試行しています...",
      "error",
    );

  }

}


/* =========================================================
   RENDER JOB
   ========================================================= */

function renderJob(
  job,
) {

  if (!job) {

    jobPanel.classList.add(
      "hidden",
    );

    return;
  }


  jobPanel.classList.remove(
    "hidden",
  );


  const status =
    String(
      job.status ||
      "queued",
    ).toLowerCase();


  jobStatusBadge.textContent =
    status.toUpperCase();

  jobStatusBadge.className =
    "job-badge";


  if (
    status === "running"
  ) {

    jobStatusBadge.classList.add(
      "running",
    );

  }

  if (
    status === "completed"
  ) {

    jobStatusBadge.classList.add(
      "completed",
    );

  }

  if (
    status === "failed" ||
    status === "cancelled" ||
    status === "canceled"
  ) {

    jobStatusBadge.classList.add(
      "failed",
    );

  }


  jobStatusText.textContent =
    status;

  jobIdText.textContent =
    job.id || "---";

  jobUpdatedText.textContent =
    formatDate(
      job.updated_at ||
      job.finished_at ||
      job.started_at ||
      job.created_at,
    );


  const titles = {

    queued:
      "研究キューで待機中",

    running:
      "AI研究・検証中",

    completed:
      "研究完了",

    failed:
      "研究失敗",

    cancelled:
      "研究停止",

    canceled:
      "研究停止",

  };


  jobStatusTitle.textContent =
    titles[status] ||
    "研究処理中";


  if (
    status === "queued"
  ) {

    stopButton.classList.remove(
      "hidden",
    );

  }


  if (
    status === "running"
  ) {

    stopButton.classList.remove(
      "hidden",
    );

  }


  if (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "canceled"
  ) {

    stopButton.classList.add(
      "hidden",
    );

  }

}


/* =========================================================
   PROGRESS
   ========================================================= */

function setProgress(
  percent,
  text,
) {

  const safe =
    Math.max(
      0,
      Math.min(
        100,
        percent,
      ),
    );


  progressBar.style.width =
    `${safe}%`;

  progressPercent.textContent =
    `${Math.round(safe)}%`;

  progressText.textContent =
    text;
}


/* =========================================================
   STOP
   ========================================================= */

async function stopResearch() {

  if (!currentJob) {

    showStatus(
      "停止する研究ジョブがありません。",
    );

    return;
  }


  stopRequested =
    true;


  stopPolling();


  /*
    現在のanon権限では
    research_jobs UPDATEが許可されていない可能性がある。

    そのため、まず安全にUI側の監視を停止する。
  */

  showStatus(
    [
      "停止要求を処理しています。",
      "",
      `JOB ID: ${currentJob.id}`,
      "",
      "現在のSupabase権限ではブラウザから直接UPDATEできない場合があります。",
      "その場合はサーバー側のキャンセル処理が必要です。",
    ].join("\n"),
  );


  /*
    ここでは勝手にcompleted/failedに変更しない。
    DBの実際の状態を壊さないため。
  */

  resetResearchButtons();

}


/* =========================================================
   RESET BUTTONS
   ========================================================= */

function resetResearchButtons() {

  researchButton.disabled =
    false;

  clearButton.disabled =
    false;

  stopButton.classList.add(
    "hidden",
  );

}


/* =========================================================
   LOAD HISTORY
   ========================================================= */

async function loadHistory() {

  try {

    const {
      data,
      error,
    } =
      await supabase
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
            "updated_at",
          ].join(","),
        )
        .eq(
          "project_id",
          currentProjectId,
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        )
        .limit(
          MAX_HISTORY,
        );


    if (error) {
      throw error;
    }


    historyResults =
      data || [];


    historyStat.textContent =
      historyResults.length;


    savedResults =
      historyResults.filter(
        item =>
          item.is_human_saved === true,
      );


    savedStat.textContent =
      savedResults.length;


    renderHistory();


    renderSavedResults();


    return historyResults;

  } catch (error) {

    console.error(
      "History error:",
      error,
    );


    historyList.innerHTML =
      emptyHTML(
        "履歴を読み込めませんでした",
        errorMessage(error),
      );


    return [];

  }

}


/* =========================================================
   LOAD LATEST
   ========================================================= */

async function loadLatestResult() {

  try {

    const {
      data,
      error,
    } =
      await supabase
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
            "updated_at",
          ].join(","),
        )
        .eq(
          "project_id",
          currentProjectId,
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        )
        .limit(
          1,
        )
        .maybeSingle();


    if (error) {
      throw error;
    }


    if (data) {

      latestResult =
        data;

      renderLatest(
        data,
      );

    }

  } catch (error) {

    console.error(
      "Latest result error:",
      error,
    );

  }

}


/* =========================================================
   PARSE JSON SAFELY
   ========================================================= */

function parseJson(
  value,
) {

  if (!value) {
    return null;
  }

  if (
    typeof value ===
    "object"
  ) {
    return value;
  }

  try {

    return JSON.parse(
      value,
    );

  } catch {

    return null;

  }

}


/* =========================================================
   EVALUATION
   ========================================================= */

function getEvaluation(
  result,
) {

  return parseJson(
    result?.evaluation,
  ) || {};

}


function getEvaluationSymbol(
  result,
) {

  const evaluation =
    getEvaluation(
      result,
    );


  if (
    evaluation.overall_symbol
  ) {

    return evaluation.overall_symbol;

  }


  if (
    evaluation.overall
  ) {

    return evaluation.overall;

  }


  if (
    result.status ===
    "completed"
  ) {

    return "△";

  }


  if (
    result.status ===
    "good"
  ) {

    return "⭕️";

  }


  if (
    result.status ===
    "bad"
  ) {

    return "❌";

  }


  return "△";
}


/* =========================================================
   RENDER LATEST
   ========================================================= */

function renderLatest(
  result,
) {

  if (!result) {

    latestEmpty.classList.remove(
      "hidden",
    );

    latestResultElement.classList.add(
      "hidden",
    );

    return;
  }


  latestEmpty.classList.add(
    "hidden",
  );

  latestResultElement.classList.remove(
    "hidden",
  );


  latestDate.textContent =
    formatDate(
      result.created_at,
    );


  latestTitle.textContent =
    result.title ||
    "無題の研究";


  latestHypothesis.textContent =
    result.hypothesis ||
    "記録なし";


  const content =
    parseJson(
      result.content,
    );


  latestContent.textContent =
    formatContent(
      content,
    );


  const evaluation =
    getEvaluation(
      result,
    );


  latestEvaluationText.textContent =
    formatEvaluation(
      evaluation,
    );


  const symbol =
    getEvaluationSymbol(
      result,
    );


  latestEvaluation.textContent =
    symbol;


  latestEvaluation.className =
    "evaluation-symbol";


  if (
    symbol.includes("⭕")
  ) {

    latestEvaluation.classList.add(
      "good",
    );

  }

  if (
    symbol.includes("❌")
  ) {

    latestEvaluation.classList.add(
      "bad",
    );

  }


  latestStatus.textContent =
    `status: ${result.status || "pending"}`;


  latestConfidence.textContent =
    `confidence: ${result.confidence_level ?? 0}/5`;


  latestSaved.textContent =
    result.is_human_saved
      ? "⭕ 自分用保存済み"
      : "AI DB保存済み";


  saveButton.textContent =
    result.is_human_saved
      ? "✓ 保存済み"
      : "⭕ 自分用に保存";


  saveButton.disabled =
    Boolean(
      result.is_human_saved,
    );

}


/* =========================================================
   FORMAT CONTENT
   ========================================================= */

function formatContent(
  content,
) {

  if (!content) {
    return "研究内容がありません。";
  }


  if (
    typeof content ===
    "string"
  ) {

    return content;

  }


  const sections = [];


  if (
    content.research_question
  ) {

    sections.push(
      "研究質問\n" +
      content.research_question,
    );

  }


  if (
    content.known_facts?.length
  ) {

    sections.push(
      "既知の事実\n" +
      listText(
        content.known_facts,
      ),
    );

  }


  if (
    content.assumptions?.length
  ) {

    sections.push(
      "仮定\n" +
      listText(
        content.assumptions,
      ),
    );

  }


  if (
    content.approach?.length
  ) {

    sections.push(
      "アプローチ\n" +
      listText(
        content.approach,
      ),
    );

  }


  if (
    content.proof_strategy?.length
  ) {

    sections.push(
      "証明戦略\n" +
      listText(
        content.proof_strategy,
      ),
    );

  }


  if (
    content.counterexample_strategy?.length
  ) {

    sections.push(
      "反例戦略\n" +
      listText(
        content.counterexample_strategy,
      ),
    );

  }


  if (
    content.cross_domain_connection?.length
  ) {

    sections.push(
      "分野横断接続\n" +
      listText(
        content.cross_domain_connection,
      ),
    );

  }


  if (
    content.critical_gap
  ) {

    sections.push(
      "Critical Gap\n" +
      content.critical_gap,
    );

  }


  if (
    content.next_steps?.length
  ) {

    sections.push(
      "次のステップ\n" +
      listText(
        content.next_steps,
      ),
    );

  }


  return sections.join(
    "\n\n",
  ) || "研究内容があります。";
}


function listText(
  value,
) {

  if (!Array.isArray(value)) {
    return String(value);
  }

  return value
    .map(
      (item, index) =>
        `${index + 1}. ${typeof item === "object" ? JSON.stringify(item) : item}`,
    )
    .join("\n");
}


/* =========================================================
   FORMAT EVALUATION
   ========================================================= */

function formatEvaluation(
  evaluation,
) {

  if (!evaluation) {
    return "まだ評価情報がありません。";
  }


  const lines = [];


  if (
    evaluation.ai_status
  ) {

    lines.push(
      `AI status: ${evaluation.ai_status}`,
    );

  }


  if (
    evaluation.ai_confidence !==
    undefined
  ) {

    lines.push(
      `AI confidence: ${evaluation.ai_confidence}`,
    );

  }


  if (
    evaluation.critical_gap
  ) {

    lines.push(
      `Critical gap: ${evaluation.critical_gap}`,
    );

  }


  if (
    evaluation.reason
  ) {

    lines.push(
      `理由: ${evaluation.reason}`,
    );

  }


  if (
    evaluation.overall_symbol
  ) {

    lines.push(
      `総合評価: ${evaluation.overall_symbol}`,
    );

  }


  return (
    lines.join("\n") ||
    JSON.stringify(
      evaluation,
      null,
      2,
    )
  );

}


/* =========================================================
   HISTORY
   ========================================================= */

function renderHistory() {

  const search =
    historySearch.value
      .trim()
      .toLowerCase();


  const filter =
    historyFilter.value;


  let results =
    historyResults.filter(
      result => {

        const title =
          String(
            result.title || "",
          ).toLowerCase();

        const hypothesis =
          String(
            result.hypothesis || "",
          ).toLowerCase();


        const matchesSearch =
          !search ||
          title.includes(
            search,
          ) ||
          hypothesis.includes(
            search,
          );


        const symbol =
          getEvaluationSymbol(
            result,
          );


        let matchesFilter =
          true;


        if (
          filter === "good"
        ) {

          matchesFilter =
            symbol.includes("⭕") ||
            result.is_human_saved;

        }


        if (
          filter === "maybe"
        ) {

          matchesFilter =
            symbol.includes("△");

        }


        if (
          filter === "bad"
        ) {

          matchesFilter =
            symbol.includes("❌");

        }


        return (
          matchesSearch &&
          matchesFilter
        );

      },
    );


  if (!results.length) {

    historyList.innerHTML =
      emptyHTML(
        "該当する研究がありません",
        "",
      );

    return;
  }


  historyList.innerHTML =
    results
      .map(
        createHistoryItem,
      )
      .join("");


  historyList
    .querySelectorAll(
      "[data-result-id]",
    )
    .forEach(
      element => {

        element.addEventListener(
          "click",
          () => {

            const id =
              element.dataset.resultId;


            const result =
              historyResults.find(
                item =>
                  item.id === id,
              );


            if (!result) {
              return;
            }


            latestResult =
              result;


            renderLatest(
              result,
            );


            switchScreen(
              "dashboard",
            );

          },
        );

      },
    );

}


/* =========================================================
   HISTORY ITEM
   ========================================================= */

function createHistoryItem(
  result,
) {

  const symbol =
    getEvaluationSymbol(
      result,
    );


  const symbolClass =
    symbol.includes("⭕")
      ? "good"
      : symbol.includes("❌")
        ? "bad"
        : "";


  return `
    <div
      class="history-item"
      data-result-id="${escapeHtml(result.id)}"
    >

      <div class="history-symbol ${symbolClass}">
        ${escapeHtml(symbol)}
      </div>

      <div>

        <div class="history-title">
          ${escapeHtml(
            result.title ||
            "無題の研究",
          )}
        </div>

        <div class="history-hypothesis">
          ${escapeHtml(
            result.hypothesis ||
            "仮説なし",
          )}
        </div>

      </div>

      <div class="history-date">
        ${formatDate(
          result.created_at,
        )}
      </div>

    </div>
  `;

}


/* =========================================================
   SAVED
   ========================================================= */

function renderSavedResults() {

  if (!savedResults.length) {

    savedList.innerHTML =
      emptyHTML(
        "まだ保存した研究はありません",
        "重要な研究結果を ⭕ 自分用に保存できます。",
      );

    return;
  }


  savedList.innerHTML =
    savedResults
      .map(
        createHistoryItem,
      )
      .join("");


  savedList
    .querySelectorAll(
      "[data-result-id]",
    )
    .forEach(
      element => {

        element.addEventListener(
          "click",
          () => {

            const id =
              element.dataset.resultId;


            const result =
              savedResults.find(
                item =>
                  item.id === id,
              );


            if (!result) {
              return;
            }


            latestResult =
              result;


            renderLatest(
              result,
            );


            switchScreen(
              "dashboard",
            );

          },
        );

      },
    );

}


async function loadSavedResults() {

  try {

    const {
      data,
      error,
    } =
      await supabase
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
            "updated_at",
          ].join(","),
        )
        .eq(
          "project_id",
          currentProjectId,
        )
        .eq(
          "is_human_saved",
          true,
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        );


    if (error) {
      throw error;
    }


    savedResults =
      data || [];


    savedStat.textContent =
      savedResults.length;


    renderSavedResults();

  } catch (error) {

    savedList.innerHTML =
      emptyHTML(
        "保存結果の読み込みに失敗",
        errorMessage(error),
      );

  }

}


/* =========================================================
   SAVE RESULT
   ========================================================= */

async function saveLatestResult() {

  if (!latestResult?.id) {

    showStatus(
      "保存する研究結果がありません。",
      "error",
    );

    return;
  }


  saveButton.disabled =
    true;


  try {

    const {
      data,
      error,
    } =
      await supabase
        .from("research_results")
        .update(
          {
            is_human_saved:
              true,
          },
        )
        .eq(
          "id",
          latestResult.id,
        )
        .eq(
          "project_id",
          currentProjectId,
        )
        .select(
          "*",
        )
        .single();


    if (error) {
      throw error;
    }


    latestResult =
      data;


    showStatus(
      "研究結果を自分用に保存しました。",
      "success",
    );


    await loadHistory();

    await loadSavedResults();

    renderLatest(
      latestResult,
    );


  } catch (error) {

    console.error(
      "Save result error:",
      error,
    );


    showStatus(
      [
        "保存に失敗しました。",
        "",
        errorMessage(error),
        "",
        "現在のSupabase RLS設定でUPDATE権限が必要です。",
      ].join("\n"),
      "error",
    );


    saveButton.disabled =
      false;

  }

}


/* =========================================================
   JOB LIST
   ========================================================= */

async function loadJobs() {

  try {

    const {
      data,
      error,
    } =
      await supabase
        .from("research_jobs")
        .select(
          "*",
        )
        .eq(
          "project_id",
          currentProjectId,
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        )
        .limit(
          50,
        );


    if (error) {
      throw error;
    }


    if (!data?.length) {

      jobsList.innerHTML =
        emptyHTML(
          "研究ジョブはありません",
          "",
        );

      return;

    }


    jobsList.innerHTML =
      data
        .map(
          job => {

            return `
              <div class="job-item">

                <div class="job-status">
                  ${escapeHtml(
                    String(
                      job.status ||
                      "unknown",
                    ).toUpperCase(),
                  )}
                </div>

                <div>

                  <div class="job-item-title">
                    ${escapeHtml(
                      getJobQuestion(job),
                    )}
                  </div>

                  <div class="job-item-id">
                    ${escapeHtml(
                      job.id,
                    )}
                  </div>

                </div>

                <div class="history-date">
                  ${formatDate(
                    job.created_at,
                  )}
                </div>

              </div>
            `;

          },
        )
        .join("");

  } catch (error) {

    jobsList.innerHTML =
      emptyHTML(
        "ジョブを読み込めませんでした",
        errorMessage(error),
      );

  }

}


function getJobQuestion(
  job,
) {

  const payload =
    parseJson(
      job.payload,
    );


  return (
    payload?.research_question ||
    payload?.question ||
    payload?.message ||
    job.job_type ||
    "研究ジョブ"
  );

}


/* =========================================================
   NOTES
   ========================================================= */

function getNotes() {

  try {

    return JSON.parse(
      localStorage.getItem(
        "research_ai_notes",
      ) || "[]",
    );

  } catch {

    return [];

  }

}


function saveNotes(
  notes,
) {

  localStorage.setItem(
    "research_ai_notes",
    JSON.stringify(
      notes,
    ),
  );

}


function renderNotes() {

  const notes =
    getNotes();


  if (!notes.length) {

    notesList.innerHTML =
      emptyHTML(
        "まだメモがありません",
        "研究中のアイデアや他AIからの引き継ぎ内容を保存できます。",
      );

    return;
  }


  notesList.innerHTML =
    notes
      .map(
        note => {

          return `
            <article
              class="note-card"
              data-note-id="${escapeHtml(note.id)}"
            >

              <button
                class="note-delete"
                data-delete-note="${escapeHtml(note.id)}"
                title="削除"
              >
                ×
              </button>

              <div class="note-content">
                ${escapeHtml(note.content)}
              </div>

              <div class="note-date">
                ${formatDate(note.created_at)}
              </div>

            </article>
          `;

        },
      )
      .join("");


  notesList
    .querySelectorAll(
      "[data-delete-note]",
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            deleteNote(
              button.dataset.deleteNote,
            );

          },
        );

      },
    );

}


function addNote() {

  const content =
    noteInput.value.trim();


  if (!content) {

    showStatus(
      "保存するメモを入力してください。",
      "error",
    );

    return;

  }


  const notes =
    getNotes();


  notes.unshift({

    id:
      crypto.randomUUID(),

    content:
      content,

    created_at:
      new Date().toISOString(),

  });


  saveNotes(
    notes,
  );


  noteInput.value =
    "";


  renderNotes();


  showStatus(
    "メモを保存しました。",
    "success",
  );

}


function deleteNote(
  id,
) {

  const notes =
    getNotes()
      .filter(
        note =>
          note.id !== id,
      );


  saveNotes(
    notes,
  );


  renderNotes();


  showStatus(
    "メモを削除しました。",
    "success",
  );

}


/* =========================================================
   MODAL
   ========================================================= */

function openResultDetails(
  result,
) {

  if (!result) {
    return;
  }


  const content =
    parseJson(
      result.content,
    );


  const evaluation =
    getEvaluation(
      result,
    );


  modalContent.textContent =
    [
      `タイトル`,
      result.title || "無題",
      "",
      `仮説`,
      result.hypothesis || "なし",
      "",
      `研究内容`,
      formatContent(content),
      "",
      `評価`,
      formatEvaluation(evaluation),
      "",
      `信頼度`,
      `${result.confidence_level ?? 0}/5`,
      "",
      `保存状態`,
      result.is_human_saved
        ? "⭕ 自分用保存済み"
        : "AI DB保存のみ",
      "",
      `作成日時`,
      formatDate(result.created_at),
    ].join("\n");


  detailModal.classList.remove(
    "hidden",
  );

}


function closeModal() {

  detailModal.classList.add(
    "hidden",
  );

}


/* =========================================================
   3D
   ========================================================= */

let modelSpinning =
  true;


modelSpinButton.addEventListener(
  "click",
  () => {

    modelSpinning =
      !modelSpinning;


    modelCanvas.classList.toggle(
      "paused",
      !modelSpinning,
    );


    modelSpinButton.textContent =
      modelSpinning
        ? "回転停止"
        : "回転開始";

  },
);


modelResetButton.addEventListener(
  "click",
  () => {

    modelCanvas.classList.remove(
      "paused",
    );

    modelSpinning =
      true;

    modelSpinButton.textContent =
      "回転停止";

  },
);


/* =========================================================
   BUTTON EVENTS
   ========================================================= */

researchButton.addEventListener(
  "click",
  runResearch,
);


stopButton.addEventListener(
  "click",
  stopResearch,
);


clearButton.addEventListener(
  "click",
  () => {

    questionInput.value =
      "";

    hideStatus();

  },
);


refreshButton.addEventListener(
  "click",
  async () => {

    await loadHistory();

    await loadLatestResult();

    showStatus(
      "研究結果を更新しました。",
      "success",
    );

  },
);


historyRefreshButton.addEventListener(
  "click",
  loadHistory,
);


jobsRefreshButton.addEventListener(
  "click",
  loadJobs,
);


saveButton.addEventListener(
  "click",
  saveLatestResult,
);


detailsButton.addEventListener(
  "click",
  () => {

    openResultDetails(
      latestResult,
    );

  },
);


addNoteButton.addEventListener(
  "click",
  addNote,
);


$("clearNotesButton")
  .addEventListener(
    "click",
    renderNotes,
  );


closeModalButton.addEventListener(
  "click",
  closeModal,
);


document
  .querySelector(
    ".modal-backdrop",
  )
  .addEventListener(
    "click",
    closeModal,
  );


historySearch.addEventListener(
  "input",
  renderHistory,
);


historyFilter.addEventListener(
  "change",
  renderHistory,
);


/* =========================================================
   KEYBOARD
   ========================================================= */

questionInput.addEventListener(
  "keydown",
  event => {

    if (
      (event.metaKey ||
       event.ctrlKey) &&
      event.key === "Enter"
    ) {

      event.preventDefault();

      runResearch();

    }

  },
);


/* =========================================================
   HELPERS
   ========================================================= */

function formatDate(
  date,
) {

  if (!date) {
    return "---";
  }


  const value =
    new Date(date);


  if (
    Number.isNaN(
      value.getTime(),
    )
  ) {

    return "---";

  }


  return value.toLocaleString(
    "ja-JP",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

}


function escapeHtml(
  value,
) {

  return String(
    value ?? "",
  )
    .replace(
      /&/g,
      "&amp;",
    )
    .replace(
      /</g,
      "&lt;",
    )
    .replace(
      />/g,
      "&gt;",
    )
    .replace(
      /"/g,
      "&quot;",
    )
    .replace(
      /'/g,
      "&#039;",
    );

}


function emptyHTML(
  title,
  subtitle,
) {

  return `
    <div class="empty-state">

      <div class="empty-icon">
        ∑
      </div>

      <strong>
        ${escapeHtml(title)}
      </strong>

      ${
        subtitle
          ? `<span>${escapeHtml(subtitle)}</span>`
          : ""
      }

    </div>
  `;

}


function formatJobError(
  job,
) {

  const error =
    job?.error_message ||
    job?.error_massage ||
    job?.result;


  if (!error) {

    return "エラー詳細は記録されていません。";

  }


  if (
    typeof error ===
    "object"
  ) {

    return JSON.stringify(
      error,
      null,
      2,
    );

  }


  return String(error);

}


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initialize() {

  console.log(
    "Research AI Lab initializing...",
  );


  const connected =
    await checkConnection();


  if (!connected) {

    console.warn(
      "Supabase connection failed.",
    );

  }


  await loadHistory();

  await loadLatestResult();

  renderNotes();


  /*
    ページを再読み込みした場合、
    DBにrunning/queuedのジョブがあれば
    そのジョブを画面へ復帰させる。
  */

  try {

    const {
      data,
      error,
    } =
      await supabase
        .from("research_jobs")
        .select(
          "*",
        )
        .eq(
          "project_id",
          currentProjectId,
        )
        .in(
          "status",
          [
            "queued",
            "running",
          ],
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        )
        .limit(
          1,
        )
        .maybeSingle();


    if (!error && data) {

      currentJob =
        data;


      renderJob(
        data,
      );


      startPolling(
        data.id,
      );


      showStatus(
        "実行中の研究ジョブを復元しました。",
      );

    }

  } catch (error) {

    console.warn(
      "Running job recovery:",
      error,
    );

  }


  console.log(
    "Research AI Lab ready.",
  );

}


initialize();
