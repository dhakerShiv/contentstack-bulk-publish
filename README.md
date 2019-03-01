
# Contentstack Bulk Publish

# About this Package
This is contentstack headless cms specific only 
Bulk publish Contenttype Entries and Assets

Notes - It does not publish referenced entries implicitly, so add all contenttypes you want to publish

Install:
```
npm install contentstack-bulk-publish

```

An example

```
const publish = require('contentstack-bulk-publish').publish

publish({
  "api_key"     : "your stack api key",
  "email"       : "your contentstack login email",
  "password"    : "your contentstack login password",
  "entries"     : {
    "locales"     :["en-us"], // Mention all locales in array in which you want to publish
    "environments": ["local", "development"], // Mention all environments in which you want to publish 
    "contentTypes": ["states", "countries"] // Mention all contentypes to publish
  },
  "assets"      : {
    "folder"      : "cs_root", // folder uid, default - cs_root, it has all assets
    "locales"     :["en-us"],  // Mention all locales in array in which you want to publish
    "environments": ["local", "development"] // Mention all environments in which you want to publish 
  }
})
.then( () => console.log("We are done!"))
.catch( err => console.log(err))

```