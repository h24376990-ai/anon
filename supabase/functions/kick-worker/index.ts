// ============================================================
// Research AI Lab
// supabase/functions/kick-worker/index.ts
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(
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

Deno.serve(
  async (req) => {

    // --------------------------------------------------------
    // CORS
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // POST only
    // --------------------------------------------------------

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

    try {

      // ------------------------------------------------------
      // Request body
      // ------------------------------------------------------

      const body =
        await req
          .json()
          .catch(
            () => ({})
          );

      const jobId =
        body?.job_id ||
        null;

      const projectId =
        body?.project_id ||
        null;

      // ------------------------------------------------------
      // Find queued job
      // ------------------------------------------------------

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

      if (jobId) {

        query =
          query.eq(
            "id",
            jobId
          );

      }

      if (projectId) {

        query =
          query.eq(
            "project_id",
            projectId
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

      // ------------------------------------------------------
      // Nothing to process
      // ------------------------------------------------------

      if (!job) {

        return json({
          ok: true,
          processed:
            false,
          message:
            "No queued jobs"
        });

      }

      // ------------------------------------------------------
      // Call smart-handler
      // ------------------------------------------------------

      const functionUrl =
        `${SUPABASE_URL}/functions/v1/smart-handler`;

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
                `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },

            body:
              JSON.stringify({
                job_id:
                  job.id,

                project_id:
                  job.project_id
              })
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

      // ------------------------------------------------------
      // smart-handler failure
      // ------------------------------------------------------

      if (!response.ok) {

        console.error(
          "smart-handler failed:",
          response.status,
          responseData
        );

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

      // ------------------------------------------------------
      // Success
      // ------------------------------------------------------

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
