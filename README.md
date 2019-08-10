
# Contentstack Bulk Publish

# About this Package
This is contentstack headless cms specific only 
Bulk publish Contenttype Entries and Assets

New : added support for publising of all referenced/nested entries/assets

Install:
```
npm install contentstack-bulk-publish

```

An example

```
const publish = require('contentstack-bulk-publish').publish

publish({
  "api_key"     : "stack api key",
  "email"       : "contentstack login email",
  "password"    : "contentstack login password",
  "authtoken"   : "user auth token" // You do not need to add email and password if you are adding it
  "entries"     : { // Remove this if you do not want to publish any Contenttypes
    "locales"     : ["en-us"], // Mention all locales in array in which you want to publish
    "environments": ["local", "development"], // Mention all environments in which you want to publish 
    "contentTypes": ["states", "countries"] // Mention all contentypes to publish
    "nested"      : true // It will publish all nested Contenttypes/assets
  },
  "assets"      : { // Remove this if you do not want to publish any assets
    "folder"      : "eo92847dhuhdue38", // Folder uid, default - cs_root, it has all assets
    "locales"     :["en-us"],  // Mention all locales in array in which you want to publish
    "environments": ["local", "development"] // Mention all environments in which you want to publish 
  }
})
.then( () => console.log("We are done!"))
.catch( err => console.log(err))

```