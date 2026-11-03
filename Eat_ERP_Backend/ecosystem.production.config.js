module.exports = {
  apps: [{
    name: 'app-production', 
    script: 'server.js',
    env_file: '.env.live',
    port: 5000
  }]
}