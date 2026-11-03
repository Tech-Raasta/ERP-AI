const config = require('config');
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: config.get('S3ACCESSKEYID'),
  secretAccessKey: config.get('S3SECRETACCESSKEY')
});

module.exports = app => {
  app.get('/api/upload', (req, res) => {
    const key = `uploads/sells/${Date.now()}.jpeg`;
    s3.getSignedUrl('putObject', {
      Bucket: 'wyn-erp-resources',
      ContentType: 'jpeg',
      Key: key
    }, (err, url) => res.send({ key, url }));
  });
};