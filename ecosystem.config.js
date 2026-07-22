module.exports = {
  apps: [{
    name: 'documents-system',
    script: 'node_modules/.bin/next',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
  }],
}
