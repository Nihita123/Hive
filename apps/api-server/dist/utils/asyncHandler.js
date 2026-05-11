"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = asyncHandler;
function asyncHandler(fn) {
    return (req, res, next) => {
        void fn(req, res, next).catch(next);
    };
}
