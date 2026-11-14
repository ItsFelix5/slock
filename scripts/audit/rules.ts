import { colorsRule } from "./colors";
import { commentsRule } from "./comments";
import { copyRule } from "./copy";
import { duplicatesRule } from "./duplicates";
import { emDashRule } from "./emDash";
import { fileSizeRule } from "./fileSize";
import { hoverCssRule } from "./hoverCss";
import { leaksRule } from "./leaks";
import { longFunctionsRule } from "./longFunctions";
import { mouseJsxRule } from "./mouseJsx";
import { pxValuesRule } from "./pxValues";
import { smellsRule } from "./smells";
import type { Rule } from "./types";
import { unusedExportsRule } from "./unusedExports";

export const RULES: Rule[] = [
  colorsRule,
  pxValuesRule,
  mouseJsxRule,
  hoverCssRule,
  leaksRule,
  fileSizeRule,
  smellsRule,
  copyRule,
  unusedExportsRule,
  duplicatesRule,
  longFunctionsRule,
  emDashRule,
  commentsRule,
];
