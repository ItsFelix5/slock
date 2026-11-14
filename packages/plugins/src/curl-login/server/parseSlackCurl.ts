import { extractSlackSession } from "@slock/slack";
import type { Credentials } from "../../slack/server/api/auth";
import { parseCurlRequest, type SlackRequest } from "./curlRequest";
import { parseFetchRequest } from "./fetchRequest";
import { slackToken } from "./slackToken";

function parseRequest(raw: string): SlackRequest {
  return parseFetchRequest(raw) ?? parseCurlRequest(raw);
}

export function parseSlackCurl(raw: string): Credentials {
  const request = parseRequest(raw);
  if (!URL.canParse(request.url)) throw new Error("Couldn't find a URL in that.");
  const url = new URL(request.url);

  if (!request.cookie) {
    throw new Error(
      "Couldn't find a cookie header. Make sure devtools copied the request with headers included (Copy as cURL includes them by default).",
    );
  }
  const slackSession = extractSlackSession(request.cookie);
  if (!slackSession) throw new Error("Couldn't find Slack's d session cookie in that request.");

  const token = slackToken(request, url);
  if (!token) {
    throw new Error("Couldn't find a token (starts with xoxc-) in the request body or URL.");
  }

  const route = url.searchParams.get("slack_route");
  if (!route) {
    throw new Error(
      "Couldn't find slack_route in the URL. Copy a request to a regular /api/... endpoint, not edgeapi.slack.com.",
    );
  }

  return { domain: url.hostname, route, slackSession, token };
}
