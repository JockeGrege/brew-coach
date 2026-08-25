import { chemex } from "./chemex";
import { v60 } from "./v60";

// Order here is the dropdown's order. Add a new method by writing a module
// with the same shape as chemex.js/v60.js and listing it below — nothing
// elsewhere needs to know the method exists ahead of time.
export const METHODS = { chemex, v60 };
export const METHOD_ORDER = ["chemex", "v60"];
export const DEFAULT_METHOD = "chemex";
