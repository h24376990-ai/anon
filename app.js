// ============================================================
// Research AI Lab
// Research Job Registration
// ============================================================

async function createResearchJob({
  message,
  theme = null,
  projectId = null,
  mode = "autonomous_research",
  physicsEnabled = false,
  priority = 0
}) {
  try {
    const researchMessage =
      String(message ?? "").trim();

    const researchTheme =
      String(theme ?? "").trim() ||
      researchMessage;

    if (!researchMessage && !researchTheme) {
      throw new Error(
        "研究内容または研究テーマを入力してください。"
      );
    }

    if (!window.supabase) {
      throw new Error(
        "Supabaseが初期化されていません。"
      );
    }

    // --------------------------------------------------------
    // research_jobs に保存
    // --------------------------------------------------------

    const payload = {
      message: researchMessage || null,

      theme: researchTheme || null,

      project_id:
        projectId ||
        window.DEFAULT_PROJECT_ID ||
        null,

      status: "queued",

      priority:
        Number.isFinite(Number(priority))
          ? Number(priority)
          : 0,

      mode: mode || "autonomous_research",

      physics_enabled:
        Boolean(physicsEnabled),

      created_at:
        new Date().toISOString()
    };

    console.log(
      "[Research AI Lab] Creating research job:",
      payload
    );

    const {
      data,
      error
    } = await window.supabase
      .from("research_jobs")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error(
        "[Research AI Lab] Job registration failed:",
        error
      );

      throw error;
    }

    if (!data) {
      throw new Error(
        "研究ジョブの登録結果を取得できませんでした。"
      );
    }

    console.log(
      "[Research AI Lab] Research job registered:",
      data
    );

    return {
      ok: true,
      job: data
    };

  } catch (error) {

    console.error(
      "[Research AI Lab] createResearchJob error:",
      error
    );

    return {
      ok: false,

      error:
        error instanceof Error
          ? error.message
          : String(error)
    };
  }
}
