module.exports = {
  apps: [{
    name: 'documents-system',
    script: 'node_modules/.bin/next',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      UPLOAD_DIR: '/var/www/documents-system/uploads',
    },
  }],
}
