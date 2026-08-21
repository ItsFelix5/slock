import { jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import { trimFile } from "../../trim/slackEntities.ts";
import { type Route, route } from "../router.ts";

export const canvasRoutes: Route[] = [
  route("GET", "/api/canvases/:id/file-info", async (ctx) => {
    const data = await callSlack("files.info", { file: ctx.params.id }, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "files.info", ctx.creds, ctx.acceptEncoding);
    }
    const file = trimFile(data.file);
    return jsonResponse(
      {
        ok: true,
        title: file?.title?.trim() || file?.name?.trim() || null,
        url: file?.url_private_download ?? file?.url_private ?? null,
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
];
