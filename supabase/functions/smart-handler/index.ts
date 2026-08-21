import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Content-Type":
    "application/json; charset=utf-8",
};

/* =========================================================
   CONFIG
========================================================= */

const MAX_OUTPUT_TOKENS = 7000;
const MAX_HISTORY = 40;
const MAX_HISTORY_CHARS = 30000;
const ROUTE_BLOCK_LIMIT = 3;

const DEFAULT_PROJECT_ID =
  "ab429192-27d2-47e4-9ad7-08b639f45120";

/*
 * 各プロバイダーは上から順番に試す。
 *
 * Gemini
 * ↓
 * Cerebras
 * ↓
 * Groq
 * ↓
 * OpenRouter
 *
 * 1つが失敗しても研究全体を停止しない。
 */

const GEMINI_MODEL =
  "gemini-3.6-flash";

const CEREBRAS_MODEL =
  "gpt-oss-120b";

const GROQ_MODEL =
  "openai/gpt-oss-120b";

const OPENROUTER_MODEL =
  "openai/gpt-4o-mini";


/* =========================================================
   HELPERS
========================================================= */

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: corsHeaders,
    },
  );
}


function cleanText(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);
}


function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(
    min,
    Math.min(max, value),
  );
}


/* =========================================================
   JSON EXTRACTION
========================================================= */

function extractJson(
  text: string,
): Record<string, unknown> | null {

  if (!text) {
    return null;
  }

  let value =
    text.trim();

  value =
    value
      .replace(
        /^```json\s*/i,
        "",
      )
      .replace(
        /^```\s*/i,
        "",
      )
      .replace(
        /\s*```$/i,
        "",
      )
      .trim();


  try {

    const parsed =
      JSON.parse(value);

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed;
    }

  } catch {
    /* continue */
  }


  /*
   * JSON部分だけ抜き出す。
   */

  const first =
    value.indexOf("{");

  const last =
    value.lastIndexOf("}");


  if (
    first !== -1 &&
    last !== -1 &&
    last > first
  ) {

    const candidate =
      value.slice(
        first,
        last + 1,
      );


    try {

      const parsed =
        JSON.parse(candidate);

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed;
      }

    } catch {
      /* continue */
    }
  }


  return null;
}


/* =========================================================
   AI TEXT EXTRACTION
========================================================= */

function getOpenAICompatibleText(
  data: any,
): string {

  return cleanText(
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    "",
  );
}


function getGeminiText(
  data: any,
): string {

  const parts =
    data?.candidates?.[0]?.content?.parts;

  if (
    Array.isArray(parts)
  ) {

    return parts
      .map(
        (part: any) =>
          cleanText(
            part?.text,
          ),
      )
      .join("");
  }

  return "";
}


/* =========================================================
   ERROR
========================================================= */

function errorText(
  value: unknown,
): string {

  if (
    value instanceof Error
  ) {
    return value.message;
  }

  return String(value);
}


/* =========================================================
   SAFE FETCH
========================================================= */

async function fetchJson(
  url: string,
  options: RequestInit,
  provider: string,
) {

  const response =
    await fetch(
      url,
      options,
    );

  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `${provider} HTTP ${response.status}: ${text}`,
    );
  }


  let data: any;

  try {

    data =
      JSON.parse(text);

  } catch {

    throw new Error(
      `${provider} returned invalid JSON.`,
    );
  }


  return data;
}


/* =========================================================
   GEMINI
========================================================= */

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
) {

  const model =
    Deno.env.get(
      "GEMINI_MODEL",
    ) ||
    GEMINI_MODEL;


  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;


  const data =
    await fetchJson(
      url,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-goog-api-key":
            apiKey,
        },

        body:
          JSON.stringify({

            systemInstruction: {
              parts: [
                {
                  text:
                    systemPrompt,
                },
              ],
            },

            contents: [
              {
                role:
                  "user",

                parts: [
                  {
                    text:
                      userPrompt,
                  },
                ],
              },
            ],

            generationConfig: {

              maxOutputTokens:
                MAX_OUTPUT_TOKENS,

              temperature:
                0.2,

              responseMimeType:
                "application/json",

            },

          }),
      },
      "Gemini",
    );


  const text =
    getGeminiText(
      data,
    );


  if (!text) {

    throw new Error(
      "Gemini returned an empty answer.",
    );
  }


  return {
    provider:
      "gemini",

    model,

    text,

    raw:
      data,
  };
}


/* =========================================================
   OPENAI-COMPATIBLE PROVIDER
========================================================= */

async function callOpenAICompatible(
  provider: string,
  apiKey: string,
  url: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
) {

  const data =
    await fetchJson(
      url,
      {
        method:
          "POST",

        headers: {

          "Authorization":
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json",

        },

        body:
          JSON.stringify({

            model,

            messages: [

              {
                role:
                  "system",

                content:
                  systemPrompt,
              },

              {
                role:
                  "user",

                content:
                  userPrompt,
              },

            ],

            max_completion_tokens:
              MAX_OUTPUT_TOKENS,

            temperature:
              0.2,

            response_format: {
              type:
                "json_object",
            },

          }),
      },
      provider,
    );


  const text =
    getOpenAICompatibleText(
      data,
    );


  if (!text) {

    throw new Error(
      `${provider} returned an empty answer.`,
    );
  }


  return {
    provider:
      provider.toLowerCase(),

    model,

    text,

    raw:
      data,
  };
}


/* =========================================================
   CEREBRAS
========================================================= */

async function callCerebras(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
) {

  const model =
    Deno.env.get(
      "CEREBRAS_MODEL",
    ) ||
    CEREBRAS_MODEL;


  return callOpenAICompatible(

    "Cerebras",

    apiKey,

    "https://api.cerebras.ai/v1/chat/completions",

    model,

    systemPrompt,

    userPrompt,

  );
}


/* =========================================================
   GROQ
========================================================= */

async function callGroq(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
) {

  const model =
    Deno.env.get(
      "GROQ_MODEL",
    ) ||
    GROQ_MODEL;


  return callOpenAICompatible(

    "Groq",

    apiKey,

    "https://api.groq.com/openai/v1/chat/completions",

    model,

    systemPrompt,

    userPrompt,

  );
}


/* =========================================================
   OPENROUTER
========================================================= */

async function callOpenRouter(
  apiKey: string,
  supabaseUrl: string,
  systemPrompt: string,
  userPrompt: string,
) {

  const model =
    Deno.env.get(
      "OPENROUTER_MODEL",
    ) ||
    OPENROUTER_MODEL;


  const response =
    await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {

        method:
          "POST",

        headers: {

          "Authorization":
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json",

          "HTTP-Referer":
            supabaseUrl,

          "X-Title":
            "Research AI Lab",

        },

        body:
          JSON.stringify({

            model,

            messages: [

              {
                role:
                  "system",

                content:
                  systemPrompt,
              },

              {
                role:
                  "user",

                content:
                  userPrompt,
              },

            ],

            max_tokens:
              MAX_OUTPUT_TOKENS,

            temperature:
              0.2,

            response_format: {
              type:
                "json_object",
            },

          }),

      },
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `OpenRouter HTTP ${response.status}: ${text}`,
    );
  }


  let data: any;

  try {

    data =
      JSON.parse(text);

  } catch {

    throw new Error(
      "OpenRouter returned invalid JSON.",
    );
  }


  const aiText =
    getOpenAICompatibleText(
      data,
    );


  if (!aiText) {

    throw new Error(
      "OpenRouter returned an empty answer.",
    );
  }


  return {

    provider:
      "openrouter",

    model,

    text:
      aiText,

    raw:
      data,

  };
}


/* =========================================================
   MULTI PROVIDER
========================================================= */

async function callAI(
  keys: {
    gemini?: string;
    cerebras?: string;
    groq?: string;
    openrouter?: string;
  },
  supabaseUrl: string,
  systemPrompt: string,
  userPrompt: string,
) {

  const attempts: any[] = [];


  /*
   * 1. Gemini
   */

  if (keys.gemini) {

    try {

      const result =
        await callGemini(
          keys.gemini,
          systemPrompt,
          userPrompt,
        );

      return {
        ...result,

        attempts,

      };

    } catch (error) {

      attempts.push({

        provider:
          "gemini",

        error:
          errorText(error),

      });

    }
  }


  /*
   * 2. Cerebras
   */

  if (keys.cerebras) {

    try {

      const result =
        await callCerebras(
          keys.cerebras,
          systemPrompt,
          userPrompt,
        );

      return {
        ...result,

        attempts,

      };

    } catch (error) {

      attempts.push({

        provider:
          "cerebras",

        error:
          errorText(error),

      });

    }
  }


  /*
   * 3. Groq
   */

  if (keys.groq) {

    try {

      const result =
        await callGroq(
          keys.groq,
          systemPrompt,
          userPrompt,
        );

      return {
        ...result,

        attempts,

      };

    } catch (error) {

      attempts.push({

        provider:
          "groq",

        error:
          errorText(error),

      });

    }
  }


  /*
   * 4. OpenRouter
   */

  if (keys.openrouter) {

    try {

      const result =
        await callOpenRouter(
          keys.openrouter,
          supabaseUrl,
          systemPrompt,
          userPrompt,
        );

      return {
        ...result,

        attempts,

      };

    } catch (error) {

      attempts.push({

        provider:
          "openrouter",

        error:
          errorText(error),

      });

    }
  }


  throw new Error(
    `すべてのAIプロバイダーで研究実行に失敗しました: ${JSON.stringify(attempts)}`,
  );
}


/* =========================================================
   MAIN
========================================================= */

Deno.serve(
  async (
    req: Request,
  ) => {

    /*
     * CORS
     */

    if (
      req.method ===
      "OPTIONS"
    ) {

      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }


    try {

      /* =====================================================
         ENVIRONMENT
      ===================================================== */

      const supabaseUrl =
        Deno.env.get(
          "SUPABASE_URL",
        );


      const serviceRoleKey =
        Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY",
        );


      const geminiKey =
        Deno.env.get(
          "GEMINI_API_KEY",
        );


      const cerebrasKey =
        Deno.env.get(
          "CEREBRAS_API_KEY",
        );


      const groqKey =
        Deno.env.get(
          "GROQ_API_KEY",
        );


      const openRouterKey =
        Deno.env.get(
          "OPENROUTER_API_KEY",
        );


      if (!supabaseUrl) {

        throw new Error(
          "SUPABASE_URL secret/environment variable is missing.",
        );
      }


      if (!serviceRoleKey) {

        throw new Error(
          "SUPABASE_SERVICE_ROLE_KEY secret/environment variable is missing.",
        );
      }


      if (
        !geminiKey &&
        !cerebrasKey &&
        !groqKey &&
        !openRouterKey
      ) {

        throw new Error(
          "No AI provider API keys are configured.",
        );
      }


      /* =====================================================
         SUPABASE
      ===================================================== */

      const supabase =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              autoRefreshToken:
                false,

              persistSession:
                false,
            },
          },
        );


      /* =====================================================
         REQUEST
      ===================================================== */

      let body: any = {};

      try {

        body =
          await req.json();

      } catch {

        body = {};

      }


      const message =
        cleanText(
          body?.message ??
          body?.theme ??
          body?.payload?.theme,
        ).trim();


      const projectId =
        cleanText(
          body?.project_id ??
          body?.payload?.project_id ??
          DEFAULT_PROJECT_ID,
        ).trim();


      /*
       * 研究ジョブから送られる可能性のある情報
       */

      const payload =
        body?.payload &&
        typeof body.payload === "object"
          ? body.payload
          : {};


      const researchRules =
        payload?.research_rules ??
        body?.research_rules ??
        {};


      const parentResultId =
        cleanText(
          payload?.parent_result_id ??
          body?.parent_result_id,
        ).trim();


      const physicsEnabled =
        Boolean(
          payload?.physics_enabled ??
          body?.physics_enabled ??
          payload?.physical_reasoning ??
          body?.physical_reasoning ??
          false,
        );


      if (!message) {

        return jsonResponse(
          {
            ok:
              false,

            error:
              "message or theme is required.",
          },
          400,
        );
      }


      /* =====================================================
         LOAD ALL USEFUL RESEARCH MEMORY
      ===================================================== */

      const {
        data:
          previousResults,
        error:
          previousError,
      } =
        await supabase
          .from(
            "research_results",
          )
          .select(
            "id,title,description,status,hypothesis,calculation,verification,next_action,evidence,created_at",
          )
          .eq(
            "project_id",
            projectId,
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          )
          .limit(
            MAX_HISTORY,
          );


      if (previousError) {

        throw new Error(
          `Failed to load research history: ${previousError.message}`,
        );
      }


      const history =
        previousResults ??
        [];


      /* =====================================================
         ROUTE KEY
      ===================================================== */

      const encoder =
        new TextEncoder();


      const hashBuffer =
        await crypto.subtle.digest(
          "SHA-256",
          encoder.encode(
            `${projectId}:${message}`,
          ),
        );


      const routeKey =
        Array.from(
          new Uint8Array(
            hashBuffer,
          ),
        )
          .map(
            (b) =>
              b
                .toString(16)
                .padStart(
                  2,
                  "0",
                ),
          )
          .join("");


      /* =====================================================
         ROUTE REUSE CHECK
      ===================================================== */

      const sameRouteCount =
        history.filter(
          (item: any) =>
            cleanText(
              item?.evidence?.route_key,
            ) === routeKey,
        ).length;


      /*
       * 3回以上なら同じルートを禁止。
       *
       * ただし「研究テーマそのもの」を
       * 禁止するわけではない。
       *
       * AIには別アプローチを強制する。
       */

      const routeBlocked =
        sameRouteCount >=
        ROUTE_BLOCK_LIMIT;


      /* =====================================================
         RESEARCH MEMORY
      ===================================================== */

      const memory =
        history
          .map(
            (
              item: any,
              index: number,
            ) => {

              const evidence =
                item?.evidence ??
                {};

              return [
                `#${index + 1}`,

                `id=${cleanText(
                  item?.id,
                )}`,

                `title=${cleanText(
                  item?.title,
                )}`,

                `status=${cleanText(
                  item?.status,
                )}`,

                `hypothesis=${cleanText(
                  item?.hypothesis,
                )}`,

                `calculation=${cleanText(
                  item?.calculation,
                )}`,

                `verification=${cleanText(
                  item?.verification,
                )}`,

                `next_action=${cleanText(
                  item?.next_action,
                )}`,

                `route=${cleanText(
                  evidence?.route,
                )}`,

                `route_key=${cleanText(
                  evidence?.route_key,
                )}`,

                `route_count=${cleanText(
                  evidence?.route_count,
                )}`,

                `evidence=${JSON.stringify(
                  evidence?.items ??
                  [],
                )}`,

              ].join("\n");

            },
          )
          .join("\n\n")
          .slice(
            0,
            MAX_HISTORY_CHARS,
          );


      /* =====================================================
         SYSTEM PROMPT
      ===================================================== */

      const systemPrompt = `
あなたは Research AI Lab の数学研究AIです。

目的は「未解決問題だから回答できない」と停止することではありません。

未解決問題についても、
証明・反証・部分結果・計算実験・構造的観察・
新しい仮説・次の検証可能な手順を探索してください。

ただし、証明されていないことを証明済みとは絶対に言わないでください。

============================================================
研究原則
============================================================

1. 事実と推測を分離する。
2. 証明できていない結論を証明済みと表現しない。
3. 「分からない」で終了せず、次に試せる研究を出す。
4. 過去の研究結果を必ず利用する。
5. 過去の失敗を再利用し、同じ失敗を繰り返さない。
6. 研究ルートを最低10種類の観点から検討する。
7. 得られた結論を積極的に壊す。
8. 反例を探す。
9. 仮説の成立条件を探す。
10. 仮説が成立しない条件も探す。
11. 別の数学的表現へ変換する。
12. 逆向きに考える。
13. 背理法を検討する。
14. 帰納・演繹を検討する。
15. 数値実験・計算実験を検討する。
16. 別証明・別導出を検討する。
17. 既知の定理との接続を探す。
18. 他分野との類推を検討する。
19. 必要なら物理的直観を利用する。
20. 最後に独立検証する。

============================================================
最低10アプローチ
============================================================

必ず次の観点を候補として検討してください。

A. 直接証明
B. 背理法
C. 逆向き推論
D. 反例探索
E. 仮説破壊
F. 特殊ケース・境界ケース
G. 帰納的構造
H. 演繹的構造
I. 別表現への変換
J. 数値・計算実験
K. 別証明
L. 既知定理との接続
M. 他分野との類推
N. 物理的モデル・物理演算
O. 過去研究の失敗原因からの再設計

すべてが有効だとは限りません。

有効性を比較し、
有望なものを残し、
失敗したものは「なぜ失敗したか」を明示してください。

============================================================
結論を壊す
============================================================

研究途中で有力な結論が出ても、
その結論をそのまま採用しないでください。

必ず、

・反例
・境界例
・隠れた仮定
・論理の飛躍
・未検証部分
・別解釈
・反対方向の証明
・数値的反証

を確認してください。

============================================================
過去研究メモリ
============================================================

過去結果は「答え」ではありません。

過去結果から、

・失敗原因
・共通する誤り
・有効だった変形
・有効だった検証
・何度も失敗する条件
・まだ試していない方向

を抽出して、新しい研究へ反映してください。

============================================================
物理モード
============================================================

物理モードが有効な場合、
数学的問題を物理系・力学系・エネルギー・対称性・
保存則・場・確率過程などの観点から考えてよいです。

ただし物理的類推は数学的証明ではありません。

物理的直観と数学的証明を明確に区別してください。

============================================================
未解決問題
============================================================

未解決問題について、

「現在証明されていない」

という事実だけを理由に停止してはいけません。

代わりに、

・部分問題
・必要条件
・十分条件
・特殊ケース
・反例探索
・関連する定理
・計算可能な実験
・新しい補題候補
・証明戦略
・失敗した戦略
・次の研究

を出してください。

============================================================
研究評価
============================================================

good:
論理的に成立し、根拠が十分に確認できる。

maybe:
興味深いが未検証、または証明に不足がある。

bad:
明確な反例、矛盾、計算ミス、論理破綻がある。

「面白そう」だけでgoodにしてはいけません。

============================================================
JSON
============================================================

必ずJSONだけを返してください。

{
  "title": "研究タイトル",
  "status": "good|maybe|bad",
  "confidence": 0.0,
  "confidence_basis": "信頼度の理由",
  "hypothesis": "中心仮説",
  "route": "研究ルート識別子",
  "summary": "研究結果の要約",
  "calculation": "計算・導出・論理",
  "verification": "検証内容",
  "next_action": "次に試す研究",
  "evidence": [
    "根拠"
  ],
  "approaches": [
    {
      "name": "アプローチ名",
      "idea": "何を試すか",
      "result": "結果",
      "failure_reason": "失敗した場合の原因",
      "promising": true
    }
  ],
  "failure_analysis": [
    "共通する失敗原因"
  ],
  "destructive_checks": [
    "結論を壊すために行った確認"
  ],
  "new_hypotheses": [
    "派生仮説"
  ],
  "independent_verification": "独立検証",
  "physical_reasoning": "物理モードを使用した場合の内容"
}
`.trim();


      /* =====================================================
         USER PROMPT
      ===================================================== */

      const userPrompt = `
【研究テーマ】

${message}


【PROJECT】

${projectId}


【物理モード】

${
  physicsEnabled
    ? "ON: 物理演算・物理的類推を研究補助として使用してください。"
    : "OFF: 数学的推論を中心にしてください。"
}


【同一ルート使用回数】

${sameRouteCount}


【同一ルート制限】

${
  routeBlocked
    ? "このルートは3回以上使用済みです。同じルートを繰り返さず、別のルートを必ず選択してください。"
    : "このルートはまだ制限されていません。"
}


【研究ルートキー】

${routeKey}


【過去の研究】

${
  memory ||
  "まだ研究履歴はありません。"
}


【追加ルール】

${JSON.stringify(
  researchRules,
  null,
  2,
)}


【再検証対象】

${
  parentResultId
    ? parentResultId
    : "なし"
}


============================================================

研究を開始してください。

まず複数のアプローチを比較し、
最低10種類の観点を検討してください。

その中から有望な方向を選び、
その方向をさらに掘り下げてください。

そして必ず、その結論を壊す方向にも考えてください。

「未解決なので証明できない」
だけで終了することは禁止します。

証明できない場合でも、
最も価値のある部分結果と次の検証手順を残してください。

過去研究に共通する失敗原因があれば抽出し、
今回の研究設計を改善してください。

JSON以外の文章は出力しないでください。
`.trim();


      /* =====================================================
         AI
      ===================================================== */

      const ai =
        await callAI(

          {
            gemini:
              geminiKey,

            cerebras:
              cerebrasKey,

            groq:
              groqKey,

            openrouter:
              openRouterKey,

          },

          supabaseUrl,

          systemPrompt,

          userPrompt,

        );


      /* =====================================================
         PARSE
      ===================================================== */

      let research =
        extractJson(
          ai.text,
        );


      /*
       * JSONにならなかった場合でも
       * 研究を完全消失させない。
       */

      if (!research) {

        research = {

          title:
            "AI研究回答",

          status:
            "maybe",

          confidence:
            0,

          confidence_basis:
            "AI回答を構造化JSONとして取得できませんでした。",

          hypothesis:
            "",

          route:
            "unstructured_response",

          summary:
            ai.text,

          calculation:
            "",

          verification:
            "未検証",

          next_action:
            "回答を構造化して再検証する。",

          evidence:
            [],

          approaches:
            [],

          failure_analysis:
            [],

          destructive_checks:
            [],

          new_hypotheses:
            [],

          independent_verification:
            "",

          physical_reasoning:
            "",

        };

      }


      /* =====================================================
         NORMALIZE
      ===================================================== */

      const title =
        cleanText(
          research.title,
        ) ||
        "AI研究回答";


      const statusRaw =
        cleanText(
          research.status,
        )
          .toLowerCase();


      const status =
        [
          "good",
          "maybe",
          "bad",
        ].includes(
          statusRaw,
        )
          ? statusRaw
          : "maybe";


      const confidenceRaw =
        Number(
          research.confidence,
        );


      const confidence =
        Number.isFinite(
          confidenceRaw,
        )
          ? clamp(
              confidenceRaw,
              0,
              1,
            )
          : 0;


      const hypothesis =
        cleanText(
          research.hypothesis,
        );


      const calculation =
        cleanText(
          research.calculation,
        );


      const verification =
        cleanText(
          research.verification,
        );


      const nextAction =
        cleanText(
          research.next_action,
        );


      const summary =
        cleanText(
          research.summary,
        ) ||
        cleanText(
          research.description,
        ) ||
        ai.text;


      const route =
        cleanText(
          research.route,
        ) ||
        "multi_approach";


      /* =====================================================
         ARRAYS
      ===================================================== */

      const approaches =
        Array.isArray(
          research.approaches,
        )
          ? research.approaches
          : [];


      const failureAnalysis =
        Array.isArray(
          research.failure_analysis,
        )
          ? research.failure_analysis
          : [];


      const destructiveChecks =
        Array.isArray(
          research.destructive_checks,
        )
          ? research.destructive_checks
          : [];


      const newHypotheses =
        Array.isArray(
          research.new_hypotheses,
        )
          ? research.new_hypotheses
          : [];


      const evidence =
        Array.isArray(
          research.evidence,
        )
          ? research.evidence
          : research.evidence
            ? [research.evidence]
            : [];


      const physicalReasoning =
        cleanText(
          research.physical_reasoning,
        );


      const independentVerification =
        cleanText(
          research.independent_verification,
        );


      /* =====================================================
         EVIDENCE
      ===================================================== */

      const evidenceObject = {

        items:
          evidence,

        route:
          route,

        route_key:
          routeKey,

        route_count:
          sameRouteCount + 1,

        confidence:
          confidence,

        confidence_basis:
          cleanText(
            research.confidence_basis,
          ),

        approaches:
          approaches,

        failure_analysis:
          failureAnalysis,

        destructive_checks:
          destructiveChecks,

        new_hypotheses:
          newHypotheses,

        independent_verification:
          independentVerification,

        physical_reasoning:
          physicalReasoning,

        provider:
          ai.provider,

        model:
          ai.model,

        fallback_attempts:
          ai.attempts,

        parent_result_id:
          parentResultId ||
          null,

        physics_enabled:
          physicsEnabled,

        research_rules:
          researchRules,

      };


      /* =====================================================
         SAVE
      ===================================================== */

      const {
        data:
          savedResult,
        error:
          saveError,
      } =
        await supabase
          .from(
            "research_results",
          )
          .insert({

            project_id:
              projectId,

            title:
              title,

            description:
              summary,

            status:
              status,

            hypothesis:
              hypothesis,

            calculation:
              calculation,

            verification:
              verification,

            next_action:
              nextAction,

            evidence:
              evidenceObject,

          })
          .select(
            "id,project_id,title,description,status,hypothesis,calculation,verification,next_action,evidence,created_at",
          )
          .single();


      if (saveError) {

        throw new Error(
          `Failed to save research result: ${saveError.message}`,
        );
      }


      if (!savedResult) {

        throw new Error(
          "Research result was saved but could not be returned.",
        );
      }


      /* =====================================================
         SUCCESS
      ===================================================== */

      return jsonResponse({

        ok:
          true,

        blocked:
          false,

        answer:
          ai.text,

        provider:
          ai.provider,

        model:
          ai.model,

        fallback_attempts:
          ai.attempts,

        saved:
          true,

        result_id:
          savedResult.id,

        research: {

          id:
            savedResult.id,

          title:
            savedResult.title,

          description:
            savedResult.description,

          status:
            savedResult.status,

          confidence:
            confidence,

          confidence_basis:
            cleanText(
              research.confidence_basis,
            ),

          hypothesis:
            savedResult.hypothesis,

          route:
            route,

          route_key:
            routeKey,

          route_count:
            sameRouteCount + 1,

          summary:
            savedResult.description,

          calculation:
            savedResult.calculation,

          verification:
            savedResult.verification,

          next_action:
            savedResult.next_action,

          evidence:
            evidence,

          approaches:
            approaches,

          failure_analysis:
            failureAnalysis,

          destructive_checks:
            destructiveChecks,

          new_hypotheses:
            newHypotheses,

          independent_verification:
            independentVerification,

          physical_reasoning:
            physicalReasoning,

          physics_enabled:
            physicsEnabled,

        },

      });


    } catch (error) {

      console.error(
        "smart-handler error:",
        error,
      );


      return jsonResponse(

        {

          ok:
            false,

          error:
            error instanceof Error
              ? error.message
              : String(error),

          function:
            "smart-handler",

          timestamp:
            new Date().toISOString(),

        },

        500,

      );

    }

  },
);
