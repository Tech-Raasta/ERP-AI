import { expect } from "chai";
import jwt from "jsonwebtoken";

import checkAuth from "../middleware/check-auth.js";

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

describe('Auth Middleware', function(){
  it('it should throw an error if no authorization header is present', function(done){
    // expect(checkAuth.bind(this, req, res, () => {})).to.throw('You are not authenticated!');

    checkAuth(req, res, ()=>{}).then(()=>{
      expect(res.statusCode).to.be.equal(401);
      expect(res.message).to.be.equal('You are not authenticated!');
      // done();
    }).then(done, done);
  });

  it('it should throw an error if authorization header does not contain space', function(done){
    req = {
      headers: {authorization: 'Test'}
    };

    // expect(checkAuth.bind(this, req, res, () => {})).to.throw('You are not authenticated!');

    checkAuth(req, res, ()=>{}).then(()=>{
      expect(res.statusCode).to.be.equal(401);
      expect(res.message).to.be.equal('You are not authenticated!');
      // done();
    }).then(done, done);
  });

  // it('it should throw an error if the token is not verified', function(done){
  //   req = {
  //     headers: {authorization: 'Bearer xyxzssdskkg'}
  //   };

  //   expect(checkAuth.bind(this, req, res, () => {})).to.throw("You are not authenticated!");
  //   done();
  // });
});