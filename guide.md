# Lounge

Simple Mongoose-inspired ODM for [Couchbase](http://www.couchbase.com).

## Installation

`npm install lounge`

**Node.js >= 0.12 supported. For all features, run node with the harmony ````--harmony```` and harmony proxies ````--harmony_proxies```` flags.**

## Stability

This module is under development and there could be bugs. API may not be 100% locked down. 
Documentation is still work in progress.

## Overview

Lounge is a simple, somewhat opinionated, Mongoose-inspired ODM for [Couchbase](http://www.couchbase.com). Main goal is
to provide modeling tool framework for working with Couchbase databases in an asynchronous environment of Node.js. 

```js
var lounge = require('lounge');
lounge.connect({ 
  connectionString: 'couchbase://127.0.0.1',
  bucket: 'lounge_test'
});

var schema = lounge.schema({ name: String });
var Cat = lounge.model('Cat', schema);

var kitty = new Cat({ name: 'Zildjian' });
kitty.save(function (err) {
  if (err) // ...
  console.log('meow');
});
```

**Features**

* Schema definition
* Strict modelling based on schema
* Schema extension
* Automatic type validation and custom validation
* Document upsert and removal
* Embedded (referenced) documents
* Automatic and manual population of embedded (referenced) document
* Middleware including pre and post hooks
* Indexing using [reference lookup documents](http://docs.couchbase.com/developer/dev-guide-3.0/lookups.html)

**Outside of the scope of this module**

* Document and view management. There are too many patterns and ways of performing document and view management and 
 view lookup that it is impractical to accommodate anything sane within a simple ODM. This can easily be expanded
 on top of Lounge.
* View queries. For same reasons this falls outside of the scope of Lounge.
* Automatic document removal on key change. That is if a document key property changes, the new document is saved under
the new key. The old document sticks around under the old key. There are too many implications if we start automatically
handle document removal in this scenario. This should be handled by the user of this module.

## Guide

* [Modelling](#model)
* [Types](#types)
* [Middleware](#middleware)
* [Schema Extending](#extend)
* [Embedded Documents](#embedded)
* [Saving Documents](#saving)
* [Getting Documents](#getting)
* [Removing Documents](#removing)
* [Population](#population)
* [Indexes](#indexes)
* [Events](#events)
* [Errors](#errors)

## Modelling <a id="model"></a>

**Basics**

We begin defining a data model using a schema.

```js
var userSchema = lounge.schema({
  firstName: String,
  lastName: String,
  age: Number,
  usernames: [String],
  setup: Boolean
  metadata: {
    createdAt: Date,
    updatedAt: Date
  }
});
```

We can add additional properties using `add` function:

```js
userSchema.add('name', String);
```

Alternatively we can explicitly specify the type using `type` property:

```js
var catSchema = lounge.schema({
  name: { type: String }
  breed: String,
});

catSchema.add('age', {type: String});
```

Schema options can be set at construction or using the `set` function.
 
```js
var catSchema = lounge.schema({
  name: { type: String }
  breed: String,
});

catSchema.set('minimize', false);
```

**Document keys**

By default schemas come with an `id` property as the document key, and the automatically generated value will be
a [UUID](https://en.wikipedia.org/wiki/Universally_unique_identifier) 
using [node-uuid](https://www.npmjs.com/package/node-uuid) `v4()` function. This should be most practical and 
appropriate in a lot of cases. Alternatively you can specify explicit key properties:

```js
var userSchema = lounge.schema({
  firstName: String,
  lastName: String,
  email: { type: String, key: true, generate: false }
});
```

Here we desire `email` to be used as the document key and we specify `generate: false` because we do not want Lounge
to automatically handle key property value generation. If we still want uuid generation but in a different property 
we can specify so:

```js
var userSchema = lounge.schema({
  firstName: String,
  lastName: String,
  email: String,
  userId: {type: String, key: true, generate: true }
});
```

`generate` does not have to be set explicitly to `true` as that is the default.
 
We can specify additional prefix and/or suffix for keys. This will be used when wrigin to the database as the actual
document key.

```js
var userSchema = lounge.schema({
  firstName: String,
  lastName: String,
  email: { type: String, key: true, generate: false, prefix: 'user'}
});
```

Note that setting prefix and suffix options like this will take presidence over any `keyPrefix` and `keySuffix` 
options specified in the second options parameter to the `schema()` call or any settings in the lounge config.

**Examples**

```js
var lounge = require('lounge');

// ... connect

var userSchema = lounge.schema({
  name: String
  email: { type: String, key: true, generate: false, prefix: 'user::'}
});

var User = lounge.model('User', userSchema);
var user = new User({name: 'Bob Smith', email: 'bsmith@acme.com'});
user.save();
```

This will save the user document under key `user::bsmith@acme.com`.

```js
var lounge = require('lounge');

// ... connect

var userSchema = lounge.schema({
  name: String
}, {
  keyPrefix: 'user::'
});

var User = lounge.model('User', userSchema);
var user = new User({name: 'Bob Smith'});
user.save();
```

This will automatically generate a uuid `id` property and save the user document under key 
similar to `user::110ec58a-a0f2-4ac4-8393-c866d813b8d1`.

**Data manipulation**

Data in Model instances can be access directly or using `get` function. Similarly it can be manipulated using 
either assignment operator or using the `set` function. In either case the input value is validated to be of proper type.
 
```js
var userSchema = lounge.schema({
  name: String
  friends: Number,
  dob: Date,
  setup: Boolean
});

var User = lounge.model('User', userSchema);
var user = new User({name: 'Bob Smith'});

user.get('name'); // 'Bob Smith'
user.name = 'Joe'; // OK
user.name.set('Joe'); // OK
console.log(user.name); // 'Joe'
user.set('friends', 20); // OK
user.friends = 'abc'; // nope. still 20
user.dob = new Date('July 5, 1980');
user.get('dob'); // instance of Date
user.set('setup', 'yup'); // nope
user.setup = true; // OK
```

**Validation**

Lounge does automatic validation against input data using the type information specified in the schema definition.
We can provide custom validation in schema definition by providing `validator` function.
 
```js
var validator = require('validator'); // Node validator module

var userSchema = lounge.schema({
  name: String
  email: {type: String, validate: validator.isEmail}
});

var User = lounge.model('User', userSchema);
var user = new User({ name: 'Bob Smith' });

user.email = 'bob@gmail.com'; // OK
user.email = 'bsmith'; // Nope
console.log(user.email); // 'bob@gmail.com'
```

**Virtuals**

Virtuals are document properties that you can get and set but that do not get persisted to the database. 
The getters are useful for formatting or combining fields, while setters are useful for de-composing a single value 
into multiple values for storage.

```js
var userSchema = lounge.schema({
  firstName: String, 
  lastName: String
});

userSchema.virtual('fullName', {
  get: function () {
    return this.firstName + ' ' + this.lastName;
  },
  set: function (v) {
    if (v !== undefined) {
      var parts = v.split(' ');
      this.firstName = parts[0];
      this.lastName = parts[1];
    }
  }
});

var User = lounge.model('User', userSchema);
var user = new User({firstName: 'Bob', lastName: 'Smith'});
console.log(user.fullName); // Bob Smith
user.fullName = 'Jim Jones';
console.log(user.fullName); // Jim Jones
console.log(user.firstName); // Jim
console.log(user.lastName); // Jones
```

If no `set` function is defined the virtual is read-only.

**Statics**

Adding static methods to Models can be accomplished using `static()` schema function

```js
var userSchema = lounge.schema({
  firstName: String, 
  lastName: String
});

userSchema.static('foo', function(p, q) {
  return p + q;
});

var User = lounge.model('User', userSchema);
User.foo(1, 2); // 3
```

We can also pass an object of function keys and function values, and they will all be added.

**Methods**

Similarly adding instance methods to Models can be done using `method()` schema function. 

```js
var userSchema = lounge.schema({
  firstName: String, 
  lastName: String
});

userSchema.method('fullName', function() {
  return this.firstName + ' ' + this.lastName;
});

var User = lounge.model('User', userSchema);
var user = new User({firstName: 'Bob', lastName: 'Smith'});
user.fullName(); // 'Bob Smith'
```

We can also pass an object of function keys and function values, and they will all be added.

**init() method**

There is a special `init` method that if specified in schema definition will be called at the end of model creation. 
You can do additional setup here. This method is not passed in any arguments.

**toObject()**

Model instances come with `toObject` function that is automatically used for `console.log` inspection. 

Options:

* `transform` - function used to transform an object once it's been converted to plain javascript representation from a
model instance.
* `minimize` - to "minimize" the document by removing any empty properties. Default: `true`
* `virtuals` - to apply virtual getters

These settings can be applied on any invocation of `toObject` as well they can be set at schema level.

```js
var userSchema = lounge.schema({
  name: String,
  email: String,
  password: String
});

var xform = function (doc, ret, options) {
  delete ret.password;
  return ret;
};

userSchema.set('toObject', {transform: xform});

var User = lounge.model('User', userSchema);

var user = new User({
  name: 'Joe',
  email: 'joe@gmail.com',
  password: 'password'
});

console.log(user); // { name: 'Joe', email: 'joe@gmail.com' }
```

**toJSON()**

Similar to `toObject`. The return value of this method is used in calls to `JSON.stringify`.

**CAS**

All document instances have a read-only property `cas` that returns the string representation of the CAS object retrieved
from the database. The `cas` property is initialized only once a document has been retrieved from the database using one
of query functions, or once it has been saved. Alternatively we can use the method `getCAS(raw)` to get the cas value.
If `raw` is `true` then we return the raw CAS object. Otherwise we return string representation. This can be useful
for computation of ETag values for example.

```js
console.log(doc.cas); // String: 00000000a71626e4
console.log(doc.getCAS()); // String: 00000000a71626e4
console.log(doc.getCAS(true)); // Object: CouchbaseCas<11338961768815788032>
```

**Useful member variables**

All model instances come with a `modelName` read only property that you can use to access the model name. As well
instances have `schema` property that represents the models schema used when creating the model with `model()` function.
 
```js
var userSchema = lounge.schema({
  name: String,
  email: String
});

var User = lounge.model('User', userSchema);
var user = new User({name: 'Bob Smith'});

console.log(user.modelName); // 'User'
console.log(user.schema instanceof lounge.Schema); // true
```

## Types <a id="types"></a>

Supported types:
- String
- Number
- Boolean
- Date
- Array (including types within Array)
- Object (including typed Models for sub-schemas)
- 'any'

When a type is specified, it will be enforced. Typecasting is enforced on all types except 'any'. If a value cannot be typecasted to the correct type, the original value will remain untouched.

Types can be extended with a variety of attributes. Some attributes are type-specific and some apply to all types.

Custom types can be created by defining an object with type properties.

```js
var NotEmptyString = {type: String, minLength: 1};
country: {type: NotEmptyString, default: 'USA'}
```

#### General attributes

**transform**
Called immediately when value is set and before any typecast is done.

```js
name: {type: String, transform: function(value) {
  // Modify the value here...
  return value;
}}
```

**validate**
Called immediately when value is set and before any typecast is done. Can be used for validating input data.
If you return `false` the write operation will be cancelled.

```js
name: {type: String, validate: function(value) {
  // check
  return value;
}}
```

**default**
Provide default value. You may pass value directly or pass a function which will be executed when the object is initialized. The function is executed in the context of the object and can use "this" to access other properties (which .

```js
country: {type: String, default: 'USA'}
```

**get**
Provide function to transform value when retrieved. Executed in the context of the object and can use "this" to access properties.

```js
string: {type: String, getter: function(value) { return value.toUpperCase(); }}
```

**readOnly**
If true, the value can be read but cannot be written to. This can be useful for creating fields that reflect other values.

```js
fullName: {type: String, readOnly: true, default: function(value) {
  return (this.firstName + ' ' + this.lastName).trim();
}}
```

**invisible**
If true, the value can be written to but isn't outputted as an index when `toObject()` is called. 
This can be useful for hiding internal variables.


#### String

**stringTransform**
Called after value is typecast to string **if** value was successfully typecast but called before all validation.

```js
postalCode: {type: String, stringTransform: function(string) {
  // Type will ALWAYS be String, so using string prototype is OK.
  return string.toUpperCase();
}}
```

**regex**
Validates string against Regular Expression. If string doesn't match, it's rejected.

```js
memberCode: {type: String, regex: new RegExp('^([0-9A-Z]{4})$')}
```

**enum**
Validates string against array of strings. If not present, it's rejected.

```js
gender: {type: String, enum: ['m', 'f']}
```

**minLength**
Enforces minimum string length.

```js
notEmpty: {type: String, minLength: 1}
```

**maxLength**
Enforces maximum string length.

```js
stateAbbrev: {type: String, maxLength: 2}
```

**clip**
If true, clips string to maximum string length instead of rejecting string.

```js
bio: {type: String, maxLength: 255, clip: true}
```

#### Number

**min**
Number must be > min attribute or it's rejected.

```js
positive: {type: Number, min: 0}
```

**max**
Number must be < max attribute or it's rejected.

```js
negative: {type: Number, max: 0}
```

#### Array

**unique**
Ensures duplicate-free array, using === to test object equality.

```js
emails: {type: Array, unique: true, arrayType: String}
```

**arrayType**
Elements within the array will be typed to the attributes defined.

```js
aliases: {type: Array, arrayType: {type: String, minLength: 1}}
```

An alternative shorthand version is also available -- wrap the properties within array brackets.

```js
aliases: [{type: String, minLength: 1}]
```

#### Object

**objectType**
Allows you to define a typed object.

```js
company: {type: Object, objectType: {
  name: String
}}
```

An alternative shorthand version is also available -- simply pass a descriptor.

```js
company: {
  name: String
}
```

#### Alias

**index (required)**

The index key of the property being aliased.

```js
zip: String,
postalCode: {type: 'alias', target: 'zip'}
// this.postalCode = 12345 -> this.toObject() -> {zip: '12345'}
```

## Middleware <a id="middleware"></a>

Similar to Mongoose middleware, Lounge exposes `pre` and `post` [hooks](https://www.npmjs.com/package/hooks-fixed).
Normally this is used to do additional validation pre save, and cleanup post document removal. Although the hooks can be
setup for any method including `toObject` and `toJON` methods.


```js
var userSchema = lounge.schema({
  firstName: String,
  lastName: String,
  email: String
});

userSchema.pre('save', function (next) {
  if (this.email) {
    this.email = this.email.toLowerCase();
  }

  // we must call next to continue control flow 
  next();
});

userSchema.post('remove', function () {
  console.log('document %s removed', this.id);
});
```

Important note here is that post 'save' and 'remove' hooks do not receive any form of control flow. There are no
callbacks passed.

The callback passed into pre hooks have be used to control flow of logic and execution:

```js
schema.pre('save', function (next) {
  // some custom validation method
  if (!this.validate()) {
    return next(new Error('Validation error!'));
  }
 
  next();
});

// elsewhere...

doc.save(function(err, savedDoc) {
  if(err) console.log(err); // 'Validation error!' Document was not saved
});
```

**onBeforeValueSet(key, value) / onValueSet(key, value)**

`onBeforeValueSet` / `onValueSet` allow you to bind an event handler to all write operations on an object. 
Currently, it will only notify of write operations on the object itself and will not notify you when child objects are 
written to. If you return false or throw an error within the `onBeforeValueSet` handler, the write operation will be 
cancelled. Throwing an error will add the error to the error stack.

```js
var User = lounge.schema({ name: String }, {
  onBeforeValueSet: function(key, value) {
    if(key === 'name' && value.indexOf('Joe') >= 0) {
      return false;
    });
  }
});

var User = lounge.model('User', schema);
var user = new User();
user.name = 'Bill'; // { name: undefined }
user.name = 'Joe Smith'; //  { name: 'Joe Smith' }
```

## Schema Extension <a id="extend"></a>

It is useful to have a common base schema, that all other schemas / models would extend or "inherit" properties from.
This can be accomplished by using the `Schema.extend` function. When used all properties, virtuals,
methods, statics, and middleware that are present in the base schema **but not** present in destination schema are copied 
into the destination schema.

```js
 var baseSchema = lounge.schema({
  metadata: {
    doc_type: String,
    createdAt: Date,
    updatedAt: Date
  }
});

baseSchema.pre('save', function (next) {
  if (!this.metadata) {
    this.metadata = {};
  }

  var now = new Date();

  if (!this.metadata.createdAt) {
    this.metadata.createdAt = now;
  }

  this.metadata.updatedAt = now;
  this.metadata.doc_type = this.modelName;

  next();
});

baseSchema.method('baseFoo', function () {
  console.log('base foo');
});

var userSchema = lounge.schema({
  name: String,
  email: String,
});

userSchema.pre('save', function (next) {
  if (this.email) {
    this.email = this.email.toLowerCase();
  }

  next();
});

userSchema.method('userFoo', function () {
  console.log('user foo');
});

// make user schema extend the base schema 
userSchema.extend(baseSchema);
var User = lounge.model('User', userSchema);

user = new User({
  name: 'Bob Smith',
  email: 'BSmith@gmail.com'
});

user.baseFoo() // prints 'base foo'
user.userFoo() // prints 'user foo'

user.save(function(err, savedDoc) {
  console.log(user.metadata.updatedAt); // Sat Dec 29 2015 03:30:00 GMT-0400 (AST)
  console.log(user.metadata.doc_type); // 'user'
  console.log(user.email); // 'bsmith@gmail.com'
});
```

## Embedded Documents <a id="embedded"></a>

Lounge allows for embedding and referencing other Models within schema.

```js
var addressSchema = lounge.schema({
  street: String,
  city: String,
  country: String
});

var Address = lounge.model('Address', addressSchema);

var blogPostSchema = lounge.schema({
  title: String,
  body: String,
});

var BlogPost = lounge.model('BlogPost', blogPostSchema);

var userSchema = lounge.schema({
  name: String,
  address: Address,
  posts: [BlogPost]
});

var post = new BlogPost({
  title: 'Foo',
  body: 'Lorem ipsum'
});

var user = new User({
  name: 'Bob Smith',
  posts: [post],
  address: new Address({
    street: '123 Fake Street',
    city: 'Springfield',
    country: 'USA'
  })
});

user.posts.push(new BlogPost({
  title: 'Post 2',
  body: 'Some more text!'
});
```

You can manipulate and work with subdocument just like any model instances. When the top level document is saved
all child subdocuments are saved as well. Subdocuments **must** be an instance of the Model defined in the schema or a 
`String` in which case it represents the key / id of the subdocument.

## Saving Documents <a id="saving"></a>

Saving documents is done using `save` function that every model instance has. This will execute all pre 
'save' middleware and then perform Couchbase `upsert` operation on any subdocuments and the actual document. It will also
perform lookup document updates and finally execute any post hook middleware.

From our example code above:

```js
user.save(function(err, savedDoc) {
  if(err) console.log(err);
});
```

All documents and subdocuments would be upserted into the database.

**Model.save(data, options, fn)**

`data` - any data to be set into the model before saving.

**options**

All options not present here are first looked up from schema options, and then from config options.
* `storeFullReferenceId` - whether to save embedded document property values as full document keys or just the base value
* `storeFullKey` - whether to save the internal document key property as fully expanded value or as the simple value
* `refIndexKeyPrefix` - lookup index document key prefix.
* `waitForIndex` - whether we want to wait for indexing to finish before returning. default is false.
* `virtuals` - whether we want to save virtuals. default is `false`.
* `minimize` - to "minimize" the document by removing any empty properties. Default: `true`
* `expiry` - couchbase upsert option
* `persist_to` - couchbase persist_to option
* `replicate_to` - couchbase option

## Getting Documents <a id="getting"></a>

All models created come with a static function `findById` that can be used to look up a single or multiple keys and
retrieve documents from the database. If key does not exist and document is not found we **do not** return an error
but also no model is generated. This is different than present couchbase module behaviour.

```js
User.findById('user123', function(err, doc) {
if(err) console.log(err); // there was an error looking up the key
else if(!doc) console.log('no document found');
else console.log(doc); // doc is instance of User and will print it out
});
```

We can get multiple keys using an array as the first parameter. In this case, the callback invoked is passed 3 arguments
in form `(err, documents, misses)`.

```js
User.findById(['user123', 'user456'], function(err, docs, misses) {
if(err) console.log(err); // there was an error looking up the key
console.dir(docs);        // array of Users found
console.dir(misses);      // array if keys not found.
});
```

When `findById` is invoked using a single string argument the result returned is a single model instance. When an array
is passed in we return the results as described above. To force "array" type of returns in ALL cases, set the Lounge
config option `alwaysReturnArrays` to `true`. Default is `false`.

## Removing Documents <a id="removing"></a>

Removing documents is done using `remove` function that every model instance has. This will execute all pre 
'remove' middleware and then perform Couchbase `remove` operation. It will also perform lookup document updates 
and finally execute any post hook middleware. By default this function **does not** remove embedded documents. To do
this set `removeRefs` options to `true`.

```js
user.remove(function(err, doc) {
  if(err) console.log(err);
});
```

If we want all subdocuments to be removed:

```js
user.remove(function(err, {removeRefs: true}, doc) {
  if(err) console.log(err);
});
```

This will execute removal, hooks and indexing operations for all documents and subdocuments.

## Population <a id="population"></a>

`findById` comes with an options parameter that can have one property `populate` that can be used to dictate 
if and how we want to get any embedded subdocuments from the database. If `populate` option is `true` all embedded 
subdocuments are retrieved from the database.
 
From our "Embedded Documents" example, if we were to retrieve the user document created:

```js
User.findById(userId, {populate: true}, function(err, doc) {
  console.log(user instanceof User); // true
  console.log(user.address instanceof Address); // true
  console.log(user.posts[0] instanceof BlogPost); // true
  
  console.log(user); // full user document with retrieved address and posts subdocuments
});
```

We can specify a single field to populate:

```js
User.findById(userId, {populate: 'address'}, function(err, doc) {
  console.log(user instanceof User); // true
  console.log(user.address instanceof Address); // true
  console.log(user.posts[0] instanceof BlogPost); // false 
  console.log(user.posts[0] instanceof String); // true - posts is an array of string keys
});
```

```js
User.findById(userId, {populate: 'posts'}, function(err, doc) {
  console.log(user instanceof User); // true
  console.log(user.address instanceof Address); // false
  console.log(user.posts[0] instanceof BlogPost); // true
});
```

We can explicitly specify array indexes to populate

```js
User.findById(userId, {populate: 'posts.1'}, function(err, doc) {
  console.log(user instanceof User); // true
  console.log(user.address instanceof Address); // false
  console.log(user.posts[0] instanceof BlogPost); // false
  console.log(user.posts[0] instanceof String); // true
  console.log(user.posts[1] instanceof BlogPost); // true - fully populated
});
```

Finally, `populate` can accept an array if fields to populate:
 
```js
User.findById(userId, {populate: ['address', 'posts.1']}, function(err, doc) {
  console.log(user instanceof User); // true
  console.log(user.address instanceof Address); // true - fully populated
  console.log(user.posts[0] instanceof BlogPost); // false
  console.log(user.posts[0] instanceof String); // true
  console.log(user.posts[1] instanceof BlogPost); // true - fully populated
});
```

## Indexes <a id="indexes"></a>

Lounge provides Indexing mechanism using [reference lookup documents](http://docs.couchbase.com/developer/dev-guide-3.0/lookups.html).
This allows us to set up simple one to one lookups for easier document retrieval where we do not need to do create view
indexes. Specifying an index property is done at schema level:

```js
var userSchema = lounge.schema({
  name: String,
  email: {type: String, index: true}
});
```

Here we wish `User` models to have their own `id` as document key, but we want to be able to look up documents via email
as well as that is also unique property for users. Lounge will automatically manage (remove and upsert) lookup documents,
as user is `saved` or `removed`. 
 
```js
var user = new User({
  name: 'Joe Smith',
  email: 'joe@gmail.com'
});

user.save();
```

This will create the a lookup document similar to:

```
{ key: '2ba8a471-063b-420a-aa83-31debe58f46f' }
```

with document key `'$_ref_by_email_joe@gmail.com'`. We can manipulate this behaviour using schema options.

```js
var userSchema = lounge.schema({
  name: String,
  email: {type: String, index: true}
}, {
  keyPrefix: 'user::',
  delimiter: '::'
});
```

Saving a document defined with this schema will save user document with key `'user::5c4bfd6d-9c80-452b-be3a-3e528e4f53f5'`
and will save a lookup document with key `''user::$_ref_by_email::joe@gmail.com'`. Setting `refIndexKeyPrefix` can add
additional customization.

```js
{
  keyPrefix: 'user::',
  delimiter: '::',
  refIndexKeyPrefix: 'lookup_by_'
}
```
This will result in lookup document key `user::lookup_by_email::joe@gmail.com`.

Indexes can also be arrays:

```js
var userSchema = lounge.schema({
  name: String
  usernames: [{type: String, index: true}]
});
```

A lookup document will be generated for each value in the array. Index lookup properties have to be of type `String` or
`Number`.

Index lookup documents are automatically managed by lounge when documents are saved and removed using `save()` and
`remove()` functions. You can also manually kick of this process by calling `index()` function on any model instance.

#### Index queries <a id="queries"></a>

Any indexed property the Model will automatically get a `findBy*` static function for easier lookup. 
For example code above:

```js
var User = lounge.model('User', userSchema);

User.findByEmail('joe@gmail.com', function(err, doc) {
  if(err) console.log(err);
  else console.log(doc);
});
```

We automatically singularize and camelize property key to derive the index name. So `usernames` becomes `findByUsername`.
We can specify the index "name" by passing along the `indexName` property. For example:

```js
var userSchema = lounge.schema({
  name: String
  usernames: [{type: String, index: true, indexName: 'UN'}]
});

var User = lounge.model('User', userSchema);

User.findByUN('user1', function(err, doc) {
  if(err) console.log(err);
  else console.log(doc);
});
```

## Events <a id="events"></a>

All model instances inherit [`EventEmitter`](https://nodejs.org/api/events.html#events_class_events_eventemitter), and 
emit three events:

* `index` - when indexing of lookup documents finished regardless if successful or not. Emits `error` if there was any.
* `save` - when the document was successfully saved.
* `remove` - when the document was successfully removed.

```js
var userSchema = lounge.schema({
  name: String,
  email: {type: String, index: true}
});

var User = lounge.model('User', userSchema);
var user = new User({
  name: 'Bob Smith',
  email: 'bob@gmail.com'
});

user.on('index', function (err) {
  if(err) console.log('Error indexing document' + err.message);
});

user.on('remove', function (doc) {
  console.log('document removed');
});

user.on('save', function (doc) {
  console.log('document saved');
});
```

## Errors <a id="errors"></a>

When setting a value fails, an error is generated silently. Errors can be retrieved with `getErrors()` and cleared with `clearErrors()`.

```js
var schema = new lounge.schema({
  id: {type: String, minLength: 5}
});

var Profile = lounge.model('Profile', schema);

var profile = new Profile();
profile.id = '1234';

console.log(profile.hasErrors()); // true

console.log(profile.getErrors());

// Prints:
[ { errorMessage: 'String length too short to meet minLength requirement.',
    setValue: '1234',
    originalValue: undefined,
    fieldSchema: { name: 'id', type: 'string', minLength: 5 } } ]

// Clear all errors.
profile.clearErrors();
```

## Tests

Module automated tests can be run using `npm test` command. The tests are executed using [Couchbase mocking](https://github.com/couchbase/couchnode#mock-testing).
To run tests against an actual local database create a bucket `lounge_test` and remove `LOUNGE_COUCHBASE_MOCK=true` from
`test` script property in `package.json`.

## Credits

Lots of code and design inspired by [Mongoose](http://mongoosejs.com/).
Uses modified code from [node-schema-object](https://github.com/scotthovestadt/node-schema-object) for modelling.

## License

Copyright 2015 Bojan D.

Licensed under the MIT License.