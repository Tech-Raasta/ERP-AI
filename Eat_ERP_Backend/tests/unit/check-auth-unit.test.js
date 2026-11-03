import { expect, jest } from '@jest/globals';

import checkAuth from "../../middleware/check-auth";

import User from '../../models/user.js';

let req = {};
let res = {
  statusCode: 500,
  message: '',
  status: function(code){
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    this.message = data.message;
  }
};
let next = jest.fn();

describe('authentication & authorization middleware unit test', function() {
  describe('authentication', function() {
    it('should return status code 401 and message you are not authenticated if no header is present', async function() {
      await checkAuth(req, res, next);
      expect(res).toHaveProperty('statusCode', 401);
    });
    it('should return status code 401 and message you are not authenticated if header does not contain authorization', async function() {
      req = {
        headers: ''
      };
      await checkAuth(req, res, next);
      expect(res).toHaveProperty('statusCode', 401);
    });
    it('should return status code 401 and message you are not authenticated if header authorization does not contain space', async function() {
      req = {
        headers: {
          authorization: ''
        }
      };
      await checkAuth(req, res, next);
      expect(res).toHaveProperty('statusCode', 401);
    });
    it('should populate req.user eith the payload of a valid JWT', async function(){
      const user = await User.findByPk(148);
      const token = user.generateAuthToken();

      req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      };
      await checkAuth(req, res, next);

      expect(req.userData).toBeDefined();
    });
  });
});