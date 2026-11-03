import { expect } from '@jest/globals';
import request from 'supertest';

import server from '../../server.js';
// import checkAuth from '../../middleware/check-auth.js';
import User from '../../models/user.js';

let token;

describe('authentication & authorization middleware integration test', function() {
  // beforeEach(async () => { testServer = server });
  afterEach(() => { server.close(); });

  const exec = () => {
    return request(server).get('/api/user/148').set('Authorization', 'Bearer ' + token).send();
  }

  beforeEach(async () => { 
    const user = await User.findByPk(148);
    token = await user.generateAuthToken(); 
  });
  
  it('should return 401 if no token is provided', async () => {
    token = '';
    const res = await exec();
    expect(res.status).toBe(401);
  });
  it('should return 401 if no token is provided', async () => {
    token = 'a';
    const res = await exec();
    expect(res.status).toBe(400);
  });
  it('should return 200 if no token is provided', async () => {
    const res = await exec();
    expect(res.status).toBe(200);
  });
});