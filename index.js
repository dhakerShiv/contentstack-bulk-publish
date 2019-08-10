const request       = require('request-promise-native')
const winston       = require('winston')
let config          = {}
const recordedInfo  = {}
const cdnUrl        = "https://cdn.contentstack.io/v3"
const serverUrl     = "https://api.contentstack.io/v3"
const allContentTypesSchema = {}

const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' })
  ]
})

async function startProcess (options) {
  print(`\rStarting process...`)

  config = options
  config.authtokenExists = true

  if (!config.authtoken || config.authtoken == "")
  {
    config.authtokenExists = false
    const response = await login()
    config.authtoken = response.user.authtoken  
  }

  if (config.entries.nested)
    await getAllContenttypes()

  if (config.entries && config.entries.contentTypes)
    await publishContentTypes(config.entries.contentTypes)

  if (config.assets)
    await getAndPublishAssets(config.assets)

  if (!config.authtokenExists)
    await logout()

  print(`\rWe got some info for you!\n`)
  Object.keys(recordedInfo).forEach( key => console.log(key, ":", recordedInfo[key]))
}

async function getAndPublishAssets (assets) {
  let response
  let assetsLength                = 100
  let skip                        = 0
  const limit                     = 100
  let publishedCount              = 0
  recordedInfo['totalAssets']     = 0
  recordedInfo['publishedAssets'] = 0

  while (assetsLength && assetsLength == 100)
  {
    try {
      // get assets entries
      response                     = await getAssets(assets.folder, skip, limit)
      assetsLength                 = response.assets.length
      recordedInfo['totalAssets'] += assetsLength

      // publish assets entries
      publishedCount                   = await publishAssets(response.assets)
      recordedInfo['publishedAssets'] += publishedCount
      skip += limit
    }
    catch (err) {
      errorHandler(err)
    }
  }
  recordedInfo["assets"] = {"published": publishedCount}
}

function getAssets (folder, skip = 0, limit = 100) {
  print(`\rFetching Assets Entries...`)

  const qs =  {
    skip,
    limit
  }

  if (folder)
    qs.folder = folder

  const options = {
    url: cdnUrl + '/assets',
    method: "GET",
    headers : {
      "api_key"      : config.api_key,
      "authtoken"    : config.authtoken,
      'Content-Type' : 'application/json'
    },
    qs,
    json: true
  }
  return request(options)
}

async function publishAssets (entries) {
  print(`\rPublishing Assets...`)
  let count = 0

  for (let i = 0; i < entries.length; i++)
  {
    try {
      await publishAsset(entries[i].uid)
      ++count
      print(`\rPublished ${recordedInfo['publishedAssets'] + count} assets out of ${recordedInfo['totalAssets']}`)
    }
    catch (err) {
      errorHandler(err)
    }
  }
  return count
}

function publishAsset (assetUid) {
  const options = {
    url: serverUrl + '/assets/'+ assetUid +'/publish',
    method: "POST",
    headers : {
      "api_key"      : config.api_key,
      "authtoken"    : config.authtoken,
      'Content-Type' : 'application/json'
    },
    body: {
      asset: {
        "environments": (config.assets || config.entries).environments,
        "locales"     : (config.assets || config.entries).locales
      }
    },
    json: true
  }
  return request(options)
}

async function publishContentTypes (contentTypes) {
  for (let i = 0; i < contentTypes.length; i++)
    await publishContentType(contentTypes[i])
}

async function publishContentType (contentType) {
  let response
  let entriesLength                      = 100
  let skip                               = 0
  const limit                            = 1
  let publishedCount                     = 0
  recordedInfo[contentType]              = recordedInfo[contentType] || {}
  recordedInfo[contentType]['total']     = recordedInfo[contentType]['total'] || 0
  recordedInfo[contentType]['published'] = recordedInfo[contentType]['published'] || 0

  while (entriesLength == 100)
  {
    try {
      // get entries
      response                            = await getEntries(contentType, skip, limit)
      entriesLength                       = response.entries.length 
      recordedInfo[contentType]['total'] += entriesLength

      // publish entries
      publishedCount                          = await publishEntries(contentType, response.entries)
      recordedInfo[contentType]['published'] += publishedCount
      skip += limit
    }
    catch (err) {
      errorHandler(err)
    }
  }
  recordedInfo[contentType] = {"published": publishedCount}
}

function getEntries (contentTypeUid, skip = 0, limit = 100) {
  print(`\rFetching Entries for ${contentTypeUid}...`)
  const options = {
    url: cdnUrl + '/content_types/' + contentTypeUid + '/entries/',
    method: "GET",
    headers : {
      "api_key"      : config.api_key,
      "authtoken"    : config.authtoken,
      'Content-Type' : 'application/json'
    },
    qs: {
      skip,
      limit
    },
    json: true
  }
  return request(options)
}

async function publishEntries (contentTypeUid, entries) {
  print(`\rPublishing Entries for ${contentTypeUid}...`)
  let count = 0

  for (let i = 0; i < entries.length; i++)
  {
    try {
      config.entries.nested &&
      allContentTypesSchema[contentTypeUid] &&
      await publishNestedEntries(allContentTypesSchema[contentTypeUid].schema, entries[i])

      await publishEntry(contentTypeUid, entries[i].uid)
      ++count

      recordedInfo[contentTypeUid] && 
      print(`\rPublished ${recordedInfo[contentTypeUid]['published'] + count} entries out of ${recordedInfo[contentTypeUid]['total']} of ${contentTypeUid}`)
    }
    catch (err) {
      errorHandler(err)
    }
  }

  return count
}

async function processGroup (schema, entry) {
  if (!entry[schema.uid])
    return

  if (!schema.multiple)
    entry[schema.uid] = [entry[schema.uid]]
 
  const groupArr = entry[schema.uid]

  for (let i = 0; i < groupArr.length; i++)
  {
    try {
      await publishNestedEntries(schema.schema, groupArr[i])
    }
    catch (err) {
      errorHandler(err)
    }
  }
}

async function processReference (schema, entry) {
  const references = entry[schema.uid]

  if (Array.isArray(references) && references.length)
  {
    try {
      const response = await getEntriesByUids(schema.reference_to, references)
      await publishEntries(schema.reference_to, response.entries)
    }
    catch (err) {
      errorHandler(err)
    }      
  }
}

async function processBlock (schema, entry) {
  const blocks = schema.blocks
  const objectsArr = entry[schema.uid]

  for (let i = 0; i < objectsArr.length; i++)
  {
    try {
      for (let j = 0; j < blocks.length; j++)
      {
        objectsArr[i][blocks[j].uid] &&
        await publishNestedEntries(blocks[j].schema, objectsArr[i][blocks[j].uid])
      }
    }
    catch (err) {
      errorHandler(err)
    }
  }
}

async function processFile (schema, entry) {
  const image = entry[schema.uid]

  if (image && image.uid)
  {
    try {
      await publishAsset(image.uid)
    }
    catch (err) {
      errorHandler(err)
    }
  }
}

async function processRTE (schema, entry) {
  const RTE = entry[schema.uid]

  if (!RTE)
    return

  let response = RTE.match(/blt[a-z0-9]{16}\/[a-z0-9]+/g)
  let assetUid

  if (Array.isArray(response))
  {
    for (let i = 0; i < response.length; i++)
    {
      try {
        assetUid = response[i].split('/')[1]
        assetUid && await publishAsset(assetUid)
      }
      catch (err) {
        errorHandler(err)
      }
    }
  }
}

async function publishNestedEntries (schema, entry) {
  if (!schema || !entry)
      return

  for (let i = 0; i < schema.length; i++)
  {
    switch (schema[i].data_type)
    {
      case "group": await processGroup(schema[i], entry)
        break
      case "reference": await processReference(schema[i], entry)
        break
      case "blocks": await processBlock(schema[i], entry)
        break
      case "file": await processFile(schema[i], entry)
        break
      case "text": schema[i].field_metadata.allow_rich_text && await processRTE(schema[i], entry)
        break
    }
  }
}

function publishEntry (contentTypeUid, entryUid) {
  const options = {
    url: serverUrl + '/content_types/' + contentTypeUid + '/entries/' + entryUid + '/publish',
    method: "POST",
    headers : {
      "api_key"      : config.api_key,
      "authtoken"    : config.authtoken,
      'Content-Type' : 'application/json'
    },
    body: {
      entry: {
        "environments": config.entries.environments,
        "locales"     : config.entries.locales
      }
    },
    json: true
  }
  return request(options)
}

function errorHandler (err) {
  logger.log({
    level   : 'error',
    message : err.message,
    stack   : err.stack
  })
}

function login() {
  print(`\rLogging in...`)
  const options = { 
    method : 'POST',
    url    : serverUrl + '/user-session',
    headers: {
      'content-type': 'application/json' 
    },
    body : { 
      user: {
        email   : config.email,
        password: config.password
      } 
    },
    json: true 
  }
  return request(options)
}

function logout () {
  print(`\rLogging out...`)
  const options = { 
    method : 'DELETE',
    url    : serverUrl + '/user-session',
    headers: {
      'content-type': 'application/json',
      'authtoken'   : config.authtoken,
    },
    json: true 
  }
  return request(options)
}

function print (str) {
  process.stdout.clearLine()
  process.stdout.write(str)
}

async function getAllContenttypes () {
  let Allresponse   = []
  let entriesLength = 100
  let skip          = 0
  const limit       = 100
  let response

  while (entriesLength == 100)
  {
    try {
      // get entries
      response      = await getContenttpes(skip, limit)
      entriesLength = response.content_types.length

      let uids = response.content_types.map( ele => {
        allContentTypesSchema[ele.uid] = ele
        return ele.uid
      })
      Allresponse = Allresponse.concat(uids)
      skip += limit
    }
    catch (err) {
      errorHandler(err)
    }
  }
  return Allresponse
}
  
function getContenttpes (skip = 0, limit = 100) {
  const options = {
    url     : "https://cdn.contentstack.io/v3/content_types?include_count=false",
    method  : "GET",
    headers : {
      "api_key"      : config.api_key,
      "authtoken"    : config.authtoken,
      'Content-Type' : 'application/json'
    },
    qs: {
      skip,
      limit
    },
    json: true
  }
  return request(options)
}

function getEntriesByUids (contentTypeUid, uids) {
  const options = {
    url     : cdnUrl + '/content_types/' + contentTypeUid + '/entries/',
    method  : "GET",
    headers : {
      "api_key"   : config.api_key,
      "authtoken" : config.authtoken
    },
    qs: {
      locale : "en-us",
      query  : {
        uid  : {
            $in: uids
        }
      }
    },
    json: true
  }
  return request(options)
}

module.exports.publish = startProcess