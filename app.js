/* =========================================================
   Research AI Lab
   Enhanced app.js
   ========================================================= */

const SUPABASE_URL =
  "https://beadajbimgpephqszbfy.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_s5kiFZVJ9jXyOgS-j2pS-g_7Kj1IeC8";

const PROJECT_ID =
  "ab429192-27d2-47e4-9ad7-08b639f45120";


/* =========================================================
   SUPABASE
========================================================= */

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

let researchStarting = false;

let connectionOK = false;


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_VISIBLE_RESULTS = 100;

const POLL_INTERVAL = 5000;

const MAX_CONTEXT_RESULTS = 30;

const MAX_CONTEXT_MEMOS = 20;

const ROUTE_BLOCK_LIMIT = 3;


/* =========================================================
   DOM HELPER
========================================================= */

const $ = id =>
  document.getElementById(id);


/* =========================================================
   SAFE HTML
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
      text: String(value)
    };

  }

}


/* =========================================================
   RESULT SYMBOL
========================================================= */

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

  connectionOK = !!ok;

  const textElement =
    $("connectionText");

  const dotElement =
    $("connectionDot");

  if (textElement)
    textElement.textContent =
      text;

  if (dotElement)
    dotElement.className =
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


/* =========================================================
   FETCH RESEARCH CONTEXT
========================================================= */

/*
   AI研究時に、

   ・過去の研究
   ・AIメモ
   ・⭕️研究
   ・失敗研究

   を取得する。

   これによって同じ研究を何度も
   最初からやり直すことを防ぐ。
*/

async function buildResearchContext() {

  const context = {
    previousResults: [],
    savedResults: [],
    memos: [],
    blockedRoutes: []
  };


  /* -----------------------------------------
     過去研究
  ----------------------------------------- */

  try {

    const {
      data,
      error
    } =
      await sb
        .from("research_results")
        .select(
          "id,title,hypothesis,content,evaluation,confidence_level,status,created_at"
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
          MAX_CONTEXT_RESULTS
        );


    if (!error)
      context.previousResults =
        data || [];

  } catch (error) {

    console.warn(
      "Previous research context unavailable:",
      error
    );

  }


  /* -----------------------------------------
     ⭕️保存研究
  ----------------------------------------- */

  try {

    const {
      data,
      error
    } =
      await sb
        .from("research_results")
        .select(
          "id,title,hypothesis,content,evaluation,confidence_level,status,created_at"
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
        )
        .limit(
          MAX_CONTEXT_RESULTS
        );


    if (!error)
      context.savedResults =
        data || [];

  } catch (error) {

    console.warn(
      "Saved research context unavailable:",
      error
    );

  }


  /* -----------------------------------------
     AIメモ
  ----------------------------------------- */

  try {

    const {
      data,
      error
    } =
      await sb
        .from("research_memos")
        .select(
          "id,title,content,created_at"
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
          MAX_CONTEXT_MEMOS
        );


    if (!error)
      context.memos =
        data || [];

  } catch (error) {

    console.warn(
      "Memo context unavailable:",
      error
    );

  }


  /* -----------------------------------------
     ルート情報
  ----------------------------------------- */

  context.blockedRoutes =
    await getBlockedRoutes(
      context.previousResults
    );


  return context;

}


/* =========================================================
   ROUTE NORMALIZATION
========================================================= */

function normalizeRoute(route) {

  if (!route)
    return "";

  return String(route)
    .toLowerCase()
    .trim()
    .replace(
      /\s+/g,
      " "
    );

}


/* =========================================================
   GET BLOCKED ROUTES
========================================================= */

/*
   research_resultsに保存された
   research_routeを解析し、

   同じルートが3回以上登場した場合
   blockedRoutesへ登録する。

   ※既存DBを壊さないよう、
   新しいテーブルには依存しない。
*/

async function getBlockedRoutes(
  results = []
) {

  const routeCounts =
    new Map();


  for (
    const result of results
  ) {

    const content =
      parseJson(
        result.content
      );


    const route =
      normalizeRoute(
        content.research_route ||
        content.route ||
        content.approach ||
        ""
      );


    if (!route)
      continue;


    const current =
      routeCounts.get(route) || 0;

    routeCounts.set(
      route,
      current + 1
    );

  }


  return [...routeCounts.entries()]
    .filter(
      ([, count]) =>
        count >= ROUTE_BLOCK_LIMIT
    )
    .map(
      ([route, count]) => ({
        route,
        count,
        blocked: true
      })
    );

}


/* =========================================================
   RESEARCH CONTEXT TEXT
========================================================= */

function contextToPrompt(
  context
) {

  const previous =
    context.previousResults
      .map(
        result => {

          const content =
            parseJson(
              result.content
            );

          return `
[PREVIOUS RESEARCH]
title: ${result.title || ""}
evaluation: ${result.evaluation || "△"}
hypothesis: ${result.hypothesis || ""}
route: ${
            content.research_route ||
            content.approach ||
            ""
          }
critical_gap: ${
            content.critical_gap ||
            ""
          }
          `.trim();

        }
      )
      .join("\n\n");


  const saved =
    context.savedResults
      .map(
        result => {

          return `
[SAVED POSITIVE RESULT]
title: ${result.title || ""}
hypothesis: ${result.hypothesis || ""}
content: ${JSON.stringify(
            parseJson(result.content)
          )}
          `.trim();

        }
      )
      .join("\n\n");


  const memos =
    context.memos
      .map(
        memo => `
[RESEARCH MEMO]
${memo.title || "無題"}
${memo.content || ""}
        `.trim()
      )
      .join("\n\n");


  const blocked =
    context.blockedRoutes
      .map(
        route =>
          `[BLOCKED ROUTE ×${route.count}]\n${route.route}`
      )
      .join("\n");


  return `
==============================
RESEARCH MEMORY
==============================

${previous || "No previous research."}

${saved || "No saved positive research."}

${memos || "No research memos."}

==============================
BLOCKED ROUTES
==============================

${blocked || "No blocked routes."}

==============================
END MEMORY
==============================
`.trim();

}


/* =========================================================
   RESEARCH QUEUE
========================================================= */

async function enqueueResearch(
  theme,
  options = {}
) {

  const cleanTheme =
    String(theme || "")
      .trim();


  if (!cleanTheme)
    throw new Error(
      "研究テーマが空です。"
    );


  const {
    priority = 10,
    mode = "autonomous_research",
    parentResultId = null,
    reverification = false,
    proofMethod = null
  } = options;


  const payload = {

    theme:
      cleanTheme,

    source:
      "Research AI Lab",

    mode,

    reverification,

    parent_result_id:
      parentResultId,

    proof_method:
      proofMethod,

    created_from:
      "web"

  };


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
          reverification
            ? "reverification"
            : "research_cycle",

        status:
          "queued",

        priority,

        payload

      })
      .select(
        "id,project_id,job_type,status,priority,payload,result,error_message,started_at,finished_at,created_at"
      )
      .single();


  if (error)
    throw error;


  return data;

}


/* =========================================================
   START RESEARCH
========================================================= */

async function startResearch() {

  if (researchStarting) {

    setStatus(
      "研究登録処理中です。二重登録を防止しました。",
      "error"
    );

    return;

  }


  const input =
    $("questionInput");


  const theme =
    input?.value
      ?.trim() || "";


  if (!theme) {

    setStatus(
      "研究テーマを入力してください。",
      "error"
    );

    return;

  }


  researchStarting = true;


  if ($("researchButton"))
    $("researchButton")
      .disabled = true;

  if ($("stopButton"))
    $("stopButton")
      .disabled = false;


  setStatus(
    "研究メモ・過去研究を確認しています..."
  );


  try {

    /*
      ここでAIへ渡す研究コンテキストを
      先に構築する。

      ※実際のAI処理はGitHub Actions。
    */

    const context =
      await buildResearchContext();


    /*
      ブラウザから直接AIを呼ばない。

      Supabaseには研究ジョブと
      AI研究コンテキストだけを保存する。
    */

    const job =
      await enqueueResearch(
        theme,
        {
          priority: 10
        }
      );


    /*
      UIで参照できるように
      一時的にcontextをlocalStorageへ保存。

      APIキー等は絶対に保存しない。
    */

    try {

      localStorage.setItem(
        `research_context_${job.id}`,
        JSON.stringify({
          blockedRoutes:
            context.blockedRoutes,
          resultCount:
            context.previousResults.length,
          savedCount:
            context.savedResults.length,
          memoCount:
            context.memos.length,
          createdAt:
            new Date().toISOString()
        })
      );

    } catch {
      /* localStorage failure is non-fatal */
    }


    activeJobId =
      job.id;


    localStorage.setItem(
      "active_research_job",
      activeJobId
    );


    renderJob(job);


    setStatus(
      "研究をキューに登録しました。バックグラウンド研究を開始します。",
      "success"
    );


    startPolling();

    await loadJobs();

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
      `研究開始失敗: ${error.message}`,
      "error"
    );

  } finally {

    researchStarting = false;

  }

}


/* =========================================================
   REVERIFICATION
========================================================= */

/*
   ⭕️研究を別の証明戦略で再検証する。

   ブラウザから直接AIを呼ばず、
   GitHub Actionsのキューへ登録する。
*/

async function requestReverification(
  result,
  proofMethod = null
) {

  if (!result)
    return;


  const method =
    proofMethod ||
    "independent_verification";


  try {

    const job =
      await enqueueResearch(
        `
Reverify the following mathematical research result.

Title:
${result.title || ""}

Hypothesis:
${result.hypothesis || ""}

Result:
${JSON.stringify(
          parseJson(result.content),
          null,
          2
        )}

Verification method:
${method}

Do NOT assume the previous result is correct.
Independently check every logical step.
Search for counterexamples.
Identify hidden assumptions.
Determine whether the result actually follows.
        `.trim(),
        {
          priority: 20,
          reverification: true,
          parentResultId:
            result.id,
          proofMethod:
            method
        }
      );


    setStatus(
      `再検証ジョブを登録しました。方法: ${method}`,
      "success"
    );


    /*
      現在のジョブとして追跡。
    */

    activeJobId =
      job.id;


    localStorage.setItem(
      "active_research_job",
      activeJobId
    );


    renderJob(job);

    startPolling();

    await loadJobs();

  } catch (error) {

    console.error(
      "Reverification:",
      error
    );

    setStatus(
      `再検証登録失敗: ${error.message}`,
      "error"
    );

  }

}


/* =========================================================
   PROOF METHOD MENU
========================================================= */

function createReverificationActions(
  result
) {

  return `

    <div class="reverification-actions">

      <button
        class="button secondary proof-reverify"
        data-method="direct"
      >
        直接証明
      </button>

      <button
        class="button secondary proof-reverify"
        data-method="contradiction"
      >
        背理法
      </button>

      <button
        class="button secondary proof-reverify"
        data-method="contrapositive"
      >
        対偶
      </button>

      <button
        class="button secondary proof-reverify"
        data-method="induction"
      >
        数学的帰納法
      </button>

      <button
        class="button secondary proof-reverify"
        data-method="counterexample"
      >
        反例探索
      </button>

      <button
        class="button secondary proof-reverify"
        data-method="independent"
      >
        独立再検証
      </button>

    </div>

  `;

}


/* =========================================================
   HISTORY
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

    /*
      ⭕️は100件制限から除外。

      まず最新100件を取得。
      その後、⭕️を追加取得する。

      これにより重要な⭕️研究を
      画面から消さない。
    */

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
        .limit(
          MAX_VISIBLE_RESULTS
        );


    if (error)
      throw error;


    let rows =
      data || [];


    /*
      ⭕️を別取得。

      is_human_saved=trueの⭕️も
      必ず表示する。
    */

    const {
      data: positiveData,
      error:
        positiveError
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
          "evaluation",
          "⭕️"
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (!positiveError &&
        positiveData?.length) {

      const map =
        new Map();

      rows.forEach(
        row =>
          map.set(
            row.id,
            row
          )
      );

      positiveData.forEach(
        row =>
          map.set(
            row.id,
            row
          )
      );

      rows =
        [...map.values()]
          .sort(
            (a, b) =>
              new Date(
                b.created_at || 0
              ) -
              new Date(
                a.created_at || 0
              )
          );

    }


    lastResults =
      rows;


    const countElement =
      $("historyCount");


    if (countElement) {

      countElement.textContent =
        `${rows.length}件`;

    }


    renderResults(
      box,
      rows
    );


    if (rows.length) {

      renderDetail(
        rows[0]
      );

    } else {

      const detail =
        $("detail");

      if (detail) {

        detail.innerHTML =
          `<div class="empty">
            まだ研究結果がありません。
          </div>`;

      }

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
          job.payload?.theme ||
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

              <small>
                ${
                  job.job_type ===
                  "reverification"
                    ? "再検証"
                    : "通常研究"
                }
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

  if (!box)
    return;


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


    const context =
      await buildResearchContext();


    box.innerHTML = `

      <div class="memory-stat">

        <strong>
          ${count ?? 0}
        </strong>

        <span>
          AI側に保存されている研究結果
        </span>

      </div>


      <div class="memory-stat">

        <strong>
          ${context.memos.length}
        </strong>

        <span>
          AIが参照可能な研究メモ
        </span>

      </div>


      <div class="memory-stat">

        <strong>
          ${context.blockedRoutes.length}
        </strong>

        <span>
          遮断された研究ルート
        </span>

      </div>


      <div class="info-card">

        <h3>
          AI研究メモリ
        </h3>

        <p>
          過去研究、研究メモ、⭕️研究、
          失敗ルートを次の研究の文脈として利用します。
        </p>

        <p>
          同じ研究ルートが
          ${ROUTE_BLOCK_LIMIT}回以上繰り返された場合、
          そのルートを遮断対象として扱います。
        </p>

        <p>
          ⭕️研究は単純に正しいと固定せず、
          別の証明方法・反例探索・論理検査による
          再検証対象にできます。
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


/* =========================================================
   ROUTES
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
        .from("research_results")
        .select(
          "id,title,evaluation,content,created_at"
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
        .limit(500);


    if (error)
      throw error;


    const routes =
      new Map();


    (data || []).forEach(
      result => {

        const content =
          parseJson(
            result.content
          );


        const route =
          normalizeRoute(
            content.research_route ||
            content.route ||
            content.approach
          );


        if (!route)
          return;


        const current =
          routes.get(route) || {
            count: 0,
            evaluations: [],
            latest: result.created_at
          };


        current.count++;

        current.evaluations
          .push(
            result.evaluation
          );


        routes.set(
          route,
          current
        );

      }
    );


    const routeArray =
      [...routes.entries()]
        .sort(
          (a, b) =>
            b[1].count -
            a[1].count
        );


    if (!routeArray.length) {

      box.innerHTML = `

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
            研究ルート情報を待っています。
          </p>

        </div>

      `;

      return;

    }


    box.innerHTML = `

      <div class="route-list">

        ${routeArray
          .map(
            ([route, info]) => {

              const blocked =
                info.count >=
                ROUTE_BLOCK_LIMIT;


              return `

                <article class="route-card">

                  <div>

                    <strong>
                      ${blocked
                        ? "🚫"
                        : "→"}
                    </strong>

                    <span>
                      ${esc(route)}
                    </span>

                  </div>

                  <div>

                    <span>
                      ${info.count}回
                    </span>

                    <span>
                      ${
                        blocked
                          ? "遮断"
                          : "使用可能"
                      }
                    </span>

                  </div>

                </article>

              `;

            }
          )
          .join("")}

      </div>

    `;

  } catch (error) {

    box.innerHTML =
      `<div class="error">
        ルート取得失敗<br>
        ${esc(error.message)}
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

  if (!box)
    return;


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


          if (result)
            renderDetail(
              result
            );

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

  selectedResult =
    result;


  const content =
    parseJson(
      result.content
    );


  const model =
    content.model ||
    content.math_model ||
    content.visualization ||
    null;


  const isPositive =
    result.evaluation === "⭕️" ||
    result.evaluation === "⭕";


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


    ${
      model
        ? `

          <section>

            <label>
              数学モデル
            </label>

            <pre>${esc(
              JSON.stringify(
                model,
                null,
                2
              )
            )}</pre>

          </section>

        `
        : ""
    }


    ${
      isPositive
        ? `

          <section>

            <label>
              ⭕️ 再検証
            </label>

            <p>
              この結果を独立に再検証できます。
              前回の結果を正しいと仮定せず、
              別の証明方法・反例探索などから確認します。
            </p>

            ${createReverificationActions(
              result
            )}

          </section>

        `
        : ""
    }


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


  const saveButton =
    $("saveDetail");


  if (saveButton) {

    saveButton.addEventListener(
      "click",
      () =>
        toggleSave(result)
    );

  }


  document
    .querySelectorAll(
      ".proof-reverify"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          requestReverification(
            result,
            button.dataset.method
          )
      );

    });

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
      `保存変更失敗: ${error.message}`,
      "error"
    );

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
      `停止失敗: ${error.message}`,
      "error"
    );

  }

}


/* =========================================================
   JOB RENDER
========================================================= */

function renderJob(job) {

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
        "バックグラウンド待機中";

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

      activeJobId =
        null;

      localStorage.removeItem(
        "active_research_job"
      );

      stopPolling();

      if ($("researchButton"))
        $("researchButton")
          .disabled = false;

      if ($("stopButton"))
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
      data.map(
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
      ).join("");


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
        ${esc(error.message)}
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
      ?.trim() || "";


  const content =
    $("memoContent")
      ?.value
      ?.trim() || "";


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


    if ($("memoTitle"))
      $("memoTitle")
        .value = "";

    if ($("memoContent"))
      $("memoContent")
        .value = "";


    setStatus(
      "AI研究メモを保存しました。",
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


/* =========================================================
   BACKGROUND JOB RECOVERY
========================================================= */

async function recoverJob() {

  if (!activeJobId)
    return;


  await refreshActiveJob();


  if (activeJobId) {

    if ($("researchButton"))
      $("researchButton")
        .disabled = true;

    if ($("stopButton"))
      $("stopButton")
        .disabled = false;

    startPolling();

  }

}


/* =========================================================
   PAGE VISIBILITY
========================================================= */

/*
   タブに戻ってきたとき、
   すぐジョブ状態を更新する。
*/

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      !document.hidden &&
      activeJobId
    ) {

      refreshActiveJob();

    }

  }
);


/* =========================================================
   ONLINE / OFFLINE
========================================================= */

window.addEventListener(
  "online",
  () => {

    checkConnection();

    if (activeJobId)
      refreshActiveJob();

  }
);


window.addEventListener(
  "offline",
  () => {

    setConnection(
      false,
      "OFFLINE"
    );

  }
);


/* =========================================================
   INIT
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


  const researchButton =
    $("researchButton");


  if (researchButton) {

    researchButton.addEventListener(
      "click",
      startResearch
    );

  }


  const stopButton =
    $("stopButton");


  if (stopButton) {

    stopButton.addEventListener(
      "click",
      stopResearch
    );

  }


  const clearButton =
    $("clearButton");


  if (clearButton) {

    clearButton.addEventListener(
      "click",
      () => {

        if ($("questionInput"))
          $("questionInput")
            .value = "";

        setStatus("");

      }
    );

  }


  const memoSaveButton =
    $("memoSaveButton");


  if (memoSaveButton) {

    memoSaveButton.addEventListener(
      "click",
      saveMemo
    );

  }


  /*
    初期状態
  */

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
