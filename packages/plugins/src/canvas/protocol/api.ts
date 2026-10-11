export type { DiffEntry, DiffStatus } from "./diff.ts";
export { diffNodes } from "./diff.ts";
export type { CanvasDocument } from "./document.ts";
export { readCanvas, readCanvasVersion } from "./document.ts";
export type { CanvasEmbed } from "./embeds.ts";
export {
  framesFromAttribute,
  isLineNode,
  layoutAttribute,
  sameFrames,
  withCallout,
  withQuote,
} from "./frames.ts";
export { longestIncreasing } from "./increasing.ts";
export {
  lineShapeForStyle,
  listKindForStyle,
  listStyleForKind,
  styleForLine,
} from "./lineStyles.ts";
export type { PlanResult } from "./plan.ts";
export { planEdit } from "./plan.ts";
export { positionBetween } from "./positions.ts";
export type { CanvasMeta, DecodedCanvas, SectionRecord } from "./sections.ts";
export { decodeLoadData, isSectionId, newSectionId } from "./sections.ts";
export { escapeCanvasHtml } from "./sectionWrite.ts";
