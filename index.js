const request       = require('request-promise-native')
const winston       = require('winston')
let config          = {}
const recordedInfo  = {}

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
    let response = await login()
    config.authtoken = response.user.authtoken  
  }

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
      ++skip
    }
    catch (err) {
      errorHandler(err)
    }
  }
  recordedInfo["assets"] = {"published": publishedCount}
}

function getAssets (folder = "cs_root", skip = 0, limit = 100) {
  print(`\rFetching Assets Entries...`)
	const options = {
		url:'https://api.contentstack.io/v3/assets',
		method: "GET",
		headers : {
      "api_key"      : config.api_key,
      "authtoken"    : config.authtoken,
      'Content-Type' : 'application/json'
    },
    qs: {
      folder,
      skip,
      limit
    },
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
		url:'https://api.contentstack.io/v3/assets/'+ assetUid +'/publish',
		method: "POST",
		headers : {
      "api_key"      : config.api_key,
      "authtoken"    : config.authtoken,
      'Content-Type' : 'application/json'
    },
    body: {
      asset: {
        "environments": config.assets.environments,
        "locales"     : config.assets.locales
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
  const limit                            = 100
  let publishedCount                     = 0
  recordedInfo[contentType]              = {}
  recordedInfo[contentType]['total']     = 0
  recordedInfo[contentType]['published'] = 0

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
      ++skip
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
		url:'https://api.contentstack.io/v3/content_types/' + contentTypeUid + '/entries/',
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
      await publishEntry(contentTypeUid, entries[i].uid)
      ++count
      print(`\rPublished ${recordedInfo[contentTypeUid]['published'] + count} entries out of ${recordedInfo[contentTypeUid]['total']} of ${contentTypeUid}`)
    }
    catch (err) {
      errorHandler(err)
    }
  }

  return count
}

function publishEntry (contentTypeUid, entryUid) {
	const options = {
		url:'https://api.contentstack.io/v3/content_types/' + contentTypeUid + '/entries/' + entryUid + '/publish',
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
    level: 'error',
    message: err.message
  })
}

function login() {
  print(`\rLogging in...`)
  const options = { 
    method : 'POST',
    url    : 'https://api.contentstack.io/v3/user-session',
    headers: {
      'content-type': 'application/json' 
    },
    body: { 
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
    url    : 'https://api.contentstack.io/v3/user-session',
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

module.exports.publish = startProcess