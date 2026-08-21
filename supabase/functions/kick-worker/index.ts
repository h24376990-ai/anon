/* =========================================================
   Research AI Lab
   kick-worker
   Background Research Worker
   ========================================================= */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


/* =========================================================
   ENV
========================================================= */

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL")!;

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const OPENROUTER_API_KEY =
  Deno.env.get("OPENROUTER_API_KEY")!;

const OPENROUTER_MODEL =
  Deno.env.get("OPENROUTER_MODEL") ||
  "openrouter/auto";


/* =========================================================
   CONFIG
========================================================= */

const WORKER_SECRET =
  Deno.env.get("WORKER_SECRET") || "";

const MAX_JOB_TIME_MS =
  110_000;

const MAX_HISTORY =
  120;

const MAX_CONTENT_LENGTH =
  6000;


/* =========================================================
   SUPABASE
========================================================= */

const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false
      }
    }
  );


/* =========================================================
   TYPES
========================================================= */

type Job = {
  id: string;
  project_id: string;
  job_type: string;
  status: string;
  priority: number | null;
  payload: any;
  result: any;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};


type ResearchResult = {
  id: string;
  title: string | null;
  hypothesis: string | null;
  content: any;
  evaluation: string | null;
  confidence_level: number | null;
  created_at: string;
};


/* =========================================================
   RESPONSE
========================================================= */

function json(
  body: any,
  status = 200
) {

  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
        "Cache-Control":
          "no-store"
      }
    }
  );

}


/* =========================================================
   TEXT HELPERS
========================================================= */

function safeString(
  value: any,
  max = MAX_CONTENT_LENGTH
) {

  let text = "";

  try {

    if (
      typeof value === "string"
    ) {

      text = value;

    } else {

      text =
        JSON.stringify(
          value
        );

    }

  } catch {

    text =
      String(value ?? "");

  }

  if (
    text.length > max
  ) {

    return (
      text.slice(
        0,
        max
      ) +
      "\n...[truncated]"
    );

  }

  return text;

}


function normalizeJson(
  value: any
) {

  if (!value)
    return {};

  if (
    typeof value === "object"
  ) {

    return value;

  }

  try {

    return JSON.parse(
      value
    );

  } catch {

    return {
      text:
        String(value)
    };

  }

}


/* =========================================================
   REQUEST VALIDATION
========================================================= */

function authorized(
  req: Request
) {

  if (!WORKER_SECRET)
    return true;

  const secret =
    req.headers.get(
      "x-worker-secret"
    );

  return (
    secret ===
    WORKER_SECRET
  );

}


/* =========================================================
   CLAIM JOB
========================================================= */

async function claimJob() {

  /*
   * まず queued のジョブを取得。
   *
   * priority DESC
   * created_at ASC
   *
   * 高優先度を先に処理し、
   * 同順位なら古いジョブを優先。
   */

  const {
    data: candidates,
    error
  } =
    await supabase
      .from(
        "research_jobs"
      )
      .select(
        [
          "id",
          "project_id",
          "job_type",
          "status",
          "priority",
          "payload",
          "result",
          "error_message",
          "started_at",
          "finished_at",
          "created_at"
        ].join(",")
      )
      .eq(
        "status",
        "queued"
      )
      .order(
        "priority",
        {
          ascending: false,
          nullsFirst: false
        }
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      )
      .limit(10);


  if (error)
    throw error;


  if (!candidates?.length)
    return null;


  /*
   * 同時実行された場合でも、
   *
   * status = queued
   *
   * を条件にしているため、
   * 先に別workerがrunningにしたジョブは
   * 更新できない。
   */

  for (
    const candidate of candidates
  ) {

    const now =
      new Date().toISOString();


    const {
      data,
      error:
        updateError
    } =
      await supabase
        .from(
          "research_jobs"
        )
        .update({
          status:
            "running",

          started_at:
            now,

          error_message:
            null
        })
        .eq(
          "id",
          candidate.id
        )
        .eq(
          "status",
          "queued"
        )
        .select(
          [
            "id",
            "project_id",
            "job_type",
            "status",
            "priority",
            "payload",
            "result",
            "error_message",
            "started_at",
            "finished_at",
            "created_at"
          ].join(",")
        );


    if (updateError)
      throw updateError;


    if (
      data &&
      data.length > 0
    ) {

      return data[0] as Job;

    }

  }


  return null;

}


/* =========================================================
   LOAD ALL USEFUL HISTORY
========================================================= */

async function loadHistory(
  projectId: string
) {

  /*
   * project_idで完全分離。
   *
   * 他の研究テーマの結果が
   * 混ざらないようにする。
   */

  const {
    data,
    error
  } =
    await supabase
      .from(
        "research_results"
      )
      .select(
        [
          "id",
          "title",
          "hypothesis",
          "content",
          "evaluation",
          "confidence_level",
          "created_at"
        ].join(",")
      )
      .eq(
        "project_id",
        projectId
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(
        MAX_HISTORY
      );


  if (error)
    throw error;


  return (
    data || []
  ) as ResearchResult[];

}


/* =========================================================
   CREATE RESEARCH MEMORY
========================================================= */

function buildResearchMemory(
  history: ResearchResult[]
) {

  const positive =
    history.filter(
      x =>
        x.evaluation === "⭕" ||
        x.evaluation === "⭕️"
    );


  const uncertain =
    history.filter(
      x =>
        x.evaluation === "△"
    );


  const negative =
    history.filter(
      x =>
        x.evaluation === "❌"
    );


  return {

    total:
      history.length,

    positive:
      positive.length,

    uncertain:
      uncertain.length,

    negative:
      negative.length,

    previous_results:
      history.map(
        item => ({
          id:
            item.id,

          title:
            safeString(
              item.title,
              500
            ),

          hypothesis:
            safeString(
              item.hypothesis,
              1500
            ),

          evaluation:
            item.evaluation,

          confidence:
            item.confidence_level,

          content:
            safeString(
              normalizeJson(
                item.content
              ),
              3500
            ),

          created_at:
            item.created_at
        })
      )

  };

}


/* =========================================================
   RESEARCH APPROACHES
========================================================= */

const RESEARCH_APPROACHES = [

  {
    id: "direct",
    name:
      "直接構築",
    instruction:
      "問題を正面から数学的に解こうとする。既知の定理だけでなく、新しい補題や構造を構築する。"
  },

  {
    id: "contradiction",
    name:
      "背理法",
    instruction:
      "現在の仮説が偽だと仮定し、矛盾が発生するか徹底的に調べる。"
  },

  {
    id: "destroy",
    name:
      "結論破壊",
    instruction:
      "現在もっとも有望な結論を意図的に壊す。隠れた仮定、境界条件、例外、反例候補を探す。"
  },

  {
    id: "counterexample",
    name:
      "反例探索",
    instruction:
      "小さい値、特殊ケース、極端なケース、境界ケースを調べ、仮説を破壊する反例を探す。"
  },

  {
    id: "backward",
    name:
      "逆向き推論",
    instruction:
      "最終的に必要な結論から逆算し、その結論が成立するために必要な条件を洗い出す。"
  },

  {
    id: "forward",
    name:
      "順方向推論",
    instruction:
      "定義・仮定から出発して、一歩ずつ論理的帰結を積み上げる。"
  },

  {
    id: "alternative_proof",
    name:
      "別証明",
    instruction:
      "同じ結論を別の数学分野・別の定理・別の表現から導出できないか試す。"
  },

  {
    id: "transformation",
    name:
      "変換",
    instruction:
      "問題を別の表現へ変換する。解析、代数、幾何、確率、離散構造などの視点を切り替える。"
  },

  {
    id: "numerical",
    name:
      "数値実験",
    instruction:
      "多数の数値例を調べ、規則性、例外、漸近挙動、パターンを発見する。ただし数値確認だけで証明とは判断しない。"
  },

  {
    id: "special_case",
    name:
      "特殊ケース分解",
    instruction:
      "一般問題を特殊ケースに分解し、どの条件で成立・失敗するかを調べる。"
  },

  {
    id: "generalization",
    name:
      "一般化",
    instruction:
      "仮説をより一般的な形へ拡張し、一般化によって本質的な構造が見えないか調べる。"
  },

  {
    id: "restriction",
    name:
      "制限",
    instruction:
      "逆に条件を厳しくし、扱いやすい部分問題から本質へ近づく。"
  },

  {
    id: "analogy",
    name:
      "数学的類推",
    instruction:
      "類似した既知問題、定理、構造との対応関係を探す。ただし類推を証明と混同しない。"
  },

  {
    id: "failure_analysis",
    name:
      "失敗原因分析",
    instruction:
      "過去の失敗研究を比較し、共通する失敗原因を抽出して新しい研究ルートから除外する。"
  },

  {
    id: "route_branching",
    name:
      "派生分岐",
    instruction:
      "現在の結果から少なくとも複数の新しい仮説・研究ルートを派生させる。"
  },

  {
    id: "independent_verification",
    name:
      "独立検証",
    instruction:
      "現在の結論を使わず、別の論理経路から同じ結論を再構築できるか調べる。"
  }

];


/* =========================================================
   BUILD PROMPT
========================================================= */

function buildResearchPrompt(
  job: Job,
  history: ResearchResult[]
) {

  const payload =
    normalizeJson(
      job.payload
    );


  const theme =
    payload.theme ||
    "未指定の数学研究";


  const physicsMode =
    payload.physics_mode ??
    payload.use_physics ??
    false;


  const memory =
    buildResearchMemory(
      history
    );


  const routeRules =
    payload.research_rules ||
    {};


  const approachText =
    RESEARCH_APPROACHES
      .map(
        (a, i) =>
          `${i + 1}. ${a.name}: ${a.instruction}`
      )
      .join("\n");


  return `あなたはResearch AI Labの自律数学研究AIです。

あなたの目的は「未解決問題に対して、回答できるかどうかを判断すること」ではありません。

目的は、
「現時点で証明されていない問題についても、証明・反証・部分結果・新しい補題・新しい研究ルートを生み出すために試行を継続すること」
です。

研究テーマ:
${theme}

重要:
「これは未解決問題なので回答できません」
「証明されていないので不可能です」
だけで終了してはいけません。

リーマン予想のような未解決問題でも、
・既知の証明ではない
・証明には至っていない
という事実を明示したうえで、
研究可能な仮説を作り、
検証し、
壊し、
派生させ、
次の研究ルートを作ってください。

==============================
絶対ルール
==============================

1. 嘘をつかない。
2. 証明されていないものを「証明した」と言わない。
3. 数値実験を数学的証明と混同しない。
4. 文献で確認していないことを「既知」と断定しない。
5. ただし未解決だからという理由だけで研究を終了しない。
6. 現在の結論を積極的に破壊する。
7. 反例を探す。
8. 反例が見つからなくても証明とは判断しない。
9. 過去の失敗を再利用する。
10. 同じ失敗ルートを繰り返さない。
11. 研究結果を複数の独立した方向へ派生させる。
12. 成功可能性が低くても、情報価値が高い研究を行う。
13. 研究テーマを別問題に勝手に変更しない。
14. 過去の研究結果と今回の研究を混同しない。
15. project_idの異なる研究結果を利用しない。

==============================
研究アプローチ
==============================

最低10種類以上を検討してください。

${approachText}

ただし、単に名前を列挙するだけでは不十分です。

今回のテーマに対して、
どのアプローチが有効そうか、
どのアプローチが失敗しそうか、
なぜそう判断したかを書いてください。

==============================
結論破壊
==============================

研究途中で得られた結論を、そのまま採用してはいけません。

最低でも以下を確認してください。

・隠れた仮定
・論理の飛躍
・特殊ケース依存
・極端なケース
・境界条件
・反例候補
・必要条件と十分条件の混同
・数値実験からの過剰一般化
・既知定理の適用条件
・循環論法

そして、
「この結論が間違っているとしたらどこが壊れるか」
を考えてください。

==============================
過去研究の活用
==============================

以下は同一project内の過去研究です。

${safeString(
  memory,
  50000
)}

過去研究から、

・成功した考え
・失敗した考え
・共通する失敗原因
・再利用できる補題
・再利用できる変換
・避けるべき研究ルート
・まだ十分検証されていないルート

を抽出してください。

特に複数の失敗研究に共通する原因があれば、
「共通失敗原因」として明示してください。

==============================
研究ルート
==============================

同じルートを3回以上繰り返さないでください。

過去と似たルートを使う場合、
「なぜ今回は以前と違うのか」
を説明してください。

==============================
物理演算
==============================

物理演算モード:
${physicsMode ? "ON" : "OFF"}

OFFの場合:
数学的手法を中心に研究してください。

ONの場合:
数学だけでなく、
・力学系
・エネルギー
・保存則
・対称性
・確率過程
・波動
・場
・シミュレーション
などの物理的モデルを数学的探索に利用して構いません。

ただし、
物理モデルとの類似性だけを数学的証明とは判断しないでください。

==============================
出力形式
==============================

必ずJSONだけを返してください。

{
  "title": "...",
  "hypothesis": "...",

  "evaluation": "⭕ または △ または ❌",

  "confidence_level": 0,

  "status": "researching",

  "problem_status": "open | partial_progress | disproved | proven",

  "summary": "...",

  "research_question": "...",

  "approaches": [
    {
      "name": "...",
      "attempt": "...",
      "result": "...",
      "evaluation": "⭕ | △ | ❌"
    }
  ],

  "conclusion": "...",

  "destruction_test": {
    "what_was_attacked": "...",
    "possible_failure": "...",
    "counterexample_search": "...",
    "survived": true
  },

  "common_failure_causes": [
    "..."
  ],

  "reusable_knowledge": [
    "..."
  ],

  "blocked_routes": [
    "..."
  ],

  "new_branches": [
    "...",
    "...",
    "...",
    "..."
  ],

  "next_research_questions": [
    "...",
    "...",
    "..."
  ],

  "verification": {
    "independent_check": "...",
    "alternative_derivation": "...",
    "numerical_check": "...",
    "literature_check": "..."
  },

  "physics_used": ${physicsMode},

  "physics_reasoning": "...",

  "limitations": [
    "..."
  ]
}

==============================
評価基準
==============================

⭕:
・数学的に意味のある前進がある
・新しい補題や構造が得られた
・重要な反例が除外された
・既存ルートより明確に進展した
・独立検証の結果が良好
・次の研究につながる強い成果がある

△:
・完全な証明ではない
・しかし有用な観察、部分結果、仮説、研究ルートが得られた
・さらなる検証価値がある

❌:
・明確な反例
・論理的矛盾
・前提条件の破綻
・研究ルート自体が成立しない
・過去に否定済みのルートを実質的に繰り返した

重要:
「証明されていない」
だけでは❌にしない。

「研究として前進したか」
を評価してください。

==============================
最重要
==============================

この研究の最終目的は、
1回で答えを出すことではありません。

研究を積み重ねることです。

今回の研究が失敗しても、

「なぜ失敗したのか」
↓
「その失敗は他の研究にも共通するか」
↓
「何を変更すれば次は突破できるか」
↓
「そこからどんな新しい研究ルートを作れるか」

まで考えてください。

研究を終了させるのではなく、
次の探索可能性を残してください。
`;

}


/* =========================================================
   OPENROUTER
========================================================= */

async function callAI(
  prompt: string
) {

  if (!OPENROUTER_API_KEY) {

    throw new Error(
      "OPENROUTER_API_KEY が設定されていません。"
    );

  }


  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      MAX_JOB_TIME_MS
    );


  try {

    const response =
      await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method:
            "POST",

          signal:
            controller.signal,

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

          body:
            JSON.stringify({

              model:
                OPENROUTER_MODEL,

              temperature:
                0.7,

              max_tokens:
                12000,

              messages: [

                {
                  role:
                    "system",

                  content:
                    "あなたは厳密な数学研究AIです。未解決問題を理由に研究を終了せず、証明と仮説を明確に区別してください。"
                },

                {
                  role:
                    "user",

                  content:
                    prompt
                }

              ]

            })

        }
      );


    const text =
      await response.text();


    if (!response.ok) {

      throw new Error(
        `OpenRouter HTTP ${response.status}: ${text.slice(
          0,
          2000
        )}`
      );

    }


    let data: any;

    try {

      data =
        JSON.parse(text);

    } catch {

      throw new Error(
        "OpenRouterのレスポンスがJSONではありません。"
      );

    }


    const content =
      data
        ?.choices?.[0]
        ?.message?.content;


    if (!content) {

      throw new Error(
        "AIから研究結果が返されませんでした。"
      );

    }


    return content;

  } finally {

    clearTimeout(
      timeout
    );

  }

}


/* =========================================================
   EXTRACT JSON
========================================================= */

function extractJSON(
  text: string
) {

  let cleaned =
    text.trim();


  /*
   * ```json ... ```
   */

  cleaned =
    cleaned.replace(
      /^```(?:json)?\s*/i,
      ""
    );


  cleaned =
    cleaned.replace(
      /\s*```$/i,
      ""
    );


  try {

    return JSON.parse(
      cleaned
    );

  } catch {


    /*
     * JSON部分だけを探す。
     */

    const first =
      cleaned.indexOf(
        "{"
      );

    const last =
      cleaned.lastIndexOf(
        "}"
      );


    if (
      first >= 0 &&
      last > first
    ) {

      try {

        return JSON.parse(
          cleaned.slice(
            first,
            last + 1
          )
        );

      } catch {}

    }


    throw new Error(
      "AIレスポンスからJSONを解析できませんでした。"
    );

  }

}


/* =========================================================
   NORMALIZE RESULT
========================================================= */

function normalizeResult(
  raw: any
) {

  const evaluation =
    raw?.evaluation === "⭕️"
      ? "⭕"
      : raw?.evaluation === "⭕"
        ? "⭕"
        : raw?.evaluation === "❌"
          ? "❌"
          : "△";


  let confidence =
    Number(
      raw?.confidence_level
    );


  if (
    !Number.isFinite(
      confidence
    )
  ) {

    confidence =
      evaluation === "⭕"
        ? 4
        : evaluation === "△"
          ? 3
          : 1;

  }


  confidence =
    Math.max(
      0,
      Math.min(
        5,
        Math.round(
          confidence
        )
      )
    );


  return {

    title:
      safeString(
        raw?.title ||
        "研究結果",
        500
      ),

    hypothesis:
      safeString(
        raw?.hypothesis ||
        "",
        3000
      ),

    evaluation,

    confidence_level:
      confidence,

    status:
      "completed",

    content:
      raw

  };

}


/* =========================================================
   SAVE RESULT
========================================================= */

async function saveResult(
  job: Job,
  result: any
) {

  const {
    data,
    error
  } =
    await supabase
      .from(
        "research_results"
      )
      .insert({

        project_id:
          job.project_id,

        title:
          result.title,

        hypothesis:
          result.hypothesis,

        content:
          result.content,

        status:
          result.status,

        evaluation:
          result.evaluation,

        confidence_level:
          result.confidence_level,

        is_human_saved:
          false

      })
      .select()
      .single();


  if (error)
    throw error;


  return data;

}


/* =========================================================
   COMPLETE JOB
========================================================= */

async function completeJob(
  job: Job,
  result: any,
  savedResult: any
) {

  const {
    error
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
            savedResult?.id ||
            null,

          summary:
            result.content
              ?.summary ||
            "",

          evaluation:
            result.evaluation,

          confidence_level:
            result.confidence_level

        },

        finished_at:
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
        "running"
      );


  if (error)
    throw error;

}


/* =========================================================
   FAIL JOB
========================================================= */

async function failJob(
  jobId: string,
  message: string
) {

  console.error(
    "JOB FAILED:",
    jobId,
    message
  );


  const {
    error
  } =
    await supabase
      .from(
        "research_jobs"
      )
      .update({

        status:
          "failed",

        error_message:
          message.slice(
            0,
            5000
          ),

        finished_at:
          new Date().toISOString()

      })
      .eq(
        "id",
        jobId
      )
      .eq(
        "status",
        "running"
      );


  if (error) {

    console.error(
      "Failed to mark job:",
      error
    );

  }

}


/* =========================================================
   PROCESS JOB
========================================================= */

async function processJob(
  job: Job
) {

  try {

    console.log(
      "Processing:",
      job.id
    );


    /*
     * 研究対象と同じproject_idだけ取得。
     */

    const history =
      await loadHistory(
        job.project_id
      );


    /*
     * payloadにphysics_modeがあるため、
     * UIから数学のみ / 物理考慮を選択可能。
     */

    const prompt =
      buildResearchPrompt(
        job,
        history
      );


    const aiText =
      await callAI(
        prompt
      );


    const raw =
      extractJSON(
        aiText
      );


    const result =
      normalizeResult(
        raw
      );


    /*
     * 研究結果を先にDBへ保存。
     */

    const savedResult =
      await saveResult(
        job,
        result
      );


    /*
     * その後jobをcompletedへ。
     */

    await completeJob(
      job,
      result,
      savedResult
    );


    console.log(
      "Completed:",
      job.id,
      savedResult?.id
    );


    return {
      success:
        true,

      job_id:
        job.id,

      result_id:
        savedResult?.id ||
        null
    };


  } catch (error) {

    const message =
      error instanceof Error
        ? error.message
        : String(error);


    await failJob(
      job.id,
      message
    );


    return {
      success:
        false,

      job_id:
        job.id,

      error:
        message
    };

  }

}


/* =========================================================
   MAIN
========================================================= */

Deno.serve(
  async (
    req: Request
  ) => {

    try {

      if (
        req.method !==
        "POST"
      ) {

        return json(
          {
            error:
              "POST only"
          },
          405
        );

      }


      if (
        !authorized(
          req
        )
      ) {

        return json(
          {
            error:
              "Unauthorized"
          },
          401
        );

      }


      /*
       * 1回のkickで1ジョブ。
       *
       * GitHub Actionsが数分おきに
       * このfunctionを呼ぶ。
       */

      const job =
        await claimJob();


      if (!job) {

        return json({
          success:
            true,

          processed:
            false,

          message:
            "No queued jobs."
        });

      }


      const result =
        await processJob(
          job
        );


      return json(
        result,
        result.success
          ? 200
          : 500
      );


    } catch (error) {

      console.error(
        error
      );


      return json(
        {
          success:
            false,

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
