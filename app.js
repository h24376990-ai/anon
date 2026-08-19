/* =========================================================
   Research AI Lab
   app.js - Integrated Enhanced Version

   Architecture:
   Browser
      ↓
   Supabase research_jobs
      ↓
   GitHub Actions
      ↓
   OpenRouter
      ↓
   Supabase research_results

   IMPORTANT
   - No Edge Function is used.
   - Browser only uses Supabase publishable key.
   - Service Role Key must NEVER be placed here.
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

const MAX_CONTEXT_RESULTS = 12;

const MAX_CONTEXT_MEMOS = 10;

const MAX_ROUTE_REPETITIONS = 3;


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
   GLOBAL STATE
========================================================= */

let activeJobId =
  localStorage.getItem(
    "active_research_job"
  ) || null;

let pollTimer = null;

let lastResults = [];

let currentResult = null;

let initialized = false;


/* =========================================================
   DOM HELPER
========================================================= */

const $ = id =>
  document.getElementById(id);


/* =========================================================
   ESCAPE HTML
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


/* =========================================================
   JSON
========================================================= */

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
   STATUS UI
========================================================= */

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


/* =========================================================
   CONNECTION UI
========================================================= */

function setConnection(
  ok,
  text
) {

  const textBox =
    $("connectionText");

  const dot =
    $("connectionDot");

  if (textBox)
    textBox.textContent =
      text;

  if (dot)
    dot.className =
      `dot ${ok ? "ok" : "bad"}`;

}


/* =========================================================
   SAFE ARRAY
========================================================= */

function asArray(value) {

  if (Array.isArray(value))
    return value;

  if (value === null || value === undefined)
    return [];

  return [String(value)];

}


/* =========================================================
   NORMALIZE RESULT CONTENT
========================================================= */

function normalizeResultContent(result) {

  const content =
    parseJson(result?.content);

  return {
    research_question:
      content.research_question ?? "",

    known_facts:
      asArray(content.known_facts),

    assumptions:
      asArray(content.assumptions),

    approach:
      asArray(content.approach),

    proof_strategy:
      asArray(content.proof_strategy),

    counterexample_strategy:
      asArray(content.counterexample_strategy),

    cross_domain_connection:
      asArray(content.cross_domain_connection),

    critical_gap:
      content.critical_gap ?? "",

    next_steps:
      asArray(content.next_steps),

    research_route:
      content.research_route ?? null,

    route_key:
      content.route_key ?? null,

    verification_methods:
      asArray(
        content.verification_methods
      ),

    novelty_checks:
      asArray(
        content.novelty_checks
      ),

    source_job_id:
      content.source_job_id ?? null
  };

}


/* =========================================================
   CONNECTION
========================================================= */

async function checkConnection() {

  try {

    const timeout =
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
      );


    const request =
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
        );


    const response =
      await Promise.race([
        request,
        timeout
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
   LOAD HISTORY
========================================================= */

async function loadHistory() {

  const box =
    $("historyList");

  if (!box) return;


  box.innerHTML =
    `<div class="empty">
      履歴を読み込んでいます...
    </div>`;


  try {

    /*
      ⭕️ is_human_saved = true のものは
      「100件制限で消える」ことを防ぐため
      別取得する。

      通常履歴:
        最新100件

      保存済み:
        全件
    */


    const [
      normalResponse,
      savedResponse
    ] = await Promise.all([

      sb
        .from("research_results")
        .select(
          "id,project_id,title,hypothesis,content,status,evaluation,confidence_level,is_human_saved,created_at,updated_at"
        )
        .eq(
          "project_id",
          PROJECT_ID
        )
        .or(
          "is_human_saved.is.false,is_human_saved.is.null"
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
        )

    ]);


    if (normalResponse.error)
      throw normalResponse.error;

    if (savedResponse.error)
      throw savedResponse.error;


    const normalRows =
      normalResponse.data || [];

    const savedRows =
      savedResponse.data || [];


    /*
      重複を除去
    */

    const map =
      new Map();


    [
      ...savedRows,
      ...normalRows
    ].forEach(row => {

      map.set(
        row.id,
        row
      );

    });


    lastResults =
      Array.from(
        map.values()
      ).sort(
        (a, b) =>
          new Date(
            b.created_at || 0
          ) -
          new Date(
            a.created_at || 0
          )
      );


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


/* =========================================================
   SAVED
========================================================= */

async function loadSaved() {

  const box =
    $("savedList");

  if (!box) return;


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

  if (!box) return;


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

        const theme =
          job.payload?.theme ||
          job.job_type ||
          "Research";


        const verification =
          job.payload?.verification_mode
            ? "再検証"
            : "通常研究";


        return `
          <div class="job-row">

            <div>

              <b>
                ${esc(theme)}
              </b>

              <small>
                ${esc(verification)}
                ・
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


/* =========================================================
   MEMORY
========================================================= */

async function loadMemory() {

  const box =
    $("memoryList");

  if (!box) return;


  try {

    const [
      resultCount,
      savedCount,
      memoCount
    ] =
      await Promise.all([

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
          .eq(
            "is_human_saved",
            true
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


    if (resultCount.error)
      throw resultCount.error;

    if (savedCount.error)
      throw savedCount.error;

    if (memoCount.error)
      throw memoCount.error;


    box.innerHTML = `

      <div class="memory-stat">

        <strong>
          ${resultCount.count ?? 0}
        </strong>

        <span>
          AI側に保存されている研究結果
        </span>

      </div>

      <div class="memory-stat">

        <strong>
          ${savedCount.count ?? 0}
        </strong>

        <span>
          ⭕️ / 人間保存済み研究
        </span>

      </div>

      <div class="memory-stat">

        <strong>
          ${memoCount.count ?? 0}
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
          研究結果・保存研究・研究メモを
          次の研究へ渡せる構造になっています。
        </p>

        <p>
          重要なのは「過去の回答をそのまま真似する」
          のではなく、過去研究の失敗点・未検証点・
          使用済みルートを次の研究の制約として利用することです。
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

  if (!box) return;


  try {

    /*
      現在のDB構成では専用graph tableを要求しない。
      research_results.content の route_key / research_route
      を解析してルートを表示する。
    */

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


    const routeMap =
      new Map();


    (data || [])
      .forEach(result => {

        const content =
          normalizeResultContent(
            result
          );


        const key =
          content.route_key ||
          content.research_route ||
          "unknown";


        if (!routeMap.has(key)) {

          routeMap.set(
            key,
            {
              count: 0,
              evaluations: []
            }
          );

        }


        const item =
          routeMap.get(key);


        item.count++;

        item.evaluations.push(
          result.evaluation
        );

      });


    if (!routeMap.size) {

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
            まだ研究ルートデータがありません。
          </p>

        </div>

      `;

      return;

    }


    box.innerHTML = `

      <div class="info-card">

        <h3>
          探索ルート監視
        </h3>

        <p>
          同一ルートを3回以上繰り返さない
          ための監視情報です。
        </p>

      </div>

      ${Array.from(
        routeMap.entries()
      ).map(([route, info]) => {

        const blocked =
          info.count >=
          MAX_ROUTE_REPETITIONS;


        return `

          <div class="job-row">

            <div>

              <b>
                ${esc(route)}
              </b>

              <small>
                使用回数:
                ${info.count}
              </small>

            </div>

            <span
              class="badge ${
                blocked
                  ? "failed"
                  : "running"
              }"
            >
              ${
                blocked
                  ? "BLOCKED"
                  : "AVAILABLE"
              }
            </span>

          </div>

        `;

      }).join("")}

    `;

  } catch (error) {

    console.error(
      "Routes:",
      error
    );

    box.innerHTML =
      `<div class="error">
        ルート取得失敗<br>
        ${esc(error.message)}
      </div>`;

  }

}


/* =========================================================
   RESULTS LIST
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

            ${
              result.is_human_saved
                ? " ・ 永久保存"
                : ""
            }

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

  const content =
    normalizeResultContent(
      result
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
        研究質問
      </label>

      <p>
        ${esc(
          content.research_question ||
          "—"
        )}
      </p>

    </section>


    <section>

      <label>
        既知事実
      </label>

      <ul>
        ${
          content.known_facts.length
            ? content.known_facts
                .map(
                  x =>
                    `<li>${esc(x)}</li>`
                )
                .join("")
            : "<li>—</li>"
        }
      </ul>

    </section>


    <section>

      <label>
        証明戦略
      </label>

      <ul>
        ${
          content.proof_strategy.length
            ? content.proof_strategy
                .map(
                  x =>
                    `<li>${esc(x)}</li>`
                )
                .join("")
            : "<li>—</li>"
        }
      </ul>

    </section>


    <section>

      <label>
        反例探索
      </label>

      <ul>
        ${
          content.counterexample_strategy.length
            ? content.counterexample_strategy
                .map(
                  x =>
                    `<li>${esc(x)}</li>`
                )
                .join("")
            : "<li>—</li>"
        }
      </ul>

    </section>


    <section>

      <label>
        最大の論理的ギャップ
      </label>

      <p>
        ${esc(
          content.critical_gap ||
          "—"
        )}
      </p>

    </section>


    <section>

      <label>
        次の研究手順
      </label>

      <ol>
        ${
          content.next_steps.length
            ? content.next_steps
                .map(
                  x =>
                    `<li>${esc(x)}</li>`
                )
                .join("")
            : "<li>—</li>"
        }
      </ol>

    </section>


    <section>

      <label>
        研究ルート
      </label>

      <p>
        ${esc(
          content.route_key ||
          content.research_route ||
          "—"
        )}
      </p>

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
        🔬 再検証
      </button>

    </div>

  `;


  $("saveDetail")
    .addEventListener(
      "click",
      () =>
        toggleSave(result)
    );


  $("reverifyDetail")
    .addEventListener(
      "click",
      () =>
        reverifyResult(result)
    );

}


/* =========================================================
   SAVE
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


    setStatus(
      newValue
        ? "研究結果を永久保存しました。"
        : "保存を解除しました。",
      "success"
    );


    await loadHistory();

    await loadSaved();

  } catch (error) {

    console.error(
      "Save:",
      error
    );

    setStatus(
      `保存変更失敗: ${error.message}`,
      "error"
    );

  }

}


/* =========================================================
   GET RESEARCH MEMORY
========================================================= */

async function getResearchMemory(theme) {

  const [
    resultsResponse,
    memosResponse
  ] = await Promise.all([

    sb
      .from("research_results")
      .select(
        "id,title,hypothesis,content,evaluation,confidence_level,created_at"
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
      ),

    sb
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
      )

  ]);


  if (resultsResponse.error)
    throw resultsResponse.error;

  if (memosResponse.error)
    throw memosResponse.error;


  const results =
    resultsResponse.data || [];

  const memos =
    memosResponse.data || [];


  /*
    AIに渡すメモリ。

    重要:
    「過去回答をそのまま真似する」
    のではなく、

    - 既知
    - 失敗
    - 未検証
    - 使用済みルート
    - 有望
    - 次に避けるべき方向

    を分離する。
  */

  const researchMemory =
    results.map(result => {

      const content =
        normalizeResultContent(
          result
        );


      return {

        id:
          result.id,

        title:
          result.title,

        hypothesis:
          result.hypothesis,

        evaluation:
          result.evaluation,

        confidence_level:
          result.confidence_level,

        route:
          content.route_key ||
          content.research_route,

        critical_gap:
          content.critical_gap,

        next_steps:
          content.next_steps,

        novelty_checks:
          content.novelty_checks,

        verification_methods:
          content.verification_methods

      };

    });


  return {

    theme,

    previous_research:
      researchMemory,

    human_memos:
      memos.map(memo => ({
        title:
          memo.title,

        content:
          memo.content
      }))

  };

}


/* =========================================================
   BUILD RESEARCH CONSTRAINTS
========================================================= */

function buildResearchConstraints(
  memory
) {

  return {

    anti_repetition: [

      "既知の定理や教科書的証明を単純に再説明しない",

      "過去研究と同じ仮説・同じ証明戦略をそのまま繰り返さない",

      "過去に失敗したルートを無批判に再利用しない",

      "既知結果を新発見として扱わない",

      "数値実験だけで証明済みと判断しない",

      "有限範囲の検証を無限範囲の証明へ飛躍させない"

    ],


    novelty_checks: [

      "研究開始前に問題が既知の結果と重複していないか確認する",

      "既知数学として扱う部分と新しい仮説を明確に分離する",

      "過去の研究履歴との重複を確認する",

      "使用する定理・補題が本当に適用可能か確認する",

      "証明できていない前提を暗黙に使用しない",

      "結論が仮説を言い換えただけになっていないか確認する"

    ],


    proof_methods: [

      "直接証明",

      "背理法",

      "対偶",

      "数学的帰納法",

      "強い帰納法",

      "構成的証明",

      "不変量",

      "極値原理",

      "場合分け",

      "反例探索",

      "反証可能性の確認",

      "必要条件と十分条件の分離"

    ],


    verification_rules: [

      "証明の各ステップに根拠を要求する",

      "論理的飛躍を明示する",

      "反例が存在する可能性を常に検討する",

      "仮定を変更した場合に結論が維持されるか検討する",

      "特殊例から一般命題へ飛躍しない",

      "計算結果と数学的証明を区別する",

      "未確認の論文・定理・引用を捏造しない"

    ],


    memory_summary:
      memory

  };

}


/* =========================================================
   FIND ROUTE USAGE
========================================================= */

async function getRouteUsage() {

  try {

    const {
      data,
      error
    } =
      await sb
        .from("research_results")
        .select(
          "content,evaluation,created_at"
        )
        .eq(
          "project_id",
          PROJECT_ID
        )
        .limit(500);


    if (error)
      throw error;


    const routeMap =
      {};


    (data || [])
      .forEach(result => {

        const content =
          normalizeResultContent(
            result
          );


        const route =
          content.route_key ||
          content.research_route;


        if (!route)
          return;


        if (!routeMap[route]) {

          routeMap[route] = {
            count: 0,
            evaluations: []
          };

        }


        routeMap[route].count++;

        routeMap[route]
          .evaluations
          .push(
            result.evaluation
          );

      });


    return routeMap;

  } catch (error) {

    console.warn(
      "Route usage unavailable:",
      error
    );

    return {};

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
    "過去研究・研究メモを確認しています..."
  );


  try {

    /*
      AI研究メモリを取得
    */

    const memory =
      await getResearchMemory(
        theme
      );


    /*
      同一ルート使用状況
    */

    const routeUsage =
      await getRouteUsage();


    /*
      研究制約
    */

    const constraints =
      buildResearchConstraints(
        memory
      );


    /*
      研究モード
    */

    const payload = {

      theme,

      source:
        "Research AI Lab",

      mode:
        "autonomous_research",


      /*
        AIへ渡す研究記憶
      */

      research_memory:
        memory,


      /*
        既知数学をなぞらないための制約
      */

      research_constraints:
        constraints,


      /*
        ルート遮断情報
      */

      route_usage:
        routeUsage,


      route_policy: {

        max_same_route:
          MAX_ROUTE_REPETITIONS,

        rule:
          "同一研究ルートを3回以上使用した場合、そのルートを候補から除外する"

      },


      /*
        検証要求
      */

      verification_policy: {

        mandatory: true,

        require_counterexample_search:
          true,

        require_proof_strategy_comparison:
          true,

        require_logical_gap_detection:
          true,

        require_known_result_separation:
          true,

        require_source_verification:
          true,

        allowed_proof_methods: [

          "direct",

          "contradiction",

          "contrapositive",

          "mathematical_induction",

          "strong_induction",

          "constructive",

          "invariant",

          "extremal",

          "case_analysis",

          "counterexample"

        ]

      },


      /*
        新しい研究方向を要求
      */

      novelty_policy: {

        avoid_known_math:
          true,

        avoid_rephrasing:
          true,

        avoid_duplicate_hypothesis:
          true,

        prefer_new_route:
          true,

        challenge_previous_assumptions:
          true

      }

    };


    setStatus(
      "研究ジョブをキューへ登録しています..."
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
            "research_cycle",

          status:
            "queued",

          priority:
            10,

          payload

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


    /*
      入力を残す。
      「何を研究していたか」が分からなくならないため。
    */

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
   RE-VERIFY RESULT
========================================================= */

async function reverifyResult(
  result
) {

  if (!result)
    return;


  try {

    const content =
      normalizeResultContent(
        result
      );


    const memory =
      await getResearchMemory(
        result.hypothesis ||
        result.title ||
        "研究結果"
      );


    const payload = {

      theme:
        result.hypothesis ||
        result.title ||
        "研究結果の再検証",


      source:
        "Research AI Lab / Reverification",


      mode:
        "reverification",


      verification_mode:
        true,


      target_result_id:
        result.id,


      target_result: {

        title:
          result.title,

        hypothesis:
          result.hypothesis,

        evaluation:
          result.evaluation,

        confidence_level:
          result.confidence_level,

        content

      },


      research_memory:
        memory,


      verification_policy: {

        mandatory: true,

        do_not_assume_original_result_correct:
          true,

        require_independent_recheck:
          true,

        require_counterexample_search:
          true,

        require_proof_strategy_comparison:
          true,

        require_logical_gap_detection:
          true,

        require_known_result_separation:
          true,

        require_source_verification:
          true,


        /*
          複数の証明方式を比較させる
        */

        proof_methods_to_test: [

          "direct",

          "contradiction",

          "contrapositive",

          "mathematical_induction",

          "strong_induction",

          "constructive",

          "invariant",

          "extremal",

          "case_analysis"

        ],


        /*
          反例があれば即座に⭕️を維持しない
        */

        counterexample_policy: {

          search_before_accept:
            true,

          if_counterexample_found:
            "reject",

          if_counterexample_possible:
            "needs_verification"

        }

      },


      novelty_policy: {

        compare_with_original:
          true,

        seek_independent_route:
          true,

        do_not_copy_original_proof:
          true

      }

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
            "reverification",

          status:
            "queued",

          priority:
            20,

          payload

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


    $("researchButton")
      .disabled = true;

    $("stopButton")
      .disabled = false;


    setStatus(
      "⭕️研究の独立再検証ジョブを登録しました。",
      "success"
    );


    startPolling();


  } catch (error) {

    console.error(
      "Reverification:",
      error
    );


    setStatus(
      `再検証ジョブ作成失敗: ${error.message}`,
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
        data.job_type ===
        "reverification"
          ? "再検証が完了しました。"
          : "研究完了。結果を取得しました。",
        "success"
      );


      await loadHistory();


      /*
        研究ページを更新
      */

      await loadJobs();

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

  if (!box) return;


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
      "メモを保存しました。次回研究のAIコンテキストとして利用できます。",
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
   PAGE VISIBILITY
========================================================= */

document.addEventListener(
  "visibilitychange",
  () => {

    /*
      タブを戻した瞬間に
      ジョブを再確認する。
    */

    if (
      document.visibilityState ===
      "visible"
    ) {

      checkConnection();

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

    setStatus(
      "ネットワーク接続が復旧しました。",
      "success"
    );

    checkConnection();

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

    setStatus(
      "ネットワーク接続が切断されています。",
      "error"
    );

  }
);


/* =========================================================
   INIT
========================================================= */

function init() {

  if (initialized)
    return;

  initialized = true;


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


  /*
    Clear
  */

  $("clearButton")
    ?.addEventListener(
      "click",
      () => {

        $("questionInput")
          .value = "";

        setStatus("");

      }
    );


  /*
    Memo
  */

  $("memoSaveButton")
    ?.addEventListener(
      "click",
      saveMemo
    );


  /*
    Initial state
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
