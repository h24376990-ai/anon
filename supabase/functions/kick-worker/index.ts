// ============================================================
// Research AI Lab
// supabase/functions/kick-worker/index.ts
//
// Worker:
//   research_jobs の queued ジョブを取得
//   ↓
//   smart-handler に研究内容を引き継ぐ
//   ↓
//   smart-handler がAI研究を実行
//
// 重要:
//   job_id / project_id だけではなく
//   message / theme / prompt / research_prompt 等を
//   可能な限り smart-handler に渡す。
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// Environment
// ============================================================

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL) {
  console.error("SUPABASE_URL is missing");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is missing"
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================
// CORS
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS"
};

// ============================================================
// JSON response
// ============================================================

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

// ============================================================
// Utility
// ============================================================

function cleanString(
  value: unknown
): string | null {

  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

function firstString(
  ...values: unknown[]
): string | null {

  for (
    const value of values
  ) {

    const result =
      cleanString(value);

    if (result) {
      return result;
    }
  }

  return null;
}

// ============================================================
// Main
// ============================================================

Deno.serve(
  async (req) => {

    // ========================================================
    // CORS
    // ========================================================

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

    // ========================================================
    // POST only
    // ========================================================

    if (
      req.method !== "POST"
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

    // ========================================================
    // Validate environment
    // ========================================================

    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return json(
        {
          ok: false,
          error:
            "Supabase environment is not configured"
        },
        500
      );
    }

    try {

      // ======================================================
      // Request body
      // ======================================================

      const body =
        await req
          .json()
          .catch(
            () => ({})
          );

      const requestedJobId =
        cleanString(
          body?.job_id
        );

      const requestedProjectId =
        cleanString(
          body?.project_id
        );

      // ======================================================
      // Find queued job
      // ======================================================

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
        throw jobError;
      }

      // ======================================================
      // Nothing to process
      // ======================================================

      if (!job) {

        return json({
          ok: true,

          processed:
            false,

          message:
            "No queued jobs"
        });

      }

      console.log(
        "Queued research job found:",
        job.id
      );

      // ======================================================
      // Extract research input
      //
      // DB schemaが多少違っていても対応できるように
      // 複数の候補から研究内容を取得。
      // ======================================================

      const message =
        firstString(
          job.message,
          job.research_message,
          job.user_message,
          job.prompt,
          job.research_prompt,
          job.input,
          job.query,
          job.question
        );

      const theme =
        firstString(
          job.theme,
          job.research_theme,
          job.topic,
          job.subject,
          job.title
        );

      // ======================================================
      // Research input fallback
      //
      // message と theme の両方が無い場合、
      // job自体が壊れている可能性がある。
      //
      // ここでは「勝手な研究テーマ」を作らない。
      // これは Research AI Lab の
      // 「根拠のない内容を生成しない」方針のため。
      // ======================================================

      if (
        !message &&
        !theme
      ) {

        console.error(
          "Queued job has no research input:",
          job.id
        );

        // ----------------------------------------------------
        // failed にする
        // ----------------------------------------------------

        await supabase
          .from(
            "research_jobs"
          )
          .update({
            status:
              "failed",

            error:
              "Queued job has no message or theme"
          })
          .eq(
            "id",
            job.id
          );

        return json(
          {
            ok: false,

            processed:
              false,

            job_id:
              job.id,

            error:
              "Queued job has no message or theme"
          },
          400
        );
      }

      // ======================================================
      // Mark processing
      //
      // 同じジョブが複数Workerから同時実行されるのを
      // できるだけ防ぐ。
      // ======================================================

      const {
        data: claimedJob,
        error: claimError
      } =
        await supabase
          .from(
            "research_jobs"
          )
          .update({
            status:
              "processing",

            started_at:
              new Date().toISOString()
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

      if (claimError) {

        console.error(
          "Failed to claim job:",
          claimError
        );

        throw claimError;
      }

      // ======================================================
      // Job was already claimed
      // ======================================================

      if (!claimedJob) {

        return json({
          ok: true,

          processed:
            false,

          job_id:
            job.id,

          message:
            "Job was already claimed by another worker"
        });

      }

      console.log(
        "Research job claimed:",
        job.id
      );

      // ======================================================
      // smart-handler URL
      // ======================================================

      const functionUrl =
        `${SUPABASE_URL}/functions/v1/smart-handler`;

      // ======================================================
      // Payload
      // ======================================================

      const smartHandlerPayload = {

        // ----------------------------------------------
        // Job identity
        // ----------------------------------------------

        job_id:
          job.id,

        project_id:
          job.project_id ??
          requestedProjectId ??
          null,

        // ----------------------------------------------
        // Research input
        // ----------------------------------------------

        message:
          message,

        theme:
          theme,

        // ----------------------------------------------
        // Additional research context
        // ----------------------------------------------

        title:
          firstString(
            job.title
          ),

        prompt:
          firstString(
            job.prompt,
            job.research_prompt
          ),

        // ----------------------------------------------
        // Optional research mode
        // ----------------------------------------------

        mode:
          firstString(
            job.mode,
            job.research_mode
          ),

        domain:
          firstString(
            job.domain,
            job.field
          ),

        // ----------------------------------------------
        // Mathematics / physics option
        // ----------------------------------------------

        physics_enabled:
          job.physics_enabled ??
          job.use_physics ??
          false,

        // ----------------------------------------------
        // Priority
        // ----------------------------------------------

        priority:
          job.priority ??
          0
      };

      console.log(
        "Calling smart-handler for job:",
        job.id
      );

      console.log(
        "Research input:",
        {
          has_message:
            Boolean(message),

          has_theme:
            Boolean(theme),

          project_id:
            job.project_id ??
            requestedProjectId ??
            null
        }
      );

      // ======================================================
      // Call smart-handler
      // ======================================================

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

        responseData =
          {
            raw:
              responseText
          };

      }

      // ======================================================
      // smart-handler failure
      // ======================================================

      if (!response.ok) {

        console.error(
          "smart-handler failed:",
          response.status,
          responseData
        );

        // ----------------------------------------------------
        // Return job to queue for retry
        //
        // ただし入力不備の場合は無限再試行しない。
        // ----------------------------------------------------

        const isInputError =
          response.status === 400;

        if (
          isInputError
        ) {

          await supabase
            .from(
              "research_jobs"
            )
            .update({
              status:
                "failed",

              error:
                typeof responseData ===
                "object" &&
                responseData !== null &&
                "error" in responseData
                  ? String(
                      (responseData as {
                        error?: unknown
                      }).error ??
                      "smart-handler input error"
                    )
                  : "smart-handler input error"
            })
            .eq(
              "id",
              job.id
            );

        } else {

          // --------------------------------------------------
          // 一時的エラーなら queued に戻す
          // --------------------------------------------------

          await supabase
            .from(
              "research_jobs"
            )
            .update({
              status:
                "queued",

              error:
                `smart-handler returned HTTP ${response.status}`
            })
            .eq(
              "id",
              job.id
            );

        }

        return json(
          {
            ok: false,

            processed:
              false,

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

      // ======================================================
      // Success
      // ======================================================

      console.log(
        "smart-handler succeeded:",
        job.id
      );

      // ======================================================
      // Return
      // ======================================================

      return json({
        ok: true,

        processed:
          true,

        job_id:
          job.id,

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
