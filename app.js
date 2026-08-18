const SUPABASE_URL =
  "https://hiefdcodifkfhnqvruzn.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_HmcPY6BGvUQTPESGHVe7Hw_W4NlTPqj";

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


let activeJobId = null;
let pollTimer = null;
let lastResults = [];


const $ =
  id =>
    document.getElementById(id);


function esc(value) {

  return String(value ?? "")
    .replace(
      /[&<>\"']/g,
      c =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "\"": "&quot;",
          "'": "&#039;"
        })[c]
    );
}


function formatDate(value) {

  if (!value) {
    return "—";
  }

  const d =
    new Date(value);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {
    return "—";
  }

  return d.toLocaleString(
    "ja-JP"
  );
}


function parseJson(value) {

  if (!value) {
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
      text: String(value)
    };

  }
}


function resultSymbol(result) {

  if (
    result?.evaluation === "⭕️" ||
    result?.evaluation === "⭕"
  ) {
    return "⭕";
  }

  if (
    result?.evaluation === "❌"
  ) {
    return "❌";
  }

  return "△";
}


function setStatus(
  text,
  type = ""
) {

  const box =
    $("statusBox");

  box.textContent =
    text;

  box.className =
    `status ${type}`;
}


function setConnection(
  ok,
  text
) {

  $("connectionText")
    .textContent =
    text;

  $("connectionDot")
    .className =
    `dot ${ok ? "ok" : "bad"}`;

  $("systemSupabase")
    ?.replaceChildren(
      document.createTextNode(
        ok ? "ONLINE" : "ERROR"
      )
    );
}


async function withTimeout(
  promise,
  milliseconds = 8000
) {

  let timer;

  const timeout =
    new Promise(
      (_, reject) => {

        timer =
          setTimeout(
            () =>
              reject(
                new Error(
                  "Supabase接続がタイムアウトしました"
                )
              ),
            milliseconds
          );

      }
    );

  try {

    return await Promise.race([
      promise,
      timeout
    ]);

  } finally {

    clearTimeout(timer);

  }
}


/* =========================================================
   SUPABASE CONNECTION
========================================================= */

async function checkConnection() {

  try {

    const response =
      await withTimeout(
        sb
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
      );

    if (response.error) {
      throw response.error;
    }

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
    page === "history"
  ) {
    loadHistory();
  }

  if (
    page === "saved"
  ) {
    loadSaved();
  }

  if (
    page === "jobs"
  ) {
    loadJobs();
  }

  if (
    page === "memory"
  ) {
    loadMemory();
  }

  if (
    page === "routes"
  ) {
    loadRoutes();
  }

}


/* =========================================================
   HISTORY
========================================================= */

async function loadHistory() {

  const box =
    $("historyList");

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
          "id,project_id,title,hypothesis,content,status,evaluation,confidence_level,is_human_saved,created_at,updated_at"
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
      lastResults.length
    ) {

      renderDetail(
        lastResults[0]
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
        ${esc(error.message)}
      </div>`;

  }

}


/* =========================================================
   SAVED
========================================================= */

async function loadSaved() {

  const box =
    $("savedList");

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
          "id,project_id,title,hypothesis,content,status,evaluation,confidence_level,is_human_saved,created_at,updated_at"
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


    if (error) {
      throw error;
    }


    renderResults(
      box,
      data || []
    );

  } catch (error) {

    box.innerHTML =
      `<div class="error">
        保存結果取得失敗<br>
        ${esc(error.message)}
      </div>`;

  }

}


/* =========================================================
   JOBS
========================================================= */

async function loadJobs() {

  const box =
    $("jobsList");

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
          "research_jobs"
        )
        .select(
          "id,project_id,job_type,status,priority,payload,result,error_message,started_at,finished_at,created_at"
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
        .limit(50);


    if (error) {
      throw error;
    }


    if (!data?.length) {

      box.innerHTML =
        `<div class="empty">
          研究ジョブはありません。
        </div>`;

      return;

    }


    box.innerHTML =
      data
        .map(
          job =>
            `
            <div class="job-row">

              <div>

                <b>
                  ${esc(
                    job.payload?.theme ||
                    job.job_type ||
                    "Research"
                  )}
                </b>

                <small>
                  ${formatDate(
                    job.created_at
                  )}
                </small>

              </div>

              <span class="badge">
                ${esc(
                  job.status
                )}
              </span>

            </div>
            `
        )
        .join("");


  } catch (error) {

    box.innerHTML =
      `<div class="error">
        ジョブ取得失敗<br>
        ${esc(error.message)}
      </div>`;

  }

}


/* =========================================================
   MEMORY
========================================================= */

async function loadMemory() {

  const box =
    $("memoryList");

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


    if (error) {
      throw error;
    }


    box.innerHTML =
      `
      <div class="memory-stat">

        <strong>
          ${count ?? 0}
        </strong>

        <span>
          AI側に保持されている研究結果
        </span>

      </div>

      <p class="memory-note">
        画面では最新100件だけを表示します。
        AI側の研究結果DBとは分離して考えます。
      </p>
      `;

  } catch (error) {

    box.innerHTML =
      `<div class="error">
        ${esc(error.message)}
      </div>`;

  }

}


/* =========================================================
   ROUTES
========================================================= */

async function loadRoutes() {

  $("routesList").innerHTML =
    `
    <div class="empty">

      現在のDBでは探索ルート専用テーブルを使用せず、
      研究結果のcontent JSONに研究アプローチを保存しています。

      <br><br>

      次段階でルート分析DBを追加できます。

    </div>
    `;

}


/* =========================================================
   RESULT LIST
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
    rows
      .map(
        result =>
          `
          <button
            class="result-row"
            data-id="${esc(result.id)}"
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
                  item.id ===
                  element.dataset.id
              );

            if (result) {
              renderDetail(
                result
              );
            }

          }
        );

      }
    );

}


/* =========================================================
   RESULT DETAIL
========================================================= */

function renderDetail(
  result
) {

  const content =
    parseJson(
      result.content
    );


  $("detail").innerHTML =
    `
    <div class="detail-head">

      <span class="big-symbol">
        ${resultSymbol(result)}
      </span>

      <div>

        <h3>
          ${esc(
            result.title
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

      <pre>
${esc(
  JSON.stringify(
    content,
    null,
    2
  )
)}
      </pre>

    </section>


    <div class="detail-actions">

      <button
        id="saveDetail"
        class="button primary"
      >
        ${
          result.is_human_saved
            ? "★ 保存済み"
            : "★ 保存"
        }
      </button>

    </div>
    `;


  $("saveDetail")
    .addEventListener(
      "click",
      () =>
        toggleSave(
          result
        )
    );

}


/* =========================================================
   SAVE / UNSAVE
========================================================= */

async function toggleSave(
  result
) {

  try {

    const {
      error
    } =
      await sb
        .from(
          "research_results"
        )
        .update({
          is_human_saved:
            !result.is_human_saved
        })
        .eq(
          "id",
          result.id
        )
        .eq(
          "project_id",
          PROJECT_ID
        );


    if (error) {
      throw error;
    }


    setStatus(
      result.is_human_saved
        ? "保存を解除しました。"
        : "研究結果を保存しました。",
      "success"
    );


    await loadHistory();
    await loadSaved();

  } catch (error) {

    setStatus(
      `保存変更失敗: ${error.message}`,
      "error"
    );

  }

}


/* =========================================================
   START RESEARCH
========================================================= */

async function startResearch() {

  const theme =
    $("questionInput")
      .value
      .trim();


  if (!theme) {

    setStatus(
      "研究テーマを入力してください。",
      "error"
    );

    return;

  }


  $("researchButton")
    .disabled = true;

  $("stopButton")
    .disabled = false;


  setStatus(
    "研究ジョブをキューへ登録しています..."
  );


  try {

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
            "research",

          status:
            "queued",

          priority:
            0,

          payload: {
            theme:
              theme,

            source:
              "Research AI Lab",

            mode:
              "autonomous_research"
          }

        })
        .select(
          "id,project_id,job_type,status,priority,payload,result,error_message,started_at,finished_at,created_at"
        )
        .single();


    if (error) {
      throw error;
    }


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
      "研究をキューに登録しました。\nブラウザを閉じてもGitHub Actions側で研究は継続します。",
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
      `研究開始失敗: ${error.message}`,
      "error"
    );

  }

}


/* =========================================================
   STOP RESEARCH
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
        );


    if (error) {
      throw error;
    }


    setStatus(
      "研究停止を要求しました。\n現在実行中のOpenRouter通信が終了した後、結果保存を行わずworkerが停止します。",
      "success"
    );


    await refreshActiveJob();

  } catch (error) {

    $("stopButton")
      .disabled = false;


    setStatus(
      `停止失敗: ${error.message}`,
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

  $("jobPanel")
    .classList.remove(
      "hidden"
    );


  $("jobId")
    .textContent =
    job.id;


  $("jobStatus")
    .textContent =
    String(
      job.status
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
  let text = "待機中";


  if (
    job.status ===
    "queued"
  ) {

    percent = 10;
    text =
      "GitHub Actions待機中";

  }


  if (
    job.status ===
    "running"
  ) {

    percent = 55;
    text =
      "AI研究実行中";

  }


  if (
    job.status ===
    "completed"
  ) {

    percent = 100;
    text =
      "研究完了";

  }


  if (
    job.status ===
    "failed"
  ) {

    percent = 100;
    text =
      "研究失敗";

  }


  if (
    job.status ===
    "cancelled"
  ) {

    percent = 100;
    text =
      "研究停止";

  }


  $("progressValue")
    .style.width =
    `${percent}%`;


  $("progressPercent")
    .textContent =
    `${percent}%`;


  $("progressText")
    .textContent =
    text;

}


/* =========================================================
   JOB POLLING
========================================================= */

async function refreshActiveJob() {

  if (!activeJobId) {
    return;
  }


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
          "id,project_id,job_type,status,priority,payload,result,error_message,started_at,finished_at,created_at"
        )
        .eq(
          "id",
          activeJobId
        )
        .maybeSingle();


    if (error) {
      throw error;
    }


    if (!data) {
      return;
    }


    renderJob(
      data
    );


    if (
      [
        "completed",
        "failed",
        "cancelled"
      ].includes(
        data.status
      )
    ) {

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

    }

  } catch (error) {

    console.error(
      "Job polling:",
      error
    );

  }

}


function startPolling() {

  stopPolling();

  refreshActiveJob();

  pollTimer =
    setInterval(
      refreshActiveJob,
      10000
    );

}


function stopPolling() {

  if (pollTimer) {

    clearInterval(
      pollTimer
    );

  }

  pollTimer =
    null;

}


/* =========================================================
   RECOVER BACKGROUND JOB
========================================================= */

async function recoverJob() {

  const saved =
    localStorage.getItem(
      "active_research_job"
    );


  if (!saved) {
    return;
  }


  activeJobId =
    saved;


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
   INITIALIZE
========================================================= */

function init() {

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


  $("researchButton")
    .addEventListener(
      "click",
      startResearch
    );


  $("stopButton")
    .addEventListener(
      "click",
      stopResearch
    );


  $("clearButton")
    .addEventListener(
      "click",
      () => {

        $("questionInput")
          .value = "";

        setStatus("");

      }
    );


  /*
   * 接続確認に失敗しても
   * UI全体を停止させない。
   */

  checkConnection();

  loadHistory();

  loadSaved();

  loadJobs();

  recoverJob();

}


document
  .addEventListener(
    "DOMContentLoaded",
    init
  );
