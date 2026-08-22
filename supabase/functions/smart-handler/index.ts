import { createClient } from "npm:@supabase/supabase-js@2";

/* =========================================================
   CORS
========================================================= */

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

/*
 * 研究結果の最大出力トークン。
 *
 * 7000 → 4000
 *
 * 研究結果が長くなりすぎることを防ぎ、
 * OpenRouterのクレジット消費と
 * GroqのTPM制限に引っかかりにくくする。
 */
const MAX_OUTPUT_TOKENS = 4000;


/*
 * AIに渡す過去研究数。
 *
 * 40件だと入力が巨大になりやすいため、
 * 直近15件に制限。
 */
const MAX_HISTORY = 15;


/*
 * 過去研究をAIへ渡す最大文字数。
 *
 * 30000 → 16000
 */
const MAX_HISTORY_CHARS = 16000;


/*
 * 同じ研究ルートを3回以上繰り返さない。
 */
const ROUTE_BLOCK_LIMIT = 3;


/*
 * 1つの研究結果から作る次ジョブは1件だけ。
 */
const MAX_NEXT_JOBS_PER_RESULT = 1;


/*
 * 1研究あたりのアプローチ数。
 *
 * AIには最低10種類を要求する。
 */
const MIN_APPROACHES = 10;


/*
 * 自動生成される次研究テーマの最大文字数。
 *
 * これ以上長くならないようにする。
 *
 * 特に重要：
 *
 * 以前の実装では、
 *
 * A
 * ↓
 * B(A)
 * ↓
 * C(B(A))
 * ↓
 * D(C(B(A)))
 *
 * のように前研究テーマが入れ子になり、
 * 自動研究を続けるほど巨大化する問題があった。
 *
 * この上限とテーマ抽出処理によって防止する。
 */
const NEXT_THEME_MAX_CHARS = 3000;


/* =========================================================
   MODELS
========================================================= */

const GEMINI_MODEL =
  "gemini-3.6-flash";

const CEREBRAS_MODEL =
  "gpt-oss-120b";

const GROQ_MODEL =
  "openai/gpt-oss-120b";

const OPENROUTER_MODEL =
  "openai/gpt-4o-mini";


/* =========================================================
   DEFAULT PROJECT
========================================================= */

/*
 * 既存コードで使用していた
 * DEFAULT_PROJECT_ID を維持。
 *
 * 環境変数が設定されている場合はそちらを優先。
 */
const DEFAULT_PROJECT_ID =
  Deno.env.get(
    "DEFAULT_PROJECT_ID",
  ) ||
  "ab429192-27d2-47e4-9ad7-08b639f45120";


/* =========================================================
   RESPONSE
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


/* =========================================================
   HELPERS
========================================================= */

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


  /*
   * 完全なJSONとして解析。
   */

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
    /* 続行 */
  }


  /*
   * 回答の中から最初の { ～ 最後の }
   * を探してJSONとして解析。
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
      /* 続行 */
    }
  }


  return null;
}


/* =========================================================
   AI RESPONSE EXTRACTION
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
   FETCH JSON
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


  try {

    return JSON.parse(text);

  } catch {

    throw new Error(
      `${provider} returned invalid JSON.`,
    );
  }
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
        method: "POST",

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
   OPENAI COMPATIBLE
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
        method: "POST",

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

            /*
             * OpenAI互換API。
             *
             * 出力上限を4000へ統一。
             */
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

            /*
             * OpenRouter用。
             *
             * 7000 → 4000
             */
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


  /* =======================================================
     GEMINI
  ======================================================= */

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


  /* =======================================================
     CEREBRAS
  ======================================================= */

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


  /* =======================================================
     GROQ
  ======================================================= */

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


  /* =======================================================
     OPENROUTER
  ======================================================= */

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
   FETCH JSON
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


  try {

    return JSON.parse(text);

  } catch {

    throw new Error(
      `${provider} returned invalid JSON.`,
    );
  }
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
        method: "POST",

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
   OPENAI COMPATIBLE
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
        method: "POST",

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


  /* =======================================================
     GEMINI
  ======================================================= */

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


  /* =======================================================
     CEREBRAS
  ======================================================= */

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


  /* =======================================================
     GROQ
  ======================================================= */

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


  /* =======================================================
     OPENROUTER
  ======================================================= */

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
   NEXT RESEARCH THEME
========================================================= */

/*
 * ここが今回の修正箇所。
 *
 * 旧コードでは、
 *
 *   元の研究テーマ
 *   ↓
 *   派生仮説
 *   ↓
 *   その研究結果
 *   ↓
 *   また「前研究から派生した新しい研究課題」
 *
 * のように、nextThemeそのものを
 * 次のcurrentMessageとして再利用していました。
 *
 * その結果、
 *
 *   元の研究テーマ：
 *   前研究から派生した新しい研究課題。
 *
 * が何度も入れ子になっていました。
 *
 * 今回は、
 *
 * 1. new_hypotheses
 * 2. promising approach
 * 3. destructive check
 * 4. failure analysis
 * 5. fallback
 *
 * の順番は維持しつつ、
 *
 * 「前研究から派生した新しい研究課題。」
 *
 * のようなメタ説明を次のテーマ自身に
 * 再利用しないようにします。
 *
 * また、派生テーマには必ず
 * 「今回実際に検証する対象」
 * を中心として入れます。
 */


/* =========================================================
   TEXT NORMALIZATION FOR NEXT THEME
========================================================= */

function normalizeNextResearchText(
  value: unknown,
): string {

  return cleanText(
    value,
  )
    .replace(
      /\r\n/g,
      "\n",
    )
    .replace(
      /前研究から派生した新しい研究課題。?/g,
      "",
    )
    .replace(
      /前研究から派生した研究課題。?/g,
      "",
    )
    .replace(
      /この仮説を数学的に検証してください。?/g,
      "",
    )
    .replace(
      /必要条件・十分条件・反例・境界ケース・論理の飛躍を確認してください。?/g,
      "",
    )
    .replace(
      /未検証の場合は△として扱い、次に検証可能な具体的課題を提示してください。?/g,
      "",
    )
    .replace(
      /不要な説明は避けてください。?/g,
      "",
    )
    .replace(
      /\n{3,}/g,
      "\n\n",
    )
    .trim();
}


/* =========================================================
   BUILD NEXT RESEARCH THEME
========================================================= */

function buildNextResearchTheme(
  message: string,
  research: Record<string, unknown>,
): string {

  /*
   * 現在の研究テーマを正規化。
   *
   * ここで過去の自動生成文が混入していても、
   * そのまま次テーマへ何重にもコピーしない。
   */

  const currentMessage =
    normalizeNextResearchText(
      message,
    );


  /* =======================================================
     1. NEW HYPOTHESIS
  ======================================================= */

  const newHypotheses =
    Array.isArray(
      research.new_hypotheses,
    )
      ? research.new_hypotheses
      : [];


  for (
    const hypothesis of newHypotheses
  ) {

    const text =
      normalizeNextResearchText(
        hypothesis,
      );


    if (!text) {
      continue;
    }


    /*
     * AIが
     *
     * 「派生仮説：○○」
     *
     * の形で返した場合も、
     * 「派生仮説：」自体を何度も連結しない。
     */

    const cleanedHypothesis =
      text
        .replace(
          /^派生仮説[:：]\s*/i,
          "",
        )
        .trim();


    if (!cleanedHypothesis) {
      continue;
    }


    return [

      "次の研究課題：",

      cleanedHypothesis,

      "",

      "検証対象を明確化し、",

      "必要条件・十分条件・反例・境界ケース・隠れた仮定・論理の飛躍を確認してください。",

      "仮説だけで証明済みとは判断せず、未検証なら△として扱ってください。",

    ].join("\n");
  }


  /* =======================================================
     2. PROMISING APPROACH
  ======================================================= */

  const approaches =
    Array.isArray(
      research.approaches,
    )
      ? research.approaches
      : [];


  /*
   * promising=true のものを優先。
   *
   * ただし、AIが複数をtrueにした場合でも、
   * 最初の1件だけを次ジョブにする。
   */

  for (
    const approach of approaches
  ) {

    if (
      !approach ||
      typeof approach !== "object"
    ) {

      continue;
    }


    const item =
      approach as Record<string, unknown>;


    const promising =
      item.promising === true;


    if (!promising) {
      continue;
    }


    const idea =
      normalizeNextResearchText(
        item.idea,
      );


    const name =
      normalizeNextResearchText(
        item.name,
      );


    if (
      !idea &&
      !name
    ) {

      continue;
    }


    return [

      "次の研究課題：",

      name
        ? `アプローチ「${name}」を具体化する。`
        : "前研究で有望と判断されたアプローチを具体化する。",

      "",

      idea
        ? `研究方針：${idea}`
        : "",

      "",

      "この方向について具体的な数学的命題を設定し、",

      "証明・反証・必要条件・十分条件・反例・境界ケースを検証してください。",

      "単なる可能性の提示ではなく、検証可能な結果を残してください。",

    ]
      .filter(
        (line) =>
          line !== "",
      )
      .join("\n");
  }


  /* =======================================================
     3. DESTRUCTIVE CHECK
  ======================================================= */

  const destructiveChecks =
    Array.isArray(
      research.destructive_checks,
    )
      ? research.destructive_checks
      : [];


  for (
    const check of destructiveChecks
  ) {

    const text =
      normalizeNextResearchText(
        check,
      );


    if (!text) {
      continue;
    }


    return [

      "次の研究課題：",

      "前研究の結論に対する破壊的検証を行う。",

      "",

      `検証対象：${text}`,

      "",

      "反例が存在するかを最優先で確認してください。",

      "反例が見つからない場合でも、なぜ反例が構成できないのかを数学的に検討してください。",

    ].join("\n");
  }


  /* =======================================================
     4. FAILURE ANALYSIS
  ======================================================= */

  const failureAnalysis =
    Array.isArray(
      research.failure_analysis,
    )
      ? research.failure_analysis
      : [];


  for (
    const failure of failureAnalysis
  ) {

    const text =
      normalizeNextResearchText(
        failure,
      );


    if (!text) {
      continue;
    }


    return [

      "次の研究課題：",

      "前研究で確認された失敗原因を解消できる別アプローチを探す。",

      "",

      `失敗原因：${text}`,

      "",

      "この失敗原因が本当に障害となっているかを再検証してください。",

      "そのうえで、同じ失敗を繰り返さない具体的な研究方法を提示してください。",

    ].join("\n");
  }


  /* =======================================================
     5. FALLBACK
  ======================================================= */

  /*
   * ここでも「前研究から派生した新しい研究課題。」
   * をそのまま次テーマに入れない。
   */

  const fallbackBase =
    currentMessage ||
    "現在の研究";


  return [

    "次の研究課題：",

    "前研究とは異なる数学的アプローチから再検証する。",

    "",

    `現在の研究対象：${fallbackBase}`,

    "",

    "直接証明だけに依存せず、",

    "背理法・逆向き推論・反例探索・特殊ケース・境界ケース・既知定理との接続・別表現を比較してください。",

    "その中から最も検証可能な具体的課題を1つ選び、数学的に検証してください。",

  ].join("\n");
}


/* =========================================================
   CHECK EXISTING NEXT JOB
========================================================= */

async function nextJobAlreadyExists(
  supabase: any,
  projectId: string,
  nextTheme: string,
): Promise<boolean> {

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "research_jobs",
      )
      .select(
        "id,status,payload",
      )
      .eq(
        "project_id",
        projectId,
      )
      .in(
        "status",
        [
          "queued",
          "running",
        ],
      )
      .limit(
        100,
      );


  if (error) {

    throw new Error(
      `Failed to check existing next jobs: ${error.message}`,
    );
  }


  const jobs =
    data ?? [];


  const normalizedTarget =
    normalizeNextResearchText(
      nextTheme,
    );


  for (
    const job of jobs
  ) {

    let payload: any = {};


    if (
      job?.payload &&
      typeof job.payload === "object"
    ) {

      payload =
        job.payload;

    } else if (
      typeof job?.payload === "string"
    ) {

      try {

        payload =
          JSON.parse(
            job.payload,
          );

      } catch {

        payload = {};
      }
    }


    const existingTheme =
      normalizeNextResearchText(

        payload?.theme ??
        payload?.message,

      );


    if (
      existingTheme &&
      existingTheme ===
        normalizedTarget
    ) {

      console.log(
        "Next research job already exists. Skipping duplicate.",
      );


      return true;
    }
  }


  return false;
}


/* =========================================================
   CREATE NEXT RESEARCH JOB
========================================================= */

async function createNextResearchJob(
  supabase: any,
  projectId: string,
  parentResultId: string,
  currentMessage: string,
  research: Record<string, unknown>,
): Promise<{
  created: boolean;
  job_id: string | null;
  theme: string;
  reason?: string;
}> {

  /*
   * 1研究結果につき次ジョブ1件。
   */

  const nextTheme =
    buildNextResearchTheme(
      currentMessage,
      research,
    );


  if (!nextTheme.trim()) {

    return {

      created:
        false,

      job_id:
        null,

      theme:
        "",

      reason:
        "No next research theme was generated.",

    };
  }


  /*
   * 重複チェック。
   */

  const exists =
    await nextJobAlreadyExists(
      supabase,
      projectId,
      nextTheme,
    );


  if (exists) {

    return {

      created:
        false,

      job_id:
        null,

      theme:
        nextTheme,

      reason:
        "Duplicate queued/running job already exists.",

    };
  }


  /*
   * 次ジョブpayload。
   */

  const nextPayload = {

    theme:
      nextTheme,

    message:
      nextTheme,

    project_id:
      projectId,

    parent_result_id:
      parentResultId,

    auto_generated:
      true,

    source:
      "smart-handler",

    created_from_result_id:
      parentResultId,

    created_from_message:
      normalizeNextResearchText(
        currentMessage,
      ),

    created_at:
      new Date().toISOString(),

  };


  /*
   * DBへqueued jobを作成。
   */

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "research_jobs",
      )
      .insert({

        project_id:
          projectId,

        status:
          "queued",

        priority:
          0,

        payload:
          nextPayload,

      })
      .select(
        "id,status,project_id,priority,payload,created_at",
      )
      .single();


  if (error) {

    throw new Error(
      `Failed to create next research job: ${error.message}`,
    );
  }


  if (!data) {

    throw new Error(
      "Next research job was created but could not be returned.",
    );
  }


  console.log(
    "Next research job created:",
    data.id,
  );


  return {

    created:
      true,

    job_id:
      data.id,

    theme:
      nextTheme,

  };
}


/* =========================================================
   MAIN
========================================================= */

Deno.serve(
  async (
    req: Request,
  ) => {

    /* =====================================================
       CORS
    ===================================================== */

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
         ENV
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
          "SUPABASE_URL is missing.",
        );
      }


      if (!serviceRoleKey) {

        throw new Error(
          "SUPABASE_SERVICE_ROLE_KEY is missing.",
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
         REQUEST BODY
      ===================================================== */

      let body: any = {};


      try {

        body =
          await req.json();

      } catch {

        body = {};
      }


      const payload =
        body?.payload &&
        typeof body.payload === "object"
          ? body.payload
          : {};


      const message =
        cleanText(

          body?.message ??
          body?.theme ??
          payload?.message ??
          payload?.theme,

        ).trim();


      const projectId =
        cleanText(

          body?.project_id ??
          payload?.project_id ??
          DEFAULT_PROJECT_ID,

        ).trim();


      const physicsEnabled =
        Boolean(

          body?.physics_enabled ??
          payload?.physics_enabled ??
          body?.physical_reasoning ??
          payload?.physical_reasoning ??
          false,

        );


      const researchRules =
        body?.research_rules ??
        payload?.research_rules ??
        {};


      const parentResultId =
        cleanText(

          body?.parent_result_id ??
          payload?.parent_result_id,

        ).trim();


      /* =====================================================
         MESSAGE VALIDATION
      ===================================================== */

      if (!message) {

        return jsonResponse(

          {
            ok:
              false,

            error:
              "Queued job has no message or theme",
          },

          400,

        );
      }


      /* =====================================================
         LOAD HISTORY
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

            "id,title,hypothesis,content,status,evaluation,confidence_level,is_human_saved,created_at,updated_at",

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
         ROUTE COUNT
      ===================================================== */

      const sameRouteCount =
        history.filter(

          (item: any) => {

            const content =
              cleanText(
                item?.content,
              );


            return content.includes(
              `[ROUTE_KEY:${routeKey}]`,
            );
          },

        ).length;


      const routeBlocked =
        sameRouteCount >=
        ROUTE_BLOCK_LIMIT;


      /* =====================================================
         MEMORY
      ===================================================== */

      const memory =
        history
          .map(

            (
              item: any,
              index: number,
            ) => {

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

                `evaluation=${cleanText(
                  item?.evaluation,
                )}`,

                `confidence_level=${cleanText(
                  item?.confidence_level,
                )}`,

                `hypothesis=${cleanText(
                  item?.hypothesis,
                )}`,

                `content=${cleanText(
                  item?.content,
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
あなたは Research AI Lab の自律数学研究AIです。

目的は未解決問題について、
研究可能な部分を発見し、
仮説・検証・反証・別アプローチを継続することです。

絶対に、証明されていないことを
証明済みとして扱ってはいけません。

============================================================
基本原則
============================================================

1. 事実と仮説を分離する。
2. 証明されていないことを証明済みとしない。
3. 未解決だからという理由だけで停止しない。
4. 部分問題を発見する。
5. 必要条件を探す。
6. 十分条件を探す。
7. 反例を探す。
8. 境界ケースを調べる。
9. 背理法を検討する。
10. 逆向き推論を検討する。
11. 帰納的構造を調べる。
12. 演繹的構造を調べる。
13. 別表現へ変換する。
14. 既知の定理との接続を探す。
15. 数値実験を検討する。
16. 別証明を探す。
17. 他分野との類推を検討する。
18. 必ず結論を壊す方向を検討する。
19. 過去の失敗を繰り返さない。
20. 最後に独立した観点から検証する。

============================================================
研究アプローチ
============================================================

最低10種類の研究アプローチを比較してください。

候補：

A. 直接証明
B. 背理法
C. 逆向き推論
D. 反例探索
E. 仮説破壊
F. 特殊ケース
G. 境界ケース
H. 帰納
I. 演繹
J. 別表現
K. 数値実験
L. 別証明
M. 既知定理との接続
N. 他分野との類推
O. 物理的モデル
P. 過去研究の失敗原因

すべてを完全に実行できなくてもよい。

重要なのは、
どの方向が有望か、
なぜ他の方向が弱いか、
を比較することです。

============================================================
反証
============================================================

有力な仮説を発見しても、そのまま採用してはいけません。

必ず、

・反例
・境界例
・特殊例
・隠れた仮定
・論理の飛躍
・未検証部分
・別解釈
・反対方向の推論

を確認してください。

============================================================
過去研究
============================================================

過去研究は答えではありません。

過去研究から、

・失敗原因
・有効だった方法
・無効だった方法
・未検証の方向
・繰り返し失敗する条件

を抽出してください。

============================================================
評価
============================================================

evaluation は必ず次の3つのいずれか：

"⭕"
"△"
"❌"

⭕
論理的に成立し、十分な根拠が確認できる部分。

△
興味深いが未検証、または証明が不足している部分。

❌
反例・矛盾・計算ミス・論理破綻が確認された部分。

重要：

未解決問題について新しい仮説を出しただけなら、
原則として△です。

「面白そう」という理由だけで⭕にしないでください。

============================================================
confidence_level
============================================================

1 = ほぼ推測
2 = 根拠はあるが未検証
3 = 複数の根拠があり比較的有望
4 = 強い検証がある
5 = 数学的に十分確認された結果

未解決問題の新規仮説を安易に4や5にしないでください。

============================================================
status
============================================================

新規研究・未確定研究：
"pending"

研究結果として整理済み：
"completed"

明確な失敗：
"failed"

通常の新規研究ではまず"pending"を使用してください。

============================================================
重要：出力サイズ
============================================================

研究内容は十分に具体的にしてください。

ただし、不要な長文説明や同じ内容の繰り返しは避けてください。

10以上のアプローチを比較しつつ、
重要な論理・検証・反証を優先してください。

============================================================
JSON
============================================================

必ず次のJSONだけを返してください。

{
  "title": "研究タイトル",
  "hypothesis": "中心仮説",
  "content": "研究内容。計算、論理、検証、反証、次の研究を含める",
  "evaluation": "⭕|△|❌",
  "confidence_level": 1,
  "status": "pending",
  "approaches": [
    {
      "name": "アプローチ名",
      "idea": "何を試すか",
      "result": "どうなったか",
      "promising": true
    }
  ],
  "failure_analysis": [
    "失敗原因"
  ],
  "destructive_checks": [
    "結論を壊すための検証"
  ],
  "new_hypotheses": [
    "派生仮説"
  ],
  "independent_verification": "独立検証",
  "physical_reasoning": "物理モードを使用した場合のみ記述"
}

JSON以外を出力しないでください。
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
    ? "ON"
    : "OFF"
}

【同一ルート使用回数】

${sameRouteCount}

【同一ルート制限】

${
  routeBlocked
    ? "このルートは3回以上使用済み。必ず別ルートを選択してください。"
    : "このルートはまだ3回未満です。"
}

【研究ルートキー】

${routeKey}

【過去研究】

${
  memory ||
  "まだ研究履歴はありません。"
}

【研究ルール】

${JSON.stringify(
  researchRules,
  null,
  2,
)}

【再検証対象】

${
  parentResultId ||
  "なし"
}

============================================================

研究を開始してください。

最低10種類のアプローチを比較してください。

過去研究がある場合、
失敗原因と成功した考え方を利用してください。

その後、最も有望な方向を掘り下げてください。

さらに、その結論を壊す方向から検証してください。

未解決問題の場合、
証明できないこと自体を失敗とはしません。

価値のある部分結果、
必要条件、
十分条件、
反例候補、
新しい補題候補、
次に検証できる研究を残してください。

不要な繰り返しを避け、
限られた出力量を数学的な検証に優先して使ってください。

JSON以外の文章を出力しないでください。
`.trim();


      /* =====================================================
         AI CALL
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
         PARSE AI RESULT
      ===================================================== */

      let research =
        extractJson(
          ai.text,
        );


      if (!research) {

        research = {

          title:
            "AI研究回答",

          hypothesis:
            "",

          content:
            ai.text,

          evaluation:
            "△",

          confidence_level:
            1,

          status:
            "pending",

          approaches:
            [],

          failure_analysis:
            [
              "AI回答を構造化JSONとして解析できませんでした。",
            ],

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


      const hypothesis =
        cleanText(
          research.hypothesis,
        );


      let content =
        cleanText(
          research.content,
        );


      if (!content) {

        content =
          ai.text;
      }


      /* =====================================================
         EVALUATION
      ===================================================== */

      const evaluationRaw =
        cleanText(
          research.evaluation,
        );


      let evaluation =
        "△";


      if (
        evaluationRaw ===
        "⭕" ||
        evaluationRaw ===
        "△" ||
        evaluationRaw ===
        "❌"
      ) {

        evaluation =
          evaluationRaw;
      }


      /* =====================================================
         CONFIDENCE
      ===================================================== */

      const confidenceRaw =
        Number(
          research.confidence_level,
        );


      let confidenceLevel =
        Number.isFinite(
          confidenceRaw,
        )
          ? Math.round(
              confidenceRaw,
            )
          : 2;


      confidenceLevel =
        clamp(
          confidenceLevel,
          1,
          5,
        );


      if (
        evaluation === "△" &&
        confidenceLevel > 3
      ) {

        confidenceLevel =
          3;
      }


      if (
        evaluation === "❌"
      ) {

        confidenceLevel =
          Math.min(
            confidenceLevel,
            2,
          );
      }


      /* =====================================================
         STATUS
      ===================================================== */

      const statusRaw =
        cleanText(
          research.status,
        ).toLowerCase();


      let status =
        "pending";


      if (
        statusRaw ===
        "completed"
      ) {

        status =
          "completed";

      } else if (
        statusRaw ===
        "failed"
      ) {

        status =
          "failed";

      } else {

        status =
          "pending";
      }


      if (
        evaluation ===
        "❌"
      ) {

        status =
          "failed";
      }


      /* =====================================================
         STRUCTURED CONTENT
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


      const independentVerification =
        cleanText(
          research.independent_verification,
        );


      const physicalReasoning =
        cleanText(
          research.physical_reasoning,
        );


      /* =====================================================
         CONTENT FOR DB
      ===================================================== */

      const contentForDB = [

        `[ROUTE_KEY:${routeKey}]`,

        `[ROUTE_COUNT:${sameRouteCount + 1}]`,

        `【研究内容】`,

        content,

        ``,

        `【研究アプローチ】`,

        JSON.stringify(
          approaches,
          null,
          2,
        ),

        ``,

        `【失敗分析】`,

        JSON.stringify(
          failureAnalysis,
          null,
          2,
        ),

        ``,

        `【破壊的検証】`,

        JSON.stringify(
          destructiveChecks,
          null,
          2,
        ),

        ``,

        `【新しい仮説】`,

        JSON.stringify(
          newHypotheses,
          null,
          2,
        ),

        ``,

        `【独立検証】`,

        independentVerification,

        ``,

        `【物理的推論】`,

        physicalReasoning,

        ``,

        `【AI PROVIDER】`,

        ai.provider,

        ``,

        `【AI MODEL】`,

        ai.model,

      ].join("\n");


      /* =====================================================
         SAVE RESEARCH RESULT
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

            hypothesis:
              hypothesis,

            content:
              contentForDB,

            status:
              status,

            evaluation:
              evaluation,

            confidence_level:
              confidenceLevel,

            is_human_saved:
              false,

          })
          .select(

            "id,project_id,title,hypothesis,content,status,evaluation,confidence_level,is_human_saved,created_at,updated_at",

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
         CREATE NEXT JOB
      ===================================================== */

      let nextJob = {

        created:
          false,

        job_id:
          null as string | null,

        theme:
          "",

        reason:
          "",

      };


      try {

        nextJob =
          await createNextResearchJob(

            supabase,

            projectId,

            savedResult.id,

            message,

            research,

          );

      } catch (nextJobError) {

        console.error(
          "Failed to create next research job:",
          nextJobError,
        );


        nextJob = {

          created:
            false,

          job_id:
            null,

          theme:
            "",

          reason:
            errorText(
              nextJobError,
            ),

        };
      }


      /* =====================================================
         SUCCESS
      ===================================================== */

      return jsonResponse({

        ok:
          true,

        processed:
          true,

        saved:
          true,

        result_id:
          savedResult.id,

        provider:
          ai.provider,

        model:
          ai.model,

        fallback_attempts:
          ai.attempts,

        next_job:
          nextJob,

        research: {

          id:
            savedResult.id,

          project_id:
            savedResult.project_id,

          title:
            savedResult.title,

          hypothesis:
            savedResult.hypothesis,

          content:
            savedResult.content,

          status:
            savedResult.status,

          evaluation:
            savedResult.evaluation,

          confidence_level:
            savedResult.confidence_level,

          is_human_saved:
            savedResult.is_human_saved,

          created_at:
            savedResult.created_at,

          updated_at:
            savedResult.updated_at,

          route_key:
            routeKey,

          route_count:
            sameRouteCount + 1,

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

          processed:
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

/* =========================================================
   CREATE NEXT RESEARCH JOB
========================================================= */

async function createNextResearchJob(
  supabase: any,
  projectId: string,
  parentResultId: string,
  currentMessage: string,
  research: Record<string, unknown>,
): Promise<{
  created: boolean;
  job_id: string | null;
  theme: string;
  reason?: string;
}> {

  /*
   * =======================================================
   * 次研究テーマ生成
   * =======================================================
   *
   * buildNextResearchTheme() 側で、
   *
   * ・同じ文章の自己増殖
   * ・「前研究から派生した新しい研究課題」の再利用
   * ・元テーマの無限ネスト
   * ・同じ仮説の繰り返し
   *
   * を防止している。
   */

  const nextTheme =
    buildNextResearchTheme(
      currentMessage,
      research,
    );


  if (!nextTheme.trim()) {

    return {
      created: false,
      job_id: null,
      theme: "",
      reason:
        "No next research theme was generated.",
    };
  }


  /*
   * =======================================================
   * 現在のテーマと次テーマが実質同一なら停止
   * =======================================================
   */

  const normalizeTheme =
    (value: string): string => {

      return value
        .replace(
          /\s+/g,
          " ",
        )
        .replace(
          /前研究から派生した新しい研究課題。?/g,
          "",
        )
        .replace(
          /前研究から派生した研究課題。?/g,
          "",
        )
        .replace(
          /元の研究テーマ：/g,
          "",
        )
        .replace(
          /派生仮説：/g,
          "",
        )
        .trim()
        .toLowerCase();
    };


  const normalizedCurrent =
    normalizeTheme(
      currentMessage,
    );


  const normalizedNext =
    normalizeTheme(
      nextTheme,
    );


  if (
    normalizedCurrent &&
    normalizedNext &&
    normalizedCurrent ===
      normalizedNext
  ) {

    console.log(
      "Next theme is effectively identical to current theme. Skipping.",
    );


    return {
      created: false,
      job_id: null,
      theme: nextTheme,
      reason:
        "Next research theme is identical to the current research theme.",
    };
  }


  /*
   * =======================================================
   * 重複ジョブ確認
   * =======================================================
   */

  const exists =
    await nextJobAlreadyExists(
      supabase,
      projectId,
      nextTheme,
    );


  if (exists) {

    console.log(
      "Next research job already exists. Skipping duplicate.",
    );


    return {
      created: false,
      job_id: null,
      theme: nextTheme,
      reason:
        "Duplicate queued/running job already exists.",
    };
  }


  /*
   * =======================================================
   * 次ジョブ payload
   * =======================================================
   */

  const nextPayload = {

    theme:
      nextTheme,

    message:
      nextTheme,

    project_id:
      projectId,

    parent_result_id:
      parentResultId,

    auto_generated:
      true,

    source:
      "smart-handler",

    created_from_result_id:
      parentResultId,

    created_from_message:
      currentMessage,

    created_at:
      new Date().toISOString(),

  };


  /*
   * =======================================================
   * queued job 作成
   * =======================================================
   */

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "research_jobs",
      )
      .insert({

        project_id:
          projectId,

        status:
          "queued",

        priority:
          0,

        payload:
          nextPayload,

      })
      .select(
        "id,status,project_id,priority,payload,created_at",
      )
      .single();


  if (error) {

    throw new Error(
      `Failed to create next research job: ${error.message}`,
    );
  }


  if (!data) {

    throw new Error(
      "Next research job was created but could not be returned.",
    );
  }


  console.log(
    "Next research job created:",
    data.id,
  );


  return {

    created:
      true,

    job_id:
      data.id,

    theme:
      nextTheme,

  };
}


/* =========================================================
   MAIN
========================================================= */

Deno.serve(
  async (
    req: Request,
  ) => {

    /* =====================================================
       CORS
    ===================================================== */

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
         ENV
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
          "SUPABASE_URL is missing.",
        );
      }


      if (!serviceRoleKey) {

        throw new Error(
          "SUPABASE_SERVICE_ROLE_KEY is missing.",
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
         REQUEST BODY
      ===================================================== */

      let body: any = {};


      try {

        body =
          await req.json();

      } catch {

        body = {};
      }


      const payload =
        body?.payload &&
        typeof body.payload === "object"
          ? body.payload
          : {};


      /*
       * Workerから
       *
       * message
       * theme
       *
       * のどちらでも受け取る。
       */

      const message =
        cleanText(

          body?.message ??
          body?.theme ??
          payload?.message ??
          payload?.theme,

        ).trim();


      const projectId =
        cleanText(

          body?.project_id ??
          payload?.project_id ??
          DEFAULT_PROJECT_ID,

        ).trim();


      const physicsEnabled =
        Boolean(

          body?.physics_enabled ??
          payload?.physics_enabled ??
          body?.physical_reasoning ??
          payload?.physical_reasoning ??
          false,

        );


      const researchRules =
        body?.research_rules ??
        payload?.research_rules ??
        {};


      const parentResultId =
        cleanText(

          body?.parent_result_id ??
          payload?.parent_result_id,

        ).trim();


      /* =====================================================
         MESSAGE VALIDATION
      ===================================================== */

      if (!message) {

        return jsonResponse(

          {
            ok:
              false,

            error:
              "Queued job has no message or theme",
          },

          400,

        );
      }


      /* =====================================================
         LOAD HISTORY
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

            "id,title,hypothesis,content,status,evaluation,confidence_level,is_human_saved,created_at,updated_at",

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
         ROUTE COUNT
      ===================================================== */

      const sameRouteCount =
        history.filter(

          (item: any) => {

            const content =
              cleanText(
                item?.content,
              );


            return content.includes(
              `[ROUTE_KEY:${routeKey}]`,
            );
          },

        ).length;


      const routeBlocked =
        sameRouteCount >=
        ROUTE_BLOCK_LIMIT;


      /* =====================================================
         MEMORY
      ===================================================== */

      const memory =
        history
          .map(

            (
              item: any,
              index: number,
            ) => {

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

                `evaluation=${cleanText(
                  item?.evaluation,
                )}`,

                `confidence_level=${cleanText(
                  item?.confidence_level,
                )}`,

                `hypothesis=${cleanText(
                  item?.hypothesis,
                )}`,

                `content=${cleanText(
                  item?.content,
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
あなたは Research AI Lab の自律数学研究AIです。

目的は未解決問題について、
研究可能な部分を発見し、
仮説・検証・反証・別アプローチを継続することです。

絶対に、証明されていないことを
証明済みとして扱ってはいけません。

============================================================
基本原則
============================================================

1. 事実と仮説を分離する。
2. 証明されていないことを証明済みとしない。
3. 未解決だからという理由だけで停止しない。
4. 部分問題を発見する。
5. 必要条件を探す。
6. 十分条件を探す。
7. 反例を探す。
8. 境界ケースを調べる。
9. 背理法を検討する。
10. 逆向き推論を検討する。
11. 帰納的構造を調べる。
12. 演繹的構造を調べる。
13. 別表現へ変換する。
14. 既知の定理との接続を探す。
15. 数値実験を検討する。
16. 別証明を探す。
17. 他分野との類推を検討する。
18. 必ず結論を壊す方向を検討する。
19. 過去の失敗を繰り返さない。
20. 最後に独立した観点から検証する。

============================================================
研究アプローチ
============================================================

最低10種類の研究アプローチを比較してください。

重要なのは、
どの方向が有望か、
なぜ他の方向が弱いか、
を比較することです。

============================================================
反証
============================================================

有力な仮説を発見しても、そのまま採用してはいけません。

必ず、

・反例
・境界例
・特殊例
・隠れた仮定
・論理の飛躍
・未検証部分
・別解釈
・反対方向の推論

を確認してください。

============================================================
過去研究
============================================================

過去研究は答えではありません。

過去研究から、

・失敗原因
・有効だった方法
・無効だった方法
・未検証の方向
・繰り返し失敗する条件

を抽出してください。

============================================================
評価
============================================================

evaluation は必ず次の3つのいずれか：

"⭕"
"△"
"❌"

⭕
論理的に成立し、十分な根拠が確認できる部分。

△
興味深いが未検証、または証明が不足している部分。

❌
反例・矛盾・計算ミス・論理破綻が確認された部分。

未解決問題について新しい仮説を出しただけなら、
原則として△です。

============================================================
confidence_level
============================================================

1 = ほぼ推測
2 = 根拠はあるが未検証
3 = 複数の根拠があり比較的有望
4 = 強い検証がある
5 = 数学的に十分確認された結果

未解決問題の新規仮説を安易に4や5にしないでください。

============================================================
status
============================================================

新規研究・未確定研究：
"pending"

研究結果として整理済み：
"completed"

明確な失敗：
"failed"

通常の新規研究ではまず"pending"を使用してください。

============================================================
JSON
============================================================

必ずJSONだけを返してください。

{
  "title": "研究タイトル",
  "hypothesis": "中心仮説",
  "content": "研究内容。計算、論理、検証、反証、次の研究を含める",
  "evaluation": "⭕|△|❌",
  "confidence_level": 1,
  "status": "pending",
  "approaches": [],
  "failure_analysis": [],
  "destructive_checks": [],
  "new_hypotheses": [],
  "independent_verification": "",
  "physical_reasoning": ""
}

JSON以外を出力しないでください。
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
    ? "ON"
    : "OFF"
}

【同一ルート使用回数】

${sameRouteCount}

【同一ルート制限】

${
  routeBlocked
    ? "このルートは3回以上使用済み。必ず別ルートを選択してください。"
    : "このルートはまだ3回未満です。"
}

【研究ルートキー】

${routeKey}

【過去研究】

${
  memory ||
  "まだ研究履歴はありません。"
}

【研究ルール】

${JSON.stringify(
  researchRules,
  null,
  2,
)}

【再検証対象】

${
  parentResultId ||
  "なし"
}

============================================================

研究を開始してください。

最低10種類のアプローチを比較してください。

過去研究がある場合、
失敗原因と成功した考え方を利用してください。

その後、最も有望な方向を掘り下げてください。

さらに、その結論を壊す方向から検証してください。

未解決問題の場合、
証明できないこと自体を失敗とはしません。

価値のある部分結果、
必要条件、
十分条件、
反例候補、
新しい補題候補、
次に検証できる研究を残してください。

JSON以外を出力しないでください。
`.trim();


      /* =====================================================
         AI CALL
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
         PARSE AI RESULT
      ===================================================== */

      let research =
        extractJson(
          ai.text,
        );


      if (!research) {

        research = {

          title:
            "AI研究回答",

          hypothesis:
            "",

          content:
            ai.text,

          evaluation:
            "△",

          confidence_level:
            1,

          status:
            "pending",

          approaches:
            [],

          failure_analysis:
            [
              "AI回答を構造化JSONとして解析できませんでした。",
            ],

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


      const hypothesis =
        cleanText(
          research.hypothesis,
        );


      let content =
        cleanText(
          research.content,
        );


      if (!content) {

        content =
          ai.text;
      }


      /* =====================================================
         EVALUATION
      ===================================================== */

      const evaluationRaw =
        cleanText(
          research.evaluation,
        );


      let evaluation =
        "△";


      if (
        evaluationRaw === "⭕" ||
        evaluationRaw === "△" ||
        evaluationRaw === "❌"
      ) {

        evaluation =
          evaluationRaw;
      }


      /* =====================================================
         CONFIDENCE
      ===================================================== */

      const confidenceRaw =
        Number(
          research.confidence_level,
        );


      let confidenceLevel =
        Number.isFinite(
          confidenceRaw,
        )
          ? Math.round(
              confidenceRaw,
            )
          : 2;


      confidenceLevel =
        clamp(
          confidenceLevel,
          1,
          5,
        );


      if (
        evaluation === "△" &&
        confidenceLevel > 3
      ) {

        confidenceLevel =
          3;
      }


      if (
        evaluation === "❌"
      ) {

        confidenceLevel =
          Math.min(
            confidenceLevel,
            2,
          );
      }


      /* =====================================================
         STATUS
      ===================================================== */

      const statusRaw =
        cleanText(
          research.status,
        ).toLowerCase();


      let status =
        "pending";


      if (
        statusRaw ===
        "completed"
      ) {

        status =
          "completed";

      } else if (
        statusRaw ===
        "failed"
      ) {

        status =
          "failed";
      }


      if (
        evaluation ===
        "❌"
      ) {

        status =
          "failed";
      }


      /* =====================================================
         STRUCTURED CONTENT
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


      const independentVerification =
        cleanText(
          research.independent_verification,
        );


      const physicalReasoning =
        cleanText(
          research.physical_reasoning,
        );


      /* =====================================================
         CONTENT FOR DB
      ===================================================== */

      const contentForDB = [

        `[ROUTE_KEY:${routeKey}]`,

        `[ROUTE_COUNT:${sameRouteCount + 1}]`,

        `【研究内容】`,

        content,

        ``,

        `【研究アプローチ】`,

        JSON.stringify(
          approaches,
          null,
          2,
        ),

        ``,

        `【失敗分析】`,

        JSON.stringify(
          failureAnalysis,
          null,
          2,
        ),

        ``,

        `【破壊的検証】`,

        JSON.stringify(
          destructiveChecks,
          null,
          2,
        ),

        ``,

        `【新しい仮説】`,

        JSON.stringify(
          newHypotheses,
          null,
          2,
        ),

        ``,

        `【独立検証】`,

        independentVerification,

        ``,

        `【物理的推論】`,

        physicalReasoning,

        ``,

        `【AI PROVIDER】`,

        ai.provider,

        ``,

        `【AI MODEL】`,

        ai.model,

      ].join("\n");


      /* =====================================================
         SAVE RESEARCH RESULT
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

            hypothesis:
              hypothesis,

            content:
              contentForDB,

            status:
              status,

            evaluation:
              evaluation,

            confidence_level:
              confidenceLevel,

            is_human_saved:
              false,

          })
          .select(

            "id,project_id,title,hypothesis,content,status,evaluation,confidence_level,is_human_saved,created_at,updated_at",

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

     /* =========================================================
   CHECK EXISTING NEXT JOB
========================================================= */

async function nextJobAlreadyExists(
  supabase: any,
  projectId: string,
  nextTheme: string,
): Promise<boolean> {

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "research_jobs",
      )
      .select(
        "id,status,payload",
      )
      .eq(
        "project_id",
        projectId,
      )
      .in(
        "status",
        [
          "queued",
          "running",
        ],
      )
      .limit(
        100,
      );


  if (error) {

    throw new Error(
      `Failed to check existing next jobs: ${error.message}`,
    );
  }


  const jobs =
    data ?? [];


  /*
   * 比較用に空白・改行を正規化する。
   *
   * これにより、
   *
   * "A\nB"
   *
   * と
   *
   * "A  B"
   *
   * のような微妙な差による重複を減らす。
   */

  const normalizeTheme = (
    value: unknown,
  ): string => {

    return cleanText(
      value,
    )
      .replace(
        /\s+/g,
        " ",
      )
      .trim();
  };


  const normalizedTarget =
    normalizeTheme(
      nextTheme,
    );


  if (!normalizedTarget) {

    return false;
  }


  for (
    const job of jobs
  ) {

    let payload: any = {};


    if (
      job?.payload &&
      typeof job.payload === "object"
    ) {

      payload =
        job.payload;

    } else if (
      typeof job?.payload === "string"
    ) {

      try {

        payload =
          JSON.parse(
            job.payload,
          );

      } catch {

        payload = {};
      }
    }


    const existingTheme =
      normalizeTheme(

        payload?.theme ??
        payload?.message,

      );


    if (
      existingTheme &&
      existingTheme ===
        normalizedTarget
    ) {

      return true;
    }
  }


  return false;
}


/* =========================================================
   CREATE NEXT RESEARCH JOB
========================================================= */

async function createNextResearchJob(
  supabase: any,
  projectId: string,
  parentResultId: string,
  currentMessage: string,
  research: Record<string, unknown>,
): Promise<{
  created: boolean;
  job_id: string | null;
  theme: string;
  reason?: string;
}> {

  /*
   * 1研究結果につき次ジョブは1件だけ。
   *
   * buildNextResearchTheme() 側で
   * 「同じ前研究をそのまま繰り返す」
   * ことを避ける。
   */

  const nextTheme =
    buildNextResearchTheme(
      currentMessage,
      research,
    );


  if (!nextTheme.trim()) {

    return {

      created:
        false,

      job_id:
        null,

      theme:
        "",

      reason:
        "No next research theme was generated.",

    };
  }


  /*
   * 現在のテーマと完全に同じなら、
   * 無限ループ防止のため作成しない。
   */

  const normalizeTheme = (
    value: unknown,
  ): string => {

    return cleanText(
      value,
    )
      .replace(
        /\s+/g,
        " ",
      )
      .trim();
  };


  const normalizedCurrent =
    normalizeTheme(
      currentMessage,
    );


  const normalizedNext =
    normalizeTheme(
      nextTheme,
    );


  if (
    normalizedCurrent &&
    normalizedCurrent ===
      normalizedNext
  ) {

    console.log(
      "Next research theme is identical to current theme. Skipping.",
    );


    return {

      created:
        false,

      job_id:
        null,

      theme:
        nextTheme,

      reason:
        "Generated next theme is identical to the current research theme.",

    };
  }


  /*
   * 既にqueued/runningの同一テーマが存在する場合は、
   * 新しいジョブを作らない。
   */

  const exists =
    await nextJobAlreadyExists(
      supabase,
      projectId,
      nextTheme,
    );


  if (exists) {

    console.log(
      "Next research job already exists. Skipping duplicate.",
    );


    return {

      created:
        false,

      job_id:
        null,

      theme:
        nextTheme,

      reason:
        "Duplicate queued/running job already exists.",

    };
  }


  /*
   * 次ジョブpayload。
   */

  const nextPayload = {

    theme:
      nextTheme,

    message:
      nextTheme,

    project_id:
      projectId,

    parent_result_id:
      parentResultId,

    auto_generated:
      true,

    source:
      "smart-handler",

    created_from_result_id:
      parentResultId,

    created_from_message:
      currentMessage,

    created_at:
      new Date().toISOString(),

  };


  /*
   * DBへqueued jobを作成。
   */

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "research_jobs",
      )
      .insert({

        project_id:
          projectId,

        status:
          "queued",

        priority:
          0,

        payload:
          nextPayload,

      })
      .select(
        "id,status,project_id,priority,payload,created_at",
      )
      .single();


  if (error) {

    throw new Error(
      `Failed to create next research job: ${error.message}`,
    );
  }


  if (!data) {

    throw new Error(
      "Next research job was created but could not be returned.",
    );
  }


  console.log(
    "Next research job created:",
    data.id,
  );


  return {

    created:
      true,

    job_id:
      data.id,

    theme:
      nextTheme,

  };
}


/* =========================================================
   MAIN
========================================================= */

Deno.serve(
  async (
    req: Request,
  ) => {

    /* =====================================================
       CORS
    ===================================================== */

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
         ENV
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
          "SUPABASE_URL is missing.",
        );
      }


      if (!serviceRoleKey) {

        throw new Error(
          "SUPABASE_SERVICE_ROLE_KEY is missing.",
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
         REQUEST BODY
      ===================================================== */

      let body: any = {};


      try {

        body =
          await req.json();

      } catch {

        body = {};
      }


      const payload =
        body?.payload &&
        typeof body.payload === "object"
          ? body.payload
          : {};


      /*
       * Workerから
       *
       * message
       * theme
       *
       * のどちらでも受け取る。
       */

      const message =
        cleanText(

          body?.message ??
          body?.theme ??
          payload?.message ??
          payload?.theme,

        ).trim();


      const projectId =
        cleanText(

          body?.project_id ??
          payload?.project_id ??
          DEFAULT_PROJECT_ID,

        ).trim();


      const physicsEnabled =
        Boolean(

          body?.physics_enabled ??
          payload?.physics_enabled ??
          body?.physical_reasoning ??
          payload?.physical_reasoning ??
          false,

        );


      const researchRules =
        body?.research_rules ??
        payload?.research_rules ??
        {};


      const parentResultId =
        cleanText(

          body?.parent_result_id ??
          payload?.parent_result_id,

        ).trim();


      /* =====================================================
         MESSAGE VALIDATION
      ===================================================== */

      if (!message) {

        return jsonResponse(

          {
            ok:
              false,

            error:
              "Queued job has no message or theme",
          },

          400,

        );
      }


      /* =====================================================
         LOAD HISTORY
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

            "id,title,hypothesis,content,status,evaluation,confidence_level,is_human_saved,created_at,updated_at",

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
         ROUTE COUNT
      ===================================================== */

      const sameRouteCount =
        history.filter(

          (item: any) => {

            const content =
              cleanText(
                item?.content,
              );


            return content.includes(
              `[ROUTE_KEY:${routeKey}]`,
            );
          },

        ).length;


      const routeBlocked =
        sameRouteCount >=
        ROUTE_BLOCK_LIMIT;


      /* =====================================================
         MEMORY
      ===================================================== */

      const memory =
        history
          .map(

            (
              item: any,
              index: number,
            ) => {

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

                `evaluation=${cleanText(
                  item?.evaluation,
                )}`,

                `confidence_level=${cleanText(
                  item?.confidence_level,
                )}`,

                `hypothesis=${cleanText(
                  item?.hypothesis,
                )}`,

                `content=${cleanText(
                  item?.content,
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
========================================================= */

      const systemPrompt = `
あなたは Research AI Lab の自律数学研究AIです。

目的は未解決問題について、
研究可能な部分を発見し、
仮説・検証・反証・別アプローチを継続することです。

絶対に、証明されていないことを
証明済みとして扱ってはいけません。

============================================================
基本原則
============================================================

1. 事実と仮説を分離する。
2. 証明されていないことを証明済みとしない。
3. 未解決だからという理由だけで停止しない。
4. 部分問題を発見する。
5. 必要条件を探す。
6. 十分条件を探す。
7. 反例を探す。
8. 境界ケースを調べる。
9. 背理法を検討する。
10. 逆向き推論を検討する。
11. 帰納的構造を調べる。
12. 演繹的構造を調べる。
13. 別表現へ変換する。
14. 既知の定理との接続を探す。
15. 数値実験を検討する。
16. 別証明を探す。
17. 他分野との類推を検討する。
18. 必ず結論を壊す方向を検討する。
19. 過去の失敗を繰り返さない。
20. 最後に独立した観点から検証する。

============================================================
研究アプローチ
============================================================

最低10種類の研究アプローチを比較してください。

候補：

A. 直接証明
B. 背理法
C. 逆向き推論
D. 反例探索
E. 仮説破壊
F. 特殊ケース
G. 境界ケース
H. 帰納
I. 演繹
J. 別表現
K. 数値実験
L. 別証明
M. 既知定理との接続
N. 他分野との類推
O. 物理的モデル
P. 過去研究の失敗原因

すべてを完全に実行できなくてもよい。

重要なのは、
どの方向が有望か、
なぜ他の方向が弱いか、
を比較することです。

============================================================
反証
============================================================

有力な仮説を発見しても、そのまま採用してはいけません。

必ず、

・反例
・境界例
・特殊例
・隠れた仮定
・論理の飛躍
・未検証部分
・別解釈
・反対方向の推論

を確認してください。

============================================================
過去研究
============================================================

過去研究は答えではありません。

過去研究から、

・失敗原因
・有効だった方法
・無効だった方法
・未検証の方向
・繰り返し失敗する条件

を抽出してください。

============================================================
評価
============================================================

evaluation は必ず次の3つのいずれか：

"⭕"
"△"
"❌"

⭕
論理的に成立し、十分な根拠が確認できる部分。

△
興味深いが未検証、または証明が不足している部分。

❌
反例・矛盾・計算ミス・論理破綻が確認された部分。

重要：

未解決問題について新しい仮説を出しただけなら、
原則として△です。

「面白そう」という理由だけで⭕にしないでください。

============================================================
confidence_level
============================================================

1 = ほぼ推測
2 = 根拠はあるが未検証
3 = 複数の根拠があり比較的有望
4 = 強い検証がある
5 = 数学的に十分確認された結果

未解決問題の新規仮説を安易に4や5にしないでください。

============================================================
status
============================================================

新規研究・未確定研究：
"pending"

研究結果として整理済み：
"completed"

明確な失敗：
"failed"

通常の新規研究ではまず"pending"を使用してください。

============================================================
重要：出力サイズ
============================================================

研究内容は十分に具体的にしてください。

ただし、不要な長文説明や同じ内容の繰り返しは避けてください。

10以上のアプローチを比較しつつ、
重要な論理・検証・反証を優先してください。

============================================================
JSON
============================================================

必ず次のJSONだけを返してください。

{
  "title": "研究タイトル",
  "hypothesis": "中心仮説",
  "content": "研究内容。計算、論理、検証、反証、次の研究を含める",
  "evaluation": "⭕|△|❌",
  "confidence_level": 1,
  "status": "pending",
  "approaches": [
    {
      "name": "アプローチ名",
      "idea": "何を試すか",
      "result": "どうなったか",
      "promising": true
    }
  ],
  "failure_analysis": [
    "失敗原因"
  ],
  "destructive_checks": [
    "結論を壊すための検証"
  ],
  "new_hypotheses": [
    "派生仮説"
  ],
  "independent_verification": "独立検証",
  "physical_reasoning": "物理モードを使用した場合のみ記述"
}

JSON以外を出力しないでください。
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
    ? "ON"
    : "OFF"
}

【同一ルート使用回数】

${sameRouteCount}

【同一ルート制限】

${
  routeBlocked
    ? "このルートは3回以上使用済み。必ず別ルートを選択してください。"
    : "このルートはまだ3回未満です。"
}

【研究ルートキー】

${routeKey}

【過去研究】

${
  memory ||
  "まだ研究履歴はありません。"
}

【研究ルール】

${JSON.stringify(
  researchRules,
  null,
  2,
)}

【再検証対象】

${
  parentResultId ||
  "なし"
}

============================================================

研究を開始してください。

最低10種類のアプローチを比較してください。

過去研究がある場合、
失敗原因と成功した考え方を利用してください。

その後、最も有望な方向を掘り下げてください。

さらに、その結論を壊す方向から検証してください。

未解決問題の場合、
証明できないこと自体を失敗とはしません。

価値のある部分結果、
必要条件、
十分条件、
反例候補、
新しい補題候補、
次に検証できる研究を残してください。

不要な繰り返しを避け、
限られた出力量を数学的な検証に優先して使ってください。

JSON以外を出力しないでください。
`.trim();


      /* =====================================================
         AI CALL
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
         PARSE AI RESULT
      ===================================================== */

      let research =
        extractJson(
          ai.text,
        );


      if (!research) {

        research = {

          title:
            "AI研究回答",

          hypothesis:
            "",

          content:
            ai.text,

          evaluation:
            "△",

          confidence_level:
            1,

          status:
            "pending",

          approaches:
            [],

          failure_analysis:
            [
              "AI回答を構造化JSONとして解析できませんでした。",
            ],

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


      const hypothesis =
        cleanText(
          research.hypothesis,
        );


      let content =
        cleanText(
          research.content,
        );


      if (!content) {

        content =
          ai.text;
      }


      /* =====================================================
         EVALUATION
      ===================================================== */

      const evaluationRaw =
        cleanText(
          research.evaluation,
        );


      let evaluation =
        "△";


      if (
        evaluationRaw ===
        "⭕" ||
        evaluationRaw ===
        "△" ||
        evaluationRaw ===
        "❌"
      ) {

        evaluation =
          evaluationRaw;
      }


      /* =====================================================
         CONFIDENCE
      ===================================================== */

      const confidenceRaw =
        Number(
          research.confidence_level,
        );


      let confidenceLevel =
        Number.isFinite(
          confidenceRaw,
        )
          ? Math.round(
              confidenceRaw,
            )
          : 2;


      confidenceLevel =
        clamp(
          confidenceLevel,
          1,
          5,
        );


      if (
        evaluation === "△" &&
        confidenceLevel > 3
      ) {

        confidenceLevel =
          3;
      }


      if (
        evaluation === "❌"
      ) {

        confidenceLevel =
          Math.min(
            confidenceLevel,
            2,
          );
      }


      /* =====================================================
         STATUS
      ===================================================== */

      const statusRaw =
        cleanText(
          research.status,
        ).toLowerCase();


      let status =
        "pending";


      if (
        statusRaw ===
        "completed"
      ) {

        status =
          "completed";

      } else if (
        statusRaw ===
        "failed"
      ) {

        status =
          "failed";

      } else {

        status =
          "pending";
      }


      if (
        evaluation ===
        "❌"
      ) {

        status =
          "failed";
      }


      /* =====================================================
         STRUCTURED CONTENT
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


      const independentVerification =
        cleanText(
          research.independent_verification,
        );


      const physicalReasoning =
        cleanText(
          research.physical_reasoning,
        );


      /* =====================================================
         CONTENT FOR DB
      ===================================================== */

      const contentForDB = [

        `[ROUTE_KEY:${routeKey}]`,

        `[ROUTE_COUNT:${sameRouteCount + 1}]`,

        `【研究内容】`,

        content,

        ``,

        `【研究アプローチ】`,

        JSON.stringify(
          approaches,
          null,
          2,
        ),

        ``,

        `【失敗分析】`,

        JSON.stringify(
          failureAnalysis,
          null,
          2,
        ),

        ``,

        `【破壊的検証】`,

        JSON.stringify(
          destructiveChecks,
          null,
          2,
        ),

        ``,

        `【新しい仮説】`,

        JSON.stringify(
          newHypotheses,
          null,
          2,
        ),

        ``,

        `【独立検証】`,

        independentVerification,

        ``,

        `【物理的推論】`,

        physicalReasoning,

        ``,

        `【AI PROVIDER】`,

        ai.provider,

        ``,

        `【AI MODEL】`,

        ai.model,

      ].join("\n");


      /* =====================================================
         SAVE RESEARCH RESULT
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

            hypothesis:
              hypothesis,

            content:
              contentForDB,

            status:
              status,

            evaluation:
              evaluation,

            confidence_level:
              confidenceLevel,

            is_human_saved:
              false,

          })
          .select(

            "id,project_id,title,hypothesis,content,status,evaluation,confidence_level,is_human_saved,created_at,updated_at",

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
         CREATE NEXT JOB
      ===================================================== */

      let nextJob = {

        created:
          false,

        job_id:
          null as string | null,

        theme:
          "",

        reason:
          "",

      };


      try {

        nextJob =
          await createNextResearchJob(

            supabase,

            projectId,

            savedResult.id,

            message,

            research,

          );

      } catch (nextJobError) {

        /*
         * 研究結果保存後に次ジョブだけ失敗しても、
         * 今回の研究結果は成功として残す。
         */

        console.error(
          "Failed to create next research job:",
          nextJobError,
        );


        nextJob = {

          created:
            false,

          job_id:
            null,

          theme:
            "",

          reason:
            errorText(
              nextJobError,
            ),

        };
      }


      /* =====================================================
         SUCCESS
      ===================================================== */

      return jsonResponse({

        ok:
          true,

        processed:
          true,

        saved:
          true,

        result_id:
          savedResult.id,

        provider:
          ai.provider,

        model:
          ai.model,

        fallback_attempts:
          ai.attempts,

        next_job:
          nextJob,

        research: {

          id:
            savedResult.id,

          project_id:
            savedResult.project_id,

          title:
            savedResult.title,

          hypothesis:
            savedResult.hypothesis,

          content:
            savedResult.content,

          status:
            savedResult.status,

          evaluation:
            savedResult.evaluation,

          confidence_level:
            savedResult.confidence_level,

          is_human_saved:
            savedResult.is_human_saved,

          created_at:
            savedResult.created_at,

          updated_at:
            savedResult.updated_at,

          route_key:
            routeKey,

          route_count:
            sameRouteCount + 1,

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

          processed:
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
