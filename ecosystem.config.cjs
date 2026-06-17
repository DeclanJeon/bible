module.exports = {
  apps: [
    {
      name: "bible",
      script: "node_modules/.bin/next",
      args: "start",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3100,
        NODE_OPTIONS: "--max-old-space-size=2048",
      },
      max_memory_restart: "1800M",
      listen_timeout: 10000,
      kill_timeout: 5000,
      wait_ready: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
