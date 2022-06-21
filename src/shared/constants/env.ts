/**
 * 和编译环境有关的常量定义
 */
export const isProd = ["production", "prod"].includes(process.env.NODE_ENV!);
export const isDebug = !isProd;
