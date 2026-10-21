process.env.NODE_ENV ||= "production";
process.env.HOST ||= "127.1.61.189";
process.env.PORT ||= "4173";

await import("./server.mjs");
