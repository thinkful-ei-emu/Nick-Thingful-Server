const knex = require('knex');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const helpers = require('./test-helpers');

describe.only('Users Enpoints', () => {
  let db;

  const { testUsers } = helpers.makeThingsFixtures();
  const testUser = testUsers[0];

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    });
    app.set('db', db);
  });

  after('disconnect from db', () => db.destroy());

  before('cleanup', () => helpers.cleanTables(db));

  afterEach('cleanup', () => helpers.cleanTables(db));

  describe('POST /api/users', () => {
    context('User Validation', () => {
      beforeEach('inserts users', () =>
        helpers.seedUsers(
          db,
          testUsers,
        )
      )
      const requiredFields = ['user_name', 'password', 'full_name'];

      requiredFields.forEach(field => {
        const registerAttemptBody = {
          user_name: 'test user_name',
          password: 'test password',
          full_name: 'test full_name',
          nickname: 'test nickname',
        }

        it(`responds 400 required error when '${field}' is missing`, () => {
          delete registerAttemptBody[field];

          return supertest(app)
            .post('/api/users')
            .send(registerAttemptBody)
            .expect(400, {
              error: `Missing '${field}' in request body`
            })
        })
      })
      it(`responds 400 'Password must be longer than 8 characters' when empty password`, () => {
        const userShortPassword = {
          user_name: 'test user_name',
          password: '1234567',
          full_name: 'test full_name',
        }
        return supertest(app)
          .post('/api/users')
          .send(userShortPassword)
          .expect(400, { error: `Password must be longer than 8 characters` })
      })

      it(`responds 400 'Password must be less than 72 characters' when long password`, () => {
        const userLongPassword = {
          user_name: 'test user_name',
          password: '*'.repeat(73),
          full_name: 'test full_name',
        }
        return supertest(app)
          .post('/api/users')
          .send(userLongPassword)
          .expect(400, { error: `Password must be less than 72 characters` })
      })

      it('responds 400 error when password starts with spaces', () => {
        const startsWithSpaces = {
          user_name: 'test user',
          password: ' lolololol1@#T',
          full_name: 'test full_name',
        }
        return supertest(app)
          .post('/api/users')
          .send(startsWithSpaces)
          .expect(400, { error: 'Password must not start or end with an empty space' })
      })
      it('responds 400 error when password ends with spaces', () => {
        const endsWithSpaces = {
          user_name: 'test user',
          password: 'lolololol1@#T ',
          full_name: 'test full_name',
        }
        return supertest(app)
          .post('/api/users')
          .send(endsWithSpaces)
          .expect(400, { error: 'Password must not start or end with an empty space' })
      })
      it('responds 400 error when password not complex enough', () => {
        const tooSimplePw = {
          user_name: 'test user',
          password: '111AAAaabb',
          full_name: 'test full_name',
        }
        return supertest(app)
          .post('/api/users')
          .send(tooSimplePw)
          .expect(400, { error: 'Password must contain 1 upper case, lower case, number, and special character' })
      })
      it('responds 400 "User name already taken" when user_name isn"t unique', () => {
        const duplicateUser = {
          user_name: testUser.user_name,
          password: '111AAAaabb!!!',
          full_name: 'test full_name',
        }
        return supertest(app)
          .post('/api/users')
          .send(duplicateUser)
          .expect(400, { error: 'Username already taken' })
      })
    })
    context('Happy path', () => {
      it('responds 201, serialized user, storing bcrypted password', () => {
        const newUser = {
          user_name: 'test user name',
          password: '11AAbb!!!!',
          full_name: 'mister testyboi',
        }
        return supertest(app)
          .post('/api/users')
          .send(newUser)
          .expect(201)
          .expect(res => {
            expect(res.body).to.have.property('id')
            expect(res.body.user_name).to.eql(newUser.user_name)
            expect(res.body.full_name).to.eql(newUser.full_name)
            expect(res.body.nickname).to.eql('')
            expect(res.body).to.not.have.property('password')
            expect(res.headers.location).to.eql(`/api/users/${res.body.id}`)
            expect(res.body).to.have.property('date_created')
          })
          .expect(res => {
            db.from('thingful_users')
              .select('*')
              .where({id: res.body.id})
              .first()
              .then(row => {
                expect(row.user_name).to.eql(newUser.user_name)
                expect(row.full_name).to.eql(newUser.full_name)
                expect(row.nickname).to.eql(null)
                expect(row).to.have.property('date_created')

                return bcrypt.compare(newUser.password, row.password)
              })
              .then(compareMatch => {
                expect(compareMatch).to.be.true 
              })
          })
      })
    })
  })


});
