const core = require('@actions/core');
const axios = require('axios');
const fs = require('fs');





const validateInt = (value) => {
	const parsed = parseInt(value);
	if (!isNaN(parsed) && parsed > 0) {
		return parsed;
	}
	return null;
}

const validateStr = (value) => {
	if (typeof value === 'string') {
		if (value.length > 0) {
			return value;
		}
	}
	return null;
}





const fail = (statusCode, message) => {
	return {
		success: false,
		message,
		statusCode,
		versionNumber: -1,
	}
}





const tryPublish = async (config) => {
	console.log('Publishing to Roblox...')
	return await (axios.default({
		method: 'POST',
		url: `https://apis.roblox.com/universes/v1/${config.universeId}/places/${config.placeId}/versions?versionType=Published`,
		data: config.file,
		headers: {
			'Content-Type': (config.isRbxl ? 'application/octet-stream' : 'application/xml'),
			'x-api-key': config.apiKey,
		}
	}).then((res) => {
		console.log('Parsing response...')
		// Make sure we got a proper response json
		const data = (typeof res.data === 'string') ? JSON.parse(res.data) : res.data
		if (typeof data === 'object') {
			// Check for successful result including version number
			const version = validateInt(data.versionNumber)
			if (version) {
				console.log('')
				console.log('Published to roblox successfully!')
				console.log('New version number: ' + version.toString())
				console.log('')
				return {
					success: true,
					message: 'Published!',
					statusCode: res.status,
					versionNumber: version,
				}
			}
			// Check for error result including code & message
			const code = validateInt(data.code)
			const message = validateStr(data.message)
			if (code && message) {
				return fail(res.status, `Failed with error code #${code}: ${message}`)
			}
		}
		// We got some weird undocumented response
		return fail(res.status, `Unknown response: ${data}`)
	}).catch((error) => {
		if (error.response) {
			const statusCode = error.response.status
			// The request was made and the server responded with
			// a status code that falls out of the range of 2xx
			return fail(statusCode, `${statusCode} ${error.response.statusText}`)
		} else if (error.request) {
			// The request was made but no response was received
			return fail(0, 'No response from server')
		} else {
			// Something bad happened in setting up
			// the request that triggered an Error
			return fail(0, `Error: ${error.message}`);
		}
	}))
}





const run = async () => {
	// Print initial space (looks nicer on GitHub) & message
	console.log('')
	console.log('Validating params...')
	// Get & validate all inputs from the action
	const universeId = validateInt(core.getInput('universe-id'));
	const placeId = validateInt(core.getInput('place-id'));
	const apiKey = validateStr(core.getInput('api-key'));
	const path = validateStr(core.getInput('path'));
	const maxRetries = validateInt(core.getInput('max-retries'));
	// Check if all inputs are good
	if (!universeId) { return fail(-1, 'Universe id was not valid') }
	if (!placeId) { return fail(-1, 'Place id was not valid') }
	if (!apiKey) { return fail(-1, 'Missing API key') }
	if (!path) { return fail(-1, 'Missing file path') }
	if (!maxRetries) { return fail(-1, 'Max retries was not valid') }
	// Check to make sure we got either a .rbxl or .rbxlx file path
	const isRbxl = path.endsWith('.rbxl')
	const isRbxlx = path.endsWith('.rbxlx')
	if (!(isRbxl || isRbxlx)) {
		return fail(-1, 'Invalid file format')
	}
	// Try to read the given file path
	console.log('Reading place file...')
	let file
	try {
		file = await fs.promises.readFile(path)
	} catch {
		return fail(-1, `Unable to read file at "${path}"`)
	}
	// Create config for publishing and retrying when necessary
	const config = {
		universeId,
		placeId,
		apiKey,
		path,
		maxRetries,
		isRbxl,
		isRbxlx,
		file
	}
	// Try to publish using the open cloud api
	let retries = 0
	let result = await tryPublish(config)
	while ((!result.success) && (retries <= maxRetries)) {
		console.log(`Publishing to Roblox failed with status code ${result.statusCode}!`)
		// Retry only on server error
		if (result.statusCode >= 500) {
			retries += 1
			console.log(`Retrying... (${retries} of ${maxRetries})`)
			result = await tryPublish(config)
		} else {
			// Probably an error on our end, so emit some extra, maybe
			// helpful messages whenever we know what might have gone wrong
			if ((result.statusCode == 401) || (result.statusCode == 403)) {
				console.log('Make sure the given API key is valid.')
			}
			break
		}
	}
	return result
}






run().then(res => {
	if (res.success) {
		core.setOutput('success', 'true')
		core.setOutput('message', 'Published!')
		core.setOutput('version-number', res.versionNumber.toString())
	} else {
		core.setOutput('success', 'false')
		core.setOutput('message', res.message)
		core.setOutput('version-number', '-1')
		core.setFailed(res.message)
	}
}).catch(err => {
	core.setOutput('success', 'false')
	core.setOutput('message', err)
	core.setOutput('version-number', '-1')
	core.setFailed(err)
})