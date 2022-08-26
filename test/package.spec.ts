import { expect } from 'chai';
import supertest from 'supertest';
import ServerService from '../src/services/ServerService';
import { AppRole } from '../src/types';
import userService from '../src/services/UserService';
import userRepository from '../src/repositories/UserRepository';
import MongoDBService from '../src/services/MongoDBService';
import { constants } from 'ethers';
import {
  buildSignatureDomain,
  buildSignatureValue,
  types
} from '@windingtree/win-commons/dist/auth';
import { testWallet } from '../src/config';

let appService: ServerService;

describe('test', async () => {
  appService = await new ServerService(3005);

  const requestWithSupertest = await supertest(appService.getApp);

  const managerLogin = 'test_manager_super_long_login';
  const managerPass = '123456qwerty';

  let refreshToken;
  let accessToken;
  let secretToken;
  let walletAccessToken;
  let walletRefreshToken;

  const staffLogin = 'test_staff_super_long_login';
  const staffPass = '123456qwerty';
  const staffUpdatePass = 'qwerty123456';

  let staffAccessToken;
  let staffUserId;

  const anotherUserForTest = 'test_staff_for_tests';

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  it('make manager', async () => {
    await userService.createUser(managerLogin, managerPass, [AppRole.MANAGER]);

    const user = await userRepository.getUserByLogin(managerLogin);
    expect(user._id?.toString()).to.be.an('string');
  });

  it('manager can login', async () => {
    const res = await requestWithSupertest
      .post('/api/user/login')
      .send({ login: managerLogin, password: managerPass })
      .set('Accept', 'application/json');

    refreshToken = res.headers['set-cookie'][0];
    accessToken = res.body.accessToken;
    refreshToken = refreshToken.split('=')[1].split(';')[0];

    expect(refreshToken).to.be.an('string');
    expect(accessToken).to.be.an('string');
  });

  it('check auth', async () => {
    const res = await requestWithSupertest
      .get('/api/user/get-all')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.users).to.be.an('array');
  });

  it('refresh token', async () => {
    //without sleep script is very fast and refreshed access token is equal with old
    await sleep(1000);

    const res = await requestWithSupertest
      .post('/api/user/refresh')
      .set('Accept', 'application/json')
      .set('Cookie', [`refreshToken=${refreshToken}`]);
    const oldAccessToken = accessToken;
    accessToken = res.body.accessToken;
    expect(accessToken).to.be.an('string');
    expect(accessToken).to.not.equal(oldAccessToken);
  });

  it('should throw err when try refresh token with revoked token', async () => {
    //without sleep script is very fast and refreshed access token is equal with old
    await sleep(1000);

    await requestWithSupertest
      .post('/api/user/refresh')
      .set('Accept', 'application/json')
      .set('Cookie', [`refreshToken=${refreshToken}`])
      .expect(401);
  });

  it('create new user with refreshed access token', async () => {
    const res = await requestWithSupertest
      .post('/api/user/create')
      .send({
        login: staffLogin,
        password: staffPass,
        roles: [AppRole.STAFF]
      })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Accept', 'application/json');

    expect(res.status).to.equal(200);
  });

  it('staff can login', async () => {
    const res = await requestWithSupertest
      .post('/api/user/login')
      .send({ login: staffLogin, password: staffPass })
      .set('Accept', 'application/json');

    staffAccessToken = res.body.accessToken;
    staffUserId = res.body.id;
    expect(staffAccessToken).to.be.an('string');
  });

  it(`staff can't create user`, async () => {
    const res = await requestWithSupertest
      .post('/api/user/create')
      .send({
        login: 'some_login_for_test',
        password: staffPass,
        roles: [AppRole.STAFF]
      })
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .set('Accept', 'application/json');

    expect(res.status).to.equal(403);
  });

  it(`staff can't delete users`, async () => {
    await requestWithSupertest
      .delete('/api/user')
      .send({
        userId: staffUserId
      })
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .set('Accept', 'application/json')
      .expect(403);
  });

  it(`staff can get auth APIs`, async () => {
    const res = await requestWithSupertest
      .get('/api/user/get-all')
      .set('Authorization', `Bearer ${staffAccessToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.users).to.be.an('array');
  });

  it(`manager can update staff password`, async () => {
    const res = await requestWithSupertest
      .put('/api/user/update-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ userId: staffUserId, password: staffUpdatePass });

    expect(res.status).to.equal(200);
  });

  it(`manager can update staff role to manager`, async () => {
    const res = await requestWithSupertest
      .put('/api/user/update-roles')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ userId: staffUserId, roles: [AppRole.MANAGER] });

    expect(res.status).to.equal(200);
  });

  it('staff can login with new pass', async () => {
    const res = await requestWithSupertest
      .post('/api/user/login')
      .send({ login: staffLogin, password: staffUpdatePass })
      .set('Accept', 'application/json');

    staffAccessToken = res.body.accessToken;
    expect(staffAccessToken).to.be.an('string');
  });

  it(`staff can create user after change role to manager`, async () => {
    const res = await requestWithSupertest
      .post('/api/user/create')
      .send({
        login: anotherUserForTest,
        password: staffPass,
        roles: [AppRole.STAFF]
      })
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .set('Accept', 'application/json');

    expect(res.status).to.equal(200);
  });

  it(`manager can delete users`, async () => {
    await requestWithSupertest
      .delete('/api/user')
      .send({
        userId: staffUserId
      })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Accept', 'application/json')
      .expect(200);
  });

  it('should throw error when deleted user login', async () => {
    await requestWithSupertest
      .post('/api/user/login')
      .send({ login: staffLogin, password: staffPass })
      .set('Accept', 'application/json')
      .expect(404);
  });

  it('generate secret token', async () => {
    const res = await requestWithSupertest
      .get('/api/bookings/auth/secret')
      .set('Accept', 'application/json')
      .expect(200);

    secretToken = res.headers['set-cookie'][0];
    secretToken = secretToken.split('=')[1].split(';')[0];
    const dataSecretToken = res.body.secret;
    expect(secretToken).to.be.a('string');
    expect(secretToken).to.be.eq(dataSecretToken);
  });

  it('auth with wallet', async () => {
    const chainId = 77; //sokol chain id
    const domain = buildSignatureDomain(chainId);
    const wallet = await testWallet;
    const value = buildSignatureValue(wallet.address, secretToken);
    const signature = await wallet._signTypedData(domain, types, value);

    const res = await requestWithSupertest
      .post('/api/bookings/auth')
      .send({
        chainId,
        signature,
        secret: secretToken,
        wallet: wallet.address
      })
      .set('Accept', 'application/json')
      .expect(200);

    walletAccessToken = res.body.accessToken;
    walletRefreshToken = res.body.refreshToken;

    expect(res.body.accessToken).to.be.a('string');
    expect(res.body.refreshToken).to.be.a('string');
  });

  it('refresh with wallet', async () => {
    const res = await requestWithSupertest
      .post('/api/bookings/auth/refresh')
      .set('Accept', 'application/json')
      .set('Cookie', [`refreshToken=${walletRefreshToken}`])
      .expect(200);

    walletAccessToken = res.body.accessToken;
    walletRefreshToken = res.body.refreshToken;

    expect(res.body.accessToken).to.be.a('string');
    expect(res.body.refreshToken).to.be.a('string');
  });

  it('should throw err when get data with another address', async () => {
    await requestWithSupertest
      .get(`/api/booking/${constants.AddressZero}`)
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${walletAccessToken}`)
      .expect(403);
  });

  it('should throw err when get data without token', async () => {
    await requestWithSupertest
      .get(`/api/booking/${constants.AddressZero}`)
      .set('Accept', 'application/json')
      .expect(401);
  });

  it('get user bookings', async () => {
    await requestWithSupertest
      .get(`/api/booking/${(await testWallet).address}`)
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${walletAccessToken}`)
      .expect(200);
  }).timeout(5000);

  it('delete users', async () => {
    const manager = await userRepository.getUserByLogin(managerLogin);
    const anotherUser = await userRepository.getUserByLogin(anotherUserForTest);
    await userService.deleteUser(manager._id?.toString() || '');
    await userService.deleteUser(anotherUser._id?.toString() || '');
  });

  describe('proxy', async () => {
    let offerId;
    let amadeusOfferId;
    let pricedOfferId;
    let amadeusPricedOfferId;

    it('get all offers by rectangle with wrong data', async () => {
      const body = {
        accommodation: {
          location: {
            lon: -65.387982,
            lat: 34.748995,
            radius: '2 thousand'
          },
          arrival: '2022-08-01T07:19:00.809Z',
          departure: '2022-08-03T07:19:00.809Z',
          roomCount: 1
        },
        passengers: [
          {
            type: 'ADT',
            count: '1'
          },
          {
            type: 'CHD',
            count: '1',
            childrenAges: [13]
          }
        ]
      };

      await requestWithSupertest
        .post('/api/hotels/offers/search')
        .send(body)
        .set('Accept', 'application/json')
        .expect(400);
    }).timeout(10000);

    it('get all offers by rectangle', async () => {
      const today = new Date();
      const arrival = new Date();
      const departure = new Date();
      arrival.setDate(today.getDate() + 7);
      departure.setDate(today.getDate() + 8);

      const body = {
        accommodation: {
          location: {
            lon: 13.3888599,
            lat: 52.5170365,
            radius: 20000
          },
          arrival,
          departure,
          roomCount: 1
        },
        passengers: [
          {
            type: 'ADT',
            count: 1
          },
          {
            type: 'CHD',
            count: 1,
            childrenAges: [12]
          }
        ]
      };

      const res = await requestWithSupertest
        .post('/api/hotels/offers/search')
        .send(body)
        .set('Accept', 'application/json')
        .expect(200);
      expect(res.body.offers).to.be.a('object');

      offerId = Object.keys(res.body.offers)[0];
      amadeusOfferId = Object.keys(res.body.offers)[
        Object.keys(res.body.offers).length - 1
      ];
    }).timeout(15000);

    it('get offer price', async () => {
      const res = await requestWithSupertest
        .post(`/api/hotels/offers/${offerId}/price`)
        .send({})
        .set('Accept', 'application/json')
        .expect(200);

      expect(res.body).to.be.a('object');
      pricedOfferId = res.body.offerId;
    }).timeout(10000);

    it('get amadeus offer price', async () => {
      const res = await requestWithSupertest
        .post(`/api/hotels/offers/${amadeusOfferId}/price`)
        .send({})
        .set('Accept', 'application/json')
        .expect(200);

      expect(res.body).to.be.a('object');
      amadeusPricedOfferId = res.body.offerId;
    }).timeout(10000);

    it('set users and get error with wrong data', async () => {
      const passengers = [
        {
          type: 'ADT',
          civility: 'MR',
          lastnames: ['Marley'],
          firstnames: ['Bob'],
          gender: 'Male',
          birthdate: '1980-03-21T00:00:00Z',
          contactInformation: ['contact@org.co.uk', 32123456789]
        }
      ];
      await requestWithSupertest
        .post(`/api/booking/${pricedOfferId}/guests`)
        .send(passengers)
        .set('Accept', 'application/json')
        .expect(400);
    });

    it('set users', async () => {
      const guests = [
        {
          type: 'ADT',
          civility: 'MR',
          lastnames: ['Marley'],
          firstnames: ['Bob'],
          gender: 'Male',
          birthdate: '1980-03-21T00:00:00Z',
          contactInformation: ['contact@org.co.uk', '+32123456789']
        }
      ];
      await requestWithSupertest
        .post(`/api/booking/${pricedOfferId}/guests`)
        .send(guests)
        .set('Accept', 'application/json')
        .expect(200);
    }).timeout(20000);

    it('set users amadeus', async () => {
      const guests = [
        {
          type: 'ADT',
          civility: 'MR',
          lastnames: ['Marley'],
          firstnames: ['Bob'],
          gender: 'Male',
          birthdate: '1980-03-21T00:00:00Z',
          contactInformation: ['contact@org.co.uk', '+32123456789']
        }
      ];
      await requestWithSupertest
        .post(`/api/booking/${amadeusPricedOfferId}/guests`)
        .send(guests)
        .set('Accept', 'application/json')
        .expect(200);
      await sleep(20000);
    }).timeout(25000);

    it('check booked with simard api', async () => {
      await sleep(20000);

      const res = await requestWithSupertest
        .get(`/api/booking/${(await testWallet).address}`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${walletAccessToken}`)
        .expect(200);

      const deals = res.body;
      const deal = deals.find((v) => v.offerId === pricedOfferId);
      expect(deal.status).to.be.equal('booked');
      const amadeusDeal = deals.find((v) => v.offerId === amadeusPricedOfferId);
      expect(amadeusDeal.status).to.be.equal('booked');
    }).timeout(25000);

    it('return the reward options', async () => {
      const res = await requestWithSupertest
        .get(`/api/booking/${pricedOfferId}/rewardOptions`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${walletAccessToken}`)
        .expect(200);

      const options = res.body;
      expect(options).to.have.lengthOf(2);
      {
        const { rewardType, quantity, tokenName } = options[0];
        expect(rewardType).to.be.equal('CO2_OFFSET');
        expect(Number(quantity)).to.be.greaterThan(0);
        expect(tokenName).to.be.equal('NCT');
      }
      {
        const { rewardType, quantity, tokenName } = options[1];
        expect(rewardType).to.be.equal('TOKEN');
        expect(Number(quantity)).to.be.greaterThan(0);
        expect(tokenName).to.be.equal('LIF');
      }
    }).timeout(25000);

    it('set the reward option', async () => {
      const rewardChoice = 'TOKEN';
      const res1 = await requestWithSupertest
        .post(`/api/booking/${pricedOfferId}/reward`)
        .send({ rewardType: rewardChoice })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${walletAccessToken}`)
        .expect(200);

      expect(res1.body.success).to.be.true;

      const res2 = await requestWithSupertest
        .get(`/api/booking/${(await testWallet).address}`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${walletAccessToken}`)
        .expect(200);

      const deals = res2.body;
      const deal = deals.find((v) => v.offerId === pricedOfferId);
      expect(deal.rewardOption).to.be.equal(rewardChoice);
    }).timeout(25000);
  });

  after(async () => {
    await MongoDBService.getInstance().cleanUp();
  });
});
