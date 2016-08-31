var couchbase = require('couchbase');
var testUtil = require('./helpers/utils');
var _ = require('lodash');
var async = require('async');
var expect = require('chai').expect;
var ts = require('./helpers/pop_setup');

var lounge = require('../');

var bucket;
var User, Company, Post, Comment;
var userSchema, companySchema, commentSchema, postSchema;

describe('Model static remove tests', function () {

  describe('Static remove tests', function () {

    beforeEach(function (done) {
      if (lounge) {
        lounge.disconnect();
      }

      userSchema = companySchema = commentSchema = postSchema = null;
      User = Company = Post = Comment = null;

      lounge = new lounge.Lounge(); // recreate it

      var cluster = testUtil.getCluser();
      bucket = cluster.openBucket('lounge_test', function (err) {
        if (err) {
          return done(err);
        }

        lounge.connect({
          bucket: bucket
        }, function (err) {
          if (err) {
            return done(err);
          }

          bucket.manager().flush(function (err) {
            if (err) {
              return done(err);
            }

            companySchema = lounge.schema({
              id: {type: String, key: true, generate: true, prefix: 'company::'},
              name: String,
              streetAddress: String,
              city: String,
              country: String,
              state: String,
              postalCode: String,
              founded: Date
            });

            Company = lounge.model('Company', companySchema);

            userSchema = lounge.schema({
              firstName: String,
              lastName: String,
              email: {type: String, key: true, generate: false},
              dateOfBirth: Date,
              company: {type: Company}
            });

            User = lounge.model('User', userSchema);

            commentSchema = lounge.schema({
              body: String,
              user: User
            });

            Comment = lounge.model('Comment', commentSchema);

            postSchema = lounge.schema({
              title: String,
              body: String,
              comments: [Comment]
            });

            Post = lounge.model('Post', postSchema);

            ts.setup(bucket, done);
          });
        });
      });
    });

    it('should remove a simple document', function (done) {
      var email = ts.data.users[0].email;

      User.remove(email, function (err) {
        expect(err).to.not.be.ok;

        bucket.get(email, function (err, doc) {
          expect(doc).to.not.be.ok;
          expect(err).to.be.ok;
          expect(err.code).to.equal(couchbase.errors.keyNotFound);
          done();
        });
      });
    });

    it('should remove a simple document - promised', function (done) {
      var email = ts.data.users[0].email;

      User.remove(email).then(function () {
        bucket.get(email, function (err, doc) {
          expect(doc).to.not.be.ok;
          expect(err).to.be.ok;
          expect(err.code).to.equal(couchbase.errors.keyNotFound);
          done();
        });
      });
    });

    it('should remove a simple document with lean option', function (done) {
      var email = ts.data.users[0].email;

      User.remove(email, {lean: true}, function (err) {
        expect(err).to.not.be.ok;

        bucket.get(email, function (err, doc) {
          expect(doc).to.not.be.ok;
          expect(err).to.be.ok;
          expect(err.code).to.equal(couchbase.errors.keyNotFound);
          done();
        });
      });
    });

    it('should not remove refs if option not specified', function (done) {
      var email = ts.data.users[0].email;
      var companyData = ts.data.companies[0];

      User.remove(email, function (err) {
        expect(err).to.not.be.ok;

        bucket.get(email, function (err, doc) {
          expect(doc).to.not.be.ok;
          expect(err).to.be.ok;
          expect(err.code).to.equal(couchbase.errors.keyNotFound);

          var companyKey = Company.getDocumentKeyValue(ts.data.users[0].company, true);

          bucket.get(companyKey, function (err, doc) {
            expect(err).to.be.not.ok;

            expect(doc).to.be.ok;
            expect(doc).to.be.an('object');
            expect(doc.value).to.be.ok;
            expect(doc.value).to.be.an('object');
            expect(doc.value.id).to.equal(companyData.id);
            expect(doc.value.name).to.equal(companyData.name);
            expect(doc.value.streetAddress).to.equal(companyData.streetAddress);
            expect(doc.value.city).to.equal(companyData.city);
            expect(doc.value.state).to.equal(companyData.state);
            expect(doc.value.postalCode).to.equal(companyData.postalCode);
            expect(doc.value.founded).to.be.ok;

            done();
          });
        });
      });
    });

    it('should not remove refs if lean option specified', function (done) {
      var email = ts.data.users[0].email;
      var companyData = ts.data.companies[0];

      User.remove(email, {lean: true}, function (err) {
        expect(err).to.not.be.ok;

        bucket.get(email, function (err, doc) {
          expect(doc).to.not.be.ok;
          expect(err).to.be.ok;
          expect(err.code).to.equal(couchbase.errors.keyNotFound);

          var companyKey = Company.getDocumentKeyValue(ts.data.users[0].company, true);

          bucket.get(companyKey, function (err, doc) {
            expect(err).to.be.not.ok;

            expect(doc).to.be.ok;
            expect(doc).to.be.an('object');
            expect(doc.value).to.be.ok;
            expect(doc.value).to.be.an('object');
            expect(doc.value.id).to.equal(companyData.id);
            expect(doc.value.name).to.equal(companyData.name);
            expect(doc.value.streetAddress).to.equal(companyData.streetAddress);
            expect(doc.value.city).to.equal(companyData.city);
            expect(doc.value.state).to.equal(companyData.state);
            expect(doc.value.postalCode).to.equal(companyData.postalCode);
            expect(doc.value.founded).to.be.ok;

            done();
          });
        });
      });
    });

    it('should remove refs if option is specified', function (done) {
      var userData = ts.data.users[1];

      User.remove(userData.email, {removeRefs: true}, function (err) {
        expect(err).to.not.be.ok;

        bucket.get(userData.email, function (err, doc) {
          expect(doc).to.not.be.ok;
          expect(err).to.be.ok;
          expect(err.code).to.equal(couchbase.errors.keyNotFound);

          var companyKey = Company.getDocumentKeyValue(userData.company, true);

          bucket.get(companyKey, function (err) {
            expect(err).to.be.ok;
            expect(err.code).to.equal(couchbase.errors.keyNotFound);

            done();
          });
        });
      });
    });

    it('should remove array refs if option is specified', function (done) {
      var postData = ts.data.posts[0];

      Post.remove(postData.id, {removeRefs: true}, function (err) {
        expect(err).to.not.be.ok;

        var docKey = Post.getDocumentKeyValue(postData.id, true);
        bucket.get(docKey, function (err) {
          expect(err).to.be.ok;
          expect(err.code).to.equal(couchbase.errors.keyNotFound);

          async.eachLimit(postData.comments, 10, function (cid, eaCb) {
            var key = Comment.getDocumentKeyValue(cid, true);

            bucket.get(key, function (err) {
              expect(err).to.be.ok;
              expect(err.code).to.equal(couchbase.errors.keyNotFound);
              eaCb();
            });
          }, done);
        });
      });
    });

    it('should remove nested array refs if option is specified', function (done) {
      var postData = ts.data.posts[2];

      Post.remove(postData.id, {removeRefs: true}, function (err) {
        expect(err).to.not.be.ok;


        var docKey = Post.getDocumentKeyValue(postData.id, true);
        bucket.get(docKey, function (err) {
          expect(err).to.be.ok;
          expect(err.code).to.equal(couchbase.errors.keyNotFound);

          async.eachLimit(postData.comments, 10, function (cid, eaCb) {
            var key = Comment.getDocumentKeyValue(cid, true);

            bucket.get(key, function (err) {
              expect(err).to.be.ok;
              expect(err.code).to.equal(couchbase.errors.keyNotFound);
              eaCb();
            });
          }, function () {
            var users = _.uniq([ts.data.comments[3].user, ts.data.comments[4].user, ts.data.comments[5].user]);
            async.eachLimit(users, 10, function (uid, eaCb) {
              var key = User.getDocumentKeyValue(uid, true);

              bucket.get(key, function (err) {
                expect(err).to.be.ok;
                expect(err.code).to.equal(couchbase.errors.keyNotFound);
                eaCb();
              });
            }, function () {
              var companies = [ts.data.companies[0].id, ts.data.companies[2].id];

              async.eachLimit(companies, 10, function (cid, eaCb) {
                var key = Company.getDocumentKeyValue(cid, true);

                bucket.get(key, function (err) {
                  expect(err).to.be.ok;
                  expect(err.code).to.equal(couchbase.errors.keyNotFound);
                  eaCb();
                });
              }, done);
            });
          });
        });
      });
    });

    it('should remove an array of documents', function (done) {
      var email = ts.data.users[0].email;
      var email2 = ts.data.users[1].email;

      User.remove([email, email2], function (err) {
        expect(err).to.not.be.ok;

        bucket.getMulti([email, email2], function (err) {
          expect(err).to.be.ok;
          expect(err).to.equal(2);
          done();
        });
      });
    });

    it('should not remove refs if option not specified when removing arrays', function (done) {
      var email = ts.data.users[0].email;
      var companyData = ts.data.companies[0];

      var email2 = ts.data.users[1].email;
      var companyData2 = ts.data.companies[1];

      User.remove([email, email2], function (err) {
        expect(err).to.not.be.ok;

        bucket.getMulti([email, email2], function (err) {
          expect(err).to.be.ok;
          expect(err).to.equal(2);

          var companyKey1 = Company.getDocumentKeyValue(companyData.id, true);
          var companyKey2 = Company.getDocumentKeyValue(companyData2.id, true);

          bucket.getMulti([companyKey1, companyKey2], function (err, res) {
            expect(err).to.be.not.ok;

            expect(res).to.be.ok;
            expect(res).to.be.an('object');
            expect(res[companyKey1]).to.be.an('object');
            expect(res[companyKey2]).to.be.an('object');

            done();
          });
        });
      });
    });

    it('should remove refs if option is specified with arrays', function (done) {
      var email = ts.data.users[0].email;
      var companyData = ts.data.companies[0];

      var email2 = ts.data.users[1].email;
      var companyData2 = ts.data.companies[1];

      User.remove([email, email2], {removeRefs: true}, function (err) {
        expect(err).to.not.be.ok;

        bucket.getMulti([email, email2], function (err) {
          expect(err).to.be.ok;
          expect(err).to.equal(2);

          var companyKey1 = Company.getDocumentKeyValue(companyData.id, true);
          var companyKey2 = Company.getDocumentKeyValue(companyData2.id, true);

          bucket.getMulti([companyKey1, companyKey2], function (err) {
            expect(err).to.be.ok;
            expect(err).to.equal(2);

            done();
          });
        });
      });
    });

    it('should not remove refs if lean option is specified when removing arrays', function (done) {
      var email = ts.data.users[0].email;
      var companyData = ts.data.companies[0];

      var email2 = ts.data.users[1].email;
      var companyData2 = ts.data.companies[1];

      User.remove([email, email2], {lean: true}, function (err) {
        expect(err).to.not.be.ok;

        bucket.getMulti([email, email2], function (err) {
          expect(err).to.be.ok;
          expect(err).to.equal(2);

          var companyKey1 = Company.getDocumentKeyValue(companyData.id, true);
          var companyKey2 = Company.getDocumentKeyValue(companyData2.id, true);

          bucket.getMulti([companyKey1, companyKey2], function (err, res) {
            expect(err).to.be.not.ok;

            expect(res).to.be.ok;
            expect(res).to.be.an('object');
            expect(res[companyKey1]).to.be.an('object');
            expect(res[companyKey2]).to.be.an('object');

            done();
          });
        });
      });
    });
  });

  describe('remove() pre hooks tests', function () {
    this.slow(200);

    beforeEach(function (done) {
      if (lounge) {
        lounge.disconnect();
      }

      lounge = new lounge.Lounge(); // recreate it

      userSchema = companySchema = commentSchema = postSchema = null;
      User = Company = Post = Comment = null;

      var cluster = testUtil.getCluser();
      bucket = cluster.openBucket('lounge_test', function (err) {
        if (err) {
          return done(err);
        }

        lounge.connect({
          bucket: bucket
        }, function (err) {
          if (err) {
            return done(err);
          }

          companySchema = lounge.schema({
            id: {type: String, key: true, generate: true, prefix: 'company::'},
            name: String,
            streetAddress: String,
            city: String,
            country: String,
            state: String,
            postalCode: String,
            founded: Date
          });

          Company = lounge.model('Company', companySchema);

          userSchema = lounge.schema({
            firstName: String,
            lastName: String,
            email: {type: String, key: true, generate: false},
            dateOfBirth: Date,
            company: Company
          });

          ts.setup(bucket, done);
        });
      });
    });

    it('should call sync pre remove', function (done) {

      var preCalled = false;

      userSchema.pre('remove', function (next) {
        preCalled = true;
        next();
      });

      User = lounge.model('User', userSchema);

      var userData = ts.data.users[0];

      User.remove(userData.email, function (err) {
        expect(err).to.not.be.ok;

        expect(preCalled).to.be.ok;

        bucket.get(userData.email, function (err, doc) {
          expect(doc).to.not.be.ok;
          expect(err).to.be.ok;
          expect(err.code).to.equal(couchbase.errors.keyNotFound);
          done();
        });
      });
    });

    it('should call sync pre remove on arrays', function (done) {

      var preCalled = 0;

      userSchema.pre('remove', function (next) {
        preCalled = preCalled + 1;
        next();
      });

      User = lounge.model('User', userSchema);

      var emails = [ts.data.users[0].email, ts.data.users[1].email];

      User.remove(emails, function (err) {
        expect(err).to.not.be.ok;

        expect(preCalled).to.equal(2);

        bucket.getMulti(emails, function (err) {
          expect(err).to.be.ok;
          expect(err).to.equal(2);
          done();
        });
      });
    });

    it('should not call sync pre remove when lean option specified', function (done) {
      var preCalled = false;

      userSchema.pre('remove', function (next) {
        preCalled = true;
        next();
      });

      User = lounge.model('User', userSchema);

      var userData = ts.data.users[0];

      User.remove(userData.email, {lean: true}, function (err) {
        expect(err).to.not.be.ok;

        expect(preCalled).to.not.be.ok;

        bucket.get(userData.email, function (err, doc) {
          expect(doc).to.not.be.ok;
          expect(err).to.be.ok;
          expect(err.code).to.equal(couchbase.errors.keyNotFound);
          done();
        });
      });
    });

    it('should not call sync pre remove on arrays', function (done) {

      var preCalled = 0;

      userSchema.pre('remove', function (next) {
        preCalled = preCalled + 1;
        next();
      });

      User = lounge.model('User', userSchema);

      var emails = [ts.data.users[0].email, ts.data.users[1].email];

      User.remove(emails, {lean: true}, function (err) {
        expect(err).to.not.be.ok;

        expect(preCalled).to.equal(0);

        bucket.getMulti(emails, function (err) {
          expect(err).to.be.ok;
          expect(err).to.equal(2);
          done();
        });
      });
    });

    it('should call async pre remove', function (done) {

      var preCalled = false;

      userSchema.pre('remove', function (next, done) {
        var self = this;
        setTimeout(function () {
          if (self.email) {
            self.email = self.email.toLowerCase();
          }
          done();
          preCalled = true;
        }, 100);
        next();
      });

      User = lounge.model('User', userSchema);

      var userData = ts.data.users[0];

      User.remove(userData.email, function (err) {
        expect(err).to.not.be.ok;

        bucket.get(userData.email, function (err, doc) {
          expect(doc).to.not.be.ok;
          expect(err).to.be.ok;
          expect(err.code).to.equal(couchbase.errors.keyNotFound);

          expect(preCalled).to.be.ok;

          done();
        });
      });
    });

    it('should call async pre remove on arrays', function (done) {

      var preCalled = 0;

      userSchema.pre('remove', function (next, done) {
        var self = this;
        setTimeout(function () {
          if (self.email) {
            self.email = self.email.toLowerCase();
          }
          done();
          preCalled = preCalled + 1;
        }, 100);
        next();
      });

      User = lounge.model('User', userSchema);

      var emails = [ts.data.users[0].email, ts.data.users[1].email];

      User.remove(emails, function (err) {
        expect(err).to.not.be.ok;

        bucket.getMulti(emails, function (err) {
          expect(err).to.be.ok;
          expect(err).to.equal(2);

          expect(preCalled).to.equal(2);

          done();
        });
      });
    });

    it('should not call async pre remove if lean option speficied', function (done) {

      var preCalled = false;

      userSchema.pre('remove', true, function (next, done) {
        var self = this;
        setTimeout(function () {
          if (self.email) {
            self.email = self.email.toLowerCase();
          }
          done();
          preCalled = true;
        }, 100);
        next();
      });

      User = lounge.model('User', userSchema);

      var userData = ts.data.users[0];

      User.remove(userData.email, {lean: true}, function (err) {
        expect(err).to.not.be.ok;

        bucket.get(userData.email, function (err, doc) {
          expect(doc).to.not.be.ok;
          expect(err).to.be.ok;
          expect(err.code).to.equal(couchbase.errors.keyNotFound);

          expect(preCalled).to.not.be.ok;

          done();
        });
      });
    });

    it('should not call async pre remove on arrays with lean option', function (done) {

      var preCalled = 0;

      userSchema.pre('remove', true, function (next, done) {
        var self = this;
        setTimeout(function () {
          if (self.email) {
            self.email = self.email.toLowerCase();
          }
          done();
          preCalled = preCalled + 1;
        }, 100);
        next();
      });

      User = lounge.model('User', userSchema);

      var emails = [ts.data.users[0].email, ts.data.users[1].email];

      User.remove(emails, {lean: true}, function (err) {
        expect(err).to.not.be.ok;

        bucket.getMulti(emails, function (err) {
          expect(err).to.be.ok;
          expect(err).to.equal(2);

          expect(preCalled).to.equal(0);

          done();
        });
      });
    });

    it('should call sync pre remove and it should abort the remove if error', function (done) {

      var preCalled = false;
      var msg = 'Cannot delete this document';

      userSchema.pre('remove', function (next) {
        preCalled = true;

        next(new Error(msg));
      });

      User = lounge.model('User', userSchema);

      var userData = ts.data.users[0];
      var user = new User(userData);

      User.remove(userData.email, function (err, rdoc) {
        expect(err).to.be.ok;
        expect(err.message).to.equal(msg);
        expect(preCalled).to.be.ok;

        var docKey = User.getDocumentKeyValue(user.email, true);
        bucket.get(docKey, function (err, doc) {
          expect(doc).to.be.ok;
          expect(err).to.not.be.ok;
          expect(doc.value).to.be.ok;
          expect(doc.value.email).to.equal(userData.email);

          done();
        });
      });
    });

    it('should call pre remove on nested documents', function (done) {
      var userPreCalled = 0;
      var commentPreCalled = 0;

      userSchema.pre('remove', function (next) {
        userPreCalled = userPreCalled + 1;
        next();
      });

      User = lounge.model('User', userSchema);

      commentSchema = lounge.schema({
        body: String,
        user: {type: User}
      });

      commentSchema.pre('remove', function (next) {
        commentPreCalled = commentPreCalled + 1;

        next();
      });

      Comment = lounge.model('Comment', commentSchema);

      postSchema = lounge.schema({
        title: String,
        body: String,
        comments: [{type: Comment}]
      });

      Post = lounge.model('Post', postSchema);

      var postData = ts.data.posts[2];
      var post = new Post(postData);

      post.remove({removeRefs: true}, function (err, rdoc) {
        expect(err).to.not.be.ok;

        expect(rdoc).to.be.ok;
        expect(rdoc).to.be.an('object');
        expect(rdoc).to.be.an.instanceof(Post);
        expect(rdoc.id).to.equal(postData.id);
        expect(rdoc.title).to.equal(postData.title);
        expect(rdoc.body).to.equal(postData.body);
        expect(rdoc.comments.toArray()).to.deep.equal(postData.comments);

        expect(userPreCalled).to.equal(3);
        expect(commentPreCalled).to.equal(3);

        var docKey = Post.getDocumentKeyValue(rdoc.id, true);
        bucket.get(docKey, function (err, doc) {
          expect(doc).to.not.be.ok;
          expect(err).to.be.ok;
          expect(err.code).to.equal(couchbase.errors.keyNotFound);

          async.eachLimit(rdoc.comments, 10, function (cid, eaCb) {
            var key = Comment.getDocumentKeyValue(cid, true);

            bucket.get(key, function (err, doc) {
              expect(doc).to.not.be.ok;
              expect(err).to.be.ok;
              expect(err.code).to.equal(couchbase.errors.keyNotFound);
              eaCb();
            });
          }, function () {
            var users = _.uniq([ts.data.comments[3].user, ts.data.comments[4].user, ts.data.comments[5].user]);
            async.eachLimit(users, 10, function (uid, eaCb) {
              var key = User.getDocumentKeyValue(uid, true);

              bucket.get(key, function (err, doc) {
                expect(doc).to.not.be.ok;
                expect(err).to.be.ok;
                expect(err.code).to.equal(couchbase.errors.keyNotFound);
                eaCb();
              });
            }, function () {
              var companies = [ts.data.companies[0].id, ts.data.companies[2].id];

              async.eachLimit(companies, 10, function (cid, eaCb) {
                var key = Company.getDocumentKeyValue(cid, true);

                bucket.get(key, function (err, doc) {
                  expect(doc).to.not.be.ok;
                  expect(err).to.be.ok;
                  expect(err.code).to.equal(couchbase.errors.keyNotFound);
                  eaCb();
                });
              }, done);
            });
          });
        });
      });
    });
  });

  describe('remove() post hooks tests', function () {
    this.slow(200);

    beforeEach(function (done) {
      if (lounge) {
        lounge.disconnect();
      }

      lounge = new lounge.Lounge(); // recreate it

      userSchema = companySchema = commentSchema = postSchema = null;
      User = Company = Post = Comment = null;

      var cluster = testUtil.getCluser();
      bucket = cluster.openBucket('lounge_test', function (err) {
        if (err) {
          return done(err);
        }

        lounge.connect({
          bucket: bucket
        }, function (err) {
          if (err) {
            return done(err);
          }

          companySchema = lounge.schema({
            id: {type: String, key: true, generate: true, prefix: 'company::'},
            name: String,
            streetAddress: String,
            city: String,
            country: String,
            state: String,
            postalCode: String,
            founded: Date
          });

          Company = lounge.model('Company', companySchema);

          userSchema = lounge.schema({
            firstName: String,
            lastName: String,
            email: {type: String, key: true, generate: false},
            dateOfBirth: Date,
            company: Company
          });

          ts.setup(bucket, done);
        });
      });
    });

    it('should call sync post remove', function (done) {

      var postCalled = false;

      userSchema.post('remove', function () {
        postCalled = true;
      });

      User = lounge.model('User', userSchema);

      var userData = ts.data.users[0];
      var user = new User(userData);

      user.remove(function (err, rdoc) {
        expect(err).to.not.be.ok;

        expect(rdoc).to.be.ok;
        expect(rdoc).to.be.an('object');
        expect(rdoc).to.be.an.instanceof(User);
        expect(rdoc.firstName).to.equal(userData.firstName);
        expect(rdoc.lastName).to.equal(userData.lastName);
        expect(rdoc.email).to.equal(userData.email);
        expect(rdoc.company).to.equal(userData.company);
        expect(rdoc.dateOfBirth).to.be.ok;
        expect(rdoc.dateOfBirth).to.be.an.instanceof(Date);

        bucket.get(rdoc.email, function (err, doc) {
          expect(doc).to.not.be.ok;
          expect(err).to.be.ok;
          expect(err.code).to.equal(couchbase.errors.keyNotFound);

          expect(postCalled).to.be.ok;

          done();
        });
      });
    });

    it('should not call sync post remove middleware on remove error', function (done) {
      process.env.LOUNGE_DEBUG_FORCE_REMOVE_FAIL = true;
      var postCalled = false;

      userSchema.post('remove', function () {
        postCalled = true;
      });

      User = lounge.model('User', userSchema);

      var userData = ts.data.users[0];
      var user = new User(userData);

      user.remove(function (err, rdoc) {
        expect(err).to.be.ok;

        expect(rdoc).to.not.be.ok;

        var docKey = User.getDocumentKeyValue(user.email, true);
        bucket.get(docKey, function (err, doc) {
          expect(doc).to.be.ok;
          expect(err).to.not.be.ok;
          expect(doc.value).to.be.ok;
          expect(doc.value.email).to.equal(user.email);

          expect(postCalled).to.not.be.ok;

          delete process.env.LOUNGE_DEBUG_FORCE_REMOVE_FAIL;

          done();
        });
      });
    });

    it('should call post remove on nested documents', function (done) {
      var userPostCalled = 0;
      var commentPostCalled = 0;

      userSchema.post('remove', function () {
        userPostCalled = userPostCalled + 1;
      });

      User = lounge.model('User', userSchema);

      commentSchema = lounge.schema({
        body: String,
        user: User
      });

      commentSchema.post('remove', function () {
        commentPostCalled = commentPostCalled + 1;
      });

      Comment = lounge.model('Comment', commentSchema);

      postSchema = lounge.schema({
        title: String,
        body: String,
        comments: [Comment]
      });

      Post = lounge.model('Post', postSchema);

      var postData = ts.data.posts[2];
      var post = new Post(postData);

      post.remove({removeRefs: true}, function (err, rdoc) {
        expect(err).to.not.be.ok;

        expect(rdoc).to.be.ok;
        expect(rdoc).to.be.an('object');
        expect(rdoc).to.be.an.instanceof(Post);
        expect(rdoc.id).to.equal(postData.id);
        expect(rdoc.title).to.equal(postData.title);
        expect(rdoc.body).to.equal(postData.body);
        expect(rdoc.comments.toArray()).to.deep.equal(postData.comments);

        var docKey = Post.getDocumentKeyValue(rdoc.id, true);
        bucket.get(docKey, function (err, doc) {
          expect(doc).to.not.be.ok;
          expect(err).to.be.ok;
          expect(err.code).to.equal(couchbase.errors.keyNotFound);

          async.eachLimit(rdoc.comments, 10, function (cid, eaCb) {
            var key = Comment.getDocumentKeyValue(cid, true);

            bucket.get(key, function (err, doc) {
              expect(doc).to.not.be.ok;
              expect(err).to.be.ok;
              expect(err.code).to.equal(couchbase.errors.keyNotFound);
              eaCb();
            });
          }, function () {
            var users = _.uniq([ts.data.comments[3].user, ts.data.comments[4].user, ts.data.comments[5].user]);
            async.eachLimit(users, 10, function (uid, eaCb) {
              var key = User.getDocumentKeyValue(uid, true);

              bucket.get(key, function (err, doc) {
                expect(doc).to.not.be.ok;
                expect(err).to.be.ok;
                expect(err.code).to.equal(couchbase.errors.keyNotFound);
                eaCb();
              });
            }, function () {
              var companies = [ts.data.companies[0].id, ts.data.companies[2].id];

              async.eachLimit(companies, 10, function (cid, eaCb) {
                var key = Company.getDocumentKeyValue(cid, true);

                bucket.get(key, function (err, doc) {
                  expect(doc).to.not.be.ok;
                  expect(err).to.be.ok;
                  expect(err.code).to.equal(couchbase.errors.keyNotFound);

                  eaCb();
                });
              }, function () {
                expect(userPostCalled).to.equal(3);
                expect(commentPostCalled).to.equal(3);

                done();
              });
            });
          });
        });
      });
    });
  });
});
