import { duplicatesRule } from "../code/duplicates";
import { fileSizeRule } from "../code/fileSize";
import { leaksRule } from "../code/leaks";
import { longFunctionsRule } from "../code/longFunctions";
import { smellsRule } from "../code/smells";
import { unusedExportsRule } from "../code/unusedExports";
import { colorsRule } from "../style/colors";
import { commentsRule } from "../style/comments";
import { copyRule } from "../style/copy";
import { emDashRule } from "../style/emDash";
import { hoverCssRule } from "../style/hoverCss";
import { mouseJsxRule } from "../style/mouseJsx";
import { pxValuesRule } from "../style/pxValues";
import type { Rule } from "./types";

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
