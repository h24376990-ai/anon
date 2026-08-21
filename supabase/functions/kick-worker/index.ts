// ============================================================
// Research AI Lab
// kick-worker
//
// 役割:
//  1. queued の研究ジョブを探す
//  2. running に変更する
//  3. smart-handler に研究を依頼する
//  4. 結果を research_jobs に保存
//  5. completed / failed にする
//
// GitHub Actions から定期的に呼び出される。
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL")!;

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PROJECT_ID =
  Deno.env.get("RESEARCH_PROJECT_ID")!;

const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") || "";

const SMART_HANDLER_URL =
  `${SUPABASE_URL}/functions/v1/smart-handler`;

const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );


function json(
  body: unknown,
  status = 200
) {

  return new Response(
    JSON.stringify(body, null, 2),
    {
      status,
      headers: {
        "Content-Type":
          "application/json"
      }
    }
  );

}


function log(
  ...args: unknown[]
) {

  console.log(
    "[kick-worker]",
    ...args
  );

}


/*
 * ------------------------------------------------------------
 * 1ジョブ取得
 * ------------------------------------------------------------
 */

async function claimJob() {

  /*
   * まず queued を1件取得。
   *
   * priority DESC
   * created_at ASC
   *
   * 優先度が高いものを先に処理し、
   * 同じ優先度なら古いものから処理。
   */

  const {
    data,
    error
  } =
    await supabase
      .from("research_jobs")
      .select("*")
      .eq(
        "project_id",
        PROJECT_ID
      )
      .eq(
        "status",
        "queued"
      )
      .order(
        "priority",
        {
          ascending: false
        }
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      )
      .limit(1)
      .maybeSingle();


  if (error)
    throw error;


  if (!data)
    return null;


  /*
   * running に変更。
   *
   * 取得した直後に別workerが同じjobを
   * 取らないよう、id + queued で更新する。
   */

  const {
    data: claimed,
    error: claimError
  } =
    await supabase
      .from("research_jobs")
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
        data.id
      )
      .eq(
        "project_id",
        PROJECT_ID
      )
      .eq(
        "status",
        "queued"
      )
      .select("*")
      .maybeSingle();


  if (claimError)
    throw claimError;


  /*
   * ここがnullなら、別workerが先に取得した。
   */

  if (!claimed) {

    log(
      "Job was already claimed:",
      data.id
    );

    return null;

  }


  return claimed;

}


/*
 * ------------------------------------------------------------
 * smart-handler 呼び出し
 * ------------------------------------------------------------
 */

async function executeResearch(
  job: any
) {

  const payload =
    job.payload || {};


  const requestBody = {

    ...payload,

    job_id:
      job.id,

    project_id:
      job.project_id,

    job_type:
      job.job_type,

    worker:
      "kick-worker",

    background:
      true

  };


  log(
    "Calling smart-handler:",
    job.id
  );


  const headers: Record<string, string> = {

    "Content-Type":
      "application/json"

  };


  /*
   * smart-handler 側でJWTチェックをしている
   * 場合に備える。
   */

  if (SUPABASE_ANON_KEY) {

    headers[
      "Authorization"
    ] =
      `Bearer ${SUPABASE_ANON_KEY}`;

  }


  const controller =
    new AbortController();


  /*
   * 研究処理が長時間化しても
   * Edge Function側で無限待機しない。
   *
   * 10分。
   */

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      10 * 60 * 1000
    );


  try {

    const response =
      await fetch(
        SMART_HANDLER_URL,
        {
          method:
            "POST",

          headers,

          body:
            JSON.stringify(
              requestBody
            ),

          signal:
            controller.signal
        }
      );


    const text =
      await response.text();


    let result: any;


    try {

      result =
        text
          ? JSON.parse(text)
          : null;

    } catch {

      result = {
        raw:
          text
      };

    }


    if (!response.ok) {

      throw new Error(
        `smart-handler HTTP ${response.status}: ${
          text || "Unknown error"
        }`
      );

    }


    return result;

  } finally {

    clearTimeout(
      timeout
    );

  }

}


/*
 * ------------------------------------------------------------
 * ジョブ成功
 * ------------------------------------------------------------
 */

async function completeJob(
  jobId: string,
  result: any
) {

  const {
    error
  } =
    await supabase
      .from("research_jobs")
      .update({

        status:
          "completed",

        result,

        finished_at:
          new Date().toISOString(),

        error_message:
          null

      })
      .eq(
        "id",
        jobId
      )
      .eq(
        "project_id",
        PROJECT_ID
      );


  if (error)
    throw error;

}


/*
 * ------------------------------------------------------------
 * ジョブ失敗
 * ------------------------------------------------------------
 */

async function failJob(
  jobId: string,
  error: unknown
) {

  const message =
    error instanceof Error
      ? error.message
      : String(error);


  console.error(
    "[kick-worker] Job failed:",
    message
  );


  const {
    error: updateError
  } =
    await supabase
      .from("research_jobs")
      .update({

        status:
          "failed",

        finished_at:
          new Date().toISOString(),

        error_message:
          message

      })
      .eq(
        "id",
        jobId
      )
      .eq(
        "project_id",
        PROJECT_ID
      );


  if (updateError)
    console.error(
      "[kick-worker] Failed to update job:",
      updateError
    );

}


/*
 * ------------------------------------------------------------
 * MAIN
 * ------------------------------------------------------------
 */

Deno.serve(
  async (req) => {

    /*
     * GitHub ActionsからのPOSTを想定。
     * OPTIONSにも対応。
     */

    if (
      req.method ===
      "OPTIONS"
    ) {

      return new Response(
        "ok",
        {
          headers: {
            "Access-Control-Allow-Origin":
              "*",
            "Access-Control-Allow-Headers":
              "authorization, x-client-info, apikey, content-type",
            "Access-Control-Allow-Methods":
              "POST, OPTIONS"
          }
        }
      );

    }


    if (
      req.method !==
      "POST"
    ) {

      return json(
        {
          ok:
            false,

          error:
            "POST only"
        },
        405
      );

    }


    log(
      "Worker started"
    );


    if (!SUPABASE_URL)
      return json(
        {
          ok:
            false,

          error:
            "SUPABASE_URL is missing"
        },
        500
      );


    if (!SUPABASE_SERVICE_ROLE_KEY)
      return json(
        {
          ok:
            false,

          error:
            "SUPABASE_SERVICE_ROLE_KEY is missing"
        },
        500
      );


    if (!PROJECT_ID)
      return json(
        {
          ok:
            false,

          error:
            "RESEARCH_PROJECT_ID is missing"
        },
        500
      );


    try {

      /*
       * ------------------------------------------------------
       * queued jobを1件取得
       * ------------------------------------------------------
       */

      const job =
        await claimJob();


      /*
       * キューが空なら正常終了。
       */

      if (!job) {

        log(
          "No queued jobs."
        );


        return json({
          ok:
            true,

          processed:
            false,

          message:
            "No queued jobs"
        });

      }


      log(
        "Claimed job:",
        job.id
      );


      /*
       * ------------------------------------------------------
       * 研究実行
       * ------------------------------------------------------
       */

      try {

        const result =
          await executeResearch(
            job
          );


        /*
         * ----------------------------------------------------
         * completed
         * ----------------------------------------------------
         */

        await completeJob(
          job.id,
          result
        );


        log(
          "Job completed:",
          job.id
        );


        return json({

          ok:
            true,

          processed:
            true,

          job_id:
            job.id,

          status:
            "completed",

          result

        });


      } catch (error) {

        /*
         * ----------------------------------------------------
         * failed
         * ----------------------------------------------------
         */

        await failJob(
          job.id,
          error
        );


        return json({

          ok:
            false,

          processed:
            true,

          job_id:
            job.id,

          status:
            "failed",

          error:
            error instanceof Error
              ? error.message
              : String(error)

        }, 500);

      }


    } catch (error) {

      console.error(
        "[kick-worker] Fatal error:",
        error
      );


      return json({

        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(error)

      }, 500);

    }

  }
);
