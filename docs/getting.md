# Getting Documents <a id="getting"></a>

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
is passed in we return the results as described above. To force `array` type of returns in **all** cases, set the Lounge
config option `alwaysReturnArrays` to `true`. Default is `false`.

By default order of the generated objects in an array result is not guaranteed to be the same order as the ids queried.
To keep the order of the returned model instances the same as the ids set `keepSortOrder` option to `true`.

By default the `findById` and index query functions return 3 parameters to the callback in form `(err, docs, missing)`.
If we want to force returning of 2 params at all times `(err, docs)`, and not return the `missing` parameter, we can
use the `missing` options either in `Lounge` settings to set globally, or individually in function invocations. If
`missing` option is set to `false` we won't return missing keys as the final param in the callback.

```js
lounge.setOption('missing', false);
User.findById(['user123', 'user456'], function(err, docs, misses) {
  if(err) console.log(err); // there was an error looking up the key
  console.dir(docs);        // array of Users found
  console.dir(misses);      // undefined
});
```


```js
lounge.setOption('missing', false);
User.findById(['user123', 'user456'], { missing: true },function(err, docs, misses) {
  if(err) console.log(err); // there was an error looking up the key
  console.dir(docs);        // array of Users found
  console.dir(misses);      // array of missing keys, as the option in function params takes presidence
});
```
