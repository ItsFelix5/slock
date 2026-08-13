const TRACKING_PARAM_PREFIXES = ["utm_", "mtm", "ga_", "otm_", "vn_"];
const TRACKING_PARAM_NAMES = new Set([
  "ref",
  "referrer",
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "mc_tc",
  "igshid",
  "_hsenc",
  "_hsmi",
  "__hsfp",
  "__hssc",
  "__hstc",
  "__s",
  "hsctatracking",
  "mkt_tok",
  "ref_src",
  "ref_cta",
  "yclid",
  "vero_id",
  "vero_conv",
  "oly_anon_id",
  "oly_enc_id",
  "wickedid",
  "s_cid",
  "icid",
  "spm",
  "trkcampaign",
  "ocid",
  "_openstat",
  "fb_action_types",
  "fb_action_ids",
  "fb_source",
  "fb_ref",
  "action_object_map",
  "action_type_map",
  "action_ref_map",
  "gs_l",
  "hmb_campaign",
  "hmb_medium",
  "hmb_source",
  "srsltid",
  "cmpid",
  "os_ehash",
  "_ga",
  "_gl",
  "__twitter_impression",
  "wtmc",
  "wtzmc",
  "wt_mc",
  "wt_zmc",
  "wtrid",
  "echobox",
  "tracking_source",
  "itm_campaign",
  "itm_medium",
  "itm_source",
  "ml_subscriber",
  "ml_subscriber_hash",
  "rb_clickid",
  "twclid",
]);

const DOMAIN_TRACKING_PARAMS: { names: string[]; roots: string[] }[] = [
  { names: ["si", "feature", "kw", "pp"], roots: ["youtube", "youtu"] },
  { names: ["si"], roots: ["spotify"] },
  { names: ["s", "t", "cn", "ref_url"], roots: ["twitter", "x"] },
  {
    names: ["correlation_id", "ref_campaign", "ref_source", "rdt", "_branch_match_id", "share_id"],
    roots: ["reddit"],
  },
  { names: ["igshid", "igsh"], roots: ["instagram"] },
  {
    names: [
      "eid",
      "comment_tracking",
      "dti",
      "app",
      "video_source",
      "ftentidentifier",
      "pageid",
      "padding",
      "ls_ref",
      "action_history",
      "tracking",
      "referral_code",
      "referral_story_type",
      "eav",
      "sfnsn",
      "idorvanity",
      "wtsid",
      "rdc",
      "rdr",
      "paipv",
      "_nc_x",
      "_rdr",
      "mibextid",
      "__tn__",
    ],
    roots: ["facebook"],
  },
  {
    names: [
      "qid",
      "spIA",
      "ms3_c",
      "refRID",
      "qualifier",
      "_encoding",
      "smid",
      "th",
      "sprefix",
      "crid",
      "keywords",
      "linkCode",
      "creativeASIN",
      "ascsubtag",
      "aaxitk",
      "hsa_cr_id",
      "rnid",
      "dchild",
      "camp",
      "creative",
      "content-id",
      "dib",
      "dib_tag",
      "social_share",
      "starsLeft",
      "skipTwisterOG",
      "tag",
    ],
    roots: ["amazon"],
  },
  { names: ["_trkparms", "_trksid", "_from", "hash"], roots: ["ebay"] },
  {
    names: [
      "ws_ab_test",
      "btsid",
      "algo_expid",
      "algo_pvid",
      "gps-id",
      "cv",
      "af",
      "mall_affr",
      "sk",
      "dp",
      "terminal_id",
      "aff_request_id",
    ],
    roots: ["aliexpress"],
  },
  { names: ["cvid", "sk", "sp", "sc", "qs", "qp"], roots: ["bing"] },
  { names: ["trackId", "tctx"], roots: ["netflix"] },
  { names: ["tt_medium", "tt_content"], roots: ["twitch"] },
  { names: ["refId", "trackingId", "trk"], roots: ["linkedin"] },
  {
    names: [
      "u_code",
      "preview_pb",
      "_d",
      "_t",
      "_r",
      "timestamp",
      "user_id",
      "share_app_name",
      "share_iid",
      "source",
    ],
    roots: ["tiktok"],
  },
];

const REF_PARAM_NAMES = new Set(["ref", "referrer"]);
const REF_SAFE_ROOTS = [
  "github",
  "gitlab",
  "cloudflare",
  "prismic",
  "tangerine",
  "stripe",
  "lichess",
  "steampowered",
  "battle",
  "blizzard",
  "zoom",
  "bilibili",
  "ieee",
  "bankid",
  "irs",
];

function matchesRoot(hostname: string, root: string): boolean {
  return new RegExp(`(^|\\.)${root}\\.[a-z]{2,}(?:\\.[a-z]{2,})?$`).test(hostname);
}

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    TRACKING_PARAM_NAMES.has(lower) || TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p))
  );
}

export function stripTrackingParams(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  const domainNames = DOMAIN_TRACKING_PARAMS.find((d) =>
    d.roots.some((root) => matchesRoot(url.hostname, root)),
  )?.names.map((n) => n.toLowerCase());
  const refIsSafe = REF_SAFE_ROOTS.some((root) => matchesRoot(url.hostname, root));
  let changed = false;
  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (refIsSafe && REF_PARAM_NAMES.has(lower)) continue;
    if (isTrackingParam(lower) || domainNames?.includes(lower)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  return changed ? url.toString() : rawUrl;
}
