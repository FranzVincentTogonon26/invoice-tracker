import concurrently from "concurrently";

concurrently(
  [
    {
      name: "server",
      command: "npm run dev --workspace backend",
      prefixColor: "green",
    },
    {
      name: "client",
      command: "npm run dev --workspace frontend",
      prefixColor: "cyan",
    },
  ],
  {
    prefix: "[{name}]", // shows [server] / [client] before logs
    killOthersOn: ["failure", "success"], // optional: stops others if one fails
    restartTries: 0, // optional: how many times to restart on crash
  },
);
