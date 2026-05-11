"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZodError = void 0;
exports.parseBody = parseBody;
const zod_1 = require("zod");
Object.defineProperty(exports, "ZodError", { enumerable: true, get: function () { return zod_1.ZodError; } });
const errors_1 = require("./errors");
function parseBody(schema, body) {
    const result = schema.safeParse(body);
    if (result.success)
        return result.data;
    const formatted = result.error.flatten();
    throw (0, errors_1.badRequest)("Invalid request body", {
        fieldErrors: formatted.fieldErrors,
        formErrors: formatted.formErrors,
    });
}
