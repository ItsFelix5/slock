import { slackAssetResponse } from "../../assets.ts";
import { type Route, route } from "../router.ts";

export const assetRoutes: Route[] = [
  route("GET", "assets/:capability", (ctx) =>
    slackAssetResponse(ctx.params.capability, ctx.creds, ctx.acceptEncoding, ctx.range),
  ),
];
