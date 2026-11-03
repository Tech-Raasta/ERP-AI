module.exports = {
  apps: [{
    name: 'app-staging',
    script: 'server.js',
    env_file: '.env.staging',
    port: 5001
  }]
}