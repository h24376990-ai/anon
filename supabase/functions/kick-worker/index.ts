// ============================================================
// Research AI Lab
// supabase/functions/kick-worker/index.ts
//
// Queue Worker
// - queued job を取得
// - payload から theme / message を安全に取得
// - smart-handler に明示的に渡す
// - smart-handler の結果を返す
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is not configured");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is not configured"
  );
}

const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  );


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS"
};


/* =========================================================
   JSON RESPONSE
========================================================= */

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


/* =========================================================
   SAFE JSON
========================================================= */

function parseJson(
  value: unknown
): Record<string, any> {

  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {

    return value as Record<string, any>;

  }


  if (
    typeof value === "string"
  ) {

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

      // JSONでなくても後段で処理する

    }

  }


  return {};

}


/* =========================================================
   TEXT NORMALIZATION
========================================================= */

function cleanText(
  value: unknown
): string {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }


  return String(value).trim();

}


/* =========================================================
   EXTRACT RESEARCH THEME
========================================================= */

function extractTheme(
  job: any
): string {

  const payload =
    parseJson(job?.payload);


  /*
   * 優先順位
   *
   * 1. payload.theme
   * 2. payload.message
   * 3. payload.question
   * 4. job.theme
   * 5. job.message
   * 6. payload.title
   */

  const candidates = [

    payload.theme,

    payload.message,

    payload.question,

    job?.theme,

    job?.message,

    payload.title

  ];


  for (
    const candidate of candidates
  ) {

    const text =
      cleanText(candidate);


    if (text) {

      return text;

    }

  }


  return "";

}


/* =========================================================
   POST
========================================================= */

Deno.serve(
  async (req) => {

    /* -------------------------------------------------------
       CORS
    ------------------------------------------------------- */

    if (
      req.method === "OPTIONS"
    ) {

      return new Response(
        "ok",
        {
          headers:
            corsHeaders
        }
      );

    }


    /* -------------------------------------------------------
       POST ONLY
    ------------------------------------------------------- */

    if (
      req.method !== "POST"
    ) {

      return json(
        {
          ok: false,
          error: "POST only"
        },
        405
      );

    }


    try {

      /* -----------------------------------------------------
         REQUEST BODY
      ----------------------------------------------------- */

      const body =
        await req
          .json()
          .catch(
            () => ({})
          );


      const requestedJobId =
        cleanText(
          body?.job_id
        ) || null;


      const requestedProjectId =
        cleanText(
          body?.project_id
        ) || null;


      /* -----------------------------------------------------
         FIND QUEUED JOB
      ----------------------------------------------------- */

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
              ascending: false
            }
          )
          .order(
            "created_at",
            {
              ascending: true
            }
          )
          .limit(1);


      if (
        requestedJobId
      ) {

        query =
          query.eq(
            "id",
            requestedJobId
          );

      }


      if (
        requestedProjectId
      ) {

        query =
          query.eq(
            "project_id",
            requestedProjectId
          );

      }


      const {
        data: job,
        error: jobError
      } =
        await query
          .maybeSingle();


      if (jobError) {

        console.error(
          "Failed to fetch queued job:",
          jobError
        );

        throw jobError;

      }


      /* -----------------------------------------------------
         NO JOB
      ----------------------------------------------------- */

      if (!job) {

        return json({

          ok: true,

          processed: false,

          message:
            "No queued jobs"

        });

      }


      /* -----------------------------------------------------
         EXTRACT PAYLOAD
      ----------------------------------------------------- */

      const payload =
        parseJson(
          job.payload
        );


      const theme =
        extractTheme(
          job
        );


      console.log(
        "Queued job:",
        job.id
      );


      console.log(
        "Job payload:",
        JSON.stringify(
          payload
        )
      );


      console.log(
        "Extracted theme:",
        theme
      );


      /* -----------------------------------------------------
         INVALID JOB
      ----------------------------------------------------- */

      if (!theme) {

        /*
         * ここでは smart-handler を呼ばない。
         *
         * ただしジョブを勝手にcompletedにはしない。
         */

        console.error(
          "Queued job has no message or theme:",
          job.id,
          payload
        );


        return json(
          {

            ok: false,

            processed: false,

            job_id:
              job.id,

            error:
              "Queued job has no message or theme",

            payload:
              payload

          },
          400
        );

      }


      /* -----------------------------------------------------
         MARK RUNNING
      ----------------------------------------------------- */

      const {
        error: runningError
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
          );


      if (runningError) {

        console.error(
          "Failed to mark job running:",
          runningError
        );

        throw runningError;

      }


      /* -----------------------------------------------------
         CALL SMART HANDLER
      ----------------------------------------------------- */

      const functionUrl =
        `${SUPABASE_URL}/functions/v1/smart-handler`;


      /*
       * 重要：
       *
       * smart-handler に
       * theme と message の両方を渡す。
       *
       * これで
       * 「message or theme is required」
       * を防ぐ。
       */

      const smartHandlerPayload = {

        job_id:
          job.id,

        project_id:
          job.project_id,

        theme:
          theme,

        message:
          theme,

        /*
         * 元のpayloadも保持。
         */

        payload:
          payload,

        /*
         * smart-handler側が
         * payloadを直接見る場合の互換性。
         */

        research_job:
          job

      };


      console.log(
        "Calling smart-handler with:",
        JSON.stringify(
          {
            job_id:
              job.id,

            project_id:
              job.project_id,

            theme:
              theme,

            message:
              theme

          }
        )
      );


      const response =
        await fetch(
          functionUrl,
          {
            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json",

              "Authorization":
                `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

              "apikey":
                SUPABASE_SERVICE_ROLE_KEY

            },

            body:
              JSON.stringify(
                smartHandlerPayload
              )

          }
        );


      const responseText =
        await response.text();


      let responseData:
        unknown;


      try {

        responseData =
          JSON.parse(
            responseText
          );

      } catch {

        responseData = {

          raw:
            responseText

        };

      }


      console.log(
        "smart-handler status:",
        response.status
      );


      console.log(
        "smart-handler response:",
        JSON.stringify(
          responseData
        )
      );


      /* -----------------------------------------------------
         SMART HANDLER FAILURE
      ----------------------------------------------------- */

      if (
        !response.ok
      ) {

        const errorMessage =
          typeof responseData === "object" &&
          responseData !== null &&
          "error" in responseData
            ? String(
                (responseData as any)
                  .error
              )
            : `smart-handler HTTP ${response.status}`;


        /*
         * Worker側で失敗状態を保存。
         */

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
              errorMessage

          })
          .eq(
            "id",
            job.id
          );


        return json(
          {

            ok: false,

            processed: false,

            job_id:
              job.id,

            smart_handler_status:
              response.status,

            smart_handler_response:
              responseData

          },
          502
        );

      }


      /* -----------------------------------------------------
         SUCCESS
      ----------------------------------------------------- */

      /*
       * smart-handlerが
       * job.statusをcompletedにしている可能性がある。
       *
       * その場合は上書きしない。
       *
       * まだrunningならcompletedにする。
       */

      const {
        data: latestJob
      } =
        await supabase
          .from(
            "research_jobs"
          )
          .select(
            "status"
          )
          .eq(
            "id",
            job.id
          )
          .maybeSingle();


      if (
        latestJob?.status ===
        "running"
      ) {

        await supabase
          .from(
            "research_jobs"
          )
          .update({

            status:
              "completed",

            finished_at:
              new Date().toISOString(),

            error_message:
              null,

            result:
              responseData

          })
          .eq(
            "id",
            job.id
          );

      }


      /* -----------------------------------------------------
         RETURN
      ----------------------------------------------------- */

      return json({

        ok: true,

        processed: true,

        job_id:
          job.id,

        theme:
          theme,

        smart_handler:
          responseData

      });


    } catch (error) {

      console.error(
        "kick-worker error:",
        error
      );


      return json(
        {

          ok: false,

          processed: false,

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
