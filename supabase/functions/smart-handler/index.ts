// ============================================================
// Research AI Lab
// supabase/functions/smart-handler/index.ts
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const OPENROUTER_API_KEY =
  Deno.env.get("OPENROUTER_API_KEY") ?? "";

const OPENROUTER_MODEL =
  Deno.env.get("OPENROUTER_MODEL") ??
  "openai/gpt-4o-mini";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS"
};

// ------------------------------------------------------------
// Utilities
// ------------------------------------------------------------

function json(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json"
      }
    }
  );
}

function safeJson(value: unknown) {
  if (
    value &&
    typeof value === "object"
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    try {
      return JSON.parse(value);
    } catch {
      return {
        text: value
      };
    }
  }

  return {};
}

// ------------------------------------------------------------
// Research prompt
// ------------------------------------------------------------

function buildResearchPrompt(
  job: any
) {
  const payload =
    safeJson(job.payload);

  const theme =
    payload.theme ||
    "数学の未解決問題";

  const context =
    payload.context ||
    {};

  const rules =
    payload.research_rules ||
    {};

  return `
あなたは Research AI Lab の数学研究AIです。

重要：
「未解決問題なので回答できません」
「証明されていないので回答できません」
だけで研究を終了してはいけません。

未解決問題だからこそ、
仮説を立て、
試行し、
壊し、
反例を探し、
別の方向へ派生させ、
可能性を評価してください。

ただし、
証明されていないものを
「証明した」と断定してはいけません。

==================================================
研究テーマ
==================================================

${theme}

==================================================
研究コンテキスト
==================================================

${JSON.stringify(
  context,
  null,
  2
)}

==================================================
研究ルール
==================================================

${JSON.stringify(
  rules,
  null,
  2
)}

==================================================
最低限試す研究アプローチ
==================================================

1. 直接的アプローチ
2. 逆向き推論
3. 背理法
4. 反例探索
5. 特殊ケースへの分解
6. 一般化
7. 別表現への変換
8. 帰納的アプローチ
9. 演繹的アプローチ
10. 構造・対称性の探索
11. 既存定理との接続
12. 別分野との類似性
13. 計算・数値的実験
14. 現在の仮説を意図的に破壊する
15. 失敗原因を抽出して別ルートへ派生する

==================================================
特に重要
==================================================

現在の仮説が成立しそうでも、
必ずそれを壊す方向の検証を行ってください。

「本当に常に成立するのか？」
「反例はないか？」
「隠れた仮定はないか？」
「特殊ケースだけ成立していないか？」
を確認してください。

一つの方法が失敗しても研究終了ではありません。

別の仮説・別の表現・別の証明方針へ
研究を派生させてください。

==================================================
出力形式
==================================================

JSONのみを返してください。

{
  "title": "研究タイトル",
  "hypothesis": "今回の中心仮説",
  "evaluation": "⭕ または △ または ❌",
  "confidence_level": 0,
  "status": "completed",
  "summary": "研究結果の要約",
  "approaches": [
    {
      "name": "アプローチ名",
      "idea": "何を試したか",
      "result": "何が分かったか",
      "evaluation": "⭕ または △ または ❌"
    }
  ],
  "attempts": [
    {
      "step": 1,
      "description": "試行内容",
      "result": "結果"
    }
  ],
  "counterexamples": [],
  "failed_reasons": [],
  "new_hypotheses": [],
  "next_routes": [],
  "verification": {
    "independent_check": false,
    "proof_completed": false,
    "needs_more_research": true
  }
}

==================================================
評価基準
==================================================

⭕ は「完全証明」だけに限定しない。

以下のような場合も、
数学的に意味のある前進なら ⭕ としてよい。

・有力な補題が得られた
・新しい構造が発見された
・明確な必要条件が得られた
・既存ルートより有望な方法を発見した
・反例探索によって重要な条件を発見した
・複数の検証で同じ性質が確認された

ただし、

「証明された」
と
「有望な研究結果」
は絶対に区別してください。
`;
}

// ------------------------------------------------------------
// OpenRouter
// ------------------------------------------------------------

async function callAI(
  prompt: string
) {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured"
    );
  }

  const response =
    await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization":
            `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type":
            "application/json",
          "HTTP-Referer":
            SUPABASE_URL,
          "X-Title":
            "Research AI Lab"
        },
        body: JSON.stringify({
          model:
            OPENROUTER_MODEL,

          temperature:
            0.7,

          messages: [
            {
              role: "system",
              content:
                "You are a rigorous mathematical research assistant."
            },
            {
              role: "user",
              content: prompt
            }
          ]
        })
      }
    );

  const raw =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `OpenRouter ${response.status}: ${raw}`
    );
  }

  let data: any;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      "OpenRouter returned invalid JSON"
    );
  }

  const text =
    data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(
      "OpenRouter returned no message"
    );
  }

  return text;
}

// ------------------------------------------------------------
// Extract JSON from AI response
// ------------------------------------------------------------

function extractJSON(
  text: string
) {
  const cleaned =
    text
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start =
      cleaned.indexOf("{");

    const end =
      cleaned.lastIndexOf("}");

    if (
      start !== -1 &&
      end !== -1 &&
      end > start
    ) {
      try {
        return JSON.parse(
          cleaned.slice(
            start,
            end + 1
          )
        );
      } catch {
        // continue
      }
    }
  }

  return {
    title:
      "AI研究結果",
    hypothesis:
      "",
    evaluation:
      "△",
    confidence_level:
      1,
    status:
      "completed",
    summary:
      text,
    approaches: [],
    attempts: [],
    counterexamples: [],
    failed_reasons: [],
    new_hypotheses: [],
    next_routes: [],
    verification: {
      independent_check:
        false,
      proof_completed:
        false,
      needs_more_research:
        true
    }
  };
}

// ------------------------------------------------------------
// Claim result
// ------------------------------------------------------------

function normalizeEvaluation(
  value: unknown
) {
  if (
    value === "⭕" ||
    value === "⭕️"
  ) {
    return "⭕";
  }

  if (value === "❌") {
    return "❌";
  }

  return "△";
}

// ------------------------------------------------------------
// Process one job
// ------------------------------------------------------------

async function processJob(
  job: any
) {
  console.log(
    "Processing job:",
    job.id
  );

  // ------------------------------------------
  // Lock job
  // ------------------------------------------

  const {
    data: locked,
    error: lockError
  } =
    await supabase
      .from(
        "research_jobs"
      )
      .update({
        status:
          "running",
        started_at:
          new Date().toISOString(),
        error_message:
          null
      })
      .eq(
        "id",
        job.id
      )
      .eq(
        "status",
        "queued"
      )
      .select()
      .maybeSingle();

  if (lockError) {
    throw lockError;
  }

  if (!locked) {
    return {
      skipped:
        true,
      reason:
        "Job was already claimed"
    };
  }

  try {
    // ----------------------------------------
    // AI research
    // ----------------------------------------

    const prompt =
      buildResearchPrompt(
        job
      );

    const aiText =
      await callAI(
        prompt
      );

    const research =
      extractJSON(
        aiText
      );

    const evaluation =
      normalizeEvaluation(
        research.evaluation
      );

    const confidence =
      Math.max(
        0,
        Math.min(
          5,
          Number(
            research.confidence_level ??
            1
          )
        )
      );

    // ----------------------------------------
    // Save research result
    // ----------------------------------------

    const payload =
      safeJson(
        job.payload
      );

    const {
      data: result,
      error:
        resultError
    } =
      await supabase
        .from(
          "research_results"
        )
        .insert({
          project_id:
            job.project_id,

          title:
            research.title ||
            "AI研究結果",

          hypothesis:
            research.hypothesis ||
            payload.theme ||
            "",

          content: {
            summary:
              research.summary ||
              "",

            approaches:
              research.approaches ||
              [],

            attempts:
              research.attempts ||
              [],

            counterexamples:
              research.counterexamples ||
              [],

            failed_reasons:
              research.failed_reasons ||
              [],

            new_hypotheses:
              research.new_hypotheses ||
              [],

            next_routes:
              research.next_routes ||
              [],

            verification:
              research.verification ||
              {},

            ai_raw:
              aiText
          },

          status:
            "completed",

          evaluation,

          confidence_level:
            confidence,

          is_human_saved:
            false
        })
        .select()
        .single();

    if (resultError) {
      throw resultError;
    }

    // ----------------------------------------
    // Finish job
    // ----------------------------------------

    const {
      error:
        finishError
    } =
      await supabase
        .from(
          "research_jobs"
        )
        .update({
          status:
            "completed",

          result: {
            research_result_id:
              result.id,

            evaluation,

            confidence_level:
              confidence,

            summary:
              research.summary ||
              ""
          },

          finished_at:
            new Date().toISOString(),

          error_message:
            null
        })
        .eq(
          "id",
          job.id
        );

    if (finishError) {
      throw finishError;
    }

    return {
      success:
        true,

      job_id:
        job.id,

      result_id:
        result.id
    };

  } catch (error) {

    console.error(
      "Job failed:",
      error
    );

    await supabase
      .from(
        "research_jobs"
      )
      .update({
        status:
          "failed",

        finished_at:
          new Date().toISOString(),

        error_message:
          error instanceof Error
            ? error.message
            : String(error)
      })
      .eq(
        "id",
        job.id
      );

    throw error;
  }
}

// ------------------------------------------------------------
// Find queued job
// ------------------------------------------------------------

async function findQueuedJob(
  projectId?: string
) {
  let query =
    supabase
      .from(
        "research_jobs"
      )
      .select("*")
      .eq(
        "status",
        "queued"
      )
      .order(
        "priority",
        {
          ascending:
            false
        }
      )
      .order(
        "created_at",
        {
          ascending:
            true
        }
      )
      .limit(1);

  if (projectId) {
    query =
      query.eq(
        "project_id",
        projectId
      );
  }

  const {
    data,
    error
  } =
    await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// ------------------------------------------------------------
// HTTP
// ------------------------------------------------------------

Deno.serve(
  async (req) => {

    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders
        }
      );
    }

    if (
      req.method !==
      "POST"
    ) {
      return json(
        {
          ok: false,
          error:
            "POST only"
        },
        405
      );
    }

    try {

      const body =
        await req
          .json()
          .catch(
            () => ({})
          );

      const projectId =
        body?.project_id ||
        null;

      const jobId =
        body?.job_id ||
        null;

      // --------------------------------------
      // Specific job
      // --------------------------------------

      if (jobId) {

        const {
          data: job,
          error
        } =
          await supabase
            .from(
              "research_jobs"
            )
            .select("*")
            .eq(
              "id",
              jobId
            )
            .maybeSingle();

        if (error) {
          throw error;
        }

        if (!job) {
          return json(
            {
              ok: false,
              error:
                "Job not found"
            },
            404
          );
        }

        const result =
          await processJob(
            job
          );

        return json({
          ok: true,
          ...result
        });
      }

      // --------------------------------------
      // Otherwise find queued job
      // --------------------------------------

      const job =
        await findQueuedJob(
          projectId
        );

      if (!job) {
        return json({
          ok: true,
          processed:
            false,
          message:
            "No queued jobs"
        });
      }

      const result =
        await processJob(
          job
        );

      return json({
        ok: true,
        processed:
          true,
        ...result
      });

    } catch (error) {

      console.error(
        "smart-handler error:",
        error
      );

      return json(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : String(error)
        },
        500
      );
    }
  }
);
