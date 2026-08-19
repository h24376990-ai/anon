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


let activeJobId =
  localStorage.getItem("active_research_job") || null;

let pollTimer = null;

let lastResults = [];


const $ = id =>
  document.getElementById(id);


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


function formatDate(value) {

  if (!value) return "—";

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


function parseJson(value) {

  if (!value) return {};

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

  if (!box) return;

  box.textContent =
    text || "";

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

}


/* =========================================
   CONNECTION
========================================= */

async function checkConnection() {

  try {

    const response =
      await Promise.race([

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


/* =========================================
   NAVIGATION
========================================= */

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
        button.dataset.page === page
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


/* =========================================
   HISTORY
========================================= */

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
        .from("research_results")
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


    if (lastResults.length) {

      renderDetail(
        lastResults[0]
      );

    } else {

      $("detail").innerHTML =
        `<div class="empty">
          まだ研究結果がありません。
        </div>`;

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


/* =========================================
   SAVED
========================================= */

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
        .from("research_results")
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
        ${esc(error.message)}
      </div>`;

  }

}


/* =========================================
   JOBS
========================================= */

async function loadJobs() {

  const box =
    $("jobsList");

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
        .from("research_jobs")
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
          job.status || "unknown";


        return `
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

            <span class="badge ${esc(status)}">
              ${esc(status)}
            </span>

          </div>
        `;

      }).join("");


  } catch (error) {

    box.innerHTML =
      `<div class="error">
        ジョブ取得失敗<br>
        ${esc(error.message)}
      </div>`;

  }

}


/* =========================================
   MEMORY
========================================= */

async function loadMemory() {

  const box =
    $("memoryList");


  try {

    const {
      count,
      error
    } =
      await sb
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
          画面上では最新100件だけを表示します。
        </p>

        <p>
          将来的には、過去研究から
          「なぜ失敗したか」
          「共通する失敗点」
          「成功しやすい研究ルート」
          を自動分析するメモリ層を追加できます。
        </p>

      </div>
    `;

  } catch (error) {

    box.innerHTML =
      `<div class="error">
        ${esc(error.message)}
      </div>`;

  }

}


/* =========================================
   ROUTES
========================================= */

async function loadRoutes() {

  $("routesList").innerHTML = `

    <div class="graph-placeholder">

      <div class="graph-node main">
        RESEARCH
      </div>

      <div class="graph-line"></div>

      <div class="graph-node">
        HYPOTHESIS
      </div>

      <div class="graph-line"></div>

      <div class="graph-node">
        VERIFICATION
      </div>

      <div class="graph-line"></div>

      <div class="graph-node">
        EVALUATION
      </div>

      <p>
        研究ルート可視化基盤
      </p>

    </div>

  `;

}


/* =========================================
   RESULTS
========================================= */

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

    `).join("");


  box
    .querySelectorAll(".result-row")
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


          if (result)
            renderDetail(result);

        }
      );

    });

}


/* =========================================
   DETAIL
========================================= */

function renderDetail(result) {

  const content =
    parseJson(result.content);


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

    </div>

  `;


  $("saveDetail")
    .addEventListener(
      "click",
      () => toggleSave(result)
    );

}


/* =========================================
   SAVE
========================================= */

async function toggleSave(result) {

  try {

    const newValue =
      !result.is_human_saved;


    const {
      error
    } =
      await sb
        .from("research_results")
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
      `保存変更失敗: ${error.message}`,
      "error"
    );

  }

}


/* =========================================
   START RESEARCH
========================================= */

async function startResearch() {

  const input =
    $("questionInput");


  const theme =
    input.value.trim();


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

          payload: {

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


    if (error)
      throw error;


    activeJobId =
      data.id;


    localStorage.setItem(
      "active_research_job",
      activeJobId
    );


    renderJob(data);


    setStatus(
      "研究をキューに登録しました。GitHub Actionsがバックグラウンドで処理します。",
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


/* =========================================
   STOP
========================================= */

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
        .from("research_jobs")
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
        .select("id,status");


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
      `停止失敗: ${error.message}`,
      "error"
    );

  }

}


/* =========================================
   JOB RENDER
========================================= */

function renderJob(job) {

  $("jobPanel")
    .classList.remove("hidden");


  $("jobId")
    .textContent =
    job.id || "—";


  $("jobStatus")
    .textContent =
    String(
      job.status || "unknown"
    ).toUpperCase();


  $("jobCreated")
    .textContent =
    formatDate(job.created_at);


  $("jobStarted")
    .textContent =
    formatDate(job.started_at);


  $("jobFinished")
    .textContent =
    formatDate(job.finished_at);


  let percent = 0;
  let text = "待機中";


  switch (job.status) {

    case "queued":

      percent = 10;
      text =
        "GitHub Actions待機中";

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


/* =========================================
   POLLING
========================================= */

async function refreshActiveJob() {

  if (!activeJobId)
    return;


  try {

    const {
      data,
      error
    } =
      await sb
        .from("research_jobs")
        .select(
          "id,project_id,job_type,status,priority,payload,result,error_message,started_at,finished_at,created_at"
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

      activeJobId = null;

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


    renderJob(data);


    const finished =
      [
        "completed",
        "failed",
        "cancelled"
      ].includes(
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

    pollTimer = null;

  }

}


/* =========================================
   MEMOS
========================================= */

async function loadMemos() {

  const box =
    $("memoList");


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
        .from("research_memos")
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
            data-id="${esc(memo.id)}"
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
        ${esc(error.message)}
      </div>`;

  }

}


async function saveMemo() {

  const title =
    $("memoTitle")
      .value
      .trim();

  const content =
    $("memoContent")
      .value
      .trim();


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
        .from("research_memos")
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
      `メモ保存失敗: ${error.message}`,
      "error"
    );

  }

}


async function deleteMemo(id) {

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
        .from("research_memos")
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
      `メモ削除失敗: ${error.message}`,
      "error"
    );

  }

}


/* =========================================
   RECOVER BACKGROUND JOB
========================================= */

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


/* =========================================
   INIT
========================================= */

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


  $("memoSaveButton")
    .addEventListener(
      "click",
      saveMemo
    );


  checkConnection();

  loadHistory();

  recoverJob();

}


document.addEventListener(
  "DOMContentLoaded",
  init
);
