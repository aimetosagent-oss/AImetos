import type { Instrumentation } from "next";
import { log, logErrorMessage } from "@/lib/logger";

export async function register() {}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  log("error", "server.request_error", {
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
    error: logErrorMessage(error),
  });
};
