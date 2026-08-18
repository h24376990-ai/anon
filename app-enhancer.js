/* =========================================================
   Research AI Lab
   UI / Control / Memo / Live Research Enhancer
   ========================================================= */

(() => {
  "use strict";

  const PROJECT_ID =
    "ab429192-27d2-47e4-9ad7-08b639f45120";

  const getSupabase = () =>
    window.__researchSupabase ||
    window.supabaseClient ||
    null;

  const $ = (id) =>
    document.getElementById(id);

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  let activeView = "home";

  let liveTimer = null;

  let selectedMemo = null;

  let selectedJob = null;


  /* =========================================================
     BOOT
     ========================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      setTimeout(() => {

        exposeExistingSupabase();

        createResearchShell();

        setupEnhancedEvents();

        loadEnhancedData();

      }, 700);

    }
  );


  /* =========================================================
     SUPABASE
     ========================================================= */

  function exposeExistingSupabase() {

    /*
     * 既存app.jsのSupabase clientを取得できる場合に使用。
     */

    if (
      typeof window.supabaseClient !==
      "undefined"
    ) {
      window.__researchSupabase =
        window.supabaseClient;
    }

  }


  async function getClient() {

    if (
      window.__researchSupabase
    ) {
      return window.__researchSupabase;
    }

    if (
      window.supabaseClient
    ) {
      return window.supabaseClient;
    }

    /*
     * 既存app.jsのconstは
     * グローバルwindowには出ないため、
     * ここではDOMから直接取得する方式を
     * 優先しない。
     */

    throw new Error(
      "Supabase client is not available."
    );

  }


  /* =========================================================
     SHELL
     ========================================================= */

  function createResearchShell() {

    if (
      document.getElementById(
        "ralEnhancedShell"
      )
    ) {
      return;
    }

    const shell =
      document.createElement(
        "div"
      );

    shell.id =
      "ralEnhancedShell";

    shell.innerHTML = `

      <div class="ral-overlay">

        <aside class="ral-sidebar">

          <div class="ral-logo">

            <div class="ral-logo-mark">
              ∑
            </div>

            <div>
              <strong>
                RESEARCH AI LAB
              </strong>

              <span>
                AUTONOMOUS RESEARCH
              </span>
            </div>

          </div>


          <nav class="ral-nav">

            <button
              data-ral-view="home"
              class="ral-nav-item active"
            >
              <span>⌂</span>
              <b>HOME</b>
            </button>

            <button
              data-ral-view="research"
              class="ral-nav-item"
            >
              <span>🔬</span>
              <b>RESEARCH</b>
            </button>

            <button
              data-ral-view="live"
              class="ral-nav-item"
            >
              <span>⚡</span>
              <b>LIVE</b>
            </button>

            <button
              data-ral-view="memory"
              class="ral-nav-item"
            >
              <span>🧠</span>
              <b>MEMORY</b>
            </button>

            <button
              data-ral-view="history"
              class="ral-nav-item"
            >
              <span>📚</span>
              <b>HISTORY</b>
            </button>

            <button
              data-ral-view="memos"
              class="ral-nav-item"
            >
              <span>📝</span>
              <b>MEMOS</b>
            </button>

            <button
              data-ral-view="routes"
              class="ral-nav-item"
            >
              <span>🔗</span>
              <b>ROUTES</b>
            </button>

            <button
              data-ral-view="lab"
              class="ral-nav-item"
            >
              <span>◈</span>
              <b>3D LAB</b>
            </button>

            <button
              data-ral-view="analysis"
              class="ral-nav-item"
            >
              <span>📊</span>
              <b>ANALYSIS</b>
            </button>

          </nav>


          <div class="ral-sidebar-bottom">

            <div class="ral-system">
              <span class="ral-live-dot"></span>
              SYSTEM ONLINE
            </div>

          </div>

        </aside>


        <main class="ral-main">

          <header class="ral-header">

            <div>

              <div class="ral-header-kicker">
                MATHEMATICAL RESEARCH SYSTEM
              </div>

              <h1 id="ralPageTitle">
                Research Control
              </h1>

            </div>


            <div class="ral-header-actions">

              <div
                id="ralJobState"
                class="ral-state idle"
              >
                IDLE
              </div>

              <button
                id="ralRefresh"
                class="ral-header-button"
              >
                ↻
              </button>

            </div>

          </header>


          <section
            id="ralViewHome"
            class="ral-view active"
          ></section>


          <section
            id="ralViewResearch"
            class="ral-view"
          ></section>


          <section
            id="ralViewLive"
            class="ral-view"
          ></section>


          <section
            id="ralViewMemory"
            class="ral-view"
          ></section>


          <section
            id="ralViewHistory"
            class="ral-view"
          ></section>


          <section
            id="ralViewMemos"
            class="ral-view"
          ></section>


          <section
            id="ralViewRoutes"
            class="ral-view"
          ></section>


          <section
            id="ralViewLab"
            class="ral-view"
          ></section>


          <section
            id="ralViewAnalysis"
            class="ral-view"
          ></section>


        </main>

      </div>


      <nav class="ral-mobile-nav">

        <button data-ral-view="home">
          ⌂
          <small>HOME</small>
        </button>

        <button data-ral-view="research">
          🔬
          <small>RESEARCH</small>
        </button>

        <button data-ral-view="live">
          ⚡
          <small>LIVE</small>
        </button>

        <button data-ral-view="memos">
          📝
          <small>MEMOS</small>
        </button>

        <button data-ral-view="lab">
          ◈
          <small>3D</small>
        </button>

      </nav>

    `;

    document.body.appendChild(
      shell
    );

    renderHome();

  }


  /* =========================================================
     VIEW SWITCH
     ========================================================= */

  function switchView(
    view
  ) {

    activeView =
      view;

    document
      .querySelectorAll(
        ".ral-view"
      )
      .forEach(
        element => {

          element.classList.toggle(
            "active",
            element.id ===
            `ralView${capitalize(view)}`
          );

        }
      );


    document
      .querySelectorAll(
        "[data-ral-view]"
      )
      .forEach(
        button => {

          button.classList.toggle(
            "active",
            button.dataset.ralView ===
            view
          );

        }
      );


    const titles = {
      home:
        "Research Control",

      research:
        "Research",

      live:
        "Live Research",

      memory:
        "AI Memory",

      history:
        "Research History",

      memos:
        "Research Memos",

      routes:
        "Research Routes",

      lab:
        "Visualization Lab",

      analysis:
        "Research Analysis"

    };

    const title =
      $("ralPageTitle");

    if (title) {
      title.textContent =
        titles[view] ||
        "Research AI Lab";
    }


    if (
      view ===
      "live"
    ) {
      startLivePolling();
    }


    if (
      view ===
      "memos"
    ) {
      loadMemos();
    }


    if (
      view ===
      "routes"
    ) {
      loadRoutes();
    }


    if (
      view ===
      "lab"
    ) {
      render3DLab();
    }


    if (
      view ===
      "analysis"
    ) {
      renderAnalysis();
    }

  }


  /* =========================================================
     HOME
     ========================================================= */

  function renderHome() {

    const view =
      $("ralViewHome");

    if (!view) {
      return;
    }

    view.innerHTML = `

      <div class="ral-hero-grid">

        <div class="ral-card ral-main-card">

          <div class="ral-card-kicker">
            AUTONOMOUS MATHEMATICS
          </div>

          <h2>
            Research AI Lab
          </h2>

          <p>
            仮説生成、文献確認、実験、反例探索、
            独立検証を継続的に行う研究管制システム。
          </p>


          <div class="ral-theme-box">

            <label>
              RESEARCH THEME
            </label>

            <input
              id="ralTheme"
              value="Riemann Hypothesis"
              placeholder="研究テーマ"
            >

          </div>


          <div class="ral-control-grid">

            <button
              id="ralStart"
              class="ral-primary"
            >
              ▶ START RESEARCH
            </button>

            <button
              id="ralPause"
              class="ral-secondary"
            >
              ⏸ PAUSE
            </button>

            <button
              id="ralStop"
              class="ral-danger"
            >
              ⏹ STOP VERIFICATION
            </button>

          </div>

        </div>


        <div class="ral-card ral-status-card">

          <div class="ral-card-kicker">
            SYSTEM STATUS
          </div>

          <div
            id="ralBigStatus"
            class="ral-big-status"
          >
            IDLE
          </div>

          <div
            id="ralStatusText"
            class="ral-muted"
          >
            現在研究は実行されていません。
          </div>

        </div>

      </div>


      <div class="ral-stat-grid">

        <div class="ral-stat-card">
          <span>ALL RESEARCH</span>
          <strong id="ralTotal">
            -
          </strong>
        </div>

        <div class="ral-stat-card">
          <span>⭕️ VERIFIED</span>
          <strong id="ralPositive">
            -
          </strong>
        </div>

        <div class="ral-stat-card">
          <span>MEMOS</span>
          <strong id="ralMemoCount">
            -
          </strong>
        </div>

        <div class="ral-stat-card">
          <span>EVENTS</span>
          <strong id="ralEventCount">
            -
          </strong>
        </div>

      </div>


      <div class="ral-card">

        <div class="ral-card-title-row">

          <div>
            <div class="ral-card-kicker">
              CURRENT RESEARCH
            </div>

            <h3>
              Live Job
            </h3>
          </div>

          <button
            class="ral-secondary"
            data-ral-view="live"
          >
            OPEN LIVE
          </button>

        </div>

        <div
          id="ralCurrentJob"
          class="ral-job-box"
        >
          No active research.
        </div>

      </div>

    `;

  }


  /* =========================================================
     RESEARCH VIEW
     ========================================================= */

  function renderResearchView() {

    const view =
      $("ralViewResearch");

    if (!view) {
      return;
    }

    view.innerHTML = `

      <div class="ral-card">

        <div class="ral-card-kicker">
          RESEARCH CONFIGURATION
        </div>

        <h2>
          Autonomous Research
        </h2>

        <div class="ral-option-grid">

          <label>
            <input
              id="ralLiterature"
              type="checkbox"
              checked
            >
            Literature Check
          </label>

          <label>
            <input
              id="ralCrossDomain"
              type="checkbox"
              checked
            >
            Cross Domain
          </label>

          <label>
            <input
              id="ralReductio"
              type="checkbox"
              checked
            >
            Reductio ad Absurdum
          </label>

          <label>
            <input
              id="ralCounterexample"
              type="checkbox"
              checked
            >
            Counterexample Search
          </label>

          <label>
            <input
              id="ralIndependent"
              type="checkbox"
              checked
            >
            Independent Verification
          </label>

        </div>

      </div>


      <div class="ral-card">

        <div class="ral-card-kicker">
          JOB CONTROL
        </div>

        <div
          id="ralResearchJob"
          class="ral-job-box"
        >
          Loading...
        </div>

      </div>

    `;

  }


  /* =========================================================
     LIVE VIEW
     ========================================================= */

  function renderLiveView() {

    const view =
      $("ralViewLive");

    if (!view) {
      return;
    }

    view.innerHTML = `

      <div class="ral-live-grid">

        <div class="ral-card">

          <div class="ral-card-kicker">
            LIVE PIPELINE
          </div>

          <div
            id="ralPipeline"
            class="ral-pipeline"
          >

            ${pipelineStep(
              "hypothesis",
              "HYPOTHESIS",
              "仮説生成"
            )}

            ${pipelineStep(
              "literature",
              "LITERATURE",
              "文献確認"
            )}

            ${pipelineStep(
              "experiment",
              "EXPERIMENT",
              "実験"
            )}

            ${pipelineStep(
              "counterexample",
              "COUNTEREXAMPLE",
              "反例探索"
            )}

            ${pipelineStep(
              "verification",
              "VERIFICATION",
              "独立検証"
            )}

            ${pipelineStep(
              "evaluation",
              "EVALUATION",
              "評価"
            )}

          </div>

        </div>


        <div class="ral-card">

          <div class="ral-card-kicker">
            LIVE CODE
          </div>

          <pre
            id="ralLiveCode"
            class="ral-code"
          >Waiting for research...</pre>

        </div>

      </div>


      <div class="ral-card">

        <div class="ral-card-title-row">

          <div>
            <div class="ral-card-kicker">
              EVENT STREAM
            </div>

            <h3>
              Research Events
            </h3>
          </div>

        </div>

        <div
          id="ralEvents"
          class="ral-events"
        >
          Waiting...
        </div>

      </div>

    `;

  }


  function pipelineStep(
    key,
    title,
    label
  ) {

    return `

      <div
        class="ral-pipeline-step"
        data-stage="${key}"
      >

        <span class="ral-stage-dot">
          ○
        </span>

        <div>
          <strong>
            ${title}
          </strong>

          <small>
            ${label}
          </small>
        </div>

      </div>

    `;

  }


  /* =========================================================
     MEMORY
     ========================================================= */

  function renderMemoryView() {

    const view =
      $("ralViewMemory");

    if (!view) {
      return;
    }

    view.innerHTML = `

      <div class="ral-memory-grid">

        <div class="ral-card">
          <div class="ral-card-kicker">
            AI MEMORY
          </div>

          <h2>
            全研究記憶
          </h2>

          <p>
            AI側には研究結果を残し、
            成功・失敗パターンを次の研究へ利用します。
          </p>
        </div>


        <div class="ral-card">
          <div class="ral-card-kicker">
            FAILURE ANALYSIS
          </div>

          <h2>
            共通する失敗
          </h2>

          <div
            id="ralFailureAnalysis"
            class="ral-muted"
          >
            研究結果を分析中...
          </div>
        </div>

      </div>

    `;

  }


  /* =========================================================
     HISTORY
     ========================================================= */

  function renderHistoryView() {

    const view =
      $("ralViewHistory");

    if (!view) {
      return;
    }

    view.innerHTML = `

      <div class="ral-card">

        <div class="ral-card-kicker">
          RESEARCH HISTORY
        </div>

        <div class="ral-search-row">

          <input
            id="ralSearch"
            placeholder="研究タイトル・仮説を検索..."
          >

          <select
            id="ralEvaluation"
          >

            <option value="all">
              ALL
            </option>

            <option value="⭕️">
              ⭕️ VERIFIED
            </option>

            <option value="△">
              △ UNCERTAIN
            </option>

            <option value="❌">
              ❌ FAILED
            </option>

          </select>

        </div>

        <div
          id="ralHistoryList"
          class="ral-result-list"
        >
          Loading...
        </div>

      </div>

    `;

    loadHistory();

  }


  /* =========================================================
     MEMOS
     ========================================================= */

  function renderMemosView() {

    const view =
      $("ralViewMemos");

    if (!view) {
      return;
    }

    view.innerHTML = `

      <div class="ral-memo-grid">

        <div class="ral-card">

          <div class="ral-card-kicker">
            NEW MEMO
          </div>

          <input
            id="ralMemoTitle"
            placeholder="メモタイトル"
          >

          <input
            id="ralMemoSource"
            placeholder="出典 / Claude / ChatGPTなど"
          >

          <textarea
            id="ralMemoContent"
            placeholder="研究メモ、引き継ぎ文、仮説など..."
          ></textarea>


          <div class="ral-control-grid">

            <button
              id="ralSaveMemo"
              class="ral-primary"
            >
              保存
            </button>

            <button
              id="ralSendMemo"
              class="ral-secondary"
            >
              AI研究へ引き継ぐ
            </button>

          </div>

        </div>


        <div class="ral-card">

          <div class="ral-card-kicker">
            MY MEMOS
          </div>

          <div
            id="ralMemoList"
            class="ral-memo-list"
          >
            Loading...
          </div>

        </div>

      </div>

    `;

    loadMemos();

  }


  /* =========================================================
     ROUTES
     ========================================================= */

  function renderRoutesView() {

    const view =
      $("ralViewRoutes");

    if (!view) {
      return;
    }

    view.innerHTML = `

      <div class="ral-card">

        <div class="ral-card-kicker">
          RESEARCH ROUTES
        </div>

        <h2>
          Research Route Graph
        </h2>

        <div
          id="ralRoutesList"
          class="ral-routes-list"
        >
          Loading...
        </div>

      </div>

    `;

  }


  /* =========================================================
     3D LAB
     ========================================================= */

  function render3DLab() {

    const view =
      $("ralViewLab");

    if (!view) {
      return;
    }

    view.innerHTML = `

      <div class="ral-card ral-3d-card">

        <div class="ral-card-title-row">

          <div>
            <div class="ral-card-kicker">
              RESEARCH VISUALIZATION
            </div>

            <h2>
              3D Mathematical Lab
            </h2>

            <p class="ral-muted">
              研究ルート・仮説・結果を3D空間で可視化します。
            </p>
          </div>

          <div class="ral-3d-controls">

            <button
              id="ral3dRotate"
              class="ral-secondary"
            >
              ↻ AUTO
            </button>

            <button
              id="ral3dReset"
              class="ral-secondary"
            >
              RESET
            </button>

          </div>

        </div>


        <div
          id="ral3dCanvas"
          class="ral-3d-canvas"
        >

          <div class="ral-3d-orbit">

            <div class="ral-3d-core">
              RH
            </div>

            <div class="ral-node n1">
              WEIL
            </div>

            <div class="ral-node n2">
              HILBERT
            </div>

            <div class="ral-node n3">
              RANDOM MATRIX
            </div>

            <div class="ral-node n4">
              WAVELET
            </div>

          </div>

        </div>

      </div>

    `;

    setup3D();

  }


  /* =========================================================
     ANALYSIS
     ========================================================= */

  function renderAnalysis() {

    const view =
      $("ralViewAnalysis");

    if (!view) {
      return;
    }

    view.innerHTML = `

      <div class="ral-stat-grid">

        <div class="ral-stat-card">
          <span>TOTAL</span>
          <strong id="ralAnalysisTotal">
            -
          </strong>
        </div>

        <div class="ral-stat-card">
          <span>⭕️</span>
          <strong id="ralAnalysisPositive">
            -
          </strong>
        </div>

        <div class="ral-stat-card">
          <span>△</span>
          <strong id="ralAnalysisMaybe">
            -
          </strong>
        </div>

        <div class="ral-stat-card">
          <span>❌</span>
          <strong id="ralAnalysisNegative">
            -
          </strong>
        </div>

      </div>


      <div class="ral-card">

        <div class="ral-card-kicker">
          RESEARCH QUALITY
        </div>

        <div
          id="ralAnalysisText"
          class="ral-analysis-text"
        >
          Loading...
        </div>

      </div>

    `;

    updateAnalysisStats();

  }


  /* =========================================================
     EVENTS
     ========================================================= */

  function setupEnhancedEvents() {

    document.addEventListener(
      "click",
      event => {

        const nav =
          event.target.closest(
            "[data-ral-view]"
          );

        if (nav) {

          switchView(
            nav.dataset.ralView
          );

          return;

        }


        if (
          event.target.closest(
            "#ralStart"
          )
        ) {

          startEnhancedResearch();

          return;

        }


        if (
          event.target.closest(
            "#ralPause"
          )
        ) {

          requestPause();

          return;

        }


        if (
          event.target.closest(
            "#ralStop"
          )
        ) {

          requestStop();

          return;

        }


        if (
          event.target.closest(
            "#ralRefresh"
          )
        ) {

          loadEnhancedData();

          return;

        }


        if (
          event.target.closest(
            "#ralSaveMemo"
          )
        ) {

          saveMemo();

          return;

        }


        if (
          event.target.closest(
            "#ralSendMemo"
          )
        ) {

          sendMemoToResearch();

          return;

        }


        const deleteButton =
          event.target.closest(
            "[data-delete-memo]"
          );

        if (deleteButton) {

          deleteMemo(
            deleteButton.dataset.deleteMemo
          );

        }

      }
    );


    document.addEventListener(
      "input",
      event => {

        if (
          event.target.id ===
          "ralSearch"
        ) {

          loadHistory();

        }

      }
    );


    document.addEventListener(
      "change",
      event => {

        if (
          event.target.id ===
          "ralEvaluation"
        ) {

          loadHistory();

        }

      }
    );

  }


  /* =========================================================
     START RESEARCH
     ========================================================= */

  async function startEnhancedResearch() {

    const theme =
      $("ralTheme")?.value?.trim() ||
      "Riemann Hypothesis";

    const client =
      await safeClient();

    if (!client) {
      notify(
        "Supabase接続を確認してください。",
        true
      );
      return;
    }


    const existing =
      await getActiveJob(
        client
      );

    if (existing) {

      notify(
        "すでに研究ジョブがあります。",
        true
      );

      switchView(
        "live"
      );

      return;

    }


    const payload = {

      mode:
        "autonomous",

      theme,

      max_route_attempts:
        3,

      enable_literature_check:
        $("ralLiterature")?.checked ??
        true,

      enable_cross_domain_search:
        $("ralCrossDomain")?.checked ??
        true,

      enable_reductio_ad_absurdum:
        $("ralReductio")?.checked ??
        true,

      enable_counterexample_search:
        $("ralCounterexample")?.checked ??
        true,

      require_independent_verification:
        $("ralIndependent")?.checked ??
        true

    };


    const {
      data,
      error
    } =
      await client
        .from(
          "research_jobs"
        )
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
          "*"
        )
        .single();


    if (error) {

      notify(
        error.message,
        true
      );

      return;

    }


    selectedJob =
      data;


    notify(
      "研究ジョブをキューに追加しました。"
    );


    switchView(
      "live"
    );


    await loadEnhancedData();

  }


  /* =========================================================
     STOP
     ========================================================= */

  async function requestStop() {

    const client =
      await safeClient();

    if (!client) {
      return;
    }


    const job =
      await getActiveJob(
        client
      );

    if (!job) {

      notify(
        "停止できる研究はありません。",
        true
      );

      return;

    }


    const {
      error
    } =
      await client
        .from(
          "research_jobs"
        )
        .update({

          stop_requested:
            true,

          current_stage:
            "stop_requested"

        })
        .eq(
          "id",
          job.id
        )
        .eq(
          "project_id",
          PROJECT_ID
        );


    if (error) {

      notify(
        `停止要求に失敗: ${error.message}`,
        true
      );

      return;

    }


    notify(
      "検証停止を要求しました。現在の処理が安全に終了します。"
    );


    await loadEnhancedData();

  }


  /* =========================================================
     PAUSE
     ========================================================= */

  async function requestPause() {

    const client =
      await safeClient();

    if (!client) {
      return;
    }


    const job =
      await getActiveJob(
        client
      );

    if (!job) {

      notify(
        "一時停止できる研究がありません。",
        true
      );

      return;

    }


    const {
      error
    } =
      await client
        .from(
          "research_jobs"
        )
        .update({

          pause_requested:
            true,

          current_stage:
            "pause_requested"

        })
        .eq(
          "id",
          job.id
        );


    if (error) {

      notify(
        error.message,
        true
      );

      return;

    }


    notify(
      "一時停止を要求しました。"
    );

    await loadEnhancedData();

  }


  /* =========================================================
     ACTIVE JOB
     ========================================================= */

  async function getActiveJob(
    client
  ) {

    const {
      data,
      error
    } =
      await client
        .from(
          "research_jobs"
        )
        .select(
          "*"
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
        .limit(
          1
        );


    if (error) {

      console.error(
        error
      );

      return null;

    }


    return data?.[0] ||
      null;

  }


  /* =========================================================
     MEMOS
     ========================================================= */

  async function loadMemos() {

    const client =
      await safeClient();

    if (!client) {
      return;
    }


    const {
      data,
      error
    } =
      await client
        .from(
          "research_memos"
        )
        .select(
          "*"
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


    if (error) {

      setText(
        "ralMemoList",
        error.message
      );

      return;

    }


    const container =
      $("ralMemoList");

    if (!container) {
      return;
    }


    if (
      !data?.length
    ) {

      container.innerHTML =
        `<div class="ral-empty">
          メモはまだありません。
        </div>`;

      setText(
        "ralMemoCount",
        "0"
      );

      return;

    }


    container.innerHTML =
      data.map(
        memo => `

          <article class="ral-memo">

            <div>

              <div class="ral-memo-title">
                ${escapeHtml(
                  memo.title
                )}
              </div>

              <div class="ral-memo-source">
                ${escapeHtml(
                  memo.source
                )}
              </div>

            </div>

            <p>
              ${escapeHtml(
                truncate(
                  memo.content,
                  280
                )
              )}
            </p>

            <div class="ral-memo-actions">

              <button
                class="ral-secondary"
                data-open-memo="${memo.id}"
              >
                開く
              </button>

              <button
                class="ral-danger"
                data-delete-memo="${memo.id}"
              >
                削除
              </button>

            </div>

          </article>

        `
      ).join("");

    setText(
      "ralMemoCount",
      String(data.length)
    );

  }


  async function saveMemo() {

    const client =
      await safeClient();

    if (!client) {
      return;
    }


    const title =
      $("ralMemoTitle")
        ?.value
        ?.trim();

    const source =
      $("ralMemoSource")
        ?.value
        ?.trim() ||
      "manual";

    const content =
      $("ralMemoContent")
        ?.value
        ?.trim();


    if (!title) {

      notify(
        "メモタイトルを入力してください。",
        true
      );

      return;

    }


    if (!content) {

      notify(
        "メモ内容を入力してください。",
        true
      );

      return;

    }


    const {
      error
    } =
      await client
        .from(
          "research_memos"
        )
        .insert({

          project_id:
            PROJECT_ID,

          source,

          title,

          content

        });


    if (error) {

      notify(
        error.message,
        true
      );

      return;

    }


    $("ralMemoTitle").value =
      "";

    $("ralMemoSource").value =
      "";

    $("ralMemoContent").value =
      "";


    notify(
      "メモを保存しました。"
    );


    await loadMemos();

  }


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


    const client =
      await safeClient();

    if (!client) {
      return;
    }


    const {
      error
    } =
      await client
        .from(
          "research_memos"
        )
        .delete()
        .eq(
          "id",
          id
        )
        .eq(
          "project_id",
          PROJECT_ID
        );


    if (error) {

      notify(
        error.message,
        true
      );

      return;

    }


    notify(
      "メモを削除しました。"
    );


    await loadMemos();

  }


  /* =========================================================
     SEND MEMO TO AI
     ========================================================= */

  async function sendMemoToResearch() {

    const title =
      $("ralMemoTitle")
        ?.value
        ?.trim();

    const source =
      $("ralMemoSource")
        ?.value
        ?.trim() ||
      "manual";

    const content =
      $("ralMemoContent")
        ?.value
        ?.trim();


    if (!content) {

      notify(
        "AIへ引き継ぐ内容を入力してください。",
        true
      );

      return;

    }


    const client =
      await safeClient();

    if (!client) {
      return;
    }


    const active =
      await getActiveJob(
        client
      );


    if (active) {

      notify(
        "現在研究中です。現在の研究終了後に引き継ぐことを推奨します。",
        true
      );

      return;

    }


    const payload = {

      mode:
        "autonomous",

      theme:
        title ||
        "External Research Handover",

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
        true,

      external_handover: {

        source,

        title:
          title ||
          "External Research",

        content

      }

    };


    const {
      data,
      error
    } =
      await client
        .from(
          "research_jobs"
        )
        .insert({

          project_id:
            PROJECT_ID,

          job_type:
            "research_cycle",

          status:
            "queued",

          priority:
            20,

          payload

        })
        .select(
          "*"
        )
        .single();


    if (error) {

      notify(
        `AI引き継ぎに失敗: ${error.message}`,
        true
      );

      return;

    }


    selectedJob =
      data;


    notify(
      "外部研究をAI研究キューへ送信しました。"
    );


    switchView(
      "live"
    );

  }


  /* =========================================================
     HISTORY
     ========================================================= */

  async function loadHistory() {

    const client =
      await safeClient();

    if (!client) {
      return;
    }


    const search =
      $("ralSearch")
        ?.value
        ?.trim() ||
      "";

    const evaluation =
      $("ralEvaluation")
        ?.value ||
      "all";


    const {
      data,
      error
    } =
      await client
        .from(
          "research_results"
        )
        .select(
          [
            "id",
            "title",
            "hypothesis",
            "evaluation",
            "confidence_level",
            "created_at"
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
        .limit(
          100
        );


    if (error) {

      setHtml(
        "ralHistoryList",
        `<div class="ral-error">
          ${escapeHtml(
            error.message
          )}
        </div>`
      );

      return;

    }


    let results =
      data || [];


    if (search) {

      const q =
        search.toLowerCase();

      results =
        results.filter(
          item =>
            String(
              item.title || ""
            )
              .toLowerCase()
              .includes(q) ||
            String(
              item.hypothesis || ""
            )
              .toLowerCase()
              .includes(q)
        );

    }


    if (
      evaluation !==
      "all"
    ) {

      results =
        results.filter(
          item =>
            normalizeEvaluation(
              item.evaluation
            ) ===
            evaluation
        );

    }


    const container =
      $("ralHistoryList");

    if (!container) {
      return;
    }


    if (!results.length) {

      container.innerHTML =
        `<div class="ral-empty">
          該当する研究はありません。
        </div>`;

      return;

    }


    container.innerHTML =
      results.map(
        item => `

          <article
            class="ral-result"
          >

            <div>

              <span class="ral-evaluation">
                ${escapeHtml(
                  normalizeEvaluation(
                    item.evaluation
                  )
                )}
              </span>

              <strong>
                ${escapeHtml(
                  item.title
                )}
              </strong>

            </div>

            <p>
              ${escapeHtml(
                truncate(
                  item.hypothesis,
                  220
                )
              )}
            </p>

            <small>
              confidence:
              ${Number(
                item.confidence_level ||
                0
              )}/5
              ·
              ${escapeHtml(
                formatDate(
                  item.created_at
                )
              )}
            </small>

          </article>

        `
      ).join("");

  }


  /* =========================================================
     ROUTES
     ========================================================= */

  async function loadRoutes() {

    const client =
      await safeClient();

    if (!client) {
      return;
    }


    const {
      data,
      error
    } =
      await client
        .from(
          "research_routes"
        )
        .select(
          "*"
        )
        .eq(
          "project_id",
          PROJECT_ID
        )
        .order(
          "updated_at",
          {
            ascending: false
          }
        );


    if (error) {

      setHtml(
        "ralRoutesList",
        `<div class="ral-error">
          ${escapeHtml(
            error.message
          )}
        </div>`
      );

      return;

    }


    const container =
      $("ralRoutesList");

    if (!container) {
      return;
    }


    if (!data?.length) {

      container.innerHTML =
        `<div class="ral-empty">
          まだ研究ルートが記録されていません。
        </div>`;

      return;

    }


    container.innerHTML =
      data.map(
        route => {

          const blocked =
            Number(
              route.attempt_count
            ) >= 3;

          return `

            <article class="ral-route">

              <div>

                <strong>
                  ${escapeHtml(
                    route.route_label ||
                    route.route_key
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    route.route_key
                  )}
                </small>

              </div>

              <span
                class="ral-route-count ${
                  blocked
                    ? "blocked"
                    : ""
                }"
              >
                ${Number(
                  route.attempt_count ||
                  0
                )}/3
              </span>

            </article>

          `;

        }
      ).join("");

  }


  /* =========================================================
     LIVE EVENTS
     ========================================================= */

  function startLivePolling() {

    if (
      liveTimer
    ) {
      clearInterval(
        liveTimer
      );
    }


    loadLiveData();


    liveTimer =
      setInterval(
        loadLiveData,
        4000
      );

  }


  async function loadLiveData() {

    const client =
      await safeClient();

    if (!client) {
      return;
    }


    const job =
      await getActiveJob(
        client
      );


    selectedJob =
      job;


    renderJobState(
      job
    );


    if (!job) {
      return;
    }


    const {
      data,
      error
    } =
      await client
        .from(
          "research_events"
        )
        .select(
          "*"
        )
        .eq(
          "job_id",
          job.id
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(
          100
        );


    if (error) {

      console.error(
        error
      );

      return;

    }


    renderEvents(
      data || []
    );

  }


  function renderEvents(
    events
  ) {

    const container =
      $("ralEvents");

    if (!container) {
      return;
    }


    if (!events.length) {

      container.innerHTML =
        `<div class="ral-empty">
          AI研究イベントを待機中...
        </div>`;

      return;

    }


    const latest =
      events[0];


    if (
      latest.code
    ) {

      setText(
        "ralLiveCode",
        latest.code
      );

    }


    if (
      latest.output
    ) {

      setText(
        "ralStatusText",
        latest.output
      );

    }


    container.innerHTML =
      events.map(
        event => `

          <div
            class="ral-event"
          >

            <time>
              ${escapeHtml(
                formatDate(
                  event.created_at
                )
              )}
            </time>

            <span>
              ${escapeHtml(
                event.event_type
              )}
            </span>

            <strong>
              ${escapeHtml(
                event.message ||
                ""
              )}
            </strong>

          </div>

        `
      ).join("");

  }


  function renderJobState(
    job
  ) {

    const stateText =
      job
        ? String(
            job.status
          ).toUpperCase()
        : "IDLE";


    setText(
      "ralJobState",
      stateText
    );

    setText(
      "ralBigStatus",
      stateText
    );


    if (!job) {

      setText(
        "ralCurrentJob",
        "No active research."
      );

      return;

    }


    setHtml(
      "ralCurrentJob",
      `

        <div class="ral-job-id">
          JOB
          ${escapeHtml(
            job.id
          )}
        </div>

        <div class="ral-progress">

          <div
            class="ral-progress-bar"
            style="width:${Math.max(
              0,
              Math.min(
                100,
                Number(
                  job.progress ||
                  0
                )
              )
            )}%"
          ></div>

        </div>

        <div class="ral-job-stage">

          <span>
            STAGE
          </span>

          <strong>
            ${escapeHtml(
              job.current_stage ||
              job.status
            )}
          </strong>

        </div>

      `
    );

    setText(
      "ralResearchJob",
      JSON.stringify(
        job,
        null,
        2
      )
    );

  }


  /* =========================================================
     LOAD ENHANCED DATA
     ========================================================= */

  async function loadEnhancedData() {

    renderResearchView();

    renderLiveView();

    renderMemoryView();

    renderHistoryView();

    renderMemosView();

    renderRoutesView();

    render3DLab();

    renderAnalysis();


    const client =
      await safeClient();

    if (!client) {
      return;
    }


    const job =
      await getActiveJob(
        client
      );


    renderJobState(
      job
    );


    await updateStatistics(
      client
    );

  }


  async function updateStatistics(
    client
  ) {

    const total =
      await client
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


    const positive =
      await client
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
        )
        .eq(
          "evaluation",
          "⭕️"
        );


    setText(
      "ralTotal",
      String(
        total.count ??
        0
      )
    );

    setText(
      "ralPositive",
      String(
        positive.count ??
        0
      )
    );

  }


  async function updateAnalysisStats() {

    const client =
      await safeClient();

    if (!client) {
      return;
    }


    const {
      data
    } =
      await client
        .from(
          "research_results"
        )
        .select(
          "evaluation"
        )
        .eq(
          "project_id",
          PROJECT_ID
        );


    const results =
      data || [];


    let positive =
      0;

    let maybe =
      0;

    let negative =
      0;


    results.forEach(
      item => {

        const e =
          normalizeEvaluation(
            item.evaluation
          );

        if (
          e ===
          "⭕️"
        ) {
          positive++;
        } else if (
          e ===
          "❌"
        ) {
          negative++;
        } else {
          maybe++;
        }

      }
    );


    setText(
      "ralAnalysisTotal",
      String(
        results.length
      )
    );

    setText(
      "ralAnalysisPositive",
      String(
        positive
      )
    );

    setText(
      "ralAnalysisMaybe",
      String(
        maybe
      )
    );

    setText(
      "ralAnalysisNegative",
      String(
        negative
      )
    );


    const text =
      results.length
        ? `
          全研究 ${results.length} 件。
          ⭕️ ${positive} 件、
          △ ${maybe} 件、
          ❌ ${negative} 件。
        `
        : "まだ研究結果がありません。";


    setText(
      "ralAnalysisText",
      text
    );

  }


  /* =========================================================
     3D
     ========================================================= */

  function setup3D() {

    const canvas =
      $("ral3dCanvas");

    if (!canvas) {
      return;
    }


    const orbit =
      canvas.querySelector(
        ".ral-3d-orbit"
      );

    let rotating =
      false;

    let angle =
      0;

    let timer =
      null;


    $("ral3dRotate")
      ?.addEventListener(
        "click",
        () => {

          rotating =
            !rotating;

          if (
            rotating
          ) {

            timer =
              setInterval(
                () => {

                  angle +=
                    0.5;

                  orbit.style.transform =
                    `rotateX(8deg) rotateY(${angle}deg)`;

                },
                30
              );

          } else {

            clearInterval(
              timer
            );

          }

        }
      );


    $("ral3dReset")
      ?.addEventListener(
        "click",
        () => {

          angle =
            0;

          orbit.style.transform =
            "rotateX(8deg) rotateY(0deg)";

        }
      );

  }


  /* =========================================================
     HELPERS
     ========================================================= */

  async function safeClient() {

    try {

      return await getClient();

    } catch (
      error
    ) {

      console.error(
        error
      );

      return null;

    }

  }


  function normalizeEvaluation(
    value
  ) {

    const text =
      String(
        value ||
        "△"
      );


    if (
      text.includes(
        "⭕️"
      ) ||
      text.includes(
        "⭕"
      )
    ) {
      return "⭕️";
    }


    if (
      text.includes(
        "❌"
      )
    ) {
      return "❌";
    }


    return "△";

  }


  function capitalize(
    value
  ) {

    return (
      value.charAt(0)
        .toUpperCase() +
      value.slice(1)
    );

  }


  function truncate(
    value,
    length
  ) {

    const text =
      String(
        value ||
        ""
      );

    return text.length >
      length
      ? text.slice(
          0,
          length
        ) +
        "..."
      : text;

  }


  function formatDate(
    value
  ) {

    if (!value) {
      return "-";
    }

    return new Date(
      value
    ).toLocaleString(
      "ja-JP"
    );

  }


  function setText(
    id,
    text
  ) {

    const element =
      $(id);

    if (element) {
      element.textContent =
        text;
    }

  }


  function setHtml(
    id,
    html
  ) {

    const element =
      $(id);

    if (element) {
      element.innerHTML =
        html;
    }

  }


  function notify(
    message,
    error = false
  ) {

    let box =
      $("ralToast");

    if (!box) {

      box =
        document.createElement(
          "div"
        );

      box.id =
        "ralToast";

      document.body.appendChild(
        box
      );

    }


    box.textContent =
      message;

    box.className =
      error
        ? "ral-toast error"
        : "ral-toast";


    clearTimeout(
      box._timer
    );


    box._timer =
      setTimeout(
        () => {

          box.classList.add(
            "hide"
          );

        },
        4500
      );

  }

})();
