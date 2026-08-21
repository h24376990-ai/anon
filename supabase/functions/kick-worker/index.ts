const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};


Deno.serve(async (req) => {

  if (req.method === "OPTIONS") {

    return new Response(
      "ok",
      {
        headers: corsHeaders,
      }
    );

  }


  try {

    const body =
      await req.json();


    const jobId =
      String(
        body?.job_id || ""
      ).trim();


    if (!jobId) {

      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "job_id is required"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );

    }


    const githubToken =
      Deno.env.get(
        "GITHUB_DISPATCH_TOKEN"
      );


    const githubOwner =
      Deno.env.get(
        "GITHUB_OWNER"
      );


    const githubRepo =
      Deno.env.get(
        "GITHUB_REPO"
      );


    if (
      !githubToken ||
      !githubOwner ||
      !githubRepo
    ) {

      throw new Error(
        "GitHub worker secrets are not configured."
      );

    }


    const response =
      await fetch(
        `https://api.github.com/repos/${githubOwner}/${githubRepo}/dispatches`,
        {
          method: "POST",

          headers: {

            "Accept":
              "application/vnd.github+json",

            "Authorization":
              `Bearer ${githubToken}`,

            "X-GitHub-Api-Version":
              "2022-11-28",

            "Content-Type":
              "application/json",

          },

          body:
            JSON.stringify({

              event_type:
                "research-job",

              client_payload: {

                job_id:
                  jobId,

              },

            }),

        }
      );


    const responseText =
      await response.text();


    if (!response.ok) {

      throw new Error(
        `GitHub dispatch failed: ${response.status} ${responseText}`
      );

    }


    return new Response(

      JSON.stringify({

        ok: true,

        job_id:
          jobId,

        dispatched:
          true,

      }),

      {
        status: 200,

        headers: {

          ...corsHeaders,

          "Content-Type":
            "application/json",

        },

      }

    );


  } catch (error) {

    console.error(
      "kick-worker:",
      error
    );


    return new Response(

      JSON.stringify({

        ok: false,

        error:
          error instanceof Error
            ? error.message
            : String(error),

      }),

      {
        status: 500,

        headers: {

          ...corsHeaders,

          "Content-Type":
            "application/json",

        },

      }

    );

  }

});
