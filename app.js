/* =========================================================
   Research AI Lab
   app.js - Enhanced Version
   =========================================================

   基本構成

   Browser
      ↓
   Supabase
      ↓
   research_jobs
      ↓
   GitHub Actions Worker
      ↓
   OpenRouter
      ↓
   research_results

   ※ Edge Functionは使用しない
   ========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const SUPABASE_URL =
  "https://beadajbimgpephqszbfy.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_s5kiFZVJ9jXyOgS-j2pS-g_7Kj1IeC8";

const PROJECT_ID =
  "ab429192-27d2-47e4-9ad7-08b639f45120";


const MAX_VISIBLE_RESULTS = 100;

const POLL_INTERVAL = 5000;

const ACTIVE_JOB_STORAGE =
  "active_research_job";

const ACTIVE_JOBS_STORAGE =
  "active_research_jobs";


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
    ACTIVE_JOB_STORAGE
  ) || null;


let activeJobIds =
  loadActiveJobIds();


let pollTimer = null;

let lastResults = [];

let currentResult = null;


/* =========================================================
   UTILITIES
========================================================= */

function $(id) {
  return document.getElementById(id);
}


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


function resultSymbol(result) {

  const evaluation =
    String(
      result?.evaluation || ""
    );


  if (
    evaluation === "⭕️" ||
    evaluation === "⭕"
  ) {
    return "⭕";
  }


  if (
    evaluation === "❌"
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


  if (!box)
    return;


  box.textContent =
    text || "";


  box.className =
    `status ${type}`;

}


function setConnection(
  ok,
  text
) {

  const textElement =
    $("connectionText");


  const dot =
    $("connectionDot");


  if (textElement)
    textElement.textContent =
      text;


  if (dot) {

    dot.className =
      `dot ${ok ? "ok" : "bad"}`;

  }

}


/* =========================================================
   ACTIVE JOB STORAGE
========================================================= */

function loadActiveJobIds() {

  try {

    const raw =
      localStorage.getItem(
        ACTIVE_JOBS_STORAGE
      );


    if (!raw)
      return [];


    const ids =
      JSON.parse(raw);


    if (!Array.isArray(ids))
      return [];


    return ids.filter(Boolean);

  } catch {

    return [];

  }

}


function saveActiveJobIds() {

  try {

    localStorage.setItem(
      ACTIVE_JOBS_STORAGE,
      JSON.stringify(
        activeJobIds
      )
    );

  } catch {

    // localStorage failure should
    // never break research UI

  }

}


function addActiveJob(id) {

  if (!id)
    return;


  if (
    !activeJobIds.includes(id)
  ) {

    activeJobIds.push(id);

  }


  activeJobId = id;


  try {

    localStorage.setItem(
      ACTIVE_JOB_STORAGE,
      id
    );

  } catch {}


  saveActiveJobIds();

}


function removeActiveJob(id) {

  activeJobIds =
    activeJobIds.filter(
      x => x !== id
    );


  if (
    activeJobId === id
  ) {

    activeJobId =
      activeJobIds[0] || null;


    try {

      if (activeJobId) {

        localStorage.setItem(
          ACTIVE_JOB_STORAGE,
          activeJobId
        );

      } else {

        localStorage.removeItem(
          ACTIVE_JOB_STORAGE
        );

      }

    } catch {}

  }


  saveActiveJobIds();

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
   RESULT QUERY
========================================================= */

const RESULT_COLUMNS =
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
  ].join(",");


/* =========================================================
   HISTORY
=========================================================

   通常結果:
     最新100件

   ⭕:
     100件制限とは別に保持

   これにより、
   「画面に最大100件」
   と
   「⭕は消えない」
   を両立する。
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

    const [

      normalResponse,

      savedResponse

    ] = await Promise.all([

      sb
        .from("research_results")
        .select(RESULT_COLUMNS)
        .eq(
          "project_id",
          PROJECT_ID
        )
        .neq(
          "evaluation",
          "⭕"
        )
        .neq(
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
          MAX_VISIBLE_RESULTS
        ),


      sb
        .from("research_results")
        .select(RESULT_COLUMNS)
        .eq(
          "project_id",
          PROJECT_ID
        )
        .in(
          "evaluation",
          [
            "⭕",
            "⭕️"
          ]
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )

    ]);


    if (normalResponse.error)
      throw normalResponse.error;


    if (savedResponse.error)
      throw savedResponse.error;


    const normal =
      normalResponse.data || [];


    const positive =
      savedResponse.data || [];


    /*
      ⭕は常に表示対象。

      通常結果は最新100件。

      ⭕は100件制限の外側に置く。
    */

    const merged = [
      ...positive,
      ...normal
    ];


    const unique =
      Array.from(
        new Map(
          merged.map(
            item => [
              item.id,
              item
            ]
          )
        ).values()
      );


    unique.sort(
      (a, b) =>
        new Date(
          b.created_at || 0
        ) -
        new Date(
          a.created_at || 0
        )
    );


    lastResults =
      unique;


    const count =
      $("historyCount");


    if (count) {

      count.textContent =
        `${unique.length}件`;

    }


    renderResults(
      box,
      unique
    );


    if (unique.length) {

      renderDetail(
        unique[0]
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
          RESULT_COLUMNS
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
      data.map(
        job => {

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
                  ID:
                  ${esc(job.id)}
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

    const [
      resultsCount,
      positiveCount,
      memoCount
    ] = await Promise.all([

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
        .in(
          "evaluation",
          [
            "⭕",
            "⭕️"
          ]
        ),


      sb
        .from("research_memos")
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

    ]);


    if (resultsCount.error)
      throw resultsCount.error;


    const total =
      resultsCount.count || 0;


    const positive =
      positiveCount.count || 0;


    const memos =
      memoCount.count || 0;


    box.innerHTML = `

      <div class="memory-stat">

        <strong>
          ${total}
        </strong>

        <span>
          AI側に保存されている研究結果
        </span>

      </div>


      <div class="memory-stat">

        <strong>
          ${positive}
        </strong>

        <span>
          ⭕ 再検証対象
        </span>

      </div>


      <div class="memory-stat">

        <strong>
          ${memos}
        </strong>

        <span>
          研究メモ
        </span>

      </div>


      <div class="info-card">

        <h3>
          AI研究メモリ
        </h3>

        <p>
          過去研究を単なる履歴としてではなく、
          次の研究で参照できる知識として扱うための領域です。
        </p>

        <p>
          ⭕の研究は通常の100件表示制限とは別に保持し、
          再検証候補として扱える構造になっています。
        </p>

        <p>
          今後のWorker側では、
          既知結果、
          失敗したルート、
          反例、
          論理的な穴、
          成功した証明戦略
          を研究前に参照させます。
        </p>

      </div>

    `;

  } catch (error) {

    box.innerHTML =
      `<div class="error">
        AIメモリ取得失敗<br>
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


  box.innerHTML = `

    <div class="graph-placeholder">

      <div class="graph-node main">
        RESEARCH
      </div>

      <div class="graph-line"></div>

      <div class="graph-node">
        NOVELTY CHECK
      </div>

      <div class="graph-line"></div>

      <div class="graph-node">
        HYPOTHESIS
      </div>

      <div class="graph-line"></div>

      <div class="graph-node">
        COUNTEREXAMPLE
      </div>

      <div class="graph-line"></div>

      <div class="graph-node">
        PROOF
      </div>

      <div class="graph-line"></div>

      <div class="graph-node">
        EVALUATION
      </div>

      <p>
        研究探索ルート基盤
      </p>

      <small>
        ※実際のルート遮断処理はWorker側で行います。
      </small>

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

  if (!rows?.length) {

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
    ).join("");


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
                String(item.id) ===
                String(
                  element.dataset.id
                )
            );


          if (result) {

            currentResult =
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

function renderDetail(result) {

  if (!result)
    return;


  const content =
    parseJson(
      result.content
    );


  const verification =
    content.verification ||
    {};


  const novelty =
    content.novelty_check ||
    {};


  const model =
    content.math_model ||
    null;


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


    ${
      novelty &&
      Object.keys(novelty).length
        ? `

          <section>

            <label>
              新規性チェック
            </label>

            <pre>${esc(
              JSON.stringify(
                novelty,
                null,
                2
              )
            )}</pre>

          </section>

        `
        : ""
    }


    ${
      verification &&
      Object.keys(
        verification
      ).length
        ? `

          <section>

            <label>
              検証戦略
            </label>

            <pre>${esc(
              JSON.stringify(
                verification,
                null,
                2
              )
            )}</pre>

          </section>

        `
        : ""
    }


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


      ${
        resultSymbol(result) === "⭕"
          ? `

            <button
              id="reverifyDetail"
              class="button secondary"
            >
              ⟳ 再検証
            </button>

          `
          : ""
      }

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


  const reverifyButton =
    $("reverifyDetail");


  if (reverifyButton) {

    reverifyButton.addEventListener(
      "click",
      () =>
        reverifyResult(result)
    );

  }

}


/* =========================================================
   SAVE RESULT
========================================================= */

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
   REVERIFY POSITIVE RESULT
=========================================================

   ⭕をもう一度研究キューへ送る。

   Worker側で、

   ・背理法
   ・対偶
   ・数学的帰納法
   ・反例探索
   ・既知結果比較
   ・別証明
   ・境界条件確認

   を行わせるための再検証ジョブ。
========================================================= */

async function reverifyResult(
  result
) {

  if (!result)
    return;


  try {

    const content =
      parseJson(
        result.content
      );


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
            "reverification",

          status:
            "queued",

          priority:
            100,

          payload: {

            theme:
              result.hypothesis ||
              result.title,

            source:
              "positive_result_reverification",

            source_result_id:
              result.id,

            mode:
              "independent_verification",

            verification_methods: [

              "contradiction",

              "contrapositive",

              "mathematical_induction",

              "counterexample_search",

              "boundary_case_check",

              "independent_derivation"

            ],

            previous_result:
              content

          }

        })
        .select()
        .single();


    if (error)
      throw error;


    addActiveJob(
      data.id
    );


    setStatus(
      "⭕研究を再検証キューへ登録しました。",
      "success"
    );


    renderJob(data);


    startPolling();


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
   START RESEARCH
========================================================= */

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
              "autonomous_research",

            /*
              Workerに渡す研究原則
            */

            research_rules: {

              avoid_known_mathematics: true,

              novelty_check: true,

              literature_verification: true,

              counterexample_search: true,

              contradiction_check: true,

              contrapositive_check: true,

              induction_check: true,

              boundary_case_check: true,

              independent_derivation: true,

              avoid_unjustified_leaps: true,

              no_fake_citations: true,

              no_unproven_claims: true,

              route_repetition_limit: 3

            },

            /*
              数学モデル探索
            */

            model_exploration: {

              enabled: true,

              transformation: true,

              visualization_data: true,

              physical_analogy: true,

              parameter_exploration: true

            }

          }

        })
        .select(
          "id,project_id,job_type,status,priority,payload,result,error_message,started_at,finished_at,created_at"
        )
        .single();


    if (error)
      throw error;


    addActiveJob(
      data.id
    );


    renderJob(data);


    setStatus(
      "研究をキューに登録しました。バックグラウンド処理を待機しています。",
      "success"
    );


    /*
      入力欄を空にすることで
      次の研究をすぐ投入できる。
    */

    input.value = "";


    startPolling();


    /*
      ジョブ一覧も更新
    */

    loadJobs();


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


  const jobId =
    activeJobId;


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
          jobId
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


    removeActiveJob(
      jobId
    );


    await refreshActiveJobs();


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

function renderJob(job) {

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


  if ($("progressValue")) {

    $("progressValue")
      .style.width =
      `${percent}%`;

  }


  if ($("progressPercent")) {

    $("progressPercent")
      .textContent =
      `${percent}%`;

  }


  if ($("progressText")) {

    $("progressText")
      .textContent =
      text;

  }

}


/* =========================================================
   REFRESH SINGLE JOB
========================================================= */

async function refreshJob(
  jobId
) {

  if (!jobId)
    return null;


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
          jobId
        )
        .eq(
          "project_id",
          PROJECT_ID
        )
        .maybeSingle();


    if (error)
      throw error;


    if (!data) {

      removeActiveJob(
        jobId
      );

      return null;

    }


    if (
      jobId === activeJobId
    ) {

      renderJob(data);

    }


    const finished =
      [
        "completed",
        "failed",
        "cancelled"
      ].includes(
        data.status
      );


    if (finished) {

      removeActiveJob(
        jobId
      );


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

    }


    return data;

  } catch (error) {

    console.error(
      "Job refresh:",
      error
    );


    return null;

  }

}


/* =========================================================
   REFRESH ALL ACTIVE JOBS
========================================================= */

async function refreshActiveJobs() {

  if (!activeJobIds.length) {

    if ($("researchButton"))
      $("researchButton")
        .disabled = false;


    if ($("stopButton"))
      $("stopButton")
        .disabled = true;


    return;

  }


  const ids =
    [...activeJobIds];


  for (
    const id of ids
  ) {

    await refreshJob(id);

  }


  /*
    現在選択されているジョブ
    を維持する
  */

  if (
    activeJobIds.length
  ) {

    activeJobId =
      activeJobIds[
        activeJobIds.length - 1
      ];

  } else {

    activeJobId =
      null;

  }


  if ($("researchButton")) {

    /*
      新しい研究は
      前の研究が動いていても投入可能
    */

    $("researchButton")
      .disabled = false;

  }


  if ($("stopButton")) {

    $("stopButton")
      .disabled =
      !activeJobIds.length;

  }

}


/* =========================================================
   POLLING
========================================================= */

function startPolling() {

  stopPolling();


  refreshActiveJobs();


  pollTimer =
    setInterval(
      refreshActiveJobs,
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
   RECOVER BACKGROUND JOBS
========================================================= */

async function recoverJob() {

  /*
    古い単一JOB保存にも対応
  */

  if (
    activeJobId &&
    !activeJobIds.includes(
      activeJobId
    )
  ) {

    activeJobIds.push(
      activeJobId
    );

  }


  saveActiveJobIds();


  if (!activeJobIds.length) {

    return;

  }


  await refreshActiveJobs();


  if (activeJobIds.length) {

    if ($("researchButton"))
      $("researchButton")
        .disabled = false;


    if ($("stopButton"))
      $("stopButton")
        .disabled = false;


    startPolling();

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
              data-id="${esc(memo.id)}"
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


/* =========================================================
   SAVE MEMO
========================================================= */

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


/* =========================================================
   DELETE MEMO
========================================================= */

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


/* =========================================================
   INIT
========================================================= */

function init() {

  /*
    Navigation
  */

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


  /*
    Research
  */

  const researchButton =
    $("researchButton");


  if (researchButton) {

    researchButton
      .addEventListener(
        "click",
        startResearch
      );

  }


  /*
    Stop
  */

  const stopButton =
    $("stopButton");


  if (stopButton) {

    stopButton
      .addEventListener(
        "click",
        stopResearch
      );

  }


  /*
    Clear
  */

  const clearButton =
    $("clearButton");


  if (clearButton) {

    clearButton
      .addEventListener(
        "click",
        () => {

          $("questionInput")
            .value = "";


          setStatus("");

        }
      );

  }


  /*
    Memo
  */

  const memoButton =
    $("memoSaveButton");


  if (memoButton) {

    memoButton
      .addEventListener(
        "click",
        saveMemo
      );

  }


  /*
    Enterでは送信しない。
    Ctrl + Enter / Cmd + Enter
    で研究開始。
  */

  const question =
    $("questionInput");


  if (question) {

    question.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Enter" &&
          (event.ctrlKey ||
           event.metaKey)
        ) {

          event.preventDefault();

          startResearch();

        }

      }
    );

  }


  /*
    初期処理
  */

  checkConnection();

  loadHistory();

  recoverJob();

}


/* =========================================================
   DOM READY
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
