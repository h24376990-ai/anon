/* =========================================================
   Research AI Lab
   app.js COMPLETE EDITION

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
   history / memory / routes / re-verification

   IMPORTANT:
   - Browser NEVER contains service_role key.
   - Only publishable key is used here.
   - Background execution is handled by GitHub Actions.
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const SUPABASE_URL =
  "https://beadajbimgpephqszbfy.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_s5kiFZVJ9jXyOgS-j2pS-g_7Kj1IeC8";

const PROJECT_ID =
  "ab429192-27d2-47e4-9ad7-08b639f45120";


const MAX_VISIBLE_RESULTS = 100;

const POLL_INTERVAL = 5000;

const MAX_ROUTE_ATTEMPTS = 3;


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
   APPLICATION STATE
========================================================= */

let activeJobId =
  localStorage.getItem(
    "active_research_job"
  ) || null;

let pollTimer = null;

let lastResults = [];

let routeCache = {};

let modelState = {

  type: "surface",

  expression: "z = sin(x) * cos(y)",

  parameters: {

    scale: 1,

    rotationX: 0,

    rotationY: 0,

    rotationZ: 0,

    zoom: 1

  },

  physics: {

    enabled: false,

    gravity: 0,

    damping: 0,

    timeScale: 1

  }

};


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = id =>
  document.getElementById(id);


function safeElement(id) {

  return $(id) || null;

}


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
      text: String(value)
    };

  }

}


/* =========================================================
   ARRAY NORMALIZATION
========================================================= */

function asArray(value) {

  if (Array.isArray(value))
    return value;

  if (!value)
    return [];

  return [value];

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
    safeElement("statusBox");

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

  const textElement =
    safeElement("connectionText");

  const dot =
    safeElement("connectionDot");

  if (textElement)
    textElement.textContent = text;

  if (dot)
    dot.className =
      `dot ${ok ? "ok" : "bad"}`;

}


/* =========================================================
   CONNECTION CHECK
========================================================= */

async function checkConnection() {

  try {

    const result =
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

    if (result.error)
      throw result.error;

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
   RESEARCH STRATEGY
========================================================= */

function buildResearchStrategy(theme) {

  return {

    theme,

    objective:
      "Investigate rather than merely answer.",

    antiKnownMath:

      [
        "Identify whether the question is already known.",
        "Separate established mathematics from new conjecture.",
        "Do not reproduce a standard textbook proof as a research discovery.",
        "Compare the proposed route with known mathematical structures.",
        "Search for genuinely different formulations.",
        "Explicitly state what is already known.",
        "Do not call a known theorem a new result.",
        "Do not claim novelty without literature verification."
      ],

    antiHallucination:

      [
        "Never invent citations.",
        "Never invent papers.",
        "Never invent theorem names.",
        "Never claim a theorem was proved unless the logical proof is complete.",
        "Never convert numerical evidence into proof.",
        "Explicitly identify unsupported assumptions.",
        "Identify the largest logical gap.",
        "If evidence is insufficient, mark the result uncertain."
      ],

    verification:

      [

        {
          name:
            "counterexample",

          instruction:
            "Attempt to construct counterexamples before accepting the hypothesis."
        },

        {
          name:
            "contradiction",

          instruction:
            "Attempt proof by contradiction and explicitly identify the contradiction."
        },

        {
          name:
            "induction",

          instruction:
            "Check whether mathematical induction is structurally applicable."
        },

        {
          name:
            "reverse",

          instruction:
            "Reason backwards from the desired conclusion."
        },

        {
          name:
            "direct",

          instruction:
            "Attempt a direct proof using only justified steps."
        },

        {
          name:
            "alternative",

          instruction:
            "Search for a fundamentally different proof strategy."
        },

        {
          name:
            "cross_domain",

          instruction:
            "Explore useful connections to other mathematical domains without treating analogy as proof."
        },

        {
          name:
            "computational",

          instruction:
            "Use numerical or symbolic experimentation only as evidence generation, never as proof."
        }

      ],

    literature:

      [
        "Check known mathematical literature when possible.",
        "Do not manufacture references.",
        "Distinguish known results from proposed research.",
        "If literature cannot be checked, explicitly say so.",
        "Never claim a result is new merely because it was not recalled."
      ],

    routePolicy:

      {
        maximumAttempts:
          MAX_ROUTE_ATTEMPTS,

        actionAfterLimit:
          "BLOCK_ROUTE",

        rule:
          "The same logical research route must not be repeatedly pursued more than three times."
      }

  };

}


/* =========================================================
   RESEARCH PROMPT BUILDER
========================================================= */

function buildResearchPrompt(
  theme,
  memory = [],
  userMemos = [],
  previousResults = [],
  routeInfo = null
) {

  const strategy =
    buildResearchStrategy(theme);


  return `

You are the research engine of an autonomous mathematical research laboratory.

IMPORTANT:
You are NOT a normal question-answering assistant.

Your task is to perform mathematical research.

Research theme:
${theme}


=========================================================
CORE RESEARCH RULES
=========================================================

1. Do not merely answer the question from memory.

2. Investigate it as a research problem.

3. Never claim an unproven statement is proven.

4. Never turn numerical evidence into proof.

5. Never invent references.

6. Never invent papers.

7. Never invent theorem names.

8. Never hide logical gaps.

9. Separate:
   - established facts
   - assumptions
   - hypotheses
   - evidence
   - conjectures
   - conclusions

10. If the problem is a famous unsolved problem such as the
Riemann Hypothesis, do NOT simply respond:
"it is unsolved, therefore impossible."

Instead:
- identify the exact mathematical question,
- review known structures,
- identify known obstacles,
- formulate research directions,
- attempt meaningful verification,
- search for counterexamples,
- test alternative formulations,
- identify what would actually constitute progress.

11. Never claim to have solved a famous open problem unless
the proof is complete and every logical step is justified.

12. A plausible explanation is NOT a proof.


=========================================================
ANTI-REDISCOVERY SYSTEM
=========================================================

Use all of these defenses against merely reproducing known mathematics:

A. Known-result separation

Explicitly classify every important statement as:

KNOWN
ASSUMED
NEW CANDIDATE
UNCERTAIN

B. Novelty barrier

Do not describe a standard theorem or textbook argument
as a new discovery.

C. Alternative formulation

Try to reformulate the problem mathematically.

D. Independent route

Attempt a route substantially different from the obvious
standard approach.

E. Failure memory

Read previous failed approaches and do not repeat them
without a clear reason.

F. Route blocking

If the same logical route has already failed three times,
do not continue that route.

G. Literature discipline

Never invent literature evidence.

H. Proof obligation

Every major implication requires justification.

I. Counterexample pressure

Before accepting a conjecture, actively attempt to destroy it.

J. Assumption audit

List every assumption that is not already established.

K. Gap detection

Identify the single largest unresolved logical gap.

L. Independent verification

Try another proof strategy if the first strategy appears successful.


=========================================================
VERIFICATION MODES
=========================================================

Attempt whichever are mathematically appropriate:

1. Direct proof

2. Proof by contradiction

3. Mathematical induction

4. Contrapositive reasoning

5. Backward reasoning

6. Case analysis

7. Counterexample construction

8. Boundary-case analysis

9. Limiting-case analysis

10. Computational experiment

11. Symbolic manipulation

12. Alternative proof

13. Cross-domain interpretation

14. Structural transformation

15. Necessary-condition analysis

16. Sufficient-condition analysis

Never force a method when it is mathematically inappropriate.


=========================================================
PHYSICAL / GEOMETRIC MODELING
=========================================================

When appropriate, consider whether the mathematical object
can be represented as:

- a surface
- a curve
- a graph
- a network
- a dynamical system
- a parameter space
- a geometric transformation
- an optimization landscape

Physical simulation may be used to explore intuition.

BUT:

Physical behavior is not automatically mathematical proof.

Simulation is evidence only.

Always distinguish:

MODEL
SIMULATION
OBSERVATION
PROOF


=========================================================
PREVIOUS AI MEMORY
=========================================================

${JSON.stringify(
  memory,
  null,
  2
)}


=========================================================
USER / CLAUDE RESEARCH MEMOS
=========================================================

${JSON.stringify(
  userMemos,
  null,
  2
)}


=========================================================
PREVIOUS RESEARCH
=========================================================

${JSON.stringify(
  previousResults,
  null,
  2
)}


=========================================================
ROUTE INFORMATION
=========================================================

${JSON.stringify(
  routeInfo,
  null,
  2
)}


=========================================================
REQUIRED OUTPUT
=========================================================

Return ONLY valid JSON.

Required keys:

title
hypothesis
research_question
known_facts
assumptions
approach
proof_strategy
counterexample_strategy
cross_domain_connection
critical_gap
next_steps
verification_methods
literature_status
novelty_status
route_key
route_attempt
model
status
confidence

Allowed status:

candidate
promising
uncertain
rejected
needs_verification

Allowed novelty_status:

known
possibly_known
uncertain
candidate_new

literature_status must explicitly state whether literature
verification was possible.

confidence must be between 0 and 1.

The result must NEVER imply that an unsolved problem has been
solved unless a complete proof has actually been established.

`;


}


/* =========================================================
   FETCH RECENT MEMORY
========================================================= */

async function fetchResearchMemory(limit = 30) {

  try {

    const {
      data,
      error
    } =
      await sb
        .from("research_results")
        .select(
          "id,title,hypothesis,content,status,evaluation,confidence_level,created_at"
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
        .limit(limit);

    if (error)
      throw error;

    return data || [];

  } catch (error) {

    console.warn(
      "Memory fetch failed:",
      error
    );

    return [];

  }

}


/* =========================================================
   FETCH USER MEMOS
========================================================= */

async function fetchUserMemos(limit = 30) {

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
        )
        .limit(limit);

    if (error)
      throw error;

    return data || [];

  } catch (error) {

    console.warn(
      "Memo fetch failed:",
      error
    );

    return [];

  }

}


/* =========================================================
   ROUTE KEY
========================================================= */

function normalizeRouteKey(
  theme,
  strategy = ""
) {

  return `${theme}|${strategy}`
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


/* =========================================================
   LOCAL ROUTE CACHE
========================================================= */

function getRouteAttempts(
  routeKey
) {

  const stored =
    localStorage.getItem(
      "research_route_cache"
    );

  if (!stored)
    return 0;

  try {

    const parsed =
      JSON.parse(stored);

    return Number(
      parsed[routeKey] || 0
    );

  } catch {

    return 0;

  }

}


/* =========================================================
   INCREMENT ROUTE
========================================================= */

function incrementRoute(
  routeKey
) {

  let parsed = {};

  try {

    parsed =
      JSON.parse(
        localStorage.getItem(
          "research_route_cache"
        ) || "{}"
      );

  } catch {

    parsed = {};

  }

  parsed[routeKey] =
    Number(
      parsed[routeKey] || 0
    ) + 1;

  localStorage.setItem(
    "research_route_cache",
    JSON.stringify(parsed)
  );

  routeCache =
    parsed;

  return parsed[routeKey];

}


/* =========================================================
   ROUTE BLOCK CHECK
========================================================= */

function isRouteBlocked(
  routeKey
) {

  return (
    getRouteAttempts(routeKey)
    >= MAX_ROUTE_ATTEMPTS
  );

}


/* =========================================================
   MODEL STATE
========================================================= */

function updateModelState(
  changes = {}
) {

  modelState = {

    ...modelState,

    ...changes,

    parameters: {

      ...modelState.parameters,

      ...(changes.parameters || {})

    },

    physics: {

      ...modelState.physics,

      ...(changes.physics || {})

    }

  };


  localStorage.setItem(
    "research_model_state",
    JSON.stringify(modelState)
  );


  dispatchModelEvent();

}


/* =========================================================
   LOAD MODEL STATE
========================================================= */

function loadModelState() {

  try {

    const stored =
      localStorage.getItem(
        "research_model_state"
      );

    if (stored)
      modelState =
        JSON.parse(stored);

  } catch {

    console.warn(
      "Model state could not be loaded."
    );

  }

}


/* =========================================================
   MODEL EVENT
========================================================= */

function dispatchModelEvent() {

  window.dispatchEvent(
    new CustomEvent(
      "research-model-update",
      {
        detail: modelState
      }
    )
  );

}


/* =========================================================
   GET MODEL
========================================================= */

function getMathModel() {

  return {
    ...modelState,

    timestamp:
      Date.now()
  };

}


/* =========================================================
   SET MODEL EXPRESSION
========================================================= */

function setModelExpression(
  expression
) {

  updateModelState({
    expression:
      String(
        expression || ""
      )
  });

}


/* =========================================================
   TRANSFORM MODEL
========================================================= */

function transformModel(
  transform = {}
) {

  updateModelState({

    parameters: {

      ...transform

    }

  });

}


/* =========================================================
   ENABLE PHYSICS
========================================================= */

function setPhysics(
  enabled,
  settings = {}
) {

  updateModelState({

    physics: {

      enabled:
        Boolean(enabled),

      ...settings

    }

  });

}


/* =========================================================
   PUBLIC MODEL API
========================================================= */

window.ResearchMathModel = {

  getState:
    getMathModel,

  setExpression:
    setModelExpression,

  transform:
    transformModel,

  physics:
    setPhysics

};


/* =========================================================
   HISTORY
========================================================= */

async function loadHistory() {

  const box =
    safeElement("historyList");

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


    lastResults =
      data || [];


    const count =
      safeElement("historyCount");

    if (count)
      count.textContent =
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

      const detail =
        safeElement("detail");

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
    safeElement("savedList");

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
    safeElement("jobsList");

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

              <small>
                ${
                  job.id
                    ? `ID: ${esc(job.id)}`
                    : ""
                }
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
    safeElement("memoryList");

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


    const memos =
      await fetchUserMemos(20);


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
          研究結果はSupabaseに保存され、
          次回研究時に過去研究を参照できます。
        </p>

        <p>
          失敗した研究、未検証の仮説、
          有望なルート、⭕️結果などを
          次の研究サイクルの材料として扱います。
        </p>

        <p>
          現在保存されているユーザーメモ:
          ${memos.length}件
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
    safeElement("routesList");

  if (!box)
    return;


  const memory =
    await fetchResearchMemory(100);


  const routes = {};


  memory.forEach(result => {

    const content =
      parseJson(
        result.content
      );


    const route =
      content.route_key ||
      normalizeRouteKey(
        result.title,
        content.approach
      );


    if (!routes[route]) {

      routes[route] = {

        attempts: 0,

        results: []

      };

    }


    routes[route]
      .attempts++;


    routes[route]
      .results
      .push(result);

  });


  const entries =
    Object.entries(routes);


  if (!entries.length) {

    box.innerHTML = `

      <div class="graph-placeholder">

        <div class="graph-node main">
          RESEARCH
        </div>

        <p>
          まだ研究ルートがありません。
        </p>

      </div>

    `;

    return;

  }


  box.innerHTML = `

    <div class="route-dashboard">

      ${entries.map(
        ([route, data]) => {

          const blocked =
            data.attempts >=
            MAX_ROUTE_ATTEMPTS;

          return `

            <div class="route-card">

              <div class="route-title">

                <strong>
                  ${esc(route)}
                </strong>

                <span class="badge ${
                  blocked
                    ? "failed"
                    : "running"
                }">

                  ${
                    blocked
                      ? "BLOCKED"
                      : `${data.attempts}回`
                  }

                </span>

              </div>

              <p>

                ${
                  blocked
                    ? "同一ルート3回以上のため遮断"
                    : "探索可能"
                }

              </p>

            </div>

          `;

        }
      ).join("")}

    </div>

  `;

}


/* =========================================================
   RESULTS RENDER
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
            renderDetail(result);

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

  const detail =
    safeElement("detail");

  if (!detail)
    return;


  const content =
    parseJson(
      result.content
    );


  detail.innerHTML = `

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

      ${
        result.is_human_saved
          ? `<span>★ 永久保存</span>`
          : ""
      }

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


    <section>

      <label>
        数学モデル
      </label>

      <pre>${esc(
        JSON.stringify(
          content.model ||
          {},
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

        🔄 AI再検証

      </button>

    </div>

  `;


  const save =
    safeElement(
      "saveDetail"
    );

  if (save) {

    save.addEventListener(
      "click",
      () =>
        toggleSave(result)
    );

  }


  const reverify =
    safeElement(
      "reverifyDetail"
    );

  if (reverify) {

    reverify.addEventListener(
      "click",
      () =>
        requestReverification(
          result
        )
    );

  }

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
   REVERIFICATION
========================================================= */

async function requestReverification(
  result
) {

  try {

    const content =
      parseJson(
        result.content
      );


    const theme =
      result.hypothesis ||
      result.title ||
      "Previous research";


    const verificationRequest = {

      type:
        "reverification",

      original_result_id:
        result.id,

      theme,

      original_result:
        content,

      methods:

        [

          "counterexample",

          "contradiction",

          "induction",

          "contrapositive",

          "backward",

          "direct",

          "alternative"

        ],

      requirement:
        "Independently verify the previous result. Do not assume it is correct."

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

          payload:
            verificationRequest

        })
        .select()
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

    startPolling();


    setStatus(
      "⭕️/研究結果のAI再検証をキューに登録しました。",
      "success"
    );

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
    safeElement(
      "questionInput"
    );


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


  const routeKey =
    normalizeRouteKey(
      theme,
      "initial"
    );


  if (
    isRouteBlocked(
      routeKey
    )
  ) {

    setStatus(
      "この研究ルートは3回以上試行されたため遮断されています。別の研究方向を選んでください。",
      "error"
    );

    return;

  }


  const researchButton =
    safeElement(
      "researchButton"
    );

  const stopButton =
    safeElement(
      "stopButton"
    );


  if (researchButton)
    researchButton.disabled = true;

  if (stopButton)
    stopButton.disabled = false;


  setStatus(
    "研究材料を準備しています..."
  );


  try {

    const memory =
      await fetchResearchMemory(30);


    const memos =
      await fetchUserMemos(30);


    const strategy =
      buildResearchStrategy(
        theme
      );


    const promptPreview =
      buildResearchPrompt(
        theme,
        memory,
        memos,
        memory,
        {
          routeKey,

          attempts:
            getRouteAttempts(
              routeKey
            )
        }
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

          payload: {

            theme,

            source:
              "Research AI Lab",

            mode:
              "autonomous_research",

            strategy,

            route_key:
              routeKey,

            route_attempt:
              getRouteAttempts(
                routeKey
              ) + 1,

            research_prompt:
              promptPreview,

            memory_context:
              memory,

            user_memos:
              memos,

            model:
              getMathModel(),

            verification_methods:

              [
                "counterexample",
                "contradiction",
                "induction",
                "contrapositive",
                "backward",
                "direct",
                "alternative",
                "cross_domain"
              ]

          }

        })
        .select()
        .single();


    if (error)
      throw error;


    incrementRoute(
      routeKey
    );


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


    if (researchButton)
      researchButton.disabled = false;

    if (stopButton)
      stopButton.disabled = true;


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


  const stopButton =
    safeElement(
      "stopButton"
    );


  if (stopButton)
    stopButton.disabled = true;


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

    if (stopButton)
      stopButton.disabled = false;


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
    safeElement("jobPanel");

  if (panel)
    panel.classList.remove(
      "hidden"
    );


  const jobId =
    safeElement("jobId");

  const status =
    safeElement("jobStatus");

  const created =
    safeElement("jobCreated");

  const started =
    safeElement("jobStarted");

  const finished =
    safeElement("jobFinished");

  if (jobId)
    jobId.textContent =
      job.id || "—";

  if (status)
    status.textContent =
      String(
        job.status ||
        "unknown"
      ).toUpperCase();

  if (created)
    created.textContent =
      formatDate(
        job.created_at
      );

  if (started)
    started.textContent =
      formatDate(
        job.started_at
      );

  if (finished)
    finished.textContent =
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


  const progress =
    safeElement(
      "progressValue"
    );

  const progressPercent =
    safeElement(
      "progressPercent"
    );

  const progressText =
    safeElement(
      "progressText"
    );


  if (progress)
    progress.style.width =
      `${percent}%`;

  if (progressPercent)
    progressPercent.textContent =
      `${percent}%`;

  if (progressText)
    progressText.textContent =
      text;

}


/* =========================================================
   JOB POLLING
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

      const researchButton =
        safeElement(
          "researchButton"
        );

      const stopButton =
        safeElement(
          "stopButton"
        );

      if (researchButton)
        researchButton.disabled = false;

      if (stopButton)
        stopButton.disabled = true;

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


    const researchButton =
      safeElement(
        "researchButton"
      );

    const stopButton =
      safeElement(
        "stopButton"
      );


    if (researchButton)
      researchButton.disabled = false;

    if (stopButton)
      stopButton.disabled = true;


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
   POLLING START
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


/* =========================================================
   POLLING STOP
========================================================= */

function stopPolling() {

  if (pollTimer) {

    clearInterval(
      pollTimer
    );

    pollTimer = null;

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

    const researchButton =
      safeElement(
        "researchButton"
      );

    const stopButton =
      safeElement(
        "stopButton"
      );


    if (researchButton)
      researchButton.disabled = true;

    if (stopButton)
      stopButton.disabled = false;


    startPolling();

  }

}


/* =========================================================
   MEMOS
========================================================= */

async function loadMemos() {

  const box =
    safeElement("memoList");

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
    safeElement(
      "memoTitle"
    )?.value.trim() || "";


  const content =
    safeElement(
      "memoContent"
    )?.value.trim() || "";


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


    const titleElement =
      safeElement(
        "memoTitle"
      );

    const contentElement =
      safeElement(
        "memoContent"
      );


    if (titleElement)
      titleElement.value = "";

    if (contentElement)
      contentElement.value = "";


    setStatus(
      "研究メモをAI研究メモリへ保存しました。",
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
   QUEUE MULTIPLE RESEARCH JOBS
========================================================= */

async function queueResearchBatch(
  themes = []
) {

  if (!Array.isArray(themes))
    return [];

  const cleanThemes =
    themes
      .map(
        theme =>
          String(
            theme || ""
          ).trim()
      )
      .filter(Boolean);


  if (!cleanThemes.length)
    return [];


  const memory =
    await fetchResearchMemory(30);


  const memos =
    await fetchUserMemos(30);


  const jobs = [];


  for (
    const theme of cleanThemes
  ) {

    const routeKey =
      normalizeRouteKey(
        theme,
        "batch"
      );


    if (
      isRouteBlocked(
        routeKey
      )
    ) {
      continue;
    }


    const payload = {

      theme,

      source:
        "Research AI Lab batch",

      mode:
        "autonomous_research",

      route_key:
        routeKey,

      route_attempt:
        getRouteAttempts(
          routeKey
        ) + 1,

      strategy:
        buildResearchStrategy(
          theme
        ),

      memory_context:
        memory,

      user_memos:
        memos,

      model:
        getMathModel(),

      verification_methods:

        [
          "counterexample",
          "contradiction",
          "induction",
          "contrapositive",
          "backward",
          "alternative"
        ]

    };


    jobs.push({

      project_id:
        PROJECT_ID,

      job_type:
        "research_cycle",

      status:
        "queued",

      priority:
        10,

      payload

    });

  }


  if (!jobs.length)
    return [];


  const {
    data,
    error
  } =
    await sb
      .from("research_jobs")
      .insert(jobs)
      .select();


  if (error)
    throw error;


  data.forEach(
    job => {

      const route =
        job.payload?.route_key;

      if (route)
        incrementRoute(
          route
        );

    }
  );


  await loadJobs();


  return data;

}


/* =========================================================
   PUBLIC BATCH API
========================================================= */

window.ResearchQueue = {

  add:
    queueResearchBatch

};


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


  const researchButton =
    safeElement(
      "researchButton"
    );

  if (researchButton) {

    researchButton.addEventListener(
      "click",
      startResearch
    );

  }


  const stopButton =
    safeElement(
      "stopButton"
    );

  if (stopButton) {

    stopButton.addEventListener(
      "click",
      stopResearch
    );

  }


  const clearButton =
    safeElement(
      "clearButton"
    );

  if (clearButton) {

    clearButton.addEventListener(
      "click",
      () => {

        const input =
          safeElement(
            "questionInput"
          );

        if (input)
          input.value = "";

        setStatus("");

      }
    );

  }


  const memoSaveButton =
    safeElement(
      "memoSaveButton"
    );

  if (memoSaveButton) {

    memoSaveButton.addEventListener(
      "click",
      saveMemo
    );

  }


  loadModelState();

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


/* =========================================================
   GLOBAL DEBUG / CONTROL API
========================================================= */

window.ResearchAILab = {

  startResearch,

  stopResearch,

  refreshActiveJob,

  loadHistory,

  loadSaved,

  loadJobs,

  loadMemory,

  loadRoutes,

  loadMemos,

  saveMemo,

  queueResearchBatch,

  requestReverification,

  getMathModel,

  setModelExpression,

  transformModel,

  setPhysics,

  buildResearchStrategy,

  buildResearchPrompt

};


/* =========================================================
   END
========================================================= */
