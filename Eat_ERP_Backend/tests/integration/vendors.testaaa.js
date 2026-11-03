import { expect } from '@jest/globals';
import request from 'supertest';

import server from '../../server.js';
import User from '../../models/user.js';
import Vendor from '../../models/vendor.js';
import VendorContact from '../../models/vendorContact.js';

let token, url, method = 'GET';
let vendor = {};
let vendor_id = 0;
let data = {
  "vendor_name": "K B ENTERPRISES",
  "vendor_code": null,
  "address": "F-405, Vaikunt Dham, Jangal Mangal Road, Bhandup (w), Mumbai-400078, Maharashtra. INDIA",
  "city": "Mumbai",
  "pincode": "400078",
  "state": "Maharashtra",
  "country": "India",
  "email_id": "infokbenterprises@gmail.com",
  "mobile": "9930824189",
  "contact_person": null,
  "tin_number": "",
  "cst_number": "",
  "vendor_type": null,
  "bank_acc_name": "K B Enterprises",
  "bank_acc_no": "12345",
  "confirm_bank_acc_no": "1234",
  "bank_name": "HDFC BANK",
  "bank_branch_name": null,
  "ifsc_code": null,
  "bank_email": null,
  "bank_document": null,
  "bank_document_name": null,
  "gst_document": null,
  "gst_document_name": null,
  "pan_document": null,
  "pan_document_name": null,
  "msme_document": null,
  "msme_document_name": null,
  "remarks": "",
  "gst_number": "27AWKPP4125H1ZD",
  "type_id": 1,
  "ref_id": null,
  "contactPersons": [{
      "contact_person": "Info kb enterprises",
      "email_id": "infokbenterprises@gmail.com",
      "mobile": "9930824189"
  }]
};

describe('/api/vendors', () => {
  beforeEach(async () => { 
    if (!token || token == ''){
      const user = await User.findByPk(148);
      token = await user.generateAuthToken();
    }
  });
  afterEach(async () => { 
    if(vendor_id && vendor_id > 0) {
      await Vendor.destroy({ where: { id: vendor_id } });
      await VendorContact.destroy({ where: { vendor_id: vendor_id } });
    }
    
    server.close(); 
  });

  const exec = async () => {
    if(method === 'POST') {
      vendor = await request(server).post(url).set('Authorization', 'Bearer ' + token).send(data);
    } else if(method === 'PUT') {
      vendor = await request(server).put(url).set('Authorization', 'Bearer ' + token).send(data);
    } else {
      vendor = await request(server).get(url).set('Authorization', 'Bearer ' + token).send(data);
    }

    // console.log(res);

    return vendor;
  }

  describe('POST /', () => {
    it('should return 201 if all data is proper', async () => {
      url = '/api/vendors';
      method = 'POST';
      const res = await exec();
      expect(res.status).toBe(201);
      expect(res._body.message).toBeDefined();
      expect(res._body.message).toContain('added');

      vendor_id = res._body.vendor.id;
    });
    it('should return 422 if vendor name already exist is passed', async () => {
      url = '/api/vendors';
      method = 'POST';
      data.vendor_name = 'K B ENTERPRISES';
      const res = await exec();
      expect(res.status).toBe(422);
      expect(res.error.errors.vendor_name.message).toContain('already exist');
    });
    it('should return 422 if contact person name does not exist', async () => {
      url = '/api/vendors';
      method = 'POST';
      data.contactPersons = [{ "contact_person": "" }];
      const res = await exec();
      expect(res.status).toBe(422);
      expect(res.error.errors[0].message).toContain('cannot be null');
    });
    it('should return 422 if invalid data is passed', async () => {
      url = '/api/vendors';
      method = 'POST';
      data = {
        vendor_name: 'Test'
      };
      const res = await exec();
      expect(res.status).toBe(422);
    });
    it('should return 401 if client is not logged in', async () => {
      url = '/api/vendors';
      method = 'POST';
      token = '';
      const res = await exec();
      expect(res.status).toBe(401);
    });
  });
  
  // describe('GET /', () => {
  //   it('should return all vendors', async () => {
  //     url = '/api/vendors';
  //     method = 'GET';
  //     res = await exec();
  //     expect(res.status).toBe(200);
  //     expect(res._body.rows).toBeDefined();
  //     expect(res._body.rows.length).toBeGreaterThan(0);
  //     expect(res._body.rows[0]).toHaveProperty('vendor_name');
  //   });
  //   it('should return 401 if client is not logged in', async () => {
  //     url = '/api/vendors';
  //     method = 'GET';
  //     token = '';
  //     const res = await exec();
  //     expect(res.status).toBe(401);
  //   });
  // });

  // describe('PUT /', () => {
  //   beforeAll(async () => {
  //     res = await request(server).post(url).set('Authorization', 'Bearer ' + token).send(data);
  //     vendor_id = res._body.vendor.id;
  //   });

  //   it('should return 200 if all data is proper', async () => {
  //     url = '/api/vendors/'+vendor_id;
  //     method = 'PUT';
  //     const vendor_name = 'K B ENTERPRISES';
  //     const res = await exec();
  //     expect(res.status).toBe(200);
  //     expect(res._body.message).toBeDefined();
  //     expect(res._body.message).toContain('Update');
  //     expect(res._body.vendor.vendor_name).toBe(vendor_name);
  //     expect(res._body.vendor.status).toBe('Pending');

  //     vendor_id = res._body.vendor.id;
  //   });
  //   it('should return 404 if vendor did not found', async () => {
  //     url = '/api/vendors/0';
  //     method = 'PUT';
  //     token = '';
  //     const res = await exec();
  //     expect(res.status).toBe(404);
  //     expect(res._body.message).toContain('not found');
  //   });
  //   it('should return 422 if vendor name already exist is passed', async () => {
  //     url = '/api/vendors/'+vendor_id;
  //     method = 'PUT';
  //     data.vendor_name = 'K S ENTERPRISES';
  //     const res = await exec();
  //     expect(res.status).toBe(422);
  //   });
  //   it('should return 422 if contact person name does not exist', async () => {
  //     url = '/api/vendors/'+vendor_id;
  //     method = 'PUT';
  //     data.contactPersons = [{ "contact_person": "" }];
  //     const res = await exec();
  //     expect(res.status).toBe(422);
  //   });
  //   it('should return 422 if invalid data is passed', async () => {
  //     url = '/api/vendors/'+vendor_id;
  //     method = 'PUT';
  //     data = {
  //       vendor_name: 'Test'
  //     };
  //     const res = await exec();
  //     expect(res.status).toBe(422);
  //   });
  //   it('should return 401 if client is not logged in', async () => {
  //     url = '/api/vendors/'+vendor_id;
  //     method = 'PUT';
  //     token = '';
  //     const res = await exec();
  //     expect(res.status).toBe(401);
  //   });
  // });
});